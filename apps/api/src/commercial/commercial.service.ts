import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
  HttpException,
  HttpStatus,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { RazorpayService } from './razorpay.service';
import { CreateCommercialOrderDto } from './dto/create-commercial-order.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import {
  COMMERCIAL_EVENT_DATES,
  COMMERCIAL_TICKET_TYPES,
  calculateServerPricePaise,
  generateOrderNumber,
} from './commercial.constants';
import { isCommercialTestPaymentEnabled } from './commercial-test-payment.util';
import {
  AttendeeStatus,
  CommercialOrderSource,
  CommercialPaymentMode,
  OrderStatus,
  PaymentStatus,
  RegistrationType,
  UserRole,
} from '@ongc/shared-types';
import * as crypto from 'crypto';
import * as QRCode from 'qrcode';
import { MailService } from '../mail/mail.service';

@Injectable()
export class CommercialService {
  private readonly logger = new Logger(CommercialService.name);
  private readonly recoveryEmailRateLimit = new Map<string, { count: number; expiresAt: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly razorpay: RazorpayService,
    private readonly mailService: MailService,
    @Optional() private readonly configService?: ConfigService,
  ) {}

  /**
   * Safe staging test payment mode determination.
   * STRICT FAILSAFE: Automatically disabled if NODE_ENV=production.
   */
  isTestPaymentMode(): boolean {
    const nodeEnv =
      this.configService?.get<string>('NODE_ENV') || process.env.NODE_ENV;
    const testPaymentEnv =
      this.configService?.get<string>('COMMERCIAL_TEST_PAYMENT') ||
      process.env.COMMERCIAL_TEST_PAYMENT;
    return isCommercialTestPaymentEnabled(nodeEnv, testPaymentEnv);
  }

  generateSecureQrToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  generateTicketNumber(orderNumber: string, index: number): string {
    const cleanRef = orderNumber.replace(/[^A-Z0-9]/gi, '').slice(-6).toUpperCase();
    const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
    return `TK-COMM-${cleanRef}-${index + 1}-${rand}`;
  }

  private maskCustomerEmail(email: string): string {
    if (!email) return '***';
    const parts = email.split('@');
    if (parts.length !== 2) return '***@***';
    const name = parts[0];
    const domain = parts[1];
    if (name.length <= 2) {
      return `${name[0]}***@${domain}`;
    }
    return `${name[0]}***${name[name.length - 1]}@${domain}`;
  }

  /**
   * Resilient asynchronous transactional email trigger.
   * Runs in background so payment confirmation is never delayed or blocked by email dispatch.
   * Logs safely without exposing secrets, QR tokens, or email bodies.
   */
  sendTicketEmailSafe(order: any, passes: any[]): void {
    if (!order?.customerEmail) return;

    setImmediate(async () => {
      try {
        await this.mailService.sendCommercialTicketEmail({
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          customerEmail: order.customerEmail,
          ticketType: order.ticketType,
          selectedDates: (order.selectedDates as string[]) || [],
          quantity: order.quantity || passes.length,
          amountInr: order.amountPaise ? order.amountPaise / 100 : 0,
          passes: passes.map((p) => ({
            ticketNumber: p.ticketNumber,
            token: p.qrCodeToken,
            category: p.category,
            attendeeName: p.name,
          })),
        });
      } catch (err: any) {
        this.logger.error(
          `Safe email error: Failed to dispatch ticket email for order ${order.orderNumber}: ${err?.message || 'Unknown error'}`,
        );
      }
    });
  }

  async getConfig() {
    const regSetting = await this.prisma.setting.findUnique({
      where: { key: 'registration_open' },
    });
    const isOpen = !regSetting || regSetting.value !== 'false';

    return {
      registrationOpen: isOpen,
      dates: COMMERCIAL_EVENT_DATES,
      ticketTypes: Object.values(COMMERCIAL_TICKET_TYPES).map((t) => ({
        code: t.code,
        name: t.name,
        timing: t.timing,
        description: t.description,
        originalPriceInr: t.originalPricePaise / 100,
        originalPricePaise: t.originalPricePaise,
        priceInr: t.unitPricePaise / 100,
        unitPricePaise: t.unitPricePaise,
        discountPercent: t.discountPercent,
        discountLabel: t.discountLabel,
        offerLabel: t.offerLabel,
        subtitle: t.subtitle,
        isSeasonPass: t.isSeasonPass,
      })),
      currency: 'INR',
      razorpayKeyId: this.razorpay.getPublicKeyId(),
      isLiveGateway: this.razorpay.isLiveGatewayConfigured(),
      maxQuantityPerOrder: 10,
    };
  }

  async createOrder(dto: CreateCommercialOrderDto, clientIp?: string) {
    // 1. Check system registration status
    const regSetting = await this.prisma.setting.findUnique({
      where: { key: 'registration_open' },
    });
    if (regSetting && regSetting.value === 'false') {
      throw new BadRequestException('Commercial pass booking is currently closed.');
    }

    // 2. Sensible rate-limiting abuse protection via Redis
    const rateLimitKey = `rl:comm-order:${clientIp || dto.customerMobile}`;
    try {
      const current = await this.redis.get(rateLimitKey);
      if (current && parseInt(current, 10) > 15) {
        throw new HttpException(
          'Too many order attempts. Please wait a moment before trying again.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      await this.redis.set(rateLimitKey, ((parseInt(current || '0', 10) + 1)).toString(), 120);
    } catch (err: any) {
      if (err instanceof HttpException) throw err;
      // Continue if Redis is unavailable
    }

    // 2. Mobile concurrency lock to prevent duplicate order creation races
    const cleanMobile = dto.customerMobile.trim();
    const mobileLockKey = `order_create:${cleanMobile}`;
    const mobileLockToken = await this.redis.acquireLock(mobileLockKey, 10);
    if (!mobileLockToken) {
      throw new BadRequestException(
        'An order is currently being initiated for this mobile number. Please complete or wait a moment.',
      );
    }

    // 2b. Mandatory terms acceptance verification
    if (!dto.termsAccepted) {
      throw new BadRequestException('Please accept the ticket terms & conditions to continue.');
    }

    try {
      // 3. Server-side authoritative price calculation — NEVER trust client-submitted amount
      const ticketTypeCode = dto.ticketType || 'COMMERCIAL_DAILY';
      if (!COMMERCIAL_TICKET_TYPES[ticketTypeCode]) {
        throw new BadRequestException(`Invalid commercial pass category: ${ticketTypeCode}`);
      }

      let pricing: {
        unitPricePaise: number;
        originalPricePaise: number;
        totalAmountPaise: number;
        totalOriginalAmountPaise: number;
        validDates: string[];
      };
      try {
        pricing = calculateServerPricePaise(ticketTypeCode, dto.selectedDates, dto.quantity);
      } catch (err: any) {
        throw new BadRequestException(err.message || 'Invalid ticket configuration.');
      }

      // 4. Generate internal order reference
      const orderNumber = generateOrderNumber();

      // 5. If staging test payment mode is active, directly create confirmed test order without calling Razorpay
      if (this.isTestPaymentMode()) {
        this.logger.warn(
          `[STAGING TEST PAYMENT] Creating test-paid commercial order for ${orderNumber} without Razorpay`,
        );

        const testPaymentId = `TEST_PAY_${orderNumber}`;
        const testOrderId = `TEST_ORD_${orderNumber}`;

        const { order, createdPasses } = await this.prisma.$transaction(async (tx: any) => {
          const newOrder = await tx.commercialOrder.create({
            data: {
              orderNumber,
              registrationType: RegistrationType.COMMERCIAL,
              source: CommercialOrderSource.PUBLIC,
              paymentMode: CommercialPaymentMode.RAZORPAY,
              customerName: dto.customerName.trim(),
              customerMobile: cleanMobile,
              customerEmail: dto.customerEmail.trim().toLowerCase(),
              ticketType: ticketTypeCode,
              selectedDates: pricing.validDates,
              quantity: dto.quantity,
              unitPricePaise: pricing.unitPricePaise,
              amountPaise: pricing.totalAmountPaise,
              currency: 'INR',
              orderStatus: OrderStatus.PAID,
              paymentStatus: PaymentStatus.AUTHORIZED,
              razorpayOrderId: testOrderId,
              razorpayPaymentId: testPaymentId,
              razorpaySignature: `TEST_SIG_${orderNumber}`,
              paidAt: new Date(),
              metadata: {
                originalUnitPricePaise: pricing.originalPricePaise,
                totalOriginalAmountPaise: pricing.totalOriginalAmountPaise,
                discountPercent: 50,
                offer: 'EARLY_BIRD',
                isTestPayment: true,
                testMode: 'STAGING_TEST_PAYMENT',
                testPaymentReference: testPaymentId,
                gateway: 'STAGING_TEST_MODE',
                termsAccepted: true,
                termsAcceptedAt: new Date().toISOString(),
              },
            },
          });

          const passes: any[] = [];
          const validDates = pricing.validDates;

          for (let i = 0; i < dto.quantity; i++) {
            const qrToken = this.generateSecureQrToken();
            const ticketNumber = this.generateTicketNumber(orderNumber, i);

            const attendee = await tx.attendee.create({
              data: {
                registrationType: RegistrationType.COMMERCIAL,
                orderId: newOrder.id,
                name: newOrder.customerName,
                mobile: newOrder.customerMobile,
                email: newOrder.customerEmail,
                category: 'Commercial Pass',
                ticketNumber,
                qrCodeToken: qrToken,
                status: AttendeeStatus.ACTIVE,
                bookingDays: validDates,
              },
            });

            passes.push(attendee);
          }

          return { order: newOrder, createdPasses: passes };
        });

        const formattedPasses = await this.formatPasses(createdPasses);

        // Send transactional ticket email asynchronously (non-blocking)
        this.sendTicketEmailSafe(order, createdPasses);

        return {
          success: true,
          isTestPayment: true,
          message: 'Staging test order created and verified successfully.',
          order: {
            orderNumber: order.orderNumber,
            amountInr: order.amountPaise / 100,
            amountPaise: order.amountPaise,
            currency: order.currency,
            quantity: order.quantity,
            ticketType: order.ticketType,
            selectedDates: order.selectedDates,
            orderStatus: order.orderStatus,
            paymentStatus: order.paymentStatus,
            razorpayOrderId: order.razorpayOrderId,
            isTestPayment: true,
            testPaymentReference: testPaymentId,
            customer: {
              name: order.customerName,
              email: order.customerEmail,
              mobile: order.customerMobile,
            },
          },
          passes: formattedPasses,
        };
      }

      // 5. Create Razorpay order (live / mock gateway flow)
      const rzpOrder = await this.razorpay.createRazorpayOrder(
        pricing.totalAmountPaise,
        orderNumber,
        {
          orderNumber,
          customerMobile: cleanMobile,
          ticketType: ticketTypeCode,
          quantity: dto.quantity.toString(),
        },
      );

      // 6. Persist commercial order in database (status: PENDING, payment: CREATED)
      const order = await this.prisma.commercialOrder.create({
        data: {
          orderNumber,
          registrationType: RegistrationType.COMMERCIAL,
          source: CommercialOrderSource.PUBLIC,
          paymentMode: CommercialPaymentMode.RAZORPAY,
          customerName: dto.customerName.trim(),
          customerMobile: cleanMobile,
          customerEmail: dto.customerEmail.trim().toLowerCase(),
          ticketType: ticketTypeCode,
          selectedDates: pricing.validDates,
          quantity: dto.quantity,
          unitPricePaise: pricing.unitPricePaise,
          amountPaise: pricing.totalAmountPaise,
          currency: 'INR',
          orderStatus: OrderStatus.PENDING,
          paymentStatus: PaymentStatus.CREATED,
          razorpayOrderId: rzpOrder.id,
          metadata: {
            originalUnitPricePaise: pricing.originalPricePaise,
            totalOriginalAmountPaise: pricing.totalOriginalAmountPaise,
            discountPercent: 50,
            offer: 'EARLY_BIRD',
            termsAccepted: true,
            termsAcceptedAt: new Date().toISOString(),
          },
        },
      });

      return {
        success: true,
        order: {
          orderNumber: order.orderNumber,
          amountInr: order.amountPaise / 100,
          amountPaise: order.amountPaise,
          currency: order.currency,
          quantity: order.quantity,
          ticketType: order.ticketType,
          selectedDates: order.selectedDates,
          razorpayOrderId: order.razorpayOrderId,
          razorpayKeyId: this.razorpay.getPublicKeyId(),
          customer: {
            name: order.customerName,
            email: order.customerEmail,
            mobile: order.customerMobile,
          },
        },
      };
    } finally {
      if (mobileLockToken) {
        await this.redis.releaseLock(mobileLockKey, mobileLockToken);
      }
    }
  }

  async verifyPayment(dto: VerifyPaymentDto) {
    const lockKey = `lock:verify-order:${dto.orderNumber}`;
    const lockToken = await this.redis.acquireLock(lockKey, 15);

    try {
      // 1. Fetch order
      const order = await this.prisma.commercialOrder.findUnique({
        where: { orderNumber: dto.orderNumber },
        include: { attendees: true },
      });

      if (!order) {
        throw new NotFoundException(`Order with reference ${dto.orderNumber} not found.`);
      }

      // 2. Idempotency check: if already confirmed/paid, return existing passes
      if (order.orderStatus === OrderStatus.PAID && order.paymentStatus === PaymentStatus.CAPTURED) {
        const passesWithSvg = await this.formatPasses(order.attendees);
        return {
          success: true,
          message: 'Payment already verified.',
          orderNumber: order.orderNumber,
          ticketType: order.ticketType,
          selectedDates: order.selectedDates,
          quantity: order.quantity,
          amountInr: order.amountPaise / 100,
          customerEmail: order.customerEmail,
          passes: passesWithSvg,
        };
      }

      // 3. Verify razorpay_order_id matches database record
      if (order.razorpayOrderId !== dto.razorpayOrderId) {
        this.logger.warn(`Razorpay order ID mismatch on verification for ${dto.orderNumber}`);
        throw new BadRequestException('Security verification failed: Order ID mismatch.');
      }

      // 4. Cryptographic HMAC-SHA256 signature verification
      const isSignatureValid = this.razorpay.verifyPaymentSignature(
        dto.razorpayOrderId,
        dto.razorpayPaymentId,
        dto.razorpaySignature,
      );

      if (!isSignatureValid) {
        this.logger.error(`Invalid payment signature for order: ${dto.orderNumber}`);
        await this.prisma.commercialOrder.update({
          where: { id: order.id },
          data: {
            failedAt: new Date(),
            failureReason: 'Cryptographic signature verification failed',
          },
        });
        throw new BadRequestException('Payment signature verification failed.');
      }

      // 5. Atomic transaction: confirm payment and generate secure commercial passes
      const createdPasses = await this.prisma.$transaction(async (tx) => {
        await tx.commercialOrder.update({
          where: { id: order.id },
          data: {
            orderStatus: OrderStatus.PAID,
            paymentStatus: PaymentStatus.CAPTURED,
            razorpayPaymentId: dto.razorpayPaymentId,
            razorpaySignature: dto.razorpaySignature,
            paidAt: new Date(),
          },
        });

        const passes: any[] = [];
        const validDates = order.selectedDates as string[];

        for (let i = 0; i < order.quantity; i++) {
          const qrToken = this.generateSecureQrToken();
          const ticketNumber = this.generateTicketNumber(order.orderNumber, i);

          const attendee = await tx.attendee.create({
            data: {
              registrationType: RegistrationType.COMMERCIAL,
              orderId: order.id,
              name: order.customerName,
              mobile: order.customerMobile,
              email: order.customerEmail,
              category: 'Commercial Pass',
              ticketNumber,
              qrCodeToken: qrToken,
              status: AttendeeStatus.ACTIVE,
              bookingDays: validDates,
            },
          });

          passes.push(attendee);
        }

        return passes;
      });

      const formattedPasses = await this.formatPasses(createdPasses);

      // Send transactional ticket email asynchronously (non-blocking)
      this.sendTicketEmailSafe(order, createdPasses);

      return {
        success: true,
        message: 'Payment confirmed successfully. Your digital entry pass is ready.',
        orderNumber: order.orderNumber,
        ticketType: order.ticketType,
        selectedDates: order.selectedDates,
        quantity: order.quantity,
        amountInr: order.amountPaise / 100,
        customerEmail: order.customerEmail,
        passes: formattedPasses,
      };
    } finally {
      if (lockToken) {
        await this.redis.releaseLock(lockKey, lockToken);
      }
    }
  }

  async handleWebhook(rawBody: string, signature: string) {
    // 1. Cryptographic HMAC-SHA256 signature verification
    const isValid = this.razorpay.verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      this.logger.error('Invalid Razorpay webhook signature');
      throw new BadRequestException('Invalid webhook signature');
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      throw new BadRequestException('Malformed JSON body');
    }

    const eventId = payload?.event_id || payload?.id;
    if (!eventId) {
      throw new BadRequestException('Missing webhook event ID');
    }

    // 2. Idempotency check: duplicate delivery must safely do nothing
    const existingEvent = await this.prisma.paymentWebhookEvent.findUnique({
      where: { eventId },
    });
    if (existingEvent) {
      this.logger.log(`Webhook event [${eventId}] already processed. Skipping duplicate.`);
      return { status: 'already_processed' };
    }

    const eventType = payload.event;
    const paymentEntity = payload?.payload?.payment?.entity;
    const razorpayOrderId = paymentEntity?.order_id;
    const razorpayPaymentId = paymentEntity?.id;

    let targetOrder: any = null;
    if (razorpayOrderId) {
      targetOrder = await this.prisma.commercialOrder.findUnique({
        where: { razorpayOrderId },
      });
    }

    // Record webhook event receipt
    await this.prisma.paymentWebhookEvent.create({
      data: {
        eventId,
        orderId: targetOrder?.id || null,
        eventType,
        paymentId: razorpayPaymentId || null,
        processed: false,
        payloadSummary: {
          event: eventType,
          orderId: razorpayOrderId,
          paymentId: razorpayPaymentId,
          amount: paymentEntity?.amount,
          status: paymentEntity?.status,
        },
      },
    });

    // 3. Process payment confirmation if captured/paid and not yet marked paid
    if (
      (eventType === 'payment.captured' || eventType === 'order.paid') &&
      targetOrder &&
      targetOrder.orderStatus !== OrderStatus.PAID
    ) {
      const lockKey = `lock:verify-order:${targetOrder.orderNumber}`;
      const lockToken = await this.redis.acquireLock(lockKey, 15);

      try {
        await this.prisma.$transaction(async (tx) => {
          await tx.commercialOrder.update({
            where: { id: targetOrder.id },
            data: {
              orderStatus: OrderStatus.PAID,
              paymentStatus: PaymentStatus.CAPTURED,
              razorpayPaymentId: razorpayPaymentId || targetOrder.razorpayPaymentId,
              paidAt: new Date(),
            },
          });

          // Check if passes already created
          const count = await tx.attendee.count({
            where: { orderId: targetOrder.id },
          });

          if (count === 0) {
            const validDates = targetOrder.selectedDates as string[];
            for (let i = 0; i < targetOrder.quantity; i++) {
              const qrToken = this.generateSecureQrToken();
              const ticketNumber = this.generateTicketNumber(targetOrder.orderNumber, i);

              await tx.attendee.create({
                data: {
                  registrationType: RegistrationType.COMMERCIAL,
                  orderId: targetOrder.id,
                  name: targetOrder.customerName,
                  mobile: targetOrder.customerMobile,
                  email: targetOrder.customerEmail,
                  category: 'Commercial Pass',
                  ticketNumber,
                  qrCodeToken: qrToken,
                  status: AttendeeStatus.ACTIVE,
                  bookingDays: validDates,
                },
              });
            }
          }
        });

        await this.prisma.paymentWebhookEvent.update({
          where: { eventId },
          data: { processed: true },
        });

        this.logger.log(`Order [${targetOrder.orderNumber}] confirmed via Razorpay webhook [${eventId}].`);

        // Dispatch transactional ticket email asynchronously
        const webhookPasses = await this.prisma.attendee.findMany({
          where: { orderId: targetOrder.id },
        });
        this.sendTicketEmailSafe(targetOrder, webhookPasses);
      } finally {
        if (lockToken) {
          await this.redis.releaseLock(lockKey, lockToken);
        }
      }
    } else if (eventType === 'payment.failed' && targetOrder && targetOrder.orderStatus === OrderStatus.PENDING) {
      await this.prisma.commercialOrder.update({
        where: { id: targetOrder.id },
        data: {
          failedAt: new Date(),
          failureReason: paymentEntity?.error_description || 'Payment failed via webhook',
        },
      });
      await this.prisma.paymentWebhookEvent.update({
        where: { eventId },
        data: { processed: true },
      });
    }

    return { success: true };
  }

  async getOrder(orderNumber: string, mobileQuery?: string) {
    const order = await this.prisma.commercialOrder.findUnique({
      where: { orderNumber },
      include: {
        attendees: {
          where: { registrationType: RegistrationType.COMMERCIAL },
        },
      },
    });

    if (!order || order.registrationType !== RegistrationType.COMMERCIAL) {
      throw new NotFoundException(`Order ${orderNumber} not found.`);
    }

    // IDOR protection: only return QR passes and full PII if verified by matching mobile / last 4 digits
    const isVerified =
      !!mobileQuery &&
      (mobileQuery.trim() === order.customerMobile ||
        order.customerMobile.endsWith(mobileQuery.trim()));

    const passesWithSvg =
      isVerified || order.orderStatus !== OrderStatus.PAID
        ? await this.formatPasses(order.attendees)
        : [];

    const isTestPayment = (order.metadata as any)?.isTestPayment === true;
    const testPaymentReference = (order.metadata as any)?.testPaymentReference || null;

    return {
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus,
      paymentStatus: isTestPayment ? 'TEST_PAID' : order.paymentStatus,
      isTestPayment,
      testPaymentReference,
      customerName: isVerified ? order.customerName : `${order.customerName.slice(0, 2)}***`,
      customerMobile: isVerified ? order.customerMobile : `******${order.customerMobile.slice(-4)}`,
      customerEmail: isVerified ? order.customerEmail : '***@***',
      ticketType: order.ticketType,
      selectedDates: order.selectedDates,
      quantity: order.quantity,
      amountInr: order.amountPaise / 100,
      amountPaise: order.amountPaise,
      currency: order.currency,
      razorpayOrderId: order.razorpayOrderId,
      createdAt: order.createdAt,
      paidAt: order.paidAt,
      failureReason: order.failureReason,
      passes: passesWithSvg,
    };
  }

  async listOrdersAdmin(
    pageOrOptions?:
      | number
      | {
          page?: number;
          limit?: number;
          source?: string;
          agentId?: string;
          ticketType?: string;
          status?: string;
          search?: string;
          date?: string;
          groupBy?: string;
        },
    legacyLimit?: number,
  ) {
    let page = 1;
    let limit = 20;
    let source: string | undefined;
    let agentId: string | undefined;
    let ticketType: string | undefined;
    let status: string | undefined;
    let search: string | undefined;
    let groupBy: string | undefined;

    if (typeof pageOrOptions === 'object' && pageOrOptions !== null) {
      page = pageOrOptions.page || 1;
      limit = pageOrOptions.limit || 20;
      source = pageOrOptions.source;
      agentId = pageOrOptions.agentId;
      ticketType = pageOrOptions.ticketType;
      status = pageOrOptions.status;
      search = pageOrOptions.search;
      groupBy = pageOrOptions.groupBy;
    } else if (typeof pageOrOptions === 'number') {
      page = pageOrOptions;
      limit = legacyLimit || 20;
    }

    const skip = (Math.max(1, page) - 1) * limit;
    const where: any = {};

    if (source === 'FREE') {
      where.OR = [
        { registrationType: RegistrationType.FREE },
        { source: 'FREE' },
        { unitPricePaise: 0 },
      ];
    } else {
      where.registrationType = RegistrationType.COMMERCIAL;
      if (source && source !== 'ALL') {
        where.source = source;
      }
    }

    if (agentId && agentId.trim() !== '') {
      try {
        where.agentId = BigInt(agentId);
      } catch {
        // Ignore invalid bigint
      }
    }

    if (ticketType && ticketType !== 'ALL') {
      where.ticketType = ticketType;
    }

    if (status && status !== 'ALL') {
      where.orderStatus = status as any;
    }

    if (search && search.trim() !== '') {
      const q = search.trim();
      where.OR = [
        { orderNumber: { contains: q, mode: 'insensitive' } },
        { customerName: { contains: q, mode: 'insensitive' } },
        { customerMobile: { contains: q, mode: 'insensitive' } },
        { customerEmail: { contains: q, mode: 'insensitive' } },
        { agent: { name: { contains: q, mode: 'insensitive' } } },
        { agent: { staffId: { contains: q, mode: 'insensitive' } } },
        { attendees: { some: { ticketNumber: { contains: q, mode: 'insensitive' } } } },
      ];
    }

    const [
      total,
      orders,
      publicOrdersCount,
      agentOrdersCount,
      publicAgg,
      agentAgg,
      totalPaidAgg,
      totalPassesAgg,
      freePassesCount,
      freeCheckedInCount,
      freeOrdersCount,
    ] = await Promise.all([
      this.prisma.commercialOrder.count({ where }),
      this.prisma.commercialOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { attendees: true } },
          agent: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              staffId: true,
              role: true,
              parentAgentId: true,
              parentAgent: { select: { id: true, name: true } },
            },
          },
          attendees: {
            select: {
              id: true,
              ticketNumber: true,
              status: true,
              category: true,
              bookingDays: true,
            },
            take: 20,
          },
        },
      }),
      this.prisma.commercialOrder.count({
        where: { registrationType: RegistrationType.COMMERCIAL, source: CommercialOrderSource.PUBLIC },
      }),
      this.prisma.commercialOrder.count({
        where: { registrationType: RegistrationType.COMMERCIAL, source: CommercialOrderSource.AGENT },
      }),
      this.prisma.commercialOrder.aggregate({
        where: { registrationType: RegistrationType.COMMERCIAL, source: CommercialOrderSource.PUBLIC, orderStatus: OrderStatus.PAID },
        _sum: { amountPaise: true, quantity: true },
      }),
      this.prisma.commercialOrder.aggregate({
        where: { registrationType: RegistrationType.COMMERCIAL, source: CommercialOrderSource.AGENT, orderStatus: OrderStatus.PAID },
        _sum: { amountPaise: true, quantity: true },
      }),
      this.prisma.commercialOrder.aggregate({
        where: { registrationType: RegistrationType.COMMERCIAL, orderStatus: OrderStatus.PAID },
        _sum: { amountPaise: true },
      }),
      this.prisma.commercialOrder.aggregate({
        where: { registrationType: RegistrationType.COMMERCIAL, orderStatus: OrderStatus.PAID },
        _sum: { quantity: true },
      }),
      this.prisma.attendee?.count
        ? this.prisma.attendee.count({
            where: { registrationType: RegistrationType.FREE },
          })
        : Promise.resolve(0),
      this.prisma.attendee?.count
        ? this.prisma.attendee.count({
            where: { registrationType: RegistrationType.FREE, dailyCheckins: { some: {} } },
          })
        : Promise.resolve(0),
      this.prisma.commercialOrder.count({
        where: { OR: [{ registrationType: RegistrationType.FREE }, { source: 'FREE' }, { unitPricePaise: 0 }] },
      }),
    ]);

    let agentGroups: any[] = [];
    if (groupBy === 'agent' || source === 'AGENT') {
      const agents: any[] = await this.prisma.user.findMany({
        where: {
          role: { in: [UserRole.COMMERCIAL_AGENT, UserRole.COMMERCIAL_SUB_AGENT] },
        },
        include: {
          parentAgent: { select: { id: true, name: true } },
          allocations: true,
          agentOrders: {
            where: {
              registrationType: RegistrationType.COMMERCIAL,
              source: CommercialOrderSource.AGENT,
              ...(status && status !== 'ALL' ? { orderStatus: status as any } : {}),
              ...(ticketType && ticketType !== 'ALL' ? { ticketType } : {}),
            },
            include: {
              attendees: {
                select: { id: true, status: true, dailyCheckins: { select: { id: true } } },
              },
            },
          },
        },
        orderBy: [{ parentAgentId: 'asc' }, { name: 'asc' }],
      });

      agentGroups = agents
        .filter((ag: any) => {
          if (search && search.trim() !== '') {
            const q = search.trim().toLowerCase();
            const matchesAgent =
              ag.name.toLowerCase().includes(q) ||
              (ag.email && ag.email.toLowerCase().includes(q)) ||
              (ag.phone && ag.phone.toLowerCase().includes(q)) ||
              (ag.staffId && ag.staffId.toLowerCase().includes(q)) ||
              (ag.parentAgent && ag.parentAgent.name.toLowerCase().includes(q));
            const matchesOrderOrCustomer = (ag.agentOrders || []).some(
              (o: any) =>
                o.orderNumber.toLowerCase().includes(q) ||
                o.customerName.toLowerCase().includes(q) ||
                o.customerMobile.toLowerCase().includes(q) ||
                o.customerEmail.toLowerCase().includes(q),
            );
            return matchesAgent || matchesOrderOrCustomer;
          }
          return true;
        })
        .map((ag: any) => {
          const ordersList = ag.agentOrders || [];
          const ordersCount = ordersList.length;
          const passesSold = ordersList.reduce((sum: number, o: any) => sum + o.quantity, 0);
          const totalSalesInr = ordersList
            .filter((o: any) => o.orderStatus === OrderStatus.PAID)
            .reduce((sum: number, o: any) => sum + o.amountPaise / 100, 0);

          const allocList = ag.allocations || [];
          const totalAllocated = allocList.reduce((sum: number, a: any) => sum + a.allocatedQuantity, 0);
          const totalBooked = allocList.reduce((sum: number, a: any) => sum + a.bookedQuantity, 0);
          const totalSub = allocList.reduce((sum: number, a: any) => sum + a.subAllocatedQuantity, 0);
          const availableAllocation = Math.max(0, totalAllocated - totalBooked - totalSub);

          let checkedInPasses = 0;
          for (const ord of ordersList) {
            for (const att of (ord.attendees || [])) {
              if (att.dailyCheckins && att.dailyCheckins.length > 0) {
                checkedInPasses++;
              }
            }
          }

          return {
            agent: {
              id: ag.id.toString(),
              name: ag.name,
              email: ag.email,
              phone: ag.phone,
              staffId: ag.staffId,
              role: ag.role,
              isSubAgent: !!ag.parentAgentId,
              parentAgent: ag.parentAgent
                ? { id: ag.parentAgent.id.toString(), name: ag.parentAgent.name }
                : null,
            },
            ordersCount,
            passesSold,
            totalSalesInr,
            availableAllocation,
            checkedInPasses,
          };
        });
    }

    const totalSalesAllInr = (totalPaidAgg._sum.amountPaise || 0) / 100;
    const totalPassesAll = totalPassesAgg._sum.quantity || 0;
    const publicPassesCount = publicAgg._sum.quantity || 0;
    const publicSalesInr = (publicAgg._sum.amountPaise || 0) / 100;
    const agentPassesCount = agentAgg._sum.quantity || 0;
    const agentSalesInr = (agentAgg._sum.amountPaise || 0) / 100;

    let ordersResult = (orders || []).map((o: any) => {
      const isTestPayment = (o.metadata as any)?.isTestPayment === true;
      return {
        id: o.id.toString(),
        orderNumber: o.orderNumber,
        registrationType: o.registrationType,
        source: o.source,
        paymentMode: o.paymentMode,
        agentId: o.agentId ? o.agentId.toString() : null,
        agent: o.agent
          ? {
              id: o.agent.id.toString(),
              name: o.agent.name,
              email: o.agent.email,
              phone: o.agent.phone,
              staffId: o.agent.staffId,
              role: o.agent.role,
              isSubAgent: !!o.agent.parentAgentId,
              parentAgent: o.agent.parentAgent
                ? { id: o.agent.parentAgent.id.toString(), name: o.agent.parentAgent.name }
                : null,
            }
          : null,
        customerName: o.customerName,
        customerMobile: o.customerMobile,
        customerEmail: o.customerEmail,
        ticketType: o.ticketType,
        selectedDates: o.selectedDates as string[],
        quantity: o.quantity,
        amountInr: o.amountPaise / 100,
        currency: o.currency,
        orderStatus: o.orderStatus,
        paymentStatus: o.paymentStatus,
        isTestPayment,
        razorpayOrderId: o.razorpayOrderId,
        razorpayPaymentId: o.razorpayPaymentId,
        passesCount: o._count.attendees,
        attendees: (o.attendees || []).map((a: any) => ({
          id: a.id.toString(),
          ticketNumber: a.ticketNumber,
          status: a.status,
          category: a.category,
          bookingDays: a.bookingDays,
        })),
        createdAt: o.createdAt.toISOString(),
        paidAt: o.paidAt?.toISOString() || null,
      };
    });

    // Fallback for standalone free attendees when viewing FREE passes tab and no free orders exist
    if (source === 'FREE' && ordersResult.length === 0 && freePassesCount > 0) {
      const freeAttendees = await this.prisma.attendee.findMany({
        where: { registrationType: RegistrationType.FREE },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          dailyCheckins: { select: { id: true } },
        },
      });

      ordersResult = freeAttendees.map((fa: any) => ({
        id: fa.id.toString(),
        orderNumber: `FREE-${fa.ticketNumber}`,
        registrationType: RegistrationType.FREE,
        source: 'FREE',
        paymentMode: 'COMPLIMENTARY',
        agentId: null,
        agent: null,
        customerName: fa.name || 'Complimentary Guest',
        customerMobile: fa.mobile || '—',
        customerEmail: fa.email || '—',
        ticketType: fa.category || 'FREE_PASS',
        selectedDates: fa.bookingDays || [],
        quantity: 1,
        amountInr: 0,
        currency: 'INR',
        orderStatus: OrderStatus.PAID,
        paymentStatus: PaymentStatus.CAPTURED,
        isTestPayment: false,
        razorpayOrderId: null,
        razorpayPaymentId: null,
        passesCount: 1,
        attendees: [
          {
            id: fa.id.toString(),
            ticketNumber: fa.ticketNumber,
            status: fa.status,
            category: fa.category,
            bookingDays: fa.bookingDays,
          },
        ],
        createdAt: fa.createdAt ? fa.createdAt.toISOString() : new Date().toISOString(),
        paidAt: fa.createdAt ? fa.createdAt.toISOString() : new Date().toISOString(),
      }));
    }

    return {
      total: source === 'FREE' && total === 0 ? freePassesCount : total,
      page,
      limit,
      summary: {
        totalOrders: publicOrdersCount + agentOrdersCount + freeOrdersCount,
        totalSalesInr: totalSalesAllInr,
        totalPasses: totalPassesAll + freePassesCount,
        publicOrdersCount,
        publicPassesCount,
        publicSalesInr,
        agentOrdersCount,
        agentPassesCount,
        agentSalesInr,
        freeOrdersCount,
        freePassesCount,
        freeCheckedInCount,
        freeAvailableCount: Math.max(0, freePassesCount - freeCheckedInCount),
      },
      orders: ordersResult,
      agentGroups,
    };
  }

  /**
   * Secure commercial ticket recovery email dispatch.
   * Enforces:
   * 1. Commercial-only isolation (rejects non-commercial / employee orders).
   * 2. Strict mobile matching against registered customer mobile.
   * 3. Sends strictly to the registered customerEmail, never to an arbitrary user email.
   * 4. Multi-level rate limiting (Redis or in-memory fallback).
   */
  async resendTicketEmail(orderNumber: string, mobile: string, clientIp?: string) {
    const cleanOrderNumber = (orderNumber || '').trim().toUpperCase();
    const cleanMobile = (mobile || '').trim();

    if (!cleanOrderNumber) {
      throw new BadRequestException('Order reference number is required.');
    }
    if (!cleanMobile) {
      throw new BadRequestException('Customer mobile number is required.');
    }

    // 1. Rate limiting check (max 3 requests per 10 minutes per order)
    const rateKey = `ratelimit:email-recovery:${cleanOrderNumber}`;
    let isRateLimited = false;

    const redisCount = await this.redis.incrementCounter(rateKey, 600);
    if (redisCount !== null) {
      if (redisCount > 3) isRateLimited = true;
    } else {
      const now = Date.now();
      const existing = this.recoveryEmailRateLimit.get(rateKey);
      if (existing && existing.expiresAt > now) {
        existing.count++;
        if (existing.count > 3) isRateLimited = true;
      } else {
        this.recoveryEmailRateLimit.set(rateKey, { count: 1, expiresAt: now + 600000 });
      }
    }

    if (isRateLimited) {
      throw new HttpException(
        'Too many email requests for this order. Please try again after 10 minutes.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // 2. Fetch order with commercial attendee passes
    const order = await this.prisma.commercialOrder.findUnique({
      where: { orderNumber: cleanOrderNumber },
      include: {
        attendees: {
          where: { registrationType: RegistrationType.COMMERCIAL },
        },
      },
    });

    if (!order || order.registrationType !== RegistrationType.COMMERCIAL) {
      throw new NotFoundException(`Order ${cleanOrderNumber} not found.`);
    }

    // Ensure employee passes cannot be resolved through commercial recovery
    if (order.attendees.some((a: any) => a.registrationType !== RegistrationType.COMMERCIAL)) {
      throw new NotFoundException(`Order ${cleanOrderNumber} not found.`);
    }

    if (order.orderStatus !== OrderStatus.PAID) {
      throw new BadRequestException('Tickets can only be emailed for confirmed, paid orders.');
    }

    // 3. Verify mobile matches registered purchaser mobile
    const isVerified =
      cleanMobile === order.customerMobile ||
      order.customerMobile.endsWith(cleanMobile);

    if (!isVerified) {
      throw new BadRequestException('Verification failed: Mobile number does not match this order.');
    }

    if (!order.customerEmail) {
      throw new BadRequestException('No email address registered for this order.');
    }

    if (!order.attendees || order.attendees.length === 0) {
      throw new BadRequestException('No passes found for this order.');
    }

    // 4. Send email strictly to the verified order's customerEmail
    const mailResult = await this.mailService.sendCommercialTicketEmail({
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      ticketType: order.ticketType,
      selectedDates: (order.selectedDates as string[]) || [],
      quantity: order.quantity,
      amountInr: order.amountPaise ? order.amountPaise / 100 : 0,
      passes: order.attendees.map((p: any) => ({
        ticketNumber: p.ticketNumber,
        token: p.qrCodeToken,
        category: p.category,
        attendeeName: p.name,
      })),
    });

    const maskedEmail = this.maskCustomerEmail(order.customerEmail);

    if (!mailResult.success) {
      this.logger.error(
        `Recovery email delivery failed for order ${order.orderNumber}: ${mailResult.error || 'Unknown error'}`,
      );
      return {
        success: false,
        message:
          'Email service could not deliver your ticket at this moment. You can view or download your QR passes directly on this screen.',
      };
    }

    return {
      success: true,
      message: `Ticket pass details sent to ${maskedEmail}. Please check your inbox and spam folder.`,
    };
  }

  async formatPasses(attendees: any[]) {
    return Promise.all(
      attendees.map(async (a) => {
        let qrSvg: string | null = null;
        try {
          qrSvg = await QRCode.toString(a.qrCodeToken, {
            type: 'svg',
            errorCorrectionLevel: 'M',
            margin: 1,
          });
        } catch {
          qrSvg = null;
        }

        return {
          id: a.id.toString(),
          ticketNumber: a.ticketNumber,
          qrCodeToken: a.qrCodeToken,
          qrSvg,
          name: a.name,
          mobile: a.mobile,
          category: a.category,
          status: a.status,
          bookingDays: a.bookingDays,
        };
      }),
    );
  }

  /**
   * Delete a single commercial order with strict financial, payment, and ticket protections
   */
  async deleteOrderAdmin(orderId: bigint) {
    const order = await this.prisma.commercialOrder.findUnique({
      where: { id: orderId },
      include: {
        attendees: {
          include: {
            dailyCheckins: { select: { id: true } },
            scanLogs: { select: { id: true } },
          },
        },
        webhookEvents: { select: { id: true } },
        allocationEvents: { select: { id: true } },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found.`);
    }

    const protectionReason = this.getOrderProtectionReason(order);
    if (protectionReason) {
      throw new ConflictException(
        `Order ${order.orderNumber} cannot be deleted because ${protectionReason}.`,
      );
    }

    // Safely delete attendees without scans/checkins, then order in a transaction
    await this.prisma.$transaction(async (tx) => {
      await tx.attendee.deleteMany({
        where: { orderId: order.id },
      });
      await tx.commercialOrder.delete({
        where: { id: order.id },
      });
    });

    return {
      success: true,
      message: `Order ${order.orderNumber} deleted successfully.`,
      orderNumber: order.orderNumber,
    };
  }

  /**
   * Bulk delete commercial orders with strict dependency and financial audit protections
   */
  async bulkDeleteOrdersAdmin(rawOrderIds: string[]) {
    if (!Array.isArray(rawOrderIds) || rawOrderIds.length === 0) {
      throw new BadRequestException('Please select at least one order to delete.');
    }

    const orderIds = rawOrderIds
      .map((id) => {
        try {
          return BigInt(id);
        } catch {
          return null;
        }
      })
      .filter((id): id is bigint => id !== null);

    if (orderIds.length === 0) {
      throw new BadRequestException('No valid order IDs provided.');
    }

    const orders = await this.prisma.commercialOrder.findMany({
      where: { id: { in: orderIds } },
      include: {
        attendees: {
          include: {
            dailyCheckins: { select: { id: true } },
            scanLogs: { select: { id: true } },
          },
        },
        webhookEvents: { select: { id: true } },
        allocationEvents: { select: { id: true } },
      },
    });

    const protectedOrders: { id: string; orderNumber: string; reason: string }[] = [];
    const deletableOrders: typeof orders = [];

    for (const ord of orders) {
      const reason = this.getOrderProtectionReason(ord);
      if (reason) {
        protectedOrders.push({
          id: ord.id.toString(),
          orderNumber: ord.orderNumber,
          reason,
        });
      } else {
        deletableOrders.push(ord);
      }
    }

    if (deletableOrders.length > 0) {
      const deletableIds = deletableOrders.map((o) => o.id);
      await this.prisma.$transaction(async (tx) => {
        await tx.attendee.deleteMany({
          where: { orderId: { in: deletableIds } },
        });
        await tx.commercialOrder.deleteMany({
          where: { id: { in: deletableIds } },
        });
      });
    }

    const deletedCount = deletableOrders.length;
    const protectedCount = protectedOrders.length;

    let message = '';
    if (deletedCount > 0 && protectedCount === 0) {
      message = `Successfully deleted ${deletedCount} order(s).`;
    } else if (deletedCount > 0 && protectedCount > 0) {
      message = `Deleted ${deletedCount} order(s). ${protectedCount} order(s) could not be deleted because they contain financial or ticket records.`;
    } else {
      message = `None of the selected orders could be deleted. All ${protectedCount} order(s) contain financial, payment, or ticket records.`;
    }

    return {
      totalSelected: rawOrderIds.length,
      deletedCount,
      protectedCount,
      deletedOrders: deletableOrders.map((o) => ({ id: o.id.toString(), orderNumber: o.orderNumber })),
      protectedOrders,
      message,
    };
  }

  /**
   * Helper to check why an order is protected from deletion
   */
  private getOrderProtectionReason(order: any): string | null {
    if (order.orderStatus === OrderStatus.PAID) {
      return 'it is a confirmed paid transaction';
    }
    if (order.paymentStatus === PaymentStatus.CAPTURED) {
      return 'payment has been captured by gateway';
    }
    if (order.razorpayPaymentId) {
      return 'financial payment reference exists';
    }
    if (order.webhookEvents && order.webhookEvents.length > 0) {
      return 'payment webhook audit records exist';
    }
    if (order.allocationEvents && order.allocationEvents.length > 0) {
      return 'linked agent allocation history exists';
    }
    const hasCheckinsOrScans = (order.attendees || []).some(
      (a: any) =>
        (a.dailyCheckins && a.dailyCheckins.length > 0) ||
        (a.scanLogs && a.scanLogs.length > 0),
    );
    if (hasCheckinsOrScans) {
      return 'it contains checked-in passes or scan audit logs';
    }
    return null;
  }
}

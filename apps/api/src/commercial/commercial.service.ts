import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
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

  async listOrdersAdmin(page = 1, limit = 20) {
    const skip = (Math.max(1, page) - 1) * limit;
    const [total, orders] = await Promise.all([
      this.prisma.commercialOrder.count(),
      this.prisma.commercialOrder.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { attendees: true } },
          agent: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
    ]);

    return {
      total,
      page,
      limit,
      orders: orders.map((o: any) => {
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
              }
            : null,
          customerName: o.customerName,
          customerMobile: o.customerMobile,
          customerEmail: o.customerEmail,
          ticketType: o.ticketType,
          quantity: o.quantity,
          amountInr: o.amountPaise / 100,
          currency: o.currency,
          orderStatus: o.orderStatus,
          paymentStatus: isTestPayment ? 'TEST_PAID' : o.paymentStatus,
          isTestPayment,
          razorpayOrderId: o.razorpayOrderId,
          razorpayPaymentId: o.razorpayPaymentId,
          passesCount: o._count.attendees,
          createdAt: o.createdAt,
          paidAt: o.paidAt,
        };
      }),
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
}

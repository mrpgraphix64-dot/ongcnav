import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
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
import {
  AttendeeStatus,
  OrderStatus,
  PaymentStatus,
  RegistrationType,
} from '@ongc/shared-types';
import * as crypto from 'crypto';
import * as QRCode from 'qrcode';

@Injectable()
export class CommercialService {
  private readonly logger = new Logger(CommercialService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly razorpay: RazorpayService,
  ) {}

  private generateSecureQrToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private generateTicketNumber(orderNumber: string, index: number): string {
    const cleanRef = orderNumber.replace(/[^A-Z0-9]/gi, '').slice(-6).toUpperCase();
    const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
    return `TK-COMM-${cleanRef}-${index + 1}-${rand}`;
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

    try {
      // 3. Server-side authoritative price calculation — NEVER trust client-submitted amount
      const ticketTypeCode = dto.ticketType || 'COMMERCIAL_DAILY';
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

      // 5. Create Razorpay order
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

    return {
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
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
        },
      }),
    ]);

    return {
      total,
      page,
      limit,
      orders: orders.map((o) => ({
        id: o.id.toString(),
        orderNumber: o.orderNumber,
        registrationType: o.registrationType,
        customerName: o.customerName,
        customerMobile: o.customerMobile,
        customerEmail: o.customerEmail,
        ticketType: o.ticketType,
        quantity: o.quantity,
        amountInr: o.amountPaise / 100,
        currency: o.currency,
        orderStatus: o.orderStatus,
        paymentStatus: o.paymentStatus,
        razorpayOrderId: o.razorpayOrderId,
        razorpayPaymentId: o.razorpayPaymentId,
        passesCount: o._count.attendees,
        createdAt: o.createdAt,
        paidAt: o.paidAt,
      })),
    };
  }

  private async formatPasses(attendees: any[]) {
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

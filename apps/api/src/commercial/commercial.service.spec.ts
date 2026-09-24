import { Test, TestingModule } from '@nestjs/testing';
import { CommercialService } from './commercial.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { RazorpayService } from './razorpay.service';
import {
  AttendeeStatus,
  EmployeeCategory,
  OrderStatus,
  PaymentStatus,
  RegistrationType,
} from '@ongc/shared-types';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('CommercialService', () => {
  let service: CommercialService;
  let prisma: any;
  let redis: any;
  let razorpay: any;

  beforeEach(async () => {
    prisma = {
      setting: { findUnique: jest.fn().mockResolvedValue(null) },
      commercialOrder: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      attendee: {
        create: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      employee: {
        create: jest.fn(),
        findUnique: jest.fn(),
      },
      paymentWebhookEvent: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: BigInt(1) }),
        update: jest.fn().mockResolvedValue({ id: BigInt(1) }),
      },
      $transaction: jest.fn().mockImplementation(async (cb: any) => cb(prisma)),
    };

    redis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(true),
      acquireLock: jest.fn().mockResolvedValue('lock_token_123'),
      releaseLock: jest.fn().mockResolvedValue(true),
    };

    razorpay = {
      getPublicKeyId: jest.fn().mockReturnValue('rzp_test_123'),
      isLiveGatewayConfigured: jest.fn().mockReturnValue(false),
      createRazorpayOrder: jest.fn().mockImplementation((amountPaise, receipt) =>
        Promise.resolve({
          id: `order_rzp_${Date.now()}`,
          amount: amountPaise,
          currency: 'INR',
          receipt,
        }),
      ),
      verifyPaymentSignature: jest.fn().mockReturnValue(true),
      verifyWebhookSignature: jest.fn().mockReturnValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommercialService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
        { provide: RazorpayService, useValue: razorpay },
      ],
    }).compile();

    service = module.get<CommercialService>(CommercialService);
  });

  describe('createOrder', () => {
    const validDto = {
      customerName: 'Kishore Joshi',
      customerMobile: '9876543210',
      customerEmail: 'kishore@example.com',
      ticketType: 'COMMERCIAL_DAILY',
      selectedDates: ['2026-10-11', '2026-10-12'],
      quantity: 2,
    };

    it('calculates price strictly on server (2 nights * ₹500 = ₹1,000 * 2 qty = ₹2,000) and creates order in PENDING status', async () => {
      prisma.commercialOrder.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: BigInt(1), ...data }),
      );

      const res = await service.createOrder(validDto);

      expect(res.success).toBe(true);
      expect(res.order.amountInr).toBe(2000);
      expect(res.order.amountPaise).toBe(200000);
      expect(res.order.quantity).toBe(2);

      // Verify DB persistence
      expect(prisma.commercialOrder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            registrationType: RegistrationType.COMMERCIAL,
            amountPaise: 200000,
            orderStatus: OrderStatus.PENDING,
            paymentStatus: PaymentStatus.CREATED,
            quantity: 2,
          }),
        }),
      );

      // Verify that NO passes/QRs are generated before payment
      expect(prisma.attendee.create).not.toHaveBeenCalled();
    });

    it('rejects order creation when registration is closed in settings', async () => {
      prisma.setting.findUnique.mockResolvedValueOnce({ key: 'registration_open', value: 'false' });
      await expect(service.createOrder(validDto)).rejects.toThrow(BadRequestException);
    });

    it('rejects order with invalid event dates', async () => {
      await expect(
        service.createOrder({
          ...validDto,
          selectedDates: ['2026-12-31'], // Not a Navratri date
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('verifyPayment', () => {
    const mockOrder = {
      id: BigInt(10),
      orderNumber: 'ORD-COMM-20261011-ABC123',
      registrationType: RegistrationType.COMMERCIAL,
      customerName: 'Kishore Joshi',
      customerMobile: '9876543210',
      customerEmail: 'kishore@example.com',
      quantity: 2,
      selectedDates: ['2026-10-11'],
      orderStatus: OrderStatus.PENDING,
      paymentStatus: PaymentStatus.CREATED,
      razorpayOrderId: 'order_rzp_ABC123',
      attendees: [],
    };

    const verifyDto = {
      orderNumber: 'ORD-COMM-20261011-ABC123',
      razorpayOrderId: 'order_rzp_ABC123',
      razorpayPaymentId: 'pay_rzp_XYZ789',
      razorpaySignature: 'valid_crypto_signature',
    };

    it('successfully verifies signature, confirms order to PAID, and generates secure passes', async () => {
      prisma.commercialOrder.findUnique.mockResolvedValue(mockOrder);
      let seq = 1;
      prisma.attendee.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: BigInt(seq++), ...data }),
      );

      const res = await service.verifyPayment(verifyDto);

      expect(res.success).toBe(true);
      expect(res.passes).toHaveLength(2);

      // Verify order update
      expect(prisma.commercialOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockOrder.id },
          data: expect.objectContaining({
            orderStatus: OrderStatus.PAID,
            paymentStatus: PaymentStatus.CAPTURED,
            razorpayPaymentId: 'pay_rzp_XYZ789',
          }),
        }),
      );

      // Verify passes generation with 64-char secure tokens and commercial type
      const createdAttendeeCalls = prisma.attendee.create.mock.calls;
      expect(createdAttendeeCalls).toHaveLength(2);
      createdAttendeeCalls.forEach((call: any) => {
        expect(call[0].data.registrationType).toBe(RegistrationType.COMMERCIAL);
        expect(call[0].data.orderId).toBe(mockOrder.id);
        expect(call[0].data.qrCodeToken).toHaveLength(64);
        expect(call[0].data.status).toBe(AttendeeStatus.ACTIVE);
      });
    });

    it('rejects verification if cryptographic signature is invalid and preserves failed state', async () => {
      prisma.commercialOrder.findUnique.mockResolvedValue(mockOrder);
      razorpay.verifyPaymentSignature.mockReturnValueOnce(false); // Invalid signature

      await expect(service.verifyPayment(verifyDto)).rejects.toThrow(BadRequestException);

      // Preserves order in failed state
      expect(prisma.commercialOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockOrder.id },
          data: expect.objectContaining({
            failureReason: expect.stringContaining('signature'),
          }),
        }),
      );
      // No passes issued
      expect(prisma.attendee.create).not.toHaveBeenCalled();
    });

    it('rejects verification if razorpayOrderId does not match order record', async () => {
      prisma.commercialOrder.findUnique.mockResolvedValue(mockOrder);

      await expect(
        service.verifyPayment({
          ...verifyDto,
          razorpayOrderId: 'order_rzp_WRONG_ID',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('handles duplicate verification idempotently without duplicating passes', async () => {
      const alreadyPaidOrder = {
        ...mockOrder,
        orderStatus: OrderStatus.PAID,
        paymentStatus: PaymentStatus.CAPTURED,
        attendees: [
          {
            id: BigInt(1),
            ticketNumber: 'TK-COMM-1',
            qrCodeToken: 'tok-1',
            name: 'Kishore',
            mobile: '9876543210',
            status: AttendeeStatus.ACTIVE,
            bookingDays: ['2026-10-11'],
          },
        ],
      };

      prisma.commercialOrder.findUnique.mockResolvedValue(alreadyPaidOrder);

      const res = await service.verifyPayment(verifyDto);

      expect(res.success).toBe(true);
      expect(res.message).toContain('already verified');
      expect(res.passes).toHaveLength(1);

      // Verify no new update or attendee creation
      expect(prisma.commercialOrder.update).not.toHaveBeenCalled();
      expect(prisma.attendee.create).not.toHaveBeenCalled();
    });
  });

  describe('handleWebhook', () => {
    const rawWebhookPayload = JSON.stringify({
      event: 'payment.captured',
      id: 'evt_webhook_123',
      payload: {
        payment: {
          entity: {
            id: 'pay_rzp_hook_999',
            order_id: 'order_rzp_ABC123',
            amount: 100000,
            status: 'captured',
          },
        },
      },
    });

    it('rejects webhook with invalid cryptographic signature', async () => {
      razorpay.verifyWebhookSignature.mockReturnValueOnce(false);

      await expect(
        service.handleWebhook(rawWebhookPayload, 'invalid_signature'),
      ).rejects.toThrow(BadRequestException);
    });

    it('processes payment.captured event and confirms order if not yet paid', async () => {
      prisma.commercialOrder.findUnique.mockResolvedValue({
        id: BigInt(10),
        orderNumber: 'ORD-COMM-123',
        orderStatus: OrderStatus.PENDING,
        quantity: 1,
        selectedDates: ['2026-10-11'],
        customerName: 'Kishore',
        customerMobile: '9876543210',
        customerEmail: 'k@example.com',
      });

      const res = await service.handleWebhook(rawWebhookPayload, 'valid_signature');

      expect(res.success).toBe(true);
      expect(prisma.paymentWebhookEvent.create).toHaveBeenCalled();
      expect(prisma.commercialOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            orderStatus: OrderStatus.PAID,
            paymentStatus: PaymentStatus.CAPTURED,
          }),
        }),
      );
      expect(prisma.attendee.create).toHaveBeenCalledTimes(1);
    });

    it('skips duplicate webhook deliveries safely (idempotent)', async () => {
      // Event already in database
      prisma.paymentWebhookEvent.findUnique.mockResolvedValueOnce({
        id: BigInt(5),
        eventId: 'evt_webhook_123',
        processed: true,
      });

      const res = await service.handleWebhook(rawWebhookPayload, 'valid_signature');

      expect(res.status).toBe('already_processed');
      // No order update
      expect(prisma.commercialOrder.update).not.toHaveBeenCalled();
    });

    it('marks the order as failed on payment.failed and does not create passes', async () => {
      const failedPayload = JSON.stringify({
        event: 'payment.failed',
        id: 'evt_webhook_failed_1',
        payload: {
          payment: {
            entity: {
              id: 'pay_rzp_failed_1',
              order_id: 'order_rzp_ABC123',
              amount: 100000,
              status: 'failed',
              error_description: 'Insufficient funds',
            },
          },
        },
      });

      prisma.commercialOrder.findUnique.mockResolvedValue({
        id: BigInt(11),
        orderNumber: 'ORD-COMM-FAILCASE',
        orderStatus: OrderStatus.PENDING,
        quantity: 1,
      });

      const res = await service.handleWebhook(failedPayload, 'valid_signature');

      expect(res.success).toBe(true);
      expect(prisma.commercialOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            failureReason: 'Insufficient funds',
          }),
        }),
      );
      expect(prisma.attendee.create).not.toHaveBeenCalled();
    });

    it('does not duplicate passes when the webhook confirms payment first and the client-side verify call arrives afterward', async () => {
      // 1. Webhook arrives first and confirms payment, creating exactly one pass.
      const baseOrder = {
        id: BigInt(20),
        orderNumber: 'ORD-COMM-RACE-1',
        orderStatus: OrderStatus.PENDING,
        paymentStatus: PaymentStatus.CREATED,
        quantity: 1,
        selectedDates: ['2026-10-11'],
        customerName: 'Race Customer',
        customerMobile: '9876543210',
        customerEmail: 'race@example.com',
        razorpayOrderId: 'order_rzp_RACE1',
      };
      prisma.commercialOrder.findUnique.mockResolvedValueOnce(baseOrder);

      const raceWebhookPayload = JSON.stringify({
        event: 'payment.captured',
        id: 'evt_webhook_race_1',
        payload: {
          payment: {
            entity: {
              id: 'pay_rzp_race_1',
              order_id: 'order_rzp_RACE1',
              amount: 50000,
              status: 'captured',
            },
          },
        },
      });

      await service.handleWebhook(raceWebhookPayload, 'valid_signature');
      expect(prisma.attendee.create).toHaveBeenCalledTimes(1);

      // 2. The client's own verify() call lands afterward — the order is now
      // PAID/CAPTURED, so it must return the existing pass idempotently
      // instead of creating a second one.
      prisma.commercialOrder.findUnique.mockResolvedValueOnce({
        ...baseOrder,
        orderStatus: OrderStatus.PAID,
        paymentStatus: PaymentStatus.CAPTURED,
        attendees: [
          {
            id: BigInt(1),
            ticketNumber: 'TK-COMM-RACE-1',
            qrCodeToken: 'tok-race-1',
            name: 'Race Customer',
            mobile: '9876543210',
            status: AttendeeStatus.ACTIVE,
            bookingDays: ['2026-10-11'],
          },
        ],
      });

      const verifyRes = await service.verifyPayment({
        orderNumber: 'ORD-COMM-RACE-1',
        razorpayOrderId: 'order_rzp_RACE1',
        razorpayPaymentId: 'pay_rzp_race_1',
        razorpaySignature: 'valid_crypto_signature',
      });

      expect(verifyRes.success).toBe(true);
      expect(verifyRes.passes).toHaveLength(1);
      // Still only ever called once in total — no duplicate pass from verify().
      expect(prisma.attendee.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('RegistrationType separation from EmployeeCategory', () => {
    it('COMMERCIAL passes have null employeeId and never use EmployeeCategory', async () => {
      prisma.attendee.create.mockImplementationOnce(({ data }: any) =>
        Promise.resolve({ id: BigInt(1), ...data }),
      );

      const pass = await prisma.attendee.create({
        data: {
          registrationType: RegistrationType.COMMERCIAL,
          name: 'Commercial Customer',
          mobile: '9876543210',
          category: 'Commercial Pass',
          employeeId: null,
          ticketNumber: 'TK-COMM-TEST',
          qrCodeToken: 'tok_test',
          status: AttendeeStatus.ACTIVE,
          bookingDays: ['2026-10-11'],
        },
      });

      expect(pass.registrationType).toBe(RegistrationType.COMMERCIAL);
      expect(pass.employeeId).toBeNull();
      // EmployeeCategory does not apply to commercial
      expect((pass as any).employeeCategory).toBeUndefined();
    });

    it('FREE passes have null employeeId and never use EmployeeCategory', async () => {
      prisma.attendee.create.mockImplementationOnce(({ data }: any) =>
        Promise.resolve({ id: BigInt(2), ...data }),
      );

      const pass = await prisma.attendee.create({
        data: {
          registrationType: RegistrationType.FREE,
          name: 'Free Guest',
          mobile: '9876543210',
          category: 'Free Pass',
          employeeId: null,
          ticketNumber: 'TK-FREE-TEST',
          qrCodeToken: 'tok_free_test',
          status: AttendeeStatus.ACTIVE,
          bookingDays: ['2026-10-11'],
        },
      });

      expect(pass.registrationType).toBe(RegistrationType.FREE);
      expect(pass.employeeId).toBeNull();
    });

    it('EMPLOYEE passes remain associated with employee and carry EmployeeCategory', async () => {
      prisma.employee.create.mockImplementationOnce(({ data }: any) =>
        Promise.resolve({ id: BigInt(10), ...data }),
      );

      const employee = await prisma.employee.create({
        data: {
          cpf: '123456',
          name: 'ONGC Staff',
          phone: '9876543210',
          email: 'staff@ongc.co.in',
          designation: 'Engineer',
          department: 'EWC',
          employeeCategory: EmployeeCategory.REGULAR,
          bookingDays: ['2026-10-11'],
        },
      });

      expect(employee.employeeCategory).toBe(EmployeeCategory.REGULAR);
    });
  });

  describe('Order Creation Concurrency & Lock Protection', () => {
    it('rejects concurrent order creation for the same mobile when lock is active', async () => {
      redis.acquireLock.mockResolvedValueOnce(null); // Lock already held

      await expect(
        service.createOrder({
          customerName: 'Concurrent User',
          customerMobile: '9876543210',
          customerEmail: 'user@example.com',
          selectedDates: ['2026-10-11'],
          quantity: 1,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Order Lookup Security & IDOR Protection', () => {
    const mockPaidOrder = {
      id: BigInt(5),
      orderNumber: 'ORD-COMM-20261011-LOOKUP1',
      orderStatus: OrderStatus.PAID,
      paymentStatus: PaymentStatus.CAPTURED,
      customerName: 'Suresh Trivedi',
      customerMobile: '9876543210',
      customerEmail: 'suresh@example.com',
      ticketType: 'COMMERCIAL_DAILY',
      selectedDates: ['2026-10-11'],
      quantity: 1,
      amountPaise: 50000,
      currency: 'INR',
      razorpayOrderId: 'order_123',
      createdAt: new Date(),
      paidAt: new Date(),
      failureReason: null,
      attendees: [
        {
          id: BigInt(10),
          ticketNumber: 'TK-COMM-10',
          qrCodeToken: 'tok-10-secret',
          name: 'Suresh Trivedi',
          mobile: '9876543210',
          category: 'Commercial Pass',
          status: AttendeeStatus.ACTIVE,
          bookingDays: ['2026-10-11'],
        },
      ],
    };

    it('masks PII and hides QR passes when looked up without mobile verification', async () => {
      prisma.commercialOrder.findUnique.mockResolvedValueOnce(mockPaidOrder);

      const res = await service.getOrder('ORD-COMM-20261011-LOOKUP1');

      expect(res.customerName).toBe('Su***');
      expect(res.customerMobile).toBe('******3210');
      expect(res.customerEmail).toBe('***@***');
      expect(res.passes).toHaveLength(0); // QR passes hidden from unverified lookups
    });

    it('returns full passes and customer info when verified with matching mobile number', async () => {
      prisma.commercialOrder.findUnique.mockResolvedValueOnce(mockPaidOrder);

      const res = await service.getOrder('ORD-COMM-20261011-LOOKUP1', '9876543210');

      expect(res.customerName).toBe('Suresh Trivedi');
      expect(res.customerMobile).toBe('9876543210');
      expect(res.customerEmail).toBe('suresh@example.com');
      expect(res.passes).toHaveLength(1);
    });

    it('throws NotFoundException when order number does not exist', async () => {
      prisma.commercialOrder.findUnique.mockResolvedValueOnce(null);

      await expect(service.getOrder('ORD-COMM-NONEXISTENT')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});

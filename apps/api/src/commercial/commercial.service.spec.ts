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
import { BadRequestException, NotFoundException, HttpException, HttpStatus } from '@nestjs/common';
import { MailService } from '../mail/mail.service';
import { COMMERCIAL_EVENT_DATES } from './commercial.constants';

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
        findMany: jest.fn().mockResolvedValue([]),
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
      incrementCounter: jest.fn().mockResolvedValue(1),
    };

    const mailService = {
      sendEmail: jest.fn().mockResolvedValue({ success: true }),
      sendCommercialTicketEmail: jest.fn().mockResolvedValue({ success: true }),
      isLiveMailConfigured: jest.fn().mockReturnValue(true),
      getMailboxAddress: jest.fn().mockReturnValue('ticket@ongcnavratri.tech'),
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
        { provide: MailService, useValue: mailService },
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
      selectedDates: ['2026-10-11'],
      quantity: 2,
      termsAccepted: true,
    };

    it('calculates price strictly on server (1 night * ₹249 = ₹249 * 2 qty = ₹498 / 49,800 paise) and creates order in PENDING status', async () => {
      prisma.commercialOrder.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: BigInt(1), ...data }),
      );

      const res = await service.createOrder(validDto);

      expect(res.success).toBe(true);
      expect(res.order.amountInr).toBe(498);
      expect(res.order.amountPaise).toBe(49800);
      expect(res.order.quantity).toBe(2);

      // Verify DB persistence with server-computed paise
      expect(prisma.commercialOrder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            registrationType: RegistrationType.COMMERCIAL,
            unitPricePaise: 24900,
            amountPaise: 49800,
            orderStatus: OrderStatus.PENDING,
            paymentStatus: PaymentStatus.CREATED,
            quantity: 2,
          }),
        }),
      );

      // Verify that NO passes/QRs are generated before payment
      expect(prisma.attendee.create).not.toHaveBeenCalled();
    });

    it('calculates Season pass at ₹1,750 (175,000 paise) strictly on server', async () => {
      prisma.commercialOrder.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: BigInt(2), ...data }),
      );

      const res = await service.createOrder({
        ...validDto,
        ticketType: 'COMMERCIAL_SEASON',
        quantity: 1,
      });

      expect(res.success).toBe(true);
      expect(res.order.amountInr).toBe(1750);
      expect(res.order.amountPaise).toBe(175000);
      expect(res.order.quantity).toBe(1);
    });

    it('ignores any client-supplied amount or price tampering and enforces server calculation', async () => {
      prisma.commercialOrder.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: BigInt(3), ...data }),
      );

      // Malicious client attempts to inject custom pricing
      const maliciousDto: any = {
        ...validDto,
        amount: 1,
        amountPaise: 100,
        unitPricePaise: 50,
        discount: 9999,
        quantity: 1,
        selectedDates: ['2026-10-11'],
      };

      const res = await service.createOrder(maliciousDto);

      // Must strictly be 1 night * ₹249 = ₹249 (24,900 paise)
      expect(res.order.amountInr).toBe(249);
      expect(res.order.amountPaise).toBe(24900);
      expect(prisma.commercialOrder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amountPaise: 24900,
            unitPricePaise: 24900,
          }),
        }),
      );
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

    describe('Commercial Booking Date Authority & Single-Date Rules', () => {
      it('1. Daily Pass accepts exactly one selected booking date', async () => {
        prisma.commercialOrder.create.mockImplementationOnce(({ data }: any) =>
          Promise.resolve({ id: BigInt(11), ...data }),
        );
        const res = await service.createOrder({
          ...validDto,
          ticketType: 'COMMERCIAL_DAILY',
          selectedDates: ['2026-10-12'],
          quantity: 1,
        });
        expect(res.success).toBe(true);
        expect(res.order.selectedDates).toEqual(['2026-10-12']);
        expect(res.order.amountInr).toBe(249);
      });

      it('2. Mandli Pass accepts exactly one selected booking date', async () => {
        prisma.commercialOrder.create.mockImplementationOnce(({ data }: any) =>
          Promise.resolve({ id: BigInt(12), ...data }),
        );
        const res = await service.createOrder({
          ...validDto,
          ticketType: 'COMMERCIAL_MANDLI',
          selectedDates: ['2026-10-13'],
          quantity: 2,
        });
        expect(res.success).toBe(true);
        expect(res.order.selectedDates).toEqual(['2026-10-13']);
        expect(res.order.amountInr).toBe(298); // 149 * 2
      });

      it('3. Any Day Pass accepts exactly one selected booking date', async () => {
        prisma.commercialOrder.create.mockImplementationOnce(({ data }: any) =>
          Promise.resolve({ id: BigInt(13), ...data }),
        );
        const res = await service.createOrder({
          ...validDto,
          ticketType: 'COMMERCIAL_ANY_DAY',
          selectedDates: ['2026-10-16'],
          quantity: 1,
        });
        expect(res.success).toBe(true);
        expect(res.order.selectedDates).toEqual(['2026-10-16']);
        expect(res.order.amountInr).toBe(279);
      });

      it('4. Season Pass automatically and authoritatively covers all configured event dates regardless of client submission', async () => {
        prisma.commercialOrder.create.mockImplementationOnce(({ data }: any) =>
          Promise.resolve({ id: BigInt(14), ...data }),
        );
        // Frontend attempts to submit an arbitrary single date for Season Pass
        const res = await service.createOrder({
          ...validDto,
          ticketType: 'COMMERCIAL_SEASON',
          selectedDates: ['2026-10-19'],
          quantity: 1,
        });
        expect(res.success).toBe(true);
        // Backend authoritatively set all 9 dates
        expect(res.order.selectedDates).toHaveLength(9);
        expect(res.order.selectedDates).toEqual(COMMERCIAL_EVENT_DATES);
        expect(res.order.amountInr).toBe(1750);
      });

      it('5. A commercial order cannot contain multiple different booking dates', async () => {
        // Daily pass with multiple dates
        await expect(
          service.createOrder({
            ...validDto,
            ticketType: 'COMMERCIAL_DAILY',
            selectedDates: ['2026-10-11', '2026-10-12'],
          }),
        ).rejects.toThrow(
          'A commercial order cannot contain multiple different booking dates. Please select exactly one booking date per order.',
        );

        // Mandli pass with multiple dates
        await expect(
          service.createOrder({
            ...validDto,
            ticketType: 'COMMERCIAL_MANDLI',
            selectedDates: ['2026-10-11', '2026-10-13'],
          }),
        ).rejects.toThrow(
          'A commercial order cannot contain multiple different booking dates. Please select exactly one booking date per order.',
        );

        // Any Day pass with multiple dates
        await expect(
          service.createOrder({
            ...validDto,
            ticketType: 'COMMERCIAL_ANY_DAY',
            selectedDates: ['2026-10-14', '2026-10-15'],
          }),
        ).rejects.toThrow(
          'A commercial order cannot contain multiple different booking dates. Please select exactly one booking date per order.',
        );
      });

      it('6. The backend remains the final authority regardless of what the frontend submits', async () => {
        prisma.commercialOrder.create.mockImplementationOnce(({ data }: any) =>
          Promise.resolve({ id: BigInt(15), ...data }),
        );
        // Client tries to submit invalid dates mixed with one valid date
        const res = await service.createOrder({
          ...validDto,
          ticketType: 'COMMERCIAL_DAILY',
          selectedDates: ['2026-10-15', '2026-12-25', 'fake-date'],
          quantity: 1,
        });
        expect(res.success).toBe(true);
        expect(res.order.selectedDates).toEqual(['2026-10-15']);
        expect(res.order.amountInr).toBe(249);
      });
    });

    it('rejects order without terms acceptance (termsAccepted: false)', async () => {
      await expect(
        service.createOrder({
          ...validDto,
          termsAccepted: false,
        }),
      ).rejects.toThrow('Please accept the ticket terms & conditions to continue.');
    });

    it('rejects order when termsAccepted is missing (undefined)', async () => {
      const dtoWithoutTerms: any = { ...validDto };
      delete dtoWithoutTerms.termsAccepted;
      await expect(service.createOrder(dtoWithoutTerms)).rejects.toThrow(
        'Please accept the ticket terms & conditions to continue.',
      );
    });

    it('accepts order with terms acceptance (termsAccepted: true) and stores it in metadata', async () => {
      let createdData: any = null;
      prisma.commercialOrder.create.mockImplementationOnce(({ data }: any) => {
        createdData = data;
        return Promise.resolve({ id: BigInt(99), ...data });
      });

      const res = await service.createOrder(validDto);
      expect(res.success).toBe(true);
      expect(createdData).toBeDefined();
      expect(createdData.metadata.termsAccepted).toBe(true);
      expect(createdData.metadata.termsAcceptedAt).toBeDefined();
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
          termsAccepted: true,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Order Lookup Security & IDOR Protection', () => {
    const mockPaidOrder = {
      id: BigInt(5),
      orderNumber: 'ORD-COMM-20261011-LOOKUP1',
      registrationType: RegistrationType.COMMERCIAL,
      orderStatus: OrderStatus.PAID,
      paymentStatus: PaymentStatus.CAPTURED,
      customerName: 'Suresh Trivedi',
      customerMobile: '9876543210',
      customerEmail: 'suresh@example.com',
      ticketType: 'COMMERCIAL_DAILY',
      selectedDates: ['2026-10-11'],
      quantity: 1,
      amountPaise: 24900,
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

    it('throws NotFoundException when order is not of RegistrationType.COMMERCIAL', async () => {
      prisma.commercialOrder.findUnique.mockResolvedValueOnce({
        ...mockPaidOrder,
        registrationType: RegistrationType.EMPLOYEE,
      });

      await expect(service.getOrder('ORD-COMM-20261011-LOOKUP1', '9876543210')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('enforces RegistrationType.COMMERCIAL filter on attendees relation to prevent retrieving employee attendees', async () => {
      prisma.commercialOrder.findUnique.mockResolvedValueOnce(mockPaidOrder);

      await service.getOrder('ORD-COMM-20261011-LOOKUP1', '9876543210');

      expect(prisma.commercialOrder.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            attendees: expect.objectContaining({
              where: { registrationType: RegistrationType.COMMERCIAL },
            }),
          }),
        }),
      );
    });
  });

  describe('resendTicketEmail (Ticket Recovery & Isolation)', () => {
    const mockCommercialPaidOrder = {
      id: BigInt(10),
      orderNumber: 'ORD-COMM-RECOVER-1',
      registrationType: RegistrationType.COMMERCIAL,
      customerName: 'Priya Sharma',
      customerMobile: '9876543210',
      customerEmail: 'priya@example.com',
      ticketType: 'COMMERCIAL_DAILY',
      selectedDates: ['2026-10-11'],
      quantity: 1,
      amountPaise: 50000,
      orderStatus: OrderStatus.PAID,
      paymentStatus: PaymentStatus.CAPTURED,
      attendees: [
        {
          id: BigInt(101),
          ticketNumber: 'TK-COMM-REC-1',
          qrCodeToken: 'qr_token_recovery_abc123',
          name: 'Priya Sharma',
          mobile: '9876543210',
          category: 'Commercial Pass',
          status: AttendeeStatus.ACTIVE,
          registrationType: RegistrationType.COMMERCIAL,
          bookingDays: ['2026-10-11'],
        },
      ],
    };

    it('successfully sends ticket recovery email when order exists and mobile matches', async () => {
      prisma.commercialOrder.findUnique.mockResolvedValueOnce(mockCommercialPaidOrder);
      const mailService = (service as any).mailService;

      const res = await service.resendTicketEmail('ORD-COMM-RECOVER-1', '9876543210');

      expect(res.success).toBe(true);
      expect(res.message).toContain('sent to');
      expect(res.message).toContain('p***a@example.com');
      expect(mailService.sendCommercialTicketEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          orderNumber: 'ORD-COMM-RECOVER-1',
          customerEmail: 'priya@example.com',
          passes: expect.arrayContaining([
            expect.objectContaining({ ticketNumber: 'TK-COMM-REC-1' }),
          ]),
        }),
      );
    });

    it('rejects recovery when mobile number does not match registered order customer', async () => {
      prisma.commercialOrder.findUnique.mockResolvedValueOnce(mockCommercialPaidOrder);

      await expect(
        service.resendTicketEmail('ORD-COMM-RECOVER-1', '9999999999'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects recovery when order does not exist', async () => {
      prisma.commercialOrder.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.resendTicketEmail('ORD-COMM-NONEXISTENT', '9876543210'),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects recovery when order is unpaid or pending', async () => {
      prisma.commercialOrder.findUnique.mockResolvedValueOnce({
        ...mockCommercialPaidOrder,
        orderStatus: OrderStatus.PENDING,
      });

      await expect(
        service.resendTicketEmail('ORD-COMM-RECOVER-1', '9876543210'),
      ).rejects.toThrow(BadRequestException);
    });

    it('strictly isolates and rejects employee registrations from commercial ticket recovery', async () => {
      prisma.commercialOrder.findUnique.mockResolvedValueOnce({
        ...mockCommercialPaidOrder,
        registrationType: RegistrationType.EMPLOYEE,
      });

      await expect(
        service.resendTicketEmail('ORD-COMM-RECOVER-1', '9876543210'),
      ).rejects.toThrow(NotFoundException);
    });

    it('enforces rate limiting after 3 rapid recovery requests', async () => {
      redis.incrementCounter.mockResolvedValueOnce(1);
      prisma.commercialOrder.findUnique.mockResolvedValueOnce(mockCommercialPaidOrder);
      await service.resendTicketEmail('ORD-COMM-RECOVER-1', '9876543210');

      redis.incrementCounter.mockResolvedValueOnce(4); // Exceeds limit of 3
      await expect(
        service.resendTicketEmail('ORD-COMM-RECOVER-1', '9876543210'),
      ).rejects.toThrow(HttpException);
    });

    it('handles email provider failure gracefully without unhandled exception', async () => {
      prisma.commercialOrder.findUnique.mockResolvedValueOnce(mockCommercialPaidOrder);
      const mailService = (service as any).mailService;
      mailService.sendCommercialTicketEmail.mockResolvedValueOnce({
        success: false,
        error: 'Hostinger API rate limited',
      });

      const res = await service.resendTicketEmail('ORD-COMM-RECOVER-1', '9876543210');

      expect(res.success).toBe(false);
      expect(res.message).toContain('Email service could not deliver your ticket at this moment');
    });
  });
});

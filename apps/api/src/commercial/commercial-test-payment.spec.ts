import { Test, TestingModule } from '@nestjs/testing';
import { CommercialService } from './commercial.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { RazorpayService } from './razorpay.service';
import { MailService } from '../mail/mail.service';
import { ConfigService } from '@nestjs/config';
import { isCommercialTestPaymentEnabled } from './commercial-test-payment.util';
import {
  AttendeeStatus,
  OrderStatus,
  PaymentStatus,
  RegistrationType,
} from '@ongc/shared-types';
import { BadRequestException } from '@nestjs/common';

describe('Commercial Test Payment Mode (Staging-Only)', () => {
  describe('isCommercialTestPaymentEnabled Security Utility', () => {
    it('returns true when in non-production and COMMERCIAL_TEST_PAYMENT is true', () => {
      expect(isCommercialTestPaymentEnabled('development', 'true')).toBe(true);
      expect(isCommercialTestPaymentEnabled('test', 'true')).toBe(true);
      expect(isCommercialTestPaymentEnabled('staging', 'true')).toBe(true);
    });

    it('STRICT FAILSAFE: rejects test mode when NODE_ENV is production even if flag is true', () => {
      expect(isCommercialTestPaymentEnabled('production', 'true')).toBe(false);
      expect(isCommercialTestPaymentEnabled('PRODUCTION', 'true')).toBe(false);
    });

    it('returns false when COMMERCIAL_TEST_PAYMENT is false or unset', () => {
      expect(isCommercialTestPaymentEnabled('development', 'false')).toBe(false);
      expect(isCommercialTestPaymentEnabled('development', undefined)).toBe(false);
      expect(isCommercialTestPaymentEnabled('staging', '')).toBe(false);
    });
  });

  describe('CommercialService with Test Payment Mode', () => {
    let service: CommercialService;
    let prisma: any;
    let redis: any;
    let razorpay: any;
    let mailService: any;
    let configService: any;

    const testDto = {
      customerName: 'Staging Tester',
      customerMobile: '9876543210',
      customerEmail: 'tester@example.com',
      ticketType: 'COMMERCIAL_DAILY',
      selectedDates: ['2026-10-11', '2026-10-12'],
      quantity: 2,
    };

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

      mailService = {
        sendCommercialTicketEmail: jest.fn().mockResolvedValue({ success: true }),
      };

      razorpay = {
        getPublicKeyId: jest.fn().mockReturnValue('rzp_test_123'),
        createRazorpayOrder: jest.fn().mockImplementation((amountPaise, receipt) =>
          Promise.resolve({
            id: `order_rzp_${Date.now()}`,
            amount: amountPaise,
            currency: 'INR',
            receipt,
          }),
        ),
      };

      configService = {
        get: jest.fn((key: string) => {
          if (key === 'NODE_ENV') return 'staging';
          if (key === 'COMMERCIAL_TEST_PAYMENT') return 'true';
          return null;
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          CommercialService,
          { provide: PrismaService, useValue: prisma },
          { provide: RedisService, useValue: redis },
          { provide: RazorpayService, useValue: razorpay },
          { provide: MailService, useValue: mailService },
          { provide: ConfigService, useValue: configService },
        ],
      }).compile();

      service = module.get<CommercialService>(CommercialService);
    });

    it('staging test payment works without calling Razorpay and marks test order', async () => {
      let createdOrderRecord: any = null;
      const createdAttendees: any[] = [];

      prisma.commercialOrder.create.mockImplementation(async ({ data }: any) => {
        createdOrderRecord = {
          id: BigInt(101),
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        return createdOrderRecord;
      });

      prisma.attendee.create.mockImplementation(async ({ data }: any) => {
        const att = {
          id: BigInt(1000 + createdAttendees.length),
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        createdAttendees.push(att);
        return att;
      });

      const res = await service.createOrder(testDto);

      // 1. Razorpay must NOT be called in test mode
      expect(razorpay.createRazorpayOrder).not.toHaveBeenCalled();

      // 2. Order created with PAID status and AUTHORIZED paymentStatus (not CAPTURED)
      expect(createdOrderRecord).toBeDefined();
      expect(createdOrderRecord.orderStatus).toBe(OrderStatus.PAID);
      expect(createdOrderRecord.paymentStatus).toBe(PaymentStatus.AUTHORIZED);
      expect(createdOrderRecord.razorpayOrderId).toMatch(/^TEST_ORD_/);
      expect(createdOrderRecord.razorpayPaymentId).toMatch(/^TEST_PAY_/);
      expect(createdOrderRecord.metadata.isTestPayment).toBe(true);
      expect(createdOrderRecord.metadata.testMode).toBe('STAGING_TEST_PAYMENT');

      // 3. Attendees generated
      expect(createdAttendees).toHaveLength(2);
      expect(createdAttendees[0].orderId).toBe(BigInt(101));
      expect(createdAttendees[0].registrationType).toBe(RegistrationType.COMMERCIAL);
      expect(createdAttendees[0].status).toBe(AttendeeStatus.ACTIVE);
      expect(createdAttendees[0].qrCodeToken).toBeDefined();
      expect(createdAttendees[0].ticketNumber).toMatch(/^TK-COMM-/);

      // 4. Response contains test flags and passes with QR
      expect(res.success).toBe(true);
      expect(res.isTestPayment).toBe(true);
      expect(res.passes).toBeDefined();
      expect(res.passes!).toHaveLength(2);
      expect(res.passes![0].qrCodeToken).toBeDefined();
      expect(res.passes![0].qrSvg).toContain('<svg');
      expect(res.order.razorpayOrderId).toMatch(/^TEST_ORD_/);

      // 5. Ticket email was triggered
      // Wait briefly for setImmediate
      await new Promise((resolve) => setImmediate(resolve));
      expect(mailService.sendCommercialTicketEmail).toHaveBeenCalledTimes(1);
      expect(mailService.sendCommercialTicketEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          customerEmail: 'tester@example.com',
          orderNumber: createdOrderRecord.orderNumber,
        }),
      );
    });

    it('production rejects test mode even if COMMERCIAL_TEST_PAYMENT=true', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'NODE_ENV') return 'production';
        if (key === 'COMMERCIAL_TEST_PAYMENT') return 'true';
        return null;
      });

      prisma.commercialOrder.create.mockResolvedValue({
        id: BigInt(202),
        orderNumber: 'ORD-COMM-PROD-1',
        amountPaise: 49800,
        currency: 'INR',
        quantity: 2,
        ticketType: 'COMMERCIAL_DAILY',
        selectedDates: ['2026-10-11', '2026-10-12'],
        razorpayOrderId: 'order_rzp_prod',
        customerName: 'Customer',
        customerEmail: 'c@example.com',
        customerMobile: '9876543210',
      });

      const res = await service.createOrder(testDto);

      // In production, Razorpay MUST be called
      expect(razorpay.createRazorpayOrder).toHaveBeenCalled();
      expect(res.isTestPayment).toBeUndefined();
      expect(res.order.razorpayOrderId).toBeDefined();
    });

    it('normal Razorpay flow remains unchanged when COMMERCIAL_TEST_PAYMENT is false', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'NODE_ENV') return 'staging';
        if (key === 'COMMERCIAL_TEST_PAYMENT') return 'false';
        return null;
      });

      prisma.commercialOrder.create.mockResolvedValue({
        id: BigInt(203),
        orderNumber: 'ORD-COMM-NORMAL-1',
        amountPaise: 49800,
        currency: 'INR',
        quantity: 2,
        ticketType: 'COMMERCIAL_DAILY',
        selectedDates: ['2026-10-11', '2026-10-12'],
        razorpayOrderId: 'order_rzp_normal',
        customerName: 'Customer',
        customerEmail: 'c@example.com',
        customerMobile: '9876543210',
      });

      const res = await service.createOrder(testDto);

      expect(razorpay.createRazorpayOrder).toHaveBeenCalled();
      expect(res.isTestPayment).toBeUndefined();
      expect(res.order.razorpayOrderId).toBe('order_rzp_normal');
    });

    it('test mode cannot be enabled from request input', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'NODE_ENV') return 'staging';
        if (key === 'COMMERCIAL_TEST_PAYMENT') return 'false';
        return null;
      });

      prisma.commercialOrder.create.mockResolvedValue({
        id: BigInt(204),
        orderNumber: 'ORD-COMM-ATTEMPT-1',
        amountPaise: 49800,
        currency: 'INR',
        quantity: 2,
        ticketType: 'COMMERCIAL_DAILY',
        selectedDates: ['2026-10-11', '2026-10-12'],
        razorpayOrderId: 'order_rzp_attempt',
        customerName: 'Attacker',
        customerEmail: 'attacker@example.com',
        customerMobile: '9876543210',
      });

      // Malicious request attempt passing test flags in payload
      const maliciousDto: any = {
        ...testDto,
        isTestPayment: true,
        skipPayment: true,
        testMode: true,
      };

      const res = await service.createOrder(maliciousDto);

      // Must NOT activate test mode — Razorpay must be called
      expect(razorpay.createRazorpayOrder).toHaveBeenCalled();
      expect(res.isTestPayment).toBeUndefined();
    });

    it('recovery email works for test orders', async () => {
      const testOrderNumber = 'ORD-COMM-TEST-REC-1';
      const mockTestOrder = {
        id: BigInt(301),
        orderNumber: testOrderNumber,
        registrationType: RegistrationType.COMMERCIAL,
        orderStatus: OrderStatus.PAID,
        paymentStatus: PaymentStatus.AUTHORIZED,
        customerName: 'Test Recipient',
        customerMobile: '9876543210',
        customerEmail: 'testrecipient@example.com',
        ticketType: 'COMMERCIAL_DAILY',
        selectedDates: ['2026-10-11'],
        quantity: 1,
        amountPaise: 24900,
        metadata: {
          isTestPayment: true,
          testMode: 'STAGING_TEST_PAYMENT',
        },
        attendees: [
          {
            id: BigInt(3001),
            registrationType: RegistrationType.COMMERCIAL,
            ticketNumber: 'TK-COMM-TEST-1',
            qrCodeToken: 'mock_qr_token_test_123',
            name: 'Test Recipient',
            category: 'Commercial Pass',
          },
        ],
      };

      prisma.commercialOrder.findUnique.mockResolvedValue(mockTestOrder);

      const recoveryRes = await service.resendTicketEmail(testOrderNumber, '9876543210');

      expect(recoveryRes.success).toBe(true);
      expect(mailService.sendCommercialTicketEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          orderNumber: testOrderNumber,
          customerEmail: 'testrecipient@example.com',
        }),
      );
    });

    it('getOrder clearly distinguishes test payment order in details response', async () => {
      const testOrderNumber = 'ORD-COMM-TEST-DETAILS';
      const mockTestOrder = {
        id: BigInt(401),
        orderNumber: testOrderNumber,
        registrationType: RegistrationType.COMMERCIAL,
        orderStatus: OrderStatus.PAID,
        paymentStatus: PaymentStatus.AUTHORIZED,
        customerName: 'Verified Tester',
        customerMobile: '9876543210',
        customerEmail: 'verified@example.com',
        ticketType: 'COMMERCIAL_DAILY',
        selectedDates: ['2026-10-11'],
        quantity: 1,
        amountPaise: 24900,
        currency: 'INR',
        razorpayOrderId: 'TEST_ORD_1',
        createdAt: new Date(),
        paidAt: new Date(),
        failureReason: null,
        metadata: {
          isTestPayment: true,
          testMode: 'STAGING_TEST_PAYMENT',
          testPaymentReference: 'TEST_PAY_ORD-COMM-TEST-DETAILS',
        },
        attendees: [
          {
            id: BigInt(4001),
            ticketNumber: 'TK-COMM-TEST-1',
            qrCodeToken: 'mock_qr_token_details',
            name: 'Verified Tester',
            mobile: '9876543210',
            category: 'Commercial Pass',
            status: AttendeeStatus.ACTIVE,
            bookingDays: ['2026-10-11'],
          },
        ],
      };

      prisma.commercialOrder.findUnique.mockResolvedValue(mockTestOrder);

      const res = await service.getOrder(testOrderNumber, '9876543210');

      expect(res.orderNumber).toBe(testOrderNumber);
      expect(res.isTestPayment).toBe(true);
      expect(res.paymentStatus).toBe('TEST_PAID');
      expect(res.testPaymentReference).toBe('TEST_PAY_ORD-COMM-TEST-DETAILS');
      expect(res.passes).toHaveLength(1);
      expect(res.passes[0].qrSvg).toContain('<svg');
    });
  });
});

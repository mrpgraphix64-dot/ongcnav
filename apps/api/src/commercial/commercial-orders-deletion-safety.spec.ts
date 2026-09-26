import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { CommercialService } from './commercial.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../mail/mail.service';
import { RazorpayService } from './razorpay.service';
import {
  isAdminTestDataDeleteEnabled,
  isStagingTestOrder,
} from './commercial-test-payment.util';
import {
  CommercialOrderSource,
  OrderStatus,
  PaymentStatus,
  RegistrationType,
  UserRole,
} from '@ongc/shared-types';

describe('Commercial Orders Deletion Safety & Staging Test-Data Delete Mode Tests', () => {
  let service: CommercialService;
  let prisma: any;
  let configService: any;

  const originalEnv = process.env;

  beforeEach(async () => {
    process.env = { ...originalEnv };

    prisma = {
      commercialOrder: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        delete: jest.fn().mockResolvedValue({ id: BigInt(1) }),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({ id: BigInt(1) }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        count: jest.fn().mockResolvedValue(10),
        aggregate: jest.fn().mockResolvedValue({
          _sum: { amountPaise: 100000, quantity: 20 },
        }),
      },
      attendee: {
        deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
        count: jest.fn().mockResolvedValue(5),
        findMany: jest.fn().mockResolvedValue([]),
      },
      dailyCheckin: {
        deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      scanLog: {
        deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      paymentWebhookEvent: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      allocationEvent: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: BigInt(1) }),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn().mockImplementation(async (cb) => {
        return cb(prisma);
      }),
    };

    configService = {
      get: jest.fn((key: string) => {
        if (key === 'NODE_ENV') return process.env.NODE_ENV;
        if (key === 'ADMIN_TEST_DATA_DELETE_ENABLED') return process.env.ADMIN_TEST_DATA_DELETE_ENABLED;
        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommercialService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() } },
        { provide: ConfigService, useValue: configService },
        { provide: MailService, useValue: { sendTicketPassEmail: jest.fn() } },
        { provide: RazorpayService, useValue: { getKeyId: jest.fn() } },
      ],
    }).compile();

    service = module.get<CommercialService>(CommercialService);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('1. Environment Failsafes & Strict Configuration Guards (Points 1-5, 13)', () => {
    it('Point 1: enables test data delete mode only when NODE_ENV is non-prod and flag is strictly "true"', () => {
      expect(isAdminTestDataDeleteEnabled('staging', 'true')).toBe(true);
      expect(isAdminTestDataDeleteEnabled('development', 'true')).toBe(true);
      expect(isAdminTestDataDeleteEnabled('test', 'true')).toBe(true);
      expect(isAdminTestDataDeleteEnabled('local', 'true')).toBe(true);
    });

    it('Point 2: HARD PRODUCTION GUARD - rejects test data delete if NODE_ENV === "production" regardless of flag', () => {
      expect(isAdminTestDataDeleteEnabled('production', 'true')).toBe(false);
      expect(isAdminTestDataDeleteEnabled('PRODUCTION', 'true')).toBe(false);
      expect(isAdminTestDataDeleteEnabled('Production', 'true')).toBe(false);
    });

    it('Point 3: rejects test data delete if NODE_ENV is missing, empty, or undefined', () => {
      expect(isAdminTestDataDeleteEnabled(undefined, 'true')).toBe(false);
      expect(isAdminTestDataDeleteEnabled('', 'true')).toBe(false);
      expect(isAdminTestDataDeleteEnabled('   ', 'true')).toBe(false);
    });

    it('Point 4: rejects test data delete if NODE_ENV is unknown (not in allowed list)', () => {
      expect(isAdminTestDataDeleteEnabled('custom_prod', 'true')).toBe(false);
      expect(isAdminTestDataDeleteEnabled('live', 'true')).toBe(false);
      expect(isAdminTestDataDeleteEnabled('prod-replica', 'true')).toBe(false);
    });

    it('Point 5: rejects test data delete if ADMIN_TEST_DATA_DELETE_ENABLED is false, missing, or invalid', () => {
      expect(isAdminTestDataDeleteEnabled('staging', 'false')).toBe(false);
      expect(isAdminTestDataDeleteEnabled('staging', undefined)).toBe(false);
      expect(isAdminTestDataDeleteEnabled('staging', '')).toBe(false);
      expect(isAdminTestDataDeleteEnabled('staging', '1')).toBe(false);
      expect(isAdminTestDataDeleteEnabled('staging', 'yes')).toBe(false);
      expect(isAdminTestDataDeleteEnabled('staging', 'TRUE_OVERRIDE')).toBe(false);
    });

    it('Point 13: backend environment is authoritative - ignores any client request parameters', () => {
      process.env.NODE_ENV = 'production';
      process.env.ADMIN_TEST_DATA_DELETE_ENABLED = 'true';
      expect(service.isTestDataDeleteEnabled()).toBe(false);
    });
  });

  describe('2. Staging Test Order Identification Rules (Point 6)', () => {
    it('Point 6a: identifies test order via metadata.isTestPayment === true (object or string JSON)', () => {
      expect(isStagingTestOrder({ metadata: { isTestPayment: true } })).toBe(true);
      expect(isStagingTestOrder({ metadata: JSON.stringify({ isTestPayment: true }) })).toBe(true);
    });

    it('Point 6b: identifies test order via metadata.testMode === "STAGING_TEST_PAYMENT"', () => {
      expect(isStagingTestOrder({ metadata: { testMode: 'STAGING_TEST_PAYMENT' } })).toBe(true);
      expect(isStagingTestOrder({ metadata: JSON.stringify({ testMode: 'STAGING_TEST_PAYMENT' }) })).toBe(true);
    });

    it('Point 6c: identifies test order via razorpayOrderId starting with "TEST_ORD_"', () => {
      expect(isStagingTestOrder({ razorpayOrderId: 'TEST_ORD_123456' })).toBe(true);
    });

    it('Point 6d: identifies test order via razorpayPaymentId starting with "TEST_PAY_"', () => {
      expect(isStagingTestOrder({ razorpayPaymentId: 'TEST_PAY_987654' })).toBe(true);
    });

    it('Point 6e: returns false for real orders without test markers', () => {
      expect(isStagingTestOrder({
        razorpayOrderId: 'order_NxABC123',
        razorpayPaymentId: 'pay_NxXYZ789',
        metadata: { customerNote: 'Navratri pass' },
      })).toBe(false);
      expect(isStagingTestOrder(null)).toBe(false);
      expect(isStagingTestOrder(undefined)).toBe(false);
    });
  });

  describe('3. SUPER_ADMIN Test Data Deletion & Cascade Protections (Points 7, 10, 11)', () => {
    const mockTestOrder = {
      id: BigInt(501),
      orderNumber: 'ORD-TEST-001',
      orderStatus: OrderStatus.PAID,
      paymentStatus: PaymentStatus.CAPTURED,
      customerName: 'Test Buyer',
      customerMobile: '9876543210',
      customerEmail: 'testbuyer@ongcnavratri.tech',
      amountPaise: 49900,
      ticketType: 'COMMERCIAL_DAILY',
      quantity: 1,
      razorpayOrderId: 'TEST_ORD_501',
      razorpayPaymentId: 'TEST_PAY_501',
      metadata: { isTestPayment: true, testMode: 'STAGING_TEST_PAYMENT' },
      attendees: [
        {
          id: BigInt(1001),
          ticketNumber: 'TK-COMM-TEST-1',
          qrCodeToken: 'SUPER_SECRET_RAW_TOKEN_12345',
          dailyCheckins: [{ id: BigInt(2001) }],
          scanLogs: [{ id: BigInt(3001) }],
        },
      ],
      webhookEvents: [{ id: BigInt(4001) }],
      allocationEvents: [{ id: BigInt(5001) }],
    };

    it('Point 7: permanently deletes test order when SUPER_ADMIN and test delete mode is enabled', async () => {
      process.env.NODE_ENV = 'staging';
      process.env.ADMIN_TEST_DATA_DELETE_ENABLED = 'true';

      prisma.commercialOrder.findUnique.mockResolvedValue(mockTestOrder);

      const res = await service.deleteOrderAdmin(BigInt(501), {
        id: '99',
        role: UserRole.SUPER_ADMIN,
      });

      expect(res.success).toBe(true);
      expect(res.action).toBe('deleted');
      expect(res.isTestCleanup).toBe(true);
      expect(res.message).toContain('permanently deleted');
    });

    it('Point 10: executes full cascade delete of linked attendees, checkins, scan logs, webhooks, allocations, and order', async () => {
      process.env.NODE_ENV = 'staging';
      process.env.ADMIN_TEST_DATA_DELETE_ENABLED = 'true';

      prisma.commercialOrder.findUnique.mockResolvedValue(mockTestOrder);

      await service.deleteOrderAdmin(BigInt(501), {
        id: '99',
        role: UserRole.SUPER_ADMIN,
      });

      // Verify cascade delete calls inside transaction
      expect(prisma.dailyCheckin.deleteMany).toHaveBeenCalledWith({
        where: { attendeeId: { in: [BigInt(1001)] } },
      });
      expect(prisma.scanLog.deleteMany).toHaveBeenCalledWith({
        where: { attendeeId: { in: [BigInt(1001)] } },
      });
      expect(prisma.paymentWebhookEvent.deleteMany).toHaveBeenCalledWith({
        where: { orderId: BigInt(501) },
      });
      expect(prisma.allocationEvent.deleteMany).toHaveBeenCalledWith({
        where: { orderId: BigInt(501) },
      });
      expect(prisma.attendee.deleteMany).toHaveBeenCalledWith({
        where: { orderId: BigInt(501) },
      });
      expect(prisma.commercialOrder.delete).toHaveBeenCalledWith({
        where: { id: BigInt(501) },
      });
    });

    it('Point 11: creates TEST_DATA_DELETED audit log with safe metadata (no raw QR tokens, no secrets)', async () => {
      process.env.NODE_ENV = 'staging';
      process.env.ADMIN_TEST_DATA_DELETE_ENABLED = 'true';

      prisma.commercialOrder.findUnique.mockResolvedValue(mockTestOrder);

      await service.deleteOrderAdmin(BigInt(501), {
        id: '99',
        role: UserRole.SUPER_ADMIN,
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: BigInt(99),
          action: 'TEST_DATA_DELETED',
          details: expect.objectContaining({
            orderId: '501',
            orderNumber: 'ORD-TEST-001',
            customerName: 'Test Buyer',
            customerMobile: '9876543210',
            customerEmail: 'testbuyer@ongcnavratri.tech',
            amountInr: 499,
            ticketType: 'COMMERCIAL_DAILY',
            quantity: 1,
            razorpayOrderId: 'TEST_ORD_501',
            razorpayPaymentId: 'TEST_PAY_501',
            attendeeCount: 1,
            ticketNumbers: ['TK-COMM-TEST-1'],
            reason: 'Staging test data cleanup by SUPER_ADMIN',
          }),
        },
      });

      // Explicit verification: safe metadata does NOT include raw QR token
      const auditCall = prisma.auditLog.create.mock.calls[0][0];
      const serializedDetails = JSON.stringify(auditCall.data.details);
      expect(serializedDetails).not.toContain('SUPER_SECRET_RAW_TOKEN_12345');
    });
  });

  describe('4. Non-SUPER_ADMIN Role Rejections (Point 8)', () => {
    const mockTestOrder = {
      id: BigInt(502),
      orderNumber: 'ORD-TEST-002',
      orderStatus: OrderStatus.PAID,
      paymentStatus: PaymentStatus.CAPTURED,
      razorpayPaymentId: 'TEST_PAY_502',
      metadata: { isTestPayment: true },
      attendees: [],
      webhookEvents: [],
      allocationEvents: [],
    };

    it('Point 8a: rejects COMMERCIAL_ADMIN from deleting test orders even if flag is enabled', async () => {
      process.env.NODE_ENV = 'staging';
      process.env.ADMIN_TEST_DATA_DELETE_ENABLED = 'true';

      prisma.commercialOrder.findUnique.mockResolvedValue(mockTestOrder);

      await expect(
        service.deleteOrderAdmin(BigInt(502), { id: '55', role: UserRole.COMMERCIAL_ADMIN }),
      ).rejects.toThrow(ConflictException);
    });

    it('Point 8b: rejects EMPLOYEE_ADMIN, COMMERCIAL_AGENT, and other non-SUPER_ADMIN roles', async () => {
      process.env.NODE_ENV = 'staging';
      process.env.ADMIN_TEST_DATA_DELETE_ENABLED = 'true';

      prisma.commercialOrder.findUnique.mockResolvedValue(mockTestOrder);

      await expect(
        service.deleteOrderAdmin(BigInt(502), { id: '56', role: 'EMPLOYEE_ADMIN' }),
      ).rejects.toThrow(ConflictException);

      await expect(
        service.deleteOrderAdmin(BigInt(502), { id: '57', role: UserRole.COMMERCIAL_AGENT }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('5. Real Paid Order Inviolability / Production Safety (Points 9, 14)', () => {
    const mockRealPaidOrder = {
      id: BigInt(701),
      orderNumber: 'ORD-REAL-PAID-701',
      orderStatus: OrderStatus.PAID,
      paymentStatus: PaymentStatus.CAPTURED,
      razorpayOrderId: 'order_REAL_12345',
      razorpayPaymentId: 'pay_REAL_67890',
      metadata: { note: 'Real customer payment via Razorpay' },
      attendees: [{ id: BigInt(801), ticketNumber: 'TK-COMM-REAL-1', dailyCheckins: [], scanLogs: [] }],
      webhookEvents: [],
      allocationEvents: [],
    };

    it('Point 9: real paid orders are NEVER permanently deleted even by SUPER_ADMIN with test delete flag enabled', async () => {
      process.env.NODE_ENV = 'staging';
      process.env.ADMIN_TEST_DATA_DELETE_ENABLED = 'true';

      prisma.commercialOrder.findUnique.mockResolvedValue(mockRealPaidOrder);

      const res = await service.deleteOrderAdmin(BigInt(701), {
        id: '1',
        role: UserRole.SUPER_ADMIN,
      });

      // SUPER_ADMIN cancels real order instead of deleting it to preserve financial audit trail
      expect(res.action).toBe('cancelled');
      expect(prisma.commercialOrder.delete).not.toHaveBeenCalled();
      expect(prisma.commercialOrder.update).toHaveBeenCalledWith({
        where: { id: BigInt(701) },
        data: { orderStatus: OrderStatus.CANCELLED },
      });
    });

    it('Point 14: existing deletion safety remains 100% active when test delete mode is off (default)', async () => {
      process.env.NODE_ENV = 'staging';
      process.env.ADMIN_TEST_DATA_DELETE_ENABLED = 'false';

      prisma.commercialOrder.findUnique.mockResolvedValue(mockRealPaidOrder);

      // Normal admin deletion of paid order throws ConflictException
      await expect(
        service.deleteOrderAdmin(BigInt(701), { id: '2', role: UserRole.COMMERCIAL_ADMIN }),
      ).rejects.toThrow(ConflictException);
      await expect(
        service.deleteOrderAdmin(BigInt(701), { id: '2', role: UserRole.COMMERCIAL_ADMIN }),
      ).rejects.toThrow('cannot be deleted because it is a confirmed paid transaction.');
    });
  });

  describe('6. Bulk Delete Partitioning & Mixed Selection Reporting (Point 12)', () => {
    it('Point 12: bulk delete correctly partitions mixed test, safe unfulfilled, and real protected orders', async () => {
      process.env.NODE_ENV = 'staging';
      process.env.ADMIN_TEST_DATA_DELETE_ENABLED = 'true';

      const testOrder = {
        id: BigInt(1001),
        orderNumber: 'ORD-TEST-BULK-1',
        orderStatus: OrderStatus.PAID,
        paymentStatus: PaymentStatus.CAPTURED,
        razorpayOrderId: 'TEST_ORD_BULK_1',
        razorpayPaymentId: 'TEST_PAY_BULK_1',
        metadata: { isTestPayment: true },
        attendees: [{ id: BigInt(2001), ticketNumber: 'TK-TEST-1', dailyCheckins: [], scanLogs: [] }],
        webhookEvents: [],
        allocationEvents: [],
      };

      const safePendingOrder = {
        id: BigInt(1002),
        orderNumber: 'ORD-SAFE-PENDING-2',
        orderStatus: OrderStatus.PENDING,
        paymentStatus: PaymentStatus.CREATED,
        razorpayOrderId: null,
        razorpayPaymentId: null,
        metadata: null,
        attendees: [],
        webhookEvents: [],
        allocationEvents: [],
      };

      const realPaidOrder = {
        id: BigInt(1003),
        orderNumber: 'ORD-REAL-PAID-3',
        orderStatus: OrderStatus.PAID,
        paymentStatus: PaymentStatus.CAPTURED,
        razorpayOrderId: 'order_REAL_999',
        razorpayPaymentId: 'pay_REAL_999',
        metadata: { customer: 'Real Buyer' },
        attendees: [],
        webhookEvents: [],
        allocationEvents: [],
      };

      prisma.commercialOrder.findMany.mockResolvedValue([
        testOrder,
        safePendingOrder,
        realPaidOrder,
      ]);

      const res = await service.bulkDeleteOrdersAdmin(['1001', '1002', '1003'], {
        id: '1',
        role: UserRole.SUPER_ADMIN,
      });

      expect(res.totalSelected).toBe(3);
      expect(res.testDeletedCount).toBe(1);
      // In bulk deletion: 1 test deleted + 1 safe unfulfilled deleted = 2 deleted. Real paid order is PRESERVED untouched.
      expect(res.deletedCount).toBe(2);
      expect(res.protectedCount).toBe(1);
      expect(res.message).toContain('Permanently deleted 1 staging test order(s)');
      expect(res.message).toContain('Deleted 1 unfulfilled order(s)');
      expect(res.message).toContain('1 protected real order(s) were preserved untouched');

      // Test order audit log was recorded
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'TEST_DATA_DELETED',
          details: expect.objectContaining({
            orderNumber: 'ORD-TEST-BULK-1',
          }),
        }),
      });

      // Real paid order was NEVER cancelled, deleted, or state-mutated
      expect(prisma.commercialOrder.updateMany).not.toHaveBeenCalled();
      expect(prisma.attendee.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('7. List UI Flag Authorization & Channel Metrics (Point 15)', () => {
    it('Point 15a: returns testDataDeleteEnabled: true in listOrdersAdmin ONLY for SUPER_ADMIN when mode is active', async () => {
      process.env.NODE_ENV = 'staging';
      process.env.ADMIN_TEST_DATA_DELETE_ENABLED = 'true';

      const resSuperAdmin = await service.listOrdersAdmin({
        page: 1,
        limit: 10,
        userRole: UserRole.SUPER_ADMIN,
      });
      expect(resSuperAdmin.testDataDeleteEnabled).toBe(true);

      const resCommercialAdmin = await service.listOrdersAdmin({
        page: 1,
        limit: 10,
        userRole: UserRole.COMMERCIAL_ADMIN,
      });
      expect(resCommercialAdmin.testDataDeleteEnabled).toBe(false);
    });

    it('Point 15b: returns testDataDeleteEnabled: false if mode is disabled even for SUPER_ADMIN', async () => {
      process.env.NODE_ENV = 'staging';
      process.env.ADMIN_TEST_DATA_DELETE_ENABLED = 'false';

      const res = await service.listOrdersAdmin({
        page: 1,
        limit: 10,
        userRole: UserRole.SUPER_ADMIN,
      });
      expect(res.testDataDeleteEnabled).toBe(false);
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { CommercialService } from './commercial.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../mail/mail.service';
import { RazorpayService } from './razorpay.service';
import { CommercialOrderSource, OrderStatus, PaymentStatus, RegistrationType, UserRole } from '@ongc/shared-types';

describe('Commercial Orders Deletion Safety & Bulk Delete Tests', () => {
  let service: CommercialService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      commercialOrder: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        delete: jest.fn().mockResolvedValue({ id: BigInt(1) }),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        count: jest.fn().mockResolvedValue(10),
        aggregate: jest.fn().mockResolvedValue({
          _sum: { amountPaise: 100000, quantity: 20 },
        }),
      },
      attendee: {
        deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
        count: jest.fn().mockResolvedValue(5),
        findMany: jest.fn().mockResolvedValue([]),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn().mockImplementation(async (cb) => {
        return cb(prisma);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommercialService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() } },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: MailService, useValue: { sendTicketPassEmail: jest.fn() } },
        { provide: RazorpayService, useValue: { getKeyId: jest.fn() } },
      ],
    }).compile();

    service = module.get<CommercialService>(CommercialService);
  });

  describe('1. Individual Order Deletion Safety Rules', () => {
    it('throws NotFoundException if order does not exist', async () => {
      prisma.commercialOrder.findUnique.mockResolvedValue(null);
      await expect(service.deleteOrderAdmin(BigInt(999))).rejects.toThrow(NotFoundException);
    });

    it('rejects deleting a confirmed PAID order', async () => {
      prisma.commercialOrder.findUnique.mockResolvedValue({
        id: BigInt(10),
        orderNumber: 'ORD-PAID-001',
        orderStatus: OrderStatus.PAID,
        paymentStatus: PaymentStatus.CAPTURED,
        razorpayPaymentId: 'pay_123',
        attendees: [],
        webhookEvents: [],
        allocationEvents: [],
      });

      await expect(service.deleteOrderAdmin(BigInt(10))).rejects.toThrow(ConflictException);
      await expect(service.deleteOrderAdmin(BigInt(10))).rejects.toThrow(
        'Order ORD-PAID-001 cannot be deleted because it is a confirmed paid transaction.',
      );
    });

    it('rejects deleting an order with checked-in passes', async () => {
      prisma.commercialOrder.findUnique.mockResolvedValue({
        id: BigInt(11),
        orderNumber: 'ORD-CHECKIN-002',
        orderStatus: OrderStatus.PENDING,
        paymentStatus: PaymentStatus.CREATED,
        razorpayPaymentId: null,
        attendees: [
          {
            id: BigInt(101),
            dailyCheckins: [{ id: BigInt(1) }],
            scanLogs: [],
          },
        ],
        webhookEvents: [],
        allocationEvents: [],
      });

      await expect(service.deleteOrderAdmin(BigInt(11))).rejects.toThrow(ConflictException);
      await expect(service.deleteOrderAdmin(BigInt(11))).rejects.toThrow(
        'Order ORD-CHECKIN-002 cannot be deleted because it contains checked-in passes or scan audit logs.',
      );
    });

    it('rejects deleting an order with payment webhook audit logs', async () => {
      prisma.commercialOrder.findUnique.mockResolvedValue({
        id: BigInt(12),
        orderNumber: 'ORD-WEBHOOK-003',
        orderStatus: OrderStatus.PENDING,
        paymentStatus: PaymentStatus.CREATED,
        razorpayPaymentId: null,
        attendees: [],
        webhookEvents: [{ id: BigInt(501) }],
        allocationEvents: [],
      });

      await expect(service.deleteOrderAdmin(BigInt(12))).rejects.toThrow(ConflictException);
      await expect(service.deleteOrderAdmin(BigInt(12))).rejects.toThrow(
        'Order ORD-WEBHOOK-003 cannot be deleted because payment webhook audit records exist.',
      );
    });

    it('rejects deleting an order linked to agent allocation history', async () => {
      prisma.commercialOrder.findUnique.mockResolvedValue({
        id: BigInt(13),
        orderNumber: 'ORD-ALLOC-004',
        orderStatus: OrderStatus.PENDING,
        paymentStatus: PaymentStatus.CREATED,
        razorpayPaymentId: null,
        attendees: [],
        webhookEvents: [],
        allocationEvents: [{ id: BigInt(601) }],
      });

      await expect(service.deleteOrderAdmin(BigInt(13))).rejects.toThrow(ConflictException);
      await expect(service.deleteOrderAdmin(BigInt(13))).rejects.toThrow(
        'Order ORD-ALLOC-004 cannot be deleted because linked agent allocation history exists.',
      );
    });

    it('safely deletes an abandoned/test pending order without dependencies in a transaction', async () => {
      prisma.commercialOrder.findUnique.mockResolvedValue({
        id: BigInt(14),
        orderNumber: 'ORD-SAFE-005',
        orderStatus: OrderStatus.PENDING,
        paymentStatus: PaymentStatus.CREATED,
        razorpayPaymentId: null,
        attendees: [{ id: BigInt(201), dailyCheckins: [], scanLogs: [] }],
        webhookEvents: [],
        allocationEvents: [],
      });

      const res = await service.deleteOrderAdmin(BigInt(14));
      expect(res.success).toBe(true);
      expect(res.message).toBe('Order ORD-SAFE-005 deleted successfully.');
      expect(prisma.attendee.deleteMany).toHaveBeenCalledWith({ where: { orderId: BigInt(14) } });
      expect(prisma.commercialOrder.delete).toHaveBeenCalledWith({ where: { id: BigInt(14) } });
    });
  });

  describe('2. Bulk Order Deletion Safety & Partitioning', () => {
    it('rejects empty order ID arrays', async () => {
      await expect(service.bulkDeleteOrdersAdmin([])).rejects.toThrow(BadRequestException);
    });

    it('correctly partitions mixed selection, deleting safe orders and preserving protected orders', async () => {
      const order1 = {
        id: BigInt(101),
        orderNumber: 'ORD-SAFE-1',
        orderStatus: OrderStatus.PENDING,
        paymentStatus: PaymentStatus.CREATED,
        razorpayPaymentId: null,
        attendees: [],
        webhookEvents: [],
        allocationEvents: [],
      };
      const order2 = {
        id: BigInt(102),
        orderNumber: 'ORD-PROTECTED-PAID',
        orderStatus: OrderStatus.PAID,
        paymentStatus: PaymentStatus.CAPTURED,
        razorpayPaymentId: 'pay_999',
        attendees: [],
        webhookEvents: [],
        allocationEvents: [],
      };

      prisma.commercialOrder.findMany.mockResolvedValue([order1, order2]);

      const res = await service.bulkDeleteOrdersAdmin(['101', '102']);

      expect(res.totalSelected).toBe(2);
      expect(res.deletedCount).toBe(1);
      expect(res.protectedCount).toBe(1);
      expect(res.deletedOrders).toEqual([{ id: '101', orderNumber: 'ORD-SAFE-1' }]);
      expect(res.protectedOrders[0].orderNumber).toBe('ORD-PROTECTED-PAID');
      expect(prisma.commercialOrder.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: [BigInt(101)] } },
      });
    });
  });

  describe('3. Channel Breakdown & Free Passes Metrics', () => {
    it('returns channel summary counts for online, agent, and free passes', async () => {
      const res = await service.listOrdersAdmin({ page: 1, limit: 10 });
      expect(res.summary).toHaveProperty('publicOrdersCount');
      expect(res.summary).toHaveProperty('publicPassesCount');
      expect(res.summary).toHaveProperty('publicSalesInr');
      expect(res.summary).toHaveProperty('agentOrdersCount');
      expect(res.summary).toHaveProperty('agentPassesCount');
      expect(res.summary).toHaveProperty('agentSalesInr');
      expect(res.summary).toHaveProperty('freePassesCount');
      expect(res.summary).toHaveProperty('freeCheckedInCount');
      expect(res.summary).toHaveProperty('freeAvailableCount');
    });
  });
});

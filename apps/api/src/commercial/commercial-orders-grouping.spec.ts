import { Test, TestingModule } from '@nestjs/testing';
import { CommercialService } from './commercial.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../mail/mail.service';
import { RazorpayService } from './razorpay.service';
import { CommercialOrderSource, OrderStatus, RegistrationType, UserRole } from '@ongc/shared-types';

describe('Commercial Orders Grouping & Filters Tests', () => {
  let service: CommercialService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      commercialOrder: {
        count: jest.fn().mockImplementation(({ where }) => {
          if (where?.source === CommercialOrderSource.PUBLIC) return Promise.resolve(5);
          if (where?.source === CommercialOrderSource.AGENT) return Promise.resolve(10);
          return Promise.resolve(15);
        }),
        findMany: jest.fn().mockResolvedValue([
          {
            id: BigInt(1),
            orderNumber: 'ORD-COMM-AGT-1',
            registrationType: RegistrationType.COMMERCIAL,
            source: CommercialOrderSource.AGENT,
            paymentMode: 'OFFLINE',
            agentId: BigInt(100),
            agent: {
              id: BigInt(100),
              name: 'Dhaval Shah',
              email: 'dhaval@ongc.co.in',
              phone: '9016651452',
              staffId: 'AGT-001',
              role: UserRole.COMMERCIAL_AGENT,
              parentAgentId: null,
              parentAgent: null,
            },
            customerName: 'Karan Patel',
            customerMobile: '9876543210',
            customerEmail: 'karan@example.com',
            ticketType: 'COMMERCIAL_DAILY',
            selectedDates: ['2026-10-11'],
            quantity: 2,
            amountPaise: 49800,
            currency: 'INR',
            orderStatus: OrderStatus.PAID,
            paymentStatus: 'CAPTURED',
            _count: { attendees: 2 },
            attendees: [
              {
                id: BigInt(1),
                ticketNumber: 'TK-COMM-1',
                status: 'ACTIVE',
                category: 'Commercial Pass',
                bookingDays: ['2026-10-11'],
              },
            ],
            createdAt: new Date(),
            paidAt: new Date(),
          },
        ]),
        aggregate: jest.fn().mockImplementation(({ where }) => {
          return Promise.resolve({
            _sum: { amountPaise: 249000, quantity: 10 },
          });
        }),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: BigInt(100),
            name: 'Dhaval Shah',
            email: 'dhaval@ongc.co.in',
            phone: '9016651452',
            staffId: 'AGT-001',
            role: UserRole.COMMERCIAL_AGENT,
            parentAgentId: null,
            parentAgent: null,
            allocations: [
              {
                id: BigInt(1),
                allocatedQuantity: 100,
                bookedQuantity: 20,
                subAllocatedQuantity: 10,
              },
            ],
            agentOrders: [
              {
                id: BigInt(1),
                orderNumber: 'ORD-COMM-AGT-1',
                quantity: 2,
                amountPaise: 49800,
                orderStatus: OrderStatus.PAID,
                attendees: [
                  {
                    id: BigInt(1),
                    dailyCheckins: [{ id: BigInt(10) }],
                  },
                ],
              },
            ],
          },
        ]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommercialService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: {} },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: MailService, useValue: {} },
        { provide: RazorpayService, useValue: {} },
      ],
    }).compile();

    service = module.get<CommercialService>(CommercialService);
  });

  it('returns summary counts for public vs agent orders', async () => {
    const res = await service.listOrdersAdmin({ page: 1, limit: 20 });
    expect(res.summary.totalOrders).toBe(15);
    expect(res.summary.publicOrdersCount).toBe(5);
    expect(res.summary.agentOrdersCount).toBe(10);
    expect(res.summary.totalSalesInr).toBe(2490);
    expect(res.summary.totalPasses).toBe(10);
  });

  it('groups orders by agent when groupBy=agent is specified', async () => {
    const res = await service.listOrdersAdmin({ groupBy: 'agent' });
    expect(res.agentGroups).toBeDefined();
    expect(res.agentGroups.length).toBe(1);

    const group = res.agentGroups[0];
    expect(group.agent.name).toBe('Dhaval Shah');
    expect(group.ordersCount).toBe(1);
    expect(group.passesSold).toBe(2);
    expect(group.totalSalesInr).toBe(498);
    expect(group.availableAllocation).toBe(70);
    expect(group.checkedInPasses).toBe(1);
  });

  it('filters orders by source=AGENT and agentId correctly', async () => {
    await service.listOrdersAdmin({ source: 'AGENT', agentId: '100' });
    expect(prisma.commercialOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          source: 'AGENT',
          agentId: BigInt(100),
        }),
      }),
    );
  });
});

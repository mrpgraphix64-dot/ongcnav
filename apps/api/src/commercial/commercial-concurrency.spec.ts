import { Test, TestingModule } from '@nestjs/testing';
import { CommercialAgentService } from './commercial-agent.service';
import { CommercialService } from './commercial.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';
import {
  CommercialOrderSource,
  CommercialPaymentMode,
  OrderStatus,
  PaymentStatus,
  RegistrationType,
  UserRole,
} from '@ongc/shared-types';

describe('Commercial Agent Allocation Concurrency Benchmark & Safety', () => {
  let service: CommercialAgentService;
  let commercialService: any;

  // In-memory atomic store tracking allocations, orders, attendees, and events
  interface AllocationState {
    id: bigint;
    agentId: bigint;
    passType: string;
    allocatedQuantity: number;
    bookedQuantity: number;
    subAllocatedQuantity: number;
  }

  let allocationStore: Map<string, AllocationState>;
  let orderStore: Map<string, any>;
  let attendeeStore: Map<string, any>;
  let eventStore: any[];
  let mutex: Promise<void>;

  const agentId = BigInt(777);
  const passType = 'COMMERCIAL_DAILY';

  beforeEach(async () => {
    allocationStore = new Map();
    orderStore = new Map();
    attendeeStore = new Map();
    eventStore = [];
    mutex = Promise.resolve();

    // Initial state: Allocated = 3, Booked = 0, SubAllocated = 0
    allocationStore.set(`${agentId}-${passType}`, {
      id: BigInt(1),
      agentId,
      passType,
      allocatedQuantity: 3,
      bookedQuantity: 0,
      subAllocatedQuantity: 0,
    });

    const mockPrisma = {
      user: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id === agentId) {
            return Promise.resolve({
              id: agentId,
              name: 'Concurrency Test Agent',
              email: 'agent@concurrency.test',
              phone: '9876543210',
              role: UserRole.COMMERCIAL_AGENT,
              isActive: true,
            });
          }
          return Promise.resolve(null);
        }),
      },
      agentAllocation: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          const key = `${where.agentId_passType.agentId}-${where.agentId_passType.passType}`;
          const current = allocationStore.get(key);
          return Promise.resolve(current ? { ...current } : null);
        }),
      },
      commercialOrder: {
        create: jest.fn().mockImplementation(({ data }) => {
          const order = {
            id: BigInt(orderStore.size + 1),
            ...data,
            createdAt: new Date(),
          };
          orderStore.set(data.orderNumber, order);
          return Promise.resolve(order);
        }),
      },
      attendee: {
        create: jest.fn().mockImplementation(({ data }) => {
          const attendee = {
            id: BigInt(attendeeStore.size + 1),
            ...data,
          };
          attendeeStore.set(data.ticketNumber, attendee);
          return Promise.resolve(attendee);
        }),
      },
      allocationEvent: {
        create: jest.fn().mockImplementation(({ data }) => {
          const event = { id: BigInt(eventStore.length + 1), ...data };
          eventStore.push(event);
          return Promise.resolve(event);
        }),
      },
      $queryRaw: jest.fn().mockImplementation(async (strings: any, ...values: any[]) => {
        // Atomic transaction simulator matching PostgreSQL row-level locks
        // Simulates:
        // UPDATE agent_allocations
        // SET booked_quantity = booked_quantity + $quantity
        // WHERE agent_id = $agentId AND pass_type = $passType
        //   AND (allocated_quantity - booked_quantity - sub_allocated_quantity) >= $quantity
        // RETURNING *;
        return new Promise<any[]>((resolve) => {
          mutex = mutex.then(async () => {
            const requestedQty = values[0];
            const targetAgentId = values[1];
            const targetPassType = values[2];
            const key = `${targetAgentId}-${targetPassType}`;
            const alloc = allocationStore.get(key);

            if (!alloc) {
              resolve([]);
              return;
            }

            const available = alloc.allocatedQuantity - alloc.bookedQuantity - alloc.subAllocatedQuantity;
            if (available >= requestedQty) {
              alloc.bookedQuantity += requestedQty;
              resolve([{ ...alloc }]);
            } else {
              // 0 rows updated
              resolve([]);
            }
          });
        });
      }),
      $transaction: jest.fn().mockImplementation(async (cb) => {
        if (typeof cb === 'function') {
          return cb(mockPrisma);
        }
        return Promise.all(cb);
      }),
    };

    commercialService = {
      generateSecureQrToken: jest.fn().mockImplementation(() => `QR-${Math.random().toString(36).slice(2)}`),
      generateTicketNumber: jest.fn().mockImplementation((orderNum, idx) => `TK-${orderNum}-${idx}`),
      formatPasses: jest.fn().mockImplementation((passes) =>
        passes.map((p: any) => ({ ...p, qrSvg: '<svg></svg>' })),
      ),
      sendTicketEmailSafe: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommercialAgentService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CommercialService, useValue: commercialService },
      ],
    }).compile();

    service = module.get<CommercialAgentService>(CommercialAgentService);
  });

  it('Requirement 4: Allocated = 3, Booked = 0. Simultaneous requests A = 3 and B = 2. Exactly one succeeds, one completely rejected, final booked = 3 (or 2), no orphan orders, no partial fulfillment', async () => {
    // Request A: 3 Daily passes
    const requestA = {
      customerName: 'Customer A',
      customerMobile: '9999999991',
      customerEmail: 'customerA@test.com',
      ticketType: 'COMMERCIAL_DAILY',
      selectedDates: ['2026-10-11'],
      quantity: 3,
      termsAccepted: true,
    };

    // Request B: 2 Daily passes
    const requestB = {
      customerName: 'Customer B',
      customerMobile: '9999999992',
      customerEmail: 'customerB@test.com',
      ticketType: 'COMMERCIAL_DAILY',
      selectedDates: ['2026-10-11'],
      quantity: 2,
      termsAccepted: true,
    };

    // Fire both requests simultaneously
    const results = await Promise.allSettled([
      service.createOfflineBooking(agentId, requestA),
      service.createOfflineBooking(agentId, requestB),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled') as PromiseFulfilledResult<any>[];
    const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];

    // Invariant 1: Exactly one succeeds, exactly one fails
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    // Invariant 2: Rejected error must be BadRequestException with insufficient allocation notice
    expect(rejected[0].reason).toBeInstanceOf(BadRequestException);
    expect(rejected[0].reason.message).toContain('Insufficient allocation');
    expect(rejected[0].reason.message).toContain('The entire booking has been rejected');

    // Invariant 3: Final state in DB
    const finalAlloc = allocationStore.get(`${agentId}-${passType}`)!;
    expect(finalAlloc.allocatedQuantity).toBe(3);

    // Either Request A won (booked = 3, available = 0) OR Request B won (booked = 2, available = 1)
    if (fulfilled[0].value.order.customerName === 'Customer A') {
      expect(finalAlloc.bookedQuantity).toBe(3);
      expect(orderStore.size).toBe(1);
      expect(attendeeStore.size).toBe(3);
    } else {
      expect(finalAlloc.bookedQuantity).toBe(2);
      expect(orderStore.size).toBe(1);
      expect(attendeeStore.size).toBe(2);
    }

    // Invariant 4: No partial fulfillment ever
    // The successful request must have gotten its exact requested quantity
    const successfulOrder = fulfilled[0].value.order;
    expect([2, 3]).toContain(successfulOrder.quantity);
    expect(fulfilled[0].value.passes).toHaveLength(successfulOrder.quantity);

    // Invariant 5: No orphan order or attendee created for rejected request
    const rejectedOrderCount = Array.from(orderStore.values()).filter(
      (o) => o.customerName === (successfulOrder.customerName === 'Customer A' ? 'Customer B' : 'Customer A'),
    );
    expect(rejectedOrderCount).toHaveLength(0);

    // Invariant 6: AllocationEvent recorded for the consumption
    expect(eventStore).toHaveLength(1);
    expect(eventStore[0].quantityDelta).toBe(-successfulOrder.quantity);
    expect(eventStore[0].eventType).toBe('CONSUMPTION');
  });

  it('Zero balance: Simultaneous requests against exhausted allocation are all rejected', async () => {
    // Set booked = 3 (available = 0)
    const alloc = allocationStore.get(`${agentId}-${passType}`)!;
    alloc.bookedQuantity = 3;

    const request = {
      customerName: 'Customer C',
      customerMobile: '9999999993',
      customerEmail: 'customerC@test.com',
      ticketType: 'COMMERCIAL_DAILY',
      selectedDates: ['2026-10-11'],
      quantity: 1,
      termsAccepted: true,
    };

    const results = await Promise.allSettled([
      service.createOfflineBooking(agentId, request),
      service.createOfflineBooking(agentId, request),
    ]);

    const rejected = results.filter((r) => r.status === 'rejected');
    expect(rejected).toHaveLength(2);
    expect(orderStore.size).toBe(0);
    expect(attendeeStore.size).toBe(0);
  });
});

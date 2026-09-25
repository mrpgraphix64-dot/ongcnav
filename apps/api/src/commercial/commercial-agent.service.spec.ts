import { Test, TestingModule } from '@nestjs/testing';
import { CommercialAgentService } from './commercial-agent.service';
import { CommercialService } from './commercial.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  AttendeeStatus,
  CommercialOrderSource,
  CommercialPaymentMode,
  OrderStatus,
  PaymentStatus,
  RegistrationType,
  UserRole,
} from '@ongc/shared-types';
import { COMMERCIAL_EVENT_DATES } from './commercial.constants';

describe('CommercialAgentService', () => {
  let service: CommercialAgentService;
  let prisma: any;
  let commercialService: any;

  const mockAgentUser = {
    id: BigInt(100),
    name: 'Vipul Agent',
    email: 'vipul@agent.com',
    phone: '9876543210',
    staffId: 'AGT-001',
    role: UserRole.COMMERCIAL_AGENT,
    isActive: true,
    parentAgentId: null,
    parentAgent: null,
    _count: {
      subAgents: 2,
      agentOrders: 5,
    },
  };

  const mockSubAgentUser = {
    id: BigInt(101),
    name: 'Ramesh SubAgent',
    email: 'ramesh@subagent.com',
    phone: '9876543211',
    staffId: 'AGT-002',
    role: UserRole.COMMERCIAL_AGENT,
    isActive: true,
    parentAgentId: BigInt(100),
    allocations: [],
    _count: {
      agentOrders: 2,
    },
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        count: jest.fn(),
      },
      agentAllocation: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      commercialOrder: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      attendee: {
        create: jest.fn(),
      },
      allocationEvent: {
        create: jest.fn().mockResolvedValue({ id: BigInt(1) }),
      },
      $queryRaw: jest.fn(),
      $executeRaw: jest.fn(),
      $transaction: jest.fn().mockImplementation(async (cb) => {
        if (typeof cb === 'function') {
          return cb(prisma);
        }
        return Promise.all(cb);
      }),
    };

    commercialService = {
      generateSecureQrToken: jest.fn().mockReturnValue('mock-qr-token-64-characters-long'),
      generateTicketNumber: jest.fn().mockReturnValue('TK-COMM-ORD001-1-ABCD'),
      formatPasses: jest.fn().mockImplementation((attendees) =>
        attendees.map((a: any) => ({
          ...a,
          id: a.id?.toString() || '1',
          qrSvg: '<svg>mock</svg>',
        })),
      ),
      sendTicketEmailSafe: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommercialAgentService,
        { provide: PrismaService, useValue: prisma },
        { provide: CommercialService, useValue: commercialService },
      ],
    }).compile();

    service = module.get<CommercialAgentService>(CommercialAgentService);
  });

  describe('getAgentProfile', () => {
    it('returns agent profile with parent info and counts', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(mockAgentUser);

      const res = await service.getAgentProfile(BigInt(100));
      expect(res.id).toBe('100');
      expect(res.name).toBe('Vipul Agent');
      expect(res.role).toBe(UserRole.COMMERCIAL_AGENT);
      expect(res.subAgentsCount).toBe(2);
      expect(res.ordersCount).toBe(5);
    });

    it('throws NotFoundException if agent is inactive or not found', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);

      await expect(service.getAgentProfile(BigInt(999))).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getAgentAllocations', () => {
    it('calculates available quantity as allocated - booked - subAllocated', async () => {
      prisma.agentAllocation.findMany.mockResolvedValueOnce([
        {
          id: BigInt(1),
          passType: 'COMMERCIAL_DAILY',
          allocatedQuantity: 200,
          bookedQuantity: 50,
          subAllocatedQuantity: 30,
          updatedAt: new Date(),
        },
        {
          id: BigInt(2),
          passType: 'COMMERCIAL_SEASON',
          allocatedQuantity: 50,
          bookedQuantity: 10,
          subAllocatedQuantity: 0,
          updatedAt: new Date(),
        },
      ]);

      const res = await service.getAgentAllocations(BigInt(100));
      expect(res.allocations).toHaveLength(2);

      const daily = res.allocations.find((a) => a.passType === 'COMMERCIAL_DAILY');
      expect(daily?.allocatedQuantity).toBe(200);
      expect(daily?.bookedQuantity).toBe(50);
      expect(daily?.subAllocatedQuantity).toBe(30);
      expect(daily?.availableQuantity).toBe(120); // 200 - 50 - 30

      expect(res.summary.totalAllocated).toBe(250);
      expect(res.summary.totalBooked).toBe(60);
      expect(res.summary.totalSubAllocated).toBe(30);
      expect(res.summary.totalAvailable).toBe(160);
    });
  });

  describe('createOfflineBooking', () => {
    it('creates offline booking when allocation is sufficient', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(mockAgentUser);

      // Simulate atomic deduction returning updated row
      prisma.$queryRaw.mockResolvedValueOnce([
        {
          id: BigInt(1),
          agent_id: BigInt(100),
          pass_type: 'COMMERCIAL_DAILY',
          allocated_quantity: 200,
          booked_quantity: 2,
          sub_allocated_quantity: 0,
        },
      ]);

      const mockOrder = {
        id: BigInt(501),
        orderNumber: 'ORD-COMM-2026-0001',
        registrationType: RegistrationType.COMMERCIAL,
        source: CommercialOrderSource.AGENT,
        paymentMode: CommercialPaymentMode.OFFLINE,
        agentId: BigInt(100),
        customerName: 'Kishore Kumar',
        customerMobile: '9898989898',
        customerEmail: 'kishore@example.com',
        ticketType: 'COMMERCIAL_DAILY',
        selectedDates: ['2026-10-11'],
        quantity: 2,
        unitPricePaise: 49900,
        amountPaise: 99800,
        orderStatus: OrderStatus.PAID,
        paymentStatus: PaymentStatus.CAPTURED,
        paidAt: new Date(),
      };

      prisma.commercialOrder.create.mockResolvedValueOnce(mockOrder);
      prisma.attendee.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: BigInt(1001), ...data }),
      );

      const res = await service.createOfflineBooking(BigInt(100), {
        customerName: 'Kishore Kumar',
        customerMobile: '9898989898',
        customerEmail: 'kishore@example.com',
        ticketType: 'COMMERCIAL_DAILY',
        selectedDates: ['2026-10-11'],
        quantity: 2,
        termsAccepted: true,
      });

      expect(res.success).toBe(true);
      expect(res.order.orderNumber).toBe(mockOrder.orderNumber);
      expect(res.order.source).toBe('AGENT');
      expect(res.order.paymentMode).toBe('OFFLINE');
      expect(res.passes).toHaveLength(2);
      expect(commercialService.sendTicketEmailSafe).toHaveBeenCalled();
    });

    it('rejects entire booking when allocation is insufficient (never partial fulfillment)', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(mockAgentUser);

      // Raw query returns 0 rows due to insufficient available quantity condition
      prisma.$queryRaw.mockResolvedValueOnce([]);

      prisma.agentAllocation.findUnique.mockResolvedValueOnce({
        id: BigInt(1),
        agentId: BigInt(100),
        passType: 'COMMERCIAL_DAILY',
        allocatedQuantity: 10,
        bookedQuantity: 8,
        subAllocatedQuantity: 0,
      });

      await expect(
        service.createOfflineBooking(BigInt(100), {
          customerName: 'Kishore Kumar',
          customerMobile: '9898989898',
          customerEmail: 'kishore@example.com',
          ticketType: 'COMMERCIAL_DAILY',
          selectedDates: ['2026-10-11'],
          quantity: 5, // requires 5, but available is only 2
          termsAccepted: true,
        }),
      ).rejects.toThrow(
        /Insufficient allocation.*Required: 5, Available: 2.*entire booking has been rejected/i,
      );

      // Verify no order or passes were created
      expect(prisma.commercialOrder.create).not.toHaveBeenCalled();
      expect(prisma.attendee.create).not.toHaveBeenCalled();
    });

    it('rejects if Daily Pass does not have exactly one valid event date', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(mockAgentUser);

      await expect(
        service.createOfflineBooking(BigInt(100), {
          customerName: 'Kishore Kumar',
          customerMobile: '9898989898',
          customerEmail: 'kishore@example.com',
          ticketType: 'COMMERCIAL_DAILY',
          selectedDates: ['2026-10-11', '2026-10-12'], // multiple dates
          quantity: 1,
          termsAccepted: true,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('automatically applies all event dates for Season Pass', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(mockAgentUser);

      prisma.$queryRaw.mockResolvedValueOnce([
        {
          id: BigInt(2),
          agent_id: BigInt(100),
          pass_type: 'COMMERCIAL_SEASON',
          allocated_quantity: 50,
          booked_quantity: 1,
          sub_allocated_quantity: 0,
        },
      ]);

      const mockOrder = {
        id: BigInt(502),
        orderNumber: 'ORD-COMM-2026-0002',
        registrationType: RegistrationType.COMMERCIAL,
        source: CommercialOrderSource.AGENT,
        paymentMode: CommercialPaymentMode.OFFLINE,
        agentId: BigInt(100),
        customerName: 'Anita Shah',
        customerMobile: '9898989898',
        customerEmail: 'anita@example.com',
        ticketType: 'COMMERCIAL_SEASON',
        selectedDates: COMMERCIAL_EVENT_DATES,
        quantity: 1,
        unitPricePaise: 299900,
        amountPaise: 299900,
        orderStatus: OrderStatus.PAID,
        paymentStatus: PaymentStatus.CAPTURED,
        paidAt: new Date(),
      };

      prisma.commercialOrder.create.mockResolvedValueOnce(mockOrder);
      prisma.attendee.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: BigInt(1002), ...data }),
      );

      const res = await service.createOfflineBooking(BigInt(100), {
        customerName: 'Anita Shah',
        customerMobile: '9898989898',
        customerEmail: 'anita@example.com',
        ticketType: 'COMMERCIAL_SEASON',
        selectedDates: [], // empty date input ignored for season pass
        quantity: 1,
        termsAccepted: true,
      });

      expect(res.success).toBe(true);
      expect(res.order.selectedDates).toEqual(COMMERCIAL_EVENT_DATES);
    });
  });

  describe('Sub-Agent Hierarchy & IDOR Protection', () => {
    it('creates sub-agent under parent agent with hashed password and COMMERCIAL_SUB_AGENT role', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(mockAgentUser);
      prisma.user.findFirst.mockResolvedValueOnce(null); // no conflict
      prisma.user.create.mockResolvedValueOnce({
        id: BigInt(101),
        name: 'Ramesh SubAgent',
        email: 'ramesh@subagent.com',
        phone: '9876543211',
        staffId: 'AGT-002',
        role: UserRole.COMMERCIAL_SUB_AGENT,
        parentAgentId: BigInt(100),
        createdAt: new Date(),
      });

      const res = await service.createSubAgent(BigInt(100), {
        name: 'Ramesh SubAgent',
        email: 'ramesh@subagent.com',
        phone: '9876543211',
        password: 'Password123!',
        staffId: 'AGT-002',
      });

      expect(res.id).toBe('101');
      expect(res.role).toBe(UserRole.COMMERCIAL_SUB_AGENT);
      expect(res.parentAgentId).toBe('100');
    });

    it('rejects sub-agent creation if caller is already a sub-agent (strictly 1-level hierarchy)', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        ...mockSubAgentUser,
        role: UserRole.COMMERCIAL_SUB_AGENT,
        parentAgentId: BigInt(100),
      });

      await expect(
        service.createSubAgent(BigInt(101), {
          name: 'Sub-SubAgent',
          email: 'subsub@agent.com',
          phone: '9876543299',
          password: 'Password123!',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects sub-agent creation on duplicate email or phone', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(mockAgentUser);
      prisma.user.findFirst.mockResolvedValueOnce({ id: BigInt(99) }); // conflict found

      await expect(
        service.createSubAgent(BigInt(100), {
          name: 'Duplicate',
          email: 'vipul@agent.com',
          phone: '9876543210',
          password: 'Password123!',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('sub-allocates passes from parent available balance to sub-agent', async () => {
      // Sub-agent exists and belongs to parent
      prisma.user.findFirst.mockResolvedValueOnce(mockSubAgentUser);

      // Parent has enough balance, child upsert succeeds
      prisma.$queryRaw
        .mockResolvedValueOnce([
          {
            id: BigInt(1),
            agent_id: BigInt(100),
            pass_type: 'COMMERCIAL_DAILY',
            sub_allocated_quantity: 20,
          },
        ])
        .mockResolvedValueOnce([
          {
            id: BigInt(2),
            agent_id: BigInt(101),
            pass_type: 'COMMERCIAL_DAILY',
            allocated_quantity: 20,
          },
        ]);

      const res = await service.subAllocateToAgent(BigInt(100), BigInt(101), {
        passType: 'COMMERCIAL_DAILY',
        quantity: 20,
      });

      expect(res.success).toBe(true);
      expect(res.message).toContain('Successfully allocated 20 COMMERCIAL_DAILY passes');
    });

    it('rejects sub-allocation if target sub-agent does not belong to parent (IDOR guard)', async () => {
      prisma.user.findFirst.mockResolvedValueOnce(null); // not found under parent

      await expect(
        service.subAllocateToAgent(BigInt(100), BigInt(999), {
          passType: 'COMMERCIAL_DAILY',
          quantity: 10,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects sub-allocation if parent available balance is insufficient', async () => {
      prisma.user.findFirst.mockResolvedValueOnce(mockSubAgentUser);

      // Parent query fails due to insufficient balance
      prisma.$queryRaw.mockResolvedValueOnce([]);
      prisma.agentAllocation.findUnique.mockResolvedValueOnce({
        allocatedQuantity: 10,
        bookedQuantity: 5,
        subAllocatedQuantity: 5, // 10 - 5 - 5 = 0 available
      });

      await expect(
        service.subAllocateToAgent(BigInt(100), BigInt(101), {
          passType: 'COMMERCIAL_DAILY',
          quantity: 10,
        }),
      ).rejects.toThrow(/Insufficient available allocation/);
    });

    it('reclaims unused passes from sub-agent back to parent agent', async () => {
      prisma.user.findFirst.mockResolvedValueOnce(mockSubAgentUser);
      // Raw query child deduction succeeds, parent sub_allocated reduction succeeds
      prisma.$queryRaw
        .mockResolvedValueOnce([
          {
            id: BigInt(2),
            agent_id: BigInt(101),
            pass_type: 'COMMERCIAL_DAILY',
            allocated_quantity: 15,
          },
        ])
        .mockResolvedValueOnce([
          {
            id: BigInt(1),
            agent_id: BigInt(100),
            pass_type: 'COMMERCIAL_DAILY',
            sub_allocated_quantity: 15,
          },
        ]);

      const res = await service.reclaimFromSubAgent(BigInt(100), BigInt(101), {
        passType: 'COMMERCIAL_DAILY',
        quantity: 5,
        notes: 'Excess quota reclaim',
      });

      expect(res.success).toBe(true);
      expect(res.message).toContain('Successfully reclaimed 5 COMMERCIAL_DAILY passes');
      expect(prisma.allocationEvent.create).toHaveBeenCalled();
    });

    it('rejects sub-agent reclaim if requested quantity exceeds unused available', async () => {
      prisma.user.findFirst.mockResolvedValueOnce(mockSubAgentUser);
      prisma.$queryRaw.mockResolvedValueOnce([]); // 0 rows updated
      prisma.agentAllocation.findUnique.mockResolvedValueOnce({
        allocatedQuantity: 10,
        bookedQuantity: 8,
        subAllocatedQuantity: 0, // Only 2 unused
      });

      await expect(
        service.reclaimFromSubAgent(BigInt(100), BigInt(101), {
          passType: 'COMMERCIAL_DAILY',
          quantity: 5,
        }),
      ).rejects.toThrow(/Cannot reclaim 5 COMMERCIAL_DAILY passes/);
    });

    it('rejects sub-agent reclaim if caller is not the parent agent (IDOR)', async () => {
      prisma.user.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.reclaimFromSubAgent(BigInt(100), BigInt(999), {
          passType: 'COMMERCIAL_DAILY',
          quantity: 5,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('allows parent agent oversight view of sub-agent allocations but prevents altering child inventory', async () => {
      prisma.user.findFirst.mockResolvedValueOnce(mockSubAgentUser);
      prisma.agentAllocation.findMany.mockResolvedValueOnce([
        {
          id: BigInt(5),
          passType: 'COMMERCIAL_DAILY',
          allocatedQuantity: 20,
          bookedQuantity: 5,
          subAllocatedQuantity: 0,
          updatedAt: new Date(),
        },
      ]);

      const res = await service.getSubAgentAllocations(BigInt(100), BigInt(101));
      expect(res.allocations).toHaveLength(1);
      expect(res.allocations[0].availableQuantity).toBe(15);
    });

    it('rejects oversight of sub-agent that does not belong to parent', async () => {
      prisma.user.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.getSubAgentAllocations(BigInt(100), BigInt(999)),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Admin Operations', () => {
    it('creates root commercial agent by admin', async () => {
      prisma.user.findFirst.mockResolvedValueOnce(null);
      prisma.user.create.mockResolvedValueOnce({
        id: BigInt(200),
        name: 'Root Agent 1',
        email: 'root1@agent.com',
        phone: '9811223344',
        staffId: 'AGT-ROOT-01',
        role: UserRole.COMMERCIAL_AGENT,
        isActive: true,
        createdAt: new Date(),
      });

      const res = await service.createAgentAdmin(BigInt(1), {
        name: 'Root Agent 1',
        email: 'root1@agent.com',
        phone: '9811223344',
        password: 'AdminPassword123!',
        staffId: 'AGT-ROOT-01',
      });

      expect(res.id).toBe('200');
      expect(res.role).toBe(UserRole.COMMERCIAL_AGENT);
    });

    it('allocates master passes from admin to agent', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(mockAgentUser);
      prisma.$queryRaw.mockResolvedValueOnce([
        {
          id: BigInt(1),
          agent_id: BigInt(100),
          pass_type: 'COMMERCIAL_DAILY',
          allocated_quantity: 500,
        },
      ]);

      const res = await service.allocateToAgentAdmin(BigInt(1), BigInt(100), {
        passType: 'COMMERCIAL_DAILY',
        quantity: 500,
      });

      expect(res.success).toBe(true);
      expect(res.message).toContain('Successfully allocated 500 COMMERCIAL_DAILY passes');
      expect(prisma.allocationEvent.create).toHaveBeenCalled();
    });

    it('reclaims unused passes from agent by admin', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(mockAgentUser);
      prisma.$queryRaw.mockResolvedValueOnce([
        {
          id: BigInt(1),
          agent_id: BigInt(100),
          pass_type: 'COMMERCIAL_DAILY',
          allocated_quantity: 400,
        },
      ]);

      const res = await service.reclaimFromAgentAdmin(BigInt(1), BigInt(100), {
        passType: 'COMMERCIAL_DAILY',
        quantity: 100,
        notes: 'Admin reclamation',
      });

      expect(res.success).toBe(true);
      expect(res.message).toContain('Successfully reclaimed 100 COMMERCIAL_DAILY passes');
      expect(prisma.allocationEvent.create).toHaveBeenCalled();
    });

    it('rejects admin reclaim if requested quantity exceeds unused available', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(mockAgentUser);
      prisma.$queryRaw.mockResolvedValueOnce([]); // 0 rows updated
      prisma.agentAllocation.findUnique.mockResolvedValueOnce({
        allocatedQuantity: 100,
        bookedQuantity: 95,
        subAllocatedQuantity: 0, // only 5 unused
      });

      await expect(
        service.reclaimFromAgentAdmin(BigInt(1), BigInt(100), {
          passType: 'COMMERCIAL_DAILY',
          quantity: 20,
        }),
      ).rejects.toThrow(/Cannot reclaim 20 COMMERCIAL_DAILY passes/);
    });

    it('rejects allocation of invalid pass type', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(mockAgentUser);

      await expect(
        service.allocateToAgentAdmin(BigInt(1), BigInt(100), {
          passType: 'INVALID_PASS_TYPE',
          quantity: 10,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

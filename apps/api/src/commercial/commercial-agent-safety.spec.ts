import { Test, TestingModule } from '@nestjs/testing';
import { CommercialAgentService } from './commercial-agent.service';
import { CommercialService } from './commercial.service';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, OrderStatus } from '@ongc/shared-types';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('Commercial Agent Safety & Deletion Tests', () => {
  let service: CommercialAgentService;
  let prisma: any;
  let commercialService: any;

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn().mockImplementation(({ where, data }) =>
          Promise.resolve({ id: where.id, name: 'Agent Test', ...data }),
        ),
        delete: jest.fn().mockResolvedValue({ id: BigInt(10) }),
      },
      agentAllocation: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      gateUser: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      auditLog: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      attendee: {
        count: jest.fn().mockResolvedValue(0),
      },
      $transaction: jest.fn().mockImplementation(async (cb) => cb(prisma)),
    };

    commercialService = {};

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommercialAgentService,
        { provide: PrismaService, useValue: prisma },
        { provide: CommercialService, useValue: commercialService },
      ],
    }).compile();

    service = module.get<CommercialAgentService>(CommercialAgentService);
  });

  it('rejects deletion if agent has sub-agents assigned', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: BigInt(10),
      name: 'Master Agent',
      role: UserRole.COMMERCIAL_AGENT,
      subAgents: [{ id: BigInt(20), name: 'Sub 1' }],
      agentOrders: [],
      allocations: [],
      givenAllocations: [],
      allocationEventsPerformed: [],
      scannedLogs: [],
      scannedCheckins: [],
    });

    await expect(service.deleteAgentAdmin(BigInt(1), BigInt(10))).rejects.toThrow(
      new BadRequestException(
        'This agent cannot be deleted because they have sub-agents assigned. Remove or reassign sub-agents first, or deactivate the agent.',
      ),
    );
  });

  it('rejects deletion if agent has historical booked orders', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: BigInt(10),
      name: 'Agent with Orders',
      role: UserRole.COMMERCIAL_AGENT,
      subAgents: [],
      agentOrders: [{ id: BigInt(101) }],
      allocations: [],
      givenAllocations: [],
      allocationEventsPerformed: [],
      scannedLogs: [],
      scannedCheckins: [],
    });

    await expect(service.deleteAgentAdmin(BigInt(1), BigInt(10))).rejects.toThrow(
      new BadRequestException(
        'This agent cannot be deleted because historical bookings or allocations are linked to this account. Deactivate the agent instead.',
      ),
    );
  });

  it('rejects deletion if agent has active allocations', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: BigInt(10),
      name: 'Agent with Allocations',
      role: UserRole.COMMERCIAL_AGENT,
      subAgents: [],
      agentOrders: [],
      allocations: [
        {
          id: BigInt(1),
          passType: 'COMMERCIAL_DAILY',
          allocatedQuantity: 50,
          bookedQuantity: 0,
          subAllocatedQuantity: 0,
        },
      ],
      givenAllocations: [],
      allocationEventsPerformed: [],
      scannedLogs: [],
      scannedCheckins: [],
    });

    await expect(service.deleteAgentAdmin(BigInt(1), BigInt(10))).rejects.toThrow(
      new BadRequestException(
        'This agent cannot be deleted because historical bookings or allocations are linked to this account. Deactivate the agent instead.',
      ),
    );
  });

  it('allows deletion when agent has zero dependencies', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: BigInt(10),
      name: 'Clean New Agent',
      role: UserRole.COMMERCIAL_AGENT,
      subAgents: [],
      agentOrders: [],
      allocations: [],
      givenAllocations: [],
      allocationEventsPerformed: [],
      scannedLogs: [],
      scannedCheckins: [],
    });

    const res = await service.deleteAgentAdmin(BigInt(1), BigInt(10));
    expect(res).toEqual({ message: "Agent 'Clean New Agent' deleted successfully." });
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: BigInt(10) } });
  });

  it('toggles agent active/inactive status', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: BigInt(10),
      name: 'Agent Active',
      role: UserRole.COMMERCIAL_AGENT,
      isActive: true,
    });

    const res = await service.toggleAgentStatusAdmin(BigInt(10));
    expect(res.isActive).toBe(false);
    expect(res.message).toContain('deactivated');
  });

  it('retrieves detailed agent profile for details drawer', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: BigInt(10),
      name: 'Dhaval Shah',
      email: 'dhaval@ongc.co.in',
      phone: '9016651452',
      staffId: 'AGT-001',
      role: UserRole.COMMERCIAL_AGENT,
      isActive: true,
      createdAt: new Date('2026-09-01'),
      parentAgent: null,
      subAgents: [
        {
          id: BigInt(20),
          name: 'Siddharth',
          email: 'siddharth@ongc.co.in',
          phone: '9016651453',
          staffId: 'SUB-001',
          isActive: true,
          allocations: [{ allocatedQuantity: 10, bookedQuantity: 2, subAllocatedQuantity: 0 }],
          _count: { agentOrders: 2 },
        },
      ],
      allocations: [
        {
          id: BigInt(1),
          passType: 'COMMERCIAL_DAILY',
          allocatedQuantity: 100,
          bookedQuantity: 20,
          subAllocatedQuantity: 10,
        },
      ],
      agentOrders: [
        {
          id: BigInt(500),
          orderNumber: 'ORD-COMM-123',
          customerName: 'Rahul Patel',
          customerMobile: '9876543210',
          ticketType: 'COMMERCIAL_DAILY',
          quantity: 2,
          amountPaise: 49800,
          orderStatus: OrderStatus.PAID,
          paymentMode: 'OFFLINE',
          _count: { attendees: 2 },
          createdAt: new Date(),
        },
      ],
    });

    const details = await service.getAgentDetailsAdmin(BigInt(10));
    expect(details.name).toBe('Dhaval Shah');
    expect(details.subAgents.length).toBe(1);
    expect(details.allocations[0].availableQuantity).toBe(70);
    expect(details.summary.totalSalesInr).toBe(498);
    expect(details.recentOrders.length).toBe(1);
  });
});

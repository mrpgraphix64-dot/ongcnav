import { Test, TestingModule } from '@nestjs/testing';
import { StaffService } from './staff.service';
import { CommercialAgentService } from '../commercial/commercial-agent.service';
import { CommercialService } from '../commercial/commercial.service';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, OrderStatus } from '@ongc/shared-types';
import { BadRequestException, ForbiddenException, ConflictException, NotFoundException } from '@nestjs/common';

describe('SUPER_ADMIN Full Control & Authorization Regression Tests (23 Scenarios)', () => {
  let staffService: StaffService;
  let agentService: CommercialAgentService;
  let prisma: any;

  const mockSystemArchive = {
    id: BigInt(999999),
    email: 'system-archive@ongc.internal',
    name: 'Archived System Actor',
    staffId: 'SYS-ARCHIVE',
    role: UserRole.GATE_OPERATOR,
    isActive: false,
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn().mockImplementation((args) => {
          if (args?.where?.email === 'system-archive@ongc.internal') {
            return Promise.resolve(mockSystemArchive);
          }
          return Promise.resolve(null);
        }),
        findMany: jest.fn(),
        count: jest.fn().mockResolvedValue(2),
        create: jest.fn().mockResolvedValue(mockSystemArchive),
        update: jest.fn().mockImplementation(({ where, data }) =>
          Promise.resolve({ id: where.id, ...data }),
        ),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        delete: jest.fn().mockImplementation(({ where }) =>
          Promise.resolve({ id: where.id }),
        ),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        upsert: jest.fn().mockResolvedValue(mockSystemArchive),
      },
      gateUser: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      commercialOrder: {
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
      },
      agentAllocation: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
        create: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      allocationEvent: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      incident: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      attendee: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      dailyCheckin: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      scanLog: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      $transaction: jest.fn().mockImplementation(async (cb) => cb(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StaffService,
        CommercialAgentService,
        { provide: CommercialService, useValue: {} },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    staffService = module.get<StaffService>(StaffService);
    agentService = module.get<CommercialAgentService>(CommercialAgentService);
  });

  // =========================================================================
  // 1-7: SUPER_ADMIN DELETIONS & OVERRIDES
  // =========================================================================
  describe('1-7: SUPER_ADMIN Administrative Deletions & Overrides', () => {
    it('1. SUPER_ADMIN can delete staff with no operational dependencies', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: BigInt(101),
        name: 'Clean Scanner',
        role: UserRole.SCANNER_STAFF,
        gateUsers: [],
        subAgents: [],
        allocations: [],
        givenAllocations: [],
        agentOrders: [],
        scannedCheckins: [],
        scannedLogs: [],
        reportedIncidents: [],
        resolvedIncidents: [],
      });

      const superAdmin = { id: BigInt(1), role: UserRole.SUPER_ADMIN };
      const res = await staffService.deleteStaff(BigInt(101), superAdmin);

      expect(res.message).toContain("Staff member 'Clean Scanner' deleted successfully.");
      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: BigInt(101) } });
    });

    it('2. SUPER_ADMIN can delete staff with allocations (reassigns to system-archive)', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: BigInt(102),
        name: 'Allocated Staff',
        email: 'staff102@ongc.internal',
        staffId: 'STF-102',
        role: UserRole.SCANNER_STAFF,
        gateUsers: [],
        subAgents: [],
        allocations: [{ id: BigInt(1), passType: 'COMMERCIAL_DAILY', allocatedQuantity: 50, bookedQuantity: 10 }],
        givenAllocations: [],
        agentOrders: [],
        scannedCheckins: [],
        scannedLogs: [],
        reportedIncidents: [],
        resolvedIncidents: [],
      });

      const superAdmin = { id: BigInt(1), role: UserRole.SUPER_ADMIN };
      const res = await staffService.deleteStaff(BigInt(102), superAdmin);

      expect(res.message).toContain("Staff member 'Allocated Staff' deleted successfully.");
      expect(prisma.user.findFirst).toHaveBeenCalledWith({ where: { email: 'system-archive@ongc.internal' } });
      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: BigInt(102) } });
    });

    it('3. SUPER_ADMIN can delete Commercial Agent with booked orders/tickets (snapshots metadata)', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: BigInt(103),
        name: 'Active Agent',
        email: 'agent103@ongc.internal',
        staffId: 'AGT-103',
        role: UserRole.COMMERCIAL_AGENT,
        subAgents: [],
        agentOrders: [
          {
            id: BigInt(501),
            orderNumber: 'ORD-001',
            metadata: { existingKey: 'val' },
          },
        ],
        allocations: [],
        givenAllocations: [],
        allocationEventsPerformed: [],
        scannedLogs: [],
        scannedCheckins: [],
      });

      const res = await agentService.deleteAgentAdmin(BigInt(1), BigInt(103), UserRole.SUPER_ADMIN);

      expect(res.message).toContain("Agent 'Active Agent' deleted successfully.");
      expect(prisma.commercialOrder.update).toHaveBeenCalledWith({
        where: { id: BigInt(501) },
        data: expect.objectContaining({
          agentId: null,
          metadata: expect.objectContaining({
            originalAgent: expect.objectContaining({
              id: '103',
              name: 'Active Agent',
            }),
          }),
        }),
      });
      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: BigInt(103) } });
    });

    it('4. SUPER_ADMIN can delete Agent/Staff with check-in and scan history (scans preserved)', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: BigInt(104),
        name: 'Scanner Hero',
        email: 'hero@ongc.internal',
        staffId: 'SCN-104',
        role: UserRole.SCANNER_STAFF,
        gateUsers: [],
        subAgents: [],
        allocations: [],
        givenAllocations: [],
        agentOrders: [],
        scannedCheckins: [{ id: BigInt(1) }],
        scannedLogs: [{ id: BigInt(2) }],
        reportedIncidents: [],
        resolvedIncidents: [],
      });

      const superAdmin = { id: BigInt(1), role: UserRole.SUPER_ADMIN };
      const res = await staffService.deleteStaff(BigInt(104), superAdmin);

      expect(res.message).toContain("Staff member 'Scanner Hero' deleted successfully.");
      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: BigInt(104) } });
    });

    it('5. SUPER_ADMIN can delete staff with audit logs (junction safely handled)', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: BigInt(105),
        name: 'Audited Staff',
        email: 'audit@ongc.internal',
        staffId: 'AUD-105',
        role: UserRole.REGISTRATION_STAFF,
        gateUsers: [],
        subAgents: [],
        allocations: [],
        givenAllocations: [],
        agentOrders: [],
        scannedCheckins: [],
        scannedLogs: [],
        reportedIncidents: [],
        resolvedIncidents: [],
      });

      const superAdmin = { id: BigInt(1), role: UserRole.SUPER_ADMIN };
      const res = await staffService.deleteStaff(BigInt(105), superAdmin);

      expect(res.message).toContain("Staff member 'Audited Staff' deleted successfully.");
      expect(prisma.auditLog.deleteMany).toHaveBeenCalledWith({ where: { userId: BigInt(105) } });
      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: BigInt(105) } });
    });

    it('6. SUPER_ADMIN can delete Master Agent with sub-agents (converts sub-agents to independent master agents and logs audit)', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: BigInt(106),
        name: 'Master Agent',
        email: 'master@ongc.internal',
        staffId: 'MST-106',
        role: UserRole.COMMERCIAL_AGENT,
        subAgents: [
          { id: BigInt(201), name: 'Sub 1', email: 'sub1@ongc.internal', staffId: 'SUB-201', role: UserRole.COMMERCIAL_SUB_AGENT },
          { id: BigInt(202), name: 'Sub 2', email: 'sub2@ongc.internal', staffId: 'SUB-202', role: UserRole.COMMERCIAL_SUB_AGENT },
        ],
        agentOrders: [],
        allocations: [],
        givenAllocations: [],
        allocationEventsPerformed: [],
        scannedLogs: [],
        scannedCheckins: [],
      });

      const res = await agentService.deleteAgentAdmin(BigInt(1), BigInt(106), UserRole.SUPER_ADMIN);

      expect(res.message).toContain("Agent 'Master Agent' deleted successfully.");
      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { parentAgentId: BigInt(106) },
        data: {
          role: UserRole.COMMERCIAL_AGENT,
          parentAgentId: null,
        },
      });
      // Verifies audit log created for each converted sub-agent
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: BigInt(201),
          action: 'SUB_AGENT_CONVERTED_TO_MASTER',
          details: expect.objectContaining({
            subAgentId: '201',
            newRole: UserRole.COMMERCIAL_AGENT,
            previousParentAgentId: '106',
            inventoryPreserved: true,
            allocationsPreserved: true,
            ticketsPreserved: true,
            bookingsPreserved: true,
          }),
        }),
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: BigInt(202),
          action: 'SUB_AGENT_CONVERTED_TO_MASTER',
          details: expect.objectContaining({
            subAgentId: '202',
            newRole: UserRole.COMMERCIAL_AGENT,
            previousParentAgentId: '106',
            inventoryPreserved: true,
            allocationsPreserved: true,
            ticketsPreserved: true,
            bookingsPreserved: true,
          }),
        }),
      });
      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: BigInt(106) } });
    });

    it('7. Bulk deletion of mixed staff by SUPER_ADMIN deletes targets and protects current SUPER_ADMIN', async () => {
      prisma.user.findMany.mockResolvedValue([
        {
          id: BigInt(1),
          name: 'Super Admin',
          email: 'super@ongc.internal',
          role: UserRole.SUPER_ADMIN,
        },
        {
          id: BigInt(201),
          name: 'Staff A',
          email: 'staffA@ongc.internal',
          role: UserRole.SCANNER_STAFF,
          gateUsers: [],
          subAgents: [],
          allocations: [],
          givenAllocations: [],
          agentOrders: [],
          scannedCheckins: [],
          scannedLogs: [],
          reportedIncidents: [],
          resolvedIncidents: [],
        },
        {
          id: BigInt(202),
          name: 'Staff B',
          email: 'staffB@ongc.internal',
          role: UserRole.REGISTRATION_STAFF,
          gateUsers: [],
          subAgents: [],
          allocations: [],
          givenAllocations: [],
          agentOrders: [],
          scannedCheckins: [],
          scannedLogs: [],
          reportedIncidents: [],
          resolvedIncidents: [],
        },
      ]);

      const superAdmin = { id: BigInt(1), role: UserRole.SUPER_ADMIN };
      const res = await staffService.bulkDeleteStaff([BigInt(1), BigInt(201), BigInt(202)], superAdmin);

      expect(res.deletedCount).toBe(2);
      expect(res.protectedCount).toBe(1);
      expect(res.protectedStaff[0].reason).toContain('Your current SUPER_ADMIN account is protected from deletion.');
      expect(prisma.user.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: [BigInt(201), BigInt(202)] } },
      });
    });
  });

  // =========================================================================
  // 8-12: SUPER_ADMIN PROTECTIONS & SINGLETON CONSTRAINTS
  // =========================================================================
  describe('8-12: SUPER_ADMIN Self-Protection & Singleton Constraints', () => {
    it('8. SUPER_ADMIN cannot delete own account (HTTP 403 ForbiddenException)', async () => {
      const superAdmin = { id: BigInt(1), role: UserRole.SUPER_ADMIN };
      await expect(staffService.deleteStaff(BigInt(1), superAdmin)).rejects.toThrow(
        new ForbiddenException('You cannot delete your own SUPER_ADMIN account.'),
      );
    });

    it('9. SUPER_ADMIN cannot deactivate own account (HTTP 403 ForbiddenException)', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: BigInt(1),
        name: 'Super Admin',
        role: UserRole.SUPER_ADMIN,
        isActive: true,
      });

      const superAdmin = { id: BigInt(1), role: UserRole.SUPER_ADMIN };
      await expect(staffService.toggleStatus(BigInt(1), superAdmin)).rejects.toThrow(
        new ForbiddenException('You cannot deactivate your own SUPER_ADMIN account.'),
      );
    });

    it('10. SUPER_ADMIN role cannot be demoted or changed (HTTP 403 ForbiddenException)', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: BigInt(1),
        name: 'Super Admin',
        role: UserRole.SUPER_ADMIN,
        isActive: true,
      });

      const superAdmin = { id: BigInt(1), role: UserRole.SUPER_ADMIN };
      await expect(
        staffService.update(BigInt(1), { role: UserRole.EVENT_ADMIN } as any, superAdmin),
      ).rejects.toThrow(
        new ForbiddenException('The SUPER_ADMIN role cannot be changed or demoted.'),
      );
    });

    it('11. Cannot create a second active SUPER_ADMIN account (HTTP 409 ConflictException)', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: BigInt(1),
        role: UserRole.SUPER_ADMIN,
      });

      const createDto = {
        name: 'Duplicate Super Admin',
        email: 'duplicate@ongc.internal',
        password: 'Password@2026',
        role: UserRole.SUPER_ADMIN,
      };

      await expect(staffService.create(createDto as any)).rejects.toThrow(
        new ConflictException('A SUPER_ADMIN account already exists. Only one SUPER_ADMIN is permitted.'),
      );
    });

    it('12. Cannot promote another staff/user to SUPER_ADMIN while one exists (HTTP 409 ConflictException)', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: BigInt(50),
        name: 'Event Admin',
        role: UserRole.EVENT_ADMIN,
        isActive: true,
      });
      prisma.user.findFirst.mockResolvedValue({
        id: BigInt(1),
        role: UserRole.SUPER_ADMIN,
      });

      const superAdmin = { id: BigInt(1), role: UserRole.SUPER_ADMIN };
      await expect(
        staffService.update(BigInt(50), { role: UserRole.SUPER_ADMIN } as any, superAdmin),
      ).rejects.toThrow(
        new ConflictException('A SUPER_ADMIN account already exists. Only one SUPER_ADMIN is permitted.'),
      );
    });
  });

  // =========================================================================
  // 13-18: DOMAIN ISOLATION & NON-SUPER_ADMIN RESTRICTIONS
  // =========================================================================
  describe('13-18: Domain Isolation & Non-SUPER_ADMIN Restrictions', () => {
    it('13. Commercial Admin cannot delete Employee domain staff/admin', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: BigInt(301),
        name: 'Employee Admin User',
        role: UserRole.EMPLOYEE_ADMIN,
        gateUsers: [],
        subAgents: [],
        allocations: [],
        givenAllocations: [],
        agentOrders: [],
        scannedCheckins: [],
        scannedLogs: [],
        reportedIncidents: [],
        resolvedIncidents: [],
      });

      const commercialAdmin = { id: BigInt(50), role: UserRole.COMMERCIAL_ADMIN };
      await expect(staffService.deleteStaff(BigInt(301), commercialAdmin)).rejects.toThrow(
        new ForbiddenException('Commercial Admin cannot delete administrators outside their domain.'),
      );
    });

    it('14. Employee Admin cannot delete Commercial domain staff/agent', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: BigInt(302),
        name: 'Commercial Agent User',
        role: UserRole.COMMERCIAL_AGENT,
        gateUsers: [],
        subAgents: [],
        allocations: [],
        givenAllocations: [],
        agentOrders: [],
        scannedCheckins: [],
        scannedLogs: [],
        reportedIncidents: [],
        resolvedIncidents: [],
      });

      const employeeAdmin = { id: BigInt(60), role: UserRole.EMPLOYEE_ADMIN };
      await expect(staffService.deleteStaff(BigInt(302), employeeAdmin)).rejects.toThrow(
        new ForbiddenException('Employee Admin cannot delete administrators or agents outside their domain.'),
      );
    });

    it('15. Commercial Agent cannot delete other agents or staff', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: BigInt(303),
        name: 'Peer Agent',
        role: UserRole.COMMERCIAL_AGENT,
        gateUsers: [],
        subAgents: [],
        allocations: [],
        givenAllocations: [],
        agentOrders: [],
        scannedCheckins: [],
        scannedLogs: [],
        reportedIncidents: [],
        resolvedIncidents: [],
      });

      const agentCaller = { id: BigInt(70), role: UserRole.COMMERCIAL_AGENT };
      await expect(staffService.deleteStaff(BigInt(303), agentCaller)).rejects.toThrow(
        new ForbiddenException('You do not have permission to delete staff members.'),
      );
    });

    it('16. Sub-agent cannot delete parent agent', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: BigInt(304),
        name: 'Parent Master Agent',
        role: UserRole.COMMERCIAL_AGENT,
        gateUsers: [],
        subAgents: [],
        allocations: [],
        givenAllocations: [],
        agentOrders: [],
        scannedCheckins: [],
        scannedLogs: [],
        reportedIncidents: [],
        resolvedIncidents: [],
      });

      const subAgentCaller = { id: BigInt(80), role: UserRole.COMMERCIAL_SUB_AGENT };
      await expect(staffService.deleteStaff(BigInt(304), subAgentCaller)).rejects.toThrow(
        new ForbiddenException('You do not have permission to delete staff members.'),
      );
    });

    it('17. Sub-agent cannot delete other sub-agents', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: BigInt(305),
        name: 'Peer Sub Agent',
        role: UserRole.COMMERCIAL_SUB_AGENT,
        gateUsers: [],
        subAgents: [],
        allocations: [],
        givenAllocations: [],
        agentOrders: [],
        scannedCheckins: [],
        scannedLogs: [],
        reportedIncidents: [],
        resolvedIncidents: [],
      });

      const subAgentCaller = { id: BigInt(80), role: UserRole.COMMERCIAL_SUB_AGENT };
      await expect(staffService.deleteStaff(BigInt(305), subAgentCaller)).rejects.toThrow(
        new ForbiddenException('You do not have permission to delete staff members.'),
      );
    });

    it('18. Non-SUPER_ADMIN cannot bypass operational dependency restrictions (blocks on linked records)', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: BigInt(306),
        name: 'Operator with Scans',
        role: UserRole.SCANNER_STAFF,
        gateUsers: [],
        subAgents: [],
        allocations: [],
        givenAllocations: [],
        agentOrders: [],
        scannedCheckins: [],
        scannedLogs: [{ id: BigInt(99) }],
        reportedIncidents: [],
        resolvedIncidents: [],
      });

      const eventAdmin = { id: BigInt(2), role: UserRole.EVENT_ADMIN };
      await expect(staffService.deleteStaff(BigInt(306), eventAdmin)).rejects.toThrow(
        new BadRequestException(
          'This staff account has linked operational records and cannot be permanently deleted. Deactivate the account instead.',
        ),
      );
    });
  });

  // =========================================================================
  // 19-23: HISTORICAL BUSINESS DATA INTEGRITY PRESERVATION
  // =========================================================================
  describe('19-23: Historical Business Data Integrity Preservation', () => {
    it('19. Deleting an agent preserves historical tickets and attendee records', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: BigInt(401),
        name: 'Historical Agent',
        email: 'hist@ongc.internal',
        staffId: 'AGT-401',
        role: UserRole.COMMERCIAL_AGENT,
        subAgents: [],
        agentOrders: [
          {
            id: BigInt(801),
            orderNumber: 'ORD-HIST-01',
            metadata: {},
          },
        ],
        allocations: [],
        givenAllocations: [],
        allocationEventsPerformed: [],
        scannedLogs: [],
        scannedCheckins: [],
      });

      await agentService.deleteAgentAdmin(BigInt(1), BigInt(401), UserRole.SUPER_ADMIN);

      // Verify commercialOrder is updated with snapshot and not deleted
      expect(prisma.commercialOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: BigInt(801) },
          data: expect.objectContaining({
            agentId: null,
            metadata: expect.objectContaining({
              originalAgent: expect.objectContaining({ id: '401' }),
            }),
          }),
        }),
      );
      // Prisma user delete is called for agent, but orders/attendees were NOT deleted
      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: BigInt(401) } });
    });

    it('20. Deleting an agent/staff preserves daily check-ins and scan logs', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: BigInt(402),
        name: 'Gate Scanner',
        email: 'scanner402@ongc.internal',
        staffId: 'SCN-402',
        role: UserRole.SCANNER_STAFF,
        gateUsers: [],
        subAgents: [],
        allocations: [],
        givenAllocations: [],
        agentOrders: [],
        scannedCheckins: [{ id: BigInt(901) }],
        scannedLogs: [{ id: BigInt(902) }],
        reportedIncidents: [],
        resolvedIncidents: [],
      });

      const superAdmin = { id: BigInt(1), role: UserRole.SUPER_ADMIN };
      await staffService.deleteStaff(BigInt(402), superAdmin);

      // Verify no checkin or scanLog deletions were invoked
      expect(prisma.dailyCheckin.updateMany).not.toHaveBeenCalled();
      expect(prisma.scanLog.updateMany).not.toHaveBeenCalled();
      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: BigInt(402) } });
    });

    it('21. Deleting an agent preserves orders and payment records with audit snapshot', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: BigInt(403),
        name: 'Agent with Orders',
        email: 'paidagent@ongc.internal',
        staffId: 'AGT-403',
        role: UserRole.COMMERCIAL_AGENT,
        subAgents: [],
        agentOrders: [
          {
            id: BigInt(802),
            orderNumber: 'ORD-PAID-01',
            orderStatus: OrderStatus.PAID,
            metadata: { existingNote: 'paid via cash' },
          },
        ],
        allocations: [],
        givenAllocations: [],
        allocationEventsPerformed: [],
        scannedLogs: [],
        scannedCheckins: [],
      });

      await agentService.deleteAgentAdmin(BigInt(1), BigInt(403), UserRole.SUPER_ADMIN);

      expect(prisma.commercialOrder.update).toHaveBeenCalledWith({
        where: { id: BigInt(802) },
        data: {
          agentId: null,
          metadata: {
            existingNote: 'paid via cash',
            originalAgent: {
              id: '403',
              name: 'Agent with Orders',
              email: 'paidagent@ongc.internal',
              staffId: 'AGT-403',
              role: UserRole.COMMERCIAL_AGENT,
            },
          },
        },
      });
    });

    it('22. Deleting an agent preserves allocation history and allocation events (reassigned to system archive)', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: BigInt(404),
        name: 'Agent with Quota',
        email: 'quota@ongc.internal',
        staffId: 'AGT-404',
        role: UserRole.COMMERCIAL_AGENT,
        subAgents: [],
        agentOrders: [],
        allocations: [
          {
            id: BigInt(701),
            passType: 'COMMERCIAL_DAILY',
            allocatedQuantity: 100,
            bookedQuantity: 25,
            subAllocatedQuantity: 10,
            events: [{ id: BigInt(1) }],
          },
        ],
        givenAllocations: [],
        allocationEventsPerformed: [],
        scannedLogs: [],
        scannedCheckins: [],
      });

      await agentService.deleteAgentAdmin(BigInt(1), BigInt(404), UserRole.SUPER_ADMIN);

      expect(prisma.user.findFirst).toHaveBeenCalledWith({ where: { email: 'system-archive@ongc.internal' } });
      expect(prisma.agentAllocation.update).toHaveBeenCalledWith({
        where: { id: BigInt(701) },
        data: { agentId: mockSystemArchive.id },
      });
      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: BigInt(404) } });
    });

    it('23. Deleting an agent does not delete or corrupt unrelated staff or agent accounts', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: BigInt(405),
        name: 'Isolated Agent',
        email: 'isolated@ongc.internal',
        staffId: 'AGT-405',
        role: UserRole.COMMERCIAL_AGENT,
        subAgents: [],
        agentOrders: [],
        allocations: [],
        givenAllocations: [],
        allocationEventsPerformed: [],
        scannedLogs: [],
        scannedCheckins: [],
      });

      await agentService.deleteAgentAdmin(BigInt(1), BigInt(405), UserRole.SUPER_ADMIN);

      // Verify only target id 405 was deleted
      expect(prisma.user.delete).toHaveBeenCalledTimes(1);
      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: BigInt(405) } });
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { EmployeesService } from './employees.service';
import { PrismaService } from '../prisma/prisma.service';

describe('EmployeesService - getPassSummary', () => {
  let service: EmployeesService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      attendee: {
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<EmployeesService>(EmployeesService);
  });

  it('should return accurate, mathematically reconciled counts excluding isLoadTest: true', async () => {
    // Mock the 7 parallel count queries in getPassSummary:
    // 1. totalPasses = 85
    // 2. websitePasses = 5
    // 3. agentPasses = 1
    // 4. employeePasses = 79
    // 5. freePasses = 0
    // 6. adminPasses = 0
    // 7. checkedInPasses = 30
    prisma.attendee.count
      .mockResolvedValueOnce(85) // total
      .mockResolvedValueOnce(5)  // website
      .mockResolvedValueOnce(1)  // agent
      .mockResolvedValueOnce(79) // employee
      .mockResolvedValueOnce(0)  // free
      .mockResolvedValueOnce(0)  // admin
      .mockResolvedValueOnce(30); // checkedIn

    const result = await service.getPassSummary();

    // Verify all queries enforce isLoadTest: false
    expect(prisma.attendee.count).toHaveBeenCalledTimes(7);
    for (let i = 0; i < 7; i++) {
      const callArg = prisma.attendee.count.mock.calls[i][0];
      expect(callArg.where.isLoadTest).toBe(false);
    }

    // Verify normalized keys match frontend expectations
    expect(result.total).toBe(85);
    expect(result.website).toBe(5);
    expect(result.agent).toBe(1);
    expect(result.employee).toBe(79);
    expect(result.free).toBe(0);
    expect(result.admin).toBe(0);
    expect(result.checkedIn).toBe(30);
    expect(result.notCheckedIn).toBe(55); // 85 - 30

    // Mathematical reconciliation check
    expect(result.website + result.agent + result.employee + result.free + result.admin).toBe(result.total);
    expect(result.checkedIn + result.notCheckedIn).toBe(result.total);

    // Verify backward compatibility aliases
    expect(result.totalPasses).toBe(85);
    expect(result.websitePasses).toBe(5);
    expect(result.agentPasses).toBe(1);
    expect(result.employeePasses).toBe(79);
    expect(result.freePasses).toBe(0);
    expect(result.adminPasses).toBe(0);
    expect(result.checkedInPasses).toBe(30);
    expect(result.notCheckedInPasses).toBe(55);
  });
});

describe('EmployeesService - approveRegistration & bulkApproveRegistrations', () => {
  let service: EmployeesService;
  let prisma: any;

  const mockPendingEmployee = {
    id: BigInt(10),
    name: 'Ramesh Patel',
    cpf: '654321',
    registrationStatus: 'PENDING',
    attendees: [{ id: BigInt(100), status: 'PENDING' }],
  };

  const mockApprovedEmployee = {
    id: BigInt(11),
    name: 'Suresh Kumar',
    cpf: '654322',
    registrationStatus: 'APPROVED',
    attendees: [{ id: BigInt(101), status: 'ACTIVE' }],
  };

  const mockRejectedEmployee = {
    id: BigInt(12),
    name: 'Mahesh Shah',
    cpf: '654323',
    registrationStatus: 'REJECTED',
    attendees: [{ id: BigInt(102), status: 'REVOKED' }],
  };

  beforeEach(async () => {
    prisma = {
      employee: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      attendee: {
        updateMany: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation(async (cb: any) => {
        return cb(prisma);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<EmployeesService>(EmployeesService);
  });

  describe('approveRegistration', () => {
    it('approves a pending employee, updating status to APPROVED and attendees to ACTIVE', async () => {
      prisma.employee.findUnique.mockResolvedValueOnce(mockPendingEmployee);

      const res = await service.approveRegistration(BigInt(10));
      expect(res.success).toBe(true);
      expect(res.message).toContain('approved successfully');

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.employee.update).toHaveBeenCalledWith({
        where: { id: BigInt(10) },
        data: { registrationStatus: 'APPROVED' },
      });
      expect(prisma.attendee.updateMany).toHaveBeenCalledWith({
        where: { employeeId: BigInt(10) },
        data: { status: 'ACTIVE' },
      });
    });

    it('idempotency: already approved employee returns safe response without running transaction updates', async () => {
      prisma.employee.findUnique.mockResolvedValueOnce(mockApprovedEmployee);

      const res = await service.approveRegistration(BigInt(11));
      expect(res.success).toBe(true);
      expect(res.alreadyApproved).toBe(true);
      expect(res.message).toContain('already approved');
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.employee.update).not.toHaveBeenCalled();
    });

    it('rejected employee cannot be approved and throws BadRequestException', async () => {
      prisma.employee.findUnique.mockResolvedValueOnce(mockRejectedEmployee);

      await expect(service.approveRegistration(BigInt(12))).rejects.toThrow(
        'Cannot approve a rejected employee registration.',
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('bulkApproveRegistrations', () => {
    it('mixed approved + pending selection only approves the genuinely pending employee', async () => {
      // Prisma findMany only returns the PENDING employee
      prisma.employee.findMany.mockResolvedValueOnce([mockPendingEmployee]);

      const res = await service.bulkApproveRegistrations([BigInt(10), BigInt(11)]);
      expect(res.success).toBe(true);
      expect(res.count).toBe(1);
      expect(res.message).toContain('Successfully approved 1 employee registration');

      expect(prisma.employee.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [BigInt(10)] } },
        data: { registrationStatus: 'APPROVED' },
      });
      expect(prisma.attendee.updateMany).toHaveBeenCalledWith({
        where: { employeeId: { in: [BigInt(10)] } },
        data: { status: 'ACTIVE' },
      });
    });

    it('idempotency: when all selected employees are already approved, does not execute transaction', async () => {
      prisma.employee.findMany.mockResolvedValueOnce([]); // No pending employees match

      const res = await service.bulkApproveRegistrations([BigInt(11)]);
      expect(res.success).toBe(true);
      expect(res.count).toBe(0);
      expect(res.message).toContain('No eligible pending employees found to approve.');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejected employees are not included in bulk approval', async () => {
      prisma.employee.findMany.mockResolvedValueOnce([]); // Rejected employee is filtered out by where.registrationStatus = PENDING

      const res = await service.bulkApproveRegistrations([BigInt(12)]);
      expect(res.success).toBe(true);
      expect(res.count).toBe(0);
      expect(prisma.employee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            registrationStatus: 'PENDING',
          }),
        }),
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });
});

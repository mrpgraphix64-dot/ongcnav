import { Test, TestingModule } from '@nestjs/testing';
import { StaffService } from './staff.service';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@ongc/shared-types';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

describe('Staff Delete & Safety Tests', () => {
  let service: StaffService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        count: jest.fn().mockResolvedValue(2),
        update: jest.fn().mockResolvedValue({ id: BigInt(5), name: 'Target' }),
        delete: jest.fn().mockResolvedValue({ id: BigInt(5) }),
        upsert: jest.fn().mockResolvedValue({ id: BigInt(999999), email: 'system-archive@ongc.internal' }),
      },
      gateUser: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      auditLog: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: jest.fn().mockImplementation(async (cb) => cb(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StaffService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<StaffService>(StaffService);
  });

  it('prevents self-deletion of currently logged-in account (SUPER_ADMIN)', async () => {
    const caller = { id: BigInt(10), role: UserRole.SUPER_ADMIN };
    await expect(service.deleteStaff(BigInt(10), caller)).rejects.toThrow(
      new ForbiddenException('You cannot delete your own SUPER_ADMIN account.'),
    );
  });

  it('prevents self-deletion of currently logged-in account (other role)', async () => {
    const caller = { id: BigInt(10), role: UserRole.EVENT_ADMIN };
    await expect(service.deleteStaff(BigInt(10), caller)).rejects.toThrow(
      new BadRequestException('You cannot delete your own logged-in account.'),
    );
  });

  it('throws NotFoundException if target staff does not exist', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const caller = { id: BigInt(10), role: UserRole.SUPER_ADMIN };
    await expect(service.deleteStaff(BigInt(99), caller)).rejects.toThrow(NotFoundException);
  });

  it('blocks non-Super Admin from deleting a Super Admin account', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: BigInt(20),
      name: 'Super Admin Target',
      role: UserRole.SUPER_ADMIN,
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

    const caller = { id: BigInt(10), role: UserRole.EVENT_ADMIN };
    await expect(service.deleteStaff(BigInt(20), caller)).rejects.toThrow(
      new BadRequestException('The SUPER_ADMIN account cannot be deleted.'),
    );
  });

  it('prevents deleting the Super Admin account even by Super Admin', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: BigInt(20),
      name: 'Last Super Admin',
      role: UserRole.SUPER_ADMIN,
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

    const caller = { id: BigInt(10), role: UserRole.SUPER_ADMIN };
    await expect(service.deleteStaff(BigInt(20), caller)).rejects.toThrow(
      new BadRequestException('The SUPER_ADMIN account cannot be deleted.'),
    );
  });

  it('enforces domain isolation: Commercial Admin cannot delete Employee Admin', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: BigInt(30),
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

    const caller = { id: BigInt(40), role: UserRole.COMMERCIAL_ADMIN };
    await expect(service.deleteStaff(BigInt(30), caller)).rejects.toThrow(
      new ForbiddenException('Commercial Admin cannot delete administrators outside their domain.'),
    );
  });

  it('enforces domain isolation: Employee Admin cannot delete Commercial Admin', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: BigInt(50),
      name: 'Commercial Admin User',
      role: UserRole.COMMERCIAL_ADMIN,
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

    const caller = { id: BigInt(60), role: UserRole.EMPLOYEE_ADMIN };
    await expect(service.deleteStaff(BigInt(50), caller)).rejects.toThrow(
      new ForbiddenException('Employee Admin cannot delete administrators or agents outside their domain.'),
    );
  });

  it('blocks non-SUPER_ADMIN deletion of staff with linked operational records (e.g. scan logs)', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: BigInt(70),
      name: 'Gate Operator Active',
      role: UserRole.SCANNER_STAFF,
      gateUsers: [{ id: BigInt(1) }],
      subAgents: [],
      allocations: [],
      givenAllocations: [],
      agentOrders: [],
      scannedCheckins: [],
      scannedLogs: [{ id: BigInt(101) }],
      reportedIncidents: [],
      resolvedIncidents: [],
    });

    const caller = { id: BigInt(1), role: UserRole.EVENT_ADMIN };
    await expect(service.deleteStaff(BigInt(70), caller)).rejects.toThrow(
      new BadRequestException(
        'This staff account has linked operational records and cannot be permanently deleted. Deactivate the account instead.',
      ),
    );
  });

  it('allows SUPER_ADMIN deletion of staff with linked operational records (preserves history)', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: BigInt(70),
      name: 'Gate Operator Active',
      role: UserRole.SCANNER_STAFF,
      gateUsers: [{ id: BigInt(1) }],
      subAgents: [],
      allocations: [],
      givenAllocations: [],
      agentOrders: [],
      scannedCheckins: [],
      scannedLogs: [{ id: BigInt(101) }],
      reportedIncidents: [],
      resolvedIncidents: [],
    });

    const caller = { id: BigInt(1), role: UserRole.SUPER_ADMIN };
    const res = await service.deleteStaff(BigInt(70), caller);
    expect(res).toEqual({ message: "Staff member 'Gate Operator Active' deleted successfully." });
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: BigInt(70) } });
  });

  it('allows safe deletion of staff account without operational dependencies', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: BigInt(80),
      name: 'Unused Temporary Staff',
      role: UserRole.SCANNER_STAFF,
      gateUsers: [{ id: BigInt(2) }],
      subAgents: [],
      allocations: [],
      givenAllocations: [],
      agentOrders: [],
      scannedCheckins: [],
      scannedLogs: [],
      reportedIncidents: [],
      resolvedIncidents: [],
    });

    const caller = { id: BigInt(1), role: UserRole.SUPER_ADMIN };
    const res = await service.deleteStaff(BigInt(80), caller);
    expect(res).toEqual({ message: "Staff member 'Unused Temporary Staff' deleted successfully." });
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: BigInt(80) } });
  });

  it('resets password for staff successfully', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: BigInt(80),
      name: 'Staff Member',
      role: UserRole.SCANNER_STAFF,
    });

    const caller = { id: BigInt(1), role: UserRole.SUPER_ADMIN };
    const res = await service.resetPassword(BigInt(80), caller, 'NewSecret@2026');
    expect(res).toEqual({ message: "Password for 'Staff Member' has been reset successfully." });
    expect(prisma.user.update).toHaveBeenCalled();
  });
});

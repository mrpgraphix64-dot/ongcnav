import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { StaffService } from './staff.service';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@ongc/shared-types';

describe('Admin Account Limits & RBAC Safety Tests', () => {
  let service: StaffService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      user: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockImplementation((args) => {
          if (args?.where?.id) {
            return Promise.resolve({
              id: args.where.id,
              name: 'Test Staff',
              email: 'test@ongc.co.in',
              role: UserRole.SCANNER_STAFF,
              isActive: true,
              staffId: 'STF-099',
              createdAt: new Date(),
              updatedAt: new Date(),
              gateUsers: [],
            });
          }
          return Promise.resolve(null);
        }),
        count: jest.fn().mockResolvedValue(10),
        create: jest.fn().mockImplementation((args) => ({
          id: BigInt(99),
          ...args.data,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
        update: jest.fn().mockImplementation((args) => ({
          id: args.where.id,
          ...args.data,
          role: args.data.role || UserRole.SCANNER_STAFF,
          name: args.data.name || 'Test User',
          email: args.data.email || 'test@ongc.co.in',
          isActive: args.data.isActive !== undefined ? args.data.isActive : true,
          staffId: args.data.staffId || 'STF-099',
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      auditLog: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      gateUser: {
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      scanLog: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn().mockImplementation(async (cb) => {
        return cb({
          ...prisma,
          $executeRaw: jest.fn().mockResolvedValue(1),
        });
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StaffService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<StaffService>(StaffService);
  });

  describe('1. E-Pass Admin (COMMERCIAL_ADMIN) Uniqueness', () => {
    it('succeeds in creating the first E-Pass Admin when none exists', async () => {
      // No active COMMERCIAL_ADMIN exists
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.findUnique.mockImplementation((args: any) => {
        if (args?.where?.id) {
          return Promise.resolve({
            id: args.where.id,
            name: 'E-Pass Admin User',
            email: 'epass.admin@ongc.co.in',
            role: UserRole.COMMERCIAL_ADMIN,
            isActive: true,
            staffId: 'STF-011',
            createdAt: new Date(),
            updatedAt: new Date(),
            gateUsers: [],
          });
        }
        return Promise.resolve(null);
      });

      const dto = {
        name: 'E-Pass Admin User',
        email: 'epass.admin@ongc.co.in',
        role: UserRole.COMMERCIAL_ADMIN,
        password: 'SecurePassword123!',
      };

      const caller = { id: BigInt(1), role: UserRole.SUPER_ADMIN };
      const result = await service.create(dto as any, caller);

      expect(result).toBeDefined();
      expect(result.role).toBe(UserRole.COMMERCIAL_ADMIN);
      expect(prisma.user.create).toHaveBeenCalled();
    });

    it('rejects creating a second E-Pass Admin when an active one already exists', async () => {
      // An active COMMERCIAL_ADMIN already exists
      prisma.user.findFirst.mockImplementation((args: any) => {
        if (args?.where?.role === UserRole.COMMERCIAL_ADMIN && args?.where?.isActive === true) {
          return {
            id: BigInt(5),
            name: 'Existing E-Pass Admin',
            role: UserRole.COMMERCIAL_ADMIN,
            isActive: true,
          };
        }
        return null;
      });

      const dto = {
        name: 'Second E-Pass Admin',
        email: 'epass2@ongc.co.in',
        role: UserRole.COMMERCIAL_ADMIN,
        password: 'SecurePassword123!',
      };

      const caller = { id: BigInt(1), role: UserRole.SUPER_ADMIN };
      await expect(service.create(dto as any, caller)).rejects.toThrow(
        new ConflictException('An active E-Pass Admin already exists. Only one active E-Pass Admin is permitted.'),
      );
    });

    it('rejects concurrent E-Pass Admin creation when transaction detects race condition', async () => {
      // Initial check passes, but inside transaction concurrentCheck fails or P2002 throws
      prisma.user.findFirst
        .mockResolvedValueOnce(null) // email check
        .mockResolvedValueOnce(null) // pre-tx admin check
        .mockResolvedValueOnce({
          id: BigInt(7),
          name: 'Concurrent Winner',
          role: UserRole.COMMERCIAL_ADMIN,
          isActive: true,
        }); // in-tx concurrentCheck

      const dto = {
        name: 'Concurrent E-Pass Admin',
        email: 'concurrent.epass@ongc.co.in',
        role: UserRole.COMMERCIAL_ADMIN,
        password: 'SecurePassword123!',
      };

      const caller = { id: BigInt(1), role: UserRole.SUPER_ADMIN };
      await expect(service.create(dto as any, caller)).rejects.toThrow(
        new ConflictException('An active E-Pass Admin already exists. Only one active E-Pass Admin is permitted.'),
      );
    });

    it('catches database unique partial index violation (P2002) for E-Pass Admin and maps to ConflictException', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockRejectedValue({
        code: 'P2002',
        message: 'Unique constraint failed on the fields: (unique_active_commercial_admin)',
      });

      const dto = {
        name: 'Race Winner E-Pass',
        email: 'race.epass@ongc.co.in',
        role: UserRole.COMMERCIAL_ADMIN,
        password: 'SecurePassword123!',
      };

      const caller = { id: BigInt(1), role: UserRole.SUPER_ADMIN };
      await expect(service.create(dto as any, caller)).rejects.toThrow(
        new ConflictException('An active E-Pass Admin already exists. Only one active E-Pass Admin is permitted.'),
      );
    });
  });

  describe('2. Employee Admin (EMPLOYEE_ADMIN) Uniqueness', () => {
    it('succeeds in creating the first Employee Admin when none exists', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.findUnique.mockImplementation((args: any) => {
        if (args?.where?.id) {
          return Promise.resolve({
            id: args.where.id,
            name: 'Employee Admin User',
            email: 'emp.admin@ongc.co.in',
            role: UserRole.EMPLOYEE_ADMIN,
            isActive: true,
            staffId: 'STF-012',
            createdAt: new Date(),
            updatedAt: new Date(),
            gateUsers: [],
          });
        }
        return Promise.resolve(null);
      });

      const dto = {
        name: 'Employee Admin User',
        email: 'emp.admin@ongc.co.in',
        role: UserRole.EMPLOYEE_ADMIN,
        password: 'SecurePassword123!',
      };

      const caller = { id: BigInt(1), role: UserRole.SUPER_ADMIN };
      const result = await service.create(dto as any, caller);

      expect(result).toBeDefined();
      expect(result.role).toBe(UserRole.EMPLOYEE_ADMIN);
      expect(prisma.user.create).toHaveBeenCalled();
    });

    it('rejects creating a second Employee Admin when an active one already exists', async () => {
      prisma.user.findFirst.mockImplementation((args: any) => {
        if (args?.where?.role === UserRole.EMPLOYEE_ADMIN && args?.where?.isActive === true) {
          return {
            id: BigInt(6),
            name: 'Existing Employee Admin',
            role: UserRole.EMPLOYEE_ADMIN,
            isActive: true,
          };
        }
        return null;
      });

      const dto = {
        name: 'Second Employee Admin',
        email: 'emp2@ongc.co.in',
        role: UserRole.EMPLOYEE_ADMIN,
        password: 'SecurePassword123!',
      };

      const caller = { id: BigInt(1), role: UserRole.SUPER_ADMIN };
      await expect(service.create(dto as any, caller)).rejects.toThrow(
        new ConflictException('An active Employee Admin already exists. Only one active Employee Admin is permitted.'),
      );
    });

    it('rejects promoting an existing user to Employee Admin when one already exists', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: BigInt(15),
        name: 'Scanner Staff Member',
        role: UserRole.SCANNER_STAFF,
        isActive: true,
      });

      prisma.user.findFirst.mockImplementation((args: any) => {
        if (args?.where?.role === UserRole.EMPLOYEE_ADMIN && args?.where?.isActive === true) {
          return {
            id: BigInt(6),
            name: 'Existing Employee Admin',
            role: UserRole.EMPLOYEE_ADMIN,
            isActive: true,
          };
        }
        return null;
      });

      const caller = { id: BigInt(1), role: UserRole.SUPER_ADMIN };
      await expect(
        service.update(BigInt(15), { role: UserRole.EMPLOYEE_ADMIN } as any, caller),
      ).rejects.toThrow(
        new ConflictException('An active Employee Admin already exists. Only one active Employee Admin is permitted.'),
      );
    });

    it('rejects activating an inactive Employee Admin via toggleStatus when another active one exists', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: BigInt(18),
        name: 'Inactive Employee Admin',
        role: UserRole.EMPLOYEE_ADMIN,
        isActive: false,
      });

      prisma.user.findFirst.mockResolvedValue({
        id: BigInt(6),
        name: 'Active Employee Admin',
        role: UserRole.EMPLOYEE_ADMIN,
        isActive: true,
      });

      await expect(service.toggleStatus(BigInt(18))).rejects.toThrow(
        new ConflictException('An active Employee Admin already exists. Only one active Employee Admin is permitted.'),
      );
    });
  });

  describe('3. Super Admin Authority & Creation Authorization', () => {
    it('blocks non-Super Admin from creating an E-Pass Admin or Employee Admin', async () => {
      const dto = {
        name: 'Attempted E-Pass Admin',
        email: 'attempt@ongc.co.in',
        role: UserRole.COMMERCIAL_ADMIN,
      };

      const caller = { id: BigInt(2), role: UserRole.EVENT_ADMIN };
      await expect(service.create(dto as any, caller)).rejects.toThrow(
        new ForbiddenException('Only a Super Admin can create domain administrator accounts.'),
      );
    });

    it('blocks non-Super Admin from promoting a user to Employee Admin', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: BigInt(22),
        name: 'Regular Staff',
        role: UserRole.SCANNER_STAFF,
        isActive: true,
      });

      const caller = { id: BigInt(2), role: UserRole.EVENT_ADMIN };
      await expect(
        service.update(BigInt(22), { role: UserRole.EMPLOYEE_ADMIN } as any, caller),
      ).rejects.toThrow(
        new ForbiddenException('Only a Super Admin can promote a user to domain administrator.'),
      );
    });
  });

  describe('4. Self-Update & Password Security Tests', () => {
    it('allows an existing E-Pass Admin to be updated (self-update) without 409 conflict', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: BigInt(10),
        name: 'Existing E-Pass Admin',
        email: 'epass@ongc.co.in',
        role: UserRole.COMMERCIAL_ADMIN,
        isActive: true,
        staffId: 'STF-010',
        gateUsers: [],
      });

      // findFirst checking for OTHER active domain admins returns null because ID 10 is excluded
      prisma.user.findFirst.mockResolvedValue(null);

      const caller = { id: BigInt(1), role: UserRole.SUPER_ADMIN };
      const res = await service.update(
        BigInt(10),
        { name: 'Updated E-Pass Admin Name', role: UserRole.COMMERCIAL_ADMIN } as any,
        caller,
      );

      expect(res).toBeDefined();
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: BigInt(10) },
          data: expect.objectContaining({ name: 'Updated E-Pass Admin Name' }),
        }),
      );
    });

    it('allows an existing Employee Admin to be updated (self-update) without 409 conflict', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: BigInt(6),
        name: 'Existing Employee Admin',
        email: 'employee.admin@ongc.co.in',
        role: UserRole.EMPLOYEE_ADMIN,
        isActive: true,
        staffId: 'STF-006',
        gateUsers: [],
      });

      prisma.user.findFirst.mockResolvedValue(null);

      const caller = { id: BigInt(1), role: UserRole.SUPER_ADMIN };
      const res = await service.update(
        BigInt(6),
        { name: 'Updated Employee Admin Name', role: UserRole.EMPLOYEE_ADMIN } as any,
        caller,
      );

      expect(res).toBeDefined();
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: BigInt(6) },
          data: expect.objectContaining({ name: 'Updated Employee Admin Name' }),
        }),
      );
    });

    it('does not overwrite password if password field is omitted or empty string', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: BigInt(10),
        name: 'Existing E-Pass Admin',
        email: 'epass@ongc.co.in',
        role: UserRole.COMMERCIAL_ADMIN,
        isActive: true,
        staffId: 'STF-010',
        password: '$2b$10$existinghashedpassword',
        gateUsers: [],
      });
      prisma.user.findFirst.mockResolvedValue(null);

      await service.update(BigInt(10), { name: 'E-Pass Admin', password: '' } as any);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: BigInt(10) },
          data: expect.not.objectContaining({ password: expect.anything() }),
        }),
      );
    });

    it('never exposes password or passwordHash in returned staff object', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: BigInt(10),
        name: 'Existing E-Pass Admin',
        email: 'epass@ongc.co.in',
        role: UserRole.COMMERCIAL_ADMIN,
        isActive: true,
        staffId: 'STF-010',
        password: '$2b$10$supersecretpasswordhash',
        gateUsers: [],
      });

      const res: any = await service.findOne(BigInt(10));
      expect(res.password).toBeUndefined();
      expect(res.passwordHash).toBeUndefined();
    });
  });

  describe('5. SUPER_ADMIN Single Protected Account Rules', () => {
    it('rejects creating a second SUPER_ADMIN when one exists', async () => {
      prisma.user.findFirst.mockResolvedValueOnce({
        id: BigInt(1),
        name: 'Existing Super Admin',
        role: UserRole.SUPER_ADMIN,
        isActive: true,
      });

      const dto = {
        name: 'New Super Admin',
        email: 'super2@ongc.co.in',
        role: UserRole.SUPER_ADMIN,
        password: 'Password123!',
      };

      const caller = { id: BigInt(1), role: UserRole.SUPER_ADMIN };
      await expect(service.create(dto as any, caller)).rejects.toThrow(
        new ConflictException('A SUPER_ADMIN account already exists. Only one SUPER_ADMIN is permitted.'),
      );
    });

    it('rejects promoting an existing staff to SUPER_ADMIN when one already exists', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        id: BigInt(5),
        name: 'Regular Staff',
        email: 'staff@ongc.co.in',
        role: UserRole.SCANNER_STAFF,
        isActive: true,
      });

      prisma.user.findFirst.mockResolvedValueOnce({
        id: BigInt(1),
        name: 'Existing Super Admin',
        role: UserRole.SUPER_ADMIN,
        isActive: true,
      });

      const caller = { id: BigInt(1), role: UserRole.SUPER_ADMIN };
      await expect(
        service.update(BigInt(5), { role: UserRole.SUPER_ADMIN } as any, caller),
      ).rejects.toThrow(
        new ConflictException('A SUPER_ADMIN account already exists. Only one SUPER_ADMIN is permitted.'),
      );
    });

    it('rejects changing/demoting the role of existing SUPER_ADMIN', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        id: BigInt(1),
        name: 'Existing Super Admin',
        email: 'super@ongc.co.in',
        role: UserRole.SUPER_ADMIN,
        isActive: true,
      });

      const caller = { id: BigInt(1), role: UserRole.SUPER_ADMIN };
      await expect(
        service.update(BigInt(1), { role: UserRole.EVENT_ADMIN } as any, caller),
      ).rejects.toThrow(
        new ForbiddenException('The SUPER_ADMIN role cannot be changed or demoted.'),
      );
    });

    it('rejects deactivating the SUPER_ADMIN account via update', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        id: BigInt(1),
        name: 'Existing Super Admin',
        email: 'super@ongc.co.in',
        role: UserRole.SUPER_ADMIN,
        isActive: true,
      });

      const caller = { id: BigInt(1), role: UserRole.SUPER_ADMIN };
      await expect(
        service.update(BigInt(1), { isActive: false } as any, caller),
      ).rejects.toThrow(
        new ForbiddenException('You cannot deactivate your own SUPER_ADMIN account.'),
      );
    });

    it('rejects deactivating the SUPER_ADMIN account via toggleStatus', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        id: BigInt(1),
        name: 'Existing Super Admin',
        email: 'super@ongc.co.in',
        role: UserRole.SUPER_ADMIN,
        isActive: true,
      });

      await expect(service.toggleStatus(BigInt(1))).rejects.toThrow(
        new ForbiddenException('The SUPER_ADMIN account cannot be deactivated.'),
      );
    });

    it('rejects deleting the SUPER_ADMIN account', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        id: BigInt(1),
        name: 'Existing Super Admin',
        email: 'super@ongc.co.in',
        role: UserRole.SUPER_ADMIN,
        isActive: true,
      });

      const caller = { id: BigInt(99), role: UserRole.SUPER_ADMIN };
      await expect(service.deleteStaff(BigInt(1), caller)).rejects.toThrow(
        new BadRequestException('The SUPER_ADMIN account cannot be deleted.'),
      );
    });

    it('bulk delete protects SUPER_ADMIN and reports clear message', async () => {
      prisma.user.findMany.mockResolvedValueOnce([
        {
          id: BigInt(1),
          name: 'Super Admin User',
          email: 'super@ongc.co.in',
          role: UserRole.SUPER_ADMIN,
          isActive: true,
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
          id: BigInt(20),
          name: 'Temporary Staff',
          email: 'temp@ongc.co.in',
          role: UserRole.SCANNER_STAFF,
          isActive: true,
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

      const caller = { id: BigInt(99), role: UserRole.SUPER_ADMIN };
      const result = await service.bulkDeleteStaff([BigInt(1), BigInt(20)], caller);

      expect(result.deletedCount).toBe(1);
      expect(result.protectedCount).toBe(1);
      expect(result.deletedStaff).toEqual(['20']);
      expect(result.protectedStaff[0].reason).toBe('SUPER_ADMIN cannot be deleted.');
    });
  });
});

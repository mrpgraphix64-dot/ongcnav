import { Test, TestingModule } from '@nestjs/testing';
import { StaffService } from './staff.service';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@ongc/shared-types';
import { ConflictException, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

describe('StaffService Parity & Functional Tests', () => {
  let service: StaffService;
  let prisma: any;

  const mockUser = {
    id: BigInt(1),
    name: 'Rahul Sharma',
    email: 'rahul@ongc.co.in',
    phone: '9876543210',
    staffId: 'STF-001',
    role: UserRole.SCANNER_STAFF,
    password: 'hashed-password-123',
    isActive: true,
    createdAt: new Date('2026-09-24T10:00:00Z'),
    updatedAt: new Date('2026-09-24T10:00:00Z'),
    gateUsers: [
      {
        id: BigInt(10),
        gate: {
            id: BigInt(2),
            name: 'North Gate',
            gateNumber: 'G-02',
            gateType: 'REGULAR',
            isOpen: true,
          },
      },
    ],
  };

  const mockSuperAdmin = {
    ...mockUser,
    id: BigInt(99),
    name: 'Super Admin',
    email: 'superadmin@ongc.co.in',
    role: UserRole.SUPER_ADMIN,
    staffId: 'SUPER-001',
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn().mockImplementation(async (cb) => cb(prisma)),
      user: {
        findMany: jest.fn().mockResolvedValue([mockUser]),
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id === BigInt(1)) return Promise.resolve(mockUser);
          if (where.id === BigInt(99)) return Promise.resolve(mockSuperAdmin);
          if (where.id === BigInt(6)) {
            return Promise.resolve({
              ...mockUser,
              id: BigInt(6),
              name: 'New Operator',
              email: 'newop@ongc.co.in',
              staffId: 'STF-006',
            });
          }
          if (where.id === BigInt(7)) {
            return Promise.resolve({
              ...mockUser,
              id: BigInt(7),
              role: UserRole.COMMERCIAL_AGENT,
              name: 'Agent User',
              email: 'agent@ongc.co.in',
            });
          }
          if (where.id === BigInt(999)) return Promise.resolve(null);
          if (where.staffId === 'STF-EXISTS') return Promise.resolve(mockUser);
          return Promise.resolve(null);
        }),
        findFirst: jest.fn().mockImplementation(({ where }) => {
          if (where.email?.equals === 'duplicate@ongc.co.in') return Promise.resolve(mockUser);
          return Promise.resolve(null);
        }),
        count: jest.fn().mockResolvedValue(5),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({
          id: BigInt(6),
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
          gateUsers: [],
        })),
        update: jest.fn().mockImplementation(({ where, data }) => Promise.resolve({
          ...mockUser,
          ...data,
          id: where.id,
        })),
      },
      gate: {
        findUnique: jest.fn().mockResolvedValue({ id: BigInt(2), name: 'North Gate' }),
      },
      gateUser: {
        create: jest.fn().mockResolvedValue({ id: BigInt(11) }),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      scanLog: {
        groupBy: jest.fn().mockResolvedValue([
          { scannedById: BigInt(1), _max: { scannedAt: new Date('2026-09-24T10:30:00Z') } },
        ]),
        findFirst: jest.fn().mockResolvedValue({ scannedAt: new Date('2026-09-24T10:30:00Z') }),
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([
          {
            id: BigInt(100),
            scannedById: BigInt(1),
            attendeeId: BigInt(200),
            gateId: BigInt(2),
            result: 'SUCCESS',
            responseTimeMs: 42,
            scannedAt: new Date('2026-09-24T10:30:00Z'),
            gate: { id: BigInt(2), name: 'North Gate', gateNumber: 'G-02' },
            attendee: {
              id: BigInt(200),
              ticketNumber: 'TKT-999',
              employee: { name: 'Sunil Verma', cpf: '778899', department: 'Engineering' },
              familyMember: null,
            },
          },
        ]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StaffService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<StaffService>(StaffService);
  });

  describe('findAll', () => {
    it('returns staff users with gates and last_activity_at without exposing passwords', async () => {
      const results = await service.findAll();
      expect(results).toHaveLength(1);
      const user = results[0];
      expect(user.id).toBe('1');
      expect(user.name).toBe('Rahul Sharma');
      expect(user.status).toBe('active');
      expect(user.isActive).toBe(true);
      expect((user as any).password).toBeUndefined();
      expect(user.gates).toHaveLength(1);
      expect(user.gates[0].name).toBe('North Gate');
      expect(user.last_activity_at).toBeDefined();
    });

    it('filters out AGENT_ROLES by default with notIn', async () => {
      await service.findAll();
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            role: { notIn: [UserRole.COMMERCIAL_AGENT, UserRole.COMMERCIAL_SUB_AGENT] },
          }),
        }),
      );
    });

    it('returns empty array filter { in: [] } when an agent role is requested', async () => {
      await service.findAll(UserRole.COMMERCIAL_AGENT);
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            role: { in: [] },
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('returns staff user when user is an internal staff member', async () => {
      const user = await service.findOne(BigInt(1));
      expect(user.id).toBe('1');
      expect(user.name).toBe('Rahul Sharma');
    });

    it('rejects agent user with NotFoundException', async () => {
      await expect(service.findOne(BigInt(7))).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('creates staff user and hashes password', async () => {
      const res = await service.create({
        name: 'New Operator',
        email: 'newop@ongc.co.in',
        role: UserRole.SCANNER_STAFF,
        password: 'ValidPassword123!',
        gates: ['2'],
      });

      expect(prisma.user.create).toHaveBeenCalled();
      const callData = prisma.user.create.mock.calls[0][0].data;
      expect(callData.staffId).toBeNull();
      expect(callData.password).not.toBe('ValidPassword123!');
      expect(await bcrypt.compare('ValidPassword123!', callData.password)).toBe(true);
      expect((res as any).password).toBeUndefined();
    });

    it('rejects duplicate email with ConflictException', async () => {
      await expect(
        service.create({
          name: 'Duplicate',
          email: 'duplicate@ongc.co.in',
          role: UserRole.SCANNER_STAFF,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects creating agent role via StaffService with BadRequestException', async () => {
      await expect(
        service.create({
          name: 'Agent Acc',
          email: 'newagent@ongc.co.in',
          role: UserRole.COMMERCIAL_AGENT,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('updates user attributes and replaces gate assignments in transaction', async () => {
      await service.update(BigInt(1), {
        name: 'Rahul S.',
        gates: ['2'],
      });

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: BigInt(1) },
          data: expect.objectContaining({ name: 'Rahul S.' }),
        }),
      );
      expect(prisma.gateUser.deleteMany).toHaveBeenCalledWith({ where: { userId: BigInt(1) } });
      expect(prisma.gateUser.createMany).toHaveBeenCalledWith({
        data: [{ userId: BigInt(1), gateId: BigInt(2) }],
      });
    });

    it('rejects updating an agent user with NotFoundException', async () => {
      await expect(
        service.update(BigInt(7), { name: 'Updated Agent' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects changing a staff member role to agent role with BadRequestException', async () => {
      await expect(
        service.update(BigInt(1), { role: UserRole.COMMERCIAL_AGENT }),
      ).rejects.toThrow(BadRequestException);
    });

    it('1. EVENT_ADMIN cannot change SUPER_ADMIN password', async () => {
      await expect(
        service.update(
          BigInt(99),
          { password: 'NewPassword123!' },
          { id: BigInt(5), role: UserRole.EVENT_ADMIN },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('2. EVENT_ADMIN cannot change SUPER_ADMIN email', async () => {
      await expect(
        service.update(
          BigInt(99),
          { email: 'takeover@ongc.co.in' },
          { id: BigInt(5), role: UserRole.EVENT_ADMIN },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('3. EVENT_ADMIN cannot change SUPER_ADMIN role', async () => {
      await expect(
        service.update(
          BigInt(99),
          { role: UserRole.EVENT_ADMIN },
          { id: BigInt(5), role: UserRole.EVENT_ADMIN },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('4. EVENT_ADMIN cannot deactivate SUPER_ADMIN', async () => {
      await expect(
        service.update(
          BigInt(99),
          { isActive: false },
          { id: BigInt(5), role: UserRole.EVENT_ADMIN },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('5. SUPER_ADMIN can update their own account credentials', async () => {
      await service.update(
        BigInt(99),
        { name: 'Super Admin Updated' },
        { id: BigInt(99), role: UserRole.SUPER_ADMIN },
      );
      expect(prisma.user.update).toHaveBeenCalled();
    });
  });

  describe('toggleStatus', () => {
    it('flips active status between true and false', async () => {
      await service.toggleStatus(BigInt(1));
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: BigInt(1) },
        data: { isActive: false },
      });
    });

    it('rejects toggling an agent user with NotFoundException', async () => {
      await expect(service.toggleStatus(BigInt(7))).rejects.toThrow(NotFoundException);
    });
  });

  describe('getActivity', () => {
    it('returns paginated scan activity formatted with attendee and gate details', async () => {
      const res = await service.getActivity(BigInt(1), 1, 10);
      expect(res.user.id).toBe('1');
      expect(res.logs.total).toBe(1);
      expect(res.logs.data).toHaveLength(1);
      const log = res.logs.data[0];
      expect(log.attendeeName).toBe('Sunil Verma');
      expect(log.ticket_id_scanned).toBe('TKT-999');
      expect(log.gateName).toBe('North Gate');
      expect(log.result).toBe('SUCCESS');
    });
  });
});

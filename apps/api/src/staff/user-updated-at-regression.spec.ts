import { Test, TestingModule } from '@nestjs/testing';
import { StaffService } from './staff.service';
import { CommercialAgentService } from '../commercial/commercial-agent.service';
import { CommercialService } from '../commercial/commercial.service';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '../redis/redis.service';
import { UserRole } from '@ongc/shared-types';
import * as bcrypt from 'bcrypt';

describe('User updatedAt Schema Mismatch Regression Tests', () => {
  let staffService: StaffService;
  let commercialAgentService: CommercialAgentService;
  let authService: AuthService;
  let prisma: any;

  const initialDate = new Date('2026-09-24T10:00:00.000Z');
  const updatedDate = new Date('2026-09-26T10:00:00.000Z');

  const existingMockUser = {
    id: BigInt(1),
    name: 'Existing Admin User',
    email: 'existing.admin@ongc.co.in',
    phone: '9876543210',
    staffId: 'STF-EXISTING',
    role: UserRole.SUPER_ADMIN,
    password: '$2b$10$ep5zJ4w6h3/H7zJv2.rS5OuL3x1.jV1z.j8c2K4b2Q2q6y9Z0w8eS', // bcrypt for 'SecretPassword123!'
    isActive: true,
    createdAt: initialDate,
    updatedAt: initialDate,
    parentAgentId: null,
    gateUsers: [],
  };

  beforeEach(async () => {
    const userStore = new Map<string, any>();
    userStore.set('1', { ...existingMockUser });

    prisma = {
      user: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id) {
            const found = userStore.get(where.id.toString());
            return Promise.resolve(found ? { ...found } : null);
          }
          for (const u of userStore.values()) {
            if (where.email && u.email.toLowerCase() === where.email.toLowerCase()) {
              return Promise.resolve({ ...u });
            }
            if (where.staffId && u.staffId.toLowerCase() === where.staffId.toLowerCase()) {
              return Promise.resolve({ ...u });
            }
          }
          return Promise.resolve(null);
        }),
        findFirst: jest.fn().mockImplementation(({ where }) => {
          if (where && where.OR) {
            for (const u of userStore.values()) {
              const matches = where.OR.some(
                (cond: any) =>
                  (cond.email && cond.email.equals.toLowerCase() === u.email.toLowerCase()) ||
                  (cond.staffId && cond.staffId.equals.toLowerCase() === u.staffId.toLowerCase()),
              );
              if (matches) return Promise.resolve({ ...u });
            }
          }
          if (where && where.email) {
            for (const u of userStore.values()) {
              if (u.email.toLowerCase() === where.email.equals.toLowerCase()) {
                return Promise.resolve({ ...u });
              }
            }
          }
          return Promise.resolve(null);
        }),
        findMany: jest.fn().mockImplementation(() => Promise.resolve(Array.from(userStore.values()).map(u => ({ ...u })))),
        count: jest.fn().mockImplementation(() => Promise.resolve(userStore.size)),
        create: jest.fn().mockImplementation(({ data }) => {
          const now = new Date();
          const nextId = (userStore.size + 100).toString();
          const newUser = {
            id: BigInt(nextId),
            ...data,
            createdAt: now,
            updatedAt: data.updatedAt || now,
            gateUsers: [],
          };
          userStore.set(nextId, newUser);
          return Promise.resolve({ ...newUser });
        }),
        update: jest.fn().mockImplementation(({ where, data }) => {
          const existing = userStore.get(where.id.toString());
          const updated = {
            ...existing,
            ...data,
            id: where.id,
            updatedAt: data.updatedAt || updatedDate,
          };
          userStore.set(where.id.toString(), updated);
          return Promise.resolve({ ...updated });
        }),
      },
      gate: {
        findUnique: jest.fn().mockResolvedValue({ id: BigInt(2), name: 'Main Gate' }),
      },
      gateUser: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      scanLog: {
        groupBy: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      agentAllocation: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: BigInt(5) }),
      },
      $transaction: jest.fn().mockImplementation(async (callback) => {
        return callback(prisma);
      }),
    };

    const mockJwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-access-token'),
    };

    const mockRedisService = {
      isRateLimited: jest.fn().mockResolvedValue(false),
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StaffService,
        CommercialAgentService,
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: CommercialService, useValue: {} },
        { provide: JwtService, useValue: mockJwtService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('mock-jwt-secret') } },
      ],
    }).compile();

    staffService = module.get<StaffService>(StaffService);
    commercialAgentService = module.get<CommercialAgentService>(CommercialAgentService);
    authService = module.get<AuthService>(AuthService);
  });

  it('1. creating a new staff user succeeds with automatic updatedAt population', async () => {
    const result = await staffService.create({
      name: 'Priya Mehta',
      email: 'priya.mehta@ongc.co.in',
      mobile: '9876543211',
      role: UserRole.GATE_OPERATOR,
      password: 'SecurePassword123!',
      gate_ids: [2],
    });

    expect(prisma.user.create).toHaveBeenCalled();
    const createPayload = prisma.user.create.mock.calls[0][0];
    expect(createPayload.data.name).toBe('Priya Mehta');
    expect(createPayload.data.email).toBe('priya.mehta@ongc.co.in');

    expect(result).toBeDefined();
    expect(result.id).toBe('101');
    expect(result.name).toBe('Priya Mehta');
    expect(result.createdAt).toBeDefined();
    expect(result.updatedAt).toBeDefined();
  });

  it('2. creating a new commercial agent succeeds with automatic updatedAt population', async () => {
    const agent = await commercialAgentService.createAgentAdmin(BigInt(1), {
      name: 'Vipul Shah',
      email: 'vipul.agent@staging.test',
      phone: '9876543212',
      password: 'AgentPassword123!',
    });

    expect(prisma.user.create).toHaveBeenCalled();
    expect(agent).toBeDefined();
    expect(agent.name).toBe('Vipul Shah');
    expect(agent.role).toBe(UserRole.COMMERCIAL_AGENT);
    expect(agent.createdAt).toBeDefined();
    const createdInDb = await prisma.user.create.mock.results[0].value;
    expect(createdInDb.updatedAt).toBeDefined();
  });

  it('3. existing user login still works seamlessly', async () => {
    jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));

    const loginRes = await authService.login({
      identifier: 'existing.admin@ongc.co.in',
      password: 'SecretPassword123!',
    });

    expect(loginRes).toBeDefined();
    expect(loginRes.accessToken).toBe('mock-jwt-access-token');
    expect(loginRes.user.email).toBe('existing.admin@ongc.co.in');
    expect(loginRes.user.role).toBe(UserRole.SUPER_ADMIN);
  });

  it('4. existing users are not modified unexpectedly on read / list operations', async () => {
    const staffList = await staffService.findAll();
    expect(staffList.length).toBe(1);
    expect(staffList[0].id).toBe('1');
    expect(staffList[0].email).toBe('existing.admin@ongc.co.in');
    expect(staffList[0].updatedAt).toEqual(initialDate);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('5. updating a user changes updated_at appropriately', async () => {
    const updated = await staffService.update(BigInt(1), {
      name: 'Existing Admin User Updated',
      mobile: '9999999999',
    });

    expect(prisma.user.update).toHaveBeenCalled();
    const updateArgs = prisma.user.update.mock.calls[0][0];
    expect(updateArgs.where.id).toEqual(BigInt(1));
    expect(updateArgs.data.name).toBe('Existing Admin User Updated');

    expect(updated).toBeDefined();
    expect(updated.name).toBe('Existing Admin User Updated');
    expect(new Date(updated.updatedAt).getTime()).toBeGreaterThan(initialDate.getTime());
  });
});

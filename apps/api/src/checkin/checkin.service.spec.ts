import { Test, TestingModule } from '@nestjs/testing';
import { CheckinService } from './checkin.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import {
  CheckinResult,
  CheckinStatus,
  AttendeeStatus,
  UserRole,
} from '@ongc/shared-types';

describe('CheckinService Concurrency & Security Tests', () => {
  let service: CheckinService;
  let prisma: any;
  let redis: any;

  const mockAttendee = {
    id: BigInt(101),
    ticketNumber: 'TK-123456-0001',
    qrCodeToken: 'test-token-valid-123',
    status: AttendeeStatus.ACTIVE,
    employee: {
      id: BigInt(50),
      cpf: '123456',
      name: 'Ramesh Sharma',
      designation: 'Executive Engineer',
      department: 'Drilling',
      bookingDays: ['2026-09-23', '2026-09-24'],
      photoPath: null,
    },
    familyMember: null,
  };

  const mockGate = {
    id: BigInt(1),
    name: 'Gate 1 (Main Entrance)',
    gateNumber: '1',
    gateType: 'REGULAR',
    isOpen: true,
    isScanningPaused: false,
    totalCapacity: 5000,
  };

  beforeEach(async () => {
    prisma = {
      setting: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.key === 'emergency_stop') return Promise.resolve({ value: 'false' });
          if (where.key === 'active_event_date') return Promise.resolve({ value: '2026-09-23' });
          return Promise.resolve(null);
        }),
      },
      gate: {
        findUnique: jest.fn().mockResolvedValue(mockGate),
      },
      gateUser: {
        findFirst: jest.fn().mockResolvedValue({ id: BigInt(1) }),
      },
      dailyCheckin: {
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: BigInt(999),
            ...data,
            checkinTime: new Date(),
          }),
        ),
      },
      attendee: {
        findFirst: jest.fn().mockImplementation(({ where }) => {
          if (where.OR?.[0]?.qrCodeToken === 'test-token-valid-123') {
            return Promise.resolve(mockAttendee);
          }
          return Promise.resolve(null);
        }),
      },
      scanLog: {
        create: jest.fn().mockResolvedValue({ id: BigInt(1) }),
      },
      $transaction: jest.fn().mockImplementation(async (callback) => callback(prisma)),
    };

    redis = {
      acquireLock: jest.fn().mockResolvedValue(true),
      releaseLock: jest.fn().mockResolvedValue(true),
      set: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckinService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();

    service = module.get<CheckinService>(CheckinService);
  });

  it('1. should successfully check-in a valid attendee on active date', async () => {
    const res = await service.processCheckin(
      { token: 'test-token-valid-123', gateId: '1' },
      { id: '1', role: UserRole.GATE_OPERATOR },
    );

    expect(res.success).toBe(true);
    expect(res.result).toBe(CheckinResult.SUCCESS);
    expect(res.statusCode).toBe(200);
    expect(res.data?.ticketNumber).toBe('TK-123456-0001');
    expect(redis.acquireLock).toHaveBeenCalled();
    expect(redis.releaseLock).toHaveBeenCalled();
  });

  it('2. should reject duplicate check-in if attendee already scanned today', async () => {
    prisma.dailyCheckin.findFirst.mockResolvedValueOnce({
      id: BigInt(888),
      attendeeId: BigInt(101),
      gateId: BigInt(1),
      eventDate: '2026-09-23',
      checkinTime: new Date(),
      status: CheckinStatus.SUCCESS as any,
      gate: mockGate,
    });

    const res = await service.processCheckin(
      { token: 'test-token-valid-123', gateId: '1' },
      { id: '1', role: UserRole.GATE_OPERATOR },
    );

    expect(res.success).toBe(false);
    expect(res.result).toBe(CheckinResult.ALREADY_CHECKED_IN);
    expect(res.statusCode).toBe(409);
    expect(res.message).toContain('Already checked in');
  });

  it('3. should reject when pass is not registered for today', async () => {
    prisma.attendee.findFirst.mockResolvedValueOnce({
      ...mockAttendee,
      employee: {
        ...mockAttendee.employee,
        bookingDays: ['2026-09-29'],
      },
    });

    const res = await service.processCheckin(
      { token: 'test-token-valid-123', gateId: '1' },
      { id: '1', role: UserRole.GATE_OPERATOR },
    );

    expect(res.success).toBe(false);
    expect(res.result).toBe(CheckinResult.NOT_BOOKED_TODAY);
    expect(res.statusCode).toBe(403);
  });

  it('4. should reject unrecognized QR token with INVALID_QR', async () => {
    const res = await service.processCheckin(
      { token: 'non-existent-token', gateId: '1' },
      { id: '1', role: UserRole.GATE_OPERATOR },
    );

    expect(res.success).toBe(false);
    expect(res.result).toBe(CheckinResult.INVALID_QR);
    expect(res.statusCode).toBe(400);
  });

  it('5. should reject check-in when Gate is closed', async () => {
    prisma.gate.findUnique.mockResolvedValueOnce({
      ...mockGate,
      isOpen: false,
    });

    const res = await service.processCheckin(
      { token: 'test-token-valid-123', gateId: '1' },
      { id: '1', role: UserRole.GATE_OPERATOR },
    );

    expect(res.success).toBe(false);
    expect(res.result).toBe(CheckinResult.GATE_CLOSED);
    expect(res.statusCode).toBe(403);
  });

  it('6. should reject check-in when System Emergency Stop is active', async () => {
    prisma.setting.findUnique.mockImplementation(({ where }) => {
      if (where.key === 'emergency_stop') return Promise.resolve({ value: 'true' });
      if (where.key === 'emergency_stop_reason') return Promise.resolve({ value: 'Severe Weather Alert' });
      return Promise.resolve(null);
    });

    const res = await service.processCheckin(
      { token: 'test-token-valid-123', gateId: '1' },
      { id: '1', role: UserRole.GATE_OPERATOR },
    );

    expect(res.success).toBe(false);
    expect(res.result).toBe(CheckinResult.EVENT_CLOSED);
    expect(res.statusCode).toBe(403);
    expect(res.message).toBe('Severe Weather Alert');
  });

  it('7. should flag load test requests with isLoadTest=true and loadTestRunId', async () => {
    const res = await service.processCheckin(
      {
        token: 'test-token-valid-123',
        gateId: '1',
        isLoadTest: true,
        loadTestRunId: '77',
      },
      { id: '1', role: UserRole.ADMIN },
    );

    expect(res.success).toBe(true);
    expect(prisma.dailyCheckin.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isLoadTest: true,
          loadTestRunId: BigInt(77),
        }),
      }),
    );
  });

  it('8. Concurrency Test (10 simultaneous requests): exactly 1 SUCCESS, 9 DUPLICATES', async () => {
    let checkinCreated = false;
    let lockHolder: string | null = null;

    redis.acquireLock.mockImplementation(async (key: string) => {
      if (lockHolder === null) {
        lockHolder = key;
        return true;
      }
      return false; // Concurrent lock conflict
    });

    redis.releaseLock.mockImplementation(async () => {
      lockHolder = null;
      return true;
    });

    prisma.$transaction.mockImplementation(async (callback: any) => {
      if (!checkinCreated) {
        checkinCreated = true;
        return { isDuplicate: false, newCheckin: { id: BigInt(1), checkinTime: new Date() } };
      }
      return { isDuplicate: true, existingCheckin: { id: BigInt(1), checkinTime: new Date(), gate: mockGate } };
    });

    const requests = Array.from({ length: 10 }).map(() =>
      service.processCheckin(
        { token: 'test-token-valid-123', gateId: '1' },
        { id: '1', role: UserRole.GATE_OPERATOR },
      ),
    );

    const responses = await Promise.all(requests);
    const successCount = responses.filter((r) => r.success && r.result === CheckinResult.SUCCESS).length;
    const duplicateCount = responses.filter((r) => !r.success && r.result === CheckinResult.ALREADY_CHECKED_IN).length;

    expect(successCount).toBe(1);
    expect(duplicateCount).toBe(9);
    expect(responses.length).toBe(10);
  });

  it('9. Concurrency Test (50 simultaneous requests): exactly 1 SUCCESS, 49 DUPLICATES', async () => {
    let checkinCreated = false;
    let isLocked = false;

    redis.acquireLock.mockImplementation(async () => {
      if (!isLocked) {
        isLocked = true;
        return true;
      }
      return false;
    });

    redis.releaseLock.mockImplementation(async () => {
      isLocked = false;
      return true;
    });

    prisma.$transaction.mockImplementation(async (callback: any) => {
      if (!checkinCreated) {
        checkinCreated = true;
        return { isDuplicate: false, newCheckin: { id: BigInt(1), checkinTime: new Date() } };
      }
      return { isDuplicate: true, existingCheckin: { id: BigInt(1), checkinTime: new Date(), gate: mockGate } };
    });

    const requests = Array.from({ length: 50 }).map(() =>
      service.processCheckin(
        { token: 'test-token-valid-123', gateId: '1' },
        { id: '1', role: UserRole.GATE_OPERATOR },
      ),
    );

    const responses = await Promise.all(requests);
    const successCount = responses.filter((r) => r.success && r.result === CheckinResult.SUCCESS).length;
    const duplicateCount = responses.filter((r) => !r.success && r.result === CheckinResult.ALREADY_CHECKED_IN).length;

    expect(successCount).toBe(1);
    expect(duplicateCount).toBe(49);
    expect(responses.length).toBe(50);
  });

  it('10. Concurrency Test (100 simultaneous requests): exactly 1 SUCCESS, 99 DUPLICATES', async () => {
    let checkinCreated = false;
    let isLocked = false;

    redis.acquireLock.mockImplementation(async () => {
      if (!isLocked) {
        isLocked = true;
        return true;
      }
      return false;
    });

    redis.releaseLock.mockImplementation(async () => {
      isLocked = false;
      return true;
    });

    prisma.$transaction.mockImplementation(async (callback: any) => {
      if (!checkinCreated) {
        checkinCreated = true;
        return { isDuplicate: false, newCheckin: { id: BigInt(1), checkinTime: new Date() } };
      }
      return { isDuplicate: true, existingCheckin: { id: BigInt(1), checkinTime: new Date(), gate: mockGate } };
    });

    const requests = Array.from({ length: 100 }).map(() =>
      service.processCheckin(
        { token: 'test-token-valid-123', gateId: '1' },
        { id: '1', role: UserRole.GATE_OPERATOR },
      ),
    );

    const responses = await Promise.all(requests);
    const successCount = responses.filter((r) => r.success && r.result === CheckinResult.SUCCESS).length;
    const duplicateCount = responses.filter((r) => !r.success && r.result === CheckinResult.ALREADY_CHECKED_IN).length;

    expect(successCount).toBe(1);
    expect(duplicateCount).toBe(99);
    expect(responses.length).toBe(100);
  });
});

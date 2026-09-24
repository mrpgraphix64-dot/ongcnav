import { Test, TestingModule } from '@nestjs/testing';
import { CheckinService } from '../checkin/checkin.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import {
  CheckinResult,
  CheckinStatus,
  AttendeeStatus,
  UserRole,
} from '@ongc/shared-types';

describe('Traffic Test Lab & Scanner Concurrency Benchmark (10, 50, 100 Scans)', () => {
  let service: CheckinService;
  let prisma: any;
  let redis: any;

  // Track check-ins in memory for concurrency verification
  const checkinStore = new Map<string, any>();
  const lockStore = new Set<string>();

  beforeEach(async () => {
    checkinStore.clear();
    lockStore.clear();

    prisma = {
      setting: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.key === 'emergency_stop') return Promise.resolve({ value: 'false' });
          if (where.key === 'active_event_date') return Promise.resolve({ value: '2026-09-23' });
          if (where.key === 'event_control.event_status') return Promise.resolve({ value: 'open' });
          if (where.key === 'event_control.emergency_stopped') return Promise.resolve({ value: 'false' });
          if (where.key === 'event_control.scanning_enabled') return Promise.resolve({ value: 'true' });
          return Promise.resolve(null);
        }),
      },
      gate: {
        findUnique: jest.fn().mockResolvedValue({
          id: BigInt(1),
          name: 'Gate 1 (Main Entrance)',
          gateNumber: '1',
          gateType: 'REGULAR',
          isOpen: true,
          isScanningPaused: false,
          totalCapacity: 5000,
        }),
      },
      gateUser: {
        findFirst: jest.fn().mockResolvedValue({ id: BigInt(1) }),
      },
      dailyCheckin: {
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockImplementation(({ where }) => {
          const key = `${where.attendeeId}-${where.eventDate}`;
          return Promise.resolve(checkinStore.get(key) || null);
        }),
        create: jest.fn().mockImplementation(({ data }) => {
          const key = `${data.attendeeId}-${data.eventDate}`;
          if (checkinStore.has(key)) {
            const err: any = new Error('Unique constraint failed on the fields: (`attendee_id`,`event_date`)');
            err.code = 'P2002';
            throw err;
          }
          const checkin = {
            id: BigInt(Math.floor(Math.random() * 100000) + 1),
            ...data,
            checkinTime: new Date(),
          };
          checkinStore.set(key, checkin);
          return Promise.resolve(checkin);
        }),
      },
      attendee: {
        findFirst: jest.fn().mockImplementation(({ where }) => {
          const token = where.OR?.[0]?.qrCodeToken;
          if (token && token.startsWith('VALID_')) {
            const id = BigInt(token.replace('VALID_', ''));
            return Promise.resolve({
              id,
              ticketNumber: `TK-${id}`,
              qrCodeToken: token,
              status: AttendeeStatus.ACTIVE,
              employee: {
                id: BigInt(100),
                cpf: '123456',
                name: `Attendee ${id}`,
                bookingDays: ['2026-09-23'],
              },
              familyMember: null,
            });
          }
          if (token && token.startsWith('SAME_USER_')) {
            return Promise.resolve({
              id: BigInt(999),
              ticketNumber: 'TK-999',
              qrCodeToken: token,
              status: AttendeeStatus.ACTIVE,
              employee: {
                id: BigInt(100),
                cpf: '123456',
                name: 'Concurrent User 999',
                bookingDays: ['2026-09-23'],
              },
              familyMember: null,
            });
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
      acquireLock: jest.fn().mockImplementation(async (key: string) => {
        if (lockStore.has(key)) return false;
        lockStore.add(key);
        return true;
      }),
      releaseLock: jest.fn().mockImplementation(async (key: string) => {
        lockStore.delete(key);
        return true;
      }),
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

  it('Concurrency Burst 10: 10 unique attendees processed concurrently', async () => {
    const burstSize = 10;
    const start = Date.now();

    const tasks = Array.from({ length: burstSize }, (_, i) =>
      service.processCheckin(
        {
          token: `VALID_${i + 1}`,
          gateId: '1',
          isLoadTest: true,
          loadTestRunId: '101',
        },
        { id: '1', role: UserRole.GATE_OPERATOR },
      ),
    );

    const results = await Promise.all(tasks);
    const elapsed = Date.now() - start;
    const rps = (burstSize / (elapsed / 1000)).toFixed(1);

    const successful = results.filter((r) => r.result === CheckinResult.SUCCESS);
    expect(successful).toHaveLength(burstSize);
    expect(checkinStore.size).toBe(burstSize);
    console.log(`[CONCURRENCY 10] Elapsed: ${elapsed}ms | Estimated Throughput: ${rps} req/sec`);
  });

  it('Concurrency Burst 50: 50 unique attendees processed concurrently', async () => {
    const burstSize = 50;
    const start = Date.now();

    const tasks = Array.from({ length: burstSize }, (_, i) =>
      service.processCheckin(
        {
          token: `VALID_${i + 1}`,
          gateId: '1',
          isLoadTest: true,
          loadTestRunId: '102',
        },
        { id: '1', role: UserRole.GATE_OPERATOR },
      ),
    );

    const results = await Promise.all(tasks);
    const elapsed = Date.now() - start;
    const rps = (burstSize / (elapsed / 1000)).toFixed(1);

    const successful = results.filter((r) => r.result === CheckinResult.SUCCESS);
    expect(successful).toHaveLength(burstSize);
    expect(checkinStore.size).toBe(burstSize);
    console.log(`[CONCURRENCY 50] Elapsed: ${elapsed}ms | Estimated Throughput: ${rps} req/sec`);
  });

  it('Concurrency Burst 100: 100 unique attendees processed concurrently', async () => {
    const burstSize = 100;
    const start = Date.now();

    const tasks = Array.from({ length: burstSize }, (_, i) =>
      service.processCheckin(
        {
          token: `VALID_${i + 1}`,
          gateId: '1',
          isLoadTest: true,
          loadTestRunId: '103',
        },
        { id: '1', role: UserRole.GATE_OPERATOR },
      ),
    );

    const results = await Promise.all(tasks);
    const elapsed = Date.now() - start;
    const rps = (burstSize / (elapsed / 1000)).toFixed(1);

    const successful = results.filter((r) => r.result === CheckinResult.SUCCESS);
    expect(successful).toHaveLength(burstSize);
    expect(checkinStore.size).toBe(burstSize);
    console.log(`[CONCURRENCY 100] Elapsed: ${elapsed}ms | Estimated Throughput: ${rps} req/sec`);
  });

  it('Double-Entry Race Condition Test: 50 simultaneous scans of the EXACT SAME attendee', async () => {
    const attempts = 50;
    const token = 'SAME_USER_999';

    const tasks = Array.from({ length: attempts }, () =>
      service.processCheckin(
        {
          token,
          gateId: '1',
          isLoadTest: true,
          loadTestRunId: '999',
        },
        { id: '1', role: UserRole.GATE_OPERATOR },
      ),
    );

    const results = await Promise.all(tasks);
    const successful = results.filter((r) => r.result === CheckinResult.SUCCESS);
    const duplicates = results.filter((r) => r.result === CheckinResult.ALREADY_CHECKED_IN);

    // EXACTLY 1 must succeed, and ALL others (49) must be classified as ALREADY_CHECKED_IN
    expect(successful).toHaveLength(1);
    expect(duplicates).toHaveLength(attempts - 1);
    expect(checkinStore.size).toBe(1);
    console.log(`[RACE CONDITION 50 SCANS SAME ATTENDEE] 1 SUCCESS, ${duplicates.length} REJECTED AS DUPLICATE`);
  });
});

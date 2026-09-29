import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RedisService, LockStatus } from './redis.service';

describe('RedisService Distributed Locking & Reliability Tests', () => {
  let service: RedisService;
  let mockRedisClient: any;
  const store = new Map<string, string>();

  beforeEach(async () => {
    store.clear();

    mockRedisClient = {
      set: jest.fn().mockImplementation(async (key: string, val: string, mode?: string, ttl?: number, flag?: string) => {
        if (flag === 'NX' && store.has(key)) {
          return null; // Key already exists
        }
        store.set(key, val);
        return 'OK';
      }),
      get: jest.fn().mockImplementation(async (key: string) => store.get(key) || null),
      del: jest.fn().mockImplementation(async (key: string) => {
        const existed = store.delete(key);
        return existed ? 1 : 0;
      }),
      eval: jest.fn().mockImplementation(async (script: string, numKeys: number, key: string, token: string) => {
        // Mock the atomic Lua script:
        // if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end
        if (store.get(key) === token) {
          store.delete(key);
          return 1;
        }
        return 0;
      }),
      incr: jest.fn().mockImplementation(async (key: string) => {
        const val = parseInt(store.get(key) || '0', 10) + 1;
        store.set(key, String(val));
        return val;
      }),
      expire: jest.fn().mockResolvedValue(1),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('redis://localhost:6379'),
          },
        },
      ],
    }).compile();

    service = module.get<RedisService>(RedisService);
    (service as any).client = mockRedisClient;
  });

  it('1. Scanner A acquires lock and receives ACQUIRED status with unique token', async () => {
    const resA = await service.acquireLockDetailed('lock:attendee:1', 5);
    expect(resA.status).toBe(LockStatus.ACQUIRED);
    expect(resA.token).toBeTruthy();
    expect(typeof resA.token).toBe('string');
    expect(store.get('lock:attendee:1')).toBe(resA.token);
  });

  it('2. Scanner B cannot acquire the same lock while held (status HELD, token null)', async () => {
    const resA = await service.acquireLockDetailed('lock:attendee:1', 5);
    expect(resA.status).toBe(LockStatus.ACQUIRED);

    const resB = await service.acquireLockDetailed('lock:attendee:1', 5);
    expect(resB.status).toBe(LockStatus.HELD);
    expect(resB.token).toBeNull();
  });

  it('3. Scanner A safely releases its own lock using ownership token', async () => {
    const resA = await service.acquireLockDetailed('lock:attendee:1', 5);
    expect(resA.token).toBeTruthy();

    const released = await service.releaseLock('lock:attendee:1', resA.token!);
    expect(released).toBe(true);
    expect(store.has('lock:attendee:1')).toBe(false);
  });

  it('4. Scanner B can acquire the lock after Scanner A releases', async () => {
    const resA = await service.acquireLockDetailed('lock:attendee:1', 5);
    await service.releaseLock('lock:attendee:1', resA.token!);

    const resB = await service.acquireLockDetailed('lock:attendee:1', 5);
    expect(resB.status).toBe(LockStatus.ACQUIRED);
    expect(resB.token).toBeTruthy();
    expect(resB.token).not.toBe(resA.token);
  });

  it('5. Scanner A cannot release Scanner B lock with a stale or mismatched token', async () => {
    // Scanner A acquired lock originally
    const resA = await service.acquireLockDetailed('lock:attendee:1', 5);
    // Simulate lock expiration and Scanner B acquiring the lock
    store.set('lock:attendee:1', 'scanner-b-new-token');

    // Scanner A attempts to release with old token
    const releasedByA = await service.releaseLock('lock:attendee:1', resA.token!);
    expect(releasedByA).toBe(false);
    // Scanner B's lock remains intact
    expect(store.get('lock:attendee:1')).toBe('scanner-b-new-token');
  });

  it('6. Redis error/failure returns UNAVAILABLE status, distinguishing it from HELD', async () => {
    mockRedisClient.set.mockRejectedValueOnce(new Error('Connection refused / ECONNREFUSED'));

    const res = await service.acquireLockDetailed('lock:attendee:1', 5);
    expect(res.status).toBe(LockStatus.UNAVAILABLE);
    expect(res.token).toBeNull();
  });

  it('7. releaseLock without token fails safely and does not perform blind deletion', async () => {
    store.set('lock:attendee:1', 'active-token');

    const result = await service.releaseLock('lock:attendee:1');
    expect(result).toBe(false);
    expect(store.get('lock:attendee:1')).toBe('active-token');
  });

  it('8. acquireLock passes the exact TTL in seconds to Redis set command with EX and NX', async () => {
    await service.acquireLockDetailed('lock:attendee:1', 5);
    expect(mockRedisClient.set).toHaveBeenCalledWith(
      'lock:attendee:1',
      expect.any(String),
      'EX',
      5,
      'NX',
    );
  });

  it('9. backward-compatible acquireLock returns token on success and null on error or held', async () => {
    const token = await service.acquireLock('lock:attendee:1', 5);
    expect(typeof token).toBe('string');

    // Second call while held returns null
    const held = await service.acquireLock('lock:attendee:1', 5);
    expect(held).toBeNull();

    // Outage returns null
    mockRedisClient.set.mockRejectedValueOnce(new Error('Redis crash'));
    const errorResult = await service.acquireLock('lock:attendee:2', 5);
    expect(errorResult).toBeNull();
  });
});

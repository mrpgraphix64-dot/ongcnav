import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    if (redisUrl) {
      try {
        this.client = new Redis(redisUrl, {
          maxRetriesPerRequest: 3,
          lazyConnect: true,
          retryStrategy(times) {
            return Math.min(times * 100, 3000);
          },
        });
        this.client.connect().catch((err) => {
          this.logger.warn(`Redis connection failed: ${err.message}. Operating in fallback mode.`);
          this.client = null;
        });
      } catch (err) {
        this.logger.warn(`Failed to initialize Redis: ${err.message}. Operating in fallback mode.`);
        this.client = null;
      }
    } else {
      this.logger.log('REDIS_URL not configured. Operating in in-memory fallback mode.');
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
    }
  }

  getClient(): Redis | null {
    return this.client;
  }

  async get(key: string): Promise<string | null> {
    if (!this.client) return null;
    try {
      return await this.client.get(key);
    } catch {
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    if (!this.client) return false;
    try {
      if (ttlSeconds) {
        await this.client.set(key, value, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, value);
      }
      return true;
    } catch {
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    if (!this.client) return false;
    try {
      await this.client.del(key);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Acquire a distributed lock using Redis SET NX EX
   */
  async acquireLock(lockKey: string, ttlSeconds = 5): Promise<string | null> {
    if (!this.client) return 'in-memory-lock-token';
    const token = Math.random().toString(36).substring(2);
    try {
      const result = await this.client.set(lockKey, token, 'EX', ttlSeconds, 'NX');
      return result === 'OK' ? token : null;
    } catch {
      return null;
    }
  }

  /**
   * Release distributed lock safely
   */
  async releaseLock(lockKey: string, token?: string): Promise<boolean> {
    if (!this.client || token === 'in-memory-lock-token') return true;
    if (!token) {
      return this.del(lockKey);
    }
    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    try {
      const res = await this.client.eval(luaScript, 1, lockKey, token);
      return res === 1;
    } catch {
      return false;
    }
  }
}

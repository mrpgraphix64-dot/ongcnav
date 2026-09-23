import { Controller, Get, HttpCode, HttpStatus, Res } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

interface CheckResult {
  status: 'up' | 'down' | 'disabled';
  latencyMs?: number;
  error?: string;
}

/**
 * Unauthenticated health endpoint for deployment automation and uptime
 * monitoring (GitHub Actions post-deploy check, PM2, load balancers, etc).
 *
 * Database connectivity is treated as required — if Prisma can't reach
 * Postgres the process can't do anything useful, so this returns 503.
 *
 * Redis is treated as best-effort, matching RedisService's own design:
 * the app already runs in an in-memory fallback mode when Redis is
 * unreachable, so a down/disabled Redis is reported but does not fail
 * the health check outright (only degrades it).
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'API liveness + dependency connectivity check' })
  async check(@Res({ passthrough: true }) res: Response) {
    const database = await this.checkDatabase();
    const redis = await this.checkRedis();

    const status: 'ok' | 'degraded' | 'down' =
      database.status === 'down' ? 'down' : redis.status === 'down' ? 'degraded' : 'ok';

    if (status === 'down') {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }

    return {
      success: status !== 'down',
      status,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      checks: { database, redis },
    };
  }

  private async checkDatabase(): Promise<CheckResult> {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'up', latencyMs: Date.now() - start };
    } catch (err) {
      return { status: 'down', error: err instanceof Error ? err.message : 'Unknown database error' };
    }
  }

  private async checkRedis(): Promise<CheckResult> {
    const client = this.redis.getClient();
    if (!client) {
      return { status: 'disabled' };
    }
    const start = Date.now();
    try {
      await client.ping();
      return { status: 'up', latencyMs: Date.now() - start };
    } catch (err) {
      return { status: 'down', error: err instanceof Error ? err.message : 'Unknown redis error' };
    }
  }
}

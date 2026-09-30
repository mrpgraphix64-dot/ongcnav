import {
  Injectable,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CheckinService } from '../checkin/checkin.service';
import { StartLoadTestDto } from './dto/start-test.dto';
import {
  LoadTestStatus,
  LoadTestMode,
  LoadTestScenario,
  CheckinResult,
  UserRole,
  isOfficialEventDate,
} from '@ongc/shared-types';
import { resolveBookingDays } from '../common/utils/attendee-booking.util';
import * as crypto from 'crypto';

@Injectable()
export class TrafficTestService {
  private readonly logger = new Logger(TrafficTestService.name);
  private readonly activeRuns = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly checkinService: CheckinService,
  ) {}

  private isEnabled(): boolean {
    return process.env.LOAD_TESTING_ENABLED === 'true' || process.env.NODE_ENV !== 'production';
  }

  async listRuns() {
    const runs = await this.prisma.loadTestRun.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return runs.map((r) => ({
      ...r,
      id: r.id.toString(),
      totalRequests: r.totalRequests.toString(),
      successfulRequests: r.successfulRequests.toString(),
      duplicateRequests: r.duplicateRequests.toString(),
      invalidRequests: r.invalidRequests.toString(),
      errorRequests: r.errorRequests.toString(),
      bytesTransferred: r.bytesTransferred.toString(),
    }));
  }

  async getRun(id: bigint) {
    const run = await this.prisma.loadTestRun.findUnique({
      where: { id },
      include: {
        requests: {
          take: 50,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!run) {
      throw new NotFoundException(`Load test run with ID ${id} not found`);
    }

    return {
      ...run,
      id: run.id.toString(),
      totalRequests: run.totalRequests.toString(),
      successfulRequests: run.successfulRequests.toString(),
      duplicateRequests: run.duplicateRequests.toString(),
      invalidRequests: run.invalidRequests.toString(),
      errorRequests: run.errorRequests.toString(),
      bytesTransferred: run.bytesTransferred.toString(),
      requests: run.requests.map((req) => ({
        ...req,
        id: req.id.toString(),
        runId: req.runId.toString(),
      })),
    };
  }

  async getRunStatus(id: bigint) {
    const run = await this.prisma.loadTestRun.findUnique({
      where: { id },
      include: {
        requests: {
          take: 40,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!run) {
      throw new NotFoundException(`Load test run with ID ${id} not found`);
    }

    const total = Number(run.totalRequests);
    const success = Number(run.successfulRequests);
    const successPercentage = total > 0 ? ((success / total) * 100).toFixed(1) : '0';

    return {
      id: run.id.toString(),
      status: run.status,
      mode: run.mode,
      scenario: run.scenario,
      simulatedUsers: run.simulatedUsers,
      totalRequests: run.totalRequests.toString(),
      successfulRequests: run.successfulRequests.toString(),
      duplicateRequests: run.duplicateRequests.toString(),
      invalidRequests: run.invalidRequests.toString(),
      errorRequests: run.errorRequests.toString(),
      requestsPerSecond: run.requestsPerSecond,
      avgResponseTimeMs: run.avgResponseTimeMs,
      bytesTransferred: run.bytesTransferred.toString(),
      bytesTransferredMb: (Number(run.bytesTransferred) / (1024 * 1024)).toFixed(2),
      successPercentage,
      isRunning: this.activeRuns.has(run.id.toString()) || run.status === LoadTestStatus.RUNNING,
      recentRequests: run.requests.map((req) => ({
        id: req.id.toString(),
        token: req.token.substring(0, 16) + '...',
        gateId: req.gateId,
        result: req.result,
        responseTimeMs: req.responseTimeMs,
        createdAt: req.createdAt,
      })),
    };
  }

  async stopRun(id: bigint) {
    this.activeRuns.delete(id.toString());

    const run = await this.prisma.loadTestRun.findUnique({ where: { id } });
    if (!run) {
      throw new NotFoundException(`Load test run with ID ${id} not found`);
    }

    await this.prisma.loadTestRun.update({
      where: { id },
      data: {
        status: LoadTestStatus.COMPLETED as any,
        endTime: new Date(),
      },
    });

    return { success: true, message: `Load test run ${id} stopped.` };
  }

  async startTest(dto: StartLoadTestDto, startedById: bigint) {
    if (!this.isEnabled()) {
      throw new ForbiddenException(
        'Load testing engine is disabled in this environment (LOAD_TESTING_ENABLED=false)',
      );
    }

    if (dto.mode === LoadTestMode.REAL_HTTP) {
      const targetUrl = process.env.LOAD_TEST_TARGET_URL?.trim();
      if (!targetUrl) {
        throw new BadRequestException(
          'LOAD_TEST_TARGET_URL environment variable is required for REAL_HTTP load testing. Please configure LOAD_TEST_TARGET_URL before running REAL_HTTP tests.',
        );
      }
    }

    const run = await this.prisma.loadTestRun.create({
      data: {
        scenario: dto.scenario as any,
        mode: dto.mode as any,
        status: LoadTestStatus.RUNNING as any,
        simulatedUsers: dto.simulatedUsers,
        rampUpSeconds: dto.rampUpSeconds || 5,
        startedById,
        startTime: new Date(),
      },
    });

    this.activeRuns.add(run.id.toString());

    // Run asynchronously so caller gets immediate response
    this.executeLoadTestAsync(run.id, dto, startedById).catch((err) => {
      this.logger.error(`Load test ${run.id} failed:`, err);
      this.activeRuns.delete(run.id.toString());
      this.prisma.loadTestRun.update({
        where: { id: run.id },
        data: { status: LoadTestStatus.FAILED as any, endTime: new Date() },
      }).catch(() => {});
    });

    return {
      success: true,
      message: 'Load test execution started',
      runId: run.id.toString(),
      status: LoadTestStatus.RUNNING,
      mode: dto.mode,
      scenario: dto.scenario,
    };
  }

  private async executeLoadTestAsync(
    runId: bigint,
    dto: StartLoadTestDto,
    startedById: bigint,
  ) {
    const startTime = Date.now();
    let apiUrl = '';
    if (dto.mode === LoadTestMode.REAL_HTTP) {
      const targetUrl = process.env.LOAD_TEST_TARGET_URL?.trim();
      if (!targetUrl) {
        throw new Error('LOAD_TEST_TARGET_URL is not configured for REAL_HTTP mode');
      }
      apiUrl = targetUrl;
    }

    // Resolve simulated event date (defaults strictly to an official event date)
    const effectiveTestDate =
      dto.testDate && isOfficialEventDate(dto.testDate.trim())
        ? dto.testDate.trim()
        : '2026-10-11';

    let tokens: string[] = [];

    // Query active attendees and evaluate their booking dates with resolveBookingDays
    const activeCandidates = await this.prisma.attendee.findMany({
      where: { status: 'ACTIVE' },
      take: Math.max(dto.simulatedUsers * 2, 500),
      select: {
        qrCodeToken: true,
        category: true,
        bookingDays: true,
        employee: {
          select: { bookingDays: true },
        },
      },
    });

    if (dto.scenario === LoadTestScenario.NOT_BOOKED) {
      // Find active attendees NOT booked for effectiveTestDate
      const notBooked = activeCandidates.filter((a) => {
        const cat = a.category || '';
        const isSeason = ['Season Pass', 'Any Day Pass', 'COMMERCIAL_SEASON', 'COMMERCIAL_ANY_DAY'].includes(cat);
        if (isSeason) return false;
        const days = resolveBookingDays(a);
        return days.length > 0 && !days.includes(effectiveTestDate);
      });
      tokens = notBooked.map((a) => a.qrCodeToken).slice(0, dto.simulatedUsers);

      // Fallback: if not enough in DB, add other active attendees
      if (tokens.length < dto.simulatedUsers) {
        for (const a of activeCandidates) {
          if (tokens.length >= dto.simulatedUsers) break;
          if (!tokens.includes(a.qrCodeToken)) {
            tokens.push(a.qrCodeToken);
          }
        }
      }
    } else {
      // For NORMAL, DUPLICATE, PEAK_BURST, MIXED (valid portion):
      // Prefer attendees valid for effectiveTestDate
      const valid = activeCandidates.filter((a) => {
        const cat = a.category || '';
        const isSeason = ['Season Pass', 'Any Day Pass', 'COMMERCIAL_SEASON', 'COMMERCIAL_ANY_DAY'].includes(cat);
        if (isSeason) return true;
        const days = resolveBookingDays(a);
        return days.length === 0 || days.includes(effectiveTestDate);
      });
      tokens = valid.map((a) => a.qrCodeToken).slice(0, dto.simulatedUsers);

      if (tokens.length < dto.simulatedUsers) {
        for (const a of activeCandidates) {
          if (tokens.length >= dto.simulatedUsers) break;
          if (!tokens.includes(a.qrCodeToken)) {
            tokens.push(a.qrCodeToken);
          }
        }
      }
    }

    // If still not enough attendees in DB, generate dummy tokens
    while (tokens.length < dto.simulatedUsers) {
      tokens.push(crypto.randomBytes(32).toString('hex'));
    }

    let successCount = 0;
    let duplicateCount = 0;
    let invalidCount = 0;
    let errorCount = 0;
    let totalBytesTransferred = 0;
    const latencyList: number[] = [];
    const requestBuffer: Array<{
      runId: bigint;
      token: string;
      gateId: string;
      result: string;
      responseTimeMs: number;
    }> = [];

    // Helper to execute 1 checkin request
    const executeOne = async (token: string) => {
      if (!this.activeRuns.has(runId.toString())) return;

      const reqStart = Date.now();
      let resResult: CheckinResult = CheckinResult.ERROR;

      try {
        if (dto.mode === LoadTestMode.REAL_HTTP) {
          const payload = JSON.stringify({
            token,
            gateId: dto.gateId,
            testDate: effectiveTestDate,
            isLoadTest: true,
            loadTestRunId: runId.toString(),
          });
          const reqBytes = payload.length + 150; // approximate headers

          const resp = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-load-test-auth': process.env.LOAD_TEST_INTERNAL_SECRET || '',
              'x-traffic-test-run': runId.toString(),
            },
            body: payload,
          });

          const respBody = await resp.text();
          const respBytes = respBody.length + 200;
          totalBytesTransferred += reqBytes + respBytes;

          let json: any = {};
          try {
            json = JSON.parse(respBody);
          } catch {}

          resResult = json.result || CheckinResult.ERROR;
        } else {
          // DRY RUN: direct service call
          const result = await this.checkinService.processCheckin(
            {
              token,
              gateId: dto.gateId,
              testDate: effectiveTestDate,
              isLoadTest: true,
              loadTestRunId: runId.toString(),
            },
            { id: startedById.toString(), role: UserRole.ADMIN },
          );
          resResult = result.result;
        }
      } catch (e) {
        resResult = CheckinResult.ERROR;
        errorCount++;
      }

      const reqDuration = Date.now() - reqStart;
      latencyList.push(reqDuration);

      if (resResult === CheckinResult.SUCCESS) successCount++;
      else if (resResult === CheckinResult.ALREADY_CHECKED_IN) duplicateCount++;
      else if (
        resResult === CheckinResult.INVALID_QR ||
        resResult === CheckinResult.NOT_BOOKED_TODAY ||
        resResult === CheckinResult.ATTENDEE_INACTIVE
      )
        invalidCount++;
      else errorCount++;

      requestBuffer.push({
        runId,
        token,
        gateId: dto.gateId,
        result: resResult,
        responseTimeMs: reqDuration,
      });
    };

    // Build execution tasks according to scenario
    const tasks: Array<() => Promise<void>> = [];

    if (dto.scenario === LoadTestScenario.NORMAL) {
      for (let i = 0; i < dto.simulatedUsers; i++) {
        tasks.push(() => executeOne(tokens[i % tokens.length]));
      }
    } else if (dto.scenario === LoadTestScenario.DUPLICATE) {
      for (let i = 0; i < dto.simulatedUsers; i++) {
        const t = tokens[i % tokens.length];
        tasks.push(async () => {
          await executeOne(t);
          await executeOne(t);
        });
      }
    } else if (dto.scenario === LoadTestScenario.INVALID_QR) {
      for (let i = 0; i < dto.simulatedUsers; i++) {
        tasks.push(() => executeOne('INVALID_TOKEN_' + crypto.randomBytes(8).toString('hex')));
      }
    } else if (dto.scenario === LoadTestScenario.NOT_BOOKED) {
      for (let i = 0; i < dto.simulatedUsers; i++) {
        tasks.push(() => executeOne(tokens[i % tokens.length]));
      }
    } else if (dto.scenario === LoadTestScenario.PEAK_BURST) {
      // PEAK_BURST: maximum gate surge, all simulated users attempt check-in concurrently
      for (let i = 0; i < dto.simulatedUsers; i++) {
        tasks.push(() => executeOne(tokens[i % tokens.length]));
      }
    } else {
      // MIXED: 70% normal, 20% duplicate (2 requests), 10% invalid
      for (let i = 0; i < dto.simulatedUsers; i++) {
        const rand = Math.random();
        if (rand < 0.7) {
          tasks.push(() => executeOne(tokens[i % tokens.length]));
        } else if (rand < 0.9) {
          const t = tokens[i % tokens.length];
          tasks.push(async () => {
            await executeOne(t);
            await executeOne(t);
          });
        } else {
          tasks.push(() => executeOne('INVALID_TOKEN_' + crypto.randomBytes(8).toString('hex')));
        }
      }
    }

    // Controlled concurrency pool & pacing
    const concurrency = Math.max(1, Math.min(dto.concurrency || 25, 500));
    // For PEAK_BURST, disable ramp-up delay to execute as a true burst surge
    const rampUpSeconds = dto.scenario === LoadTestScenario.PEAK_BURST ? 0 : (dto.rampUpSeconds || 0);

    const totalChunks = Math.ceil(tasks.length / concurrency);
    const chunkDelayMs = totalChunks > 1 && rampUpSeconds > 0
      ? Math.floor((rampUpSeconds * 1000) / (totalChunks - 1))
      : 0;

    for (let i = 0; i < tasks.length; i += concurrency) {
      if (!this.activeRuns.has(runId.toString())) {
        break; // Cancelled
      }
      const chunk = tasks.slice(i, i + concurrency);
      await Promise.all(chunk.map((fn) => fn()));

      if (chunkDelayMs > 0 && i + concurrency < tasks.length) {
        await new Promise((resolve) => setTimeout(resolve, chunkDelayMs));
      }
    }

    // Batch insert request logs
    if (requestBuffer.length > 0) {
      try {
        await this.prisma.loadTestRequest.createMany({
          data: requestBuffer,
        });
      } catch (err) {
        this.logger.error('Failed to batch save load test requests:', err);
      }
    }

    this.activeRuns.delete(runId.toString());

    const totalDurationSeconds = Math.max((Date.now() - startTime) / 1000, 0.001);
    const totalRequests = successCount + duplicateCount + invalidCount + errorCount;
    const rps = totalRequests / totalDurationSeconds;
    const avgLatency =
      latencyList.length > 0
        ? latencyList.reduce((a, b) => a + b, 0) / latencyList.length
        : 0;

    await this.prisma.loadTestRun.update({
      where: { id: runId },
      data: {
        status: LoadTestStatus.COMPLETED as any,
        endTime: new Date(),
        totalRequests: BigInt(totalRequests),
        successfulRequests: BigInt(successCount),
        duplicateRequests: BigInt(duplicateCount),
        invalidRequests: BigInt(invalidCount),
        errorRequests: BigInt(errorCount),
        requestsPerSecond: parseFloat(rps.toFixed(2)),
        avgResponseTimeMs: parseFloat(avgLatency.toFixed(2)),
        bytesTransferred: BigInt(totalBytesTransferred),
      },
    });
  }

  async exportCsv(id: bigint): Promise<string> {
    const run = await this.prisma.loadTestRun.findUnique({
      where: { id },
      include: {
        requests: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!run) {
      throw new NotFoundException(`Load test run with ID ${id} not found`);
    }

    const sanitize = (val: any) => {
      let str = String(val ?? '').replace(/"/g, '""');
      if (/^[=+\-@\t\r]/.test(str)) {
        str = `'${str}`;
      }
      return `"${str}"`;
    };

    const rows: string[] = [];
    rows.push(['Run ID', 'Timestamp', 'Token', 'Gate ID', 'Result', 'Response Time (ms)'].join(','));

    for (const req of run.requests) {
      rows.push([
        sanitize(run.id.toString()),
        sanitize(req.createdAt.toISOString()),
        sanitize(req.token),
        sanitize(req.gateId),
        sanitize(req.result),
        sanitize(req.responseTimeMs),
      ].join(','));
    }

    return rows.join('\r\n');
  }

  async cleanupRun(runId: bigint) {
    this.activeRuns.delete(runId.toString());

    await this.prisma.$transaction([
      this.prisma.loadTestRequest.deleteMany({ where: { runId } }),
      this.prisma.scanLog.deleteMany({ where: { loadTestRunId: runId } }),
      this.prisma.dailyCheckin.deleteMany({ where: { loadTestRunId: runId } }),
      this.prisma.loadTestRun.delete({ where: { id: runId } }),
    ]);

    return { success: true, message: `Load test run ${runId} and all associated data purged` };
  }
}

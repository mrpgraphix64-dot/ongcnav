import {
  Injectable,
  ForbiddenException,
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
} from '@ongc/shared-types';
import * as crypto from 'crypto';

@Injectable()
export class TrafficTestService {
  private readonly logger = new Logger(TrafficTestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly checkinService: CheckinService,
  ) {}

  private isEnabled(): boolean {
    return process.env.LOAD_TESTING_ENABLED === 'true';
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
      requests: run.requests.map((req) => ({
        ...req,
        id: req.id.toString(),
        runId: req.runId.toString(),
      })),
    };
  }

  async startTest(dto: StartLoadTestDto, startedById: bigint) {
    if (!this.isEnabled()) {
      throw new ForbiddenException(
        'Load testing engine is disabled in this environment (LOAD_TESTING_ENABLED=false)',
      );
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

    // Run asynchronously so caller gets immediate response
    this.executeLoadTestAsync(run.id, dto, startedById).catch((err) => {
      this.logger.error(`Load test ${run.id} failed:`, err);
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
    const port = process.env.PORT || 3001;
    const apiUrl = `http://localhost:${port}/admin/traffic-test/execute-checkin`;

    // Fetch or generate synthetic attendee tokens for testing
    // We can fetch real attendees or generate synthetic test passes
    const attendees = await this.prisma.attendee.findMany({
      take: Math.min(dto.simulatedUsers, 1000),
      select: { qrCodeToken: true },
    });

    const tokens: string[] = attendees.map((a) => a.qrCodeToken);
    // If not enough attendees in DB, generate dummy tokens
    while (tokens.length < dto.simulatedUsers) {
      tokens.push(crypto.randomBytes(32).toString('hex'));
    }

    let successCount = 0;
    let duplicateCount = 0;
    let invalidCount = 0;
    let errorCount = 0;
    let totalBytesTransferred = 0;
    const latencyList: number[] = [];

    // Helper to execute 1 checkin request
    const executeOne = async (token: string) => {
      const reqStart = Date.now();
      let resResult: CheckinResult = CheckinResult.ERROR;

      try {
        if (dto.mode === LoadTestMode.REAL_HTTP) {
          const payload = JSON.stringify({
            token,
            gateId: dto.gateId,
            isLoadTest: true,
            loadTestRunId: runId.toString(),
          });
          const reqBytes = payload.length + 150; // approximate headers

          const resp = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-load-test-auth': 'ongc-traffic-test-internal',
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
      else if (resResult === CheckinResult.INVALID_QR || resResult === CheckinResult.NOT_BOOKED_TODAY)
        invalidCount++;
      else errorCount++;
    };

    // Build execution tasks according to scenario
    const tasks: Array<() => Promise<void>> = [];

    if (dto.scenario === LoadTestScenario.NORMAL) {
      // 1 user -> 1 request -> SUCCESS
      for (let i = 0; i < dto.simulatedUsers; i++) {
        tasks.push(() => executeOne(tokens[i % tokens.length]));
      }
    } else if (dto.scenario === LoadTestScenario.DUPLICATE) {
      // 1 user -> 2 requests (same token) -> 1 SUCCESS, 1 DUPLICATE
      for (let i = 0; i < dto.simulatedUsers; i++) {
        const t = tokens[i % tokens.length];
        tasks.push(async () => {
          await executeOne(t);
          await executeOne(t);
        });
      }
    } else if (dto.scenario === LoadTestScenario.INVALID_QR) {
      // Send completely invalid tokens
      for (let i = 0; i < dto.simulatedUsers; i++) {
        tasks.push(() => executeOne('INVALID_TOKEN_' + crypto.randomBytes(8).toString('hex')));
      }
    } else {
      // MIXED / PEAK_BURST
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

    // Execute concurrently with concurrency pool (e.g., 50 at a time)
    const concurrency = 25;
    for (let i = 0; i < tasks.length; i += concurrency) {
      const chunk = tasks.slice(i, i + concurrency);
      await Promise.all(chunk.map((fn) => fn()));
    }

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

  async cleanupRun(runId: bigint) {
    await this.prisma.$transaction([
      this.prisma.loadTestRequest.deleteMany({ where: { runId } }),
      this.prisma.scanLog.deleteMany({ where: { loadTestRunId: runId } }),
      this.prisma.dailyCheckin.deleteMany({ where: { loadTestRunId: runId } }),
      this.prisma.loadTestRun.delete({ where: { id: runId } }),
    ]);

    return { success: true, message: `Load test run ${runId} and all associated data purged` };
  }
}

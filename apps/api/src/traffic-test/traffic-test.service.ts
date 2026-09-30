import {
  Injectable,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
  Logger,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CheckinService } from '../checkin/checkin.service';
import { RedisService } from '../redis/redis.service';
import { StartLoadTestDto } from './dto/start-test.dto';
import {
  LoadTestStatus,
  LoadTestMode,
  LoadTestScenario,
  CheckinResult,
  UserRole,
  isOfficialEventDate,
  AttendeeStatus,
  RegistrationType,
  GateType,
} from '@ongc/shared-types';
import * as crypto from 'crypto';
import * as os from 'os';
import * as fs from 'fs';
import * as net from 'net';

@Injectable()
export class TrafficTestService {
  private readonly logger = new Logger(TrafficTestService.name);
  private readonly activeRuns = new Set<string>();
  private lastCpuSample: { total: number; idle: number; timestamp: number } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly checkinService: CheckinService,
    @Optional() private readonly redisService?: RedisService,
  ) {}

  async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

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

    const MAX_SAFE_CONCURRENCY = 500;
    const requestedWorkers = dto.concurrency || dto.simulatedUsers;
    if (requestedWorkers > MAX_SAFE_CONCURRENCY || dto.simulatedUsers > MAX_SAFE_CONCURRENCY) {
      throw new BadRequestException(
        `Requested scanners/concurrency (${requestedWorkers}) exceeds the maximum safe server limit (${MAX_SAFE_CONCURRENCY}).`,
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

    const isPhysicalScannerModel =
      (dto.scanIntervalSeconds !== undefined || dto.durationSeconds !== undefined) &&
      dto.scenario !== LoadTestScenario.PEAK_BURST;

    const scanIntervalSeconds = Math.max(1, Math.min(60, Math.floor(dto.scanIntervalSeconds || 2)));
    const durationSeconds = Math.max(5, Math.min(300, Math.floor(dto.durationSeconds || 30)));
    const totalCycles = Math.max(1, Math.floor(durationSeconds / scanIntervalSeconds));
    const totalScanners = Math.max(1, Math.min(500, dto.simulatedUsers || dto.concurrency || 6));

    const totalRequiredTokens = isPhysicalScannerModel
      ? totalScanners * totalCycles
      : dto.simulatedUsers;

    // Inspect target gate to determine if VIP gate privileges are needed
    let isVipGate = false;
    try {
      const gate = await this.prisma.gate.findUnique({
        where: { id: BigInt(dto.gateId) },
        select: { gateType: true },
      });
      isVipGate = gate?.gateType === GateType.VIP;
    } catch {
      // Fallback if gateId cannot be parsed or queried
    }

    let tokens: string[] = [];

    if (dto.scenario === LoadTestScenario.INVALID_QR) {
      // INVALID_QR scenario tests rejected requests for tokens that do not exist in the database.
      // No synthetic attendees needed.
      tokens = [];
    } else if (dto.scenario === LoadTestScenario.NOT_BOOKED) {
      // NOT_BOOKED scenario tests valid database attendees booked for an event date OTHER than effectiveTestDate
      const unbookedDate = effectiveTestDate === '2026-10-11' ? '2026-10-12' : '2026-10-11';
      tokens = await this.createSyntheticAttendeesForRun(
        runId,
        totalRequiredTokens,
        unbookedDate,
        isVipGate,
      );
    } else {
      // NORMAL, DUPLICATE, PEAK_BURST, MIXED:
      // Real database-backed synthetic attendees booked specifically for effectiveTestDate with 0 prior check-ins
      tokens = await this.createSyntheticAttendeesForRun(
        runId,
        totalRequiredTokens,
        effectiveTestDate,
        isVipGate,
      );
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

    if (isPhysicalScannerModel) {
      // Physical Turnstile & Scanner Model:
      // Each cycle fires all totalScanners in parallel, followed by scanIntervalSeconds pause.
      // Pacing is strictly controlled by scanIntervalSeconds (rampUpSeconds is NOT used).
      for (let c = 0; c < totalCycles; c++) {
        if (!this.activeRuns.has(runId.toString())) {
          break; // Cancelled
        }

        const cycleTasks: Array<() => Promise<void>> = [];

        for (let s = 0; s < totalScanners; s++) {
          const token = tokens[(c * totalScanners + s) % tokens.length];

          if (dto.scenario === LoadTestScenario.NORMAL) {
            cycleTasks.push(() => executeOne(token));
          } else if (dto.scenario === LoadTestScenario.DUPLICATE) {
            cycleTasks.push(async () => {
              await executeOne(token);
              await executeOne(token);
            });
          } else if (dto.scenario === LoadTestScenario.INVALID_QR) {
            cycleTasks.push(() => executeOne('INVALID_TOKEN_' + crypto.randomBytes(8).toString('hex')));
          } else if (dto.scenario === LoadTestScenario.NOT_BOOKED) {
            cycleTasks.push(() => executeOne(token));
          } else if (dto.scenario === LoadTestScenario.MIXED) {
            const rand = Math.random();
            if (rand < 0.7) {
              cycleTasks.push(() => executeOne(token));
            } else if (rand < 0.9) {
              cycleTasks.push(async () => {
                await executeOne(token);
                await executeOne(token);
              });
            } else {
              cycleTasks.push(() => executeOne('INVALID_TOKEN_' + crypto.randomBytes(8).toString('hex')));
            }
          }
        }

        // Send all totalScanners requests in parallel for this cycle
        await Promise.all(cycleTasks.map((fn) => fn()));

        // Do not add interval after the final cycle to avoid unnecessarily extending test duration (Requirement 10)
        if (c < totalCycles - 1 && this.activeRuns.has(runId.toString())) {
          await this.sleep(scanIntervalSeconds * 1000);
        }
      }
    } else {
      // Legacy / PEAK_BURST execution path
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
          await this.sleep(chunkDelayMs);
        }
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

  private async createSyntheticAttendeesForRun(
    runId: bigint,
    count: number,
    bookingDate: string,
    isVipGate = false,
  ): Promise<string[]> {
    if (count <= 0) return [];

    const category = isVipGate ? 'LOAD_TEST_VIP' : 'LOAD_TEST';
    const attendeesData: Array<{
      ticketNumber: string;
      qrCodeToken: string;
      name: string;
      mobile: string;
      email: string;
      category: string;
      status: any;
      registrationType: any;
      bookingDays: string[];
    }> = [];
    const tokens: string[] = [];

    for (let i = 0; i < count; i++) {
      const token = `LOADTEST-R${runId}-${i + 1}-${crypto.randomBytes(6).toString('hex')}`;
      tokens.push(token);
      attendeesData.push({
        ticketNumber: `TK-LT-R${runId}-${i + 1}`,
        qrCodeToken: token,
        name: `[LOAD_TEST] Run #${runId} Attendee ${i + 1}`,
        mobile: '9999999999',
        email: `loadtest-r${runId}-${i + 1}@example.com`,
        category,
        status: AttendeeStatus.ACTIVE as any,
        registrationType: RegistrationType.FREE as any,
        bookingDays: [bookingDate],
      });
    }

    const chunkSize = 250;
    for (let i = 0; i < attendeesData.length; i += chunkSize) {
      const chunk = attendeesData.slice(i, i + chunkSize);
      await this.prisma.attendee.createMany({
        data: chunk,
      });
    }

    this.logger.log(`Created ${tokens.length} synthetic attendees in DB for Load Test Run #${runId} (${category})`);
    return tokens;
  }

  async cleanupRun(runId: bigint) {
    this.activeRuns.delete(runId.toString());

    await this.prisma.$transaction([
      this.prisma.loadTestRequest.deleteMany({ where: { runId } }),
      this.prisma.scanLog.deleteMany({ where: { loadTestRunId: runId } }),
      this.prisma.dailyCheckin.deleteMany({ where: { loadTestRunId: runId } }),
      this.prisma.attendee.deleteMany({
        where: {
          qrCodeToken: {
            startsWith: `LOADTEST-R${runId}-`,
          },
        },
      }),
      this.prisma.loadTestRun.delete({ where: { id: runId } }),
    ]);

    return { success: true, message: `Load test run ${runId} and all associated data purged` };
  }

  getCpuUsage(): { usagePercent: number; cores: number; loadAvg: number[] } {
    const cpus = os.cpus();
    const cores = Math.max(cpus.length, 1);
    let total = 0;
    let idle = 0;

    for (const cpu of cpus) {
      total += cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.irq + cpu.times.idle;
      idle += cpu.times.idle;
    }

    const now = Date.now();
    let usagePercent = 0;

    if (this.lastCpuSample && now - this.lastCpuSample.timestamp >= 500) {
      const deltaTotal = total - this.lastCpuSample.total;
      const deltaIdle = idle - this.lastCpuSample.idle;
      if (deltaTotal > 0) {
        usagePercent = Math.max(0, Math.min(100, Math.round(((deltaTotal - deltaIdle) / deltaTotal) * 100)));
      }
    } else {
      const load = os.loadavg()[0];
      if (load !== undefined && !isNaN(load)) {
        usagePercent = Math.max(0, Math.min(100, Math.round((load / cores) * 100)));
      }
    }

    this.lastCpuSample = { total, idle, timestamp: now };
    const loadAvg = typeof os.loadavg === 'function' ? os.loadavg() : [0, 0, 0];
    return { usagePercent, cores, loadAvg };
  }

  async getVpsStatus(): Promise<any> {
    try {
      const cpu = this.getCpuUsage();

      // Memory metrics
      let totalBytes = os.totalmem();
      let freeBytes = os.freemem();
      if (process.platform === 'linux') {
        try {
          const meminfo = fs.readFileSync('/proc/meminfo', 'utf8');
          const totalMatch = meminfo.match(/MemTotal:\s+(\d+)\s+kB/);
          const availMatch = meminfo.match(/MemAvailable:\s+(\d+)\s+kB/);
          if (totalMatch && availMatch) {
            totalBytes = parseInt(totalMatch[1], 10) * 1024;
            freeBytes = parseInt(availMatch[1], 10) * 1024;
          }
        } catch {
          // Fallback to os.freemem()
        }
      }
      const usedBytes = Math.max(0, totalBytes - freeBytes);
      const memPercent = Math.max(0, Math.min(100, Math.round((usedBytes / totalBytes) * 100)));
      const usedMb = Math.round(usedBytes / (1024 * 1024));
      const totalMb = Math.round(totalBytes / (1024 * 1024));
      const usedMemGb = (usedBytes / (1024 * 1024 * 1024)).toFixed(1);
      const totalMemGb = (totalBytes / (1024 * 1024 * 1024)).toFixed(1);
      const formattedMem = totalBytes >= 1024 * 1024 * 1024
        ? `${usedMemGb} / ${totalMemGb} GB`
        : `${usedMb} / ${totalMb} MB`;

      // Disk metrics
      let disk = {
        usedPercent: 0,
        usedGb: 0,
        totalGb: 0,
        formatted: 'N/A',
      };
      try {
        const statPath = process.platform === 'win32' ? process.cwd() : '/';
        const stats = fs.statfsSync(statPath);
        const totalB = stats.blocks * stats.bsize;
        const freeB = stats.bavail * stats.bsize;
        const usedB = Math.max(0, totalB - freeB);
        const totalG = totalB / (1024 * 1024 * 1024);
        const usedG = usedB / (1024 * 1024 * 1024);
        const pct = Math.max(0, Math.min(100, Math.round((usedB / totalB) * 100)));
        disk = {
          usedPercent: pct,
          usedGb: parseFloat(usedG.toFixed(1)),
          totalGb: parseFloat(totalG.toFixed(1)),
          formatted: `${usedG.toFixed(1)} / ${totalG.toFixed(1)} GB`,
        };
      } catch {
        // Disk fallback
      }

      // Network metrics (Linux /proc/net/dev or fallback)
      let rxBytesTotal = 0;
      let txBytesTotal = 0;
      let primaryIf = 'all';

      if (process.platform === 'linux') {
        try {
          const netDev = fs.readFileSync('/proc/net/dev', 'utf8');
          const lines = netDev.split('\n');
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.includes('|') || !trimmed.includes(':')) continue;
            const [ifName, statsStr] = trimmed.split(':');
            const cleanIf = ifName.trim();
            if (cleanIf === 'lo' || cleanIf.startsWith('docker') || cleanIf.startsWith('br-') || cleanIf.startsWith('veth')) {
              continue;
            }
            const parts = statsStr.trim().split(/\s+/);
            const rx = parseInt(parts[0], 10) || 0;
            const tx = parseInt(parts[8], 10) || 0;
            rxBytesTotal += rx;
            txBytesTotal += tx;
            if (primaryIf === 'all') primaryIf = cleanIf;
          }
        } catch {
          // Fallback
        }
      }

      const formatNetBytes = (bytes: number): string => {
        if (bytes <= 0) return '0 MB';
        const mb = bytes / (1024 * 1024);
        if (mb < 1024) return `${mb.toFixed(1)} MB`;
        const gb = mb / 1024;
        return `${gb.toFixed(2)} GB`;
      };

      const network = {
        rxMb: parseFloat((rxBytesTotal / (1024 * 1024)).toFixed(1)),
        txMb: parseFloat((txBytesTotal / (1024 * 1024)).toFixed(1)),
        formattedRx: formatNetBytes(rxBytesTotal),
        formattedTx: formatNetBytes(txBytesTotal),
        interface: primaryIf,
      };

      // Service statuses
      let dbStatus: 'Connected' | 'Disconnected' = 'Disconnected';
      try {
        await this.prisma.$queryRaw`SELECT 1`;
        dbStatus = 'Connected';
      } catch {
        dbStatus = 'Disconnected';
      }

      let redisStatus: 'Connected' | 'Disconnected' | 'Fallback' = 'Fallback';
      try {
        if (this.redisService) {
          const isPong = await this.redisService.ping();
          redisStatus = isPong ? 'Connected' : 'Disconnected';
        } else {
          redisStatus = 'Fallback';
        }
      } catch {
        redisStatus = 'Disconnected';
      }

      let nginxStatus: 'Running' | 'Stopped' | 'Unknown' = 'Unknown';
      if (process.platform === 'linux') {
        const pidExists = fs.existsSync('/run/nginx.pid') || fs.existsSync('/var/run/nginx.pid');
        if (pidExists) {
          nginxStatus = 'Running';
        } else {
          const portOpen = await this.checkPortOpen('127.0.0.1', 80, 400);
          nginxStatus = portOpen ? 'Running' : 'Stopped';
        }
      } else {
        nginxStatus = 'Unknown';
      }

      return {
        status: 'ok',
        cpu,
        memory: {
          usedPercent: memPercent,
          usedMb,
          totalMb,
          formatted: formattedMem,
        },
        disk,
        network,
        services: {
          api: 'Healthy',
          database: dbStatus,
          redis: redisStatus,
          nginx: nginxStatus,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      this.logger.error('Failed to collect VPS system metrics:', err);
      return {
        status: 'error',
        message: 'VPS metrics temporarily unavailable',
        timestamp: new Date().toISOString(),
      };
    }
  }

  private checkPortOpen(host: string, port: number, timeoutMs = 400): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = net.createConnection({ host, port, timeout: timeoutMs }, () => {
        socket.destroy();
        resolve(true);
      });
      socket.on('error', () => {
        socket.destroy();
        resolve(false);
      });
      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
    });
  }
}

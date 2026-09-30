import { Test, TestingModule } from '@nestjs/testing';
import { TrafficTestService } from './traffic-test.service';
import { PrismaService } from '../prisma/prisma.service';
import { CheckinService } from '../checkin/checkin.service';
import { LoadTestMode, LoadTestScenario, LoadTestStatus, CheckinResult } from '@ongc/shared-types';

describe('TrafficTestService', () => {
  let service: TrafficTestService;
  let prisma: any;
  let checkinService: any;

  const mockRun = {
    id: BigInt(1),
    scenario: LoadTestScenario.NORMAL,
    mode: LoadTestMode.DRY_RUN,
    status: LoadTestStatus.COMPLETED,
    simulatedUsers: 10,
    rampUpSeconds: 5,
    startedById: BigInt(1),
    startTime: new Date(),
    endTime: new Date(),
    totalRequests: BigInt(10),
    successfulRequests: BigInt(10),
    duplicateRequests: BigInt(0),
    invalidRequests: BigInt(0),
    errorRequests: BigInt(0),
    requestsPerSecond: 100.5,
    avgResponseTimeMs: 12.3,
    bytesTransferred: BigInt(1024),
    createdAt: new Date(),
    updatedAt: new Date(),
    requests: [
      {
        id: BigInt(1),
        runId: BigInt(1),
        token: 'TEST_TOKEN_123',
        gateId: '1',
        result: 'SUCCESS',
        responseTimeMs: 15,
        createdAt: new Date(),
      },
    ],
  };

  beforeEach(async () => {
    prisma = {
      loadTestRun: {
        findMany: jest.fn().mockResolvedValue([mockRun]),
        findUnique: jest.fn().mockResolvedValue(mockRun),
        create: jest.fn().mockResolvedValue({ ...mockRun, id: BigInt(2), status: LoadTestStatus.RUNNING }),
        update: jest.fn().mockResolvedValue(mockRun),
        delete: jest.fn().mockResolvedValue({ id: BigInt(1) }),
      },
      loadTestRequest: {
        findMany: jest.fn().mockResolvedValue(mockRun.requests),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      scanLog: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      dailyCheckin: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      attendee: {
        findMany: jest.fn().mockResolvedValue([{ qrCodeToken: 'ATT_TOKEN_1' }]),
        createMany: jest.fn().mockResolvedValue({ count: 30 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 30 }),
      },
      gate: {
        findUnique: jest.fn().mockResolvedValue({ id: BigInt(1), gateType: 'REGULAR', isOpen: true }),
      },
      $transaction: jest.fn().mockImplementation((arr) => Promise.all(arr)),
    };

    checkinService = {
      processCheckin: jest.fn().mockResolvedValue({
        success: true,
        result: CheckinResult.SUCCESS,
        statusCode: 200,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrafficTestService,
        { provide: PrismaService, useValue: prisma },
        { provide: CheckinService, useValue: checkinService },
      ],
    }).compile();

    service = module.get<TrafficTestService>(TrafficTestService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('listRuns', () => {
    it('should return serialized runs with string IDs', async () => {
      const runs = await service.listRuns();
      expect(runs).toHaveLength(1);
      expect(runs[0].id).toBe('1');
      expect(runs[0].totalRequests).toBe('10');
      expect(prisma.loadTestRun.findMany).toHaveBeenCalled();
    });
  });

  describe('getRunStatus', () => {
    it('should return run status with telemetry and success percentage', async () => {
      const status = await service.getRunStatus(BigInt(1));
      expect(status.id).toBe('1');
      expect(status.status).toBe(LoadTestStatus.COMPLETED);
      expect(status.successPercentage).toBe('100.0');
      expect(status.recentRequests).toHaveLength(1);
    });
  });

  describe('stopRun', () => {
    it('should set run status to completed and return success', async () => {
      const result = await service.stopRun(BigInt(1));
      expect(result.success).toBe(true);
      expect(prisma.loadTestRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: BigInt(1) },
          data: expect.objectContaining({ status: LoadTestStatus.COMPLETED }),
        }),
      );
    });
  });

  describe('exportCsv', () => {
    it('should format requests as CSV with headers and sanitized values', async () => {
      const csv = await service.exportCsv(BigInt(1));
      expect(csv).toContain('Run ID,Timestamp,Token,Gate ID,Result,Response Time (ms)');
      expect(csv).toContain('TEST_TOKEN_123');
      expect(csv).toContain('SUCCESS');
    });
  });

  describe('cleanupRun', () => {
    it('should purge test requests, scan logs, checkins, and run record', async () => {
      const result = await service.cleanupRun(BigInt(1));
      expect(result.success).toBe(true);
      expect(prisma.loadTestRequest.deleteMany).toHaveBeenCalledWith({ where: { runId: BigInt(1) } });
      expect(prisma.scanLog.deleteMany).toHaveBeenCalledWith({ where: { loadTestRunId: BigInt(1) } });
      expect(prisma.dailyCheckin.deleteMany).toHaveBeenCalledWith({ where: { loadTestRunId: BigInt(1) } });
      expect(prisma.loadTestRun.delete).toHaveBeenCalledWith({ where: { id: BigInt(1) } });
    });
  });

  describe('startTest', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
      delete process.env.LOAD_TEST_TARGET_URL;
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it('should throw BadRequestException if mode is REAL_HTTP and LOAD_TEST_TARGET_URL is unset', async () => {
      delete process.env.LOAD_TEST_TARGET_URL;

      await expect(
        service.startTest(
          {
            scenario: LoadTestScenario.NORMAL,
            mode: LoadTestMode.REAL_HTTP,
            simulatedUsers: 10,
          } as any,
          BigInt(1),
        ),
      ).rejects.toThrow('LOAD_TEST_TARGET_URL environment variable is required');
    });

    it('should succeed for DRY_RUN even if LOAD_TEST_TARGET_URL is unset', async () => {
      delete process.env.LOAD_TEST_TARGET_URL;

      const result = await service.startTest(
        {
          scenario: LoadTestScenario.NORMAL,
          mode: LoadTestMode.DRY_RUN,
          simulatedUsers: 10,
          concurrency: 5,
          testDate: '2026-10-11',
        } as any,
        BigInt(1),
      );

      expect(result.success).toBe(true);
      expect(result.runId).toBe('2');
      expect(prisma.loadTestRun.create).toHaveBeenCalled();
    });

    it('should succeed for REAL_HTTP when LOAD_TEST_TARGET_URL is configured', async () => {
      process.env.LOAD_TEST_TARGET_URL = 'https://staging.example.com/admin/traffic-test/execute-checkin';

      const result = await service.startTest(
        {
          scenario: LoadTestScenario.NORMAL,
          mode: LoadTestMode.REAL_HTTP,
          simulatedUsers: 10,
          concurrency: 10,
          rampUpSeconds: 2,
          testDate: '2026-10-12',
        } as any,
        BigInt(1),
      );

      expect(result.success).toBe(true);
      expect(result.runId).toBe('2');
      expect(prisma.loadTestRun.create).toHaveBeenCalled();
    });

    describe('Physical Scanner Execution Model', () => {
      it('executes 5 cycles of 6 scanners (30 requests total) for 10s duration and 2s interval with no delay after final cycle', async () => {
        const sleepSpy = jest.spyOn(service, 'sleep').mockResolvedValue();

        const result = await service.startTest(
          {
            scenario: LoadTestScenario.NORMAL,
            mode: LoadTestMode.DRY_RUN,
            simulatedUsers: 6,
            concurrency: 6,
            scanIntervalSeconds: 2,
            durationSeconds: 10,
            rampUpSeconds: 0, // rampUpSeconds is ignored
            testDate: '2026-10-11',
            gateId: '1',
          } as any,
          BigInt(1),
        );

        expect(result.success).toBe(true);

        // Wait a tick for async execution
        await new Promise((resolve) => setImmediate(resolve));

        // 5 cycles: 10s / 2s = 5 cycles.
        // Sleep between cycles: exactly 4 times (cycles 0, 1, 2, 3). No sleep after cycle 4!
        expect(sleepSpy).toHaveBeenCalledTimes(4);
        expect(sleepSpy).toHaveBeenNthCalledWith(1, 2000);
        expect(sleepSpy).toHaveBeenNthCalledWith(2, 2000);
        expect(sleepSpy).toHaveBeenNthCalledWith(3, 2000);
        expect(sleepSpy).toHaveBeenNthCalledWith(4, 2000);

        // Verify checkinService was called for all 30 scans (6 scanners × 5 cycles)
        expect(checkinService.processCheckin).toHaveBeenCalledTimes(30);

        sleepSpy.mockRestore();
      });

      it('preserves PEAK_BURST as an immediate single burst without interval pacing', async () => {
        const sleepSpy = jest.spyOn(service, 'sleep').mockResolvedValue();

        const result = await service.startTest(
          {
            scenario: LoadTestScenario.PEAK_BURST,
            mode: LoadTestMode.DRY_RUN,
            simulatedUsers: 12,
            concurrency: 12,
            scanIntervalSeconds: 2,
            durationSeconds: 10,
            testDate: '2026-10-11',
            gateId: '1',
          } as any,
          BigInt(1),
        );

        expect(result.success).toBe(true);
        await new Promise((resolve) => setImmediate(resolve));

        // PEAK_BURST bypasses cycles and executes all 12 at once with 0 delay
        expect(sleepSpy).not.toHaveBeenCalled();
        expect(checkinService.processCheckin).toHaveBeenCalledTimes(12);

        sleepSpy.mockRestore();
      });

      it('executes DUPLICATE scenario with 2 requests per scanner per cycle', async () => {
        const sleepSpy = jest.spyOn(service, 'sleep').mockResolvedValue();

        // 2 scanners, 2s interval, 6s duration -> 3 cycles
        // Each cycle: 2 scanners × 2 scans = 4 scans per cycle
        // Total scans: 3 cycles × 4 = 12 scans
        const result = await service.startTest(
          {
            scenario: LoadTestScenario.DUPLICATE,
            mode: LoadTestMode.DRY_RUN,
            simulatedUsers: 2,
            concurrency: 2,
            scanIntervalSeconds: 2,
            durationSeconds: 6,
            testDate: '2026-10-11',
            gateId: '1',
          } as any,
          BigInt(1),
        );

        expect(result.success).toBe(true);
        await new Promise((resolve) => setImmediate(resolve));

        expect(sleepSpy).toHaveBeenCalledTimes(2); // 3 cycles -> 2 pauses
        expect(checkinService.processCheckin).toHaveBeenCalledTimes(12);

        sleepSpy.mockRestore();
      });
    });

    describe('Synthetic Attendee Pool & Run Isolation', () => {
      it('creates dedicated synthetic attendees in PostgreSQL for NORMAL scenario with correct run ID prefixes', async () => {
        const sleepSpy = jest.spyOn(service, 'sleep').mockResolvedValue();

        // 6 scanners, 2s interval, 10s duration = 5 cycles -> 30 tokens required
        await service.startTest(
          {
            scenario: LoadTestScenario.NORMAL,
            mode: LoadTestMode.DRY_RUN,
            simulatedUsers: 6,
            concurrency: 6,
            scanIntervalSeconds: 2,
            durationSeconds: 10,
            testDate: '2026-10-11',
            gateId: '1',
          } as any,
          BigInt(1),
        );

        await new Promise((resolve) => setImmediate(resolve));

        expect(prisma.attendee.createMany).toHaveBeenCalledTimes(1);
        const createCall = prisma.attendee.createMany.mock.calls[0][0];
        expect(createCall.data).toHaveLength(30);

        const firstAttendee = createCall.data[0];
        expect(firstAttendee.ticketNumber).toBe('TK-LT-R2-1');
        expect(firstAttendee.qrCodeToken).toMatch(/^LOADTEST-R2-1-[a-f0-9]{12}$/);
        expect(firstAttendee.category).toBe('LOAD_TEST');
        expect(firstAttendee.status).toBe('ACTIVE');
        expect(firstAttendee.registrationType).toBe('FREE');
        expect(firstAttendee.bookingDays).toEqual(['2026-10-11']);

        // Check that check-in calls received the generated tokens
        expect(checkinService.processCheckin).toHaveBeenCalledTimes(30);
        const firstCheckinCall = checkinService.processCheckin.mock.calls[0][0];
        expect(firstCheckinCall.token).toBe(firstAttendee.qrCodeToken);
        expect(firstCheckinCall.isLoadTest).toBe(true);
        expect(firstCheckinCall.loadTestRunId).toBe('2');

        sleepSpy.mockRestore();
      });

      it('creates synthetic attendees booked for a different event date for NOT_BOOKED scenario', async () => {
        const sleepSpy = jest.spyOn(service, 'sleep').mockResolvedValue();

        await service.startTest(
          {
            scenario: LoadTestScenario.NOT_BOOKED,
            mode: LoadTestMode.DRY_RUN,
            simulatedUsers: 2,
            concurrency: 2,
            scanIntervalSeconds: 2,
            durationSeconds: 6,
            testDate: '2026-10-11',
            gateId: '1',
          } as any,
          BigInt(1),
        );

        await new Promise((resolve) => setImmediate(resolve));

        expect(prisma.attendee.createMany).toHaveBeenCalledTimes(1);
        const createCall = prisma.attendee.createMany.mock.calls[0][0];
        // 2 scanners × 3 cycles = 6 attendees
        expect(createCall.data).toHaveLength(6);
        // Booking days must not include the tested date (2026-10-11)
        expect(createCall.data[0].bookingDays).not.toContain('2026-10-11');
        expect(createCall.data[0].bookingDays).toEqual(['2026-10-12']);

        sleepSpy.mockRestore();
      });

      it('skips attendee creation entirely for INVALID_QR scenario', async () => {
        const sleepSpy = jest.spyOn(service, 'sleep').mockResolvedValue();

        await service.startTest(
          {
            scenario: LoadTestScenario.INVALID_QR,
            mode: LoadTestMode.DRY_RUN,
            simulatedUsers: 2,
            concurrency: 2,
            scanIntervalSeconds: 2,
            durationSeconds: 6,
            testDate: '2026-10-11',
            gateId: '1',
          } as any,
          BigInt(1),
        );

        await new Promise((resolve) => setImmediate(resolve));

        // No DB attendees should be created for INVALID_QR
        expect(prisma.attendee.createMany).not.toHaveBeenCalled();

        // 2 scanners × 3 cycles = 6 scans
        expect(checkinService.processCheckin).toHaveBeenCalledTimes(6);
        const checkinCall = checkinService.processCheckin.mock.calls[0][0];
        expect(checkinCall.token).toMatch(/^INVALID_TOKEN_/);

        sleepSpy.mockRestore();
      });

      it('never deletes historical daily check-ins or real attendees during test execution', async () => {
        const sleepSpy = jest.spyOn(service, 'sleep').mockResolvedValue();

        await service.startTest(
          {
            scenario: LoadTestScenario.NORMAL,
            mode: LoadTestMode.DRY_RUN,
            simulatedUsers: 2,
            concurrency: 2,
            scanIntervalSeconds: 2,
            durationSeconds: 6,
            testDate: '2026-10-11',
            gateId: '1',
          } as any,
          BigInt(1),
        );

        await new Promise((resolve) => setImmediate(resolve));

        // DailyCheckin records and Attendee records must not be deleted at start
        expect(prisma.dailyCheckin.deleteMany).not.toHaveBeenCalled();
        expect(prisma.attendee.deleteMany).not.toHaveBeenCalled();

        sleepSpy.mockRestore();
      });

      it('purges run-specific synthetic attendees when cleanupRun is called', async () => {
        const result = await service.cleanupRun(BigInt(99));
        expect(result.success).toBe(true);

        expect(prisma.attendee.deleteMany).toHaveBeenCalledWith({
          where: {
            qrCodeToken: {
              startsWith: 'LOADTEST-R99-',
            },
          },
        });
      });
    });
  });
});

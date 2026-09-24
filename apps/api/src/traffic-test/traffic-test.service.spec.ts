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
});

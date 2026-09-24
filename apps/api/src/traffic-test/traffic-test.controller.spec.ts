import { Test, TestingModule } from '@nestjs/testing';
import { TrafficTestController } from './traffic-test.controller';
import { TrafficTestService } from './traffic-test.service';
import { CheckinService } from '../checkin/checkin.service';
import { LoadTestMode, LoadTestScenario, LoadTestStatus, CheckinResult, UserRole } from '@ongc/shared-types';

describe('TrafficTestController', () => {
  let controller: TrafficTestController;
  let service: any;
  let checkinService: any;

  beforeEach(async () => {
    service = {
      listRuns: jest.fn().mockResolvedValue([{ id: '1', status: LoadTestStatus.COMPLETED }]),
      getRun: jest.fn().mockResolvedValue({ id: '1', status: LoadTestStatus.COMPLETED }),
      getRunStatus: jest.fn().mockResolvedValue({ id: '1', status: LoadTestStatus.COMPLETED }),
      startTest: jest.fn().mockResolvedValue({ success: true, runId: '2' }),
      stopRun: jest.fn().mockResolvedValue({ success: true, message: 'Load test run 1 stopped.' }),
      exportCsv: jest.fn().mockResolvedValue('Run ID,Timestamp,Token,Gate ID,Result,Response Time (ms)\r\n"1","2026-09-24T00:00:00.000Z","TOKEN","1","SUCCESS","10"'),
      cleanupRun: jest.fn().mockResolvedValue({ success: true, message: 'Load test run 1 and all associated data purged' }),
    };

    checkinService = {
      processCheckin: jest.fn().mockResolvedValue({
        success: true,
        result: CheckinResult.SUCCESS,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TrafficTestController],
      providers: [
        { provide: TrafficTestService, useValue: service },
        { provide: CheckinService, useValue: checkinService },
      ],
    }).compile();

    controller = module.get<TrafficTestController>(TrafficTestController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should list runs', async () => {
    const runs = await controller.listRuns();
    expect(runs).toBeDefined();
    expect(service.listRuns).toHaveBeenCalled();
  });

  it('should get run status', async () => {
    const status = await controller.getRunStatus('1');
    expect(status).toBeDefined();
    expect(service.getRunStatus).toHaveBeenCalledWith(BigInt(1));
  });

  it('should start test', async () => {
    const req = { user: { id: '1' } } as any;
    const dto = {
      scenario: LoadTestScenario.NORMAL,
      mode: LoadTestMode.DRY_RUN,
      simulatedUsers: 10,
      gateId: '1',
    };
    const result = await controller.startTest(dto, req);
    expect(result.success).toBe(true);
    expect(service.startTest).toHaveBeenCalledWith(dto, BigInt(1));
  });

  it('should stop run', async () => {
    const result = await controller.stopRun('1');
    expect(result.success).toBe(true);
    expect(service.stopRun).toHaveBeenCalledWith(BigInt(1));
  });

  it('should export CSV', async () => {
    const res = {
      setHeader: jest.fn(),
      send: jest.fn(),
    } as any;

    await controller.exportCsv('1', res);
    expect(service.exportCsv).toHaveBeenCalledWith(BigInt(1));
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
    expect(res.send).toHaveBeenCalled();
  });

  it('should cleanup run', async () => {
    const result = await controller.cleanupRun('1');
    expect(result.success).toBe(true);
    expect(service.cleanupRun).toHaveBeenCalledWith(BigInt(1));
  });

  describe('executeCheckin internal auth', () => {
    const originalSecret = process.env.LOAD_TEST_INTERNAL_SECRET;
    const dto = { token: 'ABC', gateId: '1' } as any;
    const req = {
      headers: { 'user-agent': 'jest' },
      socket: { remoteAddress: '127.0.0.1' },
    } as any;

    afterEach(() => {
      if (originalSecret === undefined) {
        delete process.env.LOAD_TEST_INTERNAL_SECRET;
      } else {
        process.env.LOAD_TEST_INTERNAL_SECRET = originalSecret;
      }
    });

    it('fails closed when LOAD_TEST_INTERNAL_SECRET is not configured, even with a header sent', async () => {
      delete process.env.LOAD_TEST_INTERNAL_SECRET;

      await expect(controller.executeCheckin(dto, 'anything', req)).rejects.toThrow(
        'Invalid load testing internal authorization',
      );
      expect(checkinService.processCheckin).not.toHaveBeenCalled();
    });

    it('rejects a request with a missing auth header', async () => {
      process.env.LOAD_TEST_INTERNAL_SECRET = 'correct-secret';

      await expect(controller.executeCheckin(dto, undefined, req)).rejects.toThrow(
        'Invalid load testing internal authorization',
      );
      expect(checkinService.processCheckin).not.toHaveBeenCalled();
    });

    it('rejects a request with an incorrect auth header', async () => {
      process.env.LOAD_TEST_INTERNAL_SECRET = 'correct-secret';

      await expect(controller.executeCheckin(dto, 'wrong-secret', req)).rejects.toThrow(
        'Invalid load testing internal authorization',
      );
      expect(checkinService.processCheckin).not.toHaveBeenCalled();
    });

    it('accepts a request with the correct auth header and runs the real check-in pipeline', async () => {
      process.env.LOAD_TEST_INTERNAL_SECRET = 'correct-secret';

      const result = await controller.executeCheckin(dto, 'correct-secret', req);

      expect(result.success).toBe(true);
      expect(checkinService.processCheckin).toHaveBeenCalledWith(
        { ...dto, isLoadTest: true },
        { id: '1', role: UserRole.ADMIN },
        expect.objectContaining({ userAgent: 'jest' }),
      );
    });
  });
});

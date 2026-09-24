import { Test, TestingModule } from '@nestjs/testing';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

describe('ReportsController', () => {
  let controller: ReportsController;
  let service: any;

  const mockReportsService = {
    getReportsPageData: jest.fn().mockResolvedValue({ totalAttendees: 10 }),
    buildReport: jest.fn().mockResolvedValue({ totalAttendees: 10 }),
    exportCsv: jest.fn().mockResolvedValue('test,csv,data'),
    getSummary: jest.fn().mockResolvedValue({ totalRegisteredPasses: 10 }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [
        { provide: ReportsService, useValue: mockReportsService },
      ],
    }).compile();

    controller = module.get<ReportsController>(ReportsController);
    service = module.get(ReportsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call getReportsPageData', async () => {
    const res = await controller.getReports({});
    expect(service.getReportsPageData).toHaveBeenCalled();
    expect(res).toEqual({ totalAttendees: 10 });
  });

  it('should call buildReport on print', async () => {
    const res = await controller.printReport({});
    expect(service.buildReport).toHaveBeenCalled();
    expect(res).toEqual({ totalAttendees: 10 });
  });

  it('should stream export csv', async () => {
    const mockRes = {
      setHeader: jest.fn(),
      send: jest.fn(),
    } as any;

    await controller.exportReport({}, 'categories', mockRes);
    expect(service.exportCsv).toHaveBeenCalled();
    expect(mockRes.send).toHaveBeenCalledWith('test,csv,data');
  });
});

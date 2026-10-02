import { Test, TestingModule } from '@nestjs/testing';
import { EmployeeMasterController } from './employee-master.controller';
import { EmployeeMasterService } from './employee-master.service';
import { MasterImportMode } from './dto/employee-master.dto';
import { BadRequestException } from '@nestjs/common';

describe('EmployeeMasterController', () => {
  let controller: EmployeeMasterController;
  let service: any;

  beforeEach(async () => {
    service = {
      listMasterRecords: jest.fn().mockResolvedValue({
        records: [],
        total: 0,
        page: 1,
        totalPages: 1,
        limit: 20,
        lastUpdated: null,
      }),
      validateFile: jest.fn().mockResolvedValue({
        success: true,
        fileName: 'test.csv',
        totalRows: 1,
        validCount: 1,
        invalidCount: 0,
        duplicateCount: 0,
        conflictCount: 0,
        identicalCount: 0,
        rows: [],
      }),
      executeImport: jest.fn().mockResolvedValue({
        success: true,
        mode: MasterImportMode.ADD_UPDATE,
        added: 1,
        unchanged: 0,
        conflicts: 0,
      }),
      exportMasterToCsv: jest.fn().mockResolvedValue('CPF NO,Mobile No\r\n12345,9876543210\r\n'),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmployeeMasterController],
      providers: [{ provide: EmployeeMasterService, useValue: service }],
    }).compile();

    controller = module.get<EmployeeMasterController>(EmployeeMasterController);
  });

  it('delegates list queries to service', async () => {
    const res = await controller.list({ page: 1, limit: 10, search: '12345' });
    expect(service.listMasterRecords).toHaveBeenCalledWith({
      page: 1,
      limit: 10,
      search: '12345',
    });
    expect(res.total).toBe(0);
  });

  it('validates file upload and rejects empty input', async () => {
    await expect(controller.validate(undefined, '', '')).rejects.toThrow(BadRequestException);

    const mockFile: any = {
      buffer: Buffer.from('CPF NO,Mobile No\n12345,9876543210\n'),
      originalname: 'upload.csv',
    };
    await controller.validate(mockFile);
    expect(service.validateFile).toHaveBeenCalledWith(mockFile.buffer, 'upload.csv');
  });

  it('delegates import execution to service with authenticated admin user', async () => {
    const req = { user: { id: '42', name: 'Admin', role: 'EMPLOYEE_ADMIN' } };
    const dto = {
      mode: MasterImportMode.ADD_UPDATE,
      rows: [{ cpfNo: '12345', mobileNo: '9876543210' }],
    };
    const res = await controller.importData(req, dto);
    expect(service.executeImport).toHaveBeenCalledWith(req.user, dto);
    expect(res.success).toBe(true);
  });

  it('streams CSV export with attachment headers', async () => {
    const mockRes: any = {
      setHeader: jest.fn(),
      send: jest.fn(),
    };
    await controller.export(mockRes);
    expect(service.exportMasterToCsv).toHaveBeenCalled();
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'text/csv; charset=utf-8',
    );
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      expect.stringContaining('attachment; filename="ongc_employee_master_export_'),
    );
    expect(mockRes.send).toHaveBeenCalledWith('CPF NO,Mobile No\r\n12345,9876543210\r\n');
  });
});

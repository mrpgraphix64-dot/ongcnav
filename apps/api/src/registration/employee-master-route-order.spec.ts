import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');
import { EmployeeMasterController } from './employee-master.controller';
import { EmployeesController } from './employees.controller';
import { EmployeeMasterService } from './employee-master.service';
import { EmployeesService } from './employees.service';
import { EmployeeDispatchSchedulerService } from './employee-dispatch-scheduler.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Reflector } from '@nestjs/core';

describe('Employee Master vs Employees Controller Route Disambiguation', () => {
  let app: INestApplication;
  let masterService: any;
  let employeesService: any;

  beforeAll(async () => {
    masterService = {
      listMasterRecords: jest.fn().mockResolvedValue({
        records: [{ id: '12345', cpfNo: '12345', mobileNo: '9876543210' }],
        total: 1,
        page: 1,
        totalPages: 1,
        limit: 20,
        lastUpdated: null,
      }),
      exportMasterToCsv: jest.fn().mockResolvedValue('CPF NO,Mobile No\r\n12345,9876543210\r\n'),
      validateFile: jest.fn(),
      executeImport: jest.fn(),
    };

    employeesService = {
      getEmployeeDetails: jest.fn().mockResolvedValue({
        id: '123',
        name: 'Regular Staff',
      }),
      exportEmployeesToCsv: jest.fn().mockResolvedValue({
        csv: 'EmployeeID,Name\r\n123,Regular Staff',
        filename: 'employees.csv',
      }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [
        // Crucial: EmployeeMasterController is registered before EmployeesController
        EmployeeMasterController,
        EmployeesController,
      ],
      providers: [
        Reflector,
        { provide: EmployeeMasterService, useValue: masterService },
        { provide: EmployeesService, useValue: employeesService },
        { provide: EmployeeDispatchSchedulerService, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /admin/employees/master routes to EmployeeMasterController and does NOT hit employees/:id', async () => {
    const response = await request(app.getHttpServer())
      .get('/admin/employees/master')
      .expect(200);

    expect(masterService.listMasterRecords).toHaveBeenCalled();
    expect(employeesService.getEmployeeDetails).not.toHaveBeenCalled();
    expect(response.body.records).toHaveLength(1);
    expect(response.body.records[0].cpfNo).toBe('12345');
  });

  it('GET /admin/employees/master/export routes to EmployeeMasterController.export', async () => {
    const response = await request(app.getHttpServer())
      .get('/admin/employees/master/export')
      .expect(200);

    expect(masterService.exportMasterToCsv).toHaveBeenCalled();
    expect(response.text).toContain('CPF NO,Mobile No');
  });

  it('GET /admin/employees/123 routes to EmployeesController.getEmployeeDetails with numeric ID', async () => {
    const response = await request(app.getHttpServer())
      .get('/admin/employees/123')
      .expect(200);

    expect(employeesService.getEmployeeDetails).toHaveBeenCalledWith(BigInt(123));
    expect(response.body.name).toBe('Regular Staff');
  });

  it('GET /admin/employees/export routes to EmployeesController.exportEmployees', async () => {
    const response = await request(app.getHttpServer())
      .get('/admin/employees/export')
      .expect(200);

    expect(employeesService.exportEmployeesToCsv).toHaveBeenCalled();
    expect(response.text).toContain('EmployeeID,Name');
  });
});

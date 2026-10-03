import { Test, TestingModule } from '@nestjs/testing';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { EmployeeDispatchSchedulerService } from './employee-dispatch-scheduler.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('EmployeesController ID & Routing Safety', () => {
  let controller: EmployeesController;
  let employeesService: any;
  let dispatchSchedulerService: any;

  beforeEach(async () => {
    employeesService = {
      getEmployeeDetails: jest.fn().mockResolvedValue({ id: '10', name: 'Test Employee' }),
      approveRegistration: jest.fn().mockResolvedValue({ success: true }),
      rejectRegistration: jest.fn().mockResolvedValue({ success: true }),
      getEmployeePass: jest.fn().mockResolvedValue({ passId: '10' }),
      bulkApproveRegistrations: jest.fn().mockResolvedValue({ approved: 2 }),
      bulkRejectRegistrations: jest.fn().mockResolvedValue({ rejected: 2 }),
      sendDailyPassEmails: jest.fn().mockResolvedValue({ sent: 1 }),
      listEmployees: jest.fn().mockResolvedValue({ records: [], total: 0 }),
      getPassSummary: jest.fn().mockResolvedValue({ totalPasses: 0 }),
      getDeliveryStats: jest.fn().mockResolvedValue({}),
      generateDailyPasses: jest.fn().mockResolvedValue({}),
      listDailyPasses: jest.fn().mockResolvedValue({ records: [] }),
      exportEmployeesToCsv: jest.fn().mockResolvedValue({ csv: '', filename: 'test.csv' }),
    };

    dispatchSchedulerService = {
      getScheduleForDate: jest.fn().mockResolvedValue(null),
      getAllSchedules: jest.fn().mockResolvedValue([]),
      upsertSchedule: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmployeesController],
      providers: [
        { provide: EmployeesService, useValue: employeesService },
        { provide: EmployeeDispatchSchedulerService, useValue: dispatchSchedulerService },
      ],
    }).compile();

    controller = module.get<EmployeesController>(EmployeesController);
  });

  describe('GET employees/:id Safety & Route Collision Prevention', () => {
    it('does NOT interpret "master" as an ID and throws NotFoundException without converting to BigInt', async () => {
      await expect(controller.getEmployeeDetails('master')).rejects.toThrow(NotFoundException);
      expect(employeesService.getEmployeeDetails).not.toHaveBeenCalled();
    });

    it('rejects non-numeric string IDs with BadRequestException without throwing BigInt conversion error', async () => {
      await expect(controller.getEmployeeDetails('abc')).rejects.toThrow(BadRequestException);
      await expect(controller.getEmployeeDetails('undefined')).rejects.toThrow(BadRequestException);
      await expect(controller.getEmployeeDetails('12a34')).rejects.toThrow(BadRequestException);
      expect(employeesService.getEmployeeDetails).not.toHaveBeenCalled();
    });

    it('successfully processes valid numeric string IDs by delegating BigInt to service', async () => {
      const res = await controller.getEmployeeDetails('10');
      expect(employeesService.getEmployeeDetails).toHaveBeenCalledWith(BigInt(10));
      expect(res).toEqual({ id: '10', name: 'Test Employee' });
    });
  });

  describe('POST employees/:id/approve & reject Safety', () => {
    it('rejects non-numeric ID in approveRegistration', async () => {
      await expect(controller.approveRegistration('invalid-id')).rejects.toThrow(BadRequestException);
      expect(employeesService.approveRegistration).not.toHaveBeenCalled();
    });

    it('approves registration for valid numeric ID', async () => {
      await controller.approveRegistration('42');
      expect(employeesService.approveRegistration).toHaveBeenCalledWith(BigInt(42));
    });

    it('rejects non-numeric ID in rejectRegistration', async () => {
      await expect(controller.rejectRegistration('bad-id')).rejects.toThrow(BadRequestException);
      expect(employeesService.rejectRegistration).not.toHaveBeenCalled();
    });

    it('rejects registration for valid numeric ID', async () => {
      await controller.rejectRegistration('42');
      expect(employeesService.rejectRegistration).toHaveBeenCalledWith(BigInt(42));
    });
  });

  describe('GET employees/:id/pass Safety', () => {
    it('rejects non-numeric ID in getEmployeePass', async () => {
      await expect(controller.getEmployeePass('non-numeric')).rejects.toThrow(BadRequestException);
      expect(employeesService.getEmployeePass).not.toHaveBeenCalled();
    });

    it('retrieves employee pass for valid numeric ID', async () => {
      await controller.getEmployeePass('99');
      expect(employeesService.getEmployeePass).toHaveBeenCalledWith(BigInt(99));
    });
  });

  describe('sendDailyPassEmails passId validation', () => {
    it('rejects non-numeric passId in sendDailyPassEmails', async () => {
      await expect(
        controller.sendDailyPassEmails({ eventDate: '2026-10-11', passId: 'invalid' }),
      ).rejects.toThrow(BadRequestException);
      expect(employeesService.sendDailyPassEmails).not.toHaveBeenCalled();
    });

    it('accepts valid numeric passId and converts to BigInt', async () => {
      await controller.sendDailyPassEmails({ eventDate: '2026-10-11', passId: '55' });
      expect(employeesService.sendDailyPassEmails).toHaveBeenCalledWith('2026-10-11', {
        retryFailedOnly: undefined,
        passId: BigInt(55),
      });
    });
  });
});

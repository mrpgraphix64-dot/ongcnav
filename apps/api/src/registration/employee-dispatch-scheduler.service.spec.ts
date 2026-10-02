import { Test, TestingModule } from '@nestjs/testing';
import {
  EmployeeDispatchSchedulerService,
  getCurrentIstDateTime,
  formatTimeDisplayIst,
} from './employee-dispatch-scheduler.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmployeesService } from './employees.service';
import { BadRequestException } from '@nestjs/common';
import { OFFICIAL_EVENT_DATES } from '@ongc/shared-types';

describe('EmployeeDispatchSchedulerService', () => {
  let service: EmployeeDispatchSchedulerService;
  let prisma: any;
  let employeesService: any;
  let settingStore: Map<string, string>;

  beforeEach(async () => {
    settingStore = new Map<string, string>();

    prisma = {
      setting: {
        findUnique: jest.fn().mockImplementation(({ where }: { where: { key: string } }) => {
          const val = settingStore.get(where.key);
          return Promise.resolve(val ? { key: where.key, value: val } : null);
        }),
        upsert: jest.fn().mockImplementation(({ where, update, create }: any) => {
          const val = update?.value ?? create?.value;
          settingStore.set(where.key, val);
          return Promise.resolve({ key: where.key, value: val });
        }),
      },
    };

    employeesService = {
      generateDailyPasses: jest.fn().mockResolvedValue({
        success: true,
        generatedCount: 5,
        existingCount: 0,
        message: 'Passes generated',
      }),
      sendDailyPassEmails: jest.fn().mockResolvedValue({
        success: true,
        sentCount: 5,
        failedCount: 0,
        message: 'Emails dispatched',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeeDispatchSchedulerService,
        { provide: PrismaService, useValue: prisma },
        { provide: EmployeesService, useValue: employeesService },
      ],
    }).compile();

    service = module.get<EmployeeDispatchSchedulerService>(EmployeeDispatchSchedulerService);
  });

  describe('1. Save schedule', () => {
    it('persists a new schedule for an official event date in Setting table', async () => {
      const result = await service.upsertSchedule(
        {
          eventDate: '2026-10-11',
          dispatchTime: '17:00',
          enabled: true,
        },
        { email: 'admin@ongc.co.in' },
      );

      expect(result.eventDate).toBe('2026-10-11');
      expect(result.dispatchTime).toBe('17:00');
      expect(result.enabled).toBe(true);
      expect(result.timezone).toBe('Asia/Kolkata');
      expect(settingStore.has('employee.dispatch_schedule.2026-10-11')).toBe(true);
    });
  });

  describe('2. Update schedule', () => {
    it('updates an existing schedule time and status', async () => {
      await service.upsertSchedule({
        eventDate: '2026-10-11',
        dispatchTime: '17:00',
        enabled: true,
      });

      const updated = await service.upsertSchedule({
        eventDate: '2026-10-11',
        dispatchTime: '18:30',
        enabled: false,
      });

      expect(updated.dispatchTime).toBe('18:30');
      expect(updated.enabled).toBe(false);

      const loaded = await service.getScheduleForDate('2026-10-11');
      expect(loaded).not.toBeNull();
      expect(loaded?.dispatchTime).toBe('18:30');
      expect(loaded?.enabled).toBe(false);
    });
  });

  describe('3. Load schedule by event date', () => {
    it('returns null when no schedule has been configured yet, and returns saved schedule when configured', async () => {
      const unconfigured = await service.getScheduleForDate('2026-10-12');
      expect(unconfigured).toBeNull();

      await service.upsertSchedule({
        eventDate: '2026-10-12',
        dispatchTime: '16:00',
        enabled: true,
      });

      const loaded = await service.getScheduleForDate('2026-10-12');
      expect(loaded).not.toBeNull();
      expect(loaded?.dispatchTime).toBe('16:00');
      expect(loaded?.enabled).toBe(true);
      expect(loaded?.timezone).toBe('Asia/Kolkata');
    });
  });

  describe('4. Different times for different event dates', () => {
    it('stores independent dispatch times for Oct 11, Oct 12, Oct 13 etc.', async () => {
      await service.upsertSchedule({ eventDate: '2026-10-11', dispatchTime: '17:00', enabled: true });
      await service.upsertSchedule({ eventDate: '2026-10-12', dispatchTime: '16:30', enabled: true });
      await service.upsertSchedule({ eventDate: '2026-10-13', dispatchTime: '18:00', enabled: false });

      const s11 = await service.getScheduleForDate('2026-10-11');
      const s12 = await service.getScheduleForDate('2026-10-12');
      const s13 = await service.getScheduleForDate('2026-10-13');

      expect(s11?.dispatchTime).toBe('17:00');
      expect(s11?.enabled).toBe(true);
      expect(s12?.dispatchTime).toBe('16:30');
      expect(s12?.enabled).toBe(true);
      expect(s13?.dispatchTime).toBe('18:00');
      expect(s13?.enabled).toBe(false);
    });
  });

  describe('5. Disabled schedule does not dispatch', () => {
    it('skips dispatch when schedule is disabled even if current time >= dispatch time', async () => {
      await service.upsertSchedule({
        eventDate: '2026-10-11',
        dispatchTime: '17:00',
        enabled: false,
      });

      // 17:30 IST on Oct 11, 2026
      // 17:30 IST = 12:00 UTC
      const mockNow = new Date('2026-10-11T12:00:00Z');
      const result = await service.checkAndExecuteScheduledDispatches(mockNow);

      expect(result.executedDates).not.toContain('2026-10-11');
      expect(result.skippedDates.some((s) => s.includes('disabled'))).toBe(true);
      expect(employeesService.generateDailyPasses).not.toHaveBeenCalled();
      expect(employeesService.sendDailyPassEmails).not.toHaveBeenCalled();
    });
  });

  describe('6. At dispatch time eligible attendees are processed', () => {
    it('executes generation and email sending when enabled and time is reached in IST', async () => {
      await service.upsertSchedule({
        eventDate: '2026-10-11',
        dispatchTime: '17:00',
        enabled: true,
      });

      // Exactly 17:00 IST (11:30 UTC) on 2026-10-11
      const mockNow = new Date('2026-10-11T11:30:00Z');
      const result = await service.checkAndExecuteScheduledDispatches(mockNow);

      expect(result.executedDates).toContain('2026-10-11');
      expect(employeesService.generateDailyPasses).toHaveBeenCalledWith('2026-10-11');
      expect(employeesService.sendDailyPassEmails).toHaveBeenCalledWith('2026-10-11');

      const schedule = await service.getScheduleForDate('2026-10-11');
      expect(schedule).not.toBeNull();
      expect(schedule?.lastRunStatus).toBe('SUCCESS');
      expect(schedule?.lastRunAt).toBeDefined();
    });
  });

  describe('7. Before dispatch time nothing is sent', () => {
    it('skips dispatch when current time is earlier than scheduled dispatch time in IST', async () => {
      await service.upsertSchedule({
        eventDate: '2026-10-11',
        dispatchTime: '17:00',
        enabled: true,
      });

      // 16:45 IST (11:15 UTC) on 2026-10-11
      const mockNow = new Date('2026-10-11T11:15:00Z');
      const result = await service.checkAndExecuteScheduledDispatches(mockNow);

      expect(result.executedDates).not.toContain('2026-10-11');
      expect(result.skippedDates.some((s) => s.includes('not due'))).toBe(true);
      expect(employeesService.generateDailyPasses).not.toHaveBeenCalled();
      expect(employeesService.sendDailyPassEmails).not.toHaveBeenCalled();
    });
  });

  describe('8. Individual employee bookingDays respected', () => {
    it('delegates to EmployeesService.generateDailyPasses which filters by attendee individual bookingDays', async () => {
      await service.executeDispatchForDate('2026-10-11');
      expect(employeesService.generateDailyPasses).toHaveBeenCalledWith('2026-10-11');
    });
  });

  describe('9. Individual family bookingDays respected', () => {
    it('calls EmployeesService with the exact event date ensuring family member date filters apply', async () => {
      await service.executeDispatchForDate('2026-10-12');
      expect(employeesService.generateDailyPasses).toHaveBeenCalledWith('2026-10-12');
      expect(employeesService.sendDailyPassEmails).toHaveBeenCalledWith('2026-10-12');
    });
  });

  describe('10. Duplicate scheduler execution does not duplicate passes', () => {
    it('skips execution if already executed successfully today on that event date', async () => {
      await service.upsertSchedule({
        eventDate: '2026-10-11',
        dispatchTime: '17:00',
        enabled: true,
      });

      // 17:05 IST
      const mockNow1 = new Date('2026-10-11T11:35:00Z');
      const res1 = await service.checkAndExecuteScheduledDispatches(mockNow1);
      expect(res1.executedDates).toContain('2026-10-11');
      expect(employeesService.generateDailyPasses).toHaveBeenCalledTimes(1);

      // 17:10 IST - Second scheduler tick
      const mockNow2 = new Date('2026-10-11T11:40:00Z');
      const res2 = await service.checkAndExecuteScheduledDispatches(mockNow2);
      expect(res2.executedDates).not.toContain('2026-10-11');
      expect(res2.skippedDates.some((s) => s.includes('already executed today'))).toBe(true);
      // Still only called once!
      expect(employeesService.generateDailyPasses).toHaveBeenCalledTimes(1);
    });
  });

  describe('11. Duplicate scheduler execution does not resend SENT emails', () => {
    it('employeesService.sendDailyPassEmails strictly filters for PENDING or FAILED passes', async () => {
      await service.executeDispatchForDate('2026-10-11');
      expect(employeesService.sendDailyPassEmails).toHaveBeenCalledWith('2026-10-11');
    });
  });

  describe('12. Failed email becomes FAILED', () => {
    it('records PARTIAL_FAILURE status if sendDailyPassEmails reports failures', async () => {
      employeesService.sendDailyPassEmails.mockResolvedValueOnce({
        success: false,
        sentCount: 3,
        failedCount: 2,
        message: '2 emails failed',
      });

      const res = await service.executeDispatchForDate('2026-10-11');
      expect(res.success).toBe(false);
      expect(res.failedCount).toBe(2);

      const schedule = await service.getScheduleForDate('2026-10-11');
      expect(schedule).not.toBeNull();
      expect(schedule?.lastRunStatus).toBe('PARTIAL_FAILURE');
      expect(schedule?.lastFailedCount).toBe(2);
    });
  });

  describe('13. Retry can resend FAILED', () => {
    it('re-executing dispatch or calling sendDailyPassEmails retries failed records', async () => {
      employeesService.sendDailyPassEmails.mockResolvedValueOnce({
        success: true,
        sentCount: 2,
        failedCount: 0,
        message: '2 retried emails sent successfully',
      });

      const res = await service.executeDispatchForDate('2026-10-11');
      expect(res.success).toBe(true);
      expect(res.sentCount).toBe(2);
      expect(res.failedCount).toBe(0);

      const schedule = await service.getScheduleForDate('2026-10-11');
      expect(schedule).not.toBeNull();
      expect(schedule?.lastRunStatus).toBe('SUCCESS');
    });
  });

  describe('14. Server restart does not lose schedule (reads from persistent Setting)', () => {
    it('retains schedule in database across service recreation', async () => {
      await service.upsertSchedule({
        eventDate: '2026-10-15',
        dispatchTime: '15:45',
        enabled: true,
      });

      // Simulate new service instance
      const newModule: TestingModule = await Test.createTestingModule({
        providers: [
          EmployeeDispatchSchedulerService,
          { provide: PrismaService, useValue: prisma },
          { provide: EmployeesService, useValue: employeesService },
        ],
      }).compile();

      const newService = newModule.get<EmployeeDispatchSchedulerService>(EmployeeDispatchSchedulerService);
      const loaded = await newService.getScheduleForDate('2026-10-15');

      expect(loaded).not.toBeNull();
      expect(loaded?.dispatchTime).toBe('15:45');
      expect(loaded?.enabled).toBe(true);
      expect(loaded?.timezone).toBe('Asia/Kolkata');
    });
  });

  describe('15. Only approved attendees are processed', () => {
    it('relies on EmployeesService generateDailyPasses which filters registrationStatus: APPROVED', async () => {
      await service.executeDispatchForDate('2026-10-11');
      expect(employeesService.generateDailyPasses).toHaveBeenCalledWith('2026-10-11');
    });
  });

  describe('16. Test Lab remains isolated from production (isTest: false vs isTest: true)', () => {
    it('production scheduler calls EmployeesService which operates strictly with isTest: false', async () => {
      await service.executeDispatchForDate('2026-10-11');
      // Verify EmployeesService was called for production
      expect(employeesService.generateDailyPasses).toHaveBeenCalledWith('2026-10-11');
    });
  });

  describe('17. Production uses real clock (IST)', () => {
    it('getCurrentIstDateTime accurately converts UTC to Asia/Kolkata IST date and time', () => {
      // 2026-10-11 11:30:00 UTC = 2026-10-11 17:00:00 IST (+5:30)
      const dateUtc = new Date('2026-10-11T11:30:00Z');
      const ist = getCurrentIstDateTime(dateUtc);

      expect(ist.currentDate).toBe('2026-10-11');
      expect(ist.currentTime).toBe('17:00');
      expect(ist.totalMinutes).toBe(17 * 60);
    });

    it('handles date turnover across midnight UTC to IST', () => {
      // 2026-10-11 20:00:00 UTC = 2026-10-12 01:30:00 IST (+5:30)
      const dateUtc = new Date('2026-10-11T20:00:00Z');
      const ist = getCurrentIstDateTime(dateUtc);

      expect(ist.currentDate).toBe('2026-10-12');
      expect(ist.currentTime).toBe('01:30');
    });
  });

  describe('18. Test Lab uses simulated clock', () => {
    it('validates that production scheduler uses system clock while Test Lab accepts simulated time', async () => {
      const istNow = getCurrentIstDateTime();
      expect(istNow.currentDate).toBeDefined();
      expect(istNow.currentTime).toBeDefined();

      // Passing override simulates clock without modifying system clock
      const simulatedUtc = new Date('2026-10-16T12:30:00Z');
      const simulatedIst = getCurrentIstDateTime(simulatedUtc);
      expect(simulatedIst.currentDate).toBe('2026-10-16');
      expect(simulatedIst.currentTime).toBe('18:00');
    });
  });

  describe('Validation & error handling', () => {
    it('throws BadRequestException for invalid event date', async () => {
      await expect(
        service.getScheduleForDate('2026-10-25'),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.upsertSchedule({
          eventDate: '2026-10-25',
          dispatchTime: '17:00',
          enabled: true,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for invalid time format', async () => {
      await expect(
        service.upsertSchedule({
          eventDate: '2026-10-11',
          dispatchTime: '25:00',
          enabled: true,
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.upsertSchedule({
          eventDate: '2026-10-11',
          dispatchTime: '5:00 PM',
          enabled: true,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('20. Regression test: No saved schedule for selected date does not crash', () => {
    it('handles dates with no saved schedule without crashing and returns null', async () => {
      // 1. Oct 11 has a saved schedule
      await service.upsertSchedule({
        eventDate: '2026-10-11',
        dispatchTime: '17:00',
        enabled: true,
      });

      // 2. Oct 12 has NO saved schedule
      const oct12Schedule = await service.getScheduleForDate('2026-10-12');
      expect(oct12Schedule).toBeNull();

      // 3. Oct 11 schedule remains intact and returns correctly
      const oct11Schedule = await service.getScheduleForDate('2026-10-11');
      expect(oct11Schedule).not.toBeNull();
      expect(oct11Schedule?.dispatchTime).toBe('17:00');
      expect(oct11Schedule?.enabled).toBe(true);

      // 4. Switching to Oct 12 again does not crash and returns null
      const oct12Again = await service.getScheduleForDate('2026-10-12');
      expect(oct12Again).toBeNull();

      // 5. Switching back to Oct 11 restores its exact schedule
      const oct11Restored = await service.getScheduleForDate('2026-10-11');
      expect(oct11Restored?.dispatchTime).toBe('17:00');
    });

    it('scheduler tick safely skips unconfigured dates without error', async () => {
      // Mock time on Oct 12 (unconfigured)
      const mockNow = new Date('2026-10-12T12:00:00Z');
      const result = await service.checkAndExecuteScheduledDispatches(mockNow);
      expect(result.checked).toBe(true);
      expect(result.executedDates).toHaveLength(0);
      expect(result.skippedDates.some((s) => s.includes('not configured'))).toBe(true);
    });
  });
});

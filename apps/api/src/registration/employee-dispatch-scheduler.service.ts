import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmployeesService } from './employees.service';
import {
  OFFICIAL_EVENT_DATES,
  isOfficialEventDate,
  DEFAULT_DISPATCH_SCHEDULE,
  EmployeeDispatchSchedule,
} from '@ongc/shared-types';
import { UpsertDispatchScheduleDto } from './dto/dispatch-schedule.dto';

export function getCurrentIstDateTime(overrideDate?: Date): {
  currentDate: string;
  currentTime: string;
  totalMinutes: number;
} {
  const date = overrideDate || new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '';

  const currentDate = `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
  const hour = parseInt(getPart('hour'), 10) || 0;
  const minute = parseInt(getPart('minute'), 10) || 0;
  const currentTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  const totalMinutes = hour * 60 + minute;

  return { currentDate, currentTime, totalMinutes };
}

export function formatTimeDisplayIst(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  return d.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

@Injectable()
export class EmployeeDispatchSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmployeeDispatchSchedulerService.name);
  private timerRef: NodeJS.Timeout | null = null;
  private isProcessing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly employeesService: EmployeesService,
  ) {}

  onModuleInit() {
    // Only start interval if not explicitly disabled
    if (process.env.DISABLE_DISPATCH_SCHEDULER !== 'true') {
      this.timerRef = setInterval(() => {
        this.checkAndExecuteScheduledDispatches().catch((err) => {
          this.logger.error(`Error in scheduled dispatch tick: ${err.message}`, err.stack);
        });
      }, 30000);

      // Unref timer so it does not block application teardown or testing
      if (this.timerRef && typeof this.timerRef.unref === 'function') {
        this.timerRef.unref();
      }

      this.logger.log('Employee daily QR pass dispatch scheduler initialized (polling every 30s in Asia/Kolkata IST).');
    }
  }

  onModuleDestroy() {
    if (this.timerRef) {
      clearInterval(this.timerRef);
      this.timerRef = null;
    }
  }

  /**
   * Retrieves the dispatch schedule for a specific event date.
   * If not yet saved in database, returns default schedule settings based on DEFAULT_DISPATCH_SCHEDULE.
   */
  async getScheduleForDate(eventDate: string): Promise<EmployeeDispatchSchedule> {
    if (!eventDate || !isOfficialEventDate(eventDate)) {
      throw new BadRequestException(
        `Invalid event date: "${eventDate}". Allowed dates: ${OFFICIAL_EVENT_DATES.join(', ')}`,
      );
    }

    const key = `employee.dispatch_schedule.${eventDate}`;
    const setting = await this.prisma.setting.findUnique({
      where: { key },
    });

    if (setting?.value) {
      try {
        const parsed = JSON.parse(setting.value);
        return {
          eventDate,
          dispatchTime: parsed.dispatchTime || DEFAULT_DISPATCH_SCHEDULE[eventDate] || '18:00',
          timezone: parsed.timezone || 'Asia/Kolkata',
          enabled: Boolean(parsed.enabled),
          createdAt: parsed.createdAt || null,
          updatedAt: parsed.updatedAt || null,
          lastRunAt: parsed.lastRunAt || null,
          lastRunStatus: parsed.lastRunStatus || null,
          lastRunMessage: parsed.lastRunMessage || null,
          lastSentCount: parsed.lastSentCount ?? 0,
          lastFailedCount: parsed.lastFailedCount ?? 0,
        };
      } catch {
        // Fall through to default if invalid JSON
      }
    }

    return {
      eventDate,
      dispatchTime: DEFAULT_DISPATCH_SCHEDULE[eventDate] || '18:00',
      timezone: 'Asia/Kolkata',
      enabled: false,
      createdAt: null,
      updatedAt: null,
      lastRunAt: null,
      lastRunStatus: null,
      lastRunMessage: null,
      lastSentCount: 0,
      lastFailedCount: 0,
    };
  }

  /**
   * Retrieves dispatch schedules for all official event dates.
   */
  async getAllSchedules(): Promise<EmployeeDispatchSchedule[]> {
    const list: EmployeeDispatchSchedule[] = [];
    for (const date of OFFICIAL_EVENT_DATES) {
      const item = await this.getScheduleForDate(date);
      list.push(item);
    }
    return list;
  }

  /**
   * Upserts the dispatch schedule for a specific event date.
   */
  async upsertSchedule(
    dto: UpsertDispatchScheduleDto,
    adminUser?: any,
  ): Promise<EmployeeDispatchSchedule> {
    if (!dto.eventDate || !isOfficialEventDate(dto.eventDate)) {
      throw new BadRequestException(
        `Invalid event date: "${dto.eventDate}". Allowed dates: ${OFFICIAL_EVENT_DATES.join(', ')}`,
      );
    }

    const dispatchTime = (dto.dispatchTime || '').trim();
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(dispatchTime)) {
      throw new BadRequestException('dispatchTime must be in HH:mm 24-hour format (e.g. 17:00).');
    }

    const key = `employee.dispatch_schedule.${dto.eventDate}`;
    const existing = await this.getScheduleForDate(dto.eventDate);
    const nowIso = new Date().toISOString();

    const updatedSchedule: EmployeeDispatchSchedule = {
      eventDate: dto.eventDate,
      dispatchTime,
      timezone: 'Asia/Kolkata',
      enabled: Boolean(dto.enabled),
      createdAt: existing.createdAt || nowIso,
      updatedAt: nowIso,
      lastRunAt: existing.lastRunAt || null,
      lastRunStatus: existing.lastRunStatus || null,
      lastRunMessage: existing.lastRunMessage || null,
      lastSentCount: existing.lastSentCount ?? 0,
      lastFailedCount: existing.lastFailedCount ?? 0,
    };

    await this.prisma.setting.upsert({
      where: { key },
      update: { value: JSON.stringify(updatedSchedule) },
      create: { key, value: JSON.stringify(updatedSchedule) },
    });

    // Also update aggregated mapping in employee.dispatch_schedule for fast cross-system lookup
    await this.syncAggregatedMap();

    this.logger.log(
      `[DISPATCH_SCHEDULE] Saved schedule for ${dto.eventDate}: ${dispatchTime} IST (enabled=${dto.enabled}) by admin ${adminUser?.email || 'SYSTEM'}`,
    );

    return updatedSchedule;
  }

  /**
   * Syncs the consolidated employee.dispatch_schedule JSON map in settings
   * to guarantee Test Lab and any background service reads the latest times.
   */
  async syncAggregatedMap(): Promise<Record<string, string>> {
    const map: Record<string, string> = { ...DEFAULT_DISPATCH_SCHEDULE };
    for (const d of OFFICIAL_EVENT_DATES) {
      const sched = await this.getScheduleForDate(d);
      map[d] = sched.dispatchTime;
    }

    try {
      await this.prisma.setting.upsert({
        where: { key: 'employee.dispatch_schedule' },
        update: { value: JSON.stringify(map) },
        create: { key: 'employee.dispatch_schedule', value: JSON.stringify(map) },
      });
    } catch (err: any) {
      this.logger.warn(`Failed to sync aggregated dispatch schedule map: ${err.message}`);
    }

    return map;
  }

  /**
   * Executes the full QR pass generation and email dispatch for a given event date.
   * Completely idempotent:
   *  - generateDailyPasses will not create duplicate passes.
   *  - sendDailyPassEmails will not resend already SENT passes.
   */
  async executeDispatchForDate(
    eventDate: string,
    overrideNow?: Date,
  ): Promise<{
    success: boolean;
    eventDate: string;
    generatedCount: number;
    sentCount: number;
    failedCount: number;
    message: string;
  }> {
    if (!eventDate || !isOfficialEventDate(eventDate)) {
      throw new BadRequestException(`Invalid event date: "${eventDate}"`);
    }

    this.logger.log(`[AUTOMATIC DISPATCH] Starting scheduled dispatch execution for ${eventDate}`);

    // Step 1: Generate passes for all eligible attendees
    const genResult = await this.employeesService.generateDailyPasses(eventDate);

    // Step 2: Send emails for all passes that are PENDING or FAILED
    const sendResult = await this.employeesService.sendDailyPassEmails(eventDate);

    const now = overrideNow || new Date();
    const timeDisplay = formatTimeDisplayIst(now);
    let status: 'SUCCESS' | 'PARTIAL_FAILURE' | 'FAILED' = 'SUCCESS';
    let summaryMessage = `Automatic dispatch completed at ${timeDisplay} IST.`;

    if (sendResult.failedCount > 0) {
      status = 'PARTIAL_FAILURE';
      summaryMessage = `Automatic dispatch completed — ${sendResult.failedCount} email(s) failed.`;
    }

    // Step 3: Record dispatch execution result in the date's persistent schedule record
    const schedule = await this.getScheduleForDate(eventDate);
    schedule.lastRunAt = now.toISOString();
    schedule.lastRunStatus = status;
    schedule.lastRunMessage = summaryMessage;
    schedule.lastSentCount = sendResult.sentCount;
    schedule.lastFailedCount = sendResult.failedCount;
    schedule.updatedAt = now.toISOString();

    await this.prisma.setting.upsert({
      where: { key: `employee.dispatch_schedule.${eventDate}` },
      update: { value: JSON.stringify(schedule) },
      create: { key: `employee.dispatch_schedule.${eventDate}`, value: JSON.stringify(schedule) },
    });

    this.logger.log(
      `[AUTOMATIC DISPATCH] Completed execution for ${eventDate}: ${genResult.generatedCount} generated, ${sendResult.sentCount} sent, ${sendResult.failedCount} failed.`,
    );

    return {
      success: sendResult.failedCount === 0,
      eventDate,
      generatedCount: genResult.generatedCount,
      sentCount: sendResult.sentCount,
      failedCount: sendResult.failedCount,
      message: summaryMessage,
    };
  }

  /**
   * Evaluates current IST date/time against enabled dispatch schedules and executes if due.
   * Can be passed an optional override date for testing.
   */
  async checkAndExecuteScheduledDispatches(overrideNow?: Date): Promise<{
    checked: boolean;
    executedDates: string[];
    skippedDates: string[];
  }> {
    if (this.isProcessing) {
      return { checked: false, executedDates: [], skippedDates: [] };
    }

    this.isProcessing = true;
    const executedDates: string[] = [];
    const skippedDates: string[] = [];

    try {
      const { currentDate, currentTime, totalMinutes: currentMinutes } = getCurrentIstDateTime(overrideNow);

      // Only evaluate if currentDate is an official event date
      if (!isOfficialEventDate(currentDate)) {
        return { checked: true, executedDates, skippedDates };
      }

      const schedule = await this.getScheduleForDate(currentDate);

      // Schedule must be enabled
      if (!schedule.enabled) {
        skippedDates.push(`${currentDate} (disabled)`);
        return { checked: true, executedDates, skippedDates };
      }

      // Parse schedule dispatch time (HH:mm)
      const [schedH, schedM] = schedule.dispatchTime.split(':').map((v) => parseInt(v, 10) || 0);
      const scheduleMinutes = schedH * 60 + schedM;

      // Check if current time has reached or passed dispatch time
      if (currentMinutes < scheduleMinutes) {
        skippedDates.push(`${currentDate} (not due: ${currentTime} < ${schedule.dispatchTime})`);
        return { checked: true, executedDates, skippedDates };
      }

      // Check if already executed successfully today in IST
      if (schedule.lastRunAt && schedule.lastRunStatus === 'SUCCESS') {
        const lastRunIst = getCurrentIstDateTime(new Date(schedule.lastRunAt));
        if (lastRunIst.currentDate === currentDate) {
          skippedDates.push(`${currentDate} (already executed today at ${schedule.lastRunAt})`);
          return { checked: true, executedDates, skippedDates };
        }
      }

      // Condition satisfied: Trigger automatic dispatch!
      await this.executeDispatchForDate(currentDate, overrideNow);
      executedDates.push(currentDate);
    } finally {
      this.isProcessing = false;
    }

    return { checked: true, executedDates, skippedDates };
  }
}

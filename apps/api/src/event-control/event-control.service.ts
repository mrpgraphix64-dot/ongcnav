import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EventControlService {
  private readonly logger = new Logger(EventControlService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Determine active operational date in India Standard Time (Asia/Kolkata).
   */
  async getActiveEventDate(): Promise<string> {
    const override = await this.getSetting('event_control.active_event_date');
    if (override && override.trim() !== '') {
      return override.trim();
    }

    // Evaluate current date in Asia/Kolkata (UTC+05:30)
    const now = new Date();
    const istTimeStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // Format: YYYY-MM-DD
    return istTimeStr;
  }

  async getSetting(key: string, defaultValue = ''): Promise<string> {
    const setting = await this.prisma.setting.findUnique({
      where: { key },
    });
    return setting?.value ?? defaultValue;
  }

  async setSetting(key: string, value: string): Promise<void> {
    await this.prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  async getStatus() {
    const activeDate = await this.getActiveEventDate();
    const eventStatus = await this.getSetting('event_control.event_status', 'open');
    const scanningEnabled = (await this.getSetting('event_control.scanning_enabled', '1')) === '1';
    const emergencyStopped = (await this.getSetting('event_control.emergency_stopped', '0')) === '1';

    return {
      activeDate,
      eventStatus: eventStatus as 'open' | 'closed',
      scanningEnabled: scanningEnabled && !emergencyStopped,
      emergencyStopped,
    };
  }

  async toggleEventStatus(userId?: bigint) {
    const current = await this.getSetting('event_control.event_status', 'open');
    const next = current === 'open' ? 'closed' : 'open';
    await this.setSetting('event_control.event_status', next);

    await this.prisma.auditLog.create({
      data: {
        action: next === 'open' ? 'event_opened' : 'event_closed',
        userId,
        details: { reason: `Event status changed to ${next}` },
      },
    });

    return { success: true, eventStatus: next };
  }

  async toggleScanning(userId?: bigint) {
    const current = (await this.getSetting('event_control.scanning_enabled', '1')) === '1';
    const next = !current;
    await this.setSetting('event_control.scanning_enabled', next ? '1' : '0');

    await this.prisma.auditLog.create({
      data: {
        action: next ? 'scanning_enabled' : 'scanning_disabled',
        userId,
        details: { reason: `System scanning was ${next ? 'enabled' : 'disabled'}` },
      },
    });

    return { success: true, scanningEnabled: next };
  }

  async emergencyStop(reason: string, userId?: bigint) {
    await this.setSetting('event_control.emergency_stopped', '1');
    await this.setSetting('event_control.scanning_enabled', '0');

    await this.prisma.auditLog.create({
      data: {
        action: 'emergency_stopped',
        userId,
        details: { reason: reason || 'Emergency stop initiated from Event Control console' },
      },
    });

    return { success: true, emergencyStopped: true };
  }

  async emergencyResume(userId?: bigint) {
    await this.setSetting('event_control.emergency_stopped', '0');
    await this.setSetting('event_control.scanning_enabled', '1');

    await this.prisma.auditLog.create({
      data: {
        action: 'emergency_resumed',
        userId,
        details: { reason: 'Emergency stop cleared and normal scanning resumed' },
      },
    });

    return { success: true, emergencyStopped: false, scanningEnabled: true };
  }

  async setDate(date: string, userId?: bigint) {
    const cleanDate = date?.trim() || '';
    await this.setSetting('event_control.active_event_date', cleanDate);

    await this.prisma.auditLog.create({
      data: {
        action: 'event_date_changed',
        userId,
        details: {
          reason: cleanDate
            ? `Active event operational date set to ${cleanDate}`
            : 'Active event operational date reset to current system date',
        },
      },
    });

    return { success: true, activeDate: cleanDate || (await this.getActiveEventDate()) };
  }
}

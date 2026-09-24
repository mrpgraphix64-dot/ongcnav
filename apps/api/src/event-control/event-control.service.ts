import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@ongc/shared-types';

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

  /**
   * Lightweight status summary (used by dashboard and scanner header).
   */
  async getStatus() {
    const activeDate = await this.getActiveEventDate();
    const eventStatus = await this.getSetting('event_control.event_status', 'open');
    const scanningEnabled = (await this.getSetting('event_control.scanning_enabled', '1')) === '1';
    const emergencyStopped = (await this.getSetting('event_control.emergency_stopped', '0')) === '1';
    const emergencyReason = emergencyStopped
      ? await this.getSetting('event_control.emergency_stop_reason', 'Emergency stop active across all gates')
      : null;

    return {
      activeDate,
      eventStatus: eventStatus as 'open' | 'closed',
      scanningEnabled: scanningEnabled && !emergencyStopped,
      rawScanningEnabled: scanningEnabled,
      emergencyStopped,
      emergencyReason,
    };
  }

  /**
   * Complete Event Control Console overview with real operational metrics,
   * live KPIs, per-gate status & capacity, and latest 15 audit trail records.
   */
  async getConsoleOverview() {
    const activeDate = await this.getActiveEventDate();
    const manualDateSetting = await this.getSetting('event_control.active_event_date', '');
    const isManualDateOverride = manualDateSetting.trim() !== '';

    const eventStatus = (await this.getSetting('event_control.event_status', 'open')) as 'open' | 'closed';
    const scanningEnabled = (await this.getSetting('event_control.scanning_enabled', '1')) === '1';
    const emergencyStopped = (await this.getSetting('event_control.emergency_stopped', '0')) === '1';
    const emergencyReason = emergencyStopped
      ? await this.getSetting('event_control.emergency_stop_reason', 'Emergency stop active across all gates')
      : null;

    // 1. Attendees total & booked for today
    const totalRegistered = await this.prisma.attendee.count();

    const attendees = await this.prisma.attendee.findMany({
      select: {
        id: true,
        employee: {
          select: {
            bookingDays: true,
          },
        },
      },
    });

    const bookedForToday = attendees.filter((a) => {
      if (!a.employee) return true; // Standalone attendee is registered for event
      const days = Array.isArray(a.employee.bookingDays)
        ? (a.employee.bookingDays as string[])
        : [];
      return days.includes(activeDate);
    }).length;

    // 2. Check-ins today
    const checkedInToday = await this.prisma.dailyCheckin.count({
      where: {
        eventDate: activeDate,
        status: 'SUCCESS' as any,
        isLoadTest: false,
      },
    });

    const pendingToday = Math.max(0, bookedForToday - checkedInToday);
    const attendanceRate =
      bookedForToday > 0
        ? Number(((checkedInToday / bookedForToday) * 100).toFixed(1))
        : 0;

    // 3. Gates and per-gate live metrics
    const gates = await this.prisma.gate.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { id: 'asc' },
    });

    const openGatesCount = gates.filter((g) => g.isOpen).length;

    const gateCheckinCounts = await this.prisma.dailyCheckin.groupBy({
      by: ['gateId'],
      where: {
        eventDate: activeDate,
        status: 'SUCCESS' as any,
        isLoadTest: false,
      },
      _count: { id: true },
    });

    const gateCountMap = new Map<string, number>();
    for (const item of gateCheckinCounts) {
      gateCountMap.set(item.gateId.toString(), item._count.id);
    }

    const gateItems = gates.map((g) => {
      const count = gateCountMap.get(g.id.toString()) || 0;
      const cap = g.totalCapacity;
      const pct = cap && cap > 0 ? Number(((count / cap) * 100).toFixed(1)) : 0;
      const isCapacityReached = g.capacityEnabled && !!cap && count >= cap;
      let capacityStatusLevel: 'normal' | 'warning' | 'critical' | 'full' = 'normal';
      if (pct >= 100) capacityStatusLevel = 'full';
      else if (pct >= 90) capacityStatusLevel = 'critical';
      else if (pct >= 70) capacityStatusLevel = 'warning';

      return {
        id: g.id.toString(),
        name: g.name,
        code: g.gateNumber || `GATE ${g.id}`,
        type: g.gateType || 'REGULAR',
        location: (g as any).location || 'Main perimeter',
        isOpen: g.isOpen,
        status: g.status,
        checkinsToday: count,
        maximumCapacity: cap,
        capacityEnabled: g.capacityEnabled,
        blockWhenFull: g.blockWhenFull,
        capacityPercentage: pct,
        isCapacityReached,
        capacityStatusLevel,
      };
    });

    // 4. Staff count
    const activeStaffCount = await this.prisma.user.count({
      where: {
        isActive: true,
        role: {
          in: [
            UserRole.SUPER_ADMIN,
            UserRole.ADMIN,
            UserRole.EVENT_ADMIN,
            UserRole.GATE_SUPERVISOR,
            UserRole.GATE_MANAGER,
            UserRole.GATE_OPERATOR,
            UserRole.SCANNER_STAFF,
            UserRole.REGISTRATION_STAFF,
          ],
        },
      },
    });

    // 5. Recent 15 audit logs
    const audits = await this.prisma.auditLog.findMany({
      take: 15,
      orderBy: { createdAt: 'desc' },
      include: { user: true },
    });

    const recentAudits = audits.map((a) => {
      const details = (a.details as any) || {};
      return {
        id: a.id.toString(),
        action: a.action,
        reason: details.reason || 'Executed by administrator',
        gateName: details.gateName || null,
        userName: a.user?.name || 'System',
        createdAt: a.createdAt.toISOString(),
      };
    });

    return {
      activeDate,
      isManualDateOverride,
      eventStatus,
      scanningEnabled: scanningEnabled && !emergencyStopped,
      rawScanningEnabled: scanningEnabled,
      emergencyStopped,
      emergencyReason,
      kpis: {
        totalRegistered,
        bookedForToday,
        checkedInToday,
        pendingToday,
        attendanceRate,
        openGatesCount,
        totalGatesCount: gates.length,
        activeStaffCount,
      },
      gates: gateItems,
      recentAudits,
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

    return {
      success: true,
      eventStatus: next,
      message: `Event is now ${next.toUpperCase()}.`,
    };
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

    return {
      success: true,
      scanningEnabled: next,
      message: `Scanning is now ${next ? 'ENABLED' : 'DISABLED'}.`,
    };
  }

  async emergencyStop(reason: string, userId?: bigint) {
    const cleanReason = reason?.trim() || 'Emergency stop initiated from Event Control console';
    await this.setSetting('event_control.emergency_stopped', '1');
    await this.setSetting('event_control.scanning_enabled', '0');
    await this.setSetting('event_control.emergency_stop_reason', cleanReason);

    await this.prisma.auditLog.create({
      data: {
        action: 'emergency_stopped',
        userId,
        details: { reason: cleanReason },
      },
    });

    return {
      success: true,
      emergencyStopped: true,
      scanningEnabled: false,
      message: 'EMERGENCY STOP ACTIVATED: All entry scanning is immediately halted.',
    };
  }

  async emergencyResume(userId?: bigint) {
    await this.setSetting('event_control.emergency_stopped', '0');
    await this.setSetting('event_control.scanning_enabled', '1');
    await this.setSetting('event_control.emergency_stop_reason', '');

    await this.prisma.auditLog.create({
      data: {
        action: 'emergency_resumed',
        userId,
        details: { reason: 'Emergency stop cleared and normal scanning resumed' },
      },
    });

    return {
      success: true,
      emergencyStopped: false,
      scanningEnabled: true,
      message: 'Emergency stop cleared. Entry scanning is resumed.',
    };
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

    const activeDate = cleanDate || (await this.getActiveEventDate());

    return {
      success: true,
      activeDate,
      isManualDateOverride: !!cleanDate,
      message: cleanDate
        ? `Active event operational date set to ${cleanDate}.`
        : 'Operational date reset to current system date.',
    };
  }

  async toggleGateOpen(gateId: bigint, userId?: bigint) {
    const gate = await this.prisma.gate.findUnique({ where: { id: gateId } });
    if (!gate) throw new NotFoundException(`Gate with ID ${gateId} not found`);

    const nextOpen = !gate.isOpen;
    const updated = await this.prisma.gate.update({
      where: { id: gateId },
      data: { isOpen: nextOpen },
    });

    await this.prisma.auditLog.create({
      data: {
        action: nextOpen ? 'gate_opened' : 'gate_closed',
        userId,
        details: {
          gateId: gate.id.toString(),
          gateName: gate.name,
          reason: `Gate ${gate.name} (${gate.gateNumber}) ${nextOpen ? 'opened' : 'closed'}`,
        },
      },
    });

    return {
      success: true,
      isOpen: updated.isOpen,
      message: `Gate ${gate.name} is now ${nextOpen ? 'OPEN' : 'CLOSED'}.`,
    };
  }

  async updateGateCapacity(
    gateId: bigint,
    dto: { maximumCapacity?: number | null; capacityEnabled?: boolean; blockWhenFull?: boolean },
    userId?: bigint,
  ) {
    const gate = await this.prisma.gate.findUnique({ where: { id: gateId } });
    if (!gate) throw new NotFoundException(`Gate with ID ${gateId} not found`);

    const updated = await this.prisma.gate.update({
      where: { id: gateId },
      data: {
        ...(dto.maximumCapacity !== undefined ? { totalCapacity: dto.maximumCapacity } : {}),
        ...(dto.capacityEnabled !== undefined ? { capacityEnabled: dto.capacityEnabled } : {}),
        ...(dto.blockWhenFull !== undefined ? { blockWhenFull: dto.blockWhenFull } : {}),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        action: 'gate_capacity_updated',
        userId,
        details: {
          gateId: gate.id.toString(),
          gateName: gate.name,
          maximumCapacity: updated.totalCapacity,
          capacityEnabled: updated.capacityEnabled,
          blockWhenFull: updated.blockWhenFull,
          reason: `Capacity settings updated for ${gate.name}`,
        },
      },
    });

    return {
      success: true,
      gate: {
        id: updated.id.toString(),
        name: updated.name,
        maximumCapacity: updated.totalCapacity,
        capacityEnabled: updated.capacityEnabled,
        blockWhenFull: updated.blockWhenFull,
      },
      message: `Capacity settings updated for gate ${gate.name}.`,
    };
  }
}

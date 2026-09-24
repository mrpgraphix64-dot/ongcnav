import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventControlService } from '../event-control/event-control.service';
import { CheckinStatus } from '@ongc/shared-types';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventControlService: EventControlService,
  ) {}

  async getLiveStats() {
    const today = await this.eventControlService.getActiveEventDate();

    // 1. Total attendees (Registered Employees + Family Members)
    const totalAttendees = await this.prisma.attendee.count();

    // 2. Today's successful check-ins
    const checkedInCount = await this.prisma.dailyCheckin.count({
      where: {
        eventDate: today,
        status: CheckinStatus.SUCCESS as any,
        isLoadTest: false,
      },
    });

    // 3. Pending arrivals
    const pendingCount = Math.max(0, totalAttendees - checkedInCount);

    // 4. Duplicate scan attempts (supporting both Laravel 'duplicate' and NestJS 'ALREADY_CHECKED_IN')
    const duplicateAttemptsCount = await this.prisma.scanLog.count({
      where: {
        result: { in: ['duplicate', 'ALREADY_CHECKED_IN'] },
        isLoadTest: false,
      },
    });

    // 5. Check-in percentage
    const checkInPercentage =
      totalAttendees > 0
        ? Number(((checkedInCount / totalAttendees) * 100).toFixed(1))
        : 0;

    // 6. Active gates and today's activity per gate
    const gates = await this.prisma.gate.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { id: 'asc' },
    });

    const gateCheckinCounts = await this.prisma.dailyCheckin.groupBy({
      by: ['gateId'],
      where: {
        eventDate: today,
        status: CheckinStatus.SUCCESS as any,
        isLoadTest: false,
      },
      _count: { id: true },
    });

    const gateCountMap = new Map<string, number>();
    for (const gc of gateCheckinCounts) {
      if (gc.gateId) {
        gateCountMap.set(gc.gateId.toString(), (gc as any)._count.id);
      }
    }

    const gatesActivity = gates.map((g) => ({
      id: g.id.toString(),
      name: g.name,
      code: g.gateNumber || `GATE ${g.id}`,
      type: g.gateType || 'REGULAR',
      count: gateCountMap.get(g.id.toString()) || 0,
      isOpen: g.isOpen,
    }));

    const totalGateCheckinsToday = gatesActivity.reduce(
      (sum, g) => sum + g.count,
      0,
    );

    // 7. Recent check-ins (latest 6)
    let recent = await this.prisma.dailyCheckin.findMany({
      where: {
        eventDate: today,
        status: CheckinStatus.SUCCESS as any,
        isLoadTest: false,
      },
      orderBy: { checkinTime: 'desc' },
      take: 6,
      include: {
        attendee: {
          include: {
            employee: true,
            familyMember: true,
          },
        },
        gate: true,
      },
    });

    // If no scans recorded today yet, show latest recorded scans across the event
    if (recent.length === 0) {
      recent = await this.prisma.dailyCheckin.findMany({
        where: {
          status: CheckinStatus.SUCCESS as any,
          isLoadTest: false,
        },
        orderBy: { checkinTime: 'desc' },
        take: 6,
        include: {
          attendee: {
            include: {
              employee: true,
              familyMember: true,
            },
          },
          gate: true,
        },
      });
    }

    const recentCheckIns = recent.map((c) => {
      const name =
        c.attendee?.familyMember?.name ||
        c.attendee?.employee?.name ||
        c.attendee?.name ||
        'Attendee';
      const category = c.attendee?.familyMember
        ? `FAMILY (${c.attendee.familyMember.relation})`
        : c.attendee?.employee
          ? 'EMPLOYEE'
          : (c.attendee?.category?.toUpperCase() || 'GENERAL');
      const timeStr = new Date(c.checkinTime).toLocaleTimeString('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });

      return {
        id: c.id.toString(),
        name,
        ticket_id: c.attendee?.ticketNumber || `NR-${c.id}`,
        category,
        gate: c.gate?.name || 'Main Gate',
        checked_in_at: timeStr,
      };
    });

    const statusObj = await this.eventControlService.getStatus();

    return {
      today,
      totalAttendees,
      checkedInCount,
      pendingCount,
      duplicateAttemptsCount,
      checkInPercentage,
      gatesActivity,
      totalGateCheckinsToday,
      recentCheckIns,
      eventStatus: statusObj.eventStatus,
      scanningEnabled: statusObj.scanningEnabled,
      emergencyStopped: statusObj.emergencyStopped,
    };
  }
}

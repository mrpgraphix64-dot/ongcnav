import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventControlService } from '../event-control/event-control.service';
import { CheckinStatus, UserRole } from '@ongc/shared-types';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventControlService: EventControlService,
  ) {}

  async getLiveStats(user?: { role?: string }) {
    const today = await this.eventControlService.getActiveEventDate();
    const roleUpper = (user?.role || '').toUpperCase();
    const isCommercialAdmin = roleUpper === UserRole.COMMERCIAL_ADMIN;
    const isEmployeeAdmin = roleUpper === UserRole.EMPLOYEE_ADMIN;

    // Domain condition for attendee queries
    const attendeeDomainWhere: any = isCommercialAdmin
      ? { registrationType: 'COMMERCIAL' }
      : isEmployeeAdmin
      ? { registrationType: 'EMPLOYEE' }
      : {};

    const checkinDomainWhere: any = isCommercialAdmin
      ? { attendee: { registrationType: 'COMMERCIAL' } }
      : isEmployeeAdmin
      ? { attendee: { registrationType: 'EMPLOYEE' } }
      : {};

    const scanLogDomainWhere: any = isCommercialAdmin
      ? { attendee: { registrationType: 'COMMERCIAL' } }
      : isEmployeeAdmin
      ? { attendee: { registrationType: 'EMPLOYEE' } }
      : {};

    // 1. Total attendees (Domain-isolated)
    const totalAttendees = await this.prisma.attendee.count({
      where: attendeeDomainWhere,
    });

    // 2. Today's successful check-ins (Domain-isolated)
    const checkedInCount = await this.prisma.dailyCheckin.count({
      where: {
        eventDate: today,
        status: CheckinStatus.SUCCESS as any,
        isLoadTest: false,
        ...checkinDomainWhere,
      },
    });

    // 3. Pending arrivals
    const pendingCount = Math.max(0, totalAttendees - checkedInCount);

    // 4. Duplicate scan attempts (Domain-isolated)
    const duplicateAttemptsCount = await this.prisma.scanLog.count({
      where: {
        result: { in: ['duplicate', 'ALREADY_CHECKED_IN'] },
        isLoadTest: false,
        ...scanLogDomainWhere,
      },
    });

    // 5. Check-in percentage
    const checkInPercentage =
      totalAttendees > 0
        ? Number(((checkedInCount / totalAttendees) * 100).toFixed(1))
        : 0;

    // 6. Active gates and today's activity per gate (Domain-isolated checkins)
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
        ...checkinDomainWhere,
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

    // 7. Recent check-ins (latest 6, Domain-isolated)
    let recent = await this.prisma.dailyCheckin.findMany({
      where: {
        eventDate: today,
        status: CheckinStatus.SUCCESS as any,
        isLoadTest: false,
        ...checkinDomainWhere,
      },
      orderBy: { checkinTime: 'desc' },
      take: 6,
      include: {
        attendee: {
          include: {
            employee: true,
            familyMember: true,
            order: {
              select: { customerName: true, ticketType: true },
            },
          },
        },
        gate: true,
      },
    });

    // If no scans recorded today yet, show latest recorded scans for this domain
    if (recent.length === 0) {
      recent = await this.prisma.dailyCheckin.findMany({
        where: {
          status: CheckinStatus.SUCCESS as any,
          isLoadTest: false,
          ...checkinDomainWhere,
        },
        orderBy: { checkinTime: 'desc' },
        take: 6,
        include: {
          attendee: {
            include: {
              employee: true,
              familyMember: true,
              order: {
                select: { customerName: true, ticketType: true },
              },
            },
          },
          gate: true,
        },
      });
    }

    const recentCheckIns = recent.map((c) => {
      let name = 'Attendee';
      let category = 'GENERAL';

      if (isCommercialAdmin) {
        name = c.attendee?.name || c.attendee?.order?.customerName || 'E-Pass Holder';
        category = (c.attendee?.category || c.attendee?.order?.ticketType || 'COMMERCIAL PASS').toUpperCase();
      } else if (isEmployeeAdmin) {
        name = c.attendee?.familyMember?.name || c.attendee?.employee?.name || c.attendee?.name || 'Staff Attendee';
        category = c.attendee?.familyMember
          ? `FAMILY (${c.attendee.familyMember.relation})`
          : 'EMPLOYEE';
      } else {
        name =
          c.attendee?.familyMember?.name ||
          c.attendee?.employee?.name ||
          c.attendee?.order?.customerName ||
          c.attendee?.name ||
          'Attendee';
        category = c.attendee?.familyMember
          ? `FAMILY (${c.attendee.familyMember.relation})`
          : c.attendee?.employee
            ? 'EMPLOYEE'
            : (c.attendee?.category?.toUpperCase() || 'GENERAL');
      }

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

    // 8. Domain-specific metrics enrichment
    let commercialStats: any = undefined;
    let employeeStats: any = undefined;

    if (isCommercialAdmin || (!isCommercialAdmin && !isEmployeeAdmin)) {
      const [totalCommercialOrders, paidOrders, totalRevenuePaise, agentOrdersCount, availableAllocationAgg] = await Promise.all([
        this.prisma.commercialOrder.count(),
        this.prisma.commercialOrder.count({ where: { orderStatus: 'PAID' } }),
        this.prisma.commercialOrder.aggregate({
          where: { orderStatus: 'PAID' },
          _sum: { amountPaise: true },
        }),
        this.prisma.commercialOrder.count({ where: { source: 'AGENT' } }),
        this.prisma.agentAllocation.aggregate({
          _sum: { allocatedQuantity: true, bookedQuantity: true },
        }),
      ]);

      const allocatedTotal = availableAllocationAgg._sum.allocatedQuantity || 0;
      const bookedTotal = availableAllocationAgg._sum.bookedQuantity || 0;
      const availableInventory = Math.max(0, allocatedTotal - bookedTotal);

      commercialStats = {
        commercialSalesInr: (totalRevenuePaise._sum.amountPaise || 0) / 100,
        totalOrdersCount: totalCommercialOrders,
        paidOrdersCount: paidOrders,
        totalCommercialPasses: totalAttendees,
        agentSalesCount: agentOrdersCount,
        availableInventory,
      };
    }

    if (isEmployeeAdmin || (!isCommercialAdmin && !isEmployeeAdmin)) {
      const [totalEmployees, totalFamilyMembers] = await Promise.all([
        this.prisma.employee.count(),
        this.prisma.familyMember.count(),
      ]);

      employeeStats = {
        totalEmployees,
        totalFamilyMembers,
        employeePassesCount: totalAttendees,
      };
    }

    return {
      today,
      domain: isCommercialAdmin ? 'commercial' : isEmployeeAdmin ? 'employee' : 'global',
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
      ...(commercialStats ? { commercialStats } : {}),
      ...(employeeStats ? { employeeStats } : {}),
    };
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CheckinStatus } from '@ongc/shared-types';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private getTodayIst(): string {
    return new Date().toLocaleDateString('en-CA', {
      timeZone: 'Asia/Kolkata',
    });
  }

  async getSummary(date?: string) {
    const activeDateSetting = await this.prisma.setting.findUnique({
      where: { key: 'active_event_date' },
    });
    const targetDate = date || activeDateSetting?.value || this.getTodayIst();

    const [
      totalEmployees,
      totalFamilyMembers,
      totalPasses,
      todayCheckins,
      gateCounts,
      incidentsCount,
    ] = await Promise.all([
      this.prisma.employee.count(),
      this.prisma.familyMember.count(),
      this.prisma.attendee.count(),
      this.prisma.dailyCheckin.count({
        where: {
          eventDate: targetDate,
          status: CheckinStatus.SUCCESS as any,
          isLoadTest: false,
        },
      }),
      this.prisma.dailyCheckin.groupBy({
        by: ['gateId'],
        where: {
          eventDate: targetDate,
          status: CheckinStatus.SUCCESS as any,
          isLoadTest: false,
        },
        _count: { id: true },
      }),
      this.prisma.incident.count({
        where: {
          status: { in: ['OPEN', 'IN_PROGRESS'] as any },
        },
      }),
    ]);

    // Hourly distribution
    const hourlyData = await this.getHourlyDistribution(targetDate);

    // Calculate peak entry hour
    let peakHour = 'N/A';
    let peakCount = 0;
    for (const h of hourlyData) {
      if (h.count > peakCount) {
        peakCount = h.count;
        peakHour = h.hour;
      }
    }

    // Gate names
    const gates = await this.prisma.gate.findMany();
    const gateMap = new Map<string, string>();
    gates.forEach((g) => gateMap.set(g.id.toString(), g.name));

    const gateBreakdown = gateCounts.map((gc) => ({
      gateId: gc.gateId?.toString() || 'unknown',
      gateName: gc.gateId ? gateMap.get(gc.gateId.toString()) || 'Unknown Gate' : 'Unknown Gate',
      count: (gc as any)._count?.id || 0,
    }));

    return {
      targetDate,
      totalRegisteredEmployees: totalEmployees,
      totalRegisteredFamilyMembers: totalFamilyMembers,
      totalRegisteredPasses: totalPasses,
      todayTotalCheckins: todayCheckins,
      peakHour,
      peakHourCount: peakCount,
      activeIncidents: incidentsCount,
      gateBreakdown,
      hourlyDistribution: hourlyData,
    };
  }

  async getHourlyDistribution(date: string) {
    // Fetch all successful check-ins for the day
    const checkins = await this.prisma.dailyCheckin.findMany({
      where: {
        eventDate: date,
        status: CheckinStatus.SUCCESS as any,
        isLoadTest: false,
      },
      select: {
        checkinTime: true,
      },
    });

    const hourBuckets: Record<string, number> = {};
    for (let h = 0; h < 24; h++) {
      const label = `${h.toString().padStart(2, '0')}:00`;
      hourBuckets[label] = 0;
    }

    for (const c of checkins) {
      const istHour = new Date(c.checkinTime).toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        hour12: false,
      });
      const key = `${istHour.padStart(2, '0')}:00`;
      if (hourBuckets[key] !== undefined) {
        hourBuckets[key]++;
      }
    }

    return Object.entries(hourBuckets).map(([hour, count]) => ({
      hour,
      count,
    }));
  }

  async getCheckinsCsvData(date: string) {
    const checkins = await this.prisma.dailyCheckin.findMany({
      where: {
        eventDate: date,
        isLoadTest: false,
      },
      orderBy: { checkinTime: 'asc' },
      include: {
        gate: true,
        scannedBy: true,
        attendee: {
          include: {
            employee: true,
            familyMember: true,
          },
        },
      },
    });

    const rows = checkins.map((c) => {
      const isFamily = !!c.attendee?.familyMemberId;
      const attendeeName = isFamily
        ? c.attendee?.familyMember?.name
        : c.attendee?.employee.name;
      const relation = isFamily
        ? c.attendee?.familyMember?.relation
        : 'Primary Employee';
      const cpf = c.attendee?.employee.cpf || '';
      const phone = c.attendee?.employee.phone || '';
      const designation = c.attendee?.employee.designation || '';
      const department = c.attendee?.employee.department || '';
      const istTime = new Date(c.checkinTime).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
      });

      return {
        CheckinID: c.id.toString(),
        TicketNumber: c.attendee?.ticketNumber || '',
        Name: attendeeName || '',
        Relation: relation || '',
        CPF: cpf,
        Phone: phone,
        Designation: designation,
        Department: department,
        Gate: c.gate?.name || '',
        ScannedBy: c.scannedBy?.name || 'System / Auto',
        EventDate: c.eventDate,
        CheckinTimeIST: istTime,
        Status: c.status,
      };
    });

    return rows;
  }
}

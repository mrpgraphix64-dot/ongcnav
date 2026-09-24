import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CheckinStatus, IncidentStatus } from '@ongc/shared-types';

export function sanitizeCsvValue(value: any): string {
  if (value === null || value === undefined) return '';
  let str = String(value).trim();
  // Formula injection defense: prefix with single quote if starts with dangerous chars
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return str.replace(/"/g, '""');
}

@Injectable()
export class DailyClosingService {
  constructor(private readonly prisma: PrismaService) {}

  private getTodayIst(): string {
    return new Date().toLocaleDateString('en-CA', {
      timeZone: 'Asia/Kolkata',
    });
  }

  private async getActiveEventDate(): Promise<string> {
    const setting = await this.prisma.setting.findFirst({
      where: {
        OR: [{ key: 'active_event_date' }, { key: 'event_control.active_event_date' }],
      },
    });
    return setting?.value || this.getTodayIst();
  }

  async generateDailyClosingReport(date?: string) {
    const activeDate = await this.getActiveEventDate();
    const selectedDate = date || activeDate;

    // 1. Core Attendee & Booking Counts
    const totalRegistered = await this.prisma.attendee.count();
    const allAttendees = await this.prisma.attendee.findMany({
      include: { employee: true },
    });

    const bookedForDate = allAttendees.filter((a) => {
      if (a.employee && Array.isArray(a.employee.bookingDays)) {
        const days = a.employee.bookingDays as string[];
        return days.length === 0 || days.includes(selectedDate);
      }
      return true;
    }).length;

    // 2. Active Check-in Counts
    const checkedInCount = await this.prisma.dailyCheckin.count({
      where: {
        eventDate: selectedDate,
        status: CheckinStatus.SUCCESS as any,
        isLoadTest: false,
      },
    });

    const pendingCount = Math.max(0, bookedForDate - checkedInCount);
    const attendanceRate =
      bookedForDate > 0 ? Math.round((checkedInCount / bookedForDate) * 1000) / 10 : 0;

    // 3. Peak Hour Calculation (Asia/Kolkata)
    const checkins = await this.prisma.dailyCheckin.findMany({
      where: {
        eventDate: selectedDate,
        status: CheckinStatus.SUCCESS as any,
        isLoadTest: false,
      },
      select: { checkinTime: true },
    });

    const hourMap: Record<number, number> = {};
    for (let i = 0; i < 24; i++) hourMap[i] = 0;

    for (const c of checkins) {
      const istTimeStr = new Date(c.checkinTime).toLocaleTimeString('en-US', {
        timeZone: 'Asia/Kolkata',
        hour12: false,
        hour: '2-digit',
      });
      const hour = parseInt(istTimeStr, 10);
      if (!isNaN(hour) && hour >= 0 && hour < 24) {
        hourMap[hour] = (hourMap[hour] || 0) + 1;
      }
    }

    let peakHourNum = -1;
    let peakHourCount = 0;
    for (let i = 0; i < 24; i++) {
      if (hourMap[i] > peakHourCount) {
        peakHourCount = hourMap[i];
        peakHourNum = i;
      }
    }

    let peakHourFormatted = 'N/A';
    if (peakHourNum !== -1) {
      const ampm = peakHourNum >= 12 ? 'PM' : 'AM';
      const h12 = peakHourNum % 12 || 12;
      peakHourFormatted = `${h12}:00 ${ampm}`;
    }

    // 4. Gate Breakdown with Capacity Utilization
    const gates = await this.prisma.gate.findMany({
      orderBy: { gateNumber: 'asc' },
    });

    const gateBreakdown = await Promise.all(
      gates.map(async (gate) => {
        const count = await this.prisma.dailyCheckin.count({
          where: {
            gateId: gate.id,
            eventDate: selectedDate,
            status: CheckinStatus.SUCCESS as any,
            isLoadTest: false,
          },
        });

        const capacity = gate.capacityPerHour || gate.totalCapacity || 0;
        const percentage = capacity > 0 ? Math.round((count / capacity) * 100) : 0;
        let statusLevel: 'normal' | 'warning' | 'critical' = 'normal';
        if (percentage >= 90) statusLevel = 'critical';
        else if (percentage >= 75) statusLevel = 'warning';

        return {
          gate: {
            id: gate.id.toString(),
            name: gate.name,
            code: gate.gateNumber,
            type: gate.description || 'General Turnstile',
          },
          count,
          capacity,
          percentage,
          status_level: statusLevel,
          is_open: gate.isOpen,
        };
      }),
    );

    // 5. Staff Productivity Breakdown
    const activeStaff = await this.prisma.user.findMany({
      where: {
        isActive: true,
        role: { in: ['SUPER_ADMIN', 'EVENT_ADMIN', 'GATE_MANAGER', 'SCANNER_STAFF'] as any },
      },
      include: {
        gateUsers: {
          include: { gate: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    const staffMembers = await Promise.all(
      activeStaff.map(async (staff) => {
        const checkinsCount = await this.prisma.dailyCheckin.count({
          where: {
            scannedById: staff.id,
            eventDate: selectedDate,
            status: CheckinStatus.SUCCESS as any,
            isLoadTest: false,
          },
        });

        const lastScan = await this.prisma.scanLog.findFirst({
          where: {
            scannedById: staff.id,
            scannedAt: {
              gte: new Date(`${selectedDate}T00:00:00.000Z`),
              lte: new Date(`${selectedDate}T23:59:59.999Z`),
            },
            isLoadTest: false,
          },
          orderBy: { scannedAt: 'desc' },
          select: { scannedAt: true },
        });

        const assignedGates =
          staff.gateUsers?.map((gu) => gu.gate.name).join(', ') || 'All Gates';

        return {
          staff: {
            id: staff.id.toString(),
            name: staff.name,
            email: staff.email,
            staff_id: staff.staffId,
            role: staff.role,
          },
          checkins_count: checkinsCount,
          last_activity_at: lastScan?.scannedAt ? lastScan.scannedAt.toISOString() : null,
          assigned_gates: assignedGates,
        };
      }),
    );

    // 6. Scan Verification Audit Breakdown
    const [
      approvedCount,
      manualCount,
      voidedCount,
      duplicateCount,
      notBookedCount,
      unauthorizedGateCount,
      invalidCount,
      gateClosedCount,
      capacityReachedCount,
    ] = await Promise.all([
      this.prisma.dailyCheckin.count({
        where: {
          eventDate: selectedDate,
          status: CheckinStatus.SUCCESS as any,
          isLoadTest: false,
        },
      }),
      this.prisma.dailyCheckin.count({
        where: {
          eventDate: selectedDate,
          status: CheckinStatus.SUCCESS as any,
          isManual: true,
          isLoadTest: false,
        },
      }),
      this.prisma.dailyCheckin.count({
        where: {
          eventDate: selectedDate,
          status: CheckinStatus.VOIDED as any,
          isLoadTest: false,
        },
      }),
      this.prisma.scanLog.count({
        where: {
          scannedAt: {
            gte: new Date(`${selectedDate}T00:00:00.000Z`),
            lte: new Date(`${selectedDate}T23:59:59.999Z`),
          },
          result: 'duplicate',
          isLoadTest: false,
        },
      }),
      this.prisma.scanLog.count({
        where: {
          scannedAt: {
            gte: new Date(`${selectedDate}T00:00:00.000Z`),
            lte: new Date(`${selectedDate}T23:59:59.999Z`),
          },
          result: 'not_booked',
          isLoadTest: false,
        },
      }),
      this.prisma.scanLog.count({
        where: {
          scannedAt: {
            gte: new Date(`${selectedDate}T00:00:00.000Z`),
            lte: new Date(`${selectedDate}T23:59:59.999Z`),
          },
          result: 'unauthorized_gate',
          isLoadTest: false,
        },
      }),
      this.prisma.scanLog.count({
        where: {
          scannedAt: {
            gte: new Date(`${selectedDate}T00:00:00.000Z`),
            lte: new Date(`${selectedDate}T23:59:59.999Z`),
          },
          result: 'invalid',
          isLoadTest: false,
        },
      }),
      this.prisma.scanLog.count({
        where: {
          scannedAt: {
            gte: new Date(`${selectedDate}T00:00:00.000Z`),
            lte: new Date(`${selectedDate}T23:59:59.999Z`),
          },
          result: 'gate_closed',
          isLoadTest: false,
        },
      }),
      this.prisma.scanLog.count({
        where: {
          scannedAt: {
            gte: new Date(`${selectedDate}T00:00:00.000Z`),
            lte: new Date(`${selectedDate}T23:59:59.999Z`),
          },
          result: 'capacity_reached',
          isLoadTest: false,
        },
      }),
    ]);

    // 7. Incident Breakdown
    const [incidentsTotal, incidentsOpen, incidentsInReview, incidentsResolved] =
      await Promise.all([
        this.prisma.incident.count({
          where: { incidentDate: selectedDate },
        }),
        this.prisma.incident.count({
          where: {
            incidentDate: selectedDate,
            status: IncidentStatus.OPEN as any,
          },
        }),
        this.prisma.incident.count({
          where: {
            incidentDate: selectedDate,
            status: 'IN_REVIEW' as any,
          },
        }),
        this.prisma.incident.count({
          where: {
            incidentDate: selectedDate,
            status: { in: [IncidentStatus.RESOLVED, IncidentStatus.CLOSED] as any },
          },
        }),
      ]);

    return {
      selectedDate,
      today: activeDate,
      totalRegistered,
      bookedForDate,
      checkedInCount,
      pendingCount,
      attendanceRate,
      peakHourFormatted,
      peakHourCount,
      gates: gateBreakdown,
      staffMembers,
      approvedCount,
      manualCount,
      voidedCount,
      duplicateCount,
      notBookedCount,
      unauthorizedGateCount,
      invalidCount,
      gateClosedCount,
      capacityReachedCount,
      incidentsTotal,
      incidentsOpen,
      incidentsInReview,
      incidentsResolved,
    };
  }

  async exportDailyClosingCsv(date?: string): Promise<string> {
    const activeDate = await this.getActiveEventDate();
    const selectedDate = date || activeDate;

    const checkins = await this.prisma.dailyCheckin.findMany({
      where: {
        eventDate: selectedDate,
        isLoadTest: false,
      },
      include: {
        attendee: {
          include: {
            employee: true,
            familyMember: true,
          },
        },
        gate: true,
        scannedBy: true,
        voidedBy: true,
      },
      orderBy: { checkinTime: 'asc' },
    });

    const headers = [
      'Event Date',
      'Ticket ID',
      'Attendee Name',
      'Category',
      'CPF Number',
      'Gate',
      'Checked In At (IST)',
      'Operator Name',
      'Status',
      'Is Manual',
      'Manual Reason',
      'Voided At (IST)',
      'Voided By',
      'Void Reason',
    ];

    const lines: string[] = [headers.join(',')];

    for (const c of checkins) {
      const att = c.attendee;
      const emp = att?.employee;
      const attName = att?.familyMember
        ? att.familyMember.name
        : (emp?.name || att?.name || 'N/A');

      const checkedInAtIst = c.checkinTime
        ? new Date(c.checkinTime).toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            hour12: false,
          }) + ' IST'
        : '';

      const voidedAtIst = c.voidedAt
        ? new Date(c.voidedAt).toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            hour12: false,
          }) + ' IST'
        : '';

      const row = [
        sanitizeCsvValue(selectedDate),
        sanitizeCsvValue(att?.ticketNumber || 'N/A'),
        sanitizeCsvValue(attName),
        sanitizeCsvValue(att?.category || 'General'),
        sanitizeCsvValue(emp?.cpf || 'N/A'),
        sanitizeCsvValue(c.gate?.name || 'N/A'),
        sanitizeCsvValue(checkedInAtIst),
        sanitizeCsvValue(c.scannedBy?.name || 'N/A'),
        sanitizeCsvValue(String(c.status).toUpperCase()),
        c.isManual ? 'YES' : 'NO',
        sanitizeCsvValue(c.manualReason || ''),
        sanitizeCsvValue(voidedAtIst),
        sanitizeCsvValue(c.voidedBy?.name || ''),
        sanitizeCsvValue(c.voidReason || ''),
      ];

      lines.push(row.map((val) => `"${val}"`).join(','));
    }

    return lines.join('\n');
  }
}

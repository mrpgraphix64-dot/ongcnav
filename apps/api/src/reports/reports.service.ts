import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CheckinStatus } from '@ongc/shared-types';
import { sanitizeCsvValue } from './daily-closing.service';

export interface ReportFilters {
  gate?: string;
  staff_id?: string;
  result?: string;
  event_date?: string;
  category?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private getTodayIst(): string {
    return new Date().toLocaleDateString('en-CA', {
      timeZone: 'Asia/Kolkata',
    });
  }

  async buildReport(filters?: ReportFilters) {
    const attendeeWhere: any = {};
    const scanLogWhere: any = { isLoadTest: false };

    if (filters?.gate && filters.gate !== 'all') {
      const g = filters.gate;
      attendeeWhere.gate = { contains: g, mode: 'insensitive' };
      scanLogWhere.OR = [
        { gate: { contains: g, mode: 'insensitive' } },
        { gate: { name: { contains: g, mode: 'insensitive' } } },
      ];
    }

    if (filters?.staff_id && filters.staff_id !== 'all') {
      scanLogWhere.scannedById = BigInt(filters.staff_id);
    }

    if (filters?.result && filters.result !== 'all') {
      scanLogWhere.result = filters.result;
    }

    if (filters?.event_date) {
      const date = filters.event_date;
      attendeeWhere.dailyCheckins = {
        some: { eventDate: date, status: CheckinStatus.SUCCESS as any },
      };
      scanLogWhere.scannedAt = {
        gte: new Date(`${date}T00:00:00.000Z`),
        lte: new Date(`${date}T23:59:59.999Z`),
      };
    }

    if (filters?.category && filters.category !== 'all') {
      attendeeWhere.category = filters.category;
    }

    if (filters?.status && filters.status !== 'all') {
      attendeeWhere.status = filters.status;
    }

    if (filters?.date_from) {
      attendeeWhere.createdAt = {
        ...(attendeeWhere.createdAt || {}),
        gte: new Date(`${filters.date_from}T00:00:00.000Z`),
      };
      scanLogWhere.scannedAt = {
        ...(scanLogWhere.scannedAt || {}),
        gte: new Date(`${filters.date_from}T00:00:00.000Z`),
      };
    }

    if (filters?.date_to) {
      attendeeWhere.createdAt = {
        ...(attendeeWhere.createdAt || {}),
        lte: new Date(`${filters.date_to}T23:59:59.999Z`),
      };
      scanLogWhere.scannedAt = {
        ...(scanLogWhere.scannedAt || {}),
        lte: new Date(`${filters.date_to}T23:59:59.999Z`),
      };
    }

    // 1. Fetch filtered attendees
    const attendees = await this.prisma.attendee.findMany({
      where: attendeeWhere,
      include: {
        employee: true,
        familyMember: true,
        dailyCheckins: {
          where: { status: CheckinStatus.SUCCESS as any, isLoadTest: false },
          include: { gate: true },
        },
      },
    });

    const totalAttendees = attendees.length;
    const checkedInCount = attendees.filter((a) => a.dailyCheckins.length > 0).length;
    const pendingCount = Math.max(0, totalAttendees - checkedInCount);
    const checkInPct =
      totalAttendees > 0 ? Math.round((checkedInCount / totalAttendees) * 1000) / 10 : 0;

    // 2. Attendance by day (14 days window)
    const dayMap: Record<string, { registered: number; checkedIn: number }> = {};
    for (const a of attendees) {
      const regDay = a.createdAt.toISOString().slice(0, 10);
      if (!dayMap[regDay]) dayMap[regDay] = { registered: 0, checkedIn: 0 };
      dayMap[regDay].registered++;

      for (const c of a.dailyCheckins) {
        const checkDay = c.eventDate || c.checkinTime.toISOString().slice(0, 10);
        if (!dayMap[checkDay]) dayMap[checkDay] = { registered: 0, checkedIn: 0 };
        dayMap[checkDay].checkedIn++;
      }
    }

    const sortedDays = Object.keys(dayMap).sort().slice(-14);
    const attendanceByDay = sortedDays.map((day) => {
      const parts = day.split('-');
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      const label = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
      return {
        label,
        date: day,
        registered: dayMap[day].registered,
        checkedIn: dayMap[day].checkedIn,
      };
    });

    const maxDayValue = Math.max(
      1,
      ...attendanceByDay.map((d) => Math.max(d.registered, d.checkedIn)),
    );

    // 3. Gate performance
    const gates = await this.prisma.gate.findMany({
      orderBy: { gateNumber: 'asc' },
    });

    const gatePerformance = await Promise.all(
      gates.map(async (gate) => {
        const logs = await this.prisma.scanLog.findMany({
          where: {
            ...scanLogWhere,
            gateId: gate.id,
          },
          select: { result: true, scannedAt: true },
        });

        const totalEntries = logs.length;
        const approved = logs.filter((l) => l.result === 'approved' || l.result === 'SUCCESS').length;
        const duplicates = logs.filter((l) => l.result === 'duplicate').length;
        const invalid = logs.filter((l) => l.result === 'invalid').length;

        let lastActivity = 'No activity yet';
        if (logs.length > 0) {
          const maxTime = Math.max(...logs.map((l) => l.scannedAt.getTime()));
          lastActivity = new Date(maxTime).toLocaleTimeString('en-IN', {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit',
            minute: '2-digit',
          });
        }

        return {
          id: gate.id.toString(),
          name: gate.name,
          code: gate.gateNumber,
          type: gate.description || 'General Turnstile',
          totalEntries,
          checkedIn: approved,
          duplicates,
          invalid,
          lastActivity,
        };
      }),
    );

    // 4. Category breakdown
    const catMap: Record<string, { registered: number; checkedIn: number }> = {};
    for (const a of attendees) {
      const cat = (a.category || 'General').trim() || 'General';
      if (!catMap[cat]) catMap[cat] = { registered: 0, checkedIn: 0 };
      catMap[cat].registered++;
      if (a.dailyCheckins.length > 0) {
        catMap[cat].checkedIn++;
      }
    }

    const categoryBreakdown = Object.entries(catMap)
      .map(([name, counts]) => ({
        name,
        registered: counts.registered,
        checkedIn: counts.checkedIn,
        pct: counts.registered > 0 ? Math.round((counts.checkedIn / counts.registered) * 100) : 0,
      }))
      .sort((a, b) => b.registered - a.registered);

    // 5. Recent Scan Activity (last 20)
    const recentLogs = await this.prisma.scanLog.findMany({
      where: scanLogWhere,
      take: 20,
      orderBy: { scannedAt: 'desc' },
      include: {
        attendee: true,
        gate: true,
        scannedBy: true,
      },
    });

    const recentActivity = recentLogs.map((log) => ({
      time: log.scannedAt.toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }),
      date: log.scannedAt.toLocaleDateString('en-GB', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
      }),
      name: log.attendee?.name || 'Unknown',
      ticket_id: log.attendee?.ticketNumber || 'N/A',
      gate: log.gate?.name || '—',
      staff: log.scannedBy?.name || 'System',
      category: log.attendee?.category || '—',
      result: log.result,
    }));

    // 6. QR Verification Summary
    const [
      totalScans,
      verifiedScans,
      invalidScans,
      duplicateScans,
      notBookedScans,
      unauthorizedGateScans,
    ] = await Promise.all([
      this.prisma.scanLog.count({ where: scanLogWhere }),
      this.prisma.scanLog.count({
        where: { ...scanLogWhere, result: { in: ['approved', 'SUCCESS'] } },
      }),
      this.prisma.scanLog.count({ where: { ...scanLogWhere, result: 'invalid' } }),
      this.prisma.scanLog.count({ where: { ...scanLogWhere, result: 'duplicate' } }),
      this.prisma.scanLog.count({ where: { ...scanLogWhere, result: 'not_booked' } }),
      this.prisma.scanLog.count({ where: { ...scanLogWhere, result: 'unauthorized_gate' } }),
    ]);

    const qrSummary = {
      generated: totalAttendees,
      scanned: totalScans,
      verified: verifiedScans,
      invalid: invalidScans,
      alreadyCheckedIn: duplicateScans,
      notBooked: notBookedScans,
      unauthorizedGate: unauthorizedGateScans,
    };

    const duplicateAttempts = duplicateScans;

    return {
      totalAttendees,
      checkedInCount,
      pendingCount,
      duplicateAttempts,
      checkInPct,
      attendanceByDay,
      maxDayValue,
      gatePerformance,
      categoryBreakdown,
      recentActivity,
      qrSummary,
    };
  }

  async getReportsPageData(filters?: ReportFilters) {
    const [report, gates, staffList] = await Promise.all([
      this.buildReport(filters),
      this.prisma.gate.findMany({
        orderBy: { gateNumber: 'asc' },
        select: { id: true, name: true, gateNumber: true },
      }),
      this.prisma.user.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, role: true, staffId: true },
      }),
    ]);

    return {
      ...report,
      gates: gates.map((g) => ({ id: g.id.toString(), name: g.name, code: g.gateNumber })),
      staffList: staffList.map((s) => ({
        id: s.id.toString(),
        name: s.name,
        role: s.role,
        staffId: s.staffId,
      })),
    };
  }

  async exportCsv(filters?: ReportFilters, requestedSections?: string[]): Promise<string> {
    const report = await this.buildReport(filters);
    const sections = requestedSections || [
      'categories',
      'attendees',
      'checkins',
      'gates',
      'duplicates',
      'qr',
    ];

    const lines: string[] = [];
    const pushRow = (row: any[]) => lines.push(row.map((val) => `"${sanitizeCsvValue(val)}"`).join(','));

    lines.push(`"ONGC Navratri — Event Gate & Entry Audit Report"`);
    lines.push(
      `"Generated","${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST"`,
    );
    lines.push('');

    if (sections.includes('categories')) {
      lines.push(`"CATEGORY BREAKDOWN"`);
      pushRow(['Category', 'Registered', 'Checked In', 'Attendance %']);
      for (const row of report.categoryBreakdown) {
        pushRow([row.name, row.registered, row.checkedIn, `${row.pct}%`]);
      }
      lines.push('');
    }

    if (sections.includes('attendees')) {
      lines.push(`"ATTENDEE LIST"`);
      pushRow([
        'Name',
        'Mobile',
        'Email',
        'Ticket ID',
        'Category',
        'Status',
        'Gate',
        'Checked In At (IST)',
      ]);
      const attendees = await this.prisma.attendee.findMany({
        take: 2000,
        orderBy: { id: 'asc' },
        include: {
          employee: true,
          dailyCheckins: {
            where: { status: CheckinStatus.SUCCESS as any },
            include: { gate: true },
          },
        },
      });
      for (const a of attendees) {
        const lastCheckin = a.dailyCheckins[0];
        const checkedInAt = lastCheckin?.checkinTime
          ? new Date(lastCheckin.checkinTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST'
          : '';
        pushRow([
          a.name,
          a.mobile,
          a.email || 'N/A',
          a.ticketNumber,
          a.category,
          a.status,
          lastCheckin?.gate?.name || 'N/A',
          checkedInAt,
        ]);
      }
      lines.push('');
    }

    if (sections.includes('checkins')) {
      lines.push(`"CHECK-IN HISTORY"`);
      pushRow([
        'Date (IST)',
        'Time (IST)',
        'Attendee',
        'Ticket ID',
        'Gate',
        'Staff Operator',
        'Category',
        'Result',
      ]);
      for (const row of report.recentActivity) {
        pushRow([
          row.date,
          row.time,
          row.name,
          row.ticket_id,
          row.gate,
          row.staff,
          row.category,
          row.result,
        ]);
      }
      lines.push('');
    }

    if (sections.includes('gates')) {
      lines.push(`"GATE PERFORMANCE"`);
      pushRow([
        'Gate',
        'Code',
        'Type',
        'Total Entries',
        'Checked In',
        'Duplicates',
        'Invalid Attempts',
        'Last Activity',
      ]);
      for (const row of report.gatePerformance) {
        pushRow([
          row.name,
          row.code || '—',
          row.type || 'General',
          row.totalEntries,
          row.checkedIn,
          row.duplicates,
          row.invalid,
          row.lastActivity,
        ]);
      }
      lines.push('');
    }

    if (sections.includes('qr')) {
      lines.push(`"QR VERIFICATION SUMMARY"`);
      pushRow(['Metric', 'Count']);
      pushRow(['QR Codes Generated', report.qrSummary.generated]);
      pushRow(['QR Codes Scanned', report.qrSummary.scanned]);
      pushRow(['Successfully Verified', report.qrSummary.verified]);
      pushRow(['Invalid Tickets', report.qrSummary.invalid]);
      pushRow(['Already Checked In', report.qrSummary.alreadyCheckedIn]);
      pushRow(['Not Booked For Today', report.qrSummary.notBooked]);
      pushRow(['Unauthorized Gate Attempts', report.qrSummary.unauthorizedGate]);
    }

    return lines.join('\n');
  }

  // Dashboard summary compatibility method
  async getSummary(date?: string) {
    const res = await this.getReportsPageData({ event_date: date });
    return {
      targetDate: date || this.getTodayIst(),
      totalRegisteredPasses: res.totalAttendees,
      todayTotalCheckins: res.checkedInCount,
      peakHour: res.attendanceByDay[0]?.label || 'N/A',
      peakHourCount: res.maxDayValue,
      activeIncidents: 0,
      gateBreakdown: res.gatePerformance.map((g) => ({
        gateId: g.id,
        gateName: g.name,
        count: g.totalEntries,
      })),
      hourlyDistribution: [],
    };
  }

  async getCheckinsCsvData(date: string) {
    const checkins = await this.prisma.dailyCheckin.findMany({
      where: { eventDate: date, isLoadTest: false },
      include: {
        attendee: { include: { employee: true, familyMember: true } },
        gate: true,
        scannedBy: true,
      },
    });

    return checkins.map((c) => ({
      CheckinID: c.id.toString(),
      TicketNumber: c.attendee?.ticketNumber || '',
      Name: c.attendee?.name || '',
      Relation: c.attendee?.familyMember ? 'Family' : (c.attendee?.employee ? 'Employee' : 'Commercial'),
      RegistrationType: c.attendee?.registrationType || 'EMPLOYEE',
      CPF: c.attendee?.employee?.cpf || '',
      Phone: c.attendee?.mobile || '',
      Designation: c.attendee?.employee?.designation || '',
      Department: c.attendee?.employee?.department || '',
      EmployeeCategory: c.attendee?.employee?.employeeCategory || '',
      Gate: c.gate?.name || '',
      ScannedBy: c.scannedBy?.name || '',
      EventDate: c.eventDate,
      CheckinTimeIST: c.checkinTime.toISOString(),
      Status: c.status,
    }));
  }
}

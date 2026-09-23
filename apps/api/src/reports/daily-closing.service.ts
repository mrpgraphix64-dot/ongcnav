import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReportsService } from './reports.service';
import { CheckinStatus } from '@ongc/shared-types';

@Injectable()
export class DailyClosingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reportsService: ReportsService,
  ) {}

  async generateDailyClosingReport(date: string) {
    const summary = await this.reportsService.getSummary(date);

    // Operator breakdown
    const operatorStats = await this.prisma.dailyCheckin.groupBy({
      by: ['scannedById'],
      where: {
        eventDate: date,
        status: CheckinStatus.SUCCESS as any,
        isLoadTest: false,
      },
      _count: { id: true },
    });

    const userIds = operatorStats
      .map((s) => s.scannedById)
      .filter((id): id is bigint => id !== null);

    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, staffId: true, role: true },
    });
    const userMap = new Map<string, { name: string; staffId: string | null; role: string }>();
    users.forEach((u) => userMap.set(u.id.toString(), u));

    const staffBreakdown = operatorStats.map((os) => {
      const uId = os.scannedById ? os.scannedById.toString() : 'system';
      const user = userMap.get(uId);
      return {
        userId: uId,
        staffName: user ? user.name : 'Help Desk / System Overrides',
        staffId: user?.staffId || 'N/A',
        role: user?.role || 'SYSTEM',
        scanCount: (os as any)._count?.id || 0,
      };
    });

    // Voided check-ins for the day
    const voidedCount = await this.prisma.dailyCheckin.count({
      where: {
        eventDate: date,
        status: CheckinStatus.VOIDED as any,
        isLoadTest: false,
      },
    });

    return {
      closingDate: date,
      generatedAt: new Date().toISOString(),
      timezone: 'Asia/Kolkata',
      metrics: {
        totalCheckins: summary.todayTotalCheckins,
        voidedCheckins: voidedCount,
        peakHour: summary.peakHour,
        peakHourVolume: summary.peakHourCount,
        activeIncidents: summary.activeIncidents,
      },
      gates: summary.gateBreakdown,
      staffPerformance: staffBreakdown,
      hourlyBreakdown: summary.hourlyDistribution,
    };
  }
}

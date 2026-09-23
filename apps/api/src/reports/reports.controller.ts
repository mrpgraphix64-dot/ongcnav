import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { DailyClosingService } from './daily-closing.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@ongc/shared-types';

@ApiTags('Admin Reports & Closing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/reports')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly dailyClosingService: DailyClosingService,
  ) {}

  @Get('summary')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.GATE_SUPERVISOR, UserRole.HELP_DESK)
  @ApiOperation({ summary: 'Get summary KPIs and charts data for dashboard' })
  async getSummary(@Query('date') date?: string) {
    return this.reportsService.getSummary(date);
  }

  @Get('hourly')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.GATE_SUPERVISOR)
  @ApiOperation({ summary: 'Get 24-hour check-in distribution in Asia/Kolkata timezone' })
  async getHourly(@Query('date') date: string) {
    return this.reportsService.getHourlyDistribution(date);
  }

  @Get('daily-closing')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.GATE_SUPERVISOR)
  @ApiOperation({ summary: 'Generate complete daily closing report' })
  async getDailyClosing(@Query('date') date: string) {
    return this.dailyClosingService.generateDailyClosingReport(date);
  }

  @Get('export/checkins')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Download CSV export of all check-ins for an event date' })
  async exportCheckins(
    @Query('date') date: string,
    @Res() res: Response,
  ) {
    const data = await this.reportsService.getCheckinsCsvData(date);

    if (data.length === 0) {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="checkins-${date}.csv"`);
      return res.send('CheckinID,TicketNumber,Name,Relation,CPF,Phone,Designation,Department,Gate,ScannedBy,EventDate,CheckinTimeIST,Status\n');
    }

    const headers = Object.keys(data[0]);
    const csvRows: string[] = [headers.join(',')];

    for (const row of data) {
      const values = headers.map((header) => {
        const val = (row as any)[header] ?? '';
        const escaped = String(val).replace(/"/g, '""');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(','));
    }

    const csvContent = csvRows.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="checkins-${date}.csv"`);
    res.send(csvContent);
  }
}

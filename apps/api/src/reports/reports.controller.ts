import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService, ReportFilters } from './reports.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@ongc/shared-types';

@ApiTags('Admin Reports & Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get(['', 'index'])
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.EVENT_ADMIN,
    UserRole.ADMIN,
    UserRole.GATE_MANAGER,
    UserRole.REPORT_VIEWER,
  )
  @ApiOperation({ summary: 'Get comprehensive event gate & entry audit report' })
  async getReports(@Query() filters: ReportFilters) {
    return this.reportsService.getReportsPageData(filters);
  }

  @Get('print')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.EVENT_ADMIN,
    UserRole.ADMIN,
    UserRole.GATE_MANAGER,
    UserRole.REPORT_VIEWER,
  )
  @ApiOperation({ summary: 'Get print-optimized report data' })
  async printReport(@Query() filters: ReportFilters) {
    return this.reportsService.buildReport(filters);
  }

  @Get('export')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.EVENT_ADMIN,
    UserRole.ADMIN,
    UserRole.GATE_MANAGER,
    UserRole.REPORT_VIEWER,
  )
  @ApiOperation({ summary: 'Stream CSV export of gate report' })
  async exportReport(
    @Query() filters: ReportFilters,
    @Query('sections') sections: string | string[],
    @Res() res: Response,
  ) {
    const secArray = Array.isArray(sections)
      ? sections
      : typeof sections === 'string'
      ? sections.split(',')
      : undefined;

    const csvContent = await this.reportsService.exportCsv(filters, secArray);
    const filename = `ongc_navratri_gate_report_${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(csvContent);
  }

  // Backward compatibility endpoints for legacy dashboard widgets
  @Get('summary')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.EVENT_ADMIN,
    UserRole.ADMIN,
    UserRole.GATE_MANAGER,
    UserRole.REPORT_VIEWER,
  )
  async getSummary(@Query('date') date?: string) {
    return this.reportsService.getSummary(date);
  }

  @Get('export/checkins')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.EVENT_ADMIN,
    UserRole.ADMIN,
    UserRole.GATE_MANAGER,
    UserRole.REPORT_VIEWER,
  )
  async exportCheckins(
    @Query('date') date: string,
    @Res() res: Response,
  ) {
    const csvContent = await this.reportsService.exportCsv({ event_date: date });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="checkins-${date || 'all'}.csv"`);
    res.send(csvContent);
  }
}

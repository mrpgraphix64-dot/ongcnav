import {
  Controller,
  Get,
  Query,
  Res,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService, ReportFilters } from './reports.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePagePermission } from '../common/decorators/page-permission.decorator';
import { UserRole } from '@ongc/shared-types';

@ApiTags('Admin Reports & Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@RequirePagePermission('commercial.reports', 'employee.reports')
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
    UserRole.COMMERCIAL_ADMIN,
    UserRole.EMPLOYEE_ADMIN,
  )
  @ApiOperation({ summary: 'Get comprehensive event gate & entry audit report' })
  async getReports(@Query() filters: ReportFilters, @Req() req?: Request) {
    const userRole = (req as any)?.user?.role;
    return this.reportsService.getReportsPageData(filters, userRole);
  }

  @Get('print')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.EVENT_ADMIN,
    UserRole.ADMIN,
    UserRole.GATE_MANAGER,
    UserRole.REPORT_VIEWER,
    UserRole.COMMERCIAL_ADMIN,
    UserRole.EMPLOYEE_ADMIN,
  )
  @ApiOperation({ summary: 'Get print-optimized report data' })
  async printReport(@Query() filters: ReportFilters, @Req() req?: Request) {
    const userRole = (req as any)?.user?.role;
    return this.reportsService.buildReport(filters, userRole);
  }

  @Get('export')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.EVENT_ADMIN,
    UserRole.ADMIN,
    UserRole.GATE_MANAGER,
    UserRole.REPORT_VIEWER,
    UserRole.COMMERCIAL_ADMIN,
    UserRole.EMPLOYEE_ADMIN,
  )
  @ApiOperation({ summary: 'Stream CSV export of gate report' })
  async exportReport(
    @Query() filters: ReportFilters,
    @Query('sections') sections: string | string[],
    @Res() res: Response,
    @Req() req?: Request,
  ) {
    const userRole = (req as any)?.user?.role;
    const secArray = Array.isArray(sections)
      ? sections
      : typeof sections === 'string'
      ? sections.split(',')
      : undefined;

    const csvContent = await this.reportsService.exportCsv(filters, secArray, userRole);
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
    UserRole.COMMERCIAL_ADMIN,
    UserRole.EMPLOYEE_ADMIN,
  )
  async getSummary(@Query('date') date?: string, @Req() req?: Request) {
    const userRole = req ? (req as any).user?.role : undefined;
    return this.reportsService.getSummary(date, userRole);
  }

  @Get('export/checkins')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.EVENT_ADMIN,
    UserRole.ADMIN,
    UserRole.GATE_MANAGER,
    UserRole.REPORT_VIEWER,
    UserRole.COMMERCIAL_ADMIN,
    UserRole.EMPLOYEE_ADMIN,
  )
  async exportCheckins(
    @Query('date') date: string,
    @Res() res: Response,
    @Req() req?: Request,
  ) {
    const userRole = req ? (req as any).user?.role : undefined;
    const csvContent = await this.reportsService.exportCsv({ event_date: date }, undefined, userRole);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="checkins-${date || 'all'}.csv"`);
    res.send(csvContent);
  }
}

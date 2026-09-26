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
import { DailyClosingService } from './daily-closing.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePagePermission } from '../common/decorators/page-permission.decorator';
import { UserRole } from '@ongc/shared-types';

@ApiTags('Admin Daily Closing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@RequirePagePermission('employee.operations')
@Controller(['admin/daily-closing', 'admin/reports/daily-closing'])
export class DailyClosingController {
  constructor(private readonly dailyClosingService: DailyClosingService) {}

  @Get(['', 'index'])
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.EVENT_ADMIN,
    UserRole.ADMIN,
    UserRole.GATE_MANAGER,
    UserRole.REPORT_VIEWER,
    UserRole.EMPLOYEE_ADMIN,
  )
  @ApiOperation({ summary: 'Get complete event-day operational closing and audit reconciliation' })
  async getDailyClosing(@Query('date') date?: string, @Req() req?: Request) {
    const userRole = req ? (req as any).user?.role : undefined;
    return this.dailyClosingService.generateDailyClosingReport(date, userRole);
  }

  @Get('export')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.EVENT_ADMIN,
    UserRole.ADMIN,
    UserRole.GATE_MANAGER,
    UserRole.REPORT_VIEWER,
    UserRole.EMPLOYEE_ADMIN,
  )
  @ApiOperation({ summary: 'Download official CSV export of daily closing operations' })
  async exportDailyClosing(
    @Query('date') date: string | undefined,
    @Res() res: Response,
    @Req() req?: Request,
  ) {
    const userRole = req ? (req as any).user?.role : undefined;
    const csvContent = await this.dailyClosingService.exportDailyClosingCsv(date, userRole);
    const filename = `daily-closing-${date || 'today'}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(csvContent);
  }
}

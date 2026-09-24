import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DailyClosingService } from './daily-closing.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@ongc/shared-types';

@ApiTags('Admin Daily Closing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
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
  )
  @ApiOperation({ summary: 'Get complete event-day operational closing and audit reconciliation' })
  async getDailyClosing(@Query('date') date?: string) {
    return this.dailyClosingService.generateDailyClosingReport(date);
  }

  @Get('export')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.EVENT_ADMIN,
    UserRole.ADMIN,
    UserRole.GATE_MANAGER,
    UserRole.REPORT_VIEWER,
  )
  @ApiOperation({ summary: 'Download official CSV export of daily closing operations' })
  async exportDailyClosing(
    @Query('date') date: string | undefined,
    @Res() res: Response,
  ) {
    const csvContent = await this.dailyClosingService.exportDailyClosingCsv(date);
    const filename = `daily-closing-${date || 'today'}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(csvContent);
  }
}

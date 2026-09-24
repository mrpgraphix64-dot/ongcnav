import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@ongc/shared-types';

@ApiTags('Admin Operations Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('live-stats')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.EVENT_ADMIN,
    UserRole.GATE_SUPERVISOR,
    UserRole.GATE_MANAGER,
    UserRole.HELP_DESK,
    UserRole.REGISTRATION_STAFF,
    UserRole.REPORT_VIEWER,
  )
  @ApiOperation({ summary: 'Get real-time operational dashboard stats & live metrics' })
  @ApiResponse({ status: 200, description: 'Live operational stats returned successfully' })
  async getLiveStats() {
    return this.dashboardService.getLiveStats();
  }
}

import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { EventControlService } from './event-control.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@ongc/shared-types';

@ApiTags('Admin Event Day Control Console')
@Controller(['admin/event-control', 'event-control'])
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class EventControlController {
  constructor(private readonly eventControlService: EventControlService) {}

  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.EVENT_ADMIN,
    UserRole.GATE_SUPERVISOR,
    UserRole.GATE_MANAGER,
    UserRole.REPORT_VIEWER,
  )
  @ApiOperation({ summary: 'Get full Event Control Console overview with real KPIs, per-gate metrics, and audit log' })
  async getConsoleOverview() {
    return this.eventControlService.getConsoleOverview();
  }

  @Get('status')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.EVENT_ADMIN,
    UserRole.GATE_SUPERVISOR,
    UserRole.GATE_MANAGER,
    UserRole.GATE_OPERATOR,
    UserRole.SCANNER_STAFF,
    UserRole.REGISTRATION_STAFF,
    UserRole.HELP_DESK,
    UserRole.REPORT_VIEWER,
    UserRole.COMMERCIAL_ADMIN,
    UserRole.EMPLOYEE_ADMIN,
  )
  @ApiOperation({ summary: 'Get current event status, scanning state, and operational date' })
  async getStatus() {
    return this.eventControlService.getStatus();
  }

  @Post('toggle-status')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EVENT_ADMIN)
  @ApiOperation({ summary: 'Toggle event status between OPEN and CLOSED' })
  async toggleStatus(@Req() req: any) {
    return this.eventControlService.toggleEventStatus(
      req.user?.id ? BigInt(req.user.id) : undefined,
    );
  }

  @Post('toggle-scanning')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EVENT_ADMIN)
  @ApiOperation({ summary: 'Toggle entry scanning between ENABLED and SUSPENDED' })
  async toggleScanning(@Req() req: any) {
    return this.eventControlService.toggleScanning(
      req.user?.id ? BigInt(req.user.id) : undefined,
    );
  }

  @Post('emergency-stop')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EVENT_ADMIN)
  @ApiOperation({ summary: 'Master emergency stop: immediately halt all scanning across all gates' })
  async emergencyStop(@Body('reason') reason: string, @Req() req: any) {
    return this.eventControlService.emergencyStop(
      reason,
      req.user?.id ? BigInt(req.user.id) : undefined,
    );
  }

  @Post('emergency-resume')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EVENT_ADMIN)
  @ApiOperation({ summary: 'Clear emergency stop and resume normal entry operations' })
  async emergencyResume(@Req() req: any) {
    return this.eventControlService.emergencyResume(
      req.user?.id ? BigInt(req.user.id) : undefined,
    );
  }

  @Post('set-date')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EVENT_ADMIN)
  @ApiOperation({ summary: 'Override or reset operational event date' })
  async setDate(@Body('active_date') activeDate: string, @Body('date') date: string, @Req() req: any) {
    const targetDate = activeDate !== undefined ? activeDate : date;
    return this.eventControlService.setDate(
      targetDate,
      req.user?.id ? BigInt(req.user.id) : undefined,
    );
  }

  @Post('gates/:id/toggle-open')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EVENT_ADMIN)
  @ApiOperation({ summary: 'Open or close entry gate lane' })
  async toggleGateOpen(@Param('id') id: string, @Req() req: any) {
    return this.eventControlService.toggleGateOpen(
      BigInt(id),
      req.user?.id ? BigInt(req.user.id) : undefined,
    );
  }

  @Put('gates/:id/capacity')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EVENT_ADMIN)
  @ApiOperation({ summary: 'Update gate maximum capacity limit, monitoring flag, and block-when-full rule' })
  async updateGateCapacity(
    @Param('id') id: string,
    @Body()
    body: {
      maximum_capacity?: number | null;
      maximumCapacity?: number | null;
      capacity_enabled?: boolean;
      capacityEnabled?: boolean;
      block_when_full?: boolean;
      blockWhenFull?: boolean;
    },
    @Req() req: any,
  ) {
    const maximumCapacity =
      body.maximumCapacity !== undefined
        ? body.maximumCapacity
        : body.maximum_capacity !== undefined
        ? body.maximum_capacity
        : undefined;

    const capacityEnabled =
      body.capacityEnabled !== undefined
        ? body.capacityEnabled
        : body.capacity_enabled !== undefined
        ? body.capacity_enabled
        : undefined;

    const blockWhenFull =
      body.blockWhenFull !== undefined
        ? body.blockWhenFull
        : body.block_when_full !== undefined
        ? body.block_when_full
        : undefined;

    return this.eventControlService.updateGateCapacity(
      BigInt(id),
      { maximumCapacity, capacityEnabled, blockWhenFull },
      req.user?.id ? BigInt(req.user.id) : undefined,
    );
  }
}

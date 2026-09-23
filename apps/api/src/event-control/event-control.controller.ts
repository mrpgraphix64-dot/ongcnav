import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EventControlService } from './event-control.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@ongc/shared-types';

@ApiTags('Event Control')
@Controller('event-control')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class EventControlController {
  constructor(private readonly eventControlService: EventControlService) {}

  @Get('status')
  @ApiOperation({ summary: 'Get current event status, scanning state, and operational date' })
  async getStatus() {
    return this.eventControlService.getStatus();
  }

  @Post('toggle-status')
  @Roles(UserRole.SUPER_ADMIN, UserRole.EVENT_ADMIN)
  @ApiOperation({ summary: 'Toggle event status between OPEN and CLOSED' })
  async toggleStatus(@Req() req: any) {
    return this.eventControlService.toggleEventStatus(req.user?.id ? BigInt(req.user.id) : undefined);
  }

  @Post('toggle-scanning')
  @Roles(UserRole.SUPER_ADMIN, UserRole.EVENT_ADMIN)
  @ApiOperation({ summary: 'Toggle entry scanning between ENABLED and SUSPENDED' })
  async toggleScanning(@Req() req: any) {
    return this.eventControlService.toggleScanning(req.user?.id ? BigInt(req.user.id) : undefined);
  }

  @Post('emergency-stop')
  @Roles(UserRole.SUPER_ADMIN, UserRole.EVENT_ADMIN)
  @ApiOperation({ summary: 'Master emergency stop: immediately halt all scanning across all gates' })
  async emergencyStop(@Body('reason') reason: string, @Req() req: any) {
    return this.eventControlService.emergencyStop(reason, req.user?.id ? BigInt(req.user.id) : undefined);
  }

  @Post('emergency-resume')
  @Roles(UserRole.SUPER_ADMIN, UserRole.EVENT_ADMIN)
  @ApiOperation({ summary: 'Clear emergency stop and resume normal entry operations' })
  async emergencyResume(@Req() req: any) {
    return this.eventControlService.emergencyResume(req.user?.id ? BigInt(req.user.id) : undefined);
  }

  @Post('set-date')
  @Roles(UserRole.SUPER_ADMIN, UserRole.EVENT_ADMIN)
  @ApiOperation({ summary: 'Override or reset operational event date' })
  async setDate(@Body('date') date: string, @Req() req: any) {
    return this.eventControlService.setDate(date, req.user?.id ? BigInt(req.user.id) : undefined);
  }
}

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
import { Request } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import {
  UpdateGroupSettingsDto,
  ResetEventDataDto,
  ToggleFullPowerDto,
  ToggleMaintenanceModeDto,
  UpdatePaymentSettingsDto,
} from './dto/update-settings.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@ongc/shared-types';

@ApiTags('Admin Settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get(['', 'index'])
  @Roles(UserRole.SUPER_ADMIN, UserRole.EVENT_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all event and portal operational settings' })
  async index(@Req() req: Request) {
    const user = (req as any).user;
    return this.settingsService.getAllSettings(user?.role);
  }

  @Get('super-admin')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Authoritative SUPER_ADMIN Control Center settings' })
  async getSuperAdminSettings(@Req() req: Request) {
    const user = (req as any).user;
    return this.settingsService.getSuperAdminSettings(user?.role);
  }

  @Post('super-admin/full-power')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Toggle SUPER_ADMIN Full Power mode with confirmation' })
  async toggleFullPower(@Body() dto: ToggleFullPowerDto, @Req() req: Request) {
    const user = (req as any).user;
    return this.settingsService.toggleFullPower(dto.enabled, dto.confirmation, user);
  }

  @Post('super-admin/maintenance-mode')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Toggle global event maintenance mode with confirmation' })
  async toggleMaintenanceMode(@Body() dto: ToggleMaintenanceModeDto, @Req() req: Request) {
    const user = (req as any).user;
    return this.settingsService.toggleMaintenanceMode(dto.enabled, dto.confirmation, user);
  }

  @Get('payment')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get Razorpay payment gateway configuration and toggle state' })
  async getPaymentSettings(@Req() req: Request) {
    const user = (req as any).user;
    return this.settingsService.getPaymentSettings(user?.role);
  }

  @Post('payment')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update Razorpay payment enabled/disabled state' })
  async updatePaymentSettings(@Body() dto: UpdatePaymentSettingsDto, @Req() req: Request) {
    const user = (req as any).user;
    return this.settingsService.updatePaymentSettings(dto.enabled, user);
  }

  @Post('reset-data')
  @Roles(UserRole.SUPER_ADMIN, UserRole.EVENT_ADMIN)
  @ApiOperation({ summary: 'Danger zone: Request event data purge' })
  async resetData(@Body() dto: ResetEventDataDto, @Req() req: Request) {
    const user = (req as any).user;
    return this.settingsService.resetEventData(dto.confirmation, user ? BigInt(user.id) : undefined);
  }

  @Post(':group')
  @Roles(UserRole.SUPER_ADMIN, UserRole.EVENT_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a specific settings group (general, event, qr, scanner, notifications, security)' })
  async updateGroup(
    @Param('group') group: string,
    @Body() dto: UpdateGroupSettingsDto,
    @Req() req: Request,
  ) {
    const user = (req as any).user;
    return this.settingsService.updateGroup(group, dto, user ? BigInt(user.id) : undefined);
  }
}

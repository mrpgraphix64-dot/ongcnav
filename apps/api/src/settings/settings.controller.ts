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
import { UpdateGroupSettingsDto, ResetEventDataDto } from './dto/update-settings.dto';
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
  async index() {
    return this.settingsService.getAllSettings();
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

  @Post('reset-data')
  @Roles(UserRole.SUPER_ADMIN, UserRole.EVENT_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Danger zone: Request event data purge' })
  async resetData(@Body() dto: ResetEventDataDto, @Req() req: Request) {
    const user = (req as any).user;
    return this.settingsService.resetEventData(dto.confirmation, user ? BigInt(user.id) : undefined);
  }
}

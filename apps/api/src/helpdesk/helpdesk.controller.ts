import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { HelpDeskService } from './helpdesk.service';
import { ManualCheckinDto, VoidCheckinDto } from './dto/helpdesk.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@ongc/shared-types';

@ApiTags('Admin Help Desk')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller(['admin/helpdesk', 'admin/help-desk'])
export class HelpDeskController {
  constructor(private readonly helpdeskService: HelpDeskService) {}

  @Get(['search', ''])
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.EVENT_ADMIN,
    UserRole.ADMIN,
    UserRole.GATE_MANAGER,
    UserRole.REGISTRATION_STAFF,
    UserRole.HELP_DESK,
    UserRole.SCANNER_STAFF,
  )
  @ApiOperation({ summary: 'Quick search for attendees, passes, or CPF records' })
  async search(@Query('q') q: string, @Req() req: Request) {
    const user = (req as any).user;
    return this.helpdeskService.search(q || '', user?.role);
  }

  @Post(['manual-checkin', 'checkin'])
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.EVENT_ADMIN,
    UserRole.ADMIN,
    UserRole.GATE_MANAGER,
    UserRole.REGISTRATION_STAFF,
    UserRole.HELP_DESK,
    UserRole.SCANNER_STAFF,
  )
  @ApiOperation({ summary: 'Manually check-in an attendee with mandatory justification' })
  async manualCheckin(@Body() dto: ManualCheckinDto, @Req() req: Request) {
    const user = (req as any).user;
    return this.helpdeskService.manualCheckin(dto, BigInt(user.id));
  }

  @Post(['void-checkin', 'checkin/:id/void'])
  @Roles(UserRole.SUPER_ADMIN, UserRole.EVENT_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Void an erroneous check-in record preserving full audit logs (Super/Event Admin only)' })
  async voidCheckin(
    @Param('id') paramId: string | undefined,
    @Body() dto: VoidCheckinDto,
    @Req() req: Request,
  ) {
    const user = (req as any).user;
    const targetCheckinId = paramId || dto.checkinId;
    const reason = dto.void_reason || dto.reason || '';
    return this.helpdeskService.voidCheckin(BigInt(targetCheckinId!), reason, BigInt(user.id));
  }
}

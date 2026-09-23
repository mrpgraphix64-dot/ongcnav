import {
  Controller,
  Get,
  Post,
  Body,
  Query,
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
@Controller('admin/helpdesk')
export class HelpDeskController {
  constructor(private readonly helpdeskService: HelpDeskService) {}

  @Get('search')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.HELP_DESK, UserRole.GATE_SUPERVISOR)
  @ApiOperation({ summary: 'Quick search for attendees, passes, or CPF records' })
  async search(@Query('q') q: string) {
    return this.helpdeskService.search(q || '');
  }

  @Post('manual-checkin')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.HELP_DESK)
  @ApiOperation({ summary: 'Manually check-in an attendee with mandatory justification' })
  async manualCheckin(@Body() dto: ManualCheckinDto, @Req() req: Request) {
    const user = (req as any).user;
    return this.helpdeskService.manualCheckin(dto, BigInt(user.id));
  }

  @Post('void-checkin')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Void an erroneous check-in record preserving full audit logs' })
  async voidCheckin(@Body() dto: VoidCheckinDto, @Req() req: Request) {
    const user = (req as any).user;
    return this.helpdeskService.voidCheckin(dto, BigInt(user.id));
  }
}

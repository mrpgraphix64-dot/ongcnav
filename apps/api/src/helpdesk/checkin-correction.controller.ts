import {
  Controller,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { HelpDeskService } from './helpdesk.service';
import { VoidCheckinDto } from './dto/helpdesk.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@ongc/shared-types';

@ApiTags('Admin Checkin Correction')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/checkin')
export class CheckinCorrectionController {
  constructor(private readonly helpdeskService: HelpDeskService) {}

  @Post(':id/void')
  @Roles(UserRole.SUPER_ADMIN, UserRole.EVENT_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Void check-in reversal (Laravel canonical route: /admin/checkin/{id}/void)' })
  async void(
    @Param('id') id: string,
    @Body() dto: VoidCheckinDto,
    @Req() req: Request,
  ) {
    const user = (req as any).user;
    const reason = dto.void_reason || dto.reason || '';
    return this.helpdeskService.voidCheckin(BigInt(id), reason, BigInt(user.id));
  }
}

import { Controller, Get, Post, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SuperAdminTestingService } from './super-admin-testing.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@ongc/shared-types';

@ApiTags('Super Admin Testing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@Controller('admin/testing')
export class SuperAdminTestingController {
  constructor(private readonly testingService: SuperAdminTestingService) {}

  @Get('preview')
  @ApiOperation({ summary: 'Preview latest commercial E-Pass, passes, email template, and gateway status' })
  async getPreview(@Req() req: Request) {
    const user = (req as any).user;
    return this.testingService.getTestingPreview(user?.role);
  }

  @Post('send-test-email')
  @ApiOperation({ summary: 'Dispatch test transactional E-Pass email to authenticated Super Admin' })
  async sendTestEmail(@Req() req: Request) {
    const user = (req as any).user;
    return this.testingService.sendTestEmail(user);
  }
}

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EmployeeDailyPassTestService } from './employee-daily-pass-test.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@ongc/shared-types';
import {
  GenerateTestPassDto,
  SendTestEmailDto,
  ScannerTestDto,
  RevokeTestPassDto,
  ResetScannerDto,
  CleanupSessionDto,
  CleanupAllDto,
  DispatchScheduleCheckDto,
} from './employee-daily-pass-test.dto';

@ApiTags('Super Admin Employee Daily Pass Test Lab')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@Controller('admin/test-lab/employee-daily-pass')
export class EmployeeDailyPassTestController {
  constructor(private readonly testService: EmployeeDailyPassTestService) {}

  @Get('employees')
  @ApiOperation({ summary: 'Search existing real employees for test lab selection' })
  async searchEmployees(@Query('search') search?: string) {
    return this.testService.searchEmployees(search);
  }

  @Get('recent-passes')
  @ApiOperation({ summary: 'List recent test passes generated in the test lab' })
  async getRecentTestPasses(@Req() req: Request) {
    const adminUser = (req as any).user;
    return this.testService.getRecentTestPasses(adminUser);
  }

  @Post('check-dispatch')
  @ApiOperation({ summary: 'Simulate automatic daily dispatch trigger based on simulated time and schedule' })
  async checkAndRunSimulatedDispatch(@Body() dto: DispatchScheduleCheckDto, @Req() req: Request) {
    const adminUser = (req as any).user;
    return this.testService.checkAndRunSimulatedDispatch(dto, adminUser);
  }

  @Post('generate')
  @ApiOperation({ summary: 'Generate an isolated test daily pass with secure QR token' })
  async generateTestPass(@Body() dto: GenerateTestPassDto, @Req() req: Request) {
    const adminUser = (req as any).user;
    return this.testService.generateTestPass(dto, adminUser);
  }

  @Get('preview-email/:token')
  @ApiOperation({ summary: 'Preview real employee daily pass email template HTML without sending' })
  async previewEmail(@Param('token') token: string) {
    return this.testService.previewEmail(token);
  }

  @Post('send-test-email')
  @ApiOperation({ summary: 'Dispatch test daily pass email strictly to designated test recipient' })
  async sendTestEmail(@Body() dto: SendTestEmailDto, @Req() req: Request) {
    const adminUser = (req as any).user;
    return this.testService.sendTestEmail(dto, adminUser);
  }

  @Post('retry-test-email')
  @ApiOperation({ summary: 'Retry sending test daily pass email to designated test recipient' })
  async retryTestEmail(@Body() dto: SendTestEmailDto, @Req() req: Request) {
    const adminUser = (req as any).user;
    return this.testService.retryTestEmail(dto, adminUser);
  }

  @Post('scanner/scan')
  @ApiOperation({ summary: 'Simulate scanner check-in validation against test pass' })
  async testScan(@Body() dto: ScannerTestDto, @Req() req: Request) {
    const adminUser = (req as any).user;
    const ip = (req.headers?.['x-forwarded-for'] as string) || req.socket?.remoteAddress;
    const userAgent = req.headers?.['user-agent'] as string;
    return this.testService.testScan(dto, adminUser, { ip, userAgent });
  }

  @Post('revoke')
  @ApiOperation({ summary: 'Revoke test pass to verify scanner ATTENDEE_INACTIVE rejection' })
  async revokeTestPass(@Body() dto: RevokeTestPassDto, @Req() req: Request) {
    const adminUser = (req as any).user;
    return this.testService.revokeTestPass(dto.token, adminUser);
  }

  @Post('reset-scanner')
  @ApiOperation({ summary: 'Reset test pass and scanner state back to ACTIVE' })
  async resetScannerState(@Body() dto: ResetScannerDto, @Req() req: Request) {
    const adminUser = (req as any).user;
    return this.testService.resetScannerState(dto.token, adminUser);
  }

  @Post('cleanup-session')
  @ApiOperation({ summary: 'Clean up all test passes and simulated scan records for a session' })
  async cleanupTestSession(@Body() dto: CleanupSessionDto, @Req() req: Request) {
    const adminUser = (req as any).user;
    return this.testService.cleanupTestSession(dto.testSessionId, adminUser);
  }

  @Post('cleanup-all')
  @ApiOperation({ summary: 'Purge all test lab data (test passes, simulated checkins, scan logs)' })
  async cleanupAllTestData(@Body() dto: CleanupAllDto, @Req() req: Request) {
    const adminUser = (req as any).user;
    return this.testService.cleanupAllTestData(dto.confirm, adminUser);
  }
}

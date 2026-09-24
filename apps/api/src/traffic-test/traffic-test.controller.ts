import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  Res,
  Headers,
  ForbiddenException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TrafficTestService } from './traffic-test.service';
import { CheckinService } from '../checkin/checkin.service';
import { StartLoadTestDto } from './dto/start-test.dto';
import { ProcessCheckinDto } from '../checkin/dto/checkin.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@ongc/shared-types';

@ApiTags('Admin Traffic Test Lab')
@Controller('admin/traffic-test')
export class TrafficTestController {
  constructor(
    private readonly trafficTestService: TrafficTestService,
    private readonly checkinService: CheckinService,
  ) {}

  @Get('runs')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'List all traffic test execution runs' })
  async listRuns() {
    return this.trafficTestService.listRuns();
  }

  @Get('runs/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get details of a specific traffic test run' })
  async getRun(@Param('id') id: string) {
    return this.trafficTestService.getRun(BigInt(id));
  }

  @Get('runs/:id/status')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get live status and telemetry of a traffic test run' })
  async getRunStatus(@Param('id') id: string) {
    return this.trafficTestService.getRunStatus(BigInt(id));
  }

  @Post('start')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Initiate a simulated load test run' })
  async startTest(@Body() dto: StartLoadTestDto, @Req() req: Request) {
    const user = (req as any).user;
    return this.trafficTestService.startTest(dto, BigInt(user.id));
  }

  @Post('runs/:id/stop')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Stop an active load test run' })
  async stopRun(@Param('id') id: string) {
    return this.trafficTestService.stopRun(BigInt(id));
  }

  @Get('runs/:id/export')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Export granular request logs to CSV' })
  async exportCsv(@Param('id') id: string, @Res() res: Response) {
    const csvData = await this.trafficTestService.exportCsv(BigInt(id));
    const filename = `loadtest_run_${id}_results.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvData);
  }

  @Delete('runs/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Purge test run and all isolated load test data' })
  async cleanupRun(@Param('id') id: string) {
    return this.trafficTestService.cleanupRun(BigInt(id));
  }

  @Post('runs/:id/cleanup')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Legacy POST alias to purge test run' })
  async cleanupRunPost(@Param('id') id: string) {
    return this.trafficTestService.cleanupRun(BigInt(id));
  }

  @Post('execute-checkin')
  @ApiOperation({ summary: 'Internal loopback check-in endpoint for real HTTP load testing' })
  async executeCheckin(
    @Body() dto: ProcessCheckinDto,
    @Headers('x-load-test-auth') authHeader: string,
    @Req() req: Request,
  ) {
    if (authHeader !== 'ongc-traffic-test-internal') {
      throw new ForbiddenException('Invalid load testing internal authorization');
    }

    const reqMeta = {
      ip: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    };

    return this.checkinService.processCheckin(
      { ...dto, isLoadTest: true },
      { id: '1', role: UserRole.ADMIN },
      reqMeta,
    );
  }
}

import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  HttpCode,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CheckinService } from './checkin.service';
import { ProcessCheckinDto, ScannerHeartbeatDto } from './dto/checkin.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole, isOfficialEventDate, OFFICIAL_EVENT_DATES } from '@ongc/shared-types';

@ApiTags('Scanner Checkin Engine')
@Controller('scanner')
export class ScannerController {
  constructor(private readonly checkinService: CheckinService) {}

  @Get('ping')
  @ApiOperation({ summary: 'Sub-millisecond lightweight scanner ping' })
  ping() {
    return { status: 'PONG', timestamp: Date.now() };
  }

  @Post('checkin')
  @HttpCode(200)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.GATE_OPERATOR,
    UserRole.SCANNER_STAFF,
    UserRole.GATE_SUPERVISOR,
    UserRole.GATE_MANAGER,
    UserRole.ADMIN,
    UserRole.EVENT_ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.HELP_DESK,
  )
  @ApiOperation({ summary: 'Process real-time check-in scan with sub-50ms atomic pipeline' })
  async checkin(@Body() dto: ProcessCheckinDto, @Req() req: Request) {
    const user = (req as any).user;
    const reqMeta = {
      ip: ((req.headers?.['x-forwarded-for'] as string) || req.socket?.remoteAddress || '127.0.0.1'),
      userAgent: req.headers?.['user-agent'],
    };

    // Explicit detection of test/simulation date from JSON body, query params, or custom headers
    const rawQueryTestDate = (req.query?.testDate || req.query?.simulationDate || req.query?.date) as string | undefined;
    const rawHeaderTestDate = (req.headers?.['x-test-date'] || req.headers?.['x-simulation-date'] || req.headers?.['x-event-date']) as string | undefined;
    const rawBodyTestDate = dto.testDate || dto.simulationDate;

    const requestedTestDate = (rawBodyTestDate || rawQueryTestDate || rawHeaderTestDate)?.trim();

    if (requestedTestDate) {
      if (user?.role !== UserRole.SUPER_ADMIN) {
        throw new ForbiddenException('Only SUPER_ADMIN is authorized to use scanner test-date simulation.');
      }
      if (!isOfficialEventDate(requestedTestDate)) {
        throw new BadRequestException(
          `Invalid scanner test date: "${requestedTestDate}". Allowed official event dates are: ${OFFICIAL_EVENT_DATES.join(', ')}`
        );
      }
    }

    // Public scanner requests must never set isLoadTest or loadTestRunId:
    // real HTTP load testing is restricted to /admin/traffic-test/execute-checkin
    return this.checkinService.processCheckin(
      {
        ...dto,
        testDate: user?.role === UserRole.SUPER_ADMIN ? requestedTestDate : undefined,
        isLoadTest: false,
        loadTestRunId: undefined,
      },
      user,
      reqMeta,
    );
  }

  @Post('heartbeat')
  @HttpCode(200)
  @ApiOperation({ summary: '8-second periodic heartbeat from handheld scanner devices' })
  async heartbeat(@Body() dto: ScannerHeartbeatDto) {
    return this.checkinService.heartbeat(dto);
  }
}

import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  Res,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EmployeesService } from './employees.service';
import { EmployeeDispatchSchedulerService } from './employee-dispatch-scheduler.service';
import { UpsertDispatchScheduleDto } from './dto/dispatch-schedule.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@ongc/shared-types';

@ApiTags('Admin Employees & Pass Registry')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin')
export class EmployeesController {
  constructor(
    private readonly employeesService: EmployeesService,
    private readonly dispatchSchedulerService: EmployeeDispatchSchedulerService,
  ) {}

  @Get('employees/daily-passes/dispatch-schedule')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.EMPLOYEE_ADMIN,
    UserRole.EVENT_ADMIN,
  )
  @ApiOperation({ summary: 'Get QR pass dispatch schedule for an event date or all dates' })
  async getDispatchSchedule(@Query('date') date?: string) {
    if (date) {
      return this.dispatchSchedulerService.getScheduleForDate(date);
    }
    return this.dispatchSchedulerService.getAllSchedules();
  }

  @Get('employees/daily-passes/dispatch-schedules')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.EMPLOYEE_ADMIN,
    UserRole.EVENT_ADMIN,
  )
  @ApiOperation({ summary: 'Get QR pass dispatch schedules for all official event dates' })
  async getAllDispatchSchedules() {
    return this.dispatchSchedulerService.getAllSchedules();
  }

  @Post('employees/daily-passes/dispatch-schedule')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.EMPLOYEE_ADMIN,
    UserRole.EVENT_ADMIN,
  )
  @ApiOperation({ summary: 'Save/Update QR pass dispatch schedule for an official event date' })
  async upsertDispatchSchedule(
    @Body() dto: UpsertDispatchScheduleDto,
    @Req() req: Request,
  ) {
    const adminUser = (req as any).user;
    return this.dispatchSchedulerService.upsertSchedule(dto, adminUser);
  }

  @Get('pass-summary')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.EMPLOYEE_ADMIN,
    UserRole.COMMERCIAL_ADMIN,
    UserRole.EVENT_ADMIN,
    UserRole.REGISTRATION_STAFF,
  )
  @ApiOperation({ summary: 'Global pass distribution counters across website, agent, and employees' })
  async getPassSummary() {
    return this.employeesService.getPassSummary();
  }

  @Get('employees/daily-passes/stats')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.EMPLOYEE_ADMIN,
    UserRole.EVENT_ADMIN,
  )
  @ApiOperation({ summary: 'Get daily employee pass stats for a specific event date' })
  async getDailyPassStats(@Query('date') date: string) {
    return this.employeesService.getDeliveryStats(date);
  }

  @Post('employees/daily-passes/generate')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.EMPLOYEE_ADMIN,
    UserRole.EVENT_ADMIN,
  )
  @ApiOperation({ summary: 'Generate unique daily employee QR passes for a specific event date' })
  async generateDailyPasses(@Body() body: { eventDate: string }) {
    return this.employeesService.generateDailyPasses(body.eventDate);
  }

  @Post('employees/daily-passes/send-emails')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.EMPLOYEE_ADMIN,
    UserRole.EVENT_ADMIN,
  )
  @ApiOperation({ summary: 'Trigger daily employee QR pass email delivery' })
  async sendDailyPassEmails(
    @Body() body: { eventDate: string; retryFailedOnly?: boolean; passId?: string },
  ) {
    return this.employeesService.sendDailyPassEmails(body.eventDate, {
      retryFailedOnly: body.retryFailedOnly,
      passId: body.passId ? BigInt(body.passId) : undefined,
    });
  }

  @Get('employees/daily-passes')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.EMPLOYEE_ADMIN,
    UserRole.EVENT_ADMIN,
  )
  @ApiOperation({ summary: 'List daily employee QR passes for an event date' })
  async listDailyPasses(
    @Query('date') date: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('emailStatus') emailStatus?: string,
    @Query('status') status?: string,
  ) {
    return this.employeesService.listDailyPasses(date, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      search,
      emailStatus,
      status,
    });
  }

  @Get('employees')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.EMPLOYEE_ADMIN,
    UserRole.REGISTRATION_STAFF,
    UserRole.EVENT_ADMIN,
  )
  @ApiOperation({ summary: 'List ONGC employees with pass status, checkin state, and filters' })
  async listEmployees(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('checkinStatus') checkinStatus?: string,
    @Query('date') date?: string,
  ) {
    return this.employeesService.listEmployees({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      search,
      status,
      checkinStatus,
      date,
    });
  }

  @Get('employees/export')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.EMPLOYEE_ADMIN,
    UserRole.EVENT_ADMIN,
  )
  @ApiOperation({ summary: 'Export complete employee registration dataset to Excel CSV' })
  async exportEmployees(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Res() res?: any,
  ) {
    const { csv, filename } = await this.employeesService.exportEmployeesToCsv({
      search,
      status,
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send('\uFEFF' + csv);
  }

  @Get('employees/:id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.EMPLOYEE_ADMIN,
    UserRole.REGISTRATION_STAFF,
    UserRole.EVENT_ADMIN,
  )
  @ApiOperation({ summary: 'Get full employee registration details for review' })
  async getEmployeeDetails(@Param('id') id: string) {
    return this.employeesService.getEmployeeDetails(BigInt(id));
  }

  @Post('employees/bulk-approve')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.EMPLOYEE_ADMIN,
    UserRole.EVENT_ADMIN,
  )
  @ApiOperation({ summary: 'Bulk approve employee registrations and activate passes' })
  async bulkApproveRegistrations(@Body() body: { ids: string[] }) {
    const bigIntIds = (body.ids || []).map((id) => BigInt(id));
    return this.employeesService.bulkApproveRegistrations(bigIntIds);
  }

  @Post('employees/bulk-reject')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.EMPLOYEE_ADMIN,
    UserRole.EVENT_ADMIN,
  )
  @ApiOperation({ summary: 'Bulk reject employee registrations and revoke passes' })
  async bulkRejectRegistrations(@Body() body: { ids: string[]; reason?: string }) {
    const bigIntIds = (body.ids || []).map((id) => BigInt(id));
    return this.employeesService.bulkRejectRegistrations(bigIntIds, body.reason);
  }

  @Post('employees/:id/approve')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.EMPLOYEE_ADMIN,
    UserRole.EVENT_ADMIN,
  )
  @ApiOperation({ summary: 'Approve employee registration and activate passes' })
  async approveRegistration(@Param('id') id: string) {
    return this.employeesService.approveRegistration(BigInt(id));
  }

  @Post('employees/:id/reject')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.EMPLOYEE_ADMIN,
    UserRole.EVENT_ADMIN,
  )
  @ApiOperation({ summary: 'Reject employee registration and revoke passes' })
  async rejectRegistration(@Param('id') id: string) {
    return this.employeesService.rejectRegistration(BigInt(id));
  }

  @Get('employees/:id/pass')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.EMPLOYEE_ADMIN,
    UserRole.REGISTRATION_STAFF,
    UserRole.EVENT_ADMIN,
  )
  @ApiOperation({ summary: 'Get employee pass details and printable QR pass' })
  async getEmployeePass(@Param('id') id: string) {
    return this.employeesService.getEmployeePass(BigInt(id));
  }
}

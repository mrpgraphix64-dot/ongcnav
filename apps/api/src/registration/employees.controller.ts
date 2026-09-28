import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EmployeesService } from './employees.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@ongc/shared-types';

@ApiTags('Admin Employees & Pass Registry')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

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

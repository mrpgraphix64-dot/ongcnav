import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { StaffService } from './staff.service';
import { CreateStaffDto, UpdateStaffDto } from './dto/create-staff.dto';
import { AssignGateDto } from './dto/assign-gate.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@ongc/shared-types';

@ApiTags('Admin Staff')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.GATE_SUPERVISOR)
  @ApiOperation({ summary: 'List all staff users with gate assignments' })
  async findAll(@Query('role') role?: string) {
    return this.staffService.findAll(role);
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.GATE_SUPERVISOR)
  @ApiOperation({ summary: 'Get staff user details' })
  async findOne(@Param('id') id: string) {
    return this.staffService.findOne(BigInt(id));
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create new staff member' })
  async create(@Body() dto: CreateStaffDto) {
    return this.staffService.create(dto);
  }

  @Put(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update staff member' })
  async update(@Param('id') id: string, @Body() dto: UpdateStaffDto) {
    return this.staffService.update(BigInt(id), dto);
  }

  @Post(':id/assign-gate')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.GATE_SUPERVISOR)
  @ApiOperation({ summary: 'Assign staff member to a gate' })
  async assignGate(@Param('id') id: string, @Body() dto: AssignGateDto) {
    return this.staffService.assignGate(BigInt(id), dto);
  }

  @Delete(':id/gates/:gateId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.GATE_SUPERVISOR)
  @ApiOperation({ summary: 'Remove staff gate assignment' })
  async unassignGate(
    @Param('id') id: string,
    @Param('gateId') gateId: string,
  ) {
    return this.staffService.unassignGate(BigInt(id), BigInt(gateId));
  }
}

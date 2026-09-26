import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
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
@Roles(UserRole.SUPER_ADMIN, UserRole.EVENT_ADMIN)
@Controller('admin/staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get()
  @ApiOperation({ summary: 'List all staff users with gate assignments and filters' })
  async findAll(
    @Query('role') role?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.staffService.findAll(role, status, search);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get staff user details' })
  async findOne(@Param('id') id: string) {
    return this.staffService.findOne(BigInt(id));
  }

  @Post()
  @ApiOperation({ summary: 'Create new staff member operator' })
  async create(@Body() dto: CreateStaffDto, @Req() req?: Request) {
    const user = req ? (req as any).user : undefined;
    return user !== undefined
      ? this.staffService.create(dto, user)
      : this.staffService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update staff member' })
  async update(@Param('id') id: string, @Body() dto: UpdateStaffDto, @Req() req?: Request) {
    const user = req ? (req as any).user : undefined;
    return user !== undefined
      ? this.staffService.update(BigInt(id), dto, user)
      : this.staffService.update(BigInt(id), dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Patch staff member' })
  async patch(@Param('id') id: string, @Body() dto: UpdateStaffDto, @Req() req?: Request) {
    const user = req ? (req as any).user : undefined;
    return user !== undefined
      ? this.staffService.update(BigInt(id), dto, user)
      : this.staffService.update(BigInt(id), dto);
  }

  @Post(':id/toggle')
  @ApiOperation({ summary: 'Toggle staff member active/inactive status' })
  async toggle(@Param('id') id: string, @Req() req?: Request) {
    const user = req ? (req as any).user : undefined;
    return this.staffService.toggleStatus(BigInt(id), user);
  }

  @Post(':id/toggle-status')
  @ApiOperation({ summary: 'Toggle staff member active/inactive status (Laravel alias)' })
  async toggleStatus(@Param('id') id: string, @Req() req?: Request) {
    const user = req ? (req as any).user : undefined;
    return this.staffService.toggleStatus(BigInt(id), user);
  }

  @Get(':id/activity')
  @ApiOperation({ summary: 'Get operator activity log audit history' })
  async getActivity(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.staffService.getActivity(BigInt(id), Number(page) || 1, Number(limit) || 25);
  }

  @Post(':id/assign-gate')
  @ApiOperation({ summary: 'Assign staff member to a gate' })
  async assignGate(@Param('id') id: string, @Body() dto: AssignGateDto) {
    return this.staffService.assignGate(BigInt(id), dto);
  }

  @Delete(':id/gates/:gateId')
  @ApiOperation({ summary: 'Remove staff gate assignment' })
  async unassignGate(
    @Param('id') id: string,
    @Param('gateId') gateId: string,
  ) {
    return this.staffService.unassignGate(BigInt(id), BigInt(gateId));
  }

  @Post('bulk-delete')
  @ApiOperation({ summary: 'Bulk delete staff accounts with operational dependency and RBAC safety checks' })
  async bulkDelete(@Body() body: { ids: string[] }, @Req() req: Request) {
    const user = (req as any).user;
    const staffIds = (body.ids || []).map((id) => BigInt(id));
    return this.staffService.bulkDeleteStaff(staffIds, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a staff account with operational dependency and RBAC safety checks' })
  async delete(@Param('id') id: string, @Req() req: Request) {
    const user = (req as any).user;
    return this.staffService.deleteStaff(BigInt(id), user);
  }

  @Post(':id/reset-password')
  @ApiOperation({ summary: 'Reset staff account password' })
  async resetPassword(
    @Param('id') id: string,
    @Body() body: { password?: string },
    @Req() req: Request,
  ) {
    const user = (req as any).user;
    return this.staffService.resetPassword(BigInt(id), user, body.password);
  }
}

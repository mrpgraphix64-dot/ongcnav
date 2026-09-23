import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  Res,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AttendeesService } from './attendees.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole, AttendeeStatus } from '@ongc/shared-types';
import * as path from 'path';
import * as fs from 'fs';

@ApiTags('Admin Attendees')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/attendees')
export class AttendeesController {
  constructor(private readonly attendeesService: AttendeesService) {}

  @Get('search')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.GATE_SUPERVISOR, UserRole.HELP_DESK)
  @ApiOperation({ summary: 'Search attendees by name, phone, ticket number or CPF' })
  async search(
    @Query('q') q: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.attendeesService.search(
      q || '',
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.GATE_SUPERVISOR, UserRole.HELP_DESK)
  @ApiOperation({ summary: 'Get attendee details by ID' })
  async findOne(@Param('id') id: string) {
    return this.attendeesService.findOne(BigInt(id));
  }

  @Patch(':id/status')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update attendee status (ACTIVE, SUSPENDED, REVOKED)' })
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: AttendeeStatus,
  ) {
    return this.attendeesService.updateStatus(BigInt(id), status);
  }

  @Get('photo/:employeeId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.GATE_SUPERVISOR, UserRole.HELP_DESK, UserRole.GATE_OPERATOR)
  @ApiOperation({ summary: 'Securely stream employee photo' })
  async streamPhoto(
    @Param('employeeId') employeeId: string,
    @Res() res: Response,
  ) {
    const relativePath = await this.attendeesService.getPhotoPath(BigInt(employeeId));
    const fullPath = path.resolve(process.cwd(), relativePath);

    if (!fs.existsSync(fullPath)) {
      throw new NotFoundException('Photo file does not exist on disk');
    }

    res.sendFile(fullPath);
  }
}

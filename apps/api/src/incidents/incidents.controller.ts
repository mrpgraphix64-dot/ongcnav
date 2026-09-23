import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IncidentsService } from './incidents.service';
import { CreateIncidentDto, UpdateIncidentDto } from './dto/create-incident.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@ongc/shared-types';

@ApiTags('Admin Incidents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/incidents')
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.GATE_SUPERVISOR,
    UserRole.HELP_DESK,
    UserRole.GATE_OPERATOR,
  )
  @ApiOperation({ summary: 'List incidents with gate, status, and severity filters' })
  async findAll(
    @Query('gateId') gateId?: string,
    @Query('status') status?: string,
    @Query('severity') severity?: string,
  ) {
    return this.incidentsService.findAll({ gateId, status, severity });
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.GATE_SUPERVISOR)
  @ApiOperation({ summary: 'Get incident details by ID' })
  async findOne(@Param('id') id: string) {
    return this.incidentsService.findOne(BigInt(id));
  }

  @Post()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.GATE_SUPERVISOR,
    UserRole.GATE_OPERATOR,
    UserRole.HELP_DESK,
  )
  @ApiOperation({ summary: 'Report a new incident' })
  async create(@Body() dto: CreateIncidentDto, @Req() req: Request) {
    const user = (req as any).user;
    return this.incidentsService.create(dto, BigInt(user.id));
  }

  @Put(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.GATE_SUPERVISOR)
  @ApiOperation({ summary: 'Update incident status, severity, or resolution notes' })
  async update(@Param('id') id: string, @Body() dto: UpdateIncidentDto) {
    return this.incidentsService.update(BigInt(id), dto);
  }
}

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
import { CreateIncidentDto, UpdateIncidentDto, ResolveIncidentDto } from './dto/create-incident.dto';
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
    UserRole.EVENT_ADMIN,
    UserRole.ADMIN,
    UserRole.GATE_MANAGER,
    UserRole.SCANNER_STAFF,
  )
  @ApiOperation({ summary: 'List incidents with gate, status, and severity filters' })
  async findAll(
    @Query('date') date?: string,
    @Query('gateId') gateId?: string,
    @Query('status') status?: string,
    @Query('category') category?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.incidentsService.findAll({
      date,
      gateId,
      status,
      category,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get(':id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.EVENT_ADMIN,
    UserRole.ADMIN,
    UserRole.GATE_MANAGER,
    UserRole.SCANNER_STAFF,
  )
  @ApiOperation({ summary: 'Get incident details by ID' })
  async findOne(@Param('id') id: string) {
    return this.incidentsService.findOne(BigInt(id));
  }

  @Post()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.EVENT_ADMIN,
    UserRole.ADMIN,
    UserRole.GATE_MANAGER,
    UserRole.SCANNER_STAFF,
  )
  @ApiOperation({ summary: 'Log a new event operational incident' })
  async create(@Body() dto: CreateIncidentDto, @Req() req: Request) {
    const user = (req as any).user;
    return this.incidentsService.create(dto, BigInt(user.id));
  }

  @Post(':id/resolve')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.EVENT_ADMIN,
    UserRole.ADMIN,
    UserRole.GATE_MANAGER,
    UserRole.SCANNER_STAFF,
  )
  @ApiOperation({ summary: 'Resolve an incident with mandatory resolution notes (Laravel canonical)' })
  async resolve(
    @Param('id') id: string,
    @Body() dto: ResolveIncidentDto,
    @Req() req: Request,
  ) {
    const user = (req as any).user;
    const notes = dto.resolution_notes || dto.resolutionNotes || '';
    return this.incidentsService.resolve(BigInt(id), notes, BigInt(user.id));
  }

  @Put(':id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.EVENT_ADMIN,
    UserRole.ADMIN,
    UserRole.GATE_MANAGER,
    UserRole.SCANNER_STAFF,
  )
  @ApiOperation({ summary: 'Update incident status, severity, or resolution notes' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateIncidentDto,
    @Req() req: Request,
  ) {
    const user = (req as any).user;
    return this.incidentsService.update(BigInt(id), dto, BigInt(user.id));
  }
}

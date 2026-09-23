import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { GatesService } from './gates.service';
import { CreateGateDto } from './dto/create-gate.dto';
import { UpdateGateDto } from './dto/update-gate.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@ongc/shared-types';

@ApiTags('Admin Gates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/gates')
export class GatesController {
  constructor(private readonly gatesService: GatesService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.GATE_SUPERVISOR, UserRole.HELP_DESK)
  @ApiOperation({ summary: 'List all gates with optional checkin stats' })
  async findAll(@Query('activeDate') activeDate?: string) {
    return this.gatesService.findAll(activeDate);
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.GATE_SUPERVISOR)
  @ApiOperation({ summary: 'Get gate details by ID' })
  async findOne(@Param('id') id: string) {
    return this.gatesService.findOne(BigInt(id));
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new gate' })
  async create(@Body() dto: CreateGateDto) {
    return this.gatesService.create(dto);
  }

  @Put(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update an existing gate' })
  async update(@Param('id') id: string, @Body() dto: UpdateGateDto) {
    return this.gatesService.update(BigInt(id), dto);
  }

  @Patch(':id/toggle-open')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.GATE_SUPERVISOR)
  @ApiOperation({ summary: 'Toggle gate open/closed status' })
  async toggleOpen(
    @Param('id') id: string,
    @Body('isOpen') isOpen: boolean,
  ) {
    return this.gatesService.toggleOpen(BigInt(id), isOpen);
  }

  @Patch(':id/toggle-scanning')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.GATE_SUPERVISOR)
  @ApiOperation({ summary: 'Pause or resume scanning at this gate' })
  async toggleScanning(
    @Param('id') id: string,
    @Body('isScanningPaused') isScanningPaused: boolean,
  ) {
    return this.gatesService.toggleScanning(BigInt(id), isScanningPaused);
  }
}

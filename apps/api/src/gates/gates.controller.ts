import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
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
@Roles(UserRole.SUPER_ADMIN, UserRole.EVENT_ADMIN, UserRole.GATE_MANAGER)
@Controller(['admin/gates', 'gates'])
export class GatesController {
  constructor(private readonly gatesService: GatesService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.EVENT_ADMIN, UserRole.GATE_MANAGER)
  @ApiOperation({ summary: 'List all gates with check-in volume and assigned staff' })
  async findAll(@Query('activeDate') activeDate?: string) {
    return this.gatesService.findAll(activeDate);
  }

  @Get('available-staff')
  @Roles(UserRole.SUPER_ADMIN, UserRole.EVENT_ADMIN, UserRole.GATE_MANAGER)
  @ApiOperation({ summary: 'Get active staff available for gate assignment' })
  async getAvailableStaff() {
    return this.gatesService.getAvailableStaff();
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.EVENT_ADMIN, UserRole.GATE_MANAGER)
  @ApiOperation({ summary: 'Get gate telemetry, breakdown, and recent logs' })
  async findOne(@Param('id') id: string, @Query('activeDate') activeDate?: string) {
    return this.gatesService.findOne(BigInt(id), activeDate);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.EVENT_ADMIN, UserRole.GATE_MANAGER)
  @ApiOperation({ summary: 'Create a new gate with optional staff assignment' })
  async create(@Body() dto: CreateGateDto) {
    return this.gatesService.create(dto);
  }

  @Put(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.EVENT_ADMIN, UserRole.GATE_MANAGER)
  @ApiOperation({ summary: 'Update gate details and sync staff operators' })
  async update(@Param('id') id: string, @Body() dto: UpdateGateDto) {
    return this.gatesService.update(BigInt(id), dto);
  }

  @Post(':id/toggle-status')
  @Roles(UserRole.SUPER_ADMIN, UserRole.EVENT_ADMIN, UserRole.GATE_MANAGER)
  @ApiOperation({ summary: 'Toggle gate active/inactive status' })
  async toggleStatus(@Param('id') id: string) {
    return this.gatesService.toggleStatus(BigInt(id));
  }

  @Post(':id/toggle')
  @Roles(UserRole.SUPER_ADMIN, UserRole.EVENT_ADMIN, UserRole.GATE_MANAGER)
  @ApiOperation({ summary: 'Laravel alias for toggle-status' })
  async toggle(@Param('id') id: string) {
    return this.gatesService.toggleStatus(BigInt(id));
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.EVENT_ADMIN, UserRole.GATE_MANAGER)
  @ApiOperation({ summary: 'Safe gate deletion with entry history preservation' })
  async remove(@Param('id') id: string) {
    return this.gatesService.remove(BigInt(id));
  }

  @Patch(':id/toggle-open')
  @Roles(UserRole.SUPER_ADMIN, UserRole.EVENT_ADMIN, UserRole.GATE_MANAGER)
  @ApiOperation({ summary: 'Toggle gate open/closed status' })
  async toggleOpen(@Param('id') id: string, @Body('isOpen') isOpen: boolean) {
    return this.gatesService.toggleOpen(BigInt(id), isOpen);
  }

  @Patch(':id/toggle-scanning')
  @Roles(UserRole.SUPER_ADMIN, UserRole.EVENT_ADMIN, UserRole.GATE_MANAGER)
  @ApiOperation({ summary: 'Pause or resume scanning at this gate' })
  async toggleScanning(
    @Param('id') id: string,
    @Body('isScanningPaused') isScanningPaused: boolean,
  ) {
    return this.gatesService.toggleScanning(BigInt(id), isScanningPaused);
  }
}

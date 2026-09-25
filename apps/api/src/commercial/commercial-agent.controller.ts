import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { CommercialAgentService } from './commercial-agent.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { AllocatePassesDto } from './dto/allocate-passes.dto';
import { ReclaimPassesDto } from './dto/reclaim-passes.dto';
import { AgentOfflineBookingDto } from './dto/agent-offline-booking.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@ongc/shared-types';

@ApiTags('Commercial Agent Operations')
@Controller('agent')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.COMMERCIAL_AGENT, UserRole.COMMERCIAL_SUB_AGENT)
@ApiBearerAuth()
export class CommercialAgentController {
  constructor(private readonly agentService: CommercialAgentService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get current agent profile, status, and summary counts' })
  async getProfile(@Req() req: Request) {
    const user = (req as any).user;
    return this.agentService.getAgentProfile(user.id);
  }

  @Get('allocations')
  @ApiOperation({ summary: 'Get current agent inventory allocations and available balances' })
  async getAllocations(@Req() req: Request) {
    const user = (req as any).user;
    return this.agentService.getAgentAllocations(user.id);
  }

  @Post('bookings/offline')
  @ApiOperation({ summary: 'Create an offline commercial booking with atomic inventory deduction' })
  async createOfflineBooking(
    @Req() req: Request,
    @Body() body: AgentOfflineBookingDto,
  ) {
    const user = (req as any).user;
    return this.agentService.createOfflineBooking(user.id, body);
  }

  @Get('bookings')
  @ApiOperation({ summary: 'List offline orders booked directly by this agent' })
  async getBookings(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    const user = (req as any).user;
    const p = page ? parseInt(page, 10) : 1;
    const l = limit ? parseInt(limit, 10) : 20;
    return this.agentService.getAgentBookings(user.id, p, l, search);
  }

  @Get('sub-agents')
  @Roles(UserRole.COMMERCIAL_AGENT)
  @ApiOperation({ summary: 'List direct sub-agents of this agent with allocation status' })
  async getSubAgents(@Req() req: Request) {
    const user = (req as any).user;
    return this.agentService.getSubAgents(user.id);
  }

  @Post('sub-agents')
  @Roles(UserRole.COMMERCIAL_AGENT)
  @ApiOperation({ summary: 'Create a new direct sub-agent under this agent' })
  async createSubAgent(
    @Req() req: Request,
    @Body() body: CreateAgentDto,
  ) {
    const user = (req as any).user;
    return this.agentService.createSubAgent(user.id, body);
  }

  @Post('sub-agents/:id/allocate')
  @Roles(UserRole.COMMERCIAL_AGENT)
  @ApiOperation({ summary: 'Sub-allocate passes from agent available balance to sub-agent' })
  async subAllocate(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: AllocatePassesDto,
  ) {
    const user = (req as any).user;
    return this.agentService.subAllocateToAgent(user.id, BigInt(id), body);
  }

  @Post('sub-agents/:id/reclaim')
  @Roles(UserRole.COMMERCIAL_AGENT)
  @ApiOperation({ summary: 'Reclaim unused passes from direct sub-agent back to parent agent' })
  async reclaimSubAgent(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: ReclaimPassesDto,
  ) {
    const user = (req as any).user;
    return this.agentService.reclaimFromSubAgent(user.id, BigInt(id), body);
  }

  @Get('sub-agents/:id/allocations')
  @Roles(UserRole.COMMERCIAL_AGENT)
  @ApiOperation({ summary: 'Oversight: View sub-agent allocations' })
  async getSubAgentAllocations(
    @Req() req: Request,
    @Param('id') id: string,
  ) {
    const user = (req as any).user;
    return this.agentService.getSubAgentAllocations(user.id, BigInt(id));
  }

  @Get('sub-agents/:id/bookings')
  @Roles(UserRole.COMMERCIAL_AGENT)
  @ApiOperation({ summary: 'Oversight: View sub-agent bookings' })
  async getSubAgentBookings(
    @Req() req: Request,
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const user = (req as any).user;
    const p = page ? parseInt(page, 10) : 1;
    const l = limit ? parseInt(limit, 10) : 20;
    return this.agentService.getSubAgentBookings(user.id, BigInt(id), p, l);
  }
}

@ApiTags('Commercial Admin - Agent Management')
@Controller('admin/commercial')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.COMMERCIAL_ADMIN)
@ApiBearerAuth()
export class CommercialAgentAdminController {
  constructor(private readonly agentService: CommercialAgentService) {}

  @Get('agents')
  @ApiOperation({ summary: 'List all commercial agents with hierarchy and allocations' })
  async getAllAgents(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    const p = page ? parseInt(page, 10) : 1;
    const l = limit ? parseInt(limit, 10) : 50;
    return this.agentService.getAllAgentsAdmin(p, l, search);
  }

  @Post('agents')
  @ApiOperation({ summary: 'Create a top-level commercial agent' })
  async createAgent(
    @Req() req: Request,
    @Body() body: CreateAgentDto,
  ) {
    const user = (req as any).user;
    return this.agentService.createAgentAdmin(user.id, body);
  }

  @Post('agents/:id/allocate')
  @ApiOperation({ summary: 'Allocate passes to a commercial agent' })
  async allocateToAgent(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: AllocatePassesDto,
  ) {
    const user = (req as any).user;
    return this.agentService.allocateToAgentAdmin(user.id, BigInt(id), body);
  }

  @Post('agents/:id/reclaim')
  @ApiOperation({ summary: 'Reclaim unused passes from a commercial agent' })
  async reclaimAgent(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: ReclaimPassesDto,
  ) {
    const user = (req as any).user;
    return this.agentService.reclaimFromAgentAdmin(user.id, BigInt(id), body);
  }

  @Get('allocations')
  @ApiOperation({ summary: 'List all allocations across all commercial agents' })
  async getAllAllocations() {
    return this.agentService.getAllAllocationsAdmin();
  }
}

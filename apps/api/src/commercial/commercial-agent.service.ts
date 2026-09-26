import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CommercialService } from './commercial.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { AllocatePassesDto } from './dto/allocate-passes.dto';
import { ReclaimPassesDto } from './dto/reclaim-passes.dto';
import { AgentOfflineBookingDto } from './dto/agent-offline-booking.dto';
import {
  COMMERCIAL_EVENT_DATES,
  COMMERCIAL_TICKET_TYPES,
  calculateServerPricePaise,
  generateOrderNumber,
} from './commercial.constants';
import {
  AttendeeStatus,
  CommercialOrderSource,
  CommercialPaymentMode,
  OrderStatus,
  PaymentStatus,
  RegistrationType,
  UserRole,
} from '@ongc/shared-types';
import { AllocationEventType } from '@prisma/client';

@Injectable()
export class CommercialAgentService {
  private readonly logger = new Logger(CommercialAgentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly commercialService: CommercialService,
  ) {}

  /**
   * Fetch agent profile and operational metadata.
   */
  async getAgentProfile(agentUserId: bigint) {
    const agent = await this.prisma.user.findUnique({
      where: { id: agentUserId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        staffId: true,
        role: true,
        isActive: true,
        parentAgentId: true,
        parentAgent: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: {
            subAgents: true,
            agentOrders: true,
          },
        },
      },
    });

    if (!agent || !agent.isActive) {
      throw new NotFoundException('Commercial agent account not found or inactive.');
    }

    return {
      id: agent.id.toString(),
      name: agent.name,
      email: agent.email,
      phone: agent.phone,
      staffId: agent.staffId,
      role: agent.role,
      isActive: agent.isActive,
      parentAgent: agent.parentAgent
        ? {
            id: agent.parentAgent.id.toString(),
            name: agent.parentAgent.name,
            email: agent.parentAgent.email,
          }
        : null,
      subAgentsCount: agent._count.subAgents,
      ordersCount: agent._count.agentOrders,
    };
  }

  /**
   * Fetch current agent allocations with calculated available balances.
   * Critical rule: Allocation is ONLY Agent + Pass Type + Quantity. Never date-based.
   */
  async getAgentAllocations(agentUserId: bigint) {
    const allocations = await this.prisma.agentAllocation.findMany({
      where: { agentId: agentUserId },
      orderBy: { passType: 'asc' },
    });

    const formatted = allocations.map((a) => {
      const available = Math.max(
        0,
        a.allocatedQuantity - a.bookedQuantity - a.subAllocatedQuantity,
      );
      const ticketTypeInfo = (COMMERCIAL_TICKET_TYPES as any)[a.passType];
      return {
        id: a.id.toString(),
        passType: a.passType,
        passTypeName: ticketTypeInfo?.name || a.passType,
        allocatedQuantity: a.allocatedQuantity,
        bookedQuantity: a.bookedQuantity,
        subAllocatedQuantity: a.subAllocatedQuantity,
        availableQuantity: available,
        updatedAt: a.updatedAt,
      };
    });

    const totalAllocated = formatted.reduce((acc, cur) => acc + cur.allocatedQuantity, 0);
    const totalBooked = formatted.reduce((acc, cur) => acc + cur.bookedQuantity, 0);
    const totalSubAllocated = formatted.reduce((acc, cur) => acc + cur.subAllocatedQuantity, 0);
    const totalAvailable = formatted.reduce((acc, cur) => acc + cur.availableQuantity, 0);

    return {
      allocations: formatted,
      summary: {
        totalAllocated,
        totalBooked,
        totalSubAllocated,
        totalAvailable,
      },
    };
  }

  /**
   * Create offline commercial booking by an agent.
   * Enforces:
   * 1. Provenance: Agent ID from JWT session.
   * 2. Atomic allocation check and deduction:
   *    Insufficient allocation = entire booking rejected; never partial fulfillment.
   * 3. Server-authoritative pricing and date validation.
   * 4. source = AGENT, paymentMode = OFFLINE, orderStatus = PAID, paymentStatus = CAPTURED.
   * 5. Attendees with secure QR tokens and ticket numbers generated.
   * 6. Mandatory customer email with asynchronous Hostinger email delivery.
   */
  async createOfflineBooking(agentUserId: bigint, dto: AgentOfflineBookingDto) {
    const agent = await this.prisma.user.findUnique({
      where: { id: agentUserId },
    });

    if (!agent || !agent.isActive) {
      throw new ForbiddenException('Agent account is inactive or not found.');
    }

    if (
      agent.role !== UserRole.COMMERCIAL_AGENT &&
      agent.role !== UserRole.COMMERCIAL_SUB_AGENT
    ) {
      throw new ForbiddenException('Only commercial agents and sub-agents can perform offline bookings.');
    }

    const ticketTypeCode = (dto.ticketType || '').trim().toUpperCase();
    const ticketConfig = (COMMERCIAL_TICKET_TYPES as any)[ticketTypeCode];
    if (!ticketConfig) {
      throw new BadRequestException(`Invalid ticket type: ${dto.ticketType}`);
    }

    if (!dto.quantity || dto.quantity < 1 || dto.quantity > 10) {
      throw new BadRequestException('Pass quantity must be between 1 and 10.');
    }

    // Validate dates
    let validDates: string[];
    if (ticketConfig.isSeasonPass) {
      validDates = [...COMMERCIAL_EVENT_DATES];
    } else {
      if (
        !dto.selectedDates ||
        dto.selectedDates.length !== 1 ||
        !COMMERCIAL_EVENT_DATES.includes(dto.selectedDates[0])
      ) {
        throw new BadRequestException(
          'Please select exactly one valid event date for this pass type.',
        );
      }
      validDates = [dto.selectedDates[0]];
    }

    const cleanMobile = dto.customerMobile.replace(/\D/g, '').slice(-10);
    if (cleanMobile.length !== 10) {
      throw new BadRequestException('A valid 10-digit mobile number is required.');
    }

    const cleanEmail = dto.customerEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new BadRequestException('A valid customer email address is mandatory.');
    }

    const pricing = calculateServerPricePaise(ticketTypeCode, validDates, dto.quantity);

    // Atomic transaction for allocation deduction, order persistence, and attendee creation
    const { order, passes } = await this.prisma.$transaction(async (tx) => {
      // Atomic inventory deduction with PostgreSQL row-level condition:
      // (allocated_quantity - booked_quantity - sub_allocated_quantity) >= quantity
      const updatedRows: any[] = await tx.$queryRaw`
        UPDATE agent_allocations
        SET booked_quantity = booked_quantity + ${dto.quantity},
            updated_at = NOW()
        WHERE agent_id = ${agentUserId}
          AND pass_type = ${ticketTypeCode}
          AND (allocated_quantity - booked_quantity - sub_allocated_quantity) >= ${dto.quantity}
        RETURNING *;
      `;

      if (!updatedRows || updatedRows.length === 0) {
        const existing = await tx.agentAllocation.findUnique({
          where: {
            agentId_passType: {
              agentId: agentUserId,
              passType: ticketTypeCode,
            },
          },
        });

        const available = existing
          ? Math.max(
              0,
              existing.allocatedQuantity -
                existing.bookedQuantity -
                existing.subAllocatedQuantity,
            )
          : 0;

        throw new BadRequestException(
          `Insufficient allocation for ${ticketConfig.name}. Required: ${dto.quantity}, Available: ${available}. The entire booking has been rejected.`,
        );
      }

      const orderNumber = generateOrderNumber();

      const newOrder = await tx.commercialOrder.create({
        data: {
          orderNumber,
          registrationType: RegistrationType.COMMERCIAL,
          source: CommercialOrderSource.AGENT,
          paymentMode: CommercialPaymentMode.OFFLINE,
          agentId: agentUserId,
          customerName: dto.customerName.trim(),
          customerMobile: cleanMobile,
          customerEmail: cleanEmail,
          ticketType: ticketTypeCode,
          selectedDates: validDates,
          quantity: dto.quantity,
          unitPricePaise: pricing.unitPricePaise,
          amountPaise: pricing.totalAmountPaise,
          currency: 'INR',
          orderStatus: OrderStatus.PAID,
          paymentStatus: PaymentStatus.CAPTURED,
          paidAt: new Date(),
          metadata: {
            bookedByAgentId: agent.id.toString(),
            bookedByAgentName: agent.name,
            bookedByAgentEmail: agent.email,
            offlineSaleConfirmed: true,
            termsAccepted: true,
            termsAcceptedAt: new Date().toISOString(),
          },
        },
      });

      await tx.allocationEvent.create({
        data: {
          allocationId: updatedRows[0].id,
          eventType: AllocationEventType.CONSUMPTION,
          quantityDelta: -dto.quantity,
          performedById: agentUserId,
          orderId: newOrder.id,
          notes: `Offline booking ${orderNumber} for ${dto.quantity} passes`,
        },
      });

      const createdPasses: any[] = [];
      for (let i = 0; i < dto.quantity; i++) {
        const qrToken = this.commercialService.generateSecureQrToken();
        const ticketNumber = this.commercialService.generateTicketNumber(orderNumber, i);

        const attendee = await tx.attendee.create({
          data: {
            registrationType: RegistrationType.COMMERCIAL,
            orderId: newOrder.id,
            name: newOrder.customerName,
            mobile: newOrder.customerMobile,
            email: newOrder.customerEmail,
            category: 'Commercial Pass',
            ticketNumber,
            qrCodeToken: qrToken,
            status: AttendeeStatus.ACTIVE,
            bookingDays: validDates,
          },
        });
        createdPasses.push(attendee);
      }

      return { order: newOrder, passes: createdPasses };
    });

    // Format passes with QR SVGs
    const formattedPasses = await this.commercialService.formatPasses(passes);

    // Send transactional ticket email asynchronously
    this.commercialService.sendTicketEmailSafe(order, passes);

    return {
      success: true,
      message: 'Offline sale confirmed successfully. Digital passes generated and sent to customer email.',
      order: {
        id: order.id.toString(),
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        customerMobile: order.customerMobile,
        customerEmail: order.customerEmail,
        ticketType: order.ticketType,
        selectedDates: order.selectedDates,
        quantity: order.quantity,
        amountInr: order.amountPaise / 100,
        amountPaise: order.amountPaise,
        source: order.source,
        paymentMode: order.paymentMode,
        paidAt: order.paidAt,
      },
      passes: formattedPasses,
    };
  }

  /**
   * Get orders booked directly by this agent. IDOR protected.
   */
  async getAgentBookings(
    agentUserId: bigint,
    page = 1,
    limit = 20,
    search?: string,
  ) {
    const p = Math.max(1, page);
    const l = Math.max(1, Math.min(100, limit));
    const skip = (p - 1) * l;

    const where: any = {
      agentId: agentUserId,
      source: CommercialOrderSource.AGENT,
    };

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { orderNumber: { contains: q, mode: 'insensitive' } },
        { customerName: { contains: q, mode: 'insensitive' } },
        { customerMobile: { contains: q, mode: 'insensitive' } },
        { customerEmail: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, orders] = await Promise.all([
      this.prisma.commercialOrder.count({ where }),
      this.prisma.commercialOrder.findMany({
        where,
        skip,
        take: l,
        orderBy: { createdAt: 'desc' },
        include: {
          attendees: {
            select: {
              id: true,
              ticketNumber: true,
              qrCodeToken: true,
              status: true,
            },
          },
        },
      }),
    ]);

    return {
      total,
      page: p,
      limit: l,
      orders: orders.map((o) => ({
        id: o.id.toString(),
        orderNumber: o.orderNumber,
        customerName: o.customerName,
        customerMobile: o.customerMobile,
        customerEmail: o.customerEmail,
        ticketType: o.ticketType,
        selectedDates: o.selectedDates,
        quantity: o.quantity,
        amountInr: o.amountPaise / 100,
        source: o.source,
        paymentMode: o.paymentMode,
        orderStatus: o.orderStatus,
        paymentStatus: o.paymentStatus,
        passesCount: o.attendees.length,
        passes: o.attendees.map((att) => ({
          id: att.id.toString(),
          ticketNumber: att.ticketNumber,
          status: att.status,
        })),
        createdAt: o.createdAt,
        paidAt: o.paidAt,
      })),
    };
  }

  /**
   * Create a direct sub-agent under a parent agent.
   */
  async createSubAgent(parentAgentId: bigint, dto: CreateAgentDto) {
    const parent = await this.prisma.user.findUnique({
      where: { id: parentAgentId },
    });

    if (!parent || !parent.isActive) {
      throw new ForbiddenException('Parent agent account is inactive or not found.');
    }

    if (parent.parentAgentId || parent.role === UserRole.COMMERCIAL_SUB_AGENT) {
      throw new ForbiddenException(
        'Sub-agents cannot create further sub-agents. Agent hierarchy is strictly 1 level (Agent -> Sub-Agent).',
      );
    }

    const cleanEmail = dto.email.trim().toLowerCase();
    const cleanPhone = dto.phone.trim();
    const cleanStaffId = dto.staffId?.trim() || null;

    // Check unique conflicts
    const conflict = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: cleanEmail, mode: 'insensitive' } },
          { phone: cleanPhone },
          ...(cleanStaffId ? [{ staffId: cleanStaffId }] : []),
        ],
      },
    });

    if (conflict) {
      throw new ConflictException(
        'An account with this email, mobile number, or ID already exists.',
      );
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const subAgent = await this.prisma.user.create({
      data: {
        name: dto.name.trim(),
        email: cleanEmail,
        phone: cleanPhone,
        staffId: cleanStaffId,
        password: hashedPassword,
        role: UserRole.COMMERCIAL_SUB_AGENT,
        parentAgentId,
        isActive: true,
      },
    });

    return {
      id: subAgent.id.toString(),
      name: subAgent.name,
      email: subAgent.email,
      phone: subAgent.phone,
      staffId: subAgent.staffId,
      role: subAgent.role,
      parentAgentId: parentAgentId.toString(),
      createdAt: subAgent.createdAt,
    };
  }

  /**
   * Get direct sub-agents of a parent agent with their allocation status.
   */
  async getSubAgents(parentAgentId: bigint) {
    const subAgents = await this.prisma.user.findMany({
      where: { parentAgentId },
      include: {
        allocations: true,
        _count: {
          select: { agentOrders: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return subAgents.map((sa) => {
      const totalAllocated = sa.allocations.reduce(
        (sum, a) => sum + a.allocatedQuantity,
        0,
      );
      const totalBooked = sa.allocations.reduce(
        (sum, a) => sum + a.bookedQuantity,
        0,
      );
      const totalSubAllocated = sa.allocations.reduce(
        (sum, a) => sum + a.subAllocatedQuantity,
        0,
      );
      const totalAvailable = Math.max(
        0,
        totalAllocated - totalBooked - totalSubAllocated,
      );

      return {
        id: sa.id.toString(),
        name: sa.name,
        email: sa.email,
        phone: sa.phone,
        staffId: sa.staffId,
        isActive: sa.isActive,
        createdAt: sa.createdAt,
        ordersCount: sa._count.agentOrders,
        allocations: sa.allocations.map((a) => ({
          passType: a.passType,
          allocatedQuantity: a.allocatedQuantity,
          bookedQuantity: a.bookedQuantity,
          availableQuantity: Math.max(
            0,
            a.allocatedQuantity - a.bookedQuantity - a.subAllocatedQuantity,
          ),
        })),
        metrics: {
          totalAllocated,
          totalBooked,
          totalAvailable,
        },
      };
    });
  }

  /**
   * Sub-allocate inventory from parent agent to child agent.
   * Parent agent must have sufficient available quota.
   * Atomically increments parent's sub_allocated_quantity and child's allocated_quantity.
   */
  async subAllocateToAgent(
    parentAgentId: bigint,
    subAgentId: bigint,
    dto: AllocatePassesDto,
  ) {
    // IDOR protection: Verify sub-agent belongs to parent agent
    const subAgent = await this.prisma.user.findFirst({
      where: {
        id: subAgentId,
        parentAgentId,
      },
    });

    if (!subAgent) {
      throw new NotFoundException(
        'Sub-agent not found or does not belong to your account.',
      );
    }

    const passTypeCode = dto.passType.trim().toUpperCase();
    const ticketConfig = (COMMERCIAL_TICKET_TYPES as any)[passTypeCode];
    if (!ticketConfig) {
      throw new BadRequestException(`Invalid ticket type: ${dto.passType}`);
    }

    if (!dto.quantity || dto.quantity < 1) {
      throw new BadRequestException('Allocation quantity must be at least 1.');
    }

    await this.prisma.$transaction(async (tx) => {
      // 1. Atomically deduct available quota from parent agent
      const updatedParent: any[] = await tx.$queryRaw`
        UPDATE agent_allocations
        SET sub_allocated_quantity = sub_allocated_quantity + ${dto.quantity},
            updated_at = NOW()
        WHERE agent_id = ${parentAgentId}
          AND pass_type = ${passTypeCode}
          AND (allocated_quantity - booked_quantity - sub_allocated_quantity) >= ${dto.quantity}
        RETURNING *;
      `;

      if (!updatedParent || updatedParent.length === 0) {
        const parentAlloc = await tx.agentAllocation.findUnique({
          where: {
            agentId_passType: {
              agentId: parentAgentId,
              passType: passTypeCode,
            },
          },
        });

        const available = parentAlloc
          ? Math.max(
              0,
              parentAlloc.allocatedQuantity -
                parentAlloc.bookedQuantity -
                parentAlloc.subAllocatedQuantity,
            )
          : 0;

        throw new BadRequestException(
          `Insufficient available allocation for ${passTypeCode}. Required: ${dto.quantity}, Available: ${available}.`,
        );
      }

      // Record sub-allocation event on parent allocation
      await tx.allocationEvent.create({
        data: {
          allocationId: updatedParent[0].id,
          eventType: AllocationEventType.SUB_ALLOCATE,
          quantityDelta: -dto.quantity,
          performedById: parentAgentId,
          notes: `Sub-allocated ${dto.quantity} ${passTypeCode} passes to sub-agent ID ${subAgentId}`,
        },
      });

      // 2. Atomically upsert sub-agent's allocation
      const upsertedChild: any[] = await tx.$queryRaw`
        INSERT INTO agent_allocations (
          agent_id, pass_type, allocated_quantity, booked_quantity, sub_allocated_quantity, allocated_by_id, created_at, updated_at
        ) VALUES (
          ${subAgentId}, ${passTypeCode}, ${dto.quantity}, 0, 0, ${parentAgentId}, NOW(), NOW()
        )
        ON CONFLICT (agent_id, pass_type)
        DO UPDATE SET
          allocated_quantity = agent_allocations.allocated_quantity + ${dto.quantity},
          updated_at = NOW()
        RETURNING *;
      `;

      if (upsertedChild && upsertedChild.length > 0) {
        await tx.allocationEvent.create({
          data: {
            allocationId: upsertedChild[0].id,
            eventType: AllocationEventType.ALLOCATE,
            quantityDelta: dto.quantity,
            performedById: parentAgentId,
            notes: `Received ${dto.quantity} ${passTypeCode} passes from parent agent ID ${parentAgentId}`,
          },
        });
      }
    });

    return {
      success: true,
      message: `Successfully allocated ${dto.quantity} ${passTypeCode} passes to sub-agent ${subAgent.name}.`,
    };
  }

  /**
   * Parent agent reclaiming unused allocation from direct sub-agent.
   * Formula: availableUnused = allocatedQuantity - bookedQuantity - subAllocatedQuantity.
   * Reclaim must reject if requestedReclaim > availableUnused.
   * Never reduce below bookedQuantity + subAllocatedQuantity.
   * Atomic guarded UPDATE in transaction.
   */
  async reclaimFromSubAgent(
    parentAgentId: bigint,
    subAgentId: bigint,
    dto: ReclaimPassesDto,
  ) {
    // IDOR protection: Verify sub-agent belongs to parent agent
    const subAgent = await this.prisma.user.findFirst({
      where: {
        id: subAgentId,
        parentAgentId,
      },
    });

    if (!subAgent) {
      throw new NotFoundException(
        'Sub-agent not found or does not belong to your account.',
      );
    }

    const passTypeCode = dto.passType.trim().toUpperCase();
    const ticketConfig = (COMMERCIAL_TICKET_TYPES as any)[passTypeCode];
    if (!ticketConfig) {
      throw new BadRequestException(`Invalid ticket type: ${dto.passType}`);
    }

    if (!dto.quantity || dto.quantity < 1) {
      throw new BadRequestException('Reclaim quantity must be at least 1.');
    }

    await this.prisma.$transaction(async (tx) => {
      // 1. Guarded atomic reduction of child's allocated_quantity
      const updatedChild: any[] = await tx.$queryRaw`
        UPDATE agent_allocations
        SET allocated_quantity = allocated_quantity - ${dto.quantity},
            updated_at = NOW()
        WHERE agent_id = ${subAgentId}
          AND pass_type = ${passTypeCode}
          AND (allocated_quantity - booked_quantity - sub_allocated_quantity) >= ${dto.quantity}
        RETURNING *;
      `;

      if (!updatedChild || updatedChild.length === 0) {
        const childAlloc = await tx.agentAllocation.findUnique({
          where: {
            agentId_passType: {
              agentId: subAgentId,
              passType: passTypeCode,
            },
          },
        });

        const available = childAlloc
          ? Math.max(
              0,
              childAlloc.allocatedQuantity -
                childAlloc.bookedQuantity -
                childAlloc.subAllocatedQuantity,
            )
          : 0;

        throw new BadRequestException(
          `Cannot reclaim ${dto.quantity} ${passTypeCode} passes. Sub-agent has only ${available} unused passes available to reclaim. Booked passes cannot be reclaimed.`,
        );
      }

      // 2. Decrement parent's sub_allocated_quantity
      const updatedParent: any[] = await tx.$queryRaw`
        UPDATE agent_allocations
        SET sub_allocated_quantity = sub_allocated_quantity - ${dto.quantity},
            updated_at = NOW()
        WHERE agent_id = ${parentAgentId}
          AND pass_type = ${passTypeCode}
          AND sub_allocated_quantity >= ${dto.quantity}
        RETURNING *;
      `;

      // 3. Record reclaim event for child
      await tx.allocationEvent.create({
        data: {
          allocationId: updatedChild[0].id,
          eventType: AllocationEventType.RECLAIM,
          quantityDelta: -dto.quantity,
          performedById: parentAgentId,
          notes: dto.notes || `Parent agent reclaimed ${dto.quantity} unused passes from sub-agent ${subAgent.name}`,
        },
      });

      // 4. Record event for parent
      if (updatedParent && updatedParent.length > 0) {
        await tx.allocationEvent.create({
          data: {
            allocationId: updatedParent[0].id,
            eventType: AllocationEventType.RECLAIM,
            quantityDelta: dto.quantity,
            performedById: parentAgentId,
            notes: `Quota reclaimed from sub-agent ${subAgent.name}`,
          },
        });
      }
    });

    return {
      success: true,
      message: `Successfully reclaimed ${dto.quantity} ${passTypeCode} passes from sub-agent ${subAgent.name}.`,
    };
  }

  /**
   * Oversight: View a sub-agent's allocations.
   * "Parent agent can view sub-agent allocation usage/bookings for oversight, but cannot book against or alter the sub-agent's inventory."
   */
  async getSubAgentAllocations(parentAgentId: bigint, subAgentId: bigint) {
    const subAgent = await this.prisma.user.findFirst({
      where: { id: subAgentId, parentAgentId },
    });

    if (!subAgent) {
      throw new NotFoundException('Sub-agent not found under your account.');
    }

    return this.getAgentAllocations(subAgentId);
  }

  /**
   * Oversight: View a sub-agent's bookings.
   */
  async getSubAgentBookings(
    parentAgentId: bigint,
    subAgentId: bigint,
    page = 1,
    limit = 20,
  ) {
    const subAgent = await this.prisma.user.findFirst({
      where: { id: subAgentId, parentAgentId },
    });

    if (!subAgent) {
      throw new NotFoundException('Sub-agent not found under your account.');
    }

    return this.getAgentBookings(subAgentId, page, limit);
  }

  // ==========================================
  // COMMERCIAL ADMIN & SUPER ADMIN ACTIONS
  // ==========================================

  /**
   * Admin: Create a top-level commercial agent.
   */
  async createAgentAdmin(adminUserId: bigint, dto: CreateAgentDto) {
    const cleanEmail = dto.email.trim().toLowerCase();
    const cleanPhone = dto.phone.trim();
    const cleanStaffId = dto.staffId?.trim() || null;

    const conflict = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: cleanEmail, mode: 'insensitive' } },
          { phone: cleanPhone },
          ...(cleanStaffId ? [{ staffId: cleanStaffId }] : []),
        ],
      },
    });

    if (conflict) {
      throw new ConflictException(
        'An account with this email, mobile number, or ID already exists.',
      );
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const agent = await this.prisma.user.create({
      data: {
        name: dto.name.trim(),
        email: cleanEmail,
        phone: cleanPhone,
        staffId: cleanStaffId,
        password: hashedPassword,
        role: UserRole.COMMERCIAL_AGENT,
        isActive: true,
      },
    });

    return {
      id: agent.id.toString(),
      name: agent.name,
      email: agent.email,
      phone: agent.phone,
      staffId: agent.staffId,
      role: agent.role,
      isActive: agent.isActive,
      createdAt: agent.createdAt,
    };
  }

  /**
   * Admin: Allocate passes to any commercial agent.
   */
  async allocateToAgentAdmin(
    adminUserId: bigint,
    targetAgentId: bigint,
    dto: AllocatePassesDto,
  ) {
    const agent = await this.prisma.user.findUnique({
      where: { id: targetAgentId },
    });

    if (!agent) {
      throw new NotFoundException('Target agent not found.');
    }

    const passTypeCode = dto.passType.trim().toUpperCase();
    const ticketConfig = (COMMERCIAL_TICKET_TYPES as any)[passTypeCode];
    if (!ticketConfig) {
      throw new BadRequestException(`Invalid ticket type: ${dto.passType}`);
    }

    if (!dto.quantity || dto.quantity < 1) {
      throw new BadRequestException('Allocation quantity must be at least 1.');
    }

    await this.prisma.$transaction(async (tx) => {
      const upserted: any[] = await tx.$queryRaw`
        INSERT INTO agent_allocations (
          agent_id, pass_type, allocated_quantity, booked_quantity, sub_allocated_quantity, allocated_by_id, created_at, updated_at
        ) VALUES (
          ${targetAgentId}, ${passTypeCode}, ${dto.quantity}, 0, 0, ${adminUserId}, NOW(), NOW()
        )
        ON CONFLICT (agent_id, pass_type)
        DO UPDATE SET
          allocated_quantity = agent_allocations.allocated_quantity + ${dto.quantity},
          updated_at = NOW()
        RETURNING *;
      `;

      if (upserted && upserted.length > 0) {
        await tx.allocationEvent.create({
          data: {
            allocationId: upserted[0].id,
            eventType: AllocationEventType.ALLOCATE,
            quantityDelta: dto.quantity,
            performedById: adminUserId,
            notes: `Admin allocated ${dto.quantity} ${passTypeCode} passes`,
          },
        });
      }
    });

    return {
      success: true,
      message: `Successfully allocated ${dto.quantity} ${passTypeCode} passes to agent ${agent.name}.`,
    };
  }

  /**
   * Admin: Reclaim unused passes from a commercial agent.
   */
  async reclaimFromAgentAdmin(
    adminUserId: bigint,
    targetAgentId: bigint,
    dto: ReclaimPassesDto,
  ) {
    const agent = await this.prisma.user.findUnique({
      where: { id: targetAgentId },
    });

    if (!agent) {
      throw new NotFoundException('Target agent not found.');
    }

    const passTypeCode = dto.passType.trim().toUpperCase();
    const ticketConfig = (COMMERCIAL_TICKET_TYPES as any)[passTypeCode];
    if (!ticketConfig) {
      throw new BadRequestException(`Invalid ticket type: ${dto.passType}`);
    }

    if (!dto.quantity || dto.quantity < 1) {
      throw new BadRequestException('Reclaim quantity must be at least 1.');
    }

    await this.prisma.$transaction(async (tx) => {
      const updatedRows: any[] = await tx.$queryRaw`
        UPDATE agent_allocations
        SET allocated_quantity = allocated_quantity - ${dto.quantity},
            updated_at = NOW()
        WHERE agent_id = ${targetAgentId}
          AND pass_type = ${passTypeCode}
          AND (allocated_quantity - booked_quantity - sub_allocated_quantity) >= ${dto.quantity}
        RETURNING *;
      `;

      if (!updatedRows || updatedRows.length === 0) {
        const existing = await tx.agentAllocation.findUnique({
          where: {
            agentId_passType: {
              agentId: targetAgentId,
              passType: passTypeCode,
            },
          },
        });

        const available = existing
          ? Math.max(
              0,
              existing.allocatedQuantity -
                existing.bookedQuantity -
                existing.subAllocatedQuantity,
            )
          : 0;

        throw new BadRequestException(
          `Cannot reclaim ${dto.quantity} ${passTypeCode} passes. Agent has only ${available} unused passes available to reclaim. Booked or sub-allocated passes cannot be reclaimed.`,
        );
      }

      await tx.allocationEvent.create({
        data: {
          allocationId: updatedRows[0].id,
          eventType: AllocationEventType.RECLAIM,
          quantityDelta: -dto.quantity,
          performedById: adminUserId,
          notes: dto.notes || `Admin reclaimed ${dto.quantity} ${passTypeCode} passes from agent ${agent.name}`,
        },
      });
    });

    return {
      success: true,
      message: `Successfully reclaimed ${dto.quantity} ${passTypeCode} passes from agent ${agent.name}.`,
    };
  }

  /**
   * Admin: List all commercial agents with hierarchy and allocation summaries.
   */
  async getAllAgentsAdmin(page = 1, limit = 50, search?: string) {
    const p = Math.max(1, page);
    const l = Math.max(1, Math.min(100, limit));
    const skip = (p - 1) * l;

    const where: any = {
      role: {
        in: [UserRole.COMMERCIAL_AGENT, UserRole.COMMERCIAL_SUB_AGENT],
      },
    };

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
        { staffId: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, agents] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip,
        take: l,
        orderBy: [{ parentAgentId: 'asc' }, { createdAt: 'desc' }],
        include: {
          parentAgent: {
            select: { id: true, name: true, email: true },
          },
          allocations: true,
          _count: {
            select: { subAgents: true, agentOrders: true },
          },
        },
      }),
    ]);

    return {
      total,
      page: p,
      limit: l,
      agents: agents.map((ag) => {
        const totalAllocated = ag.allocations.reduce(
          (sum, a) => sum + a.allocatedQuantity,
          0,
        );
        const totalBooked = ag.allocations.reduce(
          (sum, a) => sum + a.bookedQuantity,
          0,
        );
        const totalSubAllocated = ag.allocations.reduce(
          (sum, a) => sum + a.subAllocatedQuantity,
          0,
        );
        const totalAvailable = Math.max(
          0,
          totalAllocated - totalBooked - totalSubAllocated,
        );

        return {
          id: ag.id.toString(),
          name: ag.name,
          email: ag.email,
          phone: ag.phone,
          staffId: ag.staffId,
          isActive: ag.isActive,
          parentAgent: ag.parentAgent
            ? {
                id: ag.parentAgent.id.toString(),
                name: ag.parentAgent.name,
                email: ag.parentAgent.email,
              }
            : null,
          subAgentsCount: ag._count.subAgents,
          ordersCount: ag._count.agentOrders,
          allocations: ag.allocations.map((a) => ({
            id: a.id.toString(),
            passType: a.passType,
            allocatedQuantity: a.allocatedQuantity,
            bookedQuantity: a.bookedQuantity,
            subAllocatedQuantity: a.subAllocatedQuantity,
            availableQuantity: Math.max(
              0,
              a.allocatedQuantity - a.bookedQuantity - a.subAllocatedQuantity,
            ),
          })),
          summary: {
            totalAllocated,
            totalBooked,
            totalSubAllocated,
            totalAvailable,
          },
          createdAt: ag.createdAt,
        };
      }),
    };
  }

  /**
   * Admin: List all allocations across all agents.
   */
  async getAllAllocationsAdmin() {
    const allocations = await this.prisma.agentAllocation.findMany({
      include: {
        agent: {
          select: { id: true, name: true, email: true, parentAgentId: true },
        },
        allocatedBy: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: [{ passType: 'asc' }, { createdAt: 'desc' }],
    });

    return allocations.map((a) => ({
      id: a.id.toString(),
      passType: a.passType,
      allocatedQuantity: a.allocatedQuantity,
      bookedQuantity: a.bookedQuantity,
      subAllocatedQuantity: a.subAllocatedQuantity,
      availableQuantity: Math.max(
        0,
        a.allocatedQuantity - a.bookedQuantity - a.subAllocatedQuantity,
      ),
      agent: {
        id: a.agent.id.toString(),
        name: a.agent.name,
        email: a.agent.email,
        isSubAgent: !!a.agent.parentAgentId,
      },
      allocatedBy: a.allocatedBy
        ? {
            id: a.allocatedBy.id.toString(),
            name: a.allocatedBy.name,
            email: a.allocatedBy.email,
          }
        : null,
      updatedAt: a.updatedAt,
    }));
  }

  /**
   * Delete an agent account with strict operational dependency protections.
   */
  async deleteAgentAdmin(adminUserId: bigint, agentId: bigint) {
    const agent = await this.prisma.user.findUnique({
      where: { id: agentId },
      include: {
        subAgents: { select: { id: true, name: true } },
        agentOrders: { select: { id: true } },
        allocations: true,
        givenAllocations: { select: { id: true } },
        allocationEventsPerformed: { select: { id: true } },
        scannedLogs: { select: { id: true } },
        scannedCheckins: { select: { id: true } },
      },
    });

    if (!agent) {
      throw new NotFoundException(`Agent with ID ${agentId} not found.`);
    }

    if (agent.role !== UserRole.COMMERCIAL_AGENT && agent.role !== UserRole.COMMERCIAL_SUB_AGENT) {
      throw new BadRequestException('Target user is not a commercial agent.');
    }

    if (agent.subAgents.length > 0) {
      throw new BadRequestException(
        'This agent cannot be deleted because they have sub-agents assigned. Remove or reassign sub-agents first, or deactivate the agent.'
      );
    }

    if (agent.agentOrders.length > 0) {
      throw new BadRequestException(
        'This agent cannot be deleted because historical bookings or allocations are linked to this account. Deactivate the agent instead.'
      );
    }

    const hasActiveAllocations = agent.allocations.some(
      (a) => a.allocatedQuantity > 0 || a.bookedQuantity > 0 || a.subAllocatedQuantity > 0,
    );
    if (
      hasActiveAllocations ||
      agent.givenAllocations.length > 0 ||
      agent.allocationEventsPerformed.length > 0 ||
      agent.scannedLogs.length > 0 ||
      agent.scannedCheckins.length > 0
    ) {
      throw new BadRequestException(
        'This agent cannot be deleted because historical bookings or allocations are linked to this account. Deactivate the agent instead.'
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.agentAllocation.deleteMany({ where: { agentId } });
      await tx.gateUser.deleteMany({ where: { userId: agentId } });
      await tx.auditLog.deleteMany({ where: { userId: agentId } });
      await tx.user.delete({ where: { id: agentId } });
    });

    return { message: `Agent '${agent.name}' deleted successfully.` };
  }

  /**
   * Toggle agent active/inactive status.
   */
  async toggleAgentStatusAdmin(agentId: bigint) {
    const agent = await this.prisma.user.findUnique({
      where: { id: agentId },
      select: { id: true, name: true, isActive: true, role: true },
    });
    if (!agent) {
      throw new NotFoundException(`Agent with ID ${agentId} not found.`);
    }
    if (agent.role !== UserRole.COMMERCIAL_AGENT && agent.role !== UserRole.COMMERCIAL_SUB_AGENT) {
      throw new BadRequestException('Target user is not a commercial agent.');
    }

    const updated = await this.prisma.user.update({
      where: { id: agentId },
      data: { isActive: !agent.isActive },
    });

    return {
      id: updated.id.toString(),
      isActive: updated.isActive,
      message: `Agent '${agent.name}' ${updated.isActive ? 'activated' : 'deactivated'} successfully.`,
    };
  }

  /**
   * Fetch complete agent profile, sub-agents, allocations, and recent orders for drawer/modal.
   */
  async getAgentDetailsAdmin(agentId: bigint) {
    const agent = await this.prisma.user.findUnique({
      where: { id: agentId },
      include: {
        parentAgent: {
          select: { id: true, name: true, email: true, phone: true, staffId: true },
        },
        subAgents: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            staffId: true,
            isActive: true,
            allocations: true,
            _count: { select: { agentOrders: true } },
          },
        },
        allocations: true,
        agentOrders: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            _count: { select: { attendees: true } },
          },
        },
      },
    });

    if (!agent) {
      throw new NotFoundException(`Agent with ID ${agentId} not found.`);
    }

    const totalAllocated = agent.allocations.reduce((sum, a) => sum + a.allocatedQuantity, 0);
    const totalBooked = agent.allocations.reduce((sum, a) => sum + a.bookedQuantity, 0);
    const totalSubAllocated = agent.allocations.reduce((sum, a) => sum + a.subAllocatedQuantity, 0);
    const totalAvailable = Math.max(0, totalAllocated - totalBooked - totalSubAllocated);

    const revenuePaise = agent.agentOrders
      .filter((o) => o.orderStatus === OrderStatus.PAID)
      .reduce((sum, o) => sum + o.amountPaise, 0);

    return {
      id: agent.id.toString(),
      name: agent.name,
      email: agent.email,
      phone: agent.phone,
      staffId: agent.staffId,
      role: agent.role,
      isActive: agent.isActive,
      parentAgent: agent.parentAgent
        ? {
            id: agent.parentAgent.id.toString(),
            name: agent.parentAgent.name,
            email: agent.parentAgent.email,
            phone: agent.parentAgent.phone,
            staffId: agent.parentAgent.staffId,
          }
        : null,
      subAgents: agent.subAgents.map((sa) => {
        const saTotalAlloc = sa.allocations.reduce((s, a) => s + a.allocatedQuantity, 0);
        const saTotalBooked = sa.allocations.reduce((s, a) => s + a.bookedQuantity, 0);
        const saTotalSub = sa.allocations.reduce((s, a) => s + a.subAllocatedQuantity, 0);
        const saAvail = Math.max(0, saTotalAlloc - saTotalBooked - saTotalSub);
        return {
          id: sa.id.toString(),
          name: sa.name,
          email: sa.email,
          phone: sa.phone,
          staffId: sa.staffId,
          isActive: sa.isActive,
          ordersCount: sa._count.agentOrders,
          availableQuantity: saAvail,
        };
      }),
      allocations: agent.allocations.map((a) => {
        const avail = Math.max(0, a.allocatedQuantity - a.bookedQuantity - a.subAllocatedQuantity);
        const ticketInfo = (COMMERCIAL_TICKET_TYPES as any)[a.passType];
        return {
          id: a.id.toString(),
          passType: a.passType,
          passTypeName: ticketInfo?.name || a.passType,
          allocatedQuantity: a.allocatedQuantity,
          bookedQuantity: a.bookedQuantity,
          subAllocatedQuantity: a.subAllocatedQuantity,
          availableQuantity: avail,
        };
      }),
      summary: {
        totalAllocated,
        totalBooked,
        totalSubAllocated,
        totalAvailable,
        totalOrders: agent.agentOrders.length,
        totalSalesInr: revenuePaise / 100,
      },
      recentOrders: agent.agentOrders.map((o) => ({
        id: o.id.toString(),
        orderNumber: o.orderNumber,
        customerName: o.customerName,
        customerMobile: o.customerMobile,
        ticketType: o.ticketType,
        quantity: o.quantity,
        amountInr: o.amountPaise / 100,
        orderStatus: o.orderStatus,
        paymentMode: o.paymentMode,
        passesCount: o._count.attendees,
        createdAt: o.createdAt,
      })),
      createdAt: agent.createdAt,
    };
  }
}

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateIncidentDto, UpdateIncidentDto, ResolveIncidentDto } from './dto/create-incident.dto';
import { IncidentCategory, IncidentSeverity, IncidentStatus } from '@ongc/shared-types';

export const INCIDENT_CATEGORIES_MAP: Record<string, string> = {
  TICKET_ISSUE: 'Ticket / QR Issue',
  CAPACITY_LIMIT: 'Capacity Limit Reached',
  DUPLICATE_CLAIM: 'Duplicate Entry Dispute',
  SECURITY: 'Security Concern',
  MEDICAL: 'Medical / First Aid',
  LOST_FOUND: 'Lost & Found',
  OTHER: 'Other Incident',
};

@Injectable()
export class IncidentsService {
  constructor(private readonly prisma: PrismaService) {}

  private getTodayIst(): string {
    return new Date().toLocaleDateString('en-CA', {
      timeZone: 'Asia/Kolkata',
    });
  }

  private getTimeIst(): string {
    return new Date().toLocaleTimeString('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour12: false,
    });
  }

  private async getActiveEventDate(): Promise<string> {
    const setting = await this.prisma.setting.findFirst({
      where: {
        OR: [{ key: 'active_event_date' }, { key: 'event_control.active_event_date' }],
      },
    });
    return setting?.value || this.getTodayIst();
  }

  /**
   * Generates sequential Incident ID matching Laravel Incident::generateIncidentId():
   * Format: INC-YYYYMMDD-0001, INC-YYYYMMDD-0002
   */
  private async generateIncidentId(activeDate: string): Promise<string> {
    const dateStr = activeDate.replace(/-/g, '');
    const prefix = `INC-${dateStr}-`;

    const last = await this.prisma.incident.findFirst({
      where: {
        incidentNumber: { startsWith: prefix },
      },
      orderBy: { id: 'desc' },
      select: { incidentNumber: true },
    });

    let num = 1;
    if (last && last.incidentNumber) {
      const parts = last.incidentNumber.split('-');
      const lastNum = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastNum)) {
        num = lastNum + 1;
      }
    }

    return `${prefix}${String(num).padStart(4, '0')}`;
  }

  async findAll(filters?: {
    date?: string;
    status?: string;
    category?: string;
    gateId?: string;
    page?: number;
    limit?: number;
  }) {
    const activeDate = filters?.date || (await this.getActiveEventDate());
    const where: any = {};

    if (activeDate && activeDate !== 'all') {
      where.OR = [
        { incidentDate: activeDate },
        { createdAt: { gte: new Date(`${activeDate}T00:00:00.000Z`), lte: new Date(`${activeDate}T23:59:59.999Z`) } },
      ];
    }

    if (filters?.status && filters.status !== 'all' && filters.status !== '') {
      where.status = filters.status;
    }

    if (filters?.category && filters.category !== 'all' && filters.category !== '') {
      where.category = filters.category;
    }

    if (filters?.gateId && filters.gateId !== 'all' && filters.gateId !== '') {
      where.gateId = BigInt(filters.gateId);
    }

    const page = Math.max(1, Number(filters?.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(filters?.limit) || 20));
    const skip = (page - 1) * limit;

    const [total, incidents, gates, totalDateCount, openCount, inReviewCount, resolvedCount] =
      await Promise.all([
        this.prisma.incident.count({ where }),
        this.prisma.incident.findMany({
          where,
          skip,
          take: limit,
          orderBy: { id: 'desc' },
          include: {
            gate: { select: { id: true, name: true, gateNumber: true } },
            reportedBy: { select: { id: true, name: true, role: true, staffId: true } },
            resolvedBy: { select: { id: true, name: true, role: true, staffId: true } },
            attendee: { select: { id: true, name: true, ticketNumber: true, mobile: true } },
          },
        }),
        this.prisma.gate.findMany({
          orderBy: { gateNumber: 'asc' },
          select: { id: true, name: true, gateNumber: true },
        }),
        this.prisma.incident.count({
          where: activeDate && activeDate !== 'all' ? { incidentDate: activeDate } : {},
        }),
        this.prisma.incident.count({
          where: {
            ...(activeDate && activeDate !== 'all' ? { incidentDate: activeDate } : {}),
            status: 'OPEN' as any,
          },
        }),
        this.prisma.incident.count({
          where: {
            ...(activeDate && activeDate !== 'all' ? { incidentDate: activeDate } : {}),
            status: 'IN_REVIEW' as any,
          },
        }),
        this.prisma.incident.count({
          where: {
            ...(activeDate && activeDate !== 'all' ? { incidentDate: activeDate } : {}),
            status: { in: ['RESOLVED', 'CLOSED'] as any },
          },
        }),
      ]);

    const mapped = incidents.map((inc) => ({
      id: inc.id.toString(),
      incident_id: inc.incidentNumber,
      incidentNumber: inc.incidentNumber,
      category: inc.category,
      categoryLabel: INCIDENT_CATEGORIES_MAP[inc.category] || inc.category,
      severity: inc.severity,
      status: inc.status,
      title: inc.title,
      description: inc.description,
      ticket_id: inc.ticketId,
      ticketId: inc.ticketId,
      incident_date: inc.incidentDate,
      incident_time: inc.incidentTime,
      resolutionNotes: inc.resolutionNotes,
      resolution_notes: inc.resolutionNotes,
      resolvedAt: inc.resolvedAt?.toISOString() || null,
      createdAt: inc.createdAt.toISOString(),
      gate: inc.gate
        ? {
            id: inc.gate.id.toString(),
            name: inc.gate.name,
            code: inc.gate.gateNumber,
          }
        : null,
      creator: inc.reportedBy
        ? {
            id: inc.reportedBy.id.toString(),
            name: inc.reportedBy.name,
            role: inc.reportedBy.role,
            staffId: inc.reportedBy.staffId,
          }
        : null,
      reportedBy: inc.reportedBy
        ? {
            id: inc.reportedBy.id.toString(),
            name: inc.reportedBy.name,
            role: inc.reportedBy.role,
          }
        : null,
      resolver: inc.resolvedBy
        ? {
            id: inc.resolvedBy.id.toString(),
            name: inc.resolvedBy.name,
          }
        : null,
      attendee: inc.attendee
        ? {
            id: inc.attendee.id.toString(),
            name: inc.attendee.name,
            ticketNumber: inc.attendee.ticketNumber,
          }
        : null,
    }));

    return {
      incidents: mapped,
      metrics: {
        totalCount: totalDateCount,
        openCount,
        inReviewCount,
        resolvedCount,
      },
      totalCount: totalDateCount,
      openCount,
      inReviewCount,
      resolvedCount,
      categories: INCIDENT_CATEGORIES_MAP,
      gates: gates.map((g) => ({
        id: g.id.toString(),
        name: g.name,
        code: g.gateNumber,
      })),
      selectedDate: activeDate,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async findOne(id: bigint) {
    const inc = await this.prisma.incident.findUnique({
      where: { id },
      include: {
        gate: true,
        reportedBy: { select: { id: true, name: true, role: true, staffId: true, email: true } },
        resolvedBy: { select: { id: true, name: true, role: true, staffId: true } },
        attendee: true,
      },
    });

    if (!inc) {
      throw new NotFoundException(`Incident with ID ${id} not found`);
    }

    return {
      id: inc.id.toString(),
      incident_id: inc.incidentNumber,
      incidentNumber: inc.incidentNumber,
      category: inc.category,
      categoryLabel: INCIDENT_CATEGORIES_MAP[inc.category] || inc.category,
      severity: inc.severity,
      status: inc.status,
      title: inc.title,
      description: inc.description,
      ticket_id: inc.ticketId,
      ticketId: inc.ticketId,
      incident_date: inc.incidentDate,
      incident_time: inc.incidentTime,
      resolutionNotes: inc.resolutionNotes,
      resolution_notes: inc.resolutionNotes,
      resolvedAt: inc.resolvedAt?.toISOString() || null,
      createdAt: inc.createdAt.toISOString(),
      gate: inc.gate
        ? {
            id: inc.gate.id.toString(),
            name: inc.gate.name,
            code: inc.gate.gateNumber,
          }
        : null,
      reportedBy: inc.reportedBy
        ? {
            id: inc.reportedBy.id.toString(),
            name: inc.reportedBy.name,
            role: inc.reportedBy.role,
          }
        : null,
      resolvedBy: inc.resolvedBy
        ? {
            id: inc.resolvedBy.id.toString(),
            name: inc.resolvedBy.name,
          }
        : null,
      attendee: inc.attendee
        ? {
            id: inc.attendee.id.toString(),
            name: inc.attendee.name,
            ticketNumber: inc.attendee.ticketNumber,
          }
        : null,
    };
  }

  async create(dto: CreateIncidentDto, reportedById: bigint) {
    const activeDate = await this.getActiveEventDate();
    const incidentNumber = await this.generateIncidentId(activeDate);
    const timeStr = this.getTimeIst();

    const rawGateId = dto.gateId || dto.gate_id;
    let gateId: bigint | null = null;
    if (rawGateId && rawGateId !== '') {
      gateId = BigInt(rawGateId);
    }

    const ticket = (dto.ticketId || dto.ticket_id || '').trim().toUpperCase();
    let attendeeId: bigint | null = null;
    if (ticket) {
      const attendee = await this.prisma.attendee.findFirst({
        where: { ticketNumber: { equals: ticket, mode: 'insensitive' } },
        select: { id: true },
      });
      attendeeId = attendee?.id || null;
    }

    const categoryKey = dto.category.toUpperCase().replace(/\s+/g, '_');
    const validCategories = Object.keys(INCIDENT_CATEGORIES_MAP);
    const category = validCategories.includes(categoryKey)
      ? (categoryKey as any)
      : IncidentCategory.OTHER;

    const title = dto.title?.trim() || `${INCIDENT_CATEGORIES_MAP[category] || category} - ${activeDate}`;

    const incident = await this.prisma.$transaction(async (tx) => {
      const created = await tx.incident.create({
        data: {
          incidentNumber,
          gateId,
          reportedById,
          category,
          severity: dto.severity || IncidentSeverity.MEDIUM,
          status: IncidentStatus.OPEN as any,
          title,
          description: dto.description.trim(),
          ticketId: ticket || null,
          attendeeId,
          incidentDate: activeDate,
          incidentTime: timeStr,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: reportedById,
          action: 'incident_created',
          details: {
            incidentId: incidentNumber,
            category,
            ticketId: ticket || null,
            gateId: gateId?.toString() || null,
          },
        },
      });

      return created;
    });

    return this.findOne(incident.id);
  }

  async resolve(id: bigint, resolutionNotesRaw: string, resolvedById: bigint) {
    const notes = (resolutionNotesRaw || '').trim();
    if (!notes || notes.length < 5) {
      throw new BadRequestException('Resolution notes are required (minimum 5 characters).');
    }
    if (notes.length > 1000) {
      throw new BadRequestException('Resolution notes must not exceed 1000 characters.');
    }

    const inc = await this.findOne(id);

    await this.prisma.$transaction(async (tx) => {
      await tx.incident.update({
        where: { id },
        data: {
          status: 'RESOLVED' as any,
          resolvedById,
          resolvedAt: new Date(),
          resolutionNotes: notes,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: resolvedById,
          action: 'incident_resolved',
          details: {
            incidentId: inc.incidentNumber,
            resolutionNotes: notes,
          },
        },
      });
    });

    return this.findOne(id);
  }

  async update(id: bigint, dto: UpdateIncidentDto, updatedById?: bigint) {
    const inc = await this.findOne(id);
    const data: any = {};

    if (dto.status !== undefined) {
      data.status = dto.status as any;
      if (
        (dto.status as any) === IncidentStatus.RESOLVED ||
        (dto.status as any) === 'RESOLVED' ||
        (dto.status as any) === 'CLOSED'
      ) {
        data.resolvedAt = new Date();
        if (updatedById) data.resolvedById = updatedById;
      }
    }

    if (dto.severity !== undefined) {
      data.severity = dto.severity as any;
    }

    const notes = dto.resolution_notes || dto.resolutionNotes;
    if (notes !== undefined && notes.trim() !== '') {
      data.resolutionNotes = notes.trim();
    }

    await this.prisma.incident.update({
      where: { id },
      data,
    });

    return this.findOne(id);
  }
}

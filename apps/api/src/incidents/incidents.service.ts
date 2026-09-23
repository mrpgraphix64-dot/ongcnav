import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateIncidentDto, UpdateIncidentDto } from './dto/create-incident.dto';
import { IncidentStatus } from '@ongc/shared-types';
import * as crypto from 'crypto';

@Injectable()
export class IncidentsService {
  constructor(private readonly prisma: PrismaService) {}

  private generateIncidentNumber(): string {
    const today = new Date()
      .toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
      .replace(/-/g, '');
    const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
    return `INC-${today}-${rand}`;
  }

  async findAll(filters?: { gateId?: string; status?: string; severity?: string }) {
    const where: any = {};
    if (filters?.gateId) where.gateId = BigInt(filters.gateId);
    if (filters?.status) where.status = filters.status;
    if (filters?.severity) where.severity = filters.severity;

    const incidents = await this.prisma.incident.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        gate: {
          select: {
            id: true,
            name: true,
            gateNumber: true,
          },
        },
        reportedBy: {
          select: {
            id: true,
            name: true,
            role: true,
            email: true,
          },
        },
      },
    });

    return incidents.map((inc) => ({
      id: inc.id.toString(),
      incidentNumber: inc.incidentNumber,
      category: inc.category,
      severity: inc.severity,
      status: inc.status,
      title: inc.title,
      description: inc.description,
      resolutionNotes: inc.resolutionNotes,
      resolvedAt: inc.resolvedAt,
      createdAt: inc.createdAt,
      gate: inc.gate
        ? {
            id: inc.gate.id.toString(),
            name: inc.gate.name,
            gateNumber: inc.gate.gateNumber,
          }
        : null,
      reportedBy: inc.reportedBy
        ? {
            id: inc.reportedBy.id.toString(),
            name: inc.reportedBy.name,
            role: inc.reportedBy.role,
          }
        : null,
    }));
  }

  async findOne(id: bigint) {
    const inc = await this.prisma.incident.findUnique({
      where: { id },
      include: {
        gate: true,
        reportedBy: {
          select: {
            id: true,
            name: true,
            role: true,
            email: true,
          },
        },
      },
    });

    if (!inc) {
      throw new NotFoundException(`Incident with ID ${id} not found`);
    }

    return {
      id: inc.id.toString(),
      incidentNumber: inc.incidentNumber,
      category: inc.category,
      severity: inc.severity,
      status: inc.status,
      title: inc.title,
      description: inc.description,
      resolutionNotes: inc.resolutionNotes,
      resolvedAt: inc.resolvedAt,
      createdAt: inc.createdAt,
      gate: inc.gate
        ? {
            id: inc.gate.id.toString(),
            name: inc.gate.name,
            gateNumber: inc.gate.gateNumber,
          }
        : null,
      reportedBy: inc.reportedBy
        ? {
            id: inc.reportedBy.id.toString(),
            name: inc.reportedBy.name,
            role: inc.reportedBy.role,
          }
        : null,
    };
  }

  async create(dto: CreateIncidentDto, reportedById: bigint) {
    const incidentNumber = this.generateIncidentNumber();
    const created = await this.prisma.incident.create({
      data: {
        incidentNumber,
        gateId: BigInt(dto.gateId),
        reportedById,
        category: dto.category as any,
        severity: dto.severity as any,
        status: IncidentStatus.OPEN as any,
        title: dto.title,
        description: dto.description,
      },
    });

    return this.findOne(created.id);
  }

  async update(id: bigint, dto: UpdateIncidentDto) {
    await this.findOne(id);

    const data: any = {};
    if (dto.status !== undefined) {
      data.status = dto.status as any;
      if (
        (dto.status as any) === IncidentStatus.RESOLVED ||
        (dto.status as any) === 'RESOLVED' ||
        (dto.status as any) === 'CLOSED'
      ) {
        data.resolvedAt = new Date();
      }
    }
    if (dto.severity !== undefined) data.severity = dto.severity as any;
    if (dto.resolutionNotes !== undefined) data.resolutionNotes = dto.resolutionNotes;

    await this.prisma.incident.update({
      where: { id },
      data,
    });

    return this.findOne(id);
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGateDto } from './dto/create-gate.dto';
import { UpdateGateDto } from './dto/update-gate.dto';
import { GateStatus } from '@ongc/shared-types';

@Injectable()
export class GatesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(activeDate?: string) {
    const gates = await this.prisma.gate.findMany({
      orderBy: { gateNumber: 'asc' },
      include: {
        gateUsers: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                staffId: true,
                role: true,
                isActive: true,
              },
            },
          },
        },
      },
    });

    // If active date is provided, attach today's checkin counts
    if (activeDate) {
      const counts = await this.prisma.dailyCheckin.groupBy({
        by: ['gateId'],
        where: {
          eventDate: activeDate,
          isLoadTest: false,
        },
        _count: {
          id: true,
        },
      });

      const countMap = new Map<string, number>();
      for (const c of counts) {
        if (c.gateId) {
          countMap.set(c.gateId.toString(), c._count.id);
        }
      }

      return gates.map((g) => ({
        ...g,
        id: g.id.toString(),
        todayCheckinCount: countMap.get(g.id.toString()) || 0,
        gateUsers: g.gateUsers.map((gu) => ({
          ...gu,
          id: gu.id.toString(),
          gateId: gu.gateId.toString(),
          userId: gu.userId.toString(),
          user: {
            ...gu.user,
            id: gu.user.id.toString(),
          },
        })),
      }));
    }

    return gates.map((g) => ({
      ...g,
      id: g.id.toString(),
      gateUsers: g.gateUsers.map((gu) => ({
        ...gu,
        id: gu.id.toString(),
        gateId: gu.gateId.toString(),
        userId: gu.userId.toString(),
        user: {
          ...gu.user,
          id: gu.user.id.toString(),
        },
      })),
    }));
  }

  async findOne(id: bigint) {
    const gate = await this.prisma.gate.findUnique({
      where: { id },
      include: {
        gateUsers: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                staffId: true,
                role: true,
              },
            },
          },
        },
      },
    });

    if (!gate) {
      throw new NotFoundException(`Gate with ID ${id} not found`);
    }

    return {
      ...gate,
      id: gate.id.toString(),
      gateUsers: gate.gateUsers.map((gu) => ({
        ...gu,
        id: gu.id.toString(),
        gateId: gu.gateId.toString(),
        userId: gu.userId.toString(),
        user: {
          ...gu.user,
          id: gu.user.id.toString(),
        },
      })),
    };
  }

  async create(dto: CreateGateDto) {
    const created = await this.prisma.gate.create({
      data: {
        name: dto.name,
        gateNumber: dto.gateNumber,
        gateType: dto.gateType as any,
        status: (dto.status || GateStatus.ACTIVE) as any,
        capacityPerHour: dto.capacityPerHour,
        totalCapacity: dto.totalCapacity,
        isOpen: dto.isOpen ?? true,
        isScanningPaused: dto.isScanningPaused ?? false,
      },
    });

    return {
      ...created,
      id: created.id.toString(),
    };
  }

  async update(id: bigint, dto: UpdateGateDto) {
    await this.findOne(id);

    const updated = await this.prisma.gate.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.gateNumber !== undefined && { gateNumber: dto.gateNumber }),
        ...(dto.gateType !== undefined && { gateType: dto.gateType as any }),
        ...(dto.status !== undefined && { status: dto.status as any }),
        ...(dto.capacityPerHour !== undefined && { capacityPerHour: dto.capacityPerHour }),
        ...(dto.totalCapacity !== undefined && { totalCapacity: dto.totalCapacity }),
        ...(dto.isOpen !== undefined && { isOpen: dto.isOpen }),
        ...(dto.isScanningPaused !== undefined && { isScanningPaused: dto.isScanningPaused }),
      },
    });

    return {
      ...updated,
      id: updated.id.toString(),
    };
  }

  async toggleOpen(id: bigint, isOpen: boolean) {
    await this.findOne(id);
    const updated = await this.prisma.gate.update({
      where: { id },
      data: { isOpen },
    });
    return {
      ...updated,
      id: updated.id.toString(),
    };
  }

  async toggleScanning(id: bigint, isScanningPaused: boolean) {
    await this.findOne(id);
    const updated = await this.prisma.gate.update({
      where: { id },
      data: { isScanningPaused },
    });
    return {
      ...updated,
      id: updated.id.toString(),
    };
  }
}

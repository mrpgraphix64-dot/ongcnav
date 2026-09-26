import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGateDto } from './dto/create-gate.dto';
import { UpdateGateDto } from './dto/update-gate.dto';
import { GateStatus, GateType } from '@prisma/client';

function getTodayIST(): string {
  const now = new Date();
  const istDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const yyyy = istDate.getFullYear();
  const mm = String(istDate.getMonth() + 1).padStart(2, '0');
  const dd = String(istDate.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getISTDayRange(dateStr: string) {
  const [yyyy, mm, dd] = dateStr.split('-').map(Number);
  const start = new Date(Date.UTC(yyyy, mm - 1, dd, 0, 0, 0) - (5 * 3600 + 30 * 60) * 1000);
  const end = new Date(Date.UTC(yyyy, mm - 1, dd, 23, 59, 59, 999) - (5 * 3600 + 30 * 60) * 1000);
  return { start, end };
}

@Injectable()
export class GatesService {
  constructor(private readonly prisma: PrismaService) {}

  private resolveGateType(type?: string): GateType {
    if (!type) return GateType.REGULAR;
    const upper = type.toUpperCase().trim();
    if (upper === 'VIP' || upper === 'VVIP') return GateType.VIP;
    if (upper === 'STAFF' || upper === 'OFFICIAL') return GateType.OFFICIAL;
    if (upper === 'SERVICE' || upper === 'OTHER') return GateType.SERVICE;
    if (upper === 'EMERGENCY') return GateType.EMERGENCY;
    return GateType.REGULAR;
  }

  private mapGateTypeToLabel(type: GateType | string): string {
    switch (type) {
      case GateType.VIP:
      case 'VIP':
        return 'VIP';
      case GateType.OFFICIAL:
      case 'OFFICIAL':
        return 'Staff';
      case GateType.SERVICE:
      case 'SERVICE':
        return 'Service';
      case GateType.EMERGENCY:
      case 'EMERGENCY':
        return 'Emergency';
      case GateType.REGULAR:
      case 'REGULAR':
      default:
        return 'General';
    }
  }

  private resolveGateStatus(status?: string): GateStatus {
    if (!status) return GateStatus.ACTIVE;
    const lower = status.toLowerCase().trim();
    if (lower === 'inactive') return GateStatus.INACTIVE;
    if (lower === 'maintenance') return GateStatus.MAINTENANCE;
    return GateStatus.ACTIVE;
  }

  private serializeGate(g: any, checkinCount = 0) {
    const users = (g.gateUsers || []).map((gu: any) => ({
      id: (gu.user?.id ?? gu.userId).toString(),
      name: gu.user?.name ?? '',
      email: gu.user?.email ?? '',
      staff_id: gu.user?.staffId ?? null,
      staffId: gu.user?.staffId ?? null,
      role: gu.user?.role ?? '',
      isActive: gu.user?.isActive ?? true,
    }));

    const statusStr = (g.status || 'ACTIVE').toLowerCase();

    return {
      id: g.id.toString(),
      name: g.name,
      code: g.gateNumber,
      gateNumber: g.gateNumber,
      type: this.mapGateTypeToLabel(g.gateType),
      gateType: g.gateType,
      location: g.location ?? null,
      description: g.description ?? null,
      status: statusStr,
      gateStatus: g.status,
      is_active: g.status === GateStatus.ACTIVE || statusStr === 'active',
      isOpen: g.isOpen ?? true,
      is_open: g.isOpen ?? true,
      isScanningPaused: g.isScanningPaused ?? false,
      is_scanning_paused: g.isScanningPaused ?? false,
      capacityPerHour: g.capacityPerHour ?? null,
      totalCapacity: g.totalCapacity ?? null,
      maximum_capacity: g.totalCapacity ?? null,
      capacityEnabled: g.capacityEnabled ?? false,
      capacity_enabled: g.capacityEnabled ?? false,
      blockWhenFull: g.blockWhenFull ?? false,
      block_when_full: g.blockWhenFull ?? false,
      todayCheckinCount: checkinCount,
      today_checkins_count: checkinCount,
      users,
      gateUsers: (g.gateUsers || []).map((gu: any) => ({
        id: (gu.id ?? '').toString(),
        gateId: (gu.gateId ?? '').toString(),
        userId: (gu.userId ?? gu.user?.id ?? '').toString(),
        user: gu.user
          ? {
              ...gu.user,
              id: (gu.user.id ?? '').toString(),
            }
          : undefined,
      })),
      createdAt: g.createdAt,
      updatedAt: g.updatedAt,
    };
  }

  async findAll(activeDate?: string) {
    const today = activeDate || getTodayIST();

    const [gates, counts] = await Promise.all([
      this.prisma.gate.findMany({
        orderBy: [{ gateNumber: 'asc' }, { id: 'asc' }],
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
      }),
      this.prisma.dailyCheckin.groupBy({
        by: ['gateId'],
        where: {
          eventDate: today,
          status: 'SUCCESS',
          isLoadTest: false,
        },
        _count: {
          id: true,
        },
      }),
    ]);

    const countMap = new Map<string, number>();
    for (const c of counts) {
      if (c.gateId) {
        countMap.set(c.gateId.toString(), c._count.id);
      }
    }

    return gates.map((g) => this.serializeGate(g, countMap.get(g.id.toString()) || 0));
  }

  async getAvailableStaff() {
    const staff = await this.prisma.user.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        staffId: true,
        role: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return staff.map((u) => ({
      id: u.id.toString(),
      name: u.name,
      email: u.email,
      staff_id: u.staffId,
      staffId: u.staffId,
      role: u.role,
    }));
  }

  async findOne(id: bigint, activeDate?: string) {
    const today = activeDate || getTodayIST();
    const { start: startOfDay, end: endOfDay } = getISTDayRange(today);

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
                isActive: true,
              },
            },
          },
        },
      },
    });

    if (!gate) {
      throw new NotFoundException(`Gate with ID ${id} not found`);
    }

    // Telemetry counts
    const todaySuccessful = await this.prisma.dailyCheckin.count({
      where: {
        gateId: id,
        eventDate: today,
        status: 'SUCCESS',
      },
    });

    const todayDuplicates = await this.prisma.scanLog.count({
      where: {
        gateId: id,
        result: { in: ['duplicate', 'ALREADY_CHECKED_IN'] },
        scannedAt: { gte: startOfDay, lte: endOfDay },
      },
    });

    const todayInvalid = await this.prisma.scanLog.count({
      where: {
        gateId: id,
        result: { in: ['invalid', 'INVALID_QR'] },
        scannedAt: { gte: startOfDay, lte: endOfDay },
      },
    });

    const todayNotBooked = await this.prisma.scanLog.count({
      where: {
        gateId: id,
        result: { in: ['not_booked', 'NOT_BOOKED_TODAY'] },
        scannedAt: { gte: startOfDay, lte: endOfDay },
      },
    });

    const recentLogs = await this.prisma.scanLog.findMany({
      where: {
        gateId: id,
      },
      include: {
        attendee: {
          select: {
            id: true,
            name: true,
            ticketNumber: true,
            mobile: true,
            category: true,
          },
        },
        scannedBy: {
          select: {
            id: true,
            name: true,
            staffId: true,
            role: true,
          },
        },
      },
      orderBy: {
        scannedAt: 'desc',
      },
      take: 20,
    });

    const serializedGate = this.serializeGate(gate, todaySuccessful);

    return {
      gate: serializedGate,
      todaySuccessful,
      todayDuplicates,
      todayInvalid,
      todayNotBooked,
      recentLogs: recentLogs.map((l) => ({
        id: l.id.toString(),
        created_at: l.scannedAt,
        scannedAt: l.scannedAt,
        ticket_id_scanned: l.attendee?.ticketNumber || 'UNKNOWN',
        ticketIdScanned: l.attendee?.ticketNumber || 'UNKNOWN',
        result: l.result,
        attendee: l.attendee
          ? {
              id: l.attendee.id.toString(),
              name: l.attendee.name || 'Unrecognized Person',
              mobile: l.attendee.mobile,
              category: l.attendee.category,
            }
          : null,
        staff: l.scannedBy
          ? {
              id: l.scannedBy.id.toString(),
              name: l.scannedBy.name,
              staff_id: l.scannedBy.staffId,
              role: l.scannedBy.role,
            }
          : null,
      })),
    };
  }

  async create(dto: CreateGateDto) {
    const trimmedName = dto.name.trim();
    const code = (dto.code || dto.gateNumber || '').trim().toUpperCase();

    if (!code) {
      throw new BadRequestException('Gate code is required.');
    }

    const existingName = await this.prisma.gate.findFirst({
      where: {
        name: { equals: trimmedName, mode: 'insensitive' },
      },
    });
    if (existingName) {
      throw new BadRequestException('A gate with this name already exists.');
    }

    const existingCode = await this.prisma.gate.findFirst({
      where: {
        gateNumber: { equals: code, mode: 'insensitive' },
      },
    });
    if (existingCode) {
      throw new BadRequestException(
        'Gate code already exists. Please choose a unique code e.g. G4, GATE-NORTH.',
      );
    }

    const gateType = this.resolveGateType(dto.type || (dto.gateType as string));
    const status = this.resolveGateStatus(dto.status);
    const maximumCapacity = dto.maximum_capacity ?? dto.totalCapacity ?? null;

    const created = await this.prisma.$transaction(async (tx) => {
      const gate = await tx.gate.create({
        data: {
          name: trimmedName,
          gateNumber: code,
          gateType,
          status,
          location: dto.location ? dto.location.trim() : null,
          description: dto.description ? dto.description.trim() : null,
          capacityPerHour: dto.capacityPerHour ?? null,
          totalCapacity: maximumCapacity,
          capacityEnabled: dto.capacityEnabled ?? false,
          blockWhenFull: dto.blockWhenFull ?? false,
          isOpen: dto.isOpen ?? true,
          isScanningPaused: dto.isScanningPaused ?? false,
        },
      });

      if (dto.staff_ids && dto.staff_ids.length > 0) {
        const uniqueStaffIds = Array.from(new Set(dto.staff_ids.map((s) => BigInt(s))));
        await tx.gateUser.createMany({
          data: uniqueStaffIds.map((userId) => ({
            gateId: gate.id,
            userId,
          })),
        });
      }

      return tx.gate.findUnique({
        where: { id: gate.id },
        include: {
          gateUsers: {
            include: {
              user: true,
            },
          },
        },
      });
    });

    return this.serializeGate(created);
  }

  async update(id: bigint, dto: UpdateGateDto) {
    const existing = await this.prisma.gate.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Gate with ID ${id} not found`);
    }

    const trimmedName = dto.name !== undefined ? dto.name.trim() : undefined;
    if (trimmedName) {
      const existingName = await this.prisma.gate.findFirst({
        where: {
          name: { equals: trimmedName, mode: 'insensitive' },
          id: { not: id },
        },
      });
      if (existingName) {
        throw new BadRequestException('A gate with this name already exists.');
      }
    }

    const rawCode = dto.code !== undefined ? dto.code : dto.gateNumber;
    const code = rawCode !== undefined ? rawCode.trim().toUpperCase() : undefined;
    if (code) {
      const existingCode = await this.prisma.gate.findFirst({
        where: {
          gateNumber: { equals: code, mode: 'insensitive' },
          id: { not: id },
        },
      });
      if (existingCode) {
        throw new BadRequestException(
          'Gate code already exists. Please choose a unique code e.g. G4, GATE-NORTH.',
        );
      }
    }

    const gateType =
      dto.type !== undefined || dto.gateType !== undefined
        ? this.resolveGateType(dto.type || (dto.gateType as string))
        : undefined;

    const status = dto.status !== undefined ? this.resolveGateStatus(dto.status) : undefined;
    const maximumCapacity =
      dto.maximum_capacity !== undefined
        ? dto.maximum_capacity
        : dto.totalCapacity !== undefined
        ? dto.totalCapacity
        : undefined;

    const updated = await this.prisma.$transaction(async (tx) => {
      const gate = await tx.gate.update({
        where: { id },
        data: {
          ...(trimmedName !== undefined && { name: trimmedName }),
          ...(code !== undefined && { gateNumber: code }),
          ...(gateType !== undefined && { gateType }),
          ...(status !== undefined && { status }),
          ...(dto.location !== undefined && {
            location: dto.location ? dto.location.trim() : null,
          }),
          ...(dto.description !== undefined && {
            description: dto.description ? dto.description.trim() : null,
          }),
          ...(dto.capacityPerHour !== undefined && { capacityPerHour: dto.capacityPerHour }),
          ...(maximumCapacity !== undefined && { totalCapacity: maximumCapacity }),
          ...(dto.capacityEnabled !== undefined && { capacityEnabled: dto.capacityEnabled }),
          ...(dto.blockWhenFull !== undefined && { blockWhenFull: dto.blockWhenFull }),
          ...(dto.isOpen !== undefined && { isOpen: dto.isOpen }),
          ...(dto.isScanningPaused !== undefined && {
            isScanningPaused: dto.isScanningPaused,
          }),
        },
      });

      if (dto.staff_ids !== undefined) {
        await tx.gateUser.deleteMany({ where: { gateId: id } });
        if (dto.staff_ids && dto.staff_ids.length > 0) {
          const uniqueStaffIds = Array.from(new Set(dto.staff_ids.map((s) => BigInt(s))));
          await tx.gateUser.createMany({
            data: uniqueStaffIds.map((userId) => ({
              gateId: id,
              userId,
            })),
          });
        }
      }

      return tx.gate.findUnique({
        where: { id },
        include: {
          gateUsers: {
            include: {
              user: true,
            },
          },
        },
      });
    });

    return this.serializeGate(updated);
  }

  async toggleStatus(id: bigint) {
    const gate = await this.prisma.gate.findUnique({ where: { id } });
    if (!gate) {
      throw new NotFoundException(`Gate with ID ${id} not found`);
    }

    const newStatus =
      gate.status === GateStatus.ACTIVE ? GateStatus.INACTIVE : GateStatus.ACTIVE;

    const updated = await this.prisma.gate.update({
      where: { id },
      data: { status: newStatus },
      include: {
        gateUsers: {
          include: {
            user: true,
          },
        },
      },
    });

    const label = newStatus === GateStatus.ACTIVE ? 'activated' : 'deactivated';
    return {
      success: true,
      message: `Gate '${gate.name}' has been ${label}.`,
      gate: this.serializeGate(updated),
    };
  }

  async remove(id: bigint) {
    const gate = await this.prisma.gate.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            dailyCheckins: true,
            scanLogs: true,
          },
        },
      },
    });

    if (!gate) {
      throw new NotFoundException(`Gate with ID ${id} not found`);
    }

    const hasHistory = gate._count.dailyCheckins > 0 || gate._count.scanLogs > 0;

    if (hasHistory) {
      const updated = await this.prisma.gate.update({
        where: { id },
        data: { status: GateStatus.INACTIVE },
      });

      return {
        success: true,
        action: 'deactivated',
        warning: `Gate '${gate.name}' has historical entry records and cannot be permanently deleted. It has been deactivated to preserve complete audit reporting.`,
        gate: this.serializeGate(updated),
      };
    }

    await this.prisma.$transaction([
      this.prisma.gateUser.deleteMany({ where: { gateId: id } }),
      this.prisma.gate.delete({ where: { id } }),
    ]);

    return {
      success: true,
      action: 'deleted',
      message: `Gate '${gate.name}' was deleted successfully.`,
    };
  }

  async bulkRemove(ids: bigint[]) {
    if (!ids || ids.length === 0) {
      throw new BadRequestException('No gate IDs provided');
    }

    const gates = await this.prisma.gate.findMany({
      where: { id: { in: ids } },
      include: {
        _count: {
          select: {
            dailyCheckins: true,
            scanLogs: true,
          },
        },
      },
    });

    const deletableIds: bigint[] = [];
    const deactivatedGates: Array<{ id: string; name: string; reason: string }> = [];

    for (const gate of gates) {
      const hasHistory = gate._count.dailyCheckins > 0 || gate._count.scanLogs > 0;
      if (hasHistory) {
        await this.prisma.gate.update({
          where: { id: gate.id },
          data: { status: GateStatus.INACTIVE },
        });
        deactivatedGates.push({
          id: gate.id.toString(),
          name: gate.name,
          reason: 'Historical entry/scan records exist; gate deactivated instead of deleted.',
        });
      } else {
        deletableIds.push(gate.id);
      }
    }

    if (deletableIds.length > 0) {
      await this.prisma.$transaction([
        this.prisma.gateUser.deleteMany({ where: { gateId: { in: deletableIds } } }),
        this.prisma.gate.deleteMany({ where: { id: { in: deletableIds } } }),
      ]);
    }

    const deletedCount = deletableIds.length;
    const deactivatedCount = deactivatedGates.length;

    let message = '';
    if (deletedCount > 0 && deactivatedCount === 0) {
      message = `Successfully deleted ${deletedCount} gate(s).`;
    } else if (deletedCount > 0 && deactivatedCount > 0) {
      message = `Deleted ${deletedCount} gate(s). ${deactivatedCount} gate(s) had historical records and were deactivated instead.`;
    } else {
      message = `All ${deactivatedCount} selected gate(s) have historical entry records and were deactivated instead.`;
    }

    return {
      success: true,
      totalSelected: ids.length,
      deletedCount,
      deactivatedCount,
      deletedGateIds: deletableIds.map((id) => id.toString()),
      deactivatedGates,
      message,
    };
  }

  async toggleOpen(id: bigint, isOpen: boolean) {
    const gate = await this.prisma.gate.findUnique({ where: { id } });
    if (!gate) throw new NotFoundException(`Gate #${id} not found`);
    const updated = await this.prisma.gate.update({
      where: { id },
      data: { isOpen },
    });
    return this.serializeGate(updated);
  }

  async toggleScanning(id: bigint, isScanningPaused: boolean) {
    const gate = await this.prisma.gate.findUnique({ where: { id } });
    if (!gate) throw new NotFoundException(`Gate #${id} not found`);
    const updated = await this.prisma.gate.update({
      where: { id },
      data: { isScanningPaused },
    });
    return this.serializeGate(updated);
  }
}

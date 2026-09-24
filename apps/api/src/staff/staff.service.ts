import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStaffDto, UpdateStaffDto } from './dto/create-staff.dto';
import { AssignGateDto } from './dto/assign-gate.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(role?: string, status?: string, search?: string) {
    const where: any = {};

    if (role && role !== 'ALL') {
      where.role = role as any;
    }

    if (status && status !== 'ALL') {
      where.isActive = status === 'active';
    }

    if (search && search.trim() !== '') {
      const q = search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { staffId: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [users, lastActivities] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { name: 'asc' },
        include: {
          gateUsers: {
            include: {
              gate: true,
            },
          },
        },
      }),
      this.prisma.scanLog.groupBy({
        by: ['scannedById'],
        _max: { scannedAt: true },
      }),
    ]);

    const lastActivityMap = new Map<string, Date | null>(
      lastActivities
        .filter((a) => a.scannedById !== null)
        .map((a) => [a.scannedById!.toString(), a._max.scannedAt]),
    );

    return users.map((u) => this.mapStaffUser(u, lastActivityMap.get(u.id.toString()) || null));
  }

  async findOne(id: bigint) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        gateUsers: {
          include: {
            gate: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`Staff user with ID ${id} not found`);
    }

    const lastActivity = await this.prisma.scanLog.findFirst({
      where: { scannedById: id },
      orderBy: { scannedAt: 'desc' },
      select: { scannedAt: true },
    });

    return this.mapStaffUser(user, lastActivity?.scannedAt || null);
  }

  async create(dto: CreateStaffDto) {
    const email = dto.email.trim().toLowerCase();
    const existingEmail = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    if (existingEmail) {
      throw new ConflictException('A staff account with this email address already exists.');
    }

    let staffId = (dto.staff_id || dto.staffId)?.trim().toUpperCase() || null;
    if (staffId) {
      const existingStaffId = await this.prisma.user.findUnique({
        where: { staffId },
      });
      if (existingStaffId) {
        throw new ConflictException('This Staff ID is already assigned to another staff member.');
      }
    } else {
      let count = (await this.prisma.user.count()) + 1;
      staffId = `STF-${String(count).padStart(3, '0')}`;
      while (await this.prisma.user.findUnique({ where: { staffId } })) {
        count++;
        staffId = `STF-${String(count).padStart(3, '0')}`;
      }
    }

    const rawPassword = dto.password || 'OngcPass@2026';
    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    const isActive =
      dto.isActive !== undefined
        ? dto.isActive
        : dto.status !== undefined
        ? dto.status === 'active'
        : true;

    const rawGateIds = dto.gate_ids ?? dto.gates ?? (dto.gateId ? [dto.gateId] : []);
    const gateIds = Array.isArray(rawGateIds)
      ? rawGateIds.map((g) => BigInt(g)).filter((id) => id > 0)
      : [];

    const created = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: dto.name.trim(),
          email,
          phone: (dto.mobile || dto.phone)?.trim() || null,
          staffId,
          role: dto.role as any,
          isActive,
          password: hashedPassword,
        },
      });

      if (gateIds.length > 0) {
        await tx.gateUser.createMany({
          data: gateIds.map((gateId) => ({
            userId: user.id,
            gateId,
          })),
        });
      }

      return user;
    });

    return this.findOne(created.id);
  }

  async update(id: bigint, dto: UpdateStaffDto) {
    const existing = await this.prisma.user.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Staff user with ID ${id} not found`);
    }

    const updateData: any = {};

    if (dto.name !== undefined) {
      updateData.name = dto.name.trim();
    }

    if (dto.email !== undefined) {
      const email = dto.email.trim().toLowerCase();
      const duplicate = await this.prisma.user.findFirst({
        where: {
          email: { equals: email, mode: 'insensitive' },
          NOT: { id },
        },
      });
      if (duplicate) {
        throw new ConflictException('A staff account with this email address already exists.');
      }
      updateData.email = email;
    }

    if (dto.mobile !== undefined || dto.phone !== undefined) {
      const phoneVal = (dto.mobile ?? dto.phone)?.trim();
      updateData.phone = phoneVal || null;
    }

    if (dto.staff_id !== undefined || dto.staffId !== undefined) {
      const sId = (dto.staff_id ?? dto.staffId)?.trim().toUpperCase();
      if (sId) {
        const duplicate = await this.prisma.user.findFirst({
          where: {
            staffId: sId,
            NOT: { id },
          },
        });
        if (duplicate) {
          throw new ConflictException('This Staff ID is already assigned to another staff member.');
        }
        updateData.staffId = sId;
      }
    }

    if (dto.role !== undefined) {
      updateData.role = dto.role as any;
    }

    if (dto.isActive !== undefined) {
      updateData.isActive = dto.isActive;
    } else if (dto.status !== undefined) {
      updateData.isActive = dto.status === 'active';
    }

    if (dto.password && dto.password.trim() !== '') {
      updateData.password = await bcrypt.hash(dto.password.trim(), 10);
    }

    const rawGateIds = dto.gate_ids ?? dto.gates;
    const hasGateUpdate = rawGateIds !== undefined && rawGateIds !== null;
    const gateIds = hasGateUpdate && Array.isArray(rawGateIds)
      ? rawGateIds.map((g) => BigInt(g)).filter((gId) => gId > 0)
      : [];

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: updateData,
      });

      if (hasGateUpdate) {
        await tx.gateUser.deleteMany({
          where: { userId: id },
        });

        if (gateIds.length > 0) {
          await tx.gateUser.createMany({
            data: gateIds.map((gateId) => ({
              userId: id,
              gateId,
            })),
          });
        }
      }
    });

    return this.findOne(id);
  }

  async toggleStatus(id: bigint) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    if (!user) {
      throw new NotFoundException(`Staff user with ID ${id} not found`);
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        isActive: !user.isActive,
      },
    });

    return this.findOne(updated.id);
  }

  async getActivity(id: bigint, page = 1, limit = 25) {
    const user = await this.findOne(id);

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 25));
    const skip = (pageNum - 1) * limitNum;

    const [total, logs] = await Promise.all([
      this.prisma.scanLog.count({
        where: { scannedById: id },
      }),
      this.prisma.scanLog.findMany({
        where: { scannedById: id },
        include: {
          attendee: {
            include: {
              employee: {
                select: { name: true, cpf: true, department: true },
              },
              familyMember: {
                select: { name: true, relation: true },
              },
            },
          },
          gate: true,
        },
        orderBy: { scannedAt: 'desc' },
        skip,
        take: limitNum,
      }),
    ]);

    const mappedLogs = logs.map((log) => {
      const attendeeName =
        log.attendee?.familyMember?.name || log.attendee?.employee?.name || 'Unrecognized';
      const ticketScanned = log.attendee?.ticketNumber || 'N/A';
      const gateName = log.gate?.name || '—';
      const gateCode = log.gate?.gateNumber || '—';

      return {
        id: log.id.toString(),
        scannedAt: log.scannedAt,
        created_at: log.scannedAt,
        gate: {
          id: log.gate?.id ? log.gate.id.toString() : null,
          name: gateName,
          code: gateCode,
          gateNumber: gateCode,
        },
        gateName,
        gateCode,
        attendee: {
          id: log.attendee?.id ? log.attendee.id.toString() : null,
          name: attendeeName,
          ticketNumber: ticketScanned,
          category: log.attendee?.familyMember ? 'Family' : 'Employee',
        },
        attendeeName,
        ticket_id_scanned: ticketScanned,
        ticketNumber: ticketScanned,
        result: log.result,
        responseTimeMs: log.responseTimeMs,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
      };
    });

    return {
      user,
      logs: {
        data: mappedLogs,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1,
        hasMore: pageNum * limitNum < total,
      },
    };
  }

  async assignGate(userId: bigint, dto: AssignGateDto) {
    const gateId = BigInt(dto.gateId);
    await this.findOne(userId);

    const gate = await this.prisma.gate.findUnique({ where: { id: gateId } });
    if (!gate) {
      throw new NotFoundException(`Gate with ID ${dto.gateId} not found`);
    }

    const existing = await this.prisma.gateUser.findFirst({
      where: { userId, gateId },
    });
    if (existing) {
      return { message: 'Already assigned to this gate', assignmentId: existing.id.toString() };
    }

    const created = await this.prisma.gateUser.create({
      data: {
        userId,
        gateId,
      },
    });

    return {
      message: 'Gate assigned successfully',
      assignmentId: created.id.toString(),
    };
  }

  async unassignGate(userId: bigint, gateId: bigint) {
    await this.prisma.gateUser.deleteMany({
      where: { userId, gateId },
    });
    return { message: 'Gate unassigned successfully' };
  }

  private mapStaffUser(u: any, lastActivityAt: Date | null) {
    const gates = (u.gateUsers || []).map((gu: any) => ({
      assignmentId: gu.id ? gu.id.toString() : undefined,
      id: gu.gate.id.toString(),
      gateId: gu.gate.id.toString(),
      name: gu.gate.name,
      code: gu.gate.gateNumber,
      gateNumber: gu.gate.gateNumber,
      type: gu.gate.gateType,
      isOpen: gu.gate.isOpen,
    }));

    return {
      id: u.id.toString(),
      name: u.name,
      email: u.email,
      phone: u.phone,
      mobile: u.phone,
      staffId: u.staffId,
      staff_id: u.staffId,
      role: u.role,
      status: u.isActive ? 'active' : 'inactive',
      isActive: u.isActive,
      last_activity_at: lastActivityAt,
      gates,
      assignedGates: gates,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    };
  }
}

import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStaffDto, UpdateStaffDto } from './dto/create-staff.dto';
import { AssignGateDto } from './dto/assign-gate.dto';
import { UserRole } from '@ongc/shared-types';
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

  async create(dto: CreateStaffDto, currentUser?: { id: bigint | string; role: string }) {
    if (
      (dto.role === UserRole.COMMERCIAL_ADMIN || dto.role === UserRole.EMPLOYEE_ADMIN || dto.role === UserRole.SUPER_ADMIN) &&
      currentUser &&
      currentUser.role !== UserRole.SUPER_ADMIN
    ) {
      throw new ForbiddenException('Only a Super Admin can create domain administrator accounts.');
    }

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

    // Hard rule: Maximum 1 active COMMERCIAL_ADMIN and 1 active EMPLOYEE_ADMIN
    if (isActive) {
      if (dto.role === UserRole.COMMERCIAL_ADMIN) {
        const existingAdmin = await this.prisma.user.findFirst({
          where: { role: UserRole.COMMERCIAL_ADMIN, isActive: true },
        });
        if (existingAdmin) {
          throw new ConflictException('An active E-Pass Admin already exists. Only one active E-Pass Admin is permitted.');
        }
      } else if (dto.role === UserRole.EMPLOYEE_ADMIN) {
        const existingAdmin = await this.prisma.user.findFirst({
          where: { role: UserRole.EMPLOYEE_ADMIN, isActive: true },
        });
        if (existingAdmin) {
          throw new ConflictException('An active Employee Admin already exists. Only one active Employee Admin is permitted.');
        }
      }
    }

    const rawGateIds = dto.gate_ids ?? dto.gates ?? (dto.gateId ? [dto.gateId] : []);
    const gateIds = Array.isArray(rawGateIds)
      ? rawGateIds.map((g) => BigInt(g)).filter((id) => id > 0)
      : [];

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        // Concurrency lock: postgres advisory lock per domain role
        if (isActive && (dto.role === UserRole.COMMERCIAL_ADMIN || dto.role === UserRole.EMPLOYEE_ADMIN)) {
          if (typeof tx.$executeRaw === 'function') {
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`unique_active_admin_${dto.role}`}))`;
          }
          const concurrentCheck = await tx.user.findFirst({
            where: { role: dto.role as any, isActive: true },
          });
          if (concurrentCheck) {
            const roleLabel = dto.role === UserRole.COMMERCIAL_ADMIN ? 'E-Pass Admin' : 'Employee Admin';
            throw new ConflictException(`An active ${roleLabel} already exists. Only one active ${roleLabel} is permitted.`);
          }
        }

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
    } catch (err: any) {
      if (err?.code === 'P2002' || err?.message?.includes('unique_active_commercial_admin')) {
        throw new ConflictException('An active E-Pass Admin already exists. Only one active E-Pass Admin is permitted.');
      }
      if (err?.code === 'P2002' || err?.message?.includes('unique_active_employee_admin')) {
        throw new ConflictException('An active Employee Admin already exists. Only one active Employee Admin is permitted.');
      }
      throw err;
    }
  }

  async update(id: bigint, dto: UpdateStaffDto, currentUser?: { id: bigint | string; role: string }) {
    const existing = await this.prisma.user.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Staff user with ID ${id} not found`);
    }

    const targetRole = dto.role !== undefined ? (dto.role as UserRole) : (existing.role as UserRole);
    const targetIsActive =
      dto.isActive !== undefined
        ? dto.isActive
        : dto.status !== undefined
        ? dto.status === 'active'
        : existing.isActive;

    if (
      dto.role !== undefined &&
      dto.role !== existing.role &&
      (dto.role === UserRole.COMMERCIAL_ADMIN || dto.role === UserRole.EMPLOYEE_ADMIN || dto.role === UserRole.SUPER_ADMIN) &&
      currentUser &&
      currentUser.role !== UserRole.SUPER_ADMIN
    ) {
      throw new ForbiddenException('Only a Super Admin can promote a user to domain administrator.');
    }

    // Hard rule: Maximum 1 active COMMERCIAL_ADMIN and 1 active EMPLOYEE_ADMIN
    // When editing the existing active domain admin, id: { not: id } guarantees they are not treated as a duplicate of themselves
    if (
      (targetRole === UserRole.COMMERCIAL_ADMIN || targetRole === UserRole.EMPLOYEE_ADMIN) &&
      targetIsActive
    ) {
      const existingAdmin = await this.prisma.user.findFirst({
        where: {
          role: targetRole,
          isActive: true,
          id: { not: id },
        },
      });
      if (existingAdmin) {
        const roleLabel = targetRole === UserRole.COMMERCIAL_ADMIN ? 'E-Pass Admin' : 'Employee Admin';
        throw new ConflictException(`An active ${roleLabel} already exists. Only one active ${roleLabel} is permitted.`);
      }
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
          id: { not: id },
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
            id: { not: id },
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

    try {
      await this.prisma.$transaction(async (tx) => {
        if ((targetRole === UserRole.COMMERCIAL_ADMIN || targetRole === UserRole.EMPLOYEE_ADMIN) && targetIsActive) {
          if (typeof tx.$executeRaw === 'function') {
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`unique_active_admin_${targetRole}`}))`;
          }
          const concurrentCheck = await tx.user.findFirst({
            where: {
              role: targetRole,
              isActive: true,
              id: { not: id },
            },
          });
          if (concurrentCheck) {
            const roleLabel = targetRole === UserRole.COMMERCIAL_ADMIN ? 'E-Pass Admin' : 'Employee Admin';
            throw new ConflictException(`An active ${roleLabel} already exists. Only one active ${roleLabel} is permitted.`);
          }
        }

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
    } catch (err: any) {
      if (
        (err?.code === 'P2002' && (err?.meta?.target?.includes('role') || err?.message?.includes('unique_active_commercial_admin'))) ||
        err?.message?.includes('unique_active_commercial_admin')
      ) {
        throw new ConflictException('An active E-Pass Admin already exists. Only one active E-Pass Admin is permitted.');
      }
      if (
        (err?.code === 'P2002' && (err?.meta?.target?.includes('role') || err?.message?.includes('unique_active_employee_admin'))) ||
        err?.message?.includes('unique_active_employee_admin')
      ) {
        throw new ConflictException('An active Employee Admin already exists. Only one active Employee Admin is permitted.');
      }
      if (err?.code === 'P2002' && err?.meta?.target?.includes('email')) {
        throw new ConflictException('A staff account with this email address already exists.');
      }
      if (err?.code === 'P2002' && (err?.meta?.target?.includes('staff_id') || err?.meta?.target?.includes('staffId'))) {
        throw new ConflictException('This Staff ID is already assigned to another staff member.');
      }
      throw err;
    }
  }

  async toggleStatus(id: bigint) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    if (!user) {
      throw new NotFoundException(`Staff user with ID ${id} not found`);
    }

    // If activating an inactive domain admin, enforce maximum 1 active admin rule
    if (!user.isActive && (user.role === UserRole.COMMERCIAL_ADMIN || user.role === UserRole.EMPLOYEE_ADMIN)) {
      const existingActive = await this.prisma.user.findFirst({
        where: {
          role: user.role,
          isActive: true,
          id: { not: id },
        },
      });
      if (existingActive) {
        const roleLabel = user.role === UserRole.COMMERCIAL_ADMIN ? 'E-Pass Admin' : 'Employee Admin';
        throw new ConflictException(`An active ${roleLabel} already exists. Only one active ${roleLabel} is permitted.`);
      }
    }

    try {
      const updated = await this.prisma.user.update({
        where: { id },
        data: {
          isActive: !user.isActive,
        },
      });

      return this.findOne(updated.id);
    } catch (err: any) {
      if (
        (err?.code === 'P2002' && (err?.meta?.target?.includes('role') || err?.message?.includes('unique_active_commercial_admin'))) ||
        err?.message?.includes('unique_active_commercial_admin')
      ) {
        throw new ConflictException('An active E-Pass Admin already exists. Only one active E-Pass Admin is permitted.');
      }
      if (
        (err?.code === 'P2002' && (err?.meta?.target?.includes('role') || err?.message?.includes('unique_active_employee_admin'))) ||
        err?.message?.includes('unique_active_employee_admin')
      ) {
        throw new ConflictException('An active Employee Admin already exists. Only one active Employee Admin is permitted.');
      }
      throw err;
    }
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

  async deleteStaff(id: bigint, currentUser: { id: bigint | string; role: string }) {
    const currentUserId = typeof currentUser.id === 'string' ? BigInt(currentUser.id) : currentUser.id;
    if (currentUserId === id) {
      throw new BadRequestException('You cannot delete your own logged-in account.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        gateUsers: true,
        subAgents: { select: { id: true } },
        allocations: { select: { id: true } },
        givenAllocations: { select: { id: true } },
        agentOrders: { select: { id: true } },
        scannedCheckins: { select: { id: true } },
        scannedLogs: { select: { id: true } },
        reportedIncidents: { select: { id: true } },
        resolvedIncidents: { select: { id: true } },
      },
    });

    if (!user) {
      throw new NotFoundException(`Staff user with ID ${id} not found`);
    }

    // RBAC & Domain isolation
    const currentRole = currentUser.role;
    const targetRole = user.role as string;

    // Only SUPER_ADMIN can manage SUPER_ADMIN accounts
    if (targetRole === UserRole.SUPER_ADMIN) {
      if (currentRole !== UserRole.SUPER_ADMIN) {
        throw new ForbiddenException('Only a Super Admin can manage Super Admin accounts.');
      }
      const superAdminCount = await this.prisma.user.count({
        where: { role: UserRole.SUPER_ADMIN, isActive: true },
      });
      if (superAdminCount <= 1) {
        throw new BadRequestException('Cannot delete the last remaining active Super Admin account.');
      }
    }

    // Commercial Admin cannot delete Employee Admin, Super Admin, or Event Admin
    if (currentRole === UserRole.COMMERCIAL_ADMIN) {
      if (
        targetRole === UserRole.EMPLOYEE_ADMIN ||
        targetRole === UserRole.SUPER_ADMIN ||
        targetRole === UserRole.EVENT_ADMIN
      ) {
        throw new ForbiddenException('Commercial Admin cannot delete administrators outside their domain.');
      }
    }

    // Employee Admin cannot delete Commercial Admin, Agents, Super Admin, or Event Admin
    if (currentRole === UserRole.EMPLOYEE_ADMIN) {
      if (
        targetRole === UserRole.COMMERCIAL_ADMIN ||
        targetRole === UserRole.COMMERCIAL_AGENT ||
        targetRole === UserRole.COMMERCIAL_SUB_AGENT ||
        targetRole === UserRole.SUPER_ADMIN ||
        targetRole === UserRole.EVENT_ADMIN
      ) {
        throw new ForbiddenException('Employee Admin cannot delete administrators or agents outside their domain.');
      }
    }

    // Prevent non-admins from deleting admins
    if (
      currentRole !== UserRole.SUPER_ADMIN &&
      currentRole !== UserRole.EVENT_ADMIN &&
      (targetRole === UserRole.SUPER_ADMIN || targetRole === UserRole.EVENT_ADMIN)
    ) {
      throw new ForbiddenException('Insufficient permissions to delete administrator accounts.');
    }

    // Last required domain administrator protections
    if (targetRole === UserRole.COMMERCIAL_ADMIN) {
      const count = await this.prisma.user.count({
        where: { role: UserRole.COMMERCIAL_ADMIN, isActive: true },
      });
      if (count <= 1) {
        throw new BadRequestException('Cannot delete the last remaining active E-Pass Admin account.');
      }
    }
    if (targetRole === UserRole.EMPLOYEE_ADMIN) {
      const count = await this.prisma.user.count({
        where: { role: UserRole.EMPLOYEE_ADMIN, isActive: true },
      });
      if (count <= 1) {
        throw new BadRequestException('Cannot delete the last remaining active Employee Admin account.');
      }
    }

    // Check for linked operational records
    const hasOperationalRecords =
      user.scannedCheckins.length > 0 ||
      user.scannedLogs.length > 0 ||
      user.agentOrders.length > 0 ||
      user.allocations.length > 0 ||
      user.givenAllocations.length > 0 ||
      user.subAgents.length > 0 ||
      user.reportedIncidents.length > 0 ||
      user.resolvedIncidents.length > 0;

    if (hasOperationalRecords) {
      throw new BadRequestException(
        'This staff account has linked operational records and cannot be permanently deleted. Deactivate the account instead.'
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.gateUser.deleteMany({ where: { userId: id } });
      await tx.auditLog.deleteMany({ where: { userId: id } });
      await tx.user.delete({ where: { id } });
    });

    return { message: `Staff member '${user.name}' deleted successfully.` };
  }

  async resetPassword(id: bigint, currentUser: { id: bigint | string; role: string }, newPassword?: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`Staff user with ID ${id} not found`);
    }

    if (
      user.role === UserRole.SUPER_ADMIN &&
      currentUser.role !== UserRole.SUPER_ADMIN
    ) {
      throw new ForbiddenException('Only a Super Admin can reset a Super Admin password.');
    }

    const rawPassword = newPassword && newPassword.trim() ? newPassword.trim() : 'OngcPass@2026';
    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    await this.prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    });

    return { message: `Password for '${user.name}' has been reset successfully.` };
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

import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStaffDto, UpdateStaffDto } from './dto/create-staff.dto';
import { AssignGateDto } from './dto/assign-gate.dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(role?: string) {
    const users = await this.prisma.user.findMany({
      where: role ? { role: role as any } : undefined,
      orderBy: { name: 'asc' },
      include: {
        gateUsers: {
          include: {
            gate: {
              select: {
                id: true,
                name: true,
                gateNumber: true,
                isOpen: true,
              },
            },
          },
        },
      },
    });

    return users.map((u) => ({
      id: u.id.toString(),
      name: u.name,
      email: u.email,
      phone: u.phone,
      staffId: u.staffId,
      role: u.role,
      isActive: u.isActive,
      assignedGates: u.gateUsers.map((gu) => ({
        assignmentId: gu.id.toString(),
        gateId: gu.gate.id.toString(),
        name: gu.gate.name,
        gateNumber: gu.gate.gateNumber,
        isOpen: gu.gate.isOpen,
      })),
      createdAt: u.createdAt,
    }));
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

    return {
      id: user.id.toString(),
      name: user.name,
      email: user.email,
      phone: user.phone,
      staffId: user.staffId,
      role: user.role,
      isActive: user.isActive,
      assignedGates: user.gateUsers.map((gu) => ({
        assignmentId: gu.id.toString(),
        gateId: gu.gate.id.toString(),
        name: gu.gate.name,
        gateNumber: gu.gate.gateNumber,
        isOpen: gu.gate.isOpen,
      })),
      createdAt: user.createdAt,
    };
  }

  async create(dto: CreateStaffDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException(`User with email ${dto.email} already exists`);
    }

    const staffId = dto.staffId || `STF-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const rawPassword = dto.password || 'OngcPass@2026';
    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name: dto.name,
          email: dto.email.toLowerCase(),
          phone: dto.phone,
          staffId,
          role: dto.role as any,
          password: hashedPassword,
          isActive: true,
        },
      });

      if (dto.gateId) {
        await tx.gateUser.create({
          data: {
            userId: createdUser.id,
            gateId: BigInt(dto.gateId),
          },
        });
      }

      return createdUser;
    });

    return this.findOne(user.id);
  }

  async update(id: bigint, dto: UpdateStaffDto) {
    await this.findOne(id);

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.email !== undefined) data.email = dto.email.toLowerCase();
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.role !== undefined) data.role = dto.role as any;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.password) {
      data.password = await bcrypt.hash(dto.password, 10);
    }

    await this.prisma.user.update({
      where: { id },
      data,
    });

    return this.findOne(id);
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
}

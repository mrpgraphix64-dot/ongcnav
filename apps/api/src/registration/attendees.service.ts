import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AttendeeStatus } from '@ongc/shared-types';

@Injectable()
export class AttendeesService {
  constructor(private readonly prisma: PrismaService) {}

  async search(query: string, page = 1, limit = 20) {
    const q = query.trim();
    const skip = (page - 1) * limit;

    const where: any = {
      OR: [
        { ticketNumber: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
        { mobile: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        {
          employee: {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { cpf: { contains: q, mode: 'insensitive' } },
              { phone: { contains: q, mode: 'insensitive' } },
            ],
          },
        },
        {
          familyMember: {
            name: { contains: q, mode: 'insensitive' },
          },
        },
      ],
    };

    const [total, attendees] = await Promise.all([
      this.prisma.attendee.count({ where }),
      this.prisma.attendee.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          employee: true,
          familyMember: true,
          dailyCheckins: {
            where: { isLoadTest: false },
            orderBy: { checkinTime: 'desc' },
            take: 3,
            include: { gate: true },
          },
        },
      }),
    ]);

    return {
      total,
      page,
      limit,
      data: attendees.map((a) => ({
        id: a.id.toString(),
        ticketNumber: a.ticketNumber,
        qrCodeToken: a.qrCodeToken,
        status: a.status,
        isFamily: !!a.familyMemberId,
        attendeeName: a.familyMember ? a.familyMember.name : (a.employee?.name || a.name || 'Attendee'),
        mobile: a.mobile || a.employee?.phone || '',
        relation: a.familyMember ? a.familyMember.relation : (a.employee ? 'Primary Employee' : 'Standalone Attendee'),
        category: a.familyMember ? `Family (${a.familyMember.relation})` : (a.category || a.employee?.designation || 'General'),
        employee: a.employee
          ? {
              id: a.employee.id.toString(),
              cpf: a.employee.cpf,
              name: a.employee.name,
              phone: a.employee.phone,
              department: a.employee.department,
              designation: a.employee.designation,
              bookingDays: a.employee.bookingDays,
              hasPhoto: !!a.employee.photoPath,
            }
          : {
              id: '0',
              cpf: 'STANDALONE',
              name: a.name || 'Standalone Attendee',
              phone: a.mobile || '',
              department: 'General Attendee',
              designation: a.category || 'General',
              bookingDays: [],
              hasPhoto: false,
            },
        recentCheckins: a.dailyCheckins.map((c) => ({
          id: c.id.toString(),
          eventDate: c.eventDate,
          checkinTime: c.checkinTime,
          status: c.status,
          gateName: c.gate?.name,
        })),
      })),
    };
  }

  async findOne(id: bigint) {
    const attendee = await this.prisma.attendee.findUnique({
      where: { id },
      include: {
        employee: true,
        familyMember: true,
        dailyCheckins: {
          where: { isLoadTest: false },
          orderBy: { checkinTime: 'desc' },
          include: { gate: true },
        },
      },
    });

    if (!attendee) {
      throw new NotFoundException(`Attendee with ID ${id} not found`);
    }

    return {
      id: attendee.id.toString(),
      ticketNumber: attendee.ticketNumber,
      qrCodeToken: attendee.qrCodeToken,
      status: attendee.status,
      isFamily: !!attendee.familyMemberId,
      attendeeName: attendee.familyMember ? attendee.familyMember.name : (attendee.employee?.name || attendee.name || 'Attendee'),
      relation: attendee.familyMember ? attendee.familyMember.relation : (attendee.employee ? 'Primary Employee' : 'Standalone Attendee'),
      category: attendee.familyMember ? `Family (${attendee.familyMember.relation})` : (attendee.category || attendee.employee?.designation || 'General'),
      employee: attendee.employee
        ? {
            id: attendee.employee.id.toString(),
            cpf: attendee.employee.cpf,
            name: attendee.employee.name,
            phone: attendee.employee.phone,
            department: attendee.employee.department,
            designation: attendee.employee.designation,
            bookingDays: attendee.employee.bookingDays,
            hasPhoto: !!attendee.employee.photoPath,
            photoPath: attendee.employee.photoPath,
          }
        : {
            id: '0',
            cpf: 'STANDALONE',
            name: attendee.name || 'Standalone Attendee',
            phone: attendee.mobile || '',
            department: 'General Attendee',
            designation: attendee.category || 'General',
            bookingDays: [],
            hasPhoto: false,
            photoPath: null,
          },
      checkins: attendee.dailyCheckins.map((c) => ({
        id: c.id.toString(),
        eventDate: c.eventDate,
        checkinTime: c.checkinTime,
        status: c.status,
        gateName: c.gate?.name,
      })),
    };
  }

  async updateStatus(id: bigint, status: AttendeeStatus) {
    await this.findOne(id);
    const updated = await this.prisma.attendee.update({
      where: { id },
      data: { status: status as any },
    });
    return {
      id: updated.id.toString(),
      status: updated.status,
      message: `Status updated to ${status}`,
    };
  }

  async getPhotoPath(employeeId: bigint): Promise<string> {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { photoPath: true },
    });

    if (!employee || !employee.photoPath) {
      throw new NotFoundException('Photo not found');
    }

    return employee.photoPath;
  }

  async createQuickAttendee(data: {
    name: string;
    mobile: string;
    email?: string;
    category?: string;
  }) {
    const cleanName = data.name?.trim();
    if (!cleanName || cleanName.length === 0) {
      throw new BadRequestException('Full name is required.');
    }
    if (cleanName.length > 255) {
      throw new BadRequestException('Full name must not exceed 255 characters.');
    }

    const cleanPhone = (data.mobile || '').replace(/[^0-9]/g, '');
    const mobileRegex = /^[6-9]\d{9}$/;
    if (!mobileRegex.test(cleanPhone)) {
      throw new BadRequestException(
        'Please enter a valid 10-digit mobile number starting with 6, 7, 8, or 9.',
      );
    }

    const cleanEmail = data.email?.trim() || null;
    if (cleanEmail && cleanEmail.length > 255) {
      throw new BadRequestException('Email address must not exceed 255 characters.');
    }

    const cleanCategory = data.category?.trim() || 'General';
    const validCategories = ['General', 'VIP', 'VVIP'];
    if (!validCategories.includes(cleanCategory)) {
      throw new BadRequestException('Ticket category must be General, VIP, or VVIP.');
    }

    // Duplicate check: Mobile must be unique across attendees
    const existingAttendee = await this.prisma.attendee.findFirst({
      where: {
        OR: [
          { mobile: cleanPhone },
          { employee: { phone: cleanPhone } },
        ],
      },
    });

    if (existingAttendee) {
      throw new BadRequestException('An attendee with this mobile number already exists.');
    }

    // Generate unique sequential Ticket ID (e.g. NR2026-000001)
    const count = await this.prisma.attendee.count();
    let nextNum = count + 1;
    let ticketNumber = `NR2026-${String(nextNum).padStart(6, '0')}`;
    while (await this.prisma.attendee.findUnique({ where: { ticketNumber } })) {
      nextNum++;
      ticketNumber = `NR2026-${String(nextNum).padStart(6, '0')}`;
    }

    // Generate cryptographically secure 32-byte hex QR code token (matches Laravel)
    const qrCodeToken = crypto.randomBytes(32).toString('hex');

    // Create standalone attendee with NO fake employee!
    const attendee = await this.prisma.attendee.create({
      data: {
        name: cleanName,
        mobile: cleanPhone,
        email: cleanEmail,
        category: cleanCategory,
        ticketNumber,
        qrCodeToken,
        status: AttendeeStatus.ACTIVE,
      },
    });

    return {
      success: true,
      message: `Attendee ${attendee.name} created successfully with Ticket ID ${ticketNumber}!`,
      attendee: {
        id: attendee.id.toString(),
        ticketNumber: attendee.ticketNumber,
        qrCodeToken: attendee.qrCodeToken,
        name: attendee.name,
        phone: attendee.mobile,
        category: attendee.category,
        employeeId: attendee.employeeId,
      },
    };
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
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
        attendeeName: a.familyMember ? a.familyMember.name : a.employee.name,
        relation: a.familyMember ? a.familyMember.relation : 'Primary Employee',
        employee: {
          id: a.employee.id.toString(),
          cpf: a.employee.cpf,
          name: a.employee.name,
          phone: a.employee.phone,
          department: a.employee.department,
          designation: a.employee.designation,
          bookingDays: a.employee.bookingDays,
          hasPhoto: !!a.employee.photoPath,
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
      attendeeName: attendee.familyMember ? attendee.familyMember.name : attendee.employee.name,
      relation: attendee.familyMember ? attendee.familyMember.relation : 'Primary Employee',
      employee: {
        id: attendee.employee.id.toString(),
        cpf: attendee.employee.cpf,
        name: attendee.employee.name,
        phone: attendee.employee.phone,
        department: attendee.employee.department,
        designation: attendee.employee.designation,
        bookingDays: attendee.employee.bookingDays,
        hasPhoto: !!attendee.employee.photoPath,
        photoPath: attendee.employee.photoPath,
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
}

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ManualCheckinDto, VoidCheckinDto } from './dto/helpdesk.dto';
import { CheckinStatus, CheckinResult, AttendeeStatus } from '@ongc/shared-types';

@Injectable()
export class HelpDeskService {
  constructor(private readonly prisma: PrismaService) {}

  private getTodayIst(): string {
    return new Date().toLocaleDateString('en-CA', {
      timeZone: 'Asia/Kolkata',
    });
  }

  async search(query: string) {
    const q = query.trim();
    if (!q) {
      return [];
    }

    const attendees = await this.prisma.attendee.findMany({
      where: {
        OR: [
          { ticketNumber: { contains: q, mode: 'insensitive' } },
          { employee: { cpf: { contains: q, mode: 'insensitive' } } },
          { employee: { name: { contains: q, mode: 'insensitive' } } },
          { employee: { phone: { contains: q, mode: 'insensitive' } } },
          { familyMember: { name: { contains: q, mode: 'insensitive' } } },
        ],
      },
      take: 20,
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

    const activeDateSetting = await this.prisma.setting.findUnique({
      where: { key: 'active_event_date' },
    });
    const activeDate = activeDateSetting?.value || this.getTodayIst();

    return attendees.map((a) => {
      const isFamily = !!a.familyMemberId;
      const todayCheckin = a.dailyCheckins.find(
        (c) => c.eventDate === activeDate && (c.status as any) === CheckinStatus.SUCCESS,
      );

      const days = a.employee && Array.isArray(a.employee.bookingDays) ? (a.employee.bookingDays as string[]) : [];

      return {
        id: a.id.toString(),
        ticketNumber: a.ticketNumber,
        status: a.status,
        isFamily,
        attendeeName: isFamily ? a.familyMember?.name : (a.employee?.name || a.name || 'Attendee'),
        relation: isFamily ? a.familyMember?.relation : (a.employee ? 'Primary Employee' : 'Standalone Attendee'),
        employee: a.employee
          ? {
              id: a.employee.id.toString(),
              cpf: a.employee.cpf,
              name: a.employee.name,
              designation: a.employee.designation,
              department: a.employee.department,
              phone: a.employee.phone,
              bookingDays: a.employee.bookingDays,
            }
          : null,
        isBookedToday: a.employee ? days.includes(activeDate) : true,
        isCheckedInToday: !!todayCheckin,
        todayCheckin: todayCheckin
          ? {
              id: todayCheckin.id.toString(),
              gateName: todayCheckin.gate?.name,
              checkinTime: todayCheckin.checkinTime,
            }
          : null,
      };
    });
  }

  async manualCheckin(dto: ManualCheckinDto, userId: bigint) {
    const attendeeId = BigInt(dto.attendeeId);
    const gateId = BigInt(dto.gateId);

    const attendee = await this.prisma.attendee.findUnique({
      where: { id: attendeeId },
      include: { employee: true, familyMember: true },
    });

    if (!attendee) {
      throw new NotFoundException('Attendee not found');
    }

    if (String(attendee.status).toUpperCase() !== 'ACTIVE') {
      throw new BadRequestException(`Cannot check in. Attendee status is ${attendee.status}`);
    }

    const activeDateSetting = await this.prisma.setting.findUnique({
      where: { key: 'active_event_date' },
    });
    const activeDate = activeDateSetting?.value || this.getTodayIst();

    if (attendee.employee) {
      const empDays = Array.isArray(attendee.employee.bookingDays)
        ? (attendee.employee.bookingDays as string[])
        : [];
      if (!empDays.includes(activeDate)) {
        throw new BadRequestException(`Attendee is not registered for active date ${activeDate}`);
      }
    }

    // Check if already checked in
    const existing = await this.prisma.dailyCheckin.findFirst({
      where: {
        attendeeId,
        eventDate: activeDate,
        status: CheckinStatus.SUCCESS as any,
      },
    });

    if (existing) {
      throw new ConflictException('Attendee is already checked in for today');
    }

    // Execute check-in and audit log inside transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const checkin = await tx.dailyCheckin.create({
        data: {
          attendeeId,
          gateId,
          scannedById: userId,
          eventDate: activeDate,
          checkinTime: new Date(),
          status: CheckinStatus.SUCCESS as any,
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'MANUAL_CHECKIN_OVERRIDE',
          details: {
            attendeeId: attendeeId.toString(),
            ticketNumber: attendee.ticketNumber,
            reason: dto.reason,
            gateId: dto.gateId,
            eventDate: activeDate,
          },
        },
      });

      await tx.scanLog.create({
        data: {
          attendeeId,
          gateId,
          scannedById: userId,
          result: CheckinResult.SUCCESS,
          responseTimeMs: 0,
        },
      });

      return checkin;
    });

    return {
      success: true,
      message: 'Manual check-in completed successfully',
      checkinId: result.id.toString(),
      ticketNumber: attendee.ticketNumber,
      attendeeName: attendee.familyMember
        ? attendee.familyMember.name
        : (attendee.employee?.name || attendee.name || 'Attendee'),
    };
  }

  async voidCheckin(dto: VoidCheckinDto, userId: bigint) {
    const checkinId = BigInt(dto.checkinId);

    const checkin = await this.prisma.dailyCheckin.findUnique({
      where: { id: checkinId },
      include: {
        attendee: {
          include: { employee: true, familyMember: true },
        },
      },
    });

    if (!checkin) {
      throw new NotFoundException('Check-in record not found');
    }

    if ((checkin.status as any) === CheckinStatus.VOIDED) {
      throw new BadRequestException('Check-in record is already voided');
    }

    // Update status to VOIDED and create audit log
    await this.prisma.$transaction(async (tx) => {
      await tx.dailyCheckin.update({
        where: { id: checkinId },
        data: { status: CheckinStatus.VOIDED as any },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'VOID_CHECKIN',
          details: {
            checkinId: checkinId.toString(),
            attendeeId: checkin.attendeeId.toString(),
            eventDate: checkin.eventDate,
            reason: dto.reason,
          },
        },
      });
    });

    return {
      success: true,
      message: 'Check-in record has been voided successfully. Attendee may now be re-scanned.',
    };
  }
}

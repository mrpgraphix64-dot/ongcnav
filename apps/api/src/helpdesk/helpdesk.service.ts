import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ManualCheckinDto, VoidCheckinDto } from './dto/helpdesk.dto';
import { CheckinStatus, CheckinResult, AttendeeStatus } from '@ongc/shared-types';
import { resolveBookingDays } from '../common/utils/attendee-booking.util';

@Injectable()
export class HelpDeskService {
  constructor(private readonly prisma: PrismaService) {}

  private getTodayIst(): string {
    return new Date().toLocaleDateString('en-CA', {
      timeZone: 'Asia/Kolkata',
    });
  }

  private async getSetting(key: string, legacyKey?: string): Promise<string | null> {
    const setting = await this.prisma.setting.findFirst({
      where: {
        OR: [{ key }, ...(legacyKey ? [{ key: legacyKey }] : [])],
      },
    });
    return setting ? setting.value : null;
  }

  /**
   * Search attendees and check-in status
   * Enforces CPF visibility rules matching Laravel's HelpDeskController:
   * Only SUPER_ADMIN, EVENT_ADMIN, REGISTRATION_STAFF can search and view CPF.
   */
  async search(query: string, userRole?: string) {
    const q = query.trim();
    if (!q) {
      return { attendees: [], gates: [] };
    }

    const roleUpper = (userRole || '').toUpperCase();
    const canViewCpf = ['SUPER_ADMIN', 'EVENT_ADMIN', 'ADMIN', 'REGISTRATION_STAFF', 'HELP_DESK'].includes(roleUpper);

    const orConditions: any[] = [
      { ticketNumber: { contains: q, mode: 'insensitive' } },
      { name: { contains: q, mode: 'insensitive' } },
      { mobile: { contains: q, mode: 'insensitive' } },
      { employee: { name: { contains: q, mode: 'insensitive' } } },
      { employee: { phone: { contains: q, mode: 'insensitive' } } },
      { familyMember: { name: { contains: q, mode: 'insensitive' } } },
    ];

    if (canViewCpf) {
      orConditions.push({ employee: { cpf: { contains: q, mode: 'insensitive' } } });
    }

    const activeDateSetting = await this.getSetting('active_event_date', 'event_control.active_event_date');
    const activeDate = activeDateSetting || this.getTodayIst();

    const [attendees, gates] = await Promise.all([
      this.prisma.attendee.findMany({
        where: { OR: orConditions },
        take: 25,
        orderBy: { id: 'desc' },
        include: {
          employee: true,
          familyMember: true,
          dailyCheckins: {
            where: { isLoadTest: false, eventDate: activeDate },
            orderBy: { checkinTime: 'desc' },
            include: {
              gate: true,
              scannedBy: { select: { id: true, name: true, staffId: true } },
              voidedBy: { select: { id: true, name: true, staffId: true } },
            },
          },
        },
      }),
      this.prisma.gate.findMany({
        where: { status: 'ACTIVE', isOpen: true },
        orderBy: { gateNumber: 'asc' },
        select: { id: true, name: true, gateNumber: true },
      }),
    ]);

    const mappedAttendees = attendees.map((a) => {
      const isFamily = !!a.familyMemberId;
      const todayActiveCheckin = a.dailyCheckins.find(
        (c) => (c.status as any) === CheckinStatus.SUCCESS || (c.status as any) === 'SUCCESS',
      );
      const todayVoidedCheckin = a.dailyCheckins.find(
        (c) => (c.status as any) === CheckinStatus.VOIDED || (c.status as any) === 'VOIDED',
      );

      const days = resolveBookingDays(a);

      return {
        id: a.id.toString(),
        ticketNumber: a.ticketNumber,
        ticket_id: a.ticketNumber,
        status: a.status,
        isFamily,
        attendeeName: isFamily ? a.familyMember?.name : (a.employee?.name || a.name || 'Attendee'),
        name: isFamily ? a.familyMember?.name : (a.employee?.name || a.name || 'Attendee'),
        category: a.category || (isFamily ? 'FAMILY' : a.employee ? 'ONGC STAFF' : 'General'),
        mobile: a.mobile || a.employee?.phone || 'N/A',
        relation: isFamily ? a.familyMember?.relation : (a.employee ? 'Primary Employee' : 'Standalone Attendee'),
        cpf: canViewCpf ? (a.employee?.cpf || null) : null,
        canViewCpf,
        isBookedToday: a.employee ? (days.length === 0 || days.includes(activeDate)) : true,
        isCheckedInToday: !!todayActiveCheckin,
        activeCheckin: todayActiveCheckin
          ? {
              id: todayActiveCheckin.id.toString(),
              gateId: todayActiveCheckin.gateId.toString(),
              gateName: todayActiveCheckin.gate?.name || `Gate ${todayActiveCheckin.gateId}`,
              gateCode: todayActiveCheckin.gate?.gateNumber,
              checkinTime: todayActiveCheckin.checkinTime.toISOString(),
              isManual: todayActiveCheckin.isManual,
              manualReason: todayActiveCheckin.manualReason,
              scannedBy: todayActiveCheckin.scannedBy?.name,
            }
          : null,
        voidedCheckin: todayVoidedCheckin
          ? {
              id: todayVoidedCheckin.id.toString(),
              gateName: todayVoidedCheckin.gate?.name,
              voidReason: todayVoidedCheckin.voidReason,
              voidedAt: todayVoidedCheckin.voidedAt?.toISOString(),
              voidedBy: todayVoidedCheckin.voidedBy?.name,
            }
          : null,
      };
    });

    return {
      attendees: mappedAttendees,
      gates: gates.map((g) => ({
        id: g.id.toString(),
        name: g.name,
        code: g.gateNumber,
      })),
      activeDate,
      canViewCpf,
    };
  }

  /**
   * Manual Check-in Override
   * Enforces event control, gate capacity, single check-in per day, and full audit logging.
   */
  async manualCheckin(dto: ManualCheckinDto, userId: bigint) {
    const reason = (dto.manual_reason || dto.reason || '').trim();
    if (!reason || reason.length < 3) {
      throw new BadRequestException('Reason for manual check-in is required (minimum 3 characters).');
    }
    if (reason.length > 255) {
      throw new BadRequestException('Manual check-in reason must not exceed 255 characters.');
    }

    // 1. Resolve Attendee
    let attendee: any = null;
    if (dto.attendeeId) {
      attendee = await this.prisma.attendee.findUnique({
        where: { id: BigInt(dto.attendeeId) },
        include: { employee: true, familyMember: true },
      });
    } else if (dto.ticket_id || dto.ticketId) {
      const ticket = (dto.ticket_id || dto.ticketId)!.trim();
      attendee = await this.prisma.attendee.findFirst({
        where: {
          OR: [{ ticketNumber: ticket }, { ticketNumber: { equals: ticket, mode: 'insensitive' } }],
        },
        include: { employee: true, familyMember: true },
      });
    }

    if (!attendee) {
      throw new NotFoundException('Attendee not found for manual check-in.');
    }

    if (String(attendee.status).toUpperCase() !== 'ACTIVE') {
      throw new BadRequestException(`Cannot check in. Attendee status is ${attendee.status}`);
    }

    // 2. Event Control Guard
    const eventStatus = await this.getSetting('event_control.event_status', 'event_status');
    if (eventStatus === 'closed') {
      throw new ForbiddenException('EVENT CLOSED: Entry scanning is not open at this time.');
    }

    const emergencyVal = await this.getSetting('event_control.emergency_stopped', 'emergency_stop');
    const isEmergency = emergencyVal === '1' || emergencyVal === 'true';
    if (isEmergency) {
      const stopReason = await this.getSetting('emergency_stop_reason', 'event_control.emergency_stop_reason');
      throw new ForbiddenException(stopReason || 'EMERGENCY STOP ACTIVATED: All entry scanning is halted.');
    }

    const scanningVal = await this.getSetting('event_control.scanning_enabled', 'scanning_enabled');
    const isScanningDisabled = scanningVal === '0' || scanningVal === 'false';
    if (isScanningDisabled) {
      throw new ForbiddenException('SCANNING SUSPENDED: Entry scanning is temporarily stopped.');
    }

    // 3. Resolve Gate
    let targetGateId: bigint;
    const rawGateId = dto.gateId || dto.gate_id;
    if (rawGateId) {
      targetGateId = BigInt(rawGateId);
    } else {
      const defaultGate = await this.prisma.gate.findFirst({
        where: { status: 'ACTIVE', isOpen: true },
        orderBy: { id: 'asc' },
      });
      if (!defaultGate) {
        throw new BadRequestException('No active open gate found for check-in.');
      }
      targetGateId = defaultGate.id;
    }

    const gate = await this.prisma.gate.findUnique({ where: { id: targetGateId } });
    if (!gate) {
      throw new NotFoundException(`Gate with ID ${targetGateId} not found.`);
    }
    if (!gate.isOpen || gate.isScanningPaused || gate.status !== 'ACTIVE') {
      throw new BadRequestException(`Gate ${gate.name} is currently closed or scanning is paused.`);
    }

    // 4. Resolve Active Date & Date Booking
    const activeDateSetting = await this.getSetting('active_event_date', 'event_control.active_event_date');
    const activeDate = activeDateSetting || this.getTodayIst();

    if (attendee.employee) {
      const empDays = resolveBookingDays(attendee);
      if (empDays.length > 0 && !empDays.includes(activeDate)) {
        throw new BadRequestException(`Attendee is not registered for active event date ${activeDate}`);
      }
    }

    // 5. Gate Capacity Guard
    if (gate.capacityEnabled && gate.totalCapacity && gate.blockWhenFull) {
      const currentGateCount = await this.prisma.dailyCheckin.count({
        where: {
          gateId: gate.id,
          eventDate: activeDate,
          status: CheckinStatus.SUCCESS as any,
          isLoadTest: false,
        },
      });
      if (currentGateCount >= gate.totalCapacity) {
        throw new BadRequestException(`GATE FULL: ${gate.name} has reached maximum capacity (${currentGateCount}/${gate.totalCapacity}).`);
      }
    }

    // 6. Duplicate Check-in Guard
    const existingCheckin = await this.prisma.dailyCheckin.findFirst({
      where: {
        attendeeId: attendee.id,
        eventDate: activeDate,
        status: CheckinStatus.SUCCESS as any,
      },
      include: { gate: true },
    });

    if (existingCheckin) {
      const timeStr = new Date(existingCheckin.checkinTime).toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      throw new ConflictException(`Attendee is already checked in today at ${timeStr} (Gate: ${existingCheckin.gate?.name || existingCheckin.gateId})`);
    }

    // 7. Atomic Execution with Audit Trail
    const checkin = await this.prisma.$transaction(async (tx) => {
      const record = await tx.dailyCheckin.create({
        data: {
          attendeeId: attendee.id,
          gateId: gate.id,
          scannedById: userId,
          eventDate: activeDate,
          checkinTime: new Date(),
          status: CheckinStatus.SUCCESS as any,
          isManual: true,
          manualReason: reason,
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'MANUAL_CHECKIN_OVERRIDE',
          details: {
            checkinId: record.id.toString(),
            attendeeId: attendee.id.toString(),
            ticketNumber: attendee.ticketNumber,
            gateId: gate.id.toString(),
            gateName: gate.name,
            reason,
            eventDate: activeDate,
          },
        },
      });

      await tx.scanLog.create({
        data: {
          attendeeId: attendee.id,
          gateId: gate.id,
          scannedById: userId,
          result: CheckinResult.SUCCESS,
          responseTimeMs: 0,
          ipAddress: '127.0.0.1',
          userAgent: 'HelpDesk Manual Check-in Override',
        },
      });

      return record;
    });

    const attendeeName = attendee.familyMember
      ? attendee.familyMember.name
      : (attendee.employee?.name || attendee.name || 'Attendee');

    return {
      success: true,
      message: `Manual Check-in Approved for ${attendee.ticketNumber} (${attendeeName}) at ${gate.name}.`,
      checkinId: checkin.id.toString(),
      ticketNumber: attendee.ticketNumber,
      ticket_id: attendee.ticketNumber,
      attendeeName,
      gateName: gate.name,
      checkedInAt: checkin.checkinTime.toISOString(),
      isManual: true,
      manualReason: reason,
    };
  }

  /**
   * Void Check-in Reversal
   * Restricted strictly to SUPER_ADMIN and EVENT_ADMIN.
   * Restores attendee check-in eligibility and records immutable audit log.
   */
  async voidCheckin(checkinId: bigint, reasonRaw: string, userId: bigint) {
    const reason = (reasonRaw || '').trim();
    if (!reason || reason.length < 5) {
      throw new BadRequestException('Reason for reversal/void is mandatory (minimum 5 characters).');
    }
    if (reason.length > 500) {
      throw new BadRequestException('Void reason must not exceed 500 characters.');
    }

    const checkin = await this.prisma.dailyCheckin.findUnique({
      where: { id: checkinId },
      include: {
        attendee: { include: { employee: true, familyMember: true } },
        gate: true,
      },
    });

    if (!checkin) {
      throw new NotFoundException(`Check-in record #${checkinId} not found.`);
    }

    if ((checkin.status as any) === CheckinStatus.VOIDED || (checkin.status as any) === 'VOIDED') {
      throw new BadRequestException('This check-in record has already been voided.');
    }

    const attendee = checkin.attendee;

    await this.prisma.$transaction(async (tx) => {
      // 1. Update checkin status to VOIDED with metadata
      await tx.dailyCheckin.update({
        where: { id: checkinId },
        data: {
          status: CheckinStatus.VOIDED as any,
          voidedAt: new Date(),
          voidedById: userId,
          voidReason: reason,
        },
      });

      // 2. Check if attendee has any remaining active check-ins today
      const remainingToday = await tx.dailyCheckin.findFirst({
        where: {
          attendeeId: attendee.id,
          eventDate: checkin.eventDate,
          status: CheckinStatus.SUCCESS as any,
          NOT: { id: checkinId },
        },
      });

      if (!remainingToday) {
        await tx.attendee.update({
          where: { id: attendee.id },
          data: { status: AttendeeStatus.ACTIVE as any },
        });
      }

      // 3. Record immutable AuditLog
      await tx.auditLog.create({
        data: {
          userId,
          action: 'checkin_reversed',
          details: {
            checkinId: checkinId.toString(),
            attendeeId: attendee.id.toString(),
            ticketNumber: attendee.ticketNumber,
            eventDate: checkin.eventDate,
            gateName: checkin.gate?.name,
            voidReason: reason,
          },
        },
      });

      // 4. Record ScanLog
      await tx.scanLog.create({
        data: {
          attendeeId: attendee.id,
          gateId: checkin.gateId,
          scannedById: userId,
          result: 'checkin_voided',
          responseTimeMs: 0,
          ipAddress: '127.0.0.1',
          userAgent: 'HelpDesk Check-in Void Reversal',
        },
      });
    });

    const attendeeName = attendee.familyMember
      ? attendee.familyMember.name
      : (attendee.employee?.name || attendee.name || 'Attendee');

    return {
      success: true,
      message: `Check-in for ticket ${attendee.ticketNumber} (${attendeeName}) has been reversed (voided). The attendee may now be re-checked in if necessary.`,
      checkinId: checkinId.toString(),
      ticketNumber: attendee.ticketNumber,
      attendeeName,
    };
  }
}

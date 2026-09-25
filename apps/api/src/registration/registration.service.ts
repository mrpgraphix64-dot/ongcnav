import {
  Injectable,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterEmployeeDto } from './dto/register-employee.dto';
import { AttendeeStatus, RegistrationType } from '@ongc/shared-types';
import { resolveBookingDays } from '../common/utils/attendee-booking.util';
import * as crypto from 'crypto';
import * as QRCode from 'qrcode';

@Injectable()
export class RegistrationService {
  constructor(private readonly prisma: PrismaService) {}

  private generateSecureQrToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private generateTicketNumber(prefix: string, index?: number): string {
    const randomSuffix = crypto.randomBytes(2).toString('hex').toUpperCase();
    const timeSuffix = Date.now().toString().slice(-4);
    if (index !== undefined) {
      return `TK-${prefix}-F${index + 1}-${timeSuffix}${randomSuffix}`;
    }
    return `TK-${prefix}-${timeSuffix}${randomSuffix}`;
  }

  async register(
    dto: RegisterEmployeeDto,
    photoPath?: string,
    familyPhotoPaths?: (string | undefined)[],
  ) {
    if (dto.registrationType && dto.registrationType !== RegistrationType.EMPLOYEE) {
      throw new BadRequestException('Cannot register as non-employee via employee registration.');
    }

    const cleanCpf = dto.cpf.trim().toUpperCase();

    // Check if employee already registered
    const existing = await this.prisma.employee.findUnique({
      where: { cpf: cleanCpf },
    });

    if (existing) {
      throw new ConflictException(
        `Employee with CPF ${cleanCpf} is already registered. Please use Ticket Lookup.`,
      );
    }

    // Check if registration is open in settings
    const regSetting = await this.prisma.setting.findUnique({
      where: { key: 'registration_open' },
    });
    if (regSetting && regSetting.value === 'false') {
      throw new BadRequestException('Public registration is currently closed.');
    }

    const employeeQrToken = this.generateSecureQrToken();
    const employeeTicketNumber = this.generateTicketNumber(cleanCpf);

    // Atomically create employee, family members, and attendees
    const result = await this.prisma.$transaction(async (tx) => {
      const employee = await tx.employee.create({
        data: {
          cpf: cleanCpf,
          name: dto.name.trim(),
          designation: dto.designation.trim(),
          department: dto.department.trim(),
          phone: dto.phone.trim(),
          email: dto.email.trim().toLowerCase(),
          photoPath: photoPath || null,
          employeeCategory: dto.employeeCategory as any,
          // Legacy/summary value — the employee's OWN dates only, kept for
          // backward-compatible reads that haven't moved to
          // resolveBookingDays() yet. Not used for check-in gating anymore.
          bookingDays: dto.bookingDays,
        },
      });

      // Create attendee for employee, with their own bookingDays — this is
      // the real, authoritative source check-in reads from.
      const employeeAttendee = await tx.attendee.create({
        data: {
          registrationType: RegistrationType.EMPLOYEE as any,
          employeeId: employee.id,
          ticketNumber: employeeTicketNumber,
          qrCodeToken: employeeQrToken,
          status: AttendeeStatus.ACTIVE as any,
          bookingDays: dto.bookingDays,
        },
      });

      const familyAttendees: any[] = [];

      if (dto.familyMembers && dto.familyMembers.length > 0) {
        for (let i = 0; i < dto.familyMembers.length; i++) {
          const famDto = dto.familyMembers[i];
          const famToken = this.generateSecureQrToken();
          const famTicketNumber = this.generateTicketNumber(cleanCpf, i);
          const famPhotoPath = familyPhotoPaths?.[i];

          const familyMember = await tx.familyMember.create({
            data: {
              employeeId: employee.id,
              name: famDto.name.trim(),
              relation: famDto.relation.trim(),
              age: famDto.age || null,
              gender: famDto.gender || null,
              phone: famDto.phone.trim(),
              photoPath: famPhotoPath || null,
            },
          });

          const famAttendee = await tx.attendee.create({
            data: {
              registrationType: RegistrationType.EMPLOYEE as any,
              employeeId: employee.id,
              familyMemberId: familyMember.id,
              ticketNumber: famTicketNumber,
              qrCodeToken: famToken,
              status: AttendeeStatus.ACTIVE as any,
              // This family member's OWN dates — independent of the
              // employee and every other family member.
              bookingDays: Array.isArray(famDto.bookingDays) ? famDto.bookingDays : [],
            },
          });

          familyAttendees.push({
            ...familyMember,
            id: familyMember.id.toString(),
            employeeId: familyMember.employeeId.toString(),
            attendee: {
              ...famAttendee,
              id: famAttendee.id.toString(),
              employeeId: famAttendee.employeeId?.toString(),
              familyMemberId: famAttendee.familyMemberId?.toString(),
            },
          });
        }
      }

      return {
        employee: {
          ...employee,
          id: employee.id.toString(),
        },
        attendee: {
          ...employeeAttendee,
          id: employeeAttendee.id.toString(),
          employeeId: employeeAttendee.employeeId?.toString(),
        },
        familyMembers: familyAttendees,
      };
    });

    return {
      success: true,
      message: 'Registration successful',
      data: result,
    };
  }

  async findTicketByToken(token: string) {
    const attendee = await this.prisma.attendee.findFirst({
      where: {
        OR: [{ qrCodeToken: token }, { ticketNumber: token }],
      },
      include: {
        employee: true,
        familyMember: true,
        dailyCheckins: {
          where: { isLoadTest: false },
          orderBy: { checkinTime: 'desc' },
          include: {
            gate: {
              select: {
                id: true,
                name: true,
                gateNumber: true,
              },
            },
          },
        },
      },
    });

    if (!attendee) {
      throw new NotFoundException('Ticket not found');
    }

    // Generate QR SVG data URI
    let qrSvg: string | null = null;
    try {
      qrSvg = await QRCode.toString(attendee.qrCodeToken, {
        type: 'svg',
        errorCorrectionLevel: 'M',
        margin: 1,
      });
    } catch {
      qrSvg = null;
    }

    const isFamily = !!attendee.familyMemberId;
    const attendeeName = isFamily
      ? attendee.familyMember?.name
      : (attendee.employee?.name || attendee.name || 'Attendee');
    const hasPhoto = isFamily ? !!attendee.familyMember?.photoPath : !!attendee.employee?.photoPath;

    return {
      ticketNumber: attendee.ticketNumber,
      qrCodeToken: attendee.qrCodeToken,
      qrSvg,
      status: attendee.status,
      registrationType: attendee.registrationType,
      isFamily,
      relation: attendee.familyMember?.relation || (attendee.employee ? 'Primary Employee' : 'Commercial Pass'),
      attendeeName,
      hasPhoto,
      // This person's own dates, not the employee's — falls back to the
      // employee's legacy value for attendees created before this change.
      bookingDays: resolveBookingDays(attendee),
      employee: attendee.employee
        ? {
            id: attendee.employee.id.toString(),
            cpf: attendee.employee.cpf,
            name: attendee.employee.name,
            designation: attendee.employee.designation,
            department: attendee.employee.department,
            employeeCategory: attendee.employee.employeeCategory,
            hasPhoto: !!attendee.employee.photoPath,
          }
        : null,
      checkins: attendee.dailyCheckins.map((c) => ({
        id: c.id.toString(),
        eventDate: c.eventDate,
        checkinTime: c.checkinTime,
        status: c.status,
        gateName: c.gate?.name || 'Main Gate',
      })),
    };
  }

  async findByCpf(cpf: string, phoneLast4: string) {
    const cleanCpf = (cpf || '').trim().toUpperCase();
    if (!cleanCpf) {
      throw new BadRequestException('CPF number is required');
    }

    const cleanPhone4 = (phoneLast4 || '').trim();
    if (!cleanPhone4) {
      throw new BadRequestException(
        'Security verification required: registered phone last 4 digits must be provided.',
      );
    }
    if (!/^\d{4}$/.test(cleanPhone4)) {
      throw new BadRequestException(
        'Security verification failed: phone verification requires exactly 4 digits.',
      );
    }

    const employee = await this.prisma.employee.findUnique({
      where: { cpf: cleanCpf },
      include: {
        familyMembers: true,
        attendees: {
          where: { registrationType: RegistrationType.EMPLOYEE },
          include: {
            familyMember: true,
          },
        },
      },
    });

    if (!employee) {
      throw new NotFoundException(`No registration found for CPF: ${cleanCpf}`);
    }

    if (!employee.phone.endsWith(cleanPhone4)) {
      throw new BadRequestException('Security verification failed. Phone number does not match.');
    }

    return {
      employee: {
        id: employee.id.toString(),
        cpf: employee.cpf,
        name: employee.name,
        designation: employee.designation,
        department: employee.department,
        employeeCategory: employee.employeeCategory,
        phone: employee.phone.replace(/.(?=.{4})/g, '*'), // Mask phone for security
        hasPhoto: !!employee.photoPath,
      },
      passes: employee.attendees.map((att) => ({
        attendeeId: att.id.toString(),
        ticketNumber: att.ticketNumber,
        qrCodeToken: att.qrCodeToken,
        status: att.status,
        isFamily: !!att.familyMemberId,
        attendeeName: att.familyMember ? att.familyMember.name : employee.name,
        relation: att.familyMember ? att.familyMember.relation : 'Primary Employee',
        // Each pass's own dates — independent per person.
        bookingDays: resolveBookingDays({ bookingDays: att.bookingDays, employee }),
        hasPhoto: att.familyMember ? !!att.familyMember.photoPath : !!employee.photoPath,
      })),
    };
  }
}

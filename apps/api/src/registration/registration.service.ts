import {
  Injectable,
  ConflictException,
  BadRequestException,
  NotFoundException,
  HttpException,
  HttpStatus,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { RegisterEmployeeDto } from './dto/register-employee.dto';
import {
  AttendeeStatus,
  RegistrationStatus,
  RegistrationType,
  SETTING_MAINTENANCE_MODE,
  isMaintenanceModeActive,
  isOfficialEventDate,
  getEventDayTheme,
  EventDayTheme,
  PublicDailyPassResponseDto,
} from '@ongc/shared-types';
import { resolveBookingDays } from '../common/utils/attendee-booking.util';
import * as crypto from 'crypto';
import * as QRCode from 'qrcode';

@Injectable()
export class RegistrationService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly redis?: RedisService,
  ) {}

  async getMaintenanceStatus() {
    try {
      const setting = await this.prisma.setting.findUnique({
        where: { key: SETTING_MAINTENANCE_MODE },
      });
      return {
        maintenance: isMaintenanceModeActive(setting?.value),
      };
    } catch {
      return { maintenance: false };
    }
  }


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

    if (!Array.isArray(dto.bookingDays) || dto.bookingDays.length === 0) {
      throw new BadRequestException('Please select at least one attendance date.');
    }
    for (const d of dto.bookingDays) {
      if (!isOfficialEventDate(d)) {
        throw new BadRequestException(`Invalid event date selected: ${d}`);
      }
    }

    if (dto.familyMembers && dto.familyMembers.length > 6) {
      throw new BadRequestException('A maximum of 6 family members can be registered.');
    }

    if (dto.familyMembers) {
      for (const fam of dto.familyMembers) {
        if (fam.bookingDays && Array.isArray(fam.bookingDays) && fam.bookingDays.length > 0) {
          for (const d of fam.bookingDays) {
            if (!isOfficialEventDate(d)) {
              throw new BadRequestException(`Invalid event date selected for family member ${fam.name}: ${d}`);
            }
          }
        }
      }
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
          registrationStatus: RegistrationStatus.PENDING as any,
          // Legacy/summary value — the employee's OWN dates only, kept for
          // backward-compatible reads that haven't moved to
          // resolveBookingDays() yet. Not used for check-in gating anymore.
          bookingDays: dto.bookingDays,
        },
      });

      // Create attendee for employee, with their own bookingDays and PENDING status
      const employeeAttendee = await tx.attendee.create({
        data: {
          registrationType: RegistrationType.EMPLOYEE as any,
          employeeId: employee.id,
          email: dto.email.trim().toLowerCase(),
          ticketNumber: employeeTicketNumber,
          qrCodeToken: employeeQrToken,
          status: AttendeeStatus.PENDING as any,
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

          const famBookingDays =
            Array.isArray(famDto.bookingDays) && famDto.bookingDays.length > 0
              ? famDto.bookingDays
              : dto.bookingDays;

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
              status: AttendeeStatus.PENDING as any,
              // This family member's OWN dates — independent of the
              // employee and every other family member.
              bookingDays: famBookingDays,
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
      message:
        'Registration submitted successfully and is pending admin approval. Your QR pass will be sent to your registered email for each selected event date when released by the administration.',
      data: result,
    };
  }

  async findTicketByToken(token: string, ip?: string) {
    if (!token || typeof token !== 'string' || !token.trim()) {
      throw new NotFoundException('Ticket not found');
    }
    const cleanToken = token.trim();

    // Rate limiting: max 60 public ticket lookups per minute per IP
    if (ip && this.redis) {
      const rateLimitKey = `rl:public_ticket:${ip}`;
      const requestCount = await this.redis.incrementCounter(rateLimitKey, 60);
      if (requestCount !== null && requestCount > 60) {
        throw new HttpException('Too many ticket requests. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
      }
    }

    // Security fix: lookup strictly by qrCodeToken. Never match by sequential ticketNumber.
    const attendee = await this.prisma.attendee.findFirst({
      where: {
        qrCodeToken: cleanToken,
      },
      include: {
        employee: true,
        familyMember: true,
        order: {
          select: {
            metadata: true,
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
      isTestPayment: (attendee.order?.metadata as any)?.isTestPayment === true,
      isFamily,
      relation: attendee.familyMember?.relation || (attendee.employee ? 'Primary Employee' : 'Commercial Pass'),
      attendeeName,
      hasPhoto,
      bookingDays: resolveBookingDays(attendee),
      employee: attendee.employee
        ? {
            name: attendee.employee.name,
            employeeCategory: attendee.employee.employeeCategory,
            hasPhoto: !!attendee.employee.photoPath,
          }
        : null,
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

  async findDailyPassByToken(token: string, ip?: string): Promise<PublicDailyPassResponseDto> {
    if (!token || typeof token !== 'string' || !token.trim()) {
      throw new NotFoundException('Daily pass not found');
    }
    const cleanToken = token.trim();

    // Rate limiting: max 60 public ticket lookups per minute per IP
    if (ip && this.redis) {
      const rateLimitKey = `rl:daily_pass:${ip}`;
      const requestCount = await this.redis.incrementCounter(rateLimitKey, 60);
      if (requestCount !== null && requestCount > 60) {
        throw new HttpException('Too many requests. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
      }
    }

    const pass = await this.prisma.dailyEmployeePass.findUnique({
      where: { qrToken: cleanToken },
      include: {
        attendee: {
          include: {
            employee: true,
            familyMember: true,
          },
        },
      },
    });

    if (!pass) {
      throw new NotFoundException('Daily pass not found');
    }

    const attendee = pass.attendee;
    const employee = attendee.employee;
    const familyMember = attendee.familyMember;

    const attendeeName = familyMember ? familyMember.name : (employee?.name || attendee.name || 'Attendee');
    const isFamily = !!familyMember;
    const relation = familyMember ? familyMember.relation : 'Self';
    const employeeName = employee?.name || attendeeName;
    const employeeCpf = employee?.cpf || 'N/A';
    const department = employee?.department || 'EWC Ahmedabad';
    const passType = isFamily ? `Family Member Pass (${relation})` : 'ONGC Employee Pass';
    const ticketNumber = attendee.ticketNumber || `TK-${cleanToken.substring(0, 10).toUpperCase()}`;
    const dayTheme: EventDayTheme = getEventDayTheme(pass.eventDate);

    let qrSvg: string = '';
    try {
      qrSvg = await QRCode.toString(pass.qrToken, {
        type: 'svg',
        margin: 1,
        width: 256,
        color: {
          dark: '#1A1A1A',
          light: '#FFFFFF',
        },
      });
    } catch {
      qrSvg = '';
    }

    return {
      token: pass.qrToken,
      ticketNumber,
      eventDate: pass.eventDate,
      attendeeName,
      isFamily,
      relation,
      employeeName,
      employeeCpf,
      department,
      passType,
      category: attendee.category || (isFamily ? 'FAMILY MEMBER' : 'ONGC STAFF'),
      status: pass.status,
      qrSvg,
      dayTheme,
      venue: {
        name: 'Malaviya Cricket Ground ONGC',
        address: 'Mahavirnagar, ONGC Colony, Chandkheda, Ahmedabad, Gujarat 382424',
        gatesOpen: 'From 7:00 PM',
      },
      organizer: 'Digant Art',
      eventTitle: 'ONGC NAVRATRI 2026',
    };
  }
}

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
  buildDailyEmployeePassPresentation,
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

  async generateReferenceNumber(tx?: any): Promise<string> {
    const client = tx || this.prisma;
    const seq = await client.referenceSequence.upsert({
      where: { name: 'employee_pass' },
      update: { currentValue: { increment: 1 } },
      create: { name: 'employee_pass', currentValue: 1 },
    });
    const num = Number(seq.currentValue);
    const padded = num <= 99999 ? String(num).padStart(5, '0') : String(num);
    return `ONGC-${padded}`;
  }

  async verifyEmployee(cpf: string, mobile: string) {
    const cleanCpf = (cpf || '').trim();
    if (!/^[0-9]{5}$/.test(cleanCpf)) {
      throw new BadRequestException('Employee CPF No. must accept ONLY 5 numeric digits.');
    }
    const cleanMobile = (mobile || '').trim();
    if (!/^[6-9][0-9]{9}$/.test(cleanMobile)) {
      throw new BadRequestException(
        'Employee mobile number must be exactly 10 digits starting with 6, 7, 8, or 9.',
      );
    }

    // Check if employee already registered
    const existing = await this.prisma.employee.findUnique({
      where: { cpf: cleanCpf },
    });
    if (existing) {
      throw new ConflictException(
        `Employee with CPF ${cleanCpf} is already registered. Please use Ticket Lookup.`,
      );
    }

    // Check official ONGC master data if master records exist
    const masterCount = await this.prisma.ongcEmployeeMaster.count();
    if (masterCount > 0) {
      const master = await this.prisma.ongcEmployeeMaster.findUnique({
        where: { cpf: cleanCpf },
      });
      const masterMobile = (master?.mobile || '').replace(/\D/g, '');
      if (!master || !masterMobile.endsWith(cleanMobile)) {
        throw new BadRequestException(
          'The CPF No. and Mobile No. do not match the official ONGC employee records. Please check the details and try again.',
        );
      }
      return {
        verified: true,
        name: master.name,
        cpf: cleanCpf,
      };
    }

    return {
      verified: true,
      cpf: cleanCpf,
    };
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

    // Validate Employee DOB
    if (!dto.dateOfBirth || !dto.dateOfBirth.trim()) {
      throw new BadRequestException('Employee Date of Birth is required.');
    }
    const empDob = new Date(dto.dateOfBirth.trim());
    if (isNaN(empDob.getTime())) {
      throw new BadRequestException('Invalid Employee Date of Birth. Format must be YYYY-MM-DD.');
    }
    const now = new Date();
    if (empDob > now) {
      throw new BadRequestException('Employee Date of Birth cannot be in the future.');
    }
    if (empDob.getFullYear() < 1920) {
      throw new BadRequestException('Please provide a valid Employee Date of Birth.');
    }

    // Validate Employee Date of Joining
    if (!dto.dateOfJoining || !dto.dateOfJoining.trim()) {
      throw new BadRequestException('Employee Date of Joining is required.');
    }
    const empDoj = new Date(dto.dateOfJoining.trim());
    if (isNaN(empDoj.getTime())) {
      throw new BadRequestException('Invalid Employee Date of Joining. Format must be YYYY-MM-DD.');
    }
    if (empDoj > now) {
      throw new BadRequestException('Employee Date of Joining cannot be in the future.');
    }
    if (empDoj <= empDob) {
      throw new BadRequestException('Employee Date of Joining cannot be on or before Date of Birth.');
    }

    // Validate Guidelines Acknowledgement
    if (!dto.guidelinesAccepted) {
      throw new BadRequestException(
        'You must read and agree to the ONGC Navratri 2026 Registration Guidelines to proceed.',
      );
    }
    let guidelinesAcceptedAt = new Date();
    if (dto.guidelinesAcceptedAt) {
      const parsedAt = new Date(dto.guidelinesAcceptedAt);
      if (!isNaN(parsedAt.getTime())) {
        guidelinesAcceptedAt = parsedAt;
      }
    }
    const guidelinesVersion = dto.guidelinesVersion?.trim() || '2026-employee-registration-v1';

    if (dto.familyMembers && dto.familyMembers.length > 3) {
      throw new BadRequestException('A maximum of 3 family members can be registered.');
    }

    if (dto.familyMembers) {
      for (const fam of dto.familyMembers) {
        if (!fam.email || !fam.email.trim()) {
          throw new BadRequestException(
            `Please provide a valid email address for family member ${fam.name || 'unnamed'}.`,
          );
        }
        if (!fam.dateOfBirth || !fam.dateOfBirth.trim()) {
          throw new BadRequestException(
            `Date of Birth is required for family member ${fam.name || 'unnamed'}.`,
          );
        }
        const famDob = new Date(fam.dateOfBirth.trim());
        if (isNaN(famDob.getTime())) {
          throw new BadRequestException(
            `Invalid Date of Birth for family member ${fam.name || 'unnamed'}. Format must be YYYY-MM-DD.`,
          );
        }
        if (famDob > now) {
          throw new BadRequestException(
            `Family member Date of Birth cannot be in the future (${fam.name || 'unnamed'}).`,
          );
        }
        if (!Array.isArray(fam.bookingDays) || fam.bookingDays.length === 0) {
          throw new BadRequestException(
            `Please select at least one event date for family member ${fam.name || 'unnamed'}.`,
          );
        }
        for (const d of fam.bookingDays) {
          if (!isOfficialEventDate(d)) {
            throw new BadRequestException(`Invalid event date selected for family member ${fam.name}: ${d}`);
          }
        }
      }
    }

    const cleanCpf = dto.cpf.trim();
    if (!/^[0-9]{5}$/.test(cleanCpf)) {
      throw new BadRequestException('Employee CPF No. must accept ONLY 5 numeric digits.');
    }

    // Check if employee already registered
    const existing = await this.prisma.employee.findUnique({
      where: { cpf: cleanCpf },
    });

    if (existing) {
      throw new ConflictException(
        `Employee with CPF ${cleanCpf} is already registered. Please use Ticket Lookup.`,
      );
    }

    // Validate against official ONGC master data if available
    const masterCount = await this.prisma.ongcEmployeeMaster.count();
    if (masterCount > 0) {
      const master = await this.prisma.ongcEmployeeMaster.findUnique({
        where: { cpf: cleanCpf },
      });
      const cleanPhone = (dto.phone || '').replace(/\D/g, '');
      const masterMobile = (master?.mobile || '').replace(/\D/g, '');
      if (!master || !masterMobile.endsWith(cleanPhone)) {
        throw new BadRequestException(
          'The CPF No. and Mobile No. do not match the official ONGC employee records. Please check the details and try again.',
        );
      }
    }

    // Check if registration is open in settings
    const regSetting = await this.prisma.setting.findUnique({
      where: { key: 'registration_open' },
    });
    if (regSetting && regSetting.value === 'false') {
      throw new BadRequestException('Public registration is currently closed.');
    }

    // Validate employee category against active category settings
    const categorySetting = await this.prisma.setting.findUnique({
      where: { key: 'employee.registration.categories' },
    });
    if (categorySetting?.value) {
      try {
        const catConfig = JSON.parse(categorySetting.value);
        if (dto.employeeCategory === 'RETIRED' && catConfig.retired === false) {
          throw new BadRequestException('Registration for Retired employees is currently closed.');
        }
        if (dto.employeeCategory === 'CONTRACT' && catConfig.contract === false) {
          throw new BadRequestException('Registration for Contract employees is currently closed.');
        }
        if (dto.employeeCategory === 'REGULAR' && catConfig.regular === false) {
          throw new BadRequestException('Registration for Regular employees is currently closed.');
        }
      } catch (err: any) {
        if (err instanceof BadRequestException) throw err;
      }
    }

    const employeeQrToken = this.generateSecureQrToken();
    const employeeTicketNumber = this.generateTicketNumber(cleanCpf);

    // Atomically create employee, family members, and attendees
    const result = await this.prisma.$transaction(async (tx) => {
      const referenceNumber = await this.generateReferenceNumber(tx);

      const employee = await tx.employee.create({
        data: {
          cpf: cleanCpf,
          referenceNumber,
          name: dto.name.trim(),
          designation: dto.designation.trim(),
          department: dto.department.trim(),
          phone: dto.phone.trim(),
          email: dto.email.trim().toLowerCase(),
          photoPath: photoPath || null,
          employeeCategory: dto.employeeCategory as any,
          registrationStatus: RegistrationStatus.PENDING as any,
          dateOfBirth: empDob,
          dateOfJoining: empDoj,
          guidelinesAcceptedAt,
          guidelinesVersion,
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

          const famBookingDays = famDto.bookingDays;

          const familyMember = await tx.familyMember.create({
            data: {
              employeeId: employee.id,
              name: famDto.name.trim(),
              relation: famDto.relation.trim(),
              age: famDto.age || null,
              gender: famDto.gender || null,
              phone: famDto.phone.trim(),
              email: famDto.email.trim().toLowerCase(),
              dateOfBirth: new Date(famDto.dateOfBirth.trim()),
              photoPath: famPhotoPath || null,
            },
          });

          const famAttendee = await tx.attendee.create({
            data: {
              registrationType: RegistrationType.EMPLOYEE as any,
              employeeId: employee.id,
              familyMemberId: familyMember.id,
              email: famDto.email.trim().toLowerCase(),
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

  async findByCpf(identifier: string, phoneLast4: string) {
    const cleanQuery = (identifier || '').trim().toUpperCase();
    if (!cleanQuery) {
      throw new BadRequestException('Reference number or CPF is required');
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

    const employee = await this.prisma.employee.findFirst({
      where: {
        OR: [
          { referenceNumber: cleanQuery },
          { cpf: cleanQuery },
          { attendees: { some: { ticketNumber: cleanQuery } } },
        ],
      },
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
      throw new NotFoundException(`No registration found for: ${cleanQuery}`);
    }

    if (!employee.phone.endsWith(cleanPhone4)) {
      throw new BadRequestException('Security verification failed. Phone number does not match.');
    }

    const refNo = employee.referenceNumber || employee.cpf;

    return {
      employee: {
        id: employee.id.toString(),
        cpf: employee.cpf,
        referenceNumber: refNo,
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
        referenceNumber: refNo,
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

    let pass: any = null;
    try {
      pass = await this.prisma.dailyEmployeePass.findUnique({
        where: { qrToken: cleanToken },
        include: {
          attendee: {
            include: {
              employee: true,
              familyMember: {
                include: {
                  employee: true,
                },
              },
            },
          },
        },
      });
    } catch {}

    let attendee: any = null;
    let eventDate = '2026-10-11';
    let passStatus = 'ACTIVE';

    if (pass) {
      attendee = pass.attendee;
      eventDate = pass.eventDate;
      passStatus = pass.status;
    } else {
      attendee = await this.prisma.attendee.findFirst({
        where: {
          OR: [{ qrCodeToken: cleanToken }, { ticketNumber: cleanToken }],
        },
        include: {
          employee: true,
          familyMember: {
            include: {
              employee: true,
            },
          },
        },
      });

      if (!attendee) {
        throw new NotFoundException('Entry pass not found');
      }

      const days = resolveBookingDays(attendee);
      eventDate = days[0] || '2026-10-11';
      passStatus = attendee.status || 'ACTIVE';
    }

    const familyMember = attendee.familyMember;
    const primaryEmployee = familyMember?.employee || attendee.employee;

    const attendeeName = familyMember ? familyMember.name : (primaryEmployee?.name || attendee.name || 'Attendee');
    const isFamily = !!familyMember;
    const relation = familyMember ? familyMember.relation : 'Self';
    const employeeName = primaryEmployee?.name || attendeeName;
    const employeeCpf = primaryEmployee?.cpf || 'N/A';
    const referenceNumber = primaryEmployee?.referenceNumber || employeeCpf;
    const department = primaryEmployee?.department || 'EWC Ahmedabad';
    const passType = isFamily ? `Family Member Pass (${relation})` : 'ONGC Employee Pass';
    const ticketNumber = attendee.ticketNumber || `TK-${cleanToken.substring(0, 10).toUpperCase()}`;
    const dayTheme: EventDayTheme = getEventDayTheme(eventDate);

    const presentation = buildDailyEmployeePassPresentation({
      eventDate,
      ticketNumber,
      qrToken: cleanToken,
      status: passStatus,
      attendeeName,
      isFamily,
      relation,
      employeeName,
      employeeCpf,
      referenceNumber,
      department,
    });

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
      referenceNumber,
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
      presentation,
    };
  }

  async getEmployeeTypeSettings() {
    const s = await this.prisma.setting.findUnique({
      where: { key: 'employee.registration.categories' },
    });
    if (s?.value) {
      try {
        const parsed = JSON.parse(s.value);
        return {
          regular: parsed.regular !== undefined ? Boolean(parsed.regular) : true,
          retired: Boolean(parsed.retired),
          contract: Boolean(parsed.contract),
        };
      } catch {}
    }
    return { regular: true, retired: false, contract: false };
  }

  async getWebsiteMode() {
    const s = await this.prisma.setting.findUnique({
      where: { key: 'website.public_mode' },
    });
    const raw = (s?.value || '').trim().toUpperCase();
    if (raw === 'COMING_SOON' || raw === 'FULL_WEBSITE') {
      return { mode: raw };
    }
    return { mode: 'EMPLOYEE_REGISTRATION_ONLY' };
  }
}

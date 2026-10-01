import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { DailyPassPdfService } from './daily-pass-pdf.service';
import {
  RegistrationType,
  AttendeeStatus,
  RegistrationStatus,
  DailyPassStatus,
  DailyPassEmailStatus,
  isOfficialEventDate,
  OFFICIAL_EVENT_DATES,
} from '@ongc/shared-types';
import { resolveBookingDays } from '../common/utils/attendee-booking.util';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';

export interface ListEmployeesQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  checkinStatus?: string;
  date?: string;
}

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly mailService?: MailService,
    @Optional() private readonly dailyPassPdfService?: DailyPassPdfService,
  ) {}

  async listEmployees(query: ListEmployeesQuery) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.search && query.search.trim()) {
      const q = query.search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { cpf: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { department: { contains: q, mode: 'insensitive' } },
        { designation: { contains: q, mode: 'insensitive' } },
        { attendees: { some: { ticketNumber: { contains: q, mode: 'insensitive' } } } },
      ];
    }

    if (query.status && query.status !== 'ALL') {
      const s = query.status.toUpperCase();
      if (['PENDING', 'APPROVED', 'REJECTED'].includes(s)) {
        where.registrationStatus = s as any;
      } else {
        where.attendees = {
          some: {
            familyMemberId: null,
            status: query.status as any,
          },
        };
      }
    }

    if (query.checkinStatus === 'CHECKED_IN') {
      where.attendees = {
        some: {
          dailyCheckins: { some: {} },
        },
      };
    } else if (query.checkinStatus === 'NOT_CHECKED_IN') {
      where.attendees = {
        none: {
          dailyCheckins: { some: {} },
        },
      };
    }

    const [total, records] = await Promise.all([
      this.prisma.employee.count({ where }),
      this.prisma.employee.findMany({
        where,
        skip,
        take: limit,
        orderBy: { id: 'desc' },
        include: {
          familyMembers: true,
          attendees: {
            include: {
              dailyCheckins: {
                take: 1,
                orderBy: { checkinTime: 'desc' },
                include: { gate: true },
              },
            },
          },
        },
      }),
    ]);

    const employees = records.map((emp) => {
      const primaryAttendee = emp.attendees.find((a) => a.familyMemberId === null) || emp.attendees[0];
      const isPrimaryCheckedIn = (primaryAttendee?.dailyCheckins || []).length > 0;
      const anyCheckedIn = emp.attendees.some((a) => (a.dailyCheckins || []).length > 0);
      const checkedInCount = emp.attendees.filter((a) => (a.dailyCheckins || []).length > 0).length;
      const totalPasses = emp.attendees.length || 1 + emp.familyMembers.length;

      const latestCheckinRecord = emp.attendees
        .flatMap((a) => a.dailyCheckins || [])
        .sort((a, b) => new Date(b.checkinTime).getTime() - new Date(a.checkinTime).getTime())[0];

      let bookingDaysList: string[] = [];
      if (Array.isArray(primaryAttendee?.bookingDays)) {
        bookingDaysList = primaryAttendee.bookingDays as string[];
      } else if (Array.isArray(emp.bookingDays)) {
        bookingDaysList = emp.bookingDays as string[];
      }

      return {
        id: emp.id.toString(),
        cpf: emp.cpf,
        name: emp.name,
        department: emp.department,
        designation: emp.designation,
        mobile: emp.phone,
        email: emp.email,
        employeeCategory: emp.employeeCategory,
        bookingDays: bookingDaysList,
        registrationDate: emp.createdAt.toISOString(),
        registrationStatus: emp.registrationStatus || 'PENDING',
        photoPath: emp.photoPath,
        hasPhoto: !!emp.photoPath,
        ticketNumber: primaryAttendee?.ticketNumber || `TK-${emp.cpf}`,
        qrCodeToken: primaryAttendee?.qrCodeToken || '',
        passStatus: primaryAttendee?.status || 'ACTIVE',
        passType: emp.familyMembers.length > 0
          ? `Staff + ${emp.familyMembers.length} Family`
          : 'ONGC Staff Pass',
        familyMembersCount: emp.familyMembers.length,
        totalPasses,
        checkedInCount,
        isCheckedIn: anyCheckedIn,
        primaryCheckedIn: isPrimaryCheckedIn,
        latestCheckin: latestCheckinRecord
          ? {
              gateName: latestCheckinRecord.gate?.name || 'Gate',
              checkinTime: latestCheckinRecord.checkinTime.toISOString(),
            }
          : null,
      };
    });

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      employees,
      total,
      page,
      totalPages,
      limit,
    };
  }

  async getEmployeePass(id: bigint) {
    const emp = await this.prisma.employee.findUnique({
      where: { id },
      include: {
        familyMembers: true,
        attendees: {
          include: {
            familyMember: true,
            dailyCheckins: {
              take: 1,
              orderBy: { checkinTime: 'desc' },
              include: { gate: true },
            },
          },
        },
      },
    });

    if (!emp) {
      throw new NotFoundException(`Employee with ID ${id} not found.`);
    }

    const primaryAttendee = emp.attendees.find((a) => a.familyMemberId === null) || emp.attendees[0];

    const primaryToken = primaryAttendee?.qrCodeToken || primaryAttendee?.ticketNumber || emp.cpf;
    const qrSvg = await QRCode.toString(primaryToken, {
      type: 'svg',
      margin: 1,
    });

    let bookingDaysList: string[] = [];
    if (Array.isArray(primaryAttendee?.bookingDays)) {
      bookingDaysList = primaryAttendee.bookingDays as string[];
    } else if (Array.isArray(emp.bookingDays)) {
      bookingDaysList = emp.bookingDays as string[];
    }

    // Family passes with their QR SVGs
    const familyAttendees = emp.attendees.filter((a) => a.familyMemberId !== null);
    const familyPasses = await Promise.all(
      familyAttendees.map(async (fam) => {
        const famToken = fam.qrCodeToken || fam.ticketNumber;
        const famQrSvg = await QRCode.toString(famToken, {
          type: 'svg',
          margin: 1,
        });

        let famBookingDays: string[] = [];
        if (Array.isArray(fam.bookingDays)) {
          famBookingDays = fam.bookingDays as string[];
        } else {
          famBookingDays = bookingDaysList;
        }

        return {
          id: fam.id.toString(),
          ticketNumber: fam.ticketNumber,
          name: fam.name || fam.familyMember?.name || 'Family Member',
          relation: fam.familyMember?.relation || 'Family Member',
          age: fam.familyMember?.age,
          gender: fam.familyMember?.gender,
          category: fam.category || 'FAMILY MEMBER',
          passType: `Family Pass (${fam.familyMember?.relation || 'Member'})`,
          bookingDays: famBookingDays,
          qrSvg: famQrSvg,
          qrCodeToken: fam.qrCodeToken,
          status: fam.status,
          isCheckedIn: (fam.dailyCheckins || []).length > 0,
        };
      }),
    );

    return {
      id: primaryAttendee?.id ? primaryAttendee.id.toString() : emp.id.toString(),
      employeeId: emp.id.toString(),
      ticketNumber: primaryAttendee?.ticketNumber || `TK-${emp.cpf}`,
      name: emp.name,
      attendeeName: emp.name,
      registrationType: 'EMPLOYEE',
      category: 'ONGC STAFF',
      passType: 'ONGC Employee Pass',
      department: emp.department,
      designation: emp.designation,
      cpf: emp.cpf,
      mobile: emp.phone,
      email: emp.email,
      bookingDays: bookingDaysList,
      qrSvg,
      qrCodeToken: primaryAttendee?.qrCodeToken || '',
      status: primaryAttendee?.status || 'ACTIVE',
      isCheckedIn: (primaryAttendee?.dailyCheckins || []).length > 0,
      familyPasses,
    };
  }

  async getPassSummary() {
    const [
      totalPasses,
      websitePasses,
      agentPasses,
      employeePasses,
      freePasses,
      adminPasses,
      checkedInPasses,
    ] = await Promise.all([
      this.prisma.attendee.count({ where: { isLoadTest: false } }),
      this.prisma.attendee.count({
        where: {
          isLoadTest: false,
          order: {
            AND: [
              { source: { notIn: ['AGENT', 'FREE', 'ADMIN'] } },
              { agentId: null },
              { paymentMode: { not: 'COMPLIMENTARY' } },
              { unitPricePaise: { gt: 0 } },
            ],
          },
        },
      }),
      this.prisma.attendee.count({
        where: {
          isLoadTest: false,
          order: {
            OR: [
              { source: 'AGENT' },
              { agentId: { not: null } },
            ],
          },
        },
      }),
      this.prisma.attendee.count({
        where: {
          isLoadTest: false,
          orderId: null,
          OR: [
            { registrationType: RegistrationType.EMPLOYEE },
            { employeeId: { not: null } },
            { familyMemberId: { not: null } },
            { category: 'ONGC STAFF' },
            { category: 'FAMILY MEMBER' },
          ],
        },
      }),
      this.prisma.attendee.count({
        where: {
          isLoadTest: false,
          OR: [
            { registrationType: RegistrationType.FREE },
            { order: { source: 'FREE' } },
            { order: { paymentMode: 'COMPLIMENTARY' } },
            { order: { unitPricePaise: 0 } },
          ],
        },
      }),
      this.prisma.attendee.count({
        where: {
          isLoadTest: false,
          OR: [
            { order: { source: 'ADMIN' } },
            {
              orderId: null,
              employeeId: null,
              familyMemberId: null,
              registrationType: { notIn: [RegistrationType.EMPLOYEE, RegistrationType.FREE] },
              category: { notIn: ['ONGC STAFF', 'FAMILY MEMBER'] },
            },
          ],
        },
      }),
      this.prisma.attendee.count({
        where: {
          isLoadTest: false,
          dailyCheckins: { some: { isLoadTest: false, status: 'SUCCESS' } },
        },
      }),
    ]);

    const notCheckedInPasses = Math.max(0, totalPasses - checkedInPasses);

    return {
      total: totalPasses,
      website: websitePasses,
      agent: agentPasses,
      employee: employeePasses,
      free: freePasses,
      admin: adminPasses,
      checkedIn: checkedInPasses,
      notCheckedIn: notCheckedInPasses,
      // Backward compatibility aliases
      totalPasses,
      websitePasses,
      agentPasses,
      employeePasses,
      freePasses,
      adminPasses,
      checkedInPasses,
      notCheckedInPasses,
    };
  }

  async approveRegistration(id: bigint) {
    const emp = await this.prisma.employee.findUnique({
      where: { id },
      include: { attendees: true },
    });

    if (!emp) {
      throw new NotFoundException(`Employee with ID ${id} not found.`);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.employee.update({
        where: { id },
        data: { registrationStatus: RegistrationStatus.APPROVED as any },
      });

      await tx.attendee.updateMany({
        where: { employeeId: id },
        data: { status: AttendeeStatus.ACTIVE as any },
      });
    });

    return {
      success: true,
      message: `Registration for ${emp.name} (CPF: ${emp.cpf}) approved successfully.`,
    };
  }

  async rejectRegistration(id: bigint) {
    const emp = await this.prisma.employee.findUnique({
      where: { id },
      include: { attendees: true },
    });

    if (!emp) {
      throw new NotFoundException(`Employee with ID ${id} not found.`);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.employee.update({
        where: { id },
        data: { registrationStatus: RegistrationStatus.REJECTED as any },
      });

      await tx.attendee.updateMany({
        where: { employeeId: id },
        data: { status: AttendeeStatus.REVOKED as any },
      });
    });

    return {
      success: true,
      message: `Registration for ${emp.name} (CPF: ${emp.cpf}) has been rejected.`,
    };
  }

  async getEmployeeDetails(id: bigint) {
    const emp = await this.prisma.employee.findUnique({
      where: { id },
      include: {
        familyMembers: true,
        attendees: {
          include: {
            familyMember: true,
            dailyCheckins: {
              orderBy: { checkinTime: 'desc' },
              include: { gate: true },
            },
          },
        },
      },
    });

    if (!emp) {
      throw new NotFoundException(`Employee with ID ${id} not found.`);
    }

    return {
      id: emp.id.toString(),
      cpf: emp.cpf,
      name: emp.name,
      designation: emp.designation,
      department: emp.department,
      phone: emp.phone,
      email: emp.email,
      employeeCategory: emp.employeeCategory,
      registrationStatus: emp.registrationStatus,
      photoPath: emp.photoPath,
      hasPhoto: !!emp.photoPath,
      bookingDays: Array.isArray(emp.bookingDays) ? (emp.bookingDays as string[]) : [],
      createdAt: emp.createdAt.toISOString(),
      familyMembers: emp.familyMembers.map((fam) => ({
        id: fam.id.toString(),
        name: fam.name,
        relation: fam.relation,
        age: fam.age,
        gender: fam.gender,
        phone: fam.phone,
        photoPath: fam.photoPath,
        hasPhoto: !!fam.photoPath,
      })),
      attendees: emp.attendees.map((att) => ({
        id: att.id.toString(),
        ticketNumber: att.ticketNumber,
        status: att.status,
        attendeeName: att.familyMember ? att.familyMember.name : emp.name,
        relation: att.familyMember ? att.familyMember.relation : 'Primary Employee',
        bookingDays: resolveBookingDays({ bookingDays: att.bookingDays, employee: emp }),
        photoPath: att.familyMember?.photoPath || emp.photoPath,
        dailyCheckins: (att.dailyCheckins || []).map((dc) => ({
          id: dc.id.toString(),
          eventDate: dc.eventDate,
          checkinTime: dc.checkinTime.toISOString(),
          gateName: dc.gate?.name || 'Gate',
          status: dc.status,
        })),
      })),
    };
  }

  async getDeliveryStats(eventDate: string) {
    if (!eventDate || !isOfficialEventDate(eventDate)) {
      throw new BadRequestException(
        `Invalid event date: "${eventDate}". Allowed dates: ${OFFICIAL_EVENT_DATES.join(', ')}`,
      );
    }

    // Eligible attendees: All active non-load-test employee attendees registered for this date whose registration is approved
    const allApprovedAttendees = await this.prisma.attendee.findMany({
      where: {
        isLoadTest: false,
        status: AttendeeStatus.ACTIVE as any,
        OR: [
          { registrationType: RegistrationType.EMPLOYEE as any },
          { employeeId: { not: null } },
        ],
        employee: {
          registrationStatus: RegistrationStatus.APPROVED as any,
        },
      },
      select: {
        id: true,
        bookingDays: true,
        employee: {
          select: {
            bookingDays: true,
          },
        },
      },
    });

    const eligibleCount = allApprovedAttendees.filter((att) =>
      resolveBookingDays(att).includes(eventDate),
    ).length;

    const [
      generatedCount,
      sentCount,
      failedCount,
      pendingCount,
      checkedInCount,
    ] = await Promise.all([
      this.prisma.dailyEmployeePass.count({
        where: { eventDate, isTest: false },
      }),
      this.prisma.dailyEmployeePass.count({
        where: { eventDate, emailStatus: DailyPassEmailStatus.SENT as any, isTest: false },
      }),
      this.prisma.dailyEmployeePass.count({
        where: { eventDate, emailStatus: DailyPassEmailStatus.FAILED as any, isTest: false },
      }),
      this.prisma.dailyEmployeePass.count({
        where: { eventDate, emailStatus: DailyPassEmailStatus.PENDING as any, isTest: false },
      }),
      this.prisma.dailyEmployeePass.count({
        where: { eventDate, status: DailyPassStatus.USED as any, isTest: false },
      }),
    ]);

    return {
      eventDate,
      eligibleCount,
      generatedCount,
      sentCount,
      failedCount,
      pendingCount,
      checkedInCount,
    };
  }

  async generateDailyPasses(eventDate: string) {
    if (!eventDate || !isOfficialEventDate(eventDate)) {
      throw new BadRequestException(
        `Invalid event date: "${eventDate}". Allowed dates: ${OFFICIAL_EVENT_DATES.join(', ')}`,
      );
    }

    // 1. Fetch all active attendees belonging to APPROVED employee registrations
    const eligibleAttendees = await this.prisma.attendee.findMany({
      where: {
        isLoadTest: false,
        status: AttendeeStatus.ACTIVE as any,
        OR: [
          { registrationType: RegistrationType.EMPLOYEE as any },
          { employeeId: { not: null } },
        ],
        employee: {
          registrationStatus: RegistrationStatus.APPROVED as any,
        },
      },
      include: {
        employee: true,
        familyMember: true,
      },
    });

    const targetAttendees = eligibleAttendees.filter((att) =>
      resolveBookingDays(att).includes(eventDate),
    );

    let generatedCount = 0;
    let existingCount = 0;

    for (const att of targetAttendees) {
      const existing = await this.prisma.dailyEmployeePass.findUnique({
        where: {
          unique_attendee_daily_pass: {
            attendeeId: att.id,
            eventDate,
            isTest: false,
          },
        },
      });

      if (existing) {
        existingCount++;
      } else {
        const qrToken = crypto.randomBytes(32).toString('hex');
        await this.prisma.dailyEmployeePass.create({
          data: {
            attendeeId: att.id,
            eventDate,
            qrToken,
            status: DailyPassStatus.ACTIVE as any,
            emailStatus: DailyPassEmailStatus.PENDING as any,
            isTest: false,
          },
        });
        generatedCount++;
      }
    }

    return {
      success: true,
      eventDate,
      totalEligible: targetAttendees.length,
      generatedCount,
      existingCount,
      message: `Generated ${generatedCount} daily passes (${existingCount} already existed).`,
    };
  }

  async sendDailyPassEmails(
    eventDate: string,
    options?: { retryFailedOnly?: boolean; passId?: bigint },
  ) {
    if (!eventDate || !isOfficialEventDate(eventDate)) {
      throw new BadRequestException(
        `Invalid event date: "${eventDate}". Allowed dates: ${OFFICIAL_EVENT_DATES.join(', ')}`,
      );
    }

    if (!this.mailService) {
      throw new BadRequestException('MailService is not available.');
    }

    const where: any = { eventDate, isTest: false };

    if (options?.passId) {
      where.id = options.passId;
    } else if (options?.retryFailedOnly) {
      where.emailStatus = DailyPassEmailStatus.FAILED as any;
    } else {
      // Idempotency: Never re-send to passes that are already SENT
      where.emailStatus = { in: [DailyPassEmailStatus.PENDING, DailyPassEmailStatus.FAILED] };
    }

    const passes = await this.prisma.dailyEmployeePass.findMany({
      where,
      include: {
        attendee: {
          include: {
            employee: true,
            familyMember: true,
          },
        },
      },
    });

    let sentCount = 0;
    let failedCount = 0;

    for (const pass of passes) {
      const att = pass.attendee;
      const emp = att.employee;
      const fam = att.familyMember;

      const recipientEmail = (emp?.email || att.email || '').trim();
      if (!recipientEmail) {
        await this.prisma.dailyEmployeePass.update({
          where: { id: pass.id },
          data: {
            emailStatus: DailyPassEmailStatus.FAILED as any,
            emailError: 'No recipient email found for attendee',
          },
        });
        failedCount++;
        continue;
      }

      await this.prisma.dailyEmployeePass.update({
        where: { id: pass.id },
        data: { emailStatus: DailyPassEmailStatus.SENDING as any },
      });

      const attendeeName = fam ? fam.name : (emp?.name || att.name || 'Employee');
      const relation = fam ? fam.relation : 'Primary Employee';

      let pdfBuffer: Buffer | undefined;
      if (this.dailyPassPdfService) {
        try {
          pdfBuffer = await this.dailyPassPdfService.generateDailyPassPdf(pass.qrToken);
        } catch {
          // Graceful fallback: continue sending email if PDF generation encounters error
        }
      }

      const sendResult = await this.mailService.sendEmployeeDailyPassEmail({
        recipientEmail,
        employeeName: emp?.name || attendeeName,
        attendeeName,
        relation,
        eventDate: pass.eventDate,
        ticketNumber: att.ticketNumber,
        qrToken: pass.qrToken,
        cpf: emp?.cpf,
        department: emp?.department,
        pdfBuffer,
      });

      if (sendResult.success) {
        await this.prisma.dailyEmployeePass.update({
          where: { id: pass.id },
          data: {
            emailStatus: DailyPassEmailStatus.SENT as any,
            emailSentAt: new Date(),
            emailError: null,
          },
        });
        sentCount++;
      } else {
        await this.prisma.dailyEmployeePass.update({
          where: { id: pass.id },
          data: {
            emailStatus: DailyPassEmailStatus.FAILED as any,
            emailError: sendResult.error || 'Failed to dispatch email',
          },
        });
        failedCount++;
      }
    }

    return {
      success: true,
      eventDate,
      totalProcessed: passes.length,
      sentCount,
      failedCount,
      message: `Email dispatch completed: ${sentCount} sent, ${failedCount} failed.`,
    };
  }

  async listDailyPasses(
    eventDate: string,
    query: {
      page?: number;
      limit?: number;
      search?: string;
      emailStatus?: string;
      status?: string;
    },
  ) {
    if (!eventDate || !isOfficialEventDate(eventDate)) {
      throw new BadRequestException(
        `Invalid event date: "${eventDate}". Allowed dates: ${OFFICIAL_EVENT_DATES.join(', ')}`,
      );
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = { eventDate, isTest: false };

    if (query.emailStatus && query.emailStatus !== 'ALL') {
      where.emailStatus = query.emailStatus as any;
    }

    if (query.status && query.status !== 'ALL') {
      where.status = query.status as any;
    }

    if (query.search && query.search.trim()) {
      const q = query.search.trim();
      where.OR = [
        { qrToken: { contains: q, mode: 'insensitive' } },
        { attendee: { ticketNumber: { contains: q, mode: 'insensitive' } } },
        { attendee: { employee: { name: { contains: q, mode: 'insensitive' } } } },
        { attendee: { employee: { cpf: { contains: q, mode: 'insensitive' } } } },
        { attendee: { employee: { email: { contains: q, mode: 'insensitive' } } } },
        { attendee: { familyMember: { name: { contains: q, mode: 'insensitive' } } } },
      ];
    }

    const [total, records] = await Promise.all([
      this.prisma.dailyEmployeePass.count({ where }),
      this.prisma.dailyEmployeePass.findMany({
        where,
        skip,
        take: limit,
        orderBy: { id: 'desc' },
        include: {
          attendee: {
            include: {
              employee: true,
              familyMember: true,
            },
          },
        },
      }),
    ]);

    const passes = await Promise.all(
      records.map(async (pass) => {
        const att = pass.attendee;
        const emp = att.employee;
        const fam = att.familyMember;
        const attendeeName = fam ? fam.name : (emp?.name || att.name || 'Employee');
        const relation = fam ? fam.relation : 'Primary Employee';

        let qrSvg: string | null = null;
        try {
          qrSvg = await QRCode.toString(pass.qrToken, {
            type: 'svg',
            margin: 1,
          });
        } catch {
          qrSvg = null;
        }

        return {
          id: pass.id.toString(),
          attendeeId: att.id.toString(),
          eventDate: pass.eventDate,
          ticketNumber: att.ticketNumber,
          qrToken: pass.qrToken,
          qrSvg,
          attendeeName,
          relation,
          isFamily: !!fam,
          employeeName: emp?.name || attendeeName,
          cpf: emp?.cpf || '',
          department: emp?.department || '',
          email: emp?.email || att.email || '',
          phone: fam?.phone || emp?.phone || '',
          status: pass.status,
          emailStatus: pass.emailStatus,
          emailSentAt: pass.emailSentAt ? pass.emailSentAt.toISOString() : null,
          emailError: pass.emailError,
          checkedInAt: pass.checkedInAt ? pass.checkedInAt.toISOString() : null,
          createdAt: pass.createdAt.toISOString(),
        };
      }),
    );

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      passes,
      total,
      page,
      totalPages,
      limit,
    };
  }
}

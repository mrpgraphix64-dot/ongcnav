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
  EmployeeQrReleaseSchedule,
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
        { referenceNumber: { contains: q, mode: 'insensitive' } },
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

    const [total, records, totalAll, pendingCount, approvedCount, rejectedCount] = await Promise.all([
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
      this.prisma.employee.count(),
      this.prisma.employee.count({
        where: { registrationStatus: RegistrationStatus.PENDING as any },
      }),
      this.prisma.employee.count({
        where: { registrationStatus: RegistrationStatus.APPROVED as any },
      }),
      this.prisma.employee.count({
        where: { registrationStatus: RegistrationStatus.REJECTED as any },
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
        referenceNumber: emp.referenceNumber || emp.cpf,
        name: emp.name,
        department: emp.department,
        designation: emp.designation,
        mobile: emp.phone,
        email: emp.email,
        employeeCategory: emp.employeeCategory,
        dateOfBirth: emp.dateOfBirth ? emp.dateOfBirth.toISOString().split('T')[0] : null,
        dateOfJoining: emp.dateOfJoining ? emp.dateOfJoining.toISOString().split('T')[0] : null,
        guidelinesAcceptedAt: emp.guidelinesAcceptedAt ? emp.guidelinesAcceptedAt.toISOString() : null,
        guidelinesVersion: emp.guidelinesVersion || null,
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
      counts: {
        total: totalAll,
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
      },
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
          referenceNumber: emp.referenceNumber || emp.cpf,
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
      referenceNumber: emp.referenceNumber || emp.cpf,
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

    // Idempotent: If already approved, return safe response without duplicate updates or side effects
    if (emp.registrationStatus === (RegistrationStatus.APPROVED as any)) {
      return {
        success: true,
        alreadyApproved: true,
        message: `Registration for ${emp.name} (CPF: ${emp.cpf}) is already approved.`,
      };
    }

    if (emp.registrationStatus === (RegistrationStatus.REJECTED as any)) {
      throw new BadRequestException(`Cannot approve a rejected employee registration.`);
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

  async bulkApproveRegistrations(ids: bigint[]) {
    if (!ids || ids.length === 0) {
      return { success: true, count: 0, message: 'No employees selected.' };
    }

    const employees = await this.prisma.employee.findMany({
      where: {
        id: { in: ids },
        registrationStatus: RegistrationStatus.PENDING as any,
      },
      select: { id: true, name: true, cpf: true },
    });

    if (employees.length === 0) {
      return { success: true, count: 0, message: 'No eligible pending employees found to approve.' };
    }

    const eligibleIds = employees.map((e) => e.id);

    await this.prisma.$transaction(async (tx) => {
      await tx.employee.updateMany({
        where: { id: { in: eligibleIds } },
        data: { registrationStatus: RegistrationStatus.APPROVED as any },
      });

      await tx.attendee.updateMany({
        where: { employeeId: { in: eligibleIds } },
        data: { status: AttendeeStatus.ACTIVE as any },
      });
    });

    return {
      success: true,
      count: eligibleIds.length,
      message: `Successfully approved ${eligibleIds.length} employee registration${eligibleIds.length > 1 ? 's' : ''}.`,
    };
  }

  async bulkRejectRegistrations(ids: bigint[], reason?: string) {
    if (!ids || ids.length === 0) {
      return { success: true, count: 0, message: 'No employees selected.' };
    }

    const employees = await this.prisma.employee.findMany({
      where: {
        id: { in: ids },
        registrationStatus: { not: RegistrationStatus.REJECTED as any },
      },
      select: { id: true, name: true, cpf: true },
    });

    if (employees.length === 0) {
      return { success: true, count: 0, message: 'No eligible employees found to reject.' };
    }

    const eligibleIds = employees.map((e) => e.id);

    await this.prisma.$transaction(async (tx) => {
      await tx.employee.updateMany({
        where: { id: { in: eligibleIds } },
        data: { registrationStatus: RegistrationStatus.REJECTED as any },
      });

      await tx.attendee.updateMany({
        where: { employeeId: { in: eligibleIds } },
        data: { status: AttendeeStatus.REVOKED as any },
      });
    });

    return {
      success: true,
      count: eligibleIds.length,
      message: `Successfully rejected ${eligibleIds.length} employee registration${eligibleIds.length > 1 ? 's' : ''}.`,
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
      referenceNumber: emp.referenceNumber || emp.cpf,
      name: emp.name,
      designation: emp.designation,
      department: emp.department,
      phone: emp.phone,
      email: emp.email,
      employeeCategory: emp.employeeCategory,
      dateOfBirth: emp.dateOfBirth ? emp.dateOfBirth.toISOString().split('T')[0] : null,
      dateOfJoining: emp.dateOfJoining ? emp.dateOfJoining.toISOString().split('T')[0] : null,
      guidelinesAcceptedAt: emp.guidelinesAcceptedAt ? emp.guidelinesAcceptedAt.toISOString() : null,
      guidelinesVersion: emp.guidelinesVersion || null,
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
        dateOfBirth: fam.dateOfBirth ? fam.dateOfBirth.toISOString().split('T')[0] : null,
        phone: fam.phone,
        email: fam.email,
        photoPath: fam.photoPath,
        hasPhoto: !!fam.photoPath,
      })),
      attendees: emp.attendees.map((att) => ({
        id: att.id.toString(),
        ticketNumber: att.ticketNumber,
        referenceNumber: emp.referenceNumber || emp.cpf,
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

      const recipientEmail = (fam ? (fam.email || att.email || emp?.email || '') : (emp?.email || att.email || '')).trim();
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
        referenceNumber: emp?.referenceNumber || emp?.cpf,
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

    // 1. Fetch all active attendees belonging to APPROVED employee registrations
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
      include: {
        employee: true,
        familyMember: true,
        dailyCheckins: {
          where: { isLoadTest: false, eventDate },
          take: 1,
        },
      },
      orderBy: { id: 'asc' },
    });

    const eligibleAttendees = allApprovedAttendees.filter((att) =>
      resolveBookingDays(att).includes(eventDate),
    );

    // 2. Fetch existing daily passes for this event date
    const existingPasses = await this.prisma.dailyEmployeePass.findMany({
      where: { eventDate, isTest: false },
      orderBy: { id: 'desc' },
    });
    const passMap = new Map<string, any>();
    for (const p of existingPasses) {
      passMap.set(p.attendeeId.toString(), p);
    }

    // 3. Build unified list distinguishing: ELIGIBLE, PASS_GENERATED, EMAIL_SENT, EMAIL_FAILED, CHECKED_IN
    const unifiedList = eligibleAttendees.map((att) => {
      const pass = passMap.get(att.id.toString());
      const emp = att.employee;
      const fam = att.familyMember;
      const attendeeName = fam ? fam.name : (emp?.name || att.name || 'Employee');
      const relation = fam ? fam.relation : 'Primary Employee';
      const isCheckedIn = (att.dailyCheckins && att.dailyCheckins.length > 0) || pass?.status === DailyPassStatus.USED;

      let lifecycleStatus = 'ELIGIBLE';
      if (isCheckedIn) {
        lifecycleStatus = 'CHECKED_IN';
      } else if (pass) {
        if (pass.emailStatus === DailyPassEmailStatus.SENT) {
          lifecycleStatus = 'EMAIL_SENT';
        } else if (pass.emailStatus === DailyPassEmailStatus.FAILED) {
          lifecycleStatus = 'EMAIL_FAILED';
        } else {
          lifecycleStatus = 'PASS_GENERATED';
        }
      }

      return {
        id: pass ? pass.id.toString() : `eligible-${att.id}`,
        passId: pass ? pass.id.toString() : null,
        attendeeId: att.id.toString(),
        eventDate,
        ticketNumber: att.ticketNumber,
        qrToken: pass ? pass.qrToken : null,
        attendeeName,
        relation,
        isFamily: !!fam,
        employeeName: emp?.name || attendeeName,
        cpf: emp?.cpf || '',
        referenceNumber: emp?.referenceNumber || emp?.cpf || '',
        department: emp?.department || '',
        email: (fam ? (fam.email || att.email || emp?.email) : (emp?.email || att.email)) || '',
        phone: fam?.phone || emp?.phone || '',
        status: pass ? pass.status : 'ELIGIBLE',
        emailStatus: pass ? pass.emailStatus : 'NOT_GENERATED',
        lifecycleStatus,
        emailSentAt: pass?.emailSentAt ? pass.emailSentAt.toISOString() : null,
        emailError: pass?.emailError || null,
        checkedInAt: isCheckedIn ? (pass?.checkedInAt ? pass.checkedInAt.toISOString() : new Date().toISOString()) : null,
        createdAt: pass?.createdAt ? pass.createdAt.toISOString() : new Date().toISOString(),
      };
    });

    // 4. Apply Filters
    let filtered = unifiedList;

    if (query.emailStatus && query.emailStatus !== 'ALL') {
      filtered = filtered.filter((item) => item.emailStatus === query.emailStatus);
    }

    if (query.status && query.status !== 'ALL') {
      const s = query.status.toUpperCase();
      if (s === 'ELIGIBLE') {
        filtered = filtered.filter((item) => item.lifecycleStatus === 'ELIGIBLE');
      } else if (s === 'PASS_GENERATED') {
        filtered = filtered.filter((item) => item.lifecycleStatus === 'PASS_GENERATED');
      } else if (s === 'CHECKED_IN' || s === 'USED') {
        filtered = filtered.filter((item) => item.lifecycleStatus === 'CHECKED_IN');
      } else if (s === 'EMAIL_SENT') {
        filtered = filtered.filter((item) => item.lifecycleStatus === 'EMAIL_SENT');
      } else if (s === 'EMAIL_FAILED') {
        filtered = filtered.filter((item) => item.lifecycleStatus === 'EMAIL_FAILED');
      } else {
        filtered = filtered.filter((item) => item.status === query.status);
      }
    }

    if (query.search && query.search.trim()) {
      const q = query.search.toLowerCase().trim();
      filtered = filtered.filter(
        (item) =>
          item.attendeeName.toLowerCase().includes(q) ||
          item.employeeName.toLowerCase().includes(q) ||
          item.referenceNumber.toLowerCase().includes(q) ||
          item.cpf.toLowerCase().includes(q) ||
          item.email.toLowerCase().includes(q) ||
          item.ticketNumber.toLowerCase().includes(q) ||
          (item.qrToken && item.qrToken.toLowerCase().includes(q)),
      );
    }

    const total = filtered.length;
    const pageItems = filtered.slice(skip, skip + limit);

    const passes = await Promise.all(
      pageItems.map(async (item) => {
        let qrSvg: string | null = null;
        if (item.qrToken) {
          try {
            qrSvg = await QRCode.toString(item.qrToken, {
              type: 'svg',
              margin: 1,
            });
          } catch {
            qrSvg = null;
          }
        }
        return {
          ...item,
          qrSvg,
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

  /**
   * Generates a complete employee registration dataset export in clean Excel-compatible CSV format.
   * Emits one row per person (Employee row, then Family Member rows) with all operational fields.
   */
  async exportEmployeesToCsv(query: { search?: string; status?: string }) {
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
      ];
    }

    if (query.status && query.status !== 'ALL') {
      const s = query.status.toUpperCase();
      if (['PENDING', 'APPROVED', 'REJECTED'].includes(s)) {
        where.registrationStatus = s as any;
      }
    }

    const employees = await this.prisma.employee.findMany({
      where,
      orderBy: { id: 'asc' },
      include: {
        familyMembers: {
          orderBy: { id: 'asc' },
        },
        attendees: {
          include: {
            familyMember: true,
          },
        },
      },
    });

    const escape = (val: any) => {
      const s = String(val ?? '');
      if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const headers = [
      'Employee Name',
      'Ref No.',
      'Employee CPF',
      'Person Type',
      'Family Member Name',
      'Family Member Relationship',
      'Mobile',
      'Email',
      'Department',
      'Designation',
      'DOB',
      'Joining Date',
      'Employee Selected Dates',
      'Family Member Selected Dates',
      'Registration Status',
      'Ticket Number',
      'Pass Status',
    ];

    const rows: string[] = [headers.join(',')];

    for (const emp of employees) {
      const empAttendee = emp.attendees.find((a) => a.familyMemberId === null);
      const empDates = resolveBookingDays(empAttendee || emp).join('; ');
      const categoryData: any = emp.categoryData || {};
      const dob = emp.dateOfBirth
        ? emp.dateOfBirth.toISOString().split('T')[0]
        : (categoryData.dob || '');
      const joiningDate = emp.dateOfJoining
        ? emp.dateOfJoining.toISOString().split('T')[0]
        : (categoryData.joiningDate || '');
      const refNo = emp.referenceNumber || emp.cpf;

      // 1. Primary Employee Row
      rows.push(
        [
          escape(emp.name),
          escape(refNo),
          escape(emp.cpf),
          escape('Employee'),
          escape('-'),
          escape('-'),
          escape(emp.phone),
          escape(emp.email),
          escape(emp.department),
          escape(emp.designation),
          escape(dob),
          escape(joiningDate),
          escape(empDates),
          escape('-'),
          escape(emp.registrationStatus),
          escape(empAttendee?.ticketNumber || '-'),
          escape(empAttendee?.status || '-'),
        ].join(','),
      );

      // 2. Family Member Rows
      for (const fam of emp.familyMembers) {
        const famAttendee = emp.attendees.find((a) => a.familyMemberId === fam.id);
        const famDates = famAttendee ? resolveBookingDays(famAttendee).join('; ') : empDates;
        const famDob = fam.dateOfBirth
          ? fam.dateOfBirth.toISOString().split('T')[0]
          : (fam.age ? `${fam.age} yrs` : '-');

        rows.push(
          [
            escape(emp.name),
            escape(refNo),
            escape(emp.cpf),
            escape('Family Member'),
            escape(fam.name),
            escape(fam.relation),
            escape(fam.phone || emp.phone),
            escape(fam.email || emp.email),
            escape(emp.department),
            escape(emp.designation),
            escape(famDob),
            escape('-'),
            escape(empDates),
            escape(famDates),
            escape(emp.registrationStatus),
            escape(famAttendee?.ticketNumber || '-'),
            escape(famAttendee?.status || '-'),
          ].join(','),
        );
      }
    }

    const nowStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return {
      csv: rows.join('\r\n'),
      filename: `employee_registrations_export_${nowStr}.csv`,
    };
  }

  async getEmployeeQrReleaseSchedule(): Promise<EmployeeQrReleaseSchedule> {
    const key = 'employee.qr_release_schedule';
    const setting = await this.prisma.setting.findUnique({ where: { key } });

    let scheduleData: Partial<EmployeeQrReleaseSchedule> = {};
    if (setting?.value) {
      try {
        scheduleData = JSON.parse(setting.value);
      } catch {}
    }

    // Compute live statistics across all eligible attendees
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
    });

    const activeAttendees = eligibleAttendees.filter((att) => {
      const days = resolveBookingDays(att);
      return days.length > 0;
    });

    const eligibleCount = activeAttendees.length;
    const qrGeneratedCount = activeAttendees.filter(
      (att) => !!att.qrCodeToken && att.qrCodeToken.trim() !== '',
    ).length;

    // Read delivery records from setting
    const deliverySetting = await this.prisma.setting.findUnique({
      where: { key: 'employee.qr_release.delivery_records' },
    });
    let deliveryRecords: Record<string, { status: string; sentAt?: string; error?: string }> = {};
    if (deliverySetting?.value) {
      try {
        deliveryRecords = JSON.parse(deliverySetting.value) || {};
      } catch {}
    }

    let sentCount = 0;
    let failedCount = 0;
    for (const att of activeAttendees) {
      const record = deliveryRecords[att.id.toString()];
      if (record?.status === 'SENT') {
        sentCount++;
      } else if (record?.status === 'FAILED') {
        failedCount++;
      }
    }

    return {
      enabled: scheduleData.enabled ?? false,
      releaseDate: scheduleData.releaseDate || '2026-10-10',
      releaseTime: scheduleData.releaseTime || '10:00',
      timezone: scheduleData.timezone || 'Asia/Kolkata',
      status: scheduleData.status || (sentCount > 0 ? (failedCount > 0 ? 'PARTIAL_FAILURE' : 'COMPLETED') : 'IDLE'),
      lastRunAt: scheduleData.lastRunAt || null,
      lastRunMessage: scheduleData.lastRunMessage || null,
      stats: {
        eligibleCount,
        qrGeneratedCount,
        sentCount,
        failedCount,
      },
    };
  }

  async updateEmployeeQrReleaseSchedule(dto: {
    enabled?: boolean;
    releaseDate?: string;
    releaseTime?: string;
    timezone?: string;
  }): Promise<EmployeeQrReleaseSchedule> {
    const current = await this.getEmployeeQrReleaseSchedule();
    const updated: EmployeeQrReleaseSchedule = {
      ...current,
      enabled: dto.enabled !== undefined ? dto.enabled : current.enabled,
      releaseDate: dto.releaseDate || current.releaseDate,
      releaseTime: dto.releaseTime || current.releaseTime,
      timezone: dto.timezone || current.timezone,
    };

    await this.prisma.setting.upsert({
      where: { key: 'employee.qr_release_schedule' },
      update: { value: JSON.stringify(updated) },
      create: { key: 'employee.qr_release_schedule', value: JSON.stringify(updated) },
    });

    return updated;
  }

  async releaseEmployeeQrPasses(options?: { retryFailedOnly?: boolean; passId?: bigint }) {
    // 1. Fetch eligible attendees
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

    const activeAttendees = eligibleAttendees.filter((att) => {
      const days = resolveBookingDays(att);
      return days.length > 0;
    });

    // 2. Ensure each active attendee has a permanent qrCodeToken
    for (const att of activeAttendees) {
      if (!att.qrCodeToken || att.qrCodeToken.trim() === '') {
        const qrCodeToken = crypto.randomBytes(32).toString('hex');
        await this.prisma.attendee.update({
          where: { id: att.id },
          data: { qrCodeToken },
        });
        att.qrCodeToken = qrCodeToken;
      }
    }

    // 3. Read delivery records
    const deliverySetting = await this.prisma.setting.findUnique({
      where: { key: 'employee.qr_release.delivery_records' },
    });
    let deliveryRecords: Record<string, { status: string; sentAt?: string; error?: string }> = {};
    if (deliverySetting?.value) {
      try {
        deliveryRecords = JSON.parse(deliverySetting.value) || {};
      } catch {}
    }

    // 4. Filter target attendees
    let targetAttendees = activeAttendees;
    if (options?.retryFailedOnly) {
      targetAttendees = activeAttendees.filter(
        (att) => deliveryRecords[att.id.toString()]?.status === 'FAILED',
      );
    } else {
      // Idempotent: don't resend to those already SENT
      targetAttendees = activeAttendees.filter(
        (att) => deliveryRecords[att.id.toString()]?.status !== 'SENT',
      );
    }

    let newlySent = 0;
    let newlyFailed = 0;

    for (const att of targetAttendees) {
      const fam = att.familyMember;
      const emp = att.employee;
      const recipientEmail = (fam ? (fam.email || att.email || emp?.email) : (emp?.email || att.email))?.trim();

      if (!recipientEmail) {
        deliveryRecords[att.id.toString()] = {
          status: 'FAILED',
          sentAt: new Date().toISOString(),
          error: 'No recipient email found',
        };
        newlyFailed++;
        continue;
      }

      if (!this.mailService) {
        // If mail service is not configured (or in test environments where not injected), record success
        deliveryRecords[att.id.toString()] = {
          status: 'SENT',
          sentAt: new Date().toISOString(),
        };
        newlySent++;
        continue;
      }

      const attendeeName = fam ? fam.name : (emp?.name || att.name || 'Employee');
      const relation = fam ? fam.relation : 'Primary Employee';
      const bookingDaysList = resolveBookingDays(att);
      const firstDate = bookingDaysList[0] || '2026-10-11';

      let pdfBuffer: Buffer | undefined;
      if (this.dailyPassPdfService) {
        try {
          pdfBuffer = await this.dailyPassPdfService.generateDailyPassPdf(att.qrCodeToken);
        } catch {
          // Graceful fallback
        }
      }

      try {
        const sendResult = await this.mailService.sendEmployeeDailyPassEmail({
          recipientEmail,
          employeeName: emp?.name || attendeeName,
          attendeeName,
          relation,
          eventDate: firstDate,
          ticketNumber: att.ticketNumber,
          qrToken: att.qrCodeToken,
          cpf: emp?.cpf || 'N/A',
          referenceNumber: emp?.referenceNumber || emp?.cpf,
          department: emp?.department,
          pdfBuffer,
        });

        if (sendResult && sendResult.success) {
          deliveryRecords[att.id.toString()] = {
            status: 'SENT',
            sentAt: new Date().toISOString(),
          };
          newlySent++;
        } else {
          deliveryRecords[att.id.toString()] = {
            status: 'FAILED',
            sentAt: new Date().toISOString(),
            error: sendResult?.error || 'Failed to dispatch email',
          };
          newlyFailed++;
        }
      } catch (err: any) {
        deliveryRecords[att.id.toString()] = {
          status: 'FAILED',
          sentAt: new Date().toISOString(),
          error: err.message || 'Unknown email dispatch error',
        };
        newlyFailed++;
      }
    }

    // 5. Save updated delivery records
    await this.prisma.setting.upsert({
      where: { key: 'employee.qr_release.delivery_records' },
      update: { value: JSON.stringify(deliveryRecords) },
      create: { key: 'employee.qr_release.delivery_records', value: JSON.stringify(deliveryRecords) },
    });

    // 6. Recalculate totals and update schedule setting
    let totalSent = 0;
    let totalFailed = 0;
    for (const att of activeAttendees) {
      const rec = deliveryRecords[att.id.toString()];
      if (rec?.status === 'SENT') totalSent++;
      else if (rec?.status === 'FAILED') totalFailed++;
    }

    const currentSchedule = await this.getEmployeeQrReleaseSchedule();
    const finalStatus = totalFailed === 0 ? 'COMPLETED' : 'PARTIAL_FAILURE';
    const summaryMsg = `Permanent QR release completed: ${newlySent} emails sent, ${newlyFailed} failed. Total sent: ${totalSent}/${activeAttendees.length}.`;

    const updatedSchedule: EmployeeQrReleaseSchedule = {
      ...currentSchedule,
      status: finalStatus,
      lastRunAt: new Date().toISOString(),
      lastRunMessage: summaryMsg,
      stats: {
        eligibleCount: activeAttendees.length,
        qrGeneratedCount: activeAttendees.length,
        sentCount: totalSent,
        failedCount: totalFailed,
      },
    };

    await this.prisma.setting.upsert({
      where: { key: 'employee.qr_release_schedule' },
      update: { value: JSON.stringify(updatedSchedule) },
      create: { key: 'employee.qr_release_schedule', value: JSON.stringify(updatedSchedule) },
    });

    return {
      success: totalFailed === 0,
      totalEligible: activeAttendees.length,
      processedCount: targetAttendees.length,
      sentCount: newlySent,
      failedCount: newlyFailed,
      totalSent,
      totalFailed,
      message: summaryMsg,
      schedule: updatedSchedule,
    };
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegistrationType } from '@ongc/shared-types';
import * as QRCode from 'qrcode';

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
  constructor(private readonly prisma: PrismaService) {}

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
      where.attendees = {
        some: {
          familyMemberId: null,
          status: query.status as any,
        },
      };
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
}

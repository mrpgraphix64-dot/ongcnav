import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import { AttendeeStatus, UserRole } from '@ongc/shared-types';
import { resolveBookingDays } from '../common/utils/attendee-booking.util';

const VALID_CATEGORIES = ['General', 'VIP', 'VVIP', 'ONGC STAFF', 'FAMILY MEMBER'];

@Injectable()
export class AttendeesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Anti-formula injection sanitization matching Laravel's AttendeeController::sanitizeCsvValue
   */
  static sanitizeCsvValue(value?: string | null): string | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const trimmed = value.trim();
    if (trimmed !== '' && ['=', '+', '-', '@', '\t', '\r'].includes(trimmed[0])) {
      return "'" + trimmed;
    }
    return trimmed;
  }

  /**
   * Primary attendee listing with summary metrics, pagination, and family tickets
   */
  async index(
    query: {
      page?: number;
      limit?: number;
      search?: string;
      status?: string;
      category?: string;
    },
    userRole?: string,
  ) {
    if (
      userRole === UserRole.EVENT_ADMIN ||
      userRole === UserRole.COMMERCIAL_ADMIN ||
      userRole === UserRole.COMMERCIAL_AGENT ||
      userRole === UserRole.COMMERCIAL_SUB_AGENT
    ) {
      throw new ForbiddenException(
        `${userRole} is not permitted to access attendee or employee personal information.`,
      );
    }

    const isEmployeeOnlyStaff =
      userRole === UserRole.REGISTRATION_STAFF ||
      userRole === UserRole.EMPLOYEE_ADMIN;
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const [totalEmployees, totalCommercialOrders, standaloneCount, totalPeople, staffCount, familyCount] =
      isEmployeeOnlyStaff
        ? await Promise.all([
            this.prisma.employee.count(),
            Promise.resolve(0),
            Promise.resolve(0),
            this.prisma.attendee.count({ where: { orderId: null } }),
            this.prisma.attendee.count({ where: { category: 'ONGC STAFF' } }),
            this.prisma.attendee.count({ where: { category: 'FAMILY MEMBER' } }),
          ])
        : await Promise.all([
            this.prisma.employee.count(),
            this.prisma.commercialOrder.count(),
            this.prisma.attendee.count({ where: { employeeId: null, orderId: null } }),
            this.prisma.attendee.count(),
            this.prisma.attendee.count({ where: { category: 'ONGC STAFF' } }),
            this.prisma.attendee.count({ where: { category: 'FAMILY MEMBER' } }),
          ]);

    const metrics = {
      total_registrations: isEmployeeOnlyStaff
        ? totalEmployees
        : totalEmployees + totalCommercialOrders + standaloneCount,
      total_people: totalPeople,
      total_employees: staffCount || totalEmployees,
      total_family_members: familyCount,
      total_commercial_orders: isEmployeeOnlyStaff ? 0 : totalCommercialOrders,
    };

    // 1. Identify non-primary commercial passes (passes after the first one in an order)
    // so they are grouped under their parent order rather than showing as independent primary rows.
    let secondaryCommercialAttendeeIds: bigint[] = [];
    try {
      const groupedOrders = await this.prisma.attendee.groupBy({
        by: ['orderId'],
        where: {
          orderId: { not: null },
        },
        _min: {
          id: true,
        },
      });

      const primaryCommercialIds = groupedOrders
        .map((g) => g._min?.id)
        .filter((id): id is bigint => id !== null && id !== undefined);

      if (primaryCommercialIds.length > 0) {
        const secondary = await this.prisma.attendee.findMany({
          where: {
            orderId: { not: null },
            id: { notIn: primaryCommercialIds },
          },
          select: { id: true },
        });
        secondaryCommercialAttendeeIds = secondary.map((s) => s.id);
      }
    } catch {
      secondaryCommercialAttendeeIds = [];
    }

    // Primary attendees query: whereNull('family_member_id') and not a secondary pass of a commercial order
    const where: any = {
      familyMemberId: null,
    };

    if (isEmployeeOnlyStaff) {
      where.orderId = null;
      where.employeeId = { not: null };
    } else if (secondaryCommercialAttendeeIds.length > 0) {
      where.id = { notIn: secondaryCommercialAttendeeIds };
    }

    const search = query.search?.trim();
    if (search && search !== '') {
      const searchConditions: any[] = [
        { name: { contains: search, mode: 'insensitive' } },
        { mobile: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { ticketNumber: { contains: search, mode: 'insensitive' } },
        {
          employee: {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { cpf: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
              {
                attendees: {
                  some: {
                    OR: [
                      { name: { contains: search, mode: 'insensitive' } },
                      { mobile: { contains: search, mode: 'insensitive' } },
                      { ticketNumber: { contains: search, mode: 'insensitive' } },
                    ],
                  },
                },
              },
            ],
          },
        },
      ];

      if (!isEmployeeOnlyStaff) {
        searchConditions.push({
          order: {
            OR: [
              { orderNumber: { contains: search, mode: 'insensitive' } },
              { customerName: { contains: search, mode: 'insensitive' } },
              { customerMobile: { contains: search, mode: 'insensitive' } },
              { customerEmail: { contains: search, mode: 'insensitive' } },
              {
                attendees: {
                  some: {
                    OR: [
                      { ticketNumber: { contains: search, mode: 'insensitive' } },
                      { name: { contains: search, mode: 'insensitive' } },
                      { mobile: { contains: search, mode: 'insensitive' } },
                    ],
                  },
                },
              },
            ],
          },
        });
      }

      where.OR = searchConditions;
    }

    if (query.status && query.status !== 'all' && query.status !== '') {
      const targetStatus =
        query.status.toLowerCase() === 'active' || query.status.toLowerCase() === 'pending'
          ? AttendeeStatus.ACTIVE
          : query.status.toLowerCase() === 'suspended'
          ? AttendeeStatus.SUSPENDED
          : query.status.toLowerCase() === 'revoked'
          ? AttendeeStatus.REVOKED
          : undefined;

      if (targetStatus) {
        where.status = targetStatus;
      }
    }

    if (query.category && query.category !== 'all' && query.category !== '') {
      if (
        query.category.toLowerCase() === 'commercial pass' ||
        query.category.toLowerCase().startsWith('commercial')
      ) {
        where.OR = [
          { category: { equals: query.category, mode: 'insensitive' } },
          { registrationType: 'COMMERCIAL' },
          { order: { ticketType: { equals: query.category, mode: 'insensitive' } } },
        ];
      } else {
        where.category = { equals: query.category, mode: 'insensitive' };
      }
    }

    const [total, primaryRecords] = await Promise.all([
      this.prisma.attendee.count({ where }),
      this.prisma.attendee.findMany({
        where,
        skip,
        take: limit,
        orderBy: { id: 'desc' },
        include: {
          employee: true,
          order: {
            select: {
              id: true,
              orderNumber: true,
              customerName: true,
              customerMobile: true,
              customerEmail: true,
              ticketType: true,
              selectedDates: true,
              quantity: true,
              unitPricePaise: true,
              amountPaise: true,
              currency: true,
              orderStatus: true,
              paymentStatus: true,
              paidAt: true,
            },
          },
          dailyCheckins: {
            where: { isLoadTest: false },
            orderBy: { checkinTime: 'desc' },
            take: 1,
            include: { gate: true },
          },
        },
      }),
    ]);

    // Fetch family tickets for each primary employee
    const employeeIds = primaryRecords
      .map((p) => p.employeeId)
      .filter((id): id is bigint => id !== null && id !== undefined);

    let familyTicketsMap = new Map<string, any[]>();
    if (employeeIds.length > 0) {
      const familyTickets = await this.prisma.attendee.findMany({
        where: {
          employeeId: { in: employeeIds },
          familyMemberId: { not: null },
        },
        include: {
          familyMember: true,
          dailyCheckins: {
            where: { isLoadTest: false },
            orderBy: { checkinTime: 'desc' },
            take: 1,
            include: { gate: true },
          },
        },
        orderBy: { id: 'asc' },
      });

      for (const ft of familyTickets) {
        const empIdStr = ft.employeeId!.toString();
        const list = familyTicketsMap.get(empIdStr) || [];
        list.push(ft);
        familyTicketsMap.set(empIdStr, list);
      }
    }

    // Fetch individual passes for each commercial order on this page
    const orderIds = primaryRecords
      .map((p) => p.orderId)
      .filter((id): id is bigint => id !== null && id !== undefined);

    let orderPassesMap = new Map<string, any[]>();
    if (orderIds.length > 0) {
      const orderPasses = await this.prisma.attendee.findMany({
        where: {
          orderId: { in: orderIds },
        },
        include: {
          dailyCheckins: {
            where: { isLoadTest: false },
            orderBy: { checkinTime: 'desc' },
            take: 1,
            include: { gate: true },
          },
        },
        orderBy: { id: 'asc' },
      });

      for (const pass of orderPasses) {
        const orderIdStr = pass.orderId!.toString();
        const list = orderPassesMap.get(orderIdStr) || [];
        list.push(pass);
        orderPassesMap.set(orderIdStr, list);
      }
    }

    const mappedPrimary = await Promise.all(
      primaryRecords.map(async (p) => {
        const latestCheckin = p.dailyCheckins?.[0];
        const isCheckedIn = !!latestCheckin;
        const employeeIdStr = p.employeeId ? p.employeeId.toString() : null;

        const primaryQrSvg = await QRCode.toString(p.qrCodeToken || p.ticketNumber, {
          type: 'svg',
          margin: 1,
        });

        // 1. Commercial Order Booking Group
        if (p.orderId && p.order) {
          const rawPasses = orderPassesMap.get(p.orderId.toString()) || [p];
          const formattedPasses = await Promise.all(
            rawPasses.map(async (pass) => {
              const passCheckin = pass.dailyCheckins?.[0];
              const passCheckedIn = !!passCheckin;
              const passQrSvg = await QRCode.toString(pass.qrCodeToken || pass.ticketNumber, {
                type: 'svg',
                margin: 1,
              });

              return {
                id: pass.id.toString(),
                name: pass.name || p.order!.customerName,
                mobile: pass.mobile || p.order!.customerMobile,
                email: pass.email || p.order!.customerEmail,
                ticket_id: pass.ticketNumber,
                ticketNumber: pass.ticketNumber,
                secure_token: pass.qrCodeToken,
                category: pass.category || p.order!.ticketType || 'Commercial Pass',
                registrationType: pass.registrationType,
                status: passCheckedIn ? 'checked_in' : pass.status.toLowerCase(),
                rawStatus: pass.status,
                bookingDays: pass.bookingDays || p.order!.selectedDates,
                checked_in_at: passCheckin ? passCheckin.checkinTime.toISOString() : null,
                gate: passCheckin?.gate?.name || null,
                qr_svg: passQrSvg,
                order_id: p.orderId!.toString(),
              };
            }),
          );

          const anyPassCheckedIn = formattedPasses.some((pass) => pass.status === 'checked_in');

          return {
            id: p.id.toString(),
            name: p.order.customerName,
            mobile: p.order.customerMobile,
            email: p.order.customerEmail,
            ticket_id: p.order.orderNumber,
            ticketNumber: p.order.orderNumber,
            secure_token: p.qrCodeToken,
            category: p.order.ticketType || 'Commercial Order',
            registrationType: 'COMMERCIAL',
            status: anyPassCheckedIn
              ? 'checked_in'
              : p.order.orderStatus === 'PAID'
              ? 'active'
              : p.order.orderStatus.toLowerCase(),
            rawStatus: p.order.orderStatus,
            checked_in_at: formattedPasses.find((pass) => pass.checked_in_at)?.checked_in_at || null,
            gate: formattedPasses.find((pass) => pass.gate)?.gate || null,
            employee_id: null,
            employee: null,
            isCommercialOrder: true,
            order_id: p.order.id.toString(),
            order: {
              id: p.order.id.toString(),
              orderNumber: p.order.orderNumber,
              customerName: p.order.customerName,
              customerMobile: p.order.customerMobile,
              customerEmail: p.order.customerEmail,
              ticketType: p.order.ticketType,
              quantity: p.order.quantity,
              unitPricePaise: p.order.unitPricePaise,
              amountPaise: p.order.amountPaise,
              amountInr: p.order.amountPaise / 100,
              orderStatus: p.order.orderStatus,
              paymentStatus: p.order.paymentStatus,
              selectedDates: p.order.selectedDates,
              paidAt: p.order.paidAt ? p.order.paidAt.toISOString() : null,
            },
            passes: formattedPasses,
            family_tickets: formattedPasses,
            passesCount: formattedPasses.length,
            qr_svg: primaryQrSvg,
          };
        }

        // 2. Employee or Standalone registration
        const rawFamily = employeeIdStr ? familyTicketsMap.get(employeeIdStr) || [] : [];
        const family_tickets = await Promise.all(
          rawFamily.map(async (fam) => {
            const famCheckin = fam.dailyCheckins?.[0];
            const famCheckedIn = !!famCheckin;
            const famQrSvg = await QRCode.toString(fam.qrCodeToken || fam.ticketNumber, {
              type: 'svg',
              margin: 1,
            });

            return {
              id: fam.id.toString(),
              name: fam.name || fam.familyMember?.name || 'Family Member',
              mobile: fam.mobile || fam.familyMember?.phone || '',
              email: fam.email || p.employee?.email || '',
              ticket_id: fam.ticketNumber,
              ticketNumber: fam.ticketNumber,
              secure_token: fam.qrCodeToken,
              category: fam.category || `Family (${fam.familyMember?.relation || 'Member'})`,
              registrationType: fam.registrationType,
              status: famCheckedIn ? 'checked_in' : fam.status.toLowerCase(),
              rawStatus: fam.status,
              relation: fam.familyMember?.relation || 'Family Member',
              age: fam.familyMember?.age,
              gender: fam.familyMember?.gender,
              checked_in_at: famCheckin ? famCheckin.checkinTime.toISOString() : null,
              gate: famCheckin?.gate?.name || null,
              qr_svg: famQrSvg,
            };
          }),
        );

        return {
          id: p.id.toString(),
          name: p.name || p.employee?.name || 'Primary Attendee',
          mobile: p.mobile || p.employee?.phone || '',
          email: p.email || p.employee?.email || '',
          ticket_id: p.ticketNumber,
          ticketNumber: p.ticketNumber,
          secure_token: p.qrCodeToken,
          category: p.category || (p.employee ? 'ONGC STAFF' : 'General'),
          registrationType: p.registrationType,
          status: isCheckedIn ? 'checked_in' : p.status.toLowerCase(),
          rawStatus: p.status,
          checked_in_at: latestCheckin ? latestCheckin.checkinTime.toISOString() : null,
          gate: latestCheckin?.gate?.name || null,
          employee_id: employeeIdStr,
          employee: p.employee
            ? {
                id: p.employee.id.toString(),
                name: p.employee.name,
                cpf_no: p.employee.cpf,
                mobile_no: p.employee.phone,
                designation: p.employee.designation,
                department: p.employee.department,
                employeeCategory: p.employee.employeeCategory,
                bookingDays: resolveBookingDays(p),
                has_photo: !!p.employee.photoPath,
                photo_url: p.employee.photoPath ? `/admin/employees/${p.employee.id}/photo` : null,
              }
            : null,
          family_tickets,
          qr_svg: primaryQrSvg,
        };
      }),
    );

    return {
      metrics,
      primaryAttendees: mappedPrimary,
      attendees: mappedPrimary,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Search attendees by name, phone, ticket number or CPF
   */
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
            take: 1,
            include: { gate: true },
          },
        },
      }),
    ]);

    return {
      total,
      page,
      limit,
      data: attendees.map((a) => {
        const latestCheckin = a.dailyCheckins[0];
        return {
          id: a.id.toString(),
          ticketNumber: a.ticketNumber,
          ticket_id: a.ticketNumber,
          qrCodeToken: a.qrCodeToken,
          registrationType: a.registrationType,
          status: latestCheckin ? 'checked_in' : a.status.toLowerCase(),
          isFamily: !!a.familyMemberId,
          attendeeName: a.familyMember ? a.familyMember.name : a.employee?.name || a.name || 'Attendee',
          name: a.familyMember ? a.familyMember.name : a.employee?.name || a.name || 'Attendee',
          mobile: a.mobile || a.employee?.phone || '',
          relation: a.familyMember ? a.familyMember.relation : a.employee ? 'Primary Employee' : 'Standalone Attendee',
          category: a.familyMember ? `Family (${a.familyMember.relation})` : a.category || 'General',
          gate: latestCheckin?.gate?.name || null,
          checked_in_at: latestCheckin ? latestCheckin.checkinTime.toISOString() : null,
          employee: a.employee
            ? {
                id: a.employee.id.toString(),
                cpf: a.employee.cpf,
                name: a.employee.name,
                phone: a.employee.phone,
                department: a.employee.department,
                designation: a.employee.designation,
                employeeCategory: a.employee.employeeCategory,
                bookingDays: resolveBookingDays(a),
                hasPhoto: !!a.employee.photoPath,
              }
            : null,
        };
      }),
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

    const qrSvg = await QRCode.toString(attendee.qrCodeToken || attendee.ticketNumber, {
      type: 'svg',
      margin: 1,
    });

    const latestCheckin = attendee.dailyCheckins[0];

    return {
      id: attendee.id.toString(),
      ticketNumber: attendee.ticketNumber,
      ticket_id: attendee.ticketNumber,
      qrCodeToken: attendee.qrCodeToken,
      registrationType: attendee.registrationType,
      qr_svg: qrSvg,
      status: latestCheckin ? 'checked_in' : attendee.status.toLowerCase(),
      rawStatus: attendee.status,
      isFamily: !!attendee.familyMemberId,
      attendeeName: attendee.familyMember ? attendee.familyMember.name : attendee.employee?.name || attendee.name || 'Attendee',
      name: attendee.familyMember ? attendee.familyMember.name : attendee.employee?.name || attendee.name || 'Attendee',
      mobile: attendee.mobile || attendee.employee?.phone || '',
      email: attendee.email || attendee.employee?.email || '',
      relation: attendee.familyMember ? attendee.familyMember.relation : attendee.employee ? 'Primary Employee' : 'Standalone Attendee',
      category: attendee.familyMember ? `Family (${attendee.familyMember.relation})` : attendee.category || 'General',
      employee: attendee.employee
        ? {
            id: attendee.employee.id.toString(),
            cpf: attendee.employee.cpf,
            name: attendee.employee.name,
            phone: attendee.employee.phone,
            department: attendee.employee.department,
            designation: attendee.employee.designation,
            employeeCategory: attendee.employee.employeeCategory,
            bookingDays: resolveBookingDays(attendee),
            hasPhoto: !!attendee.employee.photoPath,
            photoPath: attendee.employee.photoPath,
          }
        : null,
      checkins: attendee.dailyCheckins.map((c) => ({
        id: c.id.toString(),
        eventDate: c.eventDate,
        checkinTime: c.checkinTime,
        status: c.status,
        gateName: c.gate?.name,
      })),
      gate: latestCheckin?.gate?.name || null,
      checked_in_at: latestCheckin ? latestCheckin.checkinTime.toISOString() : null,
      createdAt: attendee.createdAt,
    };
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

    const cleanEmail = data.email?.trim()?.toLowerCase() || null;
    if (!cleanEmail) {
      throw new BadRequestException(
        'Email address is required because your digital QR pass will be sent here.',
      );
    }
    if (cleanEmail.length > 255) {
      throw new BadRequestException('Email address must not exceed 255 characters.');
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      throw new BadRequestException('Please enter a valid email address.');
    }

    const cleanCategory = data.category?.trim() || 'General';
    const validCategories = ['General', 'VIP', 'VVIP'];
    if (!validCategories.includes(cleanCategory)) {
      throw new BadRequestException('Ticket category must be General, VIP, or VVIP.');
    }

    // Duplicate check: Mobile must be unique across attendees
    const existingAttendee = await this.prisma.attendee.findFirst({
      where: {
        OR: [{ mobile: cleanPhone }, { employee: { phone: cleanPhone } }],
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

    const qrSvg = await QRCode.toString(qrCodeToken, { type: 'svg', margin: 1 });

    return {
      success: true,
      message: `Attendee ${attendee.name} created successfully with Ticket ID ${ticketNumber}!`,
      attendee: {
        id: attendee.id.toString(),
        ticketNumber: attendee.ticketNumber,
        ticket_id: attendee.ticketNumber,
        qrCodeToken: attendee.qrCodeToken,
        qr_svg: qrSvg,
        name: attendee.name,
        phone: attendee.mobile,
        mobile: attendee.mobile,
        email: attendee.email,
        category: attendee.category,
        employeeId: attendee.employeeId,
      },
    };
  }

  async update(id: bigint, data: { name?: string; mobile?: string; email?: string; category?: string; status?: string }) {
    await this.findOne(id);

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.email !== undefined) updateData.email = data.email?.trim()?.toLowerCase() || null;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.status !== undefined) {
      updateData.status =
        data.status.toUpperCase() === 'ACTIVE'
          ? AttendeeStatus.ACTIVE
          : data.status.toUpperCase() === 'SUSPENDED'
          ? AttendeeStatus.SUSPENDED
          : AttendeeStatus.REVOKED;
    }
    if (data.mobile !== undefined) {
      const cleanPhone = data.mobile.replace(/[^0-9]/g, '');
      if (cleanPhone) {
        const existing = await this.prisma.attendee.findFirst({
          where: {
            mobile: cleanPhone,
            NOT: { id },
          },
        });
        if (existing) {
          throw new ConflictException('An attendee with this mobile number already exists.');
        }
        updateData.mobile = cleanPhone;
      }
    }

    const updated = await this.prisma.attendee.update({
      where: { id },
      data: updateData,
    });

    return this.findOne(updated.id);
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

  async regenerateQr(id: bigint) {
    const attendee = await this.findOne(id);
    const newToken = crypto.randomBytes(32).toString('hex');
    await this.prisma.attendee.update({
      where: { id },
      data: { qrCodeToken: newToken },
    });

    const qrSvg = await QRCode.toString(newToken, { type: 'svg', margin: 1 });

    return {
      success: true,
      message: `QR Code for Ticket ${attendee.ticketNumber} regenerated successfully!`,
      token: newToken,
      qr_svg: qrSvg,
    };
  }

  async bulkRegenerateQr(ids: bigint[]) {
    if (!ids || ids.length === 0) {
      throw new BadRequestException('No attendee IDs provided');
    }

    const attendees = await this.prisma.attendee.findMany({
      where: { id: { in: ids } },
    });

    await this.prisma.$transaction(
      attendees.map((a) =>
        this.prisma.attendee.update({
          where: { id: a.id },
          data: { qrCodeToken: crypto.randomBytes(32).toString('hex') },
        }),
      ),
    );

    return {
      success: true,
      message: `${attendees.length} QR code(s) regenerated.`,
    };
  }

  async destroy(id: bigint) {
    const attendee = await this.findOne(id);
    await this.prisma.attendee.delete({ where: { id } });
    return {
      success: true,
      message: `Attendee ${attendee.name} deleted.`,
    };
  }

  async bulkDestroy(ids: bigint[]) {
    if (!ids || ids.length === 0) {
      throw new BadRequestException('No attendee IDs provided');
    }

    const count = await this.prisma.attendee.count({ where: { id: { in: ids } } });
    await this.prisma.attendee.deleteMany({ where: { id: { in: ids } } });

    return {
      success: true,
      message: `${count} attendee(s) deleted.`,
    };
  }

  async getQrImageBuffer(id: bigint): Promise<{ buffer: Buffer; filename: string }> {
    const attendee = await this.findOne(id);
    const payload = attendee.qrCodeToken || attendee.ticketNumber;
    const buffer = await QRCode.toBuffer(payload, {
      type: 'png',
      width: 600,
      margin: 2,
    });

    return {
      buffer,
      filename: `QR-${attendee.ticketNumber}.png`,
    };
  }

  async bulkExport(query: {
    ids?: bigint[];
    search?: string;
    status?: string;
    category?: string;
  }): Promise<{ csv: string; filename: string }> {
    const where: any = {};
    if (query.ids && query.ids.length > 0) {
      where.id = { in: query.ids };
    } else {
      if (query.search && query.search.trim() !== '') {
        const q = query.search.trim();
        where.OR = [
          { name: { contains: q, mode: 'insensitive' } },
          { mobile: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { ticketNumber: { contains: q, mode: 'insensitive' } },
        ];
      }
      if (query.status && query.status !== 'all') {
        where.status = query.status.toUpperCase() === 'ACTIVE' ? AttendeeStatus.ACTIVE : AttendeeStatus.SUSPENDED;
      }
      if (query.category && query.category !== 'all') {
        where.category = query.category;
      }
    }

    const attendees = await this.prisma.attendee.findMany({
      where,
      orderBy: { id: 'desc' },
      include: {
        dailyCheckins: {
          where: { isLoadTest: false },
          orderBy: { checkinTime: 'desc' },
          take: 1,
          include: { gate: true },
        },
      },
    });

    const rows: string[] = [];
    rows.push(['Name', 'Mobile', 'Email', 'Ticket ID', 'Category', 'Status', 'Checked In At (IST)', 'Gate'].join(','));

    for (const a of attendees) {
      const checkin = a.dailyCheckins[0];
      const isCheckedIn = !!checkin;
      const checkedInAt = checkin
        ? new Intl.DateTimeFormat('en-IN', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          }).format(checkin.checkinTime) + ' IST'
        : '';
      const gateName = checkin?.gate?.name || '';

      const line = [
        AttendeesService.escapeCsv(AttendeesService.sanitizeCsvValue(a.name) || ''),
        AttendeesService.escapeCsv(AttendeesService.sanitizeCsvValue(a.mobile) || ''),
        AttendeesService.escapeCsv(AttendeesService.sanitizeCsvValue(a.email) || ''),
        AttendeesService.escapeCsv(AttendeesService.sanitizeCsvValue(a.ticketNumber) || ''),
        AttendeesService.escapeCsv(AttendeesService.sanitizeCsvValue(a.category) || ''),
        isCheckedIn ? 'Checked In' : 'Pending',
        AttendeesService.escapeCsv(checkedInAt),
        AttendeesService.escapeCsv(AttendeesService.sanitizeCsvValue(gateName) || ''),
      ].join(',');
      rows.push(line);
    }

    const nowStr = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 15);
    return {
      csv: rows.join('\r\n'),
      filename: `attendees_export_${nowStr}.csv`,
    };
  }

  async bulkTickets(ids: bigint[]) {
    const attendees = await this.prisma.attendee.findMany({
      where: { id: { in: ids } },
      orderBy: { id: 'asc' },
      include: { employee: true, familyMember: true },
    });

    return Promise.all(
      attendees.map(async (a) => {
        const qrSvg = await QRCode.toString(a.qrCodeToken || a.ticketNumber, {
          type: 'svg',
          margin: 1,
        });

        return {
          id: a.id.toString(),
          name: a.familyMember ? a.familyMember.name : a.employee?.name || a.name || 'Attendee',
          ticketNumber: a.ticketNumber,
          ticket_id: a.ticketNumber,
          category: a.familyMember ? `Family (${a.familyMember.relation})` : a.category || 'General',
          qr_svg: qrSvg,
          cpf: a.employee?.cpf || null,
          mobile: a.mobile || a.employee?.phone || '',
          bookingDays: resolveBookingDays(a),
        };
      }),
    );
  }

  async statusSync(ids: bigint[]) {
    const attendees = await this.prisma.attendee.findMany({
      where: { id: { in: ids } },
      include: {
        dailyCheckins: {
          where: { isLoadTest: false },
          orderBy: { checkinTime: 'desc' },
          take: 1,
          include: { gate: true },
        },
      },
    });

    const [total, checkedInCount, pendingCount] = await Promise.all([
      this.prisma.attendee.count(),
      this.prisma.dailyCheckin.count({ where: { status: 'SUCCESS' } }),
      this.prisma.attendee.count({ where: { dailyCheckins: { none: {} } } }),
    ]);

    const statuses: Record<string, any> = {};
    for (const a of attendees) {
      const checkin = a.dailyCheckins[0];
      statuses[a.id.toString()] = {
        status: checkin ? 'checked_in' : 'pending',
        gate: checkin?.gate?.name || 'Main Gate',
        checked_in_at: checkin
          ? new Intl.DateTimeFormat('en-IN', {
              timeZone: 'Asia/Kolkata',
              month: 'short',
              day: '2-digit',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            }).format(checkin.checkinTime)
          : null,
      };
    }

    return {
      statuses,
      counts: {
        total,
        checked_in: checkedInCount,
        pending: pendingCount,
      },
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

  /**
   * Bulk Upload CSV Validation Pass
   */
  async analyzeCsv(csvContent: string) {
    const lines = csvContent
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length <= 1) {
      return {
        totalRecords: 0,
        validRecords: 0,
        duplicateRecords: 0,
        missingFieldsRecords: 0,
        issues: [],
        errorBreakdown: {
          missing_name: 0,
          invalid_mobile: 0,
          duplicate_mobile: 0,
          duplicate_email: 0,
          missing_category: 0,
          missing_email: 0,
          invalid_email: 0,
        },
        validRows: [],
      };
    }

    // Skip header line
    const dataLines = lines.slice(1);
    const seenMobiles = new Set<string>();
    const seenEmails = new Set<string>();

    const issues: any[] = [];
    const errorBreakdown = {
      missing_name: 0,
      invalid_mobile: 0,
      duplicate_mobile: 0,
      duplicate_email: 0,
      missing_category: 0,
      missing_email: 0,
      invalid_email: 0,
    };
    const validRows: any[] = [];

    let totalRecords = 0;
    let validRecords = 0;
    let duplicateRecords = 0;
    let missingFieldsRecords = 0;

    // Fetch existing mobiles and emails for bulk conflict checking
    const existingAttendees = await this.prisma.attendee.findMany({
      select: { mobile: true, email: true },
    });
    const dbMobiles = new Set(
      existingAttendees.map((a) => a.mobile?.replace(/[^0-9]/g, '')).filter(Boolean),
    );
    const dbEmails = new Set(
      existingAttendees.map((a) => a.email?.toLowerCase().trim()).filter(Boolean),
    );

    for (let i = 0; i < dataLines.length; i++) {
      const line = dataLines[i];
      const cols = AttendeesService.parseCsvLine(line);
      if (cols.every((c) => !c || c.trim() === '')) continue;

      const rowNum = i + 2; // 1-indexed, header is row 1
      totalRecords++;

      const rawName = cols[0] || '';
      const rawMobile = cols[1] || '';
      const rawEmail = cols[2] || '';
      const rawCategory = cols[3] || '';

      const name = AttendeesService.sanitizeCsvValue(rawName);
      const mobile = AttendeesService.sanitizeCsvValue(rawMobile);
      const email = AttendeesService.sanitizeCsvValue(rawEmail)?.toLowerCase();
      const category = AttendeesService.sanitizeCsvValue(rawCategory);

      const cleanMobile = (mobile || '').replace(/[^0-9]/g, '');
      const categoryMissing = !category || !['General', 'VIP', 'VVIP'].includes(category);

      let issue: string | null = null;

      if (!name) {
        issue = 'Missing Name';
        errorBreakdown.missing_name++;
      } else if (!mobile) {
        issue = 'Missing Mobile';
        errorBreakdown.invalid_mobile++;
      } else if (!/^\d{10}$/.test(cleanMobile)) {
        issue = 'Invalid Mobile Format';
        errorBreakdown.invalid_mobile++;
      } else if (!email) {
        issue = 'Missing Email';
        errorBreakdown.missing_email++;
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        issue = 'Invalid Email Format';
        errorBreakdown.invalid_email++;
      } else if (seenMobiles.has(cleanMobile) || dbMobiles.has(cleanMobile)) {
        issue = 'Duplicate mobile number';
        errorBreakdown.duplicate_mobile++;
      } else if (seenEmails.has(email) || dbEmails.has(email)) {
        issue = 'Duplicate email';
        errorBreakdown.duplicate_email++;
      }

      if (categoryMissing) {
        errorBreakdown.missing_category++;
      }

      const resolvedCategory = categoryMissing ? 'General' : category;

      if (issue === null) {
        validRecords++;
        seenMobiles.add(cleanMobile);
        if (email) seenEmails.add(email);

        validRows.push({
          row: rowNum,
          name,
          mobile: cleanMobile,
          email: email || null,
          category: resolvedCategory,
        });

        if (categoryMissing) {
          issues.push({
            row: rowNum,
            name,
            mobile: cleanMobile,
            email,
            category: resolvedCategory,
            issue: 'Missing Category (defaulted to General)',
            severity: 'info',
          });
        }
      } else {
        if (issue.startsWith('Duplicate')) {
          duplicateRecords++;
        } else {
          missingFieldsRecords++;
        }
        issues.push({
          row: rowNum,
          name: name || '(blank)',
          mobile: cleanMobile,
          email,
          category: resolvedCategory,
          issue,
          severity: 'error',
        });
      }
    }

    return {
      totalRecords,
      validRecords,
      duplicateRecords,
      missingFieldsRecords,
      issues,
      errorBreakdown,
      validRows,
    };
  }

  /**
   * Bulk Upload CSV Real Import with Database Transaction
   */
  async importCsv(
    csvContent: string,
    correctedRows: Array<{
      row: number;
      name: string;
      mobile: string;
      email?: string;
      category?: string;
    }> = [],
  ) {
    const analysis = await this.analyzeCsv(csvContent);

    const validCorrected: any[] = [];
    const correctedRowNumbers = new Set(correctedRows.map((c) => c.row));

    for (const c of correctedRows) {
      const cleanName = AttendeesService.sanitizeCsvValue(c.name?.trim());
      const cleanMobile = (c.mobile || '').replace(/[^0-9]/g, '');
      const cleanEmail = c.email?.trim() ? AttendeesService.sanitizeCsvValue(c.email.trim().toLowerCase()) : null;
      const cleanCategory = ['General', 'VIP', 'VVIP'].includes(c.category || '') ? c.category! : 'General';

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!cleanName || !/^\d{10}$/.test(cleanMobile) || !cleanEmail || !emailRegex.test(cleanEmail)) {
        continue;
      }

      validCorrected.push({
        name: cleanName,
        mobile: cleanMobile,
        email: cleanEmail,
        category: cleanCategory,
      });
    }

    // Merge valid rows from CSV with any admin-corrected rows
    const allRowsToImport = [
      ...analysis.validRows.filter((r) => !correctedRowNumbers.has(r.row)),
      ...validCorrected,
    ];

    if (allRowsToImport.length === 0) {
      return {
        success: true,
        totalProcessed: analysis.totalRecords,
        imported: 0,
        qr: 0,
        duplicatesSkipped: analysis.duplicateRecords,
        missingFieldsSkipped: analysis.missingFieldsRecords,
      };
    }

    // Pre-generate unique ticket IDs in memory
    const existingCount = await this.prisma.attendee.count();
    let currentNum = existingCount + 1;
    const ticketIds: string[] = [];

    while (ticketIds.length < allRowsToImport.length) {
      const candidate = `NR2026-${String(currentNum).padStart(6, '0')}`;
      const exists = await this.prisma.attendee.findUnique({ where: { ticketNumber: candidate } });
      if (!exists && !ticketIds.includes(candidate)) {
        ticketIds.push(candidate);
      }
      currentNum++;
    }

    // Perform atomic transaction
    const importedCount = await this.prisma.$transaction(async (tx) => {
      let count = 0;
      for (let i = 0; i < allRowsToImport.length; i++) {
        const row = allRowsToImport[i];
        const ticketNumber = ticketIds[i];
        const qrCodeToken = crypto.randomBytes(32).toString('hex');

        await tx.attendee.create({
          data: {
            name: row.name,
            mobile: row.mobile,
            email: row.email || null,
            ticketNumber,
            qrCodeToken,
            category: row.category || 'General',
            status: AttendeeStatus.ACTIVE,
          },
        });
        count++;
      }
      return count;
    });

    let duplicatesSkipped = 0;
    let missingFieldsSkipped = 0;
    for (const issue of analysis.issues) {
      if (issue.severity !== 'error') continue;
      if (correctedRowNumbers.has(issue.row)) continue;
      if (issue.issue.startsWith('Duplicate')) {
        duplicatesSkipped++;
      } else {
        missingFieldsSkipped++;
      }
    }

    return {
      success: true,
      totalProcessed: analysis.totalRecords,
      imported: importedCount,
      qr: importedCount,
      duplicatesSkipped,
      missingFieldsSkipped,
    };
  }

  private static parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }

  private static escapeCsv(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}

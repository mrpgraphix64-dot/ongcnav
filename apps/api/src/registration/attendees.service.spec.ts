import { Test, TestingModule } from '@nestjs/testing';
import { AttendeesService } from './attendees.service';
import { PrismaService } from '../prisma/prisma.service';
import { AttendeeStatus, EmployeeCategory, RegistrationType } from '@ongc/shared-types';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('AttendeesService Parity & Functional Tests', () => {
  let service: AttendeesService;
  let prisma: any;

  const mockAttendee = {
    id: BigInt(1),
    registrationType: RegistrationType.EMPLOYEE,
    name: 'Suresh Patel',
    mobile: '9876543210',
    email: 'suresh@ongc.co.in',
    ticketNumber: 'NR2026-000001',
    qrCodeToken: 'test-token-64-characters-0000000000000000000000000000000000000000',
    category: 'ONGC STAFF',
    employeeId: BigInt(10),
    familyMemberId: null,
    status: AttendeeStatus.ACTIVE,
    createdAt: new Date('2026-09-24T10:00:00Z'),
    updatedAt: new Date('2026-09-24T10:00:00Z'),
    employee: {
      id: BigInt(10),
      cpf: 'CPF-1001',
      name: 'Suresh Patel',
      phone: '9876543210',
      designation: 'Chief Engineer',
      department: 'Operations',
      employeeCategory: EmployeeCategory.RETIRED,
      bookingDays: ['2026-09-24'],
      photoPath: null,
    },
    dailyCheckins: [
      {
        id: BigInt(50),
        eventDate: '2026-09-24',
        checkinTime: new Date('2026-09-24T10:30:00Z'),
        status: 'SUCCESS',
        gate: { id: BigInt(1), name: 'Main Gate' },
      },
    ],
  };

  const mockFamilyAttendee = {
    id: BigInt(2),
    registrationType: RegistrationType.EMPLOYEE,
    name: 'Meena Patel',
    mobile: '9876543211',
    email: null,
    ticketNumber: 'NR2026-000002',
    qrCodeToken: 'family-token-64-characters-0000000000000000000000000000000000000',
    category: 'FAMILY MEMBER',
    employeeId: BigInt(10),
    familyMemberId: BigInt(5),
    status: AttendeeStatus.ACTIVE,
    familyMember: {
      id: BigInt(5),
      name: 'Meena Patel',
      relation: 'Spouse',
      age: 38,
      gender: 'Female',
    },
    dailyCheckins: [],
  };

  beforeEach(async () => {
    prisma = {
      employee: {
        count: jest.fn().mockResolvedValue(10),
        findUnique: jest.fn().mockResolvedValue({ id: BigInt(10), photoPath: 'photos/emp10.jpg' }),
      },
      commercialOrder: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      attendee: {
        groupBy: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockImplementation(({ where }: any = {}) => {
          if (where?.employeeId === null && where?.orderId === null) return Promise.resolve(2);
          if (where?.employeeId === null) return Promise.resolve(2);
          if (where?.category === 'ONGC STAFF') return Promise.resolve(10);
          if (where?.category === 'FAMILY MEMBER') return Promise.resolve(15);
          return Promise.resolve(25);
        }),
        findMany: jest.fn().mockImplementation(({ where }: any = {}) => {
          if (where?.familyMemberId?.not !== undefined) {
            return Promise.resolve([mockFamilyAttendee]);
          }
          return Promise.resolve([mockAttendee]);
        }),
        findUnique: jest.fn().mockImplementation(({ where }: any = {}) => {
          if (where?.id === BigInt(1)) return Promise.resolve(mockAttendee);
          if (where?.ticketNumber === 'NR2026-000001') return Promise.resolve(mockAttendee);
          return Promise.resolve(null);
        }),
        findFirst: jest.fn().mockImplementation(({ where }: any = {}) => {
          if (where?.OR?.[0]?.mobile === '9999999999') return Promise.resolve(mockAttendee);
          return Promise.resolve(null);
        }),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: BigInt(101),
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
            dailyCheckins: [],
          }),
        ),
        update: jest.fn().mockImplementation(({ where, data }) =>
          Promise.resolve({
            ...mockAttendee,
            ...data,
            id: where.id,
          }),
        ),
        delete: jest.fn().mockResolvedValue(mockAttendee),
        deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      dailyCheckin: {
        count: jest.fn().mockResolvedValue(5),
      },
      $transaction: jest.fn().mockImplementation(async (cb) => {
        if (typeof cb === 'function') return cb(prisma);
        return Promise.all(cb);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendeesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AttendeesService>(AttendeesService);
  });

  describe('index', () => {
    it('returns summary metrics, primary attendees, and attached family passes', async () => {
      const res = await service.index({ page: 1, limit: 10 });
      expect(res.metrics).toBeDefined();
      expect(res.metrics.total_people).toBe(25);
      expect(res.primaryAttendees).toHaveLength(1);

      const primary = res.primaryAttendees[0];
      expect(primary.ticketNumber).toBe('NR2026-000001');
      expect(primary.status).toBe('checked_in');
      expect(primary.family_tickets).toHaveLength(1);
      expect(primary.family_tickets[0].name).toBe('Meena Patel');
    });

    it('exposes the employee category in the admin attendee listing', async () => {
      const res = await service.index({ page: 1, limit: 10 });
      expect(res.primaryAttendees[0].employee?.employeeCategory).toBe(EmployeeCategory.RETIRED);
    });

    it('exposes registrationType in the attendee listing', async () => {
      const res = await service.index({ page: 1, limit: 10 });
      expect(res.primaryAttendees[0].registrationType).toBe(RegistrationType.EMPLOYEE);
      expect(res.primaryAttendees[0].family_tickets[0].registrationType).toBe(RegistrationType.EMPLOYEE);
    });

    it('isolates REGISTRATION_STAFF to employee-only records with zero commercial orders', async () => {
      const res = await service.index({ page: 1, limit: 10 }, 'REGISTRATION_STAFF');
      expect(res.metrics.total_commercial_orders).toBe(0);
      expect(prisma.attendee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            orderId: null,
            employeeId: { not: null },
          }),
        }),
      );
    });

    it('throws ForbiddenException when EVENT_ADMIN attempts to access attendee PII', async () => {
      await expect(service.index({ page: 1, limit: 10 }, 'EVENT_ADMIN')).rejects.toThrow(
        'EVENT_ADMIN is not permitted to access attendee or employee personal information.',
      );
    });
  });

  describe('createQuickAttendee', () => {
    it('creates standalone attendee with sequential ticket, 64-char QR token, and normalized email', async () => {
      const res = await service.createQuickAttendee({
        name: 'Anita Roy',
        mobile: '9822334455',
        email: 'ANITA.ROY@example.com',
        category: 'General',
      });

      expect(res.success).toBe(true);
      expect(res.attendee.ticketNumber).toBeDefined();
      expect(res.attendee.qrCodeToken).toHaveLength(64);
      expect(res.attendee.name).toBe('Anita Roy');
      expect(res.attendee.email).toBe('anita.roy@example.com');
      expect(res.attendee.employeeId).toBeUndefined();
    });

    it('rejects missing email address', async () => {
      await expect(
        service.createQuickAttendee({
          name: 'No Email',
          mobile: '9822334455',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects invalid email address', async () => {
      await expect(
        service.createQuickAttendee({
          name: 'Bad Email',
          mobile: '9822334455',
          email: 'not-an-email',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects invalid mobile number', async () => {
      await expect(
        service.createQuickAttendee({
          name: 'Invalid',
          mobile: '12345',
          email: 'valid@example.com',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects duplicate mobile number', async () => {
      await expect(
        service.createQuickAttendee({
          name: 'Duplicate Phone',
          mobile: '9999999999',
          email: 'duplicate@example.com',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('analyzeCsv', () => {
    it('validates CSV rows and classifies issues accurately including mandatory email', async () => {
      // Use mobiles not in mockAttendee (mockAttendee has 9876543210)
      const csv = `Name,Mobile,Email,Category
Ramesh Kumar,9811223344,ramesh@ongc.co.in,General
,9822334455,invalid@ongc.co.in,VIP
Sunita Rao,1234,sunita@ongc.co.in,General
Arun Verma,9833445566,arun@ongc.co.in,Unknown
Missing Mail,9844556677,,General
Bad Mail,9855667788,not-an-email,General`;

      const result = await service.analyzeCsv(csv);
      expect(result.totalRecords).toBe(6);
      expect(result.validRecords).toBe(2); // row 1, row 4 (defaulted category)
      expect(result.missingFieldsRecords).toBe(4); // row 2 (missing name), row 3 (invalid mobile), row 5 (missing email), row 6 (invalid email)
      expect(result.errorBreakdown.missing_name).toBe(1);
      expect(result.errorBreakdown.invalid_mobile).toBe(1);
      expect(result.errorBreakdown.missing_category).toBe(1);
      expect(result.errorBreakdown.missing_email).toBe(1);
      expect(result.errorBreakdown.invalid_email).toBe(1);
    });
  });

  describe('importCsv', () => {
    it('imports valid rows in database transaction and returns summary', async () => {
      const csv = `Name,Mobile,Email,Category
Deepak Joshi,9871122334,deepak@ongc.co.in,VIP
Pooja Jain,9872233445,pooja@ongc.co.in,General`;

      const result = await service.importCsv(csv);
      expect(result.success).toBe(true);
      expect(result.imported).toBe(2);
      expect(result.qr).toBe(2);
      expect(prisma.attendee.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('regenerateQr', () => {
    it('generates a fresh 64-char hex QR code token', async () => {
      const res = await service.regenerateQr(BigInt(1));
      expect(res.success).toBe(true);
      expect(res.token).toHaveLength(64);
      expect(res.qr_svg).toBeDefined();
    });
  });

  describe('statusSync', () => {
    it('returns real-time checkin status and total counts', async () => {
      const res = await service.statusSync([BigInt(1)]);
      expect(res.statuses['1']).toBeDefined();
      expect(res.statuses['1'].status).toBe('checked_in');
      expect(res.statuses['1'].gate).toBe('Main Gate');
      expect(res.counts.total).toBe(25);
    });
  });

  describe('Commercial Order Grouping', () => {
    it('groups 10 commercial passes under 1 parent booking group with unique ticket IDs', async () => {
      const mockOrder = {
        id: BigInt(500),
        orderNumber: 'ORD-COMM-500',
        customerName: 'Karan Mehra',
        customerMobile: '9899887766',
        customerEmail: 'karan@example.com',
        ticketType: 'MANDLI',
        quantity: 10,
        unitPricePaise: 14900,
        amountPaise: 149000,
        orderStatus: 'PAID',
        paymentStatus: 'PAID',
        selectedDates: ['2026-10-11'],
        paidAt: new Date('2026-09-24T12:00:00Z'),
      };

      const mockTenPasses = Array.from({ length: 10 }, (_, i) => ({
        id: BigInt(1000 + i + 1),
        registrationType: RegistrationType.COMMERCIAL,
        name: 'Karan Mehra',
        mobile: '9899887766',
        email: 'karan@example.com',
        ticketNumber: `TK-COMM-500-${i + 1}`,
        qrCodeToken: `mock-qr-token-for-pass-${i + 1}-0000000000000000000000000000000000000`,
        category: 'Mandli Pass',
        orderId: BigInt(500),
        employeeId: null,
        familyMemberId: null,
        status: AttendeeStatus.ACTIVE,
        bookingDays: ['2026-10-11'],
        createdAt: new Date('2026-09-24T12:00:00Z'),
        dailyCheckins: i === 0 ? [{ id: BigInt(99), checkinTime: new Date(), gate: { name: 'VIP Gate' } }] : [],
        order: mockOrder,
      }));

      prisma.attendee.findMany = jest.fn().mockImplementation(({ where }: any = {}) => {
        if (where?.orderId?.in) {
          return Promise.resolve(mockTenPasses);
        }
        // Primary records return lead attendee only
        return Promise.resolve([mockTenPasses[0]]);
      });

      prisma.commercialOrder.count = jest.fn().mockResolvedValue(1);

      const res = await service.index({ page: 1, limit: 10 });
      expect(res.primaryAttendees).toHaveLength(1);

      const parentBooking = res.primaryAttendees[0];
      expect(parentBooking.isCommercialOrder).toBe(true);
      expect(parentBooking.name).toBe('Karan Mehra');
      expect(parentBooking.ticketNumber).toBe('ORD-COMM-500');
      expect(parentBooking.order?.orderNumber).toBe('ORD-COMM-500');
      expect(parentBooking.order?.amountInr).toBe(1490);
      expect(parentBooking.order?.orderStatus).toBe('PAID');
      expect(parentBooking.passes).toHaveLength(10);
      expect(parentBooking.family_tickets).toHaveLength(10);

      // Verify each pass retains its individual ticket ID and tokens
      const ticketNumbers = parentBooking.passes!.map((p) => p.ticketNumber);
      const uniqueTickets = new Set(ticketNumbers);
      expect(uniqueTickets.size).toBe(10);
      expect(ticketNumbers[0]).toBe('TK-COMM-500-1');
      expect(ticketNumbers[9]).toBe('TK-COMM-500-10');
      expect(parentBooking.passes![0].status).toBe('checked_in');
      expect(parentBooking.passes![1].status).toBe('active');
    });

    it('keeps 2 separate orders from same customer as 2 separate booking groups', async () => {
      const order1 = {
        id: BigInt(501),
        orderNumber: 'ORD-COMM-501',
        customerName: 'Ravi Shah',
        customerMobile: '9811122233',
        customerEmail: 'ravi@example.com',
        ticketType: 'DAILY',
        quantity: 2,
        amountPaise: 49800,
        orderStatus: 'PAID',
        paymentStatus: 'PAID',
        selectedDates: ['2026-10-11'],
      };

      const order2 = {
        id: BigInt(502),
        orderNumber: 'ORD-COMM-502',
        customerName: 'Ravi Shah',
        customerMobile: '9811122233',
        customerEmail: 'ravi@example.com',
        ticketType: 'SEASON',
        quantity: 1,
        amountPaise: 99900,
        orderStatus: 'PAID',
        paymentStatus: 'PAID',
        selectedDates: ['2026-10-11', '2026-10-12'],
      };

      const leadPass1 = {
        id: BigInt(2001),
        registrationType: RegistrationType.COMMERCIAL,
        name: 'Ravi Shah',
        mobile: '9811122233',
        email: 'ravi@example.com',
        ticketNumber: 'TK-COMM-501-1',
        qrCodeToken: 'qr-token-2001-000000000000000000000000000000000000000000000000000000',
        category: 'Daily Pass',
        orderId: BigInt(501),
        status: AttendeeStatus.ACTIVE,
        dailyCheckins: [],
        order: order1,
      };

      const leadPass2 = {
        id: BigInt(2003),
        registrationType: RegistrationType.COMMERCIAL,
        name: 'Ravi Shah',
        mobile: '9811122233',
        email: 'ravi@example.com',
        ticketNumber: 'TK-COMM-502-1',
        qrCodeToken: 'qr-token-2003-000000000000000000000000000000000000000000000000000000',
        category: 'Season Pass',
        orderId: BigInt(502),
        status: AttendeeStatus.ACTIVE,
        dailyCheckins: [],
        order: order2,
      };

      prisma.attendee.findMany = jest.fn().mockImplementation(({ where }: any = {}) => {
        if (where?.orderId?.in) {
          return Promise.resolve([leadPass1, leadPass2]);
        }
        return Promise.resolve([leadPass1, leadPass2]);
      });

      const res = await service.index({ page: 1, limit: 10 });
      expect(res.primaryAttendees).toHaveLength(2);
      expect(res.primaryAttendees[0].order?.orderNumber).toBe('ORD-COMM-501');
      expect(res.primaryAttendees[1].order?.orderNumber).toBe('ORD-COMM-502');
    });

    it('handles historical records with email: null without crashing index mapping', async () => {
      const historicalAttendee = {
        ...mockAttendee,
        email: null,
      };

      prisma.attendee.findMany = jest.fn().mockImplementation(({ where }: any = {}) => {
        if (where?.familyMemberId?.not !== undefined) {
          return Promise.resolve([]);
        }
        return Promise.resolve([historicalAttendee]);
      });

      const res = await service.index({ page: 1, limit: 10 });
      expect(res.primaryAttendees).toHaveLength(1);
      expect(res.primaryAttendees[0].email).toBeFalsy();
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { AttendeesService } from './attendees.service';
import { PrismaService } from '../prisma/prisma.service';
import { AttendeeStatus, EmployeeCategory, OrderStatus, PaymentStatus, RegistrationType, UserRole } from '@ongc/shared-types';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  isAdminTestDataDeleteEnabled,
  isStagingTestOrder,
} from '../commercial/commercial-test-payment.util';

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
        delete: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
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
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      dailyCheckin: {
        count: jest.fn().mockResolvedValue(5),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      scanLog: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: BigInt(1) }),
      },
      paymentWebhookEvent: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      allocationEvent: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
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

  describe('Temporary SUPER_ADMIN Test-Data Deletion & Safety Mode', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalFlag = process.env.ADMIN_TEST_DATA_DELETE_ENABLED;

    afterEach(() => {
      process.env.NODE_ENV = originalNodeEnv;
      process.env.ADMIN_TEST_DATA_DELETE_ENABLED = originalFlag;
      jest.clearAllMocks();
    });

    describe('Security Helpers & Classification', () => {
      it('isAdminTestDataDeleteEnabled enforces strict production failsafe', () => {
        expect(isAdminTestDataDeleteEnabled('production', 'true')).toBe(false);
        expect(isAdminTestDataDeleteEnabled('staging', 'false')).toBe(false);
        expect(isAdminTestDataDeleteEnabled('staging', 'true')).toBe(true);
        expect(isAdminTestDataDeleteEnabled('development', 'true')).toBe(true);
        expect(isAdminTestDataDeleteEnabled('test', 'true')).toBe(true);
      });

      it('isStagingTestAttendee strictly rejects employee and real passes', () => {
        const employeeAtt = {
          id: BigInt(10),
          registrationType: RegistrationType.EMPLOYEE,
          employeeId: BigInt(5),
          order: null,
        };
        expect(service.isStagingTestAttendee(employeeAtt)).toBe(false);

        const familyAtt = {
          id: BigInt(11),
          registrationType: RegistrationType.COMMERCIAL,
          familyMemberId: BigInt(7),
          order: null,
        };
        expect(service.isStagingTestAttendee(familyAtt)).toBe(false);

        const realCommercialAtt = {
          id: BigInt(12),
          registrationType: RegistrationType.COMMERCIAL,
          order: {
            id: BigInt(100),
            orderNumber: 'ORD-REAL-001',
            orderStatus: OrderStatus.PAID,
            paymentStatus: PaymentStatus.CAPTURED,
            razorpayPaymentId: 'pay_live_real_12345',
            metadata: {},
          },
        };
        expect(service.isStagingTestAttendee(realCommercialAtt)).toBe(false);

        const testCommercialAtt = {
          id: BigInt(13),
          registrationType: RegistrationType.COMMERCIAL,
          order: {
            id: BigInt(101),
            orderNumber: 'ORD-TEST-001',
            orderStatus: OrderStatus.PAID,
            paymentStatus: PaymentStatus.CAPTURED,
            razorpayPaymentId: 'TEST_PAY_12345',
            metadata: { isTestPayment: true, testMode: 'STAGING_TEST_PAYMENT' },
          },
        };
        expect(service.isStagingTestAttendee(testCommercialAtt)).toBe(true);
      });
    });

    describe('Single Attendee Deletion (destroy)', () => {
      const mockTestOrder = {
        id: BigInt(700),
        orderNumber: 'ORD-TEST-700',
        orderStatus: OrderStatus.PAID,
        paymentStatus: PaymentStatus.CAPTURED,
        razorpayOrderId: 'TEST_ORD_700',
        razorpayPaymentId: 'TEST_PAY_700',
        metadata: { isTestPayment: true },
        amountPaise: 10000,
        quantity: 1,
        ticketType: 'DAILY',
        customerName: 'Test Buyer',
        customerMobile: '9988776655',
        customerEmail: 'test@example.com',
      };

      const mockTestAttendee = {
        id: BigInt(701),
        registrationType: RegistrationType.COMMERCIAL,
        name: 'Test Buyer',
        mobile: '9988776655',
        email: 'test@example.com',
        ticketNumber: 'TK-TEST-701',
        qrCodeToken: 'test-token-do-not-log-raw',
        category: 'Daily Pass',
        orderId: BigInt(700),
        employeeId: null,
        familyMemberId: null,
        status: AttendeeStatus.ACTIVE,
        dailyCheckins: [{ id: BigInt(1) }],
        scanLogs: [{ id: BigInt(2) }],
        order: mockTestOrder,
      };

      it('allows SUPER_ADMIN to permanently delete a staging test attendee with cascade cleanup and safe audit log', async () => {
        process.env.NODE_ENV = 'staging';
        process.env.ADMIN_TEST_DATA_DELETE_ENABLED = 'true';

        prisma.attendee.findUnique.mockResolvedValueOnce(mockTestAttendee);
        prisma.attendee.count.mockResolvedValueOnce(0); // 0 remaining attendees for order 700

        const res = await service.destroy(BigInt(701), { id: BigInt(99), role: UserRole.SUPER_ADMIN });

        expect(res.success).toBe(true);
        expect(res.action).toBe('deleted');
        expect(res.isTestCleanup).toBe(true);

        // Verify cascade deletion of checkins and scans for this attendee
        expect(prisma.dailyCheckin.deleteMany).toHaveBeenCalledWith({
          where: { attendeeId: BigInt(701) },
        });
        expect(prisma.scanLog.deleteMany).toHaveBeenCalledWith({
          where: { attendeeId: BigInt(701) },
        });
        expect(prisma.attendee.delete).toHaveBeenCalledWith({
          where: { id: BigInt(701) },
        });

        // Verify order cleanup when 0 attendees remain
        expect(prisma.commercialOrder.delete).toHaveBeenCalledWith({
          where: { id: BigInt(700) },
        });

        // Verify safe audit log
        expect(prisma.auditLog.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              action: 'TEST_ATTENDEE_DELETED',
              details: expect.objectContaining({
                attendeeId: '701',
                ticketNumber: 'TK-TEST-701',
                orderNumber: 'ORD-TEST-700',
              }),
            }),
          }),
        );

        // Verify NO raw QR code tokens in audit log
        const auditCallArg = prisma.auditLog.create.mock.calls[0][0];
        expect(auditCallArg.data.details).not.toHaveProperty('qrCodeToken');
        expect(JSON.stringify(auditCallArg.data.details)).not.toContain('test-token-do-not-log-raw');
      });

      it('preserves sibling passes on the test order if other passes remain', async () => {
        process.env.NODE_ENV = 'staging';
        process.env.ADMIN_TEST_DATA_DELETE_ENABLED = 'true';

        prisma.attendee.findUnique.mockResolvedValueOnce(mockTestAttendee);
        // Sibling safety: 2 attendees remain for this order!
        prisma.attendee.count.mockResolvedValueOnce(2);

        const res = await service.destroy(BigInt(701), { id: BigInt(99), role: UserRole.SUPER_ADMIN });

        expect(res.success).toBe(true);
        expect(prisma.attendee.delete).toHaveBeenCalledWith({ where: { id: BigInt(701) } });
        // Order must NOT be deleted because siblings remain
        expect(prisma.commercialOrder.delete).not.toHaveBeenCalled();
      });

      it('never deletes employee attendee via test bypass even if SUPER_ADMIN and flag is true', async () => {
        process.env.NODE_ENV = 'staging';
        process.env.ADMIN_TEST_DATA_DELETE_ENABLED = 'true';

        const employeeWithCheckin = {
          id: BigInt(801),
          registrationType: RegistrationType.EMPLOYEE,
          name: 'Employee John',
          ticketNumber: 'TK-EMP-801',
          employeeId: BigInt(50),
          familyMemberId: null,
          dailyCheckins: [{ id: BigInt(1) }],
          scanLogs: [],
          order: null,
        };

        prisma.attendee.findUnique.mockResolvedValueOnce(employeeWithCheckin);

        // For employee with historical checkin, SUPER_ADMIN revokes to preserve history, never permanently deletes
        const res = await service.destroy(BigInt(801), { id: BigInt(99), role: UserRole.SUPER_ADMIN });

        expect(res.action).toBe('revoked');
        expect(prisma.attendee.update).toHaveBeenCalledWith({
          where: { id: BigInt(801) },
          data: { status: AttendeeStatus.REVOKED },
        });
        expect(prisma.attendee.delete).not.toHaveBeenCalled();
      });

      it('rejects deletion of protected records for non-SUPER_ADMIN', async () => {
        process.env.NODE_ENV = 'staging';
        process.env.ADMIN_TEST_DATA_DELETE_ENABLED = 'true';

        prisma.attendee.findUnique.mockResolvedValueOnce(mockTestAttendee);

        await expect(
          service.destroy(BigInt(701), { id: BigInt(88), role: UserRole.EMPLOYEE_ADMIN }),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('Bulk Attendee Deletion (bulkDestroy)', () => {
      const testOrder = {
        id: BigInt(900),
        orderNumber: 'ORD-TEST-900',
        orderStatus: OrderStatus.PAID,
        paymentStatus: PaymentStatus.CAPTURED,
        razorpayPaymentId: 'TEST_PAY_900',
        metadata: { isTestPayment: true },
      };

      const testAtt1 = {
        id: BigInt(901),
        registrationType: RegistrationType.COMMERCIAL,
        name: 'Test Pass 1',
        ticketNumber: 'TK-TEST-901',
        qrCodeToken: 'secret-token-901',
        orderId: BigInt(900),
        order: testOrder,
        dailyCheckins: [{ id: BigInt(1) }],
        scanLogs: [{ id: BigInt(2) }],
      };

      const testAtt2 = {
        id: BigInt(902),
        registrationType: RegistrationType.COMMERCIAL,
        name: 'Test Pass 2',
        ticketNumber: 'TK-TEST-902',
        qrCodeToken: 'secret-token-902',
        orderId: BigInt(900),
        order: testOrder,
        dailyCheckins: [],
        scanLogs: [],
      };

      const realOrder = {
        id: BigInt(950),
        orderNumber: 'ORD-REAL-950',
        orderStatus: OrderStatus.PAID,
        paymentStatus: PaymentStatus.CAPTURED,
        razorpayPaymentId: 'pay_live_950',
        metadata: {},
      };

      const realPaidAtt = {
        id: BigInt(951),
        registrationType: RegistrationType.COMMERCIAL,
        name: 'Real Customer',
        ticketNumber: 'TK-REAL-951',
        qrCodeToken: 'secret-token-951',
        orderId: BigInt(950),
        order: realOrder,
        dailyCheckins: [{ id: BigInt(3) }],
        scanLogs: [],
      };

      const employeeAtt = {
        id: BigInt(960),
        registrationType: RegistrationType.EMPLOYEE,
        name: 'Staff Member',
        ticketNumber: 'TK-EMP-960',
        employeeId: BigInt(70),
        familyMemberId: null,
        order: null,
        dailyCheckins: [{ id: BigInt(4) }],
        scanLogs: [],
      };

      it('bulk deletes test passes while preserving real customer and staff records completely untouched', async () => {
        process.env.NODE_ENV = 'staging';
        process.env.ADMIN_TEST_DATA_DELETE_ENABLED = 'true';

        prisma.attendee.findMany.mockResolvedValueOnce([testAtt1, testAtt2, realPaidAtt, employeeAtt]);
        prisma.attendee.count.mockResolvedValue(0); // All passes of testOrder 900 are deleted

        const res = await service.bulkDestroy(
          [BigInt(901), BigInt(902), BigInt(951), BigInt(960)],
          { id: BigInt(99), role: UserRole.SUPER_ADMIN },
        );

        expect(res.success).toBe(true);
        expect(res.totalSelected).toBe(4);
        expect(res.testDeletedCount).toBe(2);
        expect(res.deletedCount).toBe(2);
        expect(res.protectedCount).toBe(2);

        // Verify test passes deleted
        expect(prisma.attendee.deleteMany).toHaveBeenCalledWith({
          where: { id: { in: [BigInt(901), BigInt(902)] } },
        });

        // Verify cascade checkins/scans deleted for test passes only
        expect(prisma.dailyCheckin.deleteMany).toHaveBeenCalledWith({
          where: { attendeeId: { in: [BigInt(901), BigInt(902)] } },
        });

        // Real customer and employee records must NEVER be updated or revoked during staging test cleanup
        expect(prisma.attendee.updateMany).not.toHaveBeenCalled();

        // Protected tickets must be reported clearly in the result
        expect(res.protectedTickets).toHaveLength(2);
        expect(res.protectedTickets[0].ticketNumber).toBe('TK-REAL-951');
        expect(res.protectedTickets[1].ticketNumber).toBe('TK-EMP-960');
      });

      it('in production or with flag false, test bypass does NOT run and preserves safety', async () => {
        process.env.NODE_ENV = 'production';
        process.env.ADMIN_TEST_DATA_DELETE_ENABLED = 'false';

        prisma.attendee.findMany.mockResolvedValueOnce([testAtt1]);

        const res = await service.bulkDestroy([BigInt(901)], {
          id: BigInt(99),
          role: UserRole.SUPER_ADMIN,
        });

        // When test delete is NOT active, testAtt1 is treated as protected due to checkin history
        expect(prisma.attendee.deleteMany).not.toHaveBeenCalled();
        expect(prisma.attendee.updateMany).toHaveBeenCalledWith({
          where: { id: { in: [BigInt(901)] } },
          data: { status: AttendeeStatus.REVOKED },
        });
      });
    });
  });
});

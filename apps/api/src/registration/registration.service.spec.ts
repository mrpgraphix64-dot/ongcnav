import { Test, TestingModule } from '@nestjs/testing';
import { RegistrationService } from './registration.service';
import { PrismaService } from '../prisma/prisma.service';
import { AttendeeStatus, EmployeeCategory, RegistrationType } from '@ongc/shared-types';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

describe('RegistrationService', () => {
  let service: RegistrationService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      employee: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
      setting: { findUnique: jest.fn().mockResolvedValue(null) },
      attendee: { create: jest.fn(), findFirst: jest.fn() },
      familyMember: { create: jest.fn() },
      dailyEmployeePass: { findUnique: jest.fn() },
      referenceSequence: { upsert: jest.fn().mockResolvedValue({ currentValue: BigInt(1) }) },
      ongcEmployeeMaster: { count: jest.fn().mockResolvedValue(0), findUnique: jest.fn() },
      $transaction: jest.fn().mockImplementation(async (callback: any) => callback(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [RegistrationService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<RegistrationService>(RegistrationService);
  });

  describe('register', () => {
    const baseDto = {
      cpf: '12345',
      name: 'Amit Sharma',
      designation: 'ONGC Employee',
      department: 'EWC Ahmedabad',
      phone: '9876543210',
      email: 'amit@ongc.co.in',
      employeeCategory: EmployeeCategory.REGULAR,
      dateOfBirth: '1988-05-12',
      dateOfJoining: '2015-09-01',
      guidelinesAccepted: true,
      guidelinesAcceptedAt: '2026-10-03T12:00:00.000Z',
      guidelinesVersion: '2026-employee-registration-v1',
      bookingDays: ['2026-10-11', '2026-10-12'],
      familyMembers: [
        { name: 'Sunita Sharma', relation: 'Spouse', phone: '9876543211', email: 'sunita@example.com', dateOfBirth: '1990-01-01', bookingDays: ['2026-10-13'] },
        { name: 'Rohan Sharma', relation: 'Son', phone: '9876543212', email: 'rohan@example.com', dateOfBirth: '2015-05-20', bookingDays: ['2026-10-14', '2026-10-15'] },
      ],
    };

    beforeEach(() => {
      prisma.employee.findUnique.mockResolvedValue(null); // not already registered
      prisma.employee.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: BigInt(1), ...data }),
      );
      let attendeeSeq = 100;
      prisma.attendee.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: BigInt(attendeeSeq++), ...data }),
      );
      let familySeq = 200;
      prisma.familyMember.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: BigInt(familySeq++), ...data }),
      );
    });

    it('rejects registration for a CPF that already exists', async () => {
      prisma.employee.findUnique.mockResolvedValue({ id: BigInt(1) });
      await expect(service.register(baseDto as any)).rejects.toThrow(ConflictException);
    });

    it('stores the employee category on the employee record', async () => {
      await service.register(baseDto as any);
      expect(prisma.employee.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ employeeCategory: EmployeeCategory.REGULAR }),
        }),
      );
    });

    it.each([EmployeeCategory.REGULAR, EmployeeCategory.RETIRED, EmployeeCategory.CONTRACT])(
      'correctly persists %s as the stored category, independent of the other two',
      async (cat) => {
        await service.register({ ...baseDto, employeeCategory: cat } as any);
        expect(prisma.employee.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ employeeCategory: cat }),
          }),
        );
      },
    );

    it("stores the employee's own bookingDays on the employee's attendee record", async () => {
      await service.register(baseDto as any);
      const employeeAttendeeCall = prisma.attendee.create.mock.calls.find(
        (c: any) => c[0].data.familyMemberId === undefined,
      );
      expect(employeeAttendeeCall[0].data.bookingDays).toEqual(['2026-10-11', '2026-10-12']);
    });

    it('gives each family member their own independent bookingDays, not the employee’s or each other’s', async () => {
      await service.register(baseDto as any);

      const familyAttendeeCalls = prisma.attendee.create.mock.calls.filter(
        (c: any) => c[0].data.familyMemberId !== undefined,
      );
      expect(familyAttendeeCalls).toHaveLength(2);
      expect(familyAttendeeCalls[0][0].data.bookingDays).toEqual(['2026-10-13']);
      expect(familyAttendeeCalls[1][0].data.bookingDays).toEqual(['2026-10-14', '2026-10-15']);
    });

    it("stores each family member's own mobile number, never falling back to the employee's", async () => {
      await service.register(baseDto as any);

      const familyCreateCalls = prisma.familyMember.create.mock.calls;
      expect(familyCreateCalls[0][0].data.phone).toBe('9876543211');
      expect(familyCreateCalls[1][0].data.phone).toBe('9876543212');
    });

    it('stores the employee photo path on the employee record', async () => {
      await service.register(baseDto as any, 'storage/private/employee_photos/photo-1.jpg');
      expect(prisma.employee.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ photoPath: 'storage/private/employee_photos/photo-1.jpg' }),
        }),
      );
    });

    it('stores each family photo against the correct family member by index, tolerating gaps', async () => {
      await service.register(baseDto as any, undefined, [
        undefined, // Sunita has no photo
        'storage/private/family_photos/familyPhoto_1-123.jpg', // Rohan has one
      ]);

      const familyCreateCalls = prisma.familyMember.create.mock.calls;
      expect(familyCreateCalls[0][0].data.photoPath).toBeNull();
      expect(familyCreateCalls[1][0].data.photoPath).toBe('storage/private/family_photos/familyPhoto_1-123.jpg');
    });

    it('stores RegistrationType.EMPLOYEE on both employee and family member attendees', async () => {
      await service.register(baseDto as any);

      const attendeeCalls = prisma.attendee.create.mock.calls;
      expect(attendeeCalls.length).toBe(3); // 1 employee + 2 family
      attendeeCalls.forEach((call: any) => {
        expect(call[0].data.registrationType).toBe(RegistrationType.EMPLOYEE);
      });
    });

    it('assigns sequential reference number ONGC-00001 to registered employee', async () => {
      const res = await service.register(baseDto as any);
      expect(prisma.employee.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ referenceNumber: 'ONGC-00001' }),
        }),
      );
      expect(res.data.employee.referenceNumber).toBe('ONGC-00001');
    });

    it('rejects employee registration if CPF is not strictly 5 numeric digits', async () => {
      await expect(service.register({ ...baseDto, cpf: '1234' } as any)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.register({ ...baseDto, cpf: '123456' } as any)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.register({ ...baseDto, cpf: '12A45' } as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects employee registration if more than 3 family members are submitted', async () => {
      const fourFamily = [
        { name: 'Member 1', relation: 'Spouse', phone: '9876543211', email: 'm1@example.com', dateOfBirth: '1990-01-01', bookingDays: ['2026-10-11'] },
        { name: 'Member 2', relation: 'Son', phone: '9876543212', email: 'm2@example.com', dateOfBirth: '2012-02-02', bookingDays: ['2026-10-12'] },
        { name: 'Member 3', relation: 'Daughter', phone: '9876543213', email: 'm3@example.com', dateOfBirth: '2014-03-03', bookingDays: ['2026-10-13'] },
        { name: 'Member 4', relation: 'Parent', phone: '9876543214', email: 'm4@example.com', dateOfBirth: '1960-04-04', bookingDays: ['2026-10-14'] },
      ];
      await expect(service.register({ ...baseDto, familyMembers: fourFamily } as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects employee registration if family member email is missing or empty', async () => {
      const invalidFamily = [
        { name: 'Member 1', relation: 'Spouse', phone: '9876543211', email: '', dateOfBirth: '1990-01-01', bookingDays: ['2026-10-11'] },
      ];
      await expect(service.register({ ...baseDto, familyMembers: invalidFamily } as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('stores email for family members on both familyMember and attendee records', async () => {
      await service.register(baseDto as any);
      expect(prisma.familyMember.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: 'sunita@example.com' }),
        }),
      );
    });

    it('persists employee DOB, DOJ, guidelinesAcceptedAt, and guidelinesVersion', async () => {
      await service.register(baseDto as any);
      expect(prisma.employee.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            dateOfBirth: expect.any(Date),
            dateOfJoining: expect.any(Date),
            guidelinesAcceptedAt: expect.any(Date),
            guidelinesVersion: '2026-employee-registration-v1',
          }),
        }),
      );
    });

    it('rejects employee registration if employee dateOfBirth is in the future', async () => {
      const futureDate = '2099-01-01';
      await expect(
        service.register({ ...baseDto, dateOfBirth: futureDate } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects employee registration if employee dateOfJoining is in the future', async () => {
      const futureDate = '2099-01-01';
      await expect(
        service.register({ ...baseDto, dateOfJoining: futureDate } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects employee registration if employee dateOfJoining is before dateOfBirth', async () => {
      await expect(
        service.register({
          ...baseDto,
          dateOfBirth: '1995-05-10',
          dateOfJoining: '1990-01-01',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects employee registration if guidelines are not accepted', async () => {
      await expect(
        service.register({ ...baseDto, guidelinesAccepted: false } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('persists family member dateOfBirth in the database', async () => {
      await service.register(baseDto as any);
      expect(prisma.familyMember.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            dateOfBirth: expect.any(Date),
          }),
        }),
      );
    });

    it('rejects employee registration if family member dateOfBirth is in the future', async () => {
      const futureFamily = [
        {
          name: 'Sunita Sharma',
          relation: 'Spouse',
          phone: '9876543211',
          email: 'sunita@example.com',
          dateOfBirth: '2099-01-01',
          bookingDays: ['2026-10-13'],
        },
      ];
      await expect(
        service.register({ ...baseDto, familyMembers: futureFamily } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects employee registration if family member has empty bookingDays', async () => {
      const emptyDatesFamily = [
        {
          name: 'Sunita Sharma',
          relation: 'Spouse',
          phone: '9876543211',
          email: 'sunita@example.com',
          dateOfBirth: '1990-01-01',
          bookingDays: [],
        },
      ];
      await expect(
        service.register({ ...baseDto, familyMembers: emptyDatesFamily } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects employee registration if registrationType is incorrectly set to COMMERCIAL', async () => {
      await expect(
        service.register({ ...baseDto, registrationType: RegistrationType.COMMERCIAL } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects employee registration if registrationType is incorrectly set to FREE', async () => {
      await expect(
        service.register({ ...baseDto, registrationType: RegistrationType.FREE } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('commercial registration bypass removal', () => {
    it('no longer exposes a registerCommercial method (commercial passes require verified payment via CommercialService)', () => {
      expect((service as any).registerCommercial).toBeUndefined();
    });
  });

  describe('RegistrationType support (EMPLOYEE, COMMERCIAL, FREE)', () => {
    it('defines EMPLOYEE, COMMERCIAL, and FREE registration types in enum', () => {
      expect(RegistrationType.EMPLOYEE).toBe('EMPLOYEE');
      expect(RegistrationType.COMMERCIAL).toBe('COMMERCIAL');
      expect(RegistrationType.FREE).toBe('FREE');
    });

    it('supports storing FREE registration type on attendee without requiring employeeCategory', async () => {
      prisma.attendee.create.mockImplementationOnce(({ data }: any) =>
        Promise.resolve({ id: BigInt(999), ...data }),
      );

      const freeAttendee = await prisma.attendee.create({
        data: {
          registrationType: RegistrationType.FREE,
          name: 'VIP Guest',
          mobile: '9876543210',
          category: 'Free Pass',
          employeeId: null,
          familyMemberId: null,
          ticketNumber: 'TK-FREE-001',
          qrCodeToken: 'tok-free-001',
          status: AttendeeStatus.ACTIVE,
          bookingDays: ['2026-10-11'],
        },
      });

      expect(freeAttendee.registrationType).toBe(RegistrationType.FREE);
      expect(freeAttendee.employeeId).toBeNull();
    });
  });

  describe('findTicketByToken', () => {
    it("returns the attendee's own bookingDays, not the employee's shared legacy value", async () => {
      prisma.attendee = {
        ...prisma.attendee,
        findFirst: jest.fn().mockResolvedValue({
          id: BigInt(1),
          ticketNumber: 'TK-1',
          qrCodeToken: 'tok-1',
          status: AttendeeStatus.ACTIVE,
          familyMemberId: null,
          bookingDays: ['2026-10-11'],
          employee: {
            id: BigInt(1),
            name: 'Amit',
            designation: 'ONGC Employee',
            department: 'EWC',
            employeeCategory: EmployeeCategory.REGULAR,
            bookingDays: ['2026-09-23'], // legacy value, deliberately different
            photoPath: null,
          },
          familyMember: null,
          dailyCheckins: [],
        }),
      };

      const result = await service.findTicketByToken('tok-1');
      expect(result.bookingDays).toEqual(['2026-10-11']);
    });

    it.each([EmployeeCategory.REGULAR, EmployeeCategory.RETIRED, EmployeeCategory.CONTRACT])(
      'exposes the persisted %s category on ticket lookup, for admin/report visibility',
      async (cat) => {
        prisma.attendee = {
          ...prisma.attendee,
          findFirst: jest.fn().mockResolvedValue({
            id: BigInt(1),
            ticketNumber: 'TK-1',
            qrCodeToken: 'tok-1',
            status: AttendeeStatus.ACTIVE,
            familyMemberId: null,
            bookingDays: ['2026-10-11'],
            employee: {
              id: BigInt(1),
              name: 'Amit',
              designation: 'ONGC Employee',
              department: 'EWC',
              employeeCategory: cat,
              bookingDays: [],
              photoPath: null,
            },
            familyMember: null,
            dailyCheckins: [],
          }),
        };

        const result = await service.findTicketByToken('tok-1');
        expect(result.employee?.employeeCategory).toBe(cat);
      },
    );

    it('throws NotFoundException for an unknown token', async () => {
      prisma.attendee.findFirst = jest.fn().mockResolvedValue(null);
      await expect(service.findTicketByToken('missing')).rejects.toThrow(NotFoundException);
    });

    it('queries attendee strictly by qrCodeToken and never by ticketNumber', async () => {
      prisma.attendee.findFirst = jest.fn().mockResolvedValue(null);
      await expect(service.findTicketByToken('NR2026-000001')).rejects.toThrow(NotFoundException);
      expect(prisma.attendee.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { qrCodeToken: 'NR2026-000001' },
        }),
      );
    });

    it('does not expose employee CPF, internal employee ID, or check-in audit history on public lookup', async () => {
      prisma.attendee.findFirst = jest.fn().mockResolvedValue({
        id: BigInt(1),
        ticketNumber: 'TK-1',
        qrCodeToken: 'tok-1',
        status: AttendeeStatus.ACTIVE,
        familyMemberId: null,
        bookingDays: ['2026-10-11'],
        employee: {
          id: BigInt(999),
          cpf: 'SECRET_CPF_123',
          name: 'Amit',
          designation: 'ONGC Employee',
          department: 'EWC',
          employeeCategory: EmployeeCategory.REGULAR,
          bookingDays: ['2026-10-11'],
          photoPath: null,
        },
        familyMember: null,
      });

      const result = await service.findTicketByToken('tok-1');
      expect((result.employee as any).cpf).toBeUndefined();
      expect((result.employee as any).id).toBeUndefined();
      expect((result as any).checkins).toBeUndefined();
      expect(result.attendeeName).toBe('Amit');
      expect(result.ticketNumber).toBe('TK-1');
    });

    it('rejects empty or whitespace token with NotFoundException', async () => {
      await expect(service.findTicketByToken('')).rejects.toThrow(NotFoundException);
      await expect(service.findTicketByToken('   ')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByCpf', () => {
    const mockEmployee = {
      id: BigInt(1),
      cpf: 'CPF1',
      name: 'Amit',
      designation: 'ONGC Employee',
      department: 'EWC',
      employeeCategory: EmployeeCategory.REGULAR,
      phone: '9876543210',
      photoPath: null,
      bookingDays: ['2026-09-23'],
      familyMembers: [],
      attendees: [
        {
          id: BigInt(10),
          ticketNumber: 'TK-1',
          qrCodeToken: 'tok-1',
          status: AttendeeStatus.ACTIVE,
          familyMemberId: null,
          bookingDays: ['2026-10-11'],
          familyMember: null,
        },
        {
          id: BigInt(11),
          ticketNumber: 'TK-2',
          qrCodeToken: 'tok-2',
          status: AttendeeStatus.ACTIVE,
          familyMemberId: BigInt(5),
          bookingDays: ['2026-10-14'],
          familyMember: { name: 'Sunita', relation: 'Spouse', photoPath: null },
        },
      ],
    };

    it('rejects when CPF is empty or missing', async () => {
      await expect(service.findByCpf('', '3210')).rejects.toThrow(BadRequestException);
      await expect(service.findByCpf('   ', '3210')).rejects.toThrow(BadRequestException);
    });

    it('rejects when phone last 4 digits are missing or not provided', async () => {
      await expect(service.findByCpf('CPF1', '')).rejects.toThrow(BadRequestException);
      await expect(service.findByCpf('CPF1', '   ')).rejects.toThrow(BadRequestException);
    });

    it('rejects when phone last 4 digits are not exactly 4 digits', async () => {
      await expect(service.findByCpf('CPF1', '12')).rejects.toThrow(BadRequestException);
      await expect(service.findByCpf('CPF1', '12345')).rejects.toThrow(BadRequestException);
      await expect(service.findByCpf('CPF1', 'abcd')).rejects.toThrow(BadRequestException);
    });

    it('rejects when phone last 4 digits do not match registered employee phone', async () => {
      prisma.employee.findFirst.mockResolvedValue(mockEmployee);
      await expect(service.findByCpf('CPF1', '9999')).rejects.toThrow(BadRequestException);
    });

    it('succeeds when both valid CPF and correct phone last 4 digits match', async () => {
      prisma.employee.findFirst.mockResolvedValue(mockEmployee);
      const result = await service.findByCpf('CPF1', '3210');
      expect(result.employee.cpf).toBe('CPF1');
      expect(result.employee.name).toBe('Amit');
      expect(result.passes).toHaveLength(2);
      expect(result.passes[0].bookingDays).toEqual(['2026-10-11']);
      expect(result.passes[1].bookingDays).toEqual(['2026-10-14']);
    });

    it('succeeds when searched by Reference Number (ONGC-00001)', async () => {
      prisma.employee.findFirst.mockResolvedValue({
        ...mockEmployee,
        referenceNumber: 'ONGC-00001',
      });
      const result = await service.findByCpf('ONGC-00001', '3210');
      expect(result.employee.referenceNumber).toBe('ONGC-00001');
      expect(result.employee.name).toBe('Amit');
    });

    it('enforces RegistrationType.EMPLOYEE on attendee query to prevent retrieving commercial attendees', async () => {
      prisma.employee.findFirst.mockResolvedValue(mockEmployee);
      await service.findByCpf('CPF1', '3210');
      expect(prisma.employee.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            attendees: expect.objectContaining({
              where: { registrationType: RegistrationType.EMPLOYEE },
            }),
          }),
        }),
      );
    });
  });

  describe('findDailyPassByToken', () => {
    const mockDailyPass = {
      id: BigInt(1),
      attendeeId: BigInt(10),
      eventDate: '2026-10-11',
      qrToken: 'test-daily-qr-token-abc123',
      status: 'ISSUED',
      attendee: {
        name: 'Amit Sharma',
        ticketNumber: 'TK-EMP-001',
        category: 'ONGC STAFF',
        employee: {
          name: 'Amit Sharma',
          cpf: '123456',
          department: 'EWC Ahmedabad',
        },
        familyMember: null,
      },
    };

    it('rejects when token is empty or whitespace', async () => {
      await expect(service.findDailyPassByToken('')).rejects.toThrow(NotFoundException);
      await expect(service.findDailyPassByToken('   ')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when daily pass is not found in database', async () => {
      prisma.dailyEmployeePass.findUnique.mockResolvedValue(null);
      await expect(service.findDailyPassByToken('non-existent-token')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns formatted public daily pass with correct dayTheme and attendee details', async () => {
      prisma.dailyEmployeePass.findUnique.mockResolvedValue(mockDailyPass);

      const result = await service.findDailyPassByToken('test-daily-qr-token-abc123');

      expect(result.token).toBe('test-daily-qr-token-abc123');
      expect(result.ticketNumber).toBe('TK-EMP-001');
      expect(result.attendeeName).toBe('Amit Sharma');
      expect(result.eventDate).toBe('2026-10-11');
      expect(result.isFamily).toBe(false);
      expect(result.employeeName).toBe('Amit Sharma');
      expect(result.employeeCpf).toBe('123456');
      expect(result.dayTheme).toBeDefined();
      expect(result.dayTheme.dayNumber).toBe(1);
      expect(result.dayTheme.themeTitle).toBe('SHUBH AARAMBH');
      expect(result.qrSvg).toContain('<svg');
      expect(result.venue.name).toBe('Malaviya Cricket Ground ONGC');
      expect(result.organizer).toBe('Digant Art');
    });

    it('returns formatted family member daily pass when attendee is a family member', async () => {
      const mockFamilyPass = {
        ...mockDailyPass,
        attendee: {
          ...mockDailyPass.attendee,
          name: 'Sunita Sharma',
          ticketNumber: 'TK-EMP-F1-001',
          familyMember: {
            name: 'Sunita Sharma',
            relation: 'Spouse',
          },
        },
      };
      prisma.dailyEmployeePass.findUnique.mockResolvedValue(mockFamilyPass);

      const result = await service.findDailyPassByToken('test-daily-qr-token-abc123');

      expect(result.attendeeName).toBe('Sunita Sharma');
      expect(result.isFamily).toBe(true);
      expect(result.relation).toBe('Spouse');
      expect(result.passType).toBe('Family Member Pass (Spouse)');
      expect(result.employeeName).toBe('Amit Sharma');
      expect(result.employeeCpf).toBe('123456');
    });
  });

  describe('verifyEmployee', () => {
    it('rejects CPF that is not 5 digits', async () => {
      await expect(service.verifyEmployee('1234', '9876543210')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.verifyEmployee('123456', '9876543210')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects mobile that is not 10 digits', async () => {
      await expect(service.verifyEmployee('12345', '98765')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects if employee is already registered in portal', async () => {
      prisma.employee.findUnique.mockResolvedValueOnce({ id: BigInt(1), cpf: '12345' });
      await expect(service.verifyEmployee('12345', '9876543210')).rejects.toThrow(
        ConflictException,
      );
    });

    it('validates against master records and fails if mismatch', async () => {
      prisma.employee.findUnique.mockResolvedValueOnce(null);
      prisma.ongcEmployeeMaster.count.mockResolvedValueOnce(100);
      prisma.ongcEmployeeMaster.findUnique.mockResolvedValueOnce(null);

      await expect(service.verifyEmployee('12345', '9876543210')).rejects.toThrow(
        'The CPF No. and Mobile No. do not match the official ONGC employee records',
      );
    });

    it('succeeds when master record matches', async () => {
      prisma.employee.findUnique.mockResolvedValueOnce(null);
      prisma.ongcEmployeeMaster.count.mockResolvedValueOnce(100);
      prisma.ongcEmployeeMaster.findUnique.mockResolvedValueOnce({
        cpf: '12345',
        name: 'Rajesh Kumar',
        mobile: '9876543210',
      });

      const res = await service.verifyEmployee('12345', '9876543210');
      expect(res.verified).toBe(true);
      expect(res.name).toBe('Rajesh Kumar');
      expect(res.cpf).toBe('12345');
      expect(typeof res.cpf).toBe('string');
    });

    it('succeeds with CPF preserving leading zero like "01234"', async () => {
      prisma.employee.findUnique.mockResolvedValueOnce(null);
      prisma.ongcEmployeeMaster.count.mockResolvedValueOnce(100);
      prisma.ongcEmployeeMaster.findUnique.mockResolvedValueOnce({
        cpf: '01234',
        name: 'Amit Patel',
        mobile: '9876543210',
      });

      const res = await service.verifyEmployee('01234', '9876543210');
      expect(res.verified).toBe(true);
      expect(res.cpf).toBe('01234');
      expect(typeof res.cpf).toBe('string');
      expect(prisma.ongcEmployeeMaster.findUnique).toHaveBeenCalledWith({
        where: { cpf: '01234' },
      });
    });

    it('rejects CPF containing letters like "12A45"', async () => {
      await expect(service.verifyEmployee('12A45', '9876543210')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});

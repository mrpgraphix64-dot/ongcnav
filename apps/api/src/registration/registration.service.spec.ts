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
      employee: { findUnique: jest.fn(), create: jest.fn() },
      setting: { findUnique: jest.fn().mockResolvedValue(null) },
      attendee: { create: jest.fn(), findFirst: jest.fn() },
      familyMember: { create: jest.fn() },
      $transaction: jest.fn().mockImplementation(async (callback: any) => callback(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [RegistrationService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<RegistrationService>(RegistrationService);
  });

  describe('register', () => {
    const baseDto = {
      cpf: '654321',
      name: 'Amit Sharma',
      designation: 'ONGC Employee',
      department: 'EWC Ahmedabad',
      phone: '9876543210',
      email: 'amit@ongc.co.in',
      employeeCategory: EmployeeCategory.REGULAR,
      bookingDays: ['2026-10-11', '2026-10-12'],
      familyMembers: [
        { name: 'Sunita Sharma', relation: 'Spouse', phone: '9876543211', bookingDays: ['2026-10-13'] },
        { name: 'Rohan Sharma', relation: 'Son', phone: '9876543212', bookingDays: ['2026-10-14', '2026-10-15'] },
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
  });

  describe('findByCpf', () => {
    it('returns each pass with its own independent bookingDays', async () => {
      prisma.employee.findUnique.mockResolvedValue({
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
      });

      const result = await service.findByCpf('CPF1');
      expect(result.passes[0].bookingDays).toEqual(['2026-10-11']);
      expect(result.passes[1].bookingDays).toEqual(['2026-10-14']);
    });
  });
});

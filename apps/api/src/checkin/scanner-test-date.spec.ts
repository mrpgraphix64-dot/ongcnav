import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ScannerController } from './scanner.controller';
import { CheckinService } from './checkin.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { RolesGuard } from '../common/guards/roles.guard';
import {
  CheckinResult,
  CheckinStatus,
  AttendeeStatus,
  UserRole,
  OFFICIAL_EVENT_DATES,
} from '@ongc/shared-types';

describe('SUPER_ADMIN Scanner Test Date Control Specification', () => {
  let controller: ScannerController;
  let service: CheckinService;
  let prisma: any;
  let redis: any;
  let rolesGuard: RolesGuard;

  const mockAttendeeOct11 = {
    id: BigInt(201),
    ticketNumber: 'TK-OCT11-0001',
    qrCodeToken: 'token-oct11-pass',
    status: AttendeeStatus.ACTIVE,
    employee: {
      id: BigInt(10),
      cpf: '99001',
      name: 'Anil Kumar',
      designation: 'General Manager',
      department: 'Finance',
      bookingDays: ['2026-10-11'],
      photoPath: null,
    },
    familyMember: null,
  };

  const mockAttendeeOct19 = {
    id: BigInt(209),
    ticketNumber: 'TK-OCT19-0001',
    qrCodeToken: 'token-oct19-pass',
    status: AttendeeStatus.ACTIVE,
    employee: {
      id: BigInt(19),
      cpf: '99019',
      name: 'Sunita Patel',
      designation: 'Officer',
      department: 'HR',
      bookingDays: ['2026-10-19'],
      photoPath: null,
    },
    familyMember: null,
  };

  const mockGate = {
    id: BigInt(1),
    name: 'Gate 1 (Main Entrance)',
    gateNumber: 'G1',
    gateType: 'REGULAR',
    isOpen: true,
    isScanningPaused: false,
    capacityEnabled: false,
    totalCapacity: 5000,
  };

  beforeEach(async () => {
    prisma = {
      setting: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.key === 'emergency_stop' || where.key === 'event_control.emergency_stopped') {
            return Promise.resolve({ value: 'false' });
          }
          if (where.key === 'active_event_date' || where.key === 'event_control.active_event_date') {
            return Promise.resolve({ value: '2026-09-26' }); // Server date is not an event date
          }
          return Promise.resolve(null);
        }),
      },
      gate: {
        findUnique: jest.fn().mockResolvedValue(mockGate),
      },
      gateUser: {
        findFirst: jest.fn().mockResolvedValue({ id: BigInt(1) }),
      },
      dailyCheckin: {
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: BigInt(1001),
            ...data,
            checkinTime: new Date(),
          }),
        ),
      },
      attendee: {
        findFirst: jest.fn().mockImplementation(({ where }) => {
          const t = where.OR?.[0]?.qrCodeToken || where.OR?.[1]?.ticketNumber;
          if (t === 'token-oct11-pass' || t === 'TK-OCT11-0001') return Promise.resolve(mockAttendeeOct11);
          if (t === 'token-oct19-pass' || t === 'TK-OCT19-0001') return Promise.resolve(mockAttendeeOct19);
          return Promise.resolve(null);
        }),
      },
      scanLog: {
        create: jest.fn().mockResolvedValue({ id: BigInt(1) }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: BigInt(1) }),
      },
      $transaction: jest.fn().mockImplementation(async (callback) => callback(prisma)),
    };

    redis = {
      acquireLock: jest.fn().mockResolvedValue(true),
      releaseLock: jest.fn().mockResolvedValue(true),
      set: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockResolvedValue(null),
      incrementCounter: jest.fn().mockResolvedValue(1),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckinService,
        ScannerController,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(undefined) } },
      ],
    }).compile();

    service = module.get<CheckinService>(CheckinService);
    controller = module.get<ScannerController>(ScannerController);
    rolesGuard = new RolesGuard(new Reflector());
  });

  describe('1. Controller Date Validation & Role Guarding', () => {
    it('SUPER_ADMIN + valid 11 Oct → allowed through controller', async () => {
      const mockReq: any = {
        user: { id: '1', role: UserRole.SUPER_ADMIN },
        headers: {},
        query: {},
      };
      const result: any = await controller.checkin(
        { token: 'token-oct11-pass', gateId: '1', testDate: '2026-10-11' },
        mockReq,
      );
      expect(result.success).toBe(true);
      expect(result.data?.activeDate).toBe('2026-10-11');
      expect(result.data?.isTestScan).toBe(true);
    });

    it('SUPER_ADMIN + valid 19 Oct → allowed through controller', async () => {
      const mockReq: any = {
        user: { id: '1', role: UserRole.SUPER_ADMIN },
        headers: {},
        query: {},
      };
      const result: any = await controller.checkin(
        { token: 'token-oct19-pass', gateId: '1', testDate: '2026-10-19' },
        mockReq,
      );
      expect(result.success).toBe(true);
      expect(result.data?.activeDate).toBe('2026-10-19');
      expect(result.data?.isTestScan).toBe(true);
    });

    it('SUPER_ADMIN + each official date (11 to 19 Oct) → allowed', async () => {
      const mockReq: any = {
        user: { id: '1', role: UserRole.SUPER_ADMIN },
        headers: {},
        query: {},
      };
      for (const date of OFFICIAL_EVENT_DATES) {
        // Mock attendee booking matches date
        prisma.attendee.findFirst.mockResolvedValueOnce({
          ...mockAttendeeOct11,
          employee: { ...mockAttendeeOct11.employee, bookingDays: [date] },
        });

        const result: any = await controller.checkin(
          { token: 'token-oct11-pass', gateId: '1', testDate: date },
          mockReq,
        );
        expect(result.success).toBe(true);
        expect(result.data?.activeDate).toBe(date);
      }
    });

    it('SUPER_ADMIN + 10 Oct (day before festival) → rejected with BadRequestException', async () => {
      const mockReq: any = {
        user: { id: '1', role: UserRole.SUPER_ADMIN },
        headers: {},
        query: {},
      };
      await expect(
        controller.checkin(
          { token: 'token-oct11-pass', gateId: '1', testDate: '2026-10-10' },
          mockReq,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('SUPER_ADMIN + 20 Oct (day after festival) → rejected with BadRequestException', async () => {
      const mockReq: any = {
        user: { id: '1', role: UserRole.SUPER_ADMIN },
        headers: {},
        query: {},
      };
      await expect(
        controller.checkin(
          { token: 'token-oct11-pass', gateId: '1', testDate: '2026-10-20' },
          mockReq,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('SUPER_ADMIN + arbitrary date string → rejected with BadRequestException', async () => {
      const mockReq: any = {
        user: { id: '1', role: UserRole.SUPER_ADMIN },
        headers: {},
        query: {},
      };
      await expect(
        controller.checkin(
          { token: 'token-oct11-pass', gateId: '1', testDate: '2026-10-99' },
          mockReq,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        controller.checkin(
          { token: 'token-oct11-pass', gateId: '1', testDate: 'invalid-date' },
          mockReq,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('scanner/gate operator submitting test date → rejected with ForbiddenException (403)', async () => {
      const mockReq: any = {
        user: { id: '5', role: UserRole.GATE_OPERATOR },
        headers: {},
        query: {},
      };
      await expect(
        controller.checkin(
          { token: 'token-oct11-pass', gateId: '1', testDate: '2026-10-11' },
          mockReq,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('commercial agent submitting test date → rejected with ForbiddenException (403)', async () => {
      const mockReq: any = {
        user: { id: '8', role: UserRole.COMMERCIAL_AGENT },
        headers: {},
        query: {},
      };
      await expect(
        controller.checkin(
          { token: 'token-oct11-pass', gateId: '1', testDate: '2026-10-11' },
          mockReq,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('employee admin submitting test date → rejected with ForbiddenException (403)', async () => {
      const mockReq: any = {
        user: { id: '9', role: UserRole.EMPLOYEE_ADMIN },
        headers: {},
        query: {},
      };
      await expect(
        controller.checkin(
          { token: 'token-oct11-pass', gateId: '1', testDate: '2026-10-11' },
          mockReq,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('unauthenticated request is rejected by RolesGuard before reaching handler', () => {
      const context = {
        getHandler: () => controller.checkin,
        getClass: () => ScannerController,
        switchToHttp: () => ({
          getRequest: () => ({ user: undefined }),
        }),
      } as any;
      expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
    });
  });

  describe('2. Security: Anti-Bypass Testing (Query Params, Custom Headers, Aliases)', () => {
    it('non-SUPER_ADMIN attempting test date manipulation via query param ?testDate=... → rejected (403)', async () => {
      const mockReq: any = {
        user: { id: '5', role: UserRole.SCANNER_STAFF },
        query: { testDate: '2026-10-11' },
        headers: {},
      };
      await expect(
        controller.checkin({ token: 'token-oct11-pass', gateId: '1' }, mockReq),
      ).rejects.toThrow(ForbiddenException);
    });

    it('non-SUPER_ADMIN attempting test date manipulation via query param ?date=... → rejected (403)', async () => {
      const mockReq: any = {
        user: { id: '5', role: UserRole.SCANNER_STAFF },
        query: { date: '2026-10-11' },
        headers: {},
      };
      await expect(
        controller.checkin({ token: 'token-oct11-pass', gateId: '1' }, mockReq),
      ).rejects.toThrow(ForbiddenException);
    });

    it('non-SUPER_ADMIN attempting test date manipulation via x-test-date header → rejected (403)', async () => {
      const mockReq: any = {
        user: { id: '5', role: UserRole.SCANNER_STAFF },
        query: {},
        headers: { 'x-test-date': '2026-10-11' },
      };
      await expect(
        controller.checkin({ token: 'token-oct11-pass', gateId: '1' }, mockReq),
      ).rejects.toThrow(ForbiddenException);
    });

    it('non-SUPER_ADMIN attempting test date manipulation via x-event-date header → rejected (403)', async () => {
      const mockReq: any = {
        user: { id: '5', role: UserRole.SCANNER_STAFF },
        query: {},
        headers: { 'x-event-date': '2026-10-11' },
      };
      await expect(
        controller.checkin({ token: 'token-oct11-pass', gateId: '1' }, mockReq),
      ).rejects.toThrow(ForbiddenException);
    });

    it('non-SUPER_ADMIN attempting test date manipulation via simulationDate alias → rejected (403)', async () => {
      const mockReq: any = {
        user: { id: '5', role: UserRole.SCANNER_STAFF },
        query: {},
        headers: {},
      };
      await expect(
        controller.checkin(
          { token: 'token-oct11-pass', gateId: '1', simulationDate: '2026-10-11' },
          mockReq,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('3. Core CheckinService Pipeline & Audit Trail Verification', () => {
    it('normal scanner request with no test date uses server date unchanged', async () => {
      const result = await service.processCheckin(
        { token: 'token-oct11-pass', gateId: '1' },
        { id: '5', role: UserRole.SCANNER_STAFF },
      );
      // Attendee is booked for 2026-10-11, server date is 2026-09-26, so NOT_BOOKED_TODAY
      expect(result.result).toBe(CheckinResult.NOT_BOOKED_TODAY);
      expect(result.message).toContain('Pass is not registered for today (2026-09-26)');
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });

    it('SUPER_ADMIN test scan on wrong day returns NOT_BOOKED_TODAY with simulated date and writes AuditLog', async () => {
      // Attendee booked for 11 Oct, but SUPER_ADMIN simulates scan on 12 Oct
      const result = await service.processCheckin(
        { token: 'token-oct11-pass', gateId: '1', testDate: '2026-10-12' },
        { id: '1', role: UserRole.SUPER_ADMIN },
      );

      expect(result.result).toBe(CheckinResult.NOT_BOOKED_TODAY);
      expect(result.message).toContain('Pass is not registered for today (2026-10-12)');
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: BigInt(1),
            action: 'SCANNER_TEST_MODE_SCAN',
            details: expect.objectContaining({
              isSimulation: true,
              testEventDate: '2026-10-12',
              result: CheckinResult.NOT_BOOKED_TODAY,
            }),
          }),
        }),
      );
    });

    it('SUPER_ADMIN test scan on correct day succeeds, acquires Redis lock with test date, and writes AuditLog', async () => {
      const result: any = await service.processCheckin(
        { token: 'token-oct11-pass', gateId: '1', testDate: '2026-10-11' },
        { id: '1', role: UserRole.SUPER_ADMIN },
      );

      expect(result.success).toBe(true);
      expect(result.result).toBe(CheckinResult.SUCCESS);
      expect(result.data.activeDate).toBe('2026-10-11');
      expect(result.data.isTestScan).toBe(true);
      expect(result.data.testDate).toBe('2026-10-11');

      // Redis lock was scoped to the test event date
      expect(redis.acquireLock).toHaveBeenCalledWith(
        'lock:checkin:201:2026-10-11',
        5000,
      );

      // AuditLog recorded
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: BigInt(1),
            action: 'SCANNER_TEST_MODE_SCAN',
            details: expect.objectContaining({
              isSimulation: true,
              testEventDate: '2026-10-11',
              result: CheckinResult.SUCCESS,
            }),
          }),
        }),
      );
    });

    it('duplicate checkin on same test date returns ALREADY_CHECKED_IN', async () => {
      prisma.dailyCheckin.findFirst.mockResolvedValueOnce({
        id: BigInt(555),
        attendeeId: BigInt(201),
        eventDate: '2026-10-11',
        checkinTime: new Date('2026-10-11T19:30:00Z'),
        gate: mockGate,
      });

      const result = await service.processCheckin(
        { token: 'token-oct11-pass', gateId: '1', testDate: '2026-10-11' },
        { id: '1', role: UserRole.SUPER_ADMIN },
      );

      expect(result.success).toBe(false);
      expect(result.result).toBe(CheckinResult.ALREADY_CHECKED_IN);
      expect(result.statusCode).toBe(409);
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'SCANNER_TEST_MODE_SCAN',
            details: expect.objectContaining({
              isSimulation: true,
              testEventDate: '2026-10-11',
              result: CheckinResult.ALREADY_CHECKED_IN,
            }),
          }),
        }),
      );
    });

    it('direct service invocation by non-SUPER_ADMIN with testDate throws ForbiddenException', async () => {
      await expect(
        service.processCheckin(
          { token: 'token-oct11-pass', gateId: '1', testDate: '2026-10-11' },
          { id: '5', role: UserRole.GATE_OPERATOR },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('direct service invocation by SUPER_ADMIN with date outside official range throws BadRequestException', async () => {
      await expect(
        service.processCheckin(
          { token: 'token-oct11-pass', gateId: '1', testDate: '2026-10-25' },
          { id: '1', role: UserRole.SUPER_ADMIN },
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

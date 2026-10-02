import { Test, TestingModule } from '@nestjs/testing';
import { EmployeeDailyPassTestService } from './employee-daily-pass-test.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../mail/mail.service';
import { DailyPassPdfService } from '../../registration/daily-pass-pdf.service';
import { CheckinService } from '../../checkin/checkin.service';
import {
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { UserRole, CheckinResult, RegistrationStatus, DailyPassEmailStatus } from '@ongc/shared-types';

describe('EmployeeDailyPassTestService', () => {
  let service: EmployeeDailyPassTestService;
  let prisma: any;
  let mailService: any;
  let pdfService: any;
  let checkinService: any;

  const mockSuperAdmin = { id: '1', role: UserRole.SUPER_ADMIN, email: 'super@ongc.co.in' };
  const mockEmployeeAdmin = { id: '2', role: UserRole.EMPLOYEE_ADMIN, email: 'emp_admin@ongc.co.in' };

  const mockEmployee = {
    id: BigInt(10),
    cpf: '123456',
    name: 'Amit Sharma',
    designation: 'Chief Manager',
    department: 'EWC Ahmedabad',
    email: 'amit@ongc.co.in',
    phone: '9876543210',
    registrationStatus: 'APPROVED',
    bookingDays: ['2026-10-11', '2026-10-12'],
    familyMembers: [
      { id: BigInt(20), name: 'Sunita Sharma', relation: 'Spouse' },
    ],
    attendees: [
      {
        id: BigInt(100),
        ticketNumber: 'TK-EMP-001',
        familyMemberId: null,
        bookingDays: ['2026-10-11'],
        employee: { name: 'Amit Sharma', cpf: '123456', department: 'EWC Ahmedabad' },
        familyMember: null,
      },
      {
        id: BigInt(101),
        ticketNumber: 'TK-EMP-F1-001',
        familyMemberId: BigInt(20),
        bookingDays: ['2026-10-13'],
        employee: { name: 'Amit Sharma', cpf: '123456', department: 'EWC Ahmedabad' },
        familyMember: { id: BigInt(20), name: 'Sunita Sharma', relation: 'Spouse' },
      },
    ],
  };

  const mockTestPass = {
    id: BigInt(500),
    attendeeId: BigInt(100),
    eventDate: '2026-10-11',
    qrToken: 'test-qr-token-superadmin-12345',
    status: 'ACTIVE',
    emailStatus: 'PENDING',
    isTest: true,
    testSessionId: 'EMP-TEST-20261001-001',
    createdAt: new Date(),
    attendee: mockEmployee.attendees[0],
  };

  beforeEach(async () => {
    prisma = {
      employee: {
        findMany: jest.fn().mockResolvedValue([mockEmployee]),
      },
      attendee: {
        findUnique: jest.fn().mockResolvedValue(mockEmployee.attendees[0]),
      },
      gate: {
        findFirst: jest.fn().mockResolvedValue({ id: BigInt(1), name: 'Gate 1' }),
      },
      dailyEmployeePass: {
        create: jest.fn().mockResolvedValue(mockTestPass),
        findUnique: jest.fn().mockResolvedValue(mockTestPass),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([mockTestPass]),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ ...mockTestPass, ...data })),
      },
      dailyCheckin: {
        deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      scanLog: {
        deleteMany: jest.fn().mockResolvedValue({ count: 3 }),
      },
      setting: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };

    mailService = {
      previewEmployeeDailyPassEmail: jest.fn().mockResolvedValue({
        subject: 'Preview Subject',
        html: '<div>Preview Email Content</div>',
      }),
      sendEmployeeDailyPassEmail: jest.fn().mockResolvedValue({
        success: true,
        messageId: 'msg-test-123',
      }),
    };

    pdfService = {
      generateDailyPassPdf: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4 test ticket')),
    };

    checkinService = {
      processCheckin: jest.fn().mockResolvedValue({
        success: true,
        result: CheckinResult.SUCCESS,
        message: 'CHECK-IN ACCEPTED',
        statusCode: 200,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeeDailyPassTestService,
        { provide: PrismaService, useValue: prisma },
        { provide: MailService, useValue: mailService },
        { provide: DailyPassPdfService, useValue: pdfService },
        { provide: CheckinService, useValue: checkinService },
      ],
    }).compile();

    service = module.get<EmployeeDailyPassTestService>(EmployeeDailyPassTestService);
  });

  describe('Authorization checks', () => {
    it('SUPER_ADMIN can generate test passes', async () => {
      const res = await service.generateTestPass(
        { attendeeId: '100', eventDate: '2026-10-11' },
        mockSuperAdmin,
      );
      expect(res.qrToken).toBe('test-qr-token-superadmin-12345');
      expect(res.isFamily).toBe(false);
    });

    it('EMPLOYEE_ADMIN is rejected with ForbiddenException', async () => {
      await expect(
        service.generateTestPass(
          { attendeeId: '100', eventDate: '2026-10-11' },
          mockEmployeeAdmin,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('EMPLOYEE_ADMIN cannot send test emails', async () => {
      await expect(
        service.sendTestEmail(
          { token: 'tok', recipientEmail: 'test@example.com' },
          mockEmployeeAdmin,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('EMPLOYEE_ADMIN cannot execute scanner tests', async () => {
      await expect(
        service.testScan({ token: 'tok' }, mockEmployeeAdmin),
      ).rejects.toThrow(ForbiddenException);
    });

    it('EMPLOYEE_ADMIN cannot cleanup test data', async () => {
      await expect(
        service.cleanupTestSession('EMP-TEST-001', mockEmployeeAdmin),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.cleanupAllTestData(true, mockEmployeeAdmin),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Generation and Isolation', () => {
    it('rejects invalid event date', async () => {
      await expect(
        service.generateTestPass(
          { attendeeId: '100', eventDate: '2026-10-25' },
          mockSuperAdmin,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates test pass with isTest: true and explicit testSessionId', async () => {
      await service.generateTestPass(
        { attendeeId: '100', eventDate: '2026-10-11', testSessionId: 'EMP-CUSTOM-SESSION' },
        mockSuperAdmin,
      );

      expect(prisma.dailyEmployeePass.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isTest: true,
            testSessionId: 'EMP-CUSTOM-SESSION',
            eventDate: '2026-10-11',
          }),
        }),
      );
    });

    it('generates test pass for family member when family attendee is selected', async () => {
      prisma.attendee.findUnique.mockResolvedValue(mockEmployee.attendees[1]);

      const res = await service.generateTestPass(
        { attendeeId: '101', eventDate: '2026-10-13' },
        mockSuperAdmin,
      );

      expect(res.attendeeName).toBe('Sunita Sharma');
      expect(res.isFamily).toBe(true);
      expect(res.passType).toBe('Family Member Pass (Spouse)');
    });
  });

  describe('Email Preview and Dispatch', () => {
    it('previewEmail renders template without sending', async () => {
      const res = await service.previewEmail('test-qr-token-superadmin-12345');
      expect(res.subject).toBe('Preview Subject');
      expect(res.html).toContain('Preview Email Content');
      expect(mailService.previewEmployeeDailyPassEmail).toHaveBeenCalled();
    });

    it('sendTestEmail sends strictly to explicitly entered recipient with [TEST] prefix', async () => {
      const res = await service.sendTestEmail(
        { token: 'test-qr-token-superadmin-12345', recipientEmail: 'tester@customdomain.com' },
        mockSuperAdmin,
      );

      expect(res.success).toBe(true);
      expect(res.sentTo).toBe('tester@customdomain.com');
      expect(pdfService.generateDailyPassPdf).toHaveBeenCalledWith('test-qr-token-superadmin-12345');
      expect(mailService.sendEmployeeDailyPassEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientEmail: 'tester@customdomain.com',
          subjectOverride: expect.stringContaining('[TEST]'),
          pdfBuffer: expect.any(Buffer),
        }),
      );
    });

    it('rejects sending test email without valid email recipient', async () => {
      await expect(
        service.sendTestEmail(
          { token: 'test-qr-token-superadmin-12345', recipientEmail: 'invalid-email' },
          mockSuperAdmin,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Scanner Testing', () => {
    it('executes valid scan with isLoadTest: true and returns SUCCESS', async () => {
      const res = await service.testScan(
        { token: 'test-qr-token-superadmin-12345' },
        mockSuperAdmin,
      );

      expect(checkinService.processCheckin).toHaveBeenCalledWith(
        expect.objectContaining({
          token: 'test-qr-token-superadmin-12345',
          isLoadTest: true,
          testDate: '2026-10-11',
        }),
        expect.objectContaining({ role: UserRole.SUPER_ADMIN }),
        expect.any(Object),
      );
      expect(res.scannerResponse.result).toBe(CheckinResult.SUCCESS);
    });

    it('passes simulated wrong date to checkinService', async () => {
      checkinService.processCheckin.mockResolvedValue({
        success: false,
        result: CheckinResult.NOT_BOOKED_TODAY,
        message: 'Pass is not valid for today',
        statusCode: 403,
      });

      const res = await service.testScan(
        { token: 'test-qr-token-superadmin-12345', scanDate: '2026-10-12' },
        mockSuperAdmin,
      );

      expect(checkinService.processCheckin).toHaveBeenCalledWith(
        expect.objectContaining({
          testDate: '2026-10-12',
          isLoadTest: true,
        }),
        expect.any(Object),
        expect.any(Object),
      );
      expect(res.scannerResponse.result).toBe(CheckinResult.NOT_BOOKED_TODAY);
    });

    it('revokes test pass so scanner returns ATTENDEE_INACTIVE', async () => {
      const res = await service.revokeTestPass('test-qr-token-superadmin-12345', mockSuperAdmin);
      expect(res.status).toBe('REVOKED');
      expect(prisma.dailyEmployeePass.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'REVOKED' },
        }),
      );
    });
  });

  describe('Cleanup Isolation', () => {
    it('cleanupTestSession deletes only passes with testSessionId and isTest: true', async () => {
      const res = await service.cleanupTestSession('EMP-TEST-20261001-001', mockSuperAdmin);
      expect(res.success).toBe(true);
      expect(prisma.dailyEmployeePass.deleteMany).toHaveBeenCalledWith({
        where: {
          testSessionId: 'EMP-TEST-20261001-001',
          isTest: true,
        },
      });
      expect(prisma.dailyCheckin.deleteMany).toHaveBeenCalledWith({
        where: {
          attendeeId: { in: [BigInt(100)] },
          isLoadTest: true,
        },
      });
    });

    it('cleanupAllTestData requires confirm: true and deletes all isTest: true records', async () => {
      await expect(
        service.cleanupAllTestData(false, mockSuperAdmin),
      ).rejects.toThrow(BadRequestException);

      const res = await service.cleanupAllTestData(true, mockSuperAdmin);
      expect(res.success).toBe(true);
      expect(prisma.dailyEmployeePass.deleteMany).toHaveBeenCalledWith({
        where: { isTest: true },
      });
      expect(prisma.dailyCheckin.deleteMany).toHaveBeenCalledWith({
        where: { isLoadTest: true },
      });
      expect(prisma.scanLog.deleteMany).toHaveBeenCalledWith({
        where: { isLoadTest: true },
      });
    });
  });

  describe('Date Eligibility and Multi-Person Batching (Cases 1-10)', () => {
    it('CASE 1: Employee selected date, Family did not -> Employee eligible, Family not eligible', async () => {
      const res = await service.generateTestPass(
        { employeeIds: ['10'], eventDate: '2026-10-11' },
        mockSuperAdmin,
      );

      expect(res.totalEligible).toBe(1);
      expect(res.passes.length).toBe(1);
      expect(res.passes[0].attendeeName).toBe('Amit Sharma');
      expect(res.passes[0].isFamily).toBe(false);
      expect(res.ineligible.length).toBe(1);
      expect(res.ineligible[0].attendeeName).toBe('Sunita Sharma');
      expect(res.ineligible[0].reason).toBe('Did not select this date');
    });

    it('CASE 2: Family selected date, Employee did not -> Family eligible, Employee not eligible', async () => {
      const res = await service.generateTestPass(
        { employeeIds: ['10'], eventDate: '2026-10-13' },
        mockSuperAdmin,
      );

      expect(res.totalEligible).toBe(1);
      expect(res.passes.length).toBe(1);
      expect(res.passes[0].attendeeName).toBe('Sunita Sharma');
      expect(res.passes[0].isFamily).toBe(true);
      expect(res.ineligible.length).toBe(1);
      expect(res.ineligible[0].attendeeName).toBe('Amit Sharma');
    });

    it('CASE 3: Both selected date -> Both eligible', async () => {
      const empWithBoth = {
        ...mockEmployee,
        attendees: [
          { ...mockEmployee.attendees[0], bookingDays: ['2026-10-12'] },
          { ...mockEmployee.attendees[1], bookingDays: ['2026-10-12'] },
        ],
      };
      prisma.employee.findMany.mockResolvedValueOnce([empWithBoth]);

      const res = await service.generateTestPass(
        { employeeIds: ['10'], eventDate: '2026-10-12' },
        mockSuperAdmin,
      );

      expect(res.totalEligible).toBe(2);
      expect(res.passes.length).toBe(2);
      expect(res.ineligible.length).toBe(0);
    });

    it('CASE 4: Neither selected date -> Neither eligible (0 passes generated)', async () => {
      const res = await service.generateTestPass(
        { employeeIds: ['10'], eventDate: '2026-10-15' },
        mockSuperAdmin,
      );

      expect(res.totalEligible).toBe(0);
      expect(res.passes.length).toBe(0);
      expect(res.ineligible.length).toBe(2);
    });

    it('CASE 5: Multiple family members with different dates -> Only matching people generated', async () => {
      const empWithMultipleFamily = {
        ...mockEmployee,
        attendees: [
          { ...mockEmployee.attendees[0], bookingDays: ['2026-10-11'] },
          { ...mockEmployee.attendees[1], bookingDays: ['2026-10-13'] },
          {
            id: BigInt(102),
            ticketNumber: 'TK-EMP-F2-001',
            familyMemberId: BigInt(21),
            bookingDays: ['2026-10-14'],
            employee: { name: 'Amit Sharma', cpf: '123456', department: 'EWC Ahmedabad' },
            familyMember: { id: BigInt(21), name: 'Rohan Sharma', relation: 'Son' },
          },
        ],
      };
      prisma.employee.findMany.mockResolvedValueOnce([empWithMultipleFamily]);

      const res = await service.generateTestPass(
        { employeeIds: ['10'], eventDate: '2026-10-14' },
        mockSuperAdmin,
      );

      expect(res.totalEligible).toBe(1);
      expect(res.passes.length).toBe(1);
      expect(res.passes[0].attendeeName).toBe('Rohan Sharma');
      expect(res.ineligible.length).toBe(2);
    });

    it('CASE 6: Same person/date generated twice -> Idempotent, no duplicates created', async () => {
      prisma.dailyEmployeePass.findFirst.mockResolvedValueOnce(mockTestPass);

      const res = await service.generateTestPass(
        { employeeIds: ['10'], eventDate: '2026-10-11' },
        mockSuperAdmin,
      );

      expect(res.existingCount).toBe(1);
      expect(res.newlyGeneratedCount).toBe(0);
      expect(res.passes.length).toBe(1);
      // create should not be called because existing pass was reused
      expect(prisma.dailyEmployeePass.create).not.toHaveBeenCalled();
    });

    it('CASE 7: Test pass scanned once -> Returns SUCCESS and status becomes USED', async () => {
      prisma.dailyEmployeePass.findUnique
        .mockResolvedValueOnce(mockTestPass)
        .mockResolvedValueOnce({ ...mockTestPass, status: 'USED', checkedInAt: new Date() });

      checkinService.processCheckin.mockResolvedValueOnce({
        success: true,
        result: CheckinResult.SUCCESS,
        message: 'CHECK-IN ACCEPTED',
        statusCode: 200,
      });

      const res = await service.testScan(
        { token: 'test-qr-token-superadmin-12345' },
        mockSuperAdmin,
      );

      expect(res.scannerResponse.result).toBe(CheckinResult.SUCCESS);
      expect(res.passStatus).toBe('USED');
    });

    it('CASE 8: Same pass scanned again -> Returns ALREADY_CHECKED_IN', async () => {
      prisma.dailyEmployeePass.findUnique.mockResolvedValue(mockTestPass);

      checkinService.processCheckin.mockResolvedValueOnce({
        success: false,
        result: CheckinResult.ALREADY_CHECKED_IN,
        message: 'Attendee already checked in for this date',
        statusCode: 409,
      });

      const res = await service.testScan(
        { token: 'test-qr-token-superadmin-12345' },
        mockSuperAdmin,
      );

      expect(res.scannerResponse.result).toBe(CheckinResult.ALREADY_CHECKED_IN);
    });

    it('CASE 9: Reset Test Pass -> Returns ACTIVE and deletes test checkin', async () => {
      prisma.dailyEmployeePass.findUnique.mockResolvedValueOnce({
        ...mockTestPass,
        status: 'USED',
        checkedInAt: new Date(),
      });
      prisma.dailyEmployeePass.update.mockResolvedValueOnce({
        ...mockTestPass,
        status: 'ACTIVE',
        checkedInAt: null,
      });

      const res = await service.resetScannerState(
        'test-qr-token-superadmin-12345',
        mockSuperAdmin,
      );

      expect(res.success).toBe(true);
      expect(res.status).toBe('ACTIVE');
      expect(res.checkedInAt).toBeNull();
      expect(prisma.dailyCheckin.deleteMany).toHaveBeenCalledWith({
        where: {
          attendeeId: BigInt(100),
          eventDate: '2026-10-11',
          isLoadTest: true,
        },
      });
    });

    it('CASE 10: Wrong date -> Returns NOT_BOOKED_TODAY', async () => {
      prisma.dailyEmployeePass.findUnique.mockResolvedValue(mockTestPass);

      checkinService.processCheckin.mockResolvedValueOnce({
        success: false,
        result: CheckinResult.NOT_BOOKED_TODAY,
        message: 'Pass is not valid for today',
        statusCode: 403,
      });

      const res = await service.testScan(
        { token: 'test-qr-token-superadmin-12345', scanDate: '2026-10-18' },
        mockSuperAdmin,
      );

      expect(res.scannerResponse.result).toBe(CheckinResult.NOT_BOOKED_TODAY);
    });
  });

  describe('searchEmployees - APPROVED only filter', () => {
    it('queries employee table with registrationStatus = APPROVED', async () => {
      await service.searchEmployees('Amit');
      expect(prisma.employee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            registrationStatus: RegistrationStatus.APPROVED,
          }),
        }),
      );
    });
  });

  describe('simulateDelivery', () => {
    it('when simulated time is before dispatch time, passes are generated in PENDING status and no emails are sent', async () => {
      const res = await service.simulateDelivery(
        {
          employeeIds: ['10'],
          simulatedDate: '2026-10-11',
          simulatedTime: '17:00',
          testRecipientEmail: 'test@example.com',
        },
        mockSuperAdmin,
      );

      expect(res.success).toBe(true);
      expect(res.isDue).toBe(false);
      expect(res.status).toBe('WAITING');
      expect(res.totalPasses).toBe(1);
      expect(res.emailsSentCount).toBe(0);
      expect(res.passes[0].emailStatus).toBe('PENDING');
      expect(mailService.sendEmployeeDailyPassEmail).not.toHaveBeenCalled();
    });

    it('when simulated time is at or after dispatch time, passes are generated and test emails are sent', async () => {
      const res = await service.simulateDelivery(
        {
          employeeIds: ['10'],
          simulatedDate: '2026-10-11',
          simulatedTime: '18:00',
          testRecipientEmail: 'test@example.com',
        },
        mockSuperAdmin,
      );

      expect(res.success).toBe(true);
      expect(res.isDue).toBe(true);
      expect(res.status).toBe('DUE');
      expect(res.totalPasses).toBe(1);
      expect(res.emailsSentCount).toBe(1);
      expect(mailService.sendEmployeeDailyPassEmail).toHaveBeenCalled();
    });

    it('idempotency: already sent email is skipped and not duplicated', async () => {
      prisma.dailyEmployeePass.findFirst.mockResolvedValueOnce({
        ...mockTestPass,
        emailStatus: DailyPassEmailStatus.SENT,
      });

      const res = await service.simulateDelivery(
        {
          employeeIds: ['10'],
          simulatedDate: '2026-10-11',
          simulatedTime: '18:30',
          testRecipientEmail: 'test@example.com',
        },
        mockSuperAdmin,
      );

      expect(res.success).toBe(true);
      expect(res.isDue).toBe(true);
      expect(res.emailsSkippedCount).toBe(1);
      expect(res.emailsSentCount).toBe(0);
    });
  });

  describe('Production Dispatch Schedule Integration', () => {
    it('returns DEFAULT_DISPATCH_SCHEDULE when no custom setting is saved in database', async () => {
      const schedule = await service.getEffectiveDispatchSchedule();
      expect(schedule['2026-10-11']).toBe('18:00');
      expect(schedule['2026-10-12']).toBe('17:30');
    });

    it('reads and merges live production setting from prisma.setting when present', async () => {
      prisma.setting.findFirst.mockResolvedValueOnce({
        key: 'employee.dispatch_schedule',
        value: JSON.stringify({ '2026-10-11': '16:00' }),
      });

      const schedule = await service.getEffectiveDispatchSchedule();
      expect(schedule['2026-10-11']).toBe('16:00');
      expect(schedule['2026-10-12']).toBe('17:30'); // fallback preserved
    });

    it('simulateDelivery respects the live production setting from database', async () => {
      prisma.setting.findFirst.mockResolvedValueOnce({
        key: 'employee.dispatch_schedule',
        value: JSON.stringify({ '2026-10-11': '16:30' }),
      });

      // At 16:45, it is DUE under the custom 16:30 setting (whereas default was 18:00)
      const res = await service.simulateDelivery(
        {
          employeeIds: ['10'],
          simulatedDate: '2026-10-11',
          simulatedTime: '16:45',
          testRecipientEmail: 'test@example.com',
        },
        mockSuperAdmin,
      );

      expect(res.isDue).toBe(true);
      expect(res.configuredDispatchTime).toBe('16:30');
    });
  });
});

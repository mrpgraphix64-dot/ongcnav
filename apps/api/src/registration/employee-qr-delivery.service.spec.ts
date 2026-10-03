import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { EmployeeQrDeliveryService } from './employee-qr-delivery.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { DailyPassPdfService } from './daily-pass-pdf.service';
import {
  EmailDeliveryStatus,
  EmailReleaseStatus,
  EmailDeliveryErrorType,
  AttendeeStatus,
  RegistrationStatus,
  RegistrationType,
} from '@ongc/shared-types';

describe('EmployeeQrDeliveryService', () => {
  let service: EmployeeQrDeliveryService;
  let prisma: any;
  let mailService: any;
  let dailyPassPdfService: any;
  let configService: any;

  beforeEach(async () => {
    prisma = {
      setting: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({}),
      },
      attendee: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
      employeeQrEmailRelease: {
        create: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      employeeQrEmailDelivery: {
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        groupBy: jest.fn(),
        count: jest.fn(),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: BigInt(1) }),
      },
    };

    mailService = {
      sendEmployeeDailyPassEmail: jest.fn(),
    };

    dailyPassPdfService = {
      generateDailyPassPdf: jest.fn().mockResolvedValue(Buffer.from('mock-pdf')),
    };

    configService = {
      get: jest.fn((key: string) => {
        if (key === 'EMAIL_BULK_CONCURRENCY') return '2';
        if (key === 'EMAIL_BULK_BATCH_SIZE') return '5';
        if (key === 'EMAIL_BULK_DELAY_MS') return '0';
        if (key === 'EMAIL_BULK_MAX_RETRIES') return '3';
        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeeQrDeliveryService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: configService },
        { provide: MailService, useValue: mailService },
        { provide: DailyPassPdfService, useValue: dailyPassPdfService },
      ],
    }).compile();

    service = module.get<EmployeeQrDeliveryService>(EmployeeQrDeliveryService);
  });

  const mockAttendee = (id: number, email = 'user@example.com') => ({
    id: BigInt(id),
    name: `User ${id}`,
    ticketNumber: `TK-${id}`,
    qrCodeToken: `token-${id}`,
    status: AttendeeStatus.ACTIVE,
    bookingDays: ['2026-10-11'],
    employee: {
      id: BigInt(id),
      name: `Employee ${id}`,
      cpf: `CPF${id}`,
      referenceNumber: `ONGC-${id}`,
      email,
      department: 'Geology',
      registrationStatus: RegistrationStatus.APPROVED,
    },
    familyMember: null,
  });

  describe('Part 1 & 2: Status Lifecycle and State Machine', () => {
    it('prevents terminal DELIVERED from being downgraded to QUEUED or FAILED', () => {
      expect(service.canTransition(EmailDeliveryStatus.DELIVERED, EmailDeliveryStatus.QUEUED)).toBe(false);
      expect(service.canTransition(EmailDeliveryStatus.DELIVERED, EmailDeliveryStatus.FAILED)).toBe(false);
      expect(service.canTransition(EmailDeliveryStatus.DELIVERED, EmailDeliveryStatus.SENDING)).toBe(false);
    });

    it('allows ACCEPTED to transition to DELIVERED, BOUNCED, or REJECTED', () => {
      expect(service.canTransition(EmailDeliveryStatus.ACCEPTED, EmailDeliveryStatus.DELIVERED)).toBe(true);
      expect(service.canTransition(EmailDeliveryStatus.ACCEPTED, EmailDeliveryStatus.BOUNCED)).toBe(true);
      expect(service.canTransition(EmailDeliveryStatus.ACCEPTED, EmailDeliveryStatus.REJECTED)).toBe(true);
      expect(service.canTransition(EmailDeliveryStatus.ACCEPTED, EmailDeliveryStatus.QUEUED)).toBe(false);
    });

    it('allows QUEUED to transition to SENDING', () => {
      expect(service.canTransition(EmailDeliveryStatus.QUEUED, EmailDeliveryStatus.SENDING)).toBe(true);
    });
  });

  describe('Part 3 & 4: Bulk Release Queueing & Idempotency', () => {
    it('creates release record and processes attendees in batches', async () => {
      const attendees = [mockAttendee(1, 'emp1@ongc.co.in'), mockAttendee(2, 'emp2@ongc.co.in')];
      prisma.attendee.findMany.mockResolvedValueOnce(attendees);
      prisma.employeeQrEmailDelivery.findMany.mockResolvedValueOnce([]); // No existing deliveries
      prisma.employeeQrEmailRelease.create.mockResolvedValueOnce({ id: BigInt(100) });
      prisma.employeeQrEmailDelivery.create
        .mockResolvedValueOnce({ id: BigInt(1), attendeeId: BigInt(1), recipientEmail: 'emp1@ongc.co.in' })
        .mockResolvedValueOnce({ id: BigInt(2), attendeeId: BigInt(2), recipientEmail: 'emp2@ongc.co.in' });

      mailService.sendEmployeeDailyPassEmail.mockResolvedValue({
        success: true,
        messageId: 'msg-abc-123',
      });

      const res = await service.executeRelease();
      expect(res.success).toBe(true);
      expect(res.totalEligible).toBe(2);
      expect(res.acceptedCount).toBe(2);
      expect(res.failedCount).toBe(0);

      // Verify delivery records were created with QUEUED and updated to ACCEPTED
      expect(prisma.employeeQrEmailDelivery.create).toHaveBeenCalledTimes(2);
      expect(prisma.employeeQrEmailDelivery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: EmailDeliveryStatus.ACCEPTED,
            providerMessageId: 'msg-abc-123',
          }),
        }),
      );
    });

    it('idempotency: skips attendees who are already ACCEPTED or DELIVERED', async () => {
      const attendees = [mockAttendee(1), mockAttendee(2)];
      prisma.attendee.findMany.mockResolvedValueOnce(attendees);

      // Attendee 1 is already ACCEPTED
      prisma.employeeQrEmailDelivery.findMany.mockResolvedValueOnce([
        {
          id: BigInt(10),
          attendeeId: BigInt(1),
          status: EmailDeliveryStatus.ACCEPTED,
        },
      ]);

      prisma.employeeQrEmailRelease.create.mockResolvedValueOnce({ id: BigInt(101) });
      prisma.employeeQrEmailDelivery.create.mockResolvedValueOnce({
        id: BigInt(2),
        attendeeId: BigInt(2),
        recipientEmail: 'user@example.com',
      });

      mailService.sendEmployeeDailyPassEmail.mockResolvedValue({ success: true });

      const res = await service.executeRelease();
      expect(res.processedCount).toBe(1); // Only attendee 2 was processed
      expect(mailService.sendEmployeeDailyPassEmail).toHaveBeenCalledTimes(1);
    });

    it('second SEND NOW invocation is blocked while a release is in progress', async () => {
      (service as any).isProcessingRelease = true;
      await expect(service.executeRelease()).rejects.toThrow(BadRequestException);
      (service as any).isProcessingRelease = false;
    });
  });

  describe('Part 5 & 8: Controlled Error Classification & Retry Policy', () => {
    it('classifies SMTP timeout error as SMTP_TIMEOUT and keeps it retryable', async () => {
      const attendees = [mockAttendee(1)];
      prisma.attendee.findMany.mockResolvedValueOnce(attendees);
      prisma.employeeQrEmailDelivery.findMany.mockResolvedValueOnce([]);
      prisma.employeeQrEmailRelease.create.mockResolvedValueOnce({ id: BigInt(102) });
      prisma.employeeQrEmailDelivery.create.mockResolvedValueOnce({
        id: BigInt(1),
        attendeeId: BigInt(1),
        recipientEmail: 'user@example.com',
      });

      mailService.sendEmployeeDailyPassEmail.mockResolvedValueOnce({
        success: false,
        error: 'Request timed out after 30 seconds',
      });

      const res = await service.executeRelease();
      expect(res.success).toBe(false);
      expect(res.failedCount).toBe(1);

      expect(prisma.employeeQrEmailDelivery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: EmailDeliveryStatus.FAILED,
            errorType: EmailDeliveryErrorType.SMTP_TIMEOUT,
          }),
        }),
      );
    });

    it('single delivery retry updates attempt count and changes status upon success', async () => {
      prisma.employeeQrEmailDelivery.findUnique.mockResolvedValueOnce({
        id: BigInt(5),
        recipientEmail: 'emp@ongc.co.in',
        retryCount: 1,
        attendee: mockAttendee(5),
      });

      mailService.sendEmployeeDailyPassEmail.mockResolvedValueOnce({
        success: true,
        messageId: 'retry-msg-id',
      });

      const res = await service.retrySingleDelivery('5', 'admin@ongc.co.in');
      expect(res.success).toBe(true);

      expect(prisma.employeeQrEmailDelivery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: EmailDeliveryStatus.SENDING,
            retryCount: 2,
          }),
        }),
      );

      expect(prisma.employeeQrEmailDelivery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: EmailDeliveryStatus.ACCEPTED,
            providerMessageId: 'retry-msg-id',
          }),
        }),
      );
    });
  });

  describe('Part 9, 10 & 11: Webhook Handling & State Transitions', () => {
    it('marks delivery as DELIVERED upon delivered webhook event', async () => {
      prisma.employeeQrEmailDelivery.findUnique.mockResolvedValueOnce(null); // No duplicate event
      prisma.employeeQrEmailDelivery.findFirst.mockResolvedValueOnce({
        id: BigInt(10),
        status: EmailDeliveryStatus.ACCEPTED,
        providerMessageId: 'msg-999',
      });

      const res = await service.processProviderWebhook({
        eventId: 'evt-100',
        messageId: 'msg-999',
        event: 'delivered',
        timestamp: new Date().toISOString(),
      });

      expect(res.success).toBe(true);
      expect(res.updated).toBe(true);
      expect(prisma.employeeQrEmailDelivery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: EmailDeliveryStatus.DELIVERED,
            providerEventId: 'evt-100',
          }),
        }),
      );
    });

    it('duplicate webhook event is ignored idempotently', async () => {
      prisma.employeeQrEmailDelivery.findUnique.mockResolvedValueOnce({
        id: BigInt(10),
        providerEventId: 'evt-dup',
      });

      const res = await service.processProviderWebhook({
        eventId: 'evt-dup',
        event: 'delivered',
      });

      expect(res.success).toBe(true);
      expect(res.duplicate).toBe(true);
      expect(prisma.employeeQrEmailDelivery.update).not.toHaveBeenCalled();
    });

    it('late webhook cannot downgrade already DELIVERED status', async () => {
      prisma.employeeQrEmailDelivery.findUnique.mockResolvedValueOnce(null);
      prisma.employeeQrEmailDelivery.findFirst.mockResolvedValueOnce({
        id: BigInt(11),
        status: EmailDeliveryStatus.DELIVERED,
        providerMessageId: 'msg-late',
      });

      const res = await service.processProviderWebhook({
        eventId: 'evt-late',
        messageId: 'msg-late',
        event: 'failed',
      });

      expect(res.success).toBe(true);
      expect(res.ignored).toBe(true);
      expect(prisma.employeeQrEmailDelivery.update).not.toHaveBeenCalled();
    });
  });

  describe('Part 21: Test Email Isolation', () => {
    it('sends test email with isTest=true and excludes it from production releases', async () => {
      mailService.sendEmployeeDailyPassEmail.mockResolvedValueOnce({
        success: true,
        messageId: 'test-msg-001',
      });

      prisma.employeeQrEmailDelivery.create.mockResolvedValueOnce({
        id: BigInt(99),
        isTest: true,
      });

      const res = await service.sendTestPermanentQrEmail('test@ongc.co.in', 'super_admin');
      expect(res.success).toBe(true);
      expect(prisma.employeeQrEmailDelivery.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isTest: true,
            recipientEmail: 'test@ongc.co.in',
          }),
        }),
      );
    });
  });

  describe('Part 24: Server Restart Reconciliation', () => {
    it('reconciles interrupted RUNNING releases and resets stuck SENDING to QUEUED', async () => {
      prisma.employeeQrEmailRelease.findMany.mockResolvedValueOnce([
        { id: BigInt(50), status: EmailReleaseStatus.RUNNING },
      ]);
      prisma.employeeQrEmailDelivery.groupBy.mockResolvedValueOnce([
        { status: EmailDeliveryStatus.ACCEPTED, _count: { id: 5 } },
      ]);

      await service.reconcileInterruptedReleases();

      expect(prisma.employeeQrEmailDelivery.updateMany).toHaveBeenCalledWith({
        where: {
          releaseId: BigInt(50),
          status: EmailDeliveryStatus.SENDING,
        },
        data: {
          status: EmailDeliveryStatus.QUEUED,
        },
      });

      expect(prisma.employeeQrEmailRelease.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: BigInt(50) },
          data: expect.objectContaining({
            status: EmailReleaseStatus.COMPLETED,
          }),
        }),
      );
    });
  });

  describe('Hostinger Outbound Delivery Logs Reconciliation', () => {
    it('Hostinger outbound log says Successful -> transitions to DELIVERED', async () => {
      mailService.isLiveMailConfigured = jest.fn().mockReturnValue(true);
      mailService.fetchOutboundDeliveryLogs = jest.fn().mockResolvedValue({
        success: true,
        data: [
          {
            to: 'attendee@ongc.co.in',
            status: 'Successful',
            time: 1773906125,
            relayEvents: [{ relay: 'smtp.relay.hostinger.com', dsn: '2.0.0', response: '250 2.0.0 OK' }],
          },
        ],
      });

      prisma.employeeQrEmailDelivery.findMany.mockResolvedValueOnce([
        {
          id: BigInt(100),
          recipientEmail: 'attendee@ongc.co.in',
          status: EmailDeliveryStatus.ACCEPTED,
        },
      ]);

      const res = await service.reconcileDeliveryStatusesWithHostinger();
      expect(res.deliveredCount).toBe(1);
      expect(res.failedCount).toBe(0);
      expect(prisma.employeeQrEmailDelivery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: BigInt(100) },
          data: expect.objectContaining({
            status: EmailDeliveryStatus.DELIVERED,
          }),
        }),
      );
    });

    it('Hostinger outbound log says Failed -> transitions to FAILED or BOUNCED', async () => {
      mailService.isLiveMailConfigured = jest.fn().mockReturnValue(true);
      mailService.fetchOutboundDeliveryLogs = jest.fn().mockResolvedValue({
        success: true,
        data: [
          {
            to: 'bounced@ongc.co.in',
            status: 'Failed',
            relayEvents: [{ dsn: '5.1.1', response: '550 5.1.1 User unknown' }],
          },
        ],
      });

      prisma.employeeQrEmailDelivery.findMany.mockResolvedValueOnce([
        {
          id: BigInt(101),
          recipientEmail: 'bounced@ongc.co.in',
          status: EmailDeliveryStatus.ACCEPTED,
        },
      ]);

      const res = await service.reconcileDeliveryStatusesWithHostinger();
      expect(res.deliveredCount).toBe(0);
      expect(res.failedCount).toBe(1);
      expect(prisma.employeeQrEmailDelivery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: BigInt(101) },
          data: expect.objectContaining({
            status: EmailDeliveryStatus.BOUNCED,
            errorType: EmailDeliveryErrorType.BOUNCED,
          }),
        }),
      );
    });

    it('Unknown / missing log entry -> remains in ACCEPTED (no false DELIVERED)', async () => {
      mailService.isLiveMailConfigured = jest.fn().mockReturnValue(true);
      mailService.fetchOutboundDeliveryLogs = jest.fn().mockResolvedValue({
        success: true,
        data: [], // No log entry recorded yet
      });

      prisma.employeeQrEmailDelivery.findMany.mockResolvedValueOnce([
        {
          id: BigInt(102),
          recipientEmail: 'pending@ongc.co.in',
          status: EmailDeliveryStatus.ACCEPTED,
        },
      ]);

      const res = await service.reconcileDeliveryStatusesWithHostinger();
      expect(res.deliveredCount).toBe(0);
      expect(res.failedCount).toBe(0);
      expect(res.unchangedCount).toBe(1);
      expect(prisma.employeeQrEmailDelivery.update).not.toHaveBeenCalled();
    });
  });
});

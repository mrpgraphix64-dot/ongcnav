import { Test, TestingModule } from '@nestjs/testing';
import { SuperAdminTestingService } from './super-admin-testing.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { SettingsService } from '../settings/settings.service';
import { ForbiddenException, BadRequestException } from '@nestjs/common';

describe('SuperAdminTestingService', () => {
  let service: SuperAdminTestingService;
  let prisma: any;
  let mailService: any;
  let settingsService: any;

  beforeEach(async () => {
    prisma = {
      commercialOrder: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: BigInt(1), email: 'admin@ongcnavratri.tech' }),
      },
    };

    mailService = {
      getMailboxAddress: jest.fn().mockReturnValue('ticket@ongcnavratri.tech'),
      isLiveMailConfigured: jest.fn().mockReturnValue(true),
      buildCommercialTicketEmail: jest.fn().mockResolvedValue({
        subject: 'ONGC Navratri 2026 Passes',
        html: '<html><body>Mock Email HTML</body></html>',
        text: 'Mock text',
        attachments: [],
      }),
      sendTestCommercialTicketEmail: jest.fn().mockResolvedValue({
        success: true,
        messageId: 'test-msg-123',
      }),
    };

    settingsService = {
      getPaymentSettings: jest.fn().mockResolvedValue({
        enabled: true,
        environment: 'TEST',
        gateway: 'Razorpay',
        keyId: 'rzp_test_123',
        isConfigured: true,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuperAdminTestingService,
        { provide: PrismaService, useValue: prisma },
        { provide: MailService, useValue: mailService },
        { provide: SettingsService, useValue: settingsService },
      ],
    }).compile();

    service = module.get<SuperAdminTestingService>(SuperAdminTestingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getTestingPreview', () => {
    it('should return preview with sample fixture when DB has no orders', async () => {
      const res = await service.getTestingPreview('SUPER_ADMIN');
      expect(res.order).toBeDefined();
      expect(res.order.isSampleFixture).toBe(true);
      expect(res.order.passes.length).toBeGreaterThan(0);
      expect(res.emailPreview.html).toContain('Mock Email HTML');
      expect(res.paymentGateway.gateway).toBe('Razorpay');
      expect(res.paymentGateway.status).toBe('ENABLED');
    });

    it('should return real latest paid order when found in DB', async () => {
      prisma.commercialOrder.findFirst = jest.fn().mockResolvedValue({
        id: BigInt(99),
        orderNumber: 'ORD-COMM-2026-REAL',
        customerName: 'Real Customer',
        customerMobile: '9998887776',
        customerEmail: 'real@example.com',
        ticketType: 'COMMERCIAL_SEASON',
        selectedDates: ['2026-10-11'],
        quantity: 1,
        amountPaise: 150000,
        orderStatus: 'PAID',
        paymentStatus: 'CAPTURED',
        razorpayPaymentId: 'pay_real_123',
        createdAt: new Date(),
        paidAt: new Date(),
        metadata: {},
        attendees: [
          {
            id: BigInt(101),
            ticketNumber: 'NR26-101',
            qrCodeToken: 'REAL_TOKEN_101',
            name: 'Real Customer',
            mobile: '9998887776',
            category: 'Season Pass',
            status: 'ACTIVE',
            bookingDays: ['2026-10-11'],
          },
        ],
      });

      const res = await service.getTestingPreview('SUPER_ADMIN');
      expect(res.order.orderNumber).toBe('ORD-COMM-2026-REAL');
      expect(res.order.isSampleFixture).toBe(false);
      expect(res.order.passes[0].qrSvg).toBeDefined();
    });

    it('should forbid non-SUPER_ADMIN users', async () => {
      await expect(service.getTestingPreview('EVENT_ADMIN')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('sendTestEmail', () => {
    it('should dispatch test email strictly to authenticated Super Admin session email', async () => {
      const res = await service.sendTestEmail({
        id: '1',
        role: 'SUPER_ADMIN',
        email: 'superadmin@ongc.in',
      });

      expect(res.success).toBe(true);
      expect(res.recipient).toBe('superadmin@ongc.in');
      expect(mailService.sendTestCommercialTicketEmail).toHaveBeenCalledWith(
        expect.any(Object),
        'superadmin@ongc.in',
      );
    });

    it('should look up email by id if not in user object', async () => {
      const res = await service.sendTestEmail({
        id: '1',
        role: 'SUPER_ADMIN',
      });

      expect(res.success).toBe(true);
      expect(res.recipient).toBe('admin@ongcnavratri.tech');
    });

    it('should forbid non-SUPER_ADMIN users from sending test emails', async () => {
      await expect(
        service.sendTestEmail({ id: '2', role: 'COMMERCIAL_ADMIN', email: 'comm@ongc.in' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});

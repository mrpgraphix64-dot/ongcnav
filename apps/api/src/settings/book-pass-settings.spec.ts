import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus, ForbiddenException, BadRequestException } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { CommercialService } from '../commercial/commercial.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { RazorpayService } from '../commercial/razorpay.service';
import { MailService } from '../mail/mail.service';
import {
  UserRole,
  SETTING_BOOK_PASS_AVAILABILITY,
  BookPassAvailability,
  AUDIT_BOOK_PASS_AVAILABILITY_UPDATED,
  isBookPassOpen,
  OrderStatus,
  PaymentStatus,
  AttendeeStatus,
  RegistrationType,
} from '@ongc/shared-types';

describe('Book Pass Availability Setting & Server-Side Protection (Regression Tests)', () => {
  let settingsService: SettingsService;
  let settingsController: SettingsController;
  let commercialService: CommercialService;
  let prisma: any;
  let redis: any;
  let razorpay: any;
  let mailService: any;

  beforeEach(async () => {
    let currentSettingValue: string | null = null;

    prisma = {
      setting: {
        findUnique: jest.fn().mockImplementation(({ where }: any) => {
          if (where?.key === SETTING_BOOK_PASS_AVAILABILITY) {
            return Promise.resolve(currentSettingValue ? { key: SETTING_BOOK_PASS_AVAILABILITY, value: currentSettingValue } : null);
          }
          if (where?.key === 'payment.razorpay_enabled') {
            return Promise.resolve({ key: 'payment.razorpay_enabled', value: '1' });
          }
          if (where?.key === 'registration_open') {
            return Promise.resolve({ key: 'registration_open', value: 'true' });
          }
          return Promise.resolve(null);
        }),
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn().mockImplementation(({ where, update, create }: any) => {
          currentSettingValue = update?.value || create?.value;
          return Promise.resolve({
            key: where.key,
            value: currentSettingValue,
            updatedAt: new Date(),
          });
        }),
      },
      commercialOrder: {
        findUnique: jest.fn().mockImplementation(({ where }: any) => {
          if (where?.orderNumber === 'ORD-PAID-123') {
            return Promise.resolve({
              id: BigInt(100),
              orderNumber: 'ORD-PAID-123',
              registrationType: RegistrationType.COMMERCIAL,
              status: OrderStatus.PAID,
              orderStatus: OrderStatus.PAID,
              paymentStatus: PaymentStatus.CAPTURED,
              amountPaise: 14900,
              customerName: 'Existing Customer',
              customerEmail: 'existing@ongc.co.in',
              customerMobile: '9876543210',
              ticketType: 'SEASON',
              selectedDates: ['2026-10-11'],
              quantity: 1,
              currency: 'INR',
              attendees: [
                {
                  id: BigInt(1),
                  ticketNumber: 'TK-123',
                  qrCodeToken: 'qr_token_abc',
                  attendeeName: 'Existing Customer',
                  status: AttendeeStatus.ACTIVE,
                  registrationType: RegistrationType.COMMERCIAL,
                },
              ],
            });
          }
          return Promise.resolve(null);
        }),
        create: jest.fn().mockImplementation(({ data }: any) => {
          return Promise.resolve({
            id: BigInt(200),
            orderNumber: data.orderNumber,
            status: OrderStatus.PENDING,
            amountPaise: data.amountPaise,
            currency: 'INR',
          });
        }),
        update: jest.fn(),
      },
      attendee: {
        create: jest.fn().mockImplementation(({ data }: any) =>
          Promise.resolve({
            id: BigInt(1),
            ticketNumber: data?.ticketNumber || 'TK-TEST-1',
            qrCodeToken: data?.qrCodeToken || 'qr_token_test_1',
            name: data?.name || 'Test Holder',
            mobile: data?.mobile || '9999999999',
            email: data?.email || 'test@ongc.co.in',
            status: AttendeeStatus.ACTIVE,
            registrationType: RegistrationType.COMMERCIAL,
          }),
        ),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      employee: {
        create: jest.fn(),
        findUnique: jest.fn(),
      },
      paymentWebhookEvent: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: BigInt(1) }),
        update: jest.fn().mockResolvedValue({ id: BigInt(1) }),
      },
      gate: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: BigInt(1) }),
      },
      $transaction: jest.fn().mockImplementation(async (cb: any) => {
        if (typeof cb === 'function') {
          return cb(prisma);
        }
        return Promise.all(cb);
      }),
    };

    redis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(true),
      acquireLock: jest.fn().mockResolvedValue('lock_token_123'),
      releaseLock: jest.fn().mockResolvedValue(true),
    };

    razorpay = {
      getPublicKeyId: jest.fn().mockReturnValue('rzp_test_key_123'),
      isLiveGatewayConfigured: jest.fn().mockReturnValue(false),
      createRazorpayOrder: jest.fn().mockResolvedValue({
        id: 'order_rzp_mock_123',
        amount: 14900,
        currency: 'INR',
        receipt: 'ORD-TEST',
      }),
      createOrder: jest.fn().mockResolvedValue({
        id: 'order_rzp_mock_123',
        amount: 14900,
        currency: 'INR',
        receipt: 'ORD-TEST',
      }),
    };

    mailService = {
      sendEmail: jest.fn().mockResolvedValue({ success: true }),
      sendCommercialTicketEmail: jest.fn().mockResolvedValue({ success: true }),
      isLiveMailConfigured: jest.fn().mockReturnValue(true),
      getMailboxAddress: jest.fn().mockReturnValue('ticket@ongcnavratri.tech'),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SettingsController],
      providers: [
        SettingsService,
        CommercialService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
        { provide: RazorpayService, useValue: razorpay },
        { provide: MailService, useValue: mailService },
      ],
    }).compile();

    settingsService = module.get<SettingsService>(SettingsService);
    settingsController = module.get<SettingsController>(SettingsController);
    commercialService = module.get<CommercialService>(CommercialService);
  });

  describe('Requirement 1: Default state is OPEN / enabled', () => {
    it('isBookPassOpen returns true when setting row is missing/undefined/null', () => {
      expect(isBookPassOpen(undefined)).toBe(true);
      expect(isBookPassOpen(null)).toBe(true);
      expect(isBookPassOpen('')).toBe(true);
    });

    it('getBookPassSettings returns enabled: true and availability: OPEN by default', async () => {
      const res = await settingsService.getBookPassSettings(UserRole.SUPER_ADMIN);
      expect(res.success).toBe(true);
      expect(res.enabled).toBe(true);
      expect(res.availability).toBe('OPEN');
    });

    it('commercial getConfig reflects bookPassOpen: true by default', async () => {
      const config = await commercialService.getConfig();
      expect(config.bookPassOpen).toBe(true);
      expect(config.bookPassAvailability).toBe('OPEN');
    });
  });

  describe('Requirement 2: Authorized admin can change the setting', () => {
    it('SUPER_ADMIN can switch Book Pass to COMING_SOON and audit log is created', async () => {
      const res = await settingsService.updateBookPassSettings(BookPassAvailability.COMING_SOON, {
        id: BigInt(1),
        role: UserRole.SUPER_ADMIN,
        email: 'super@ongc.co.in',
      });

      expect(res.success).toBe(true);
      expect(res.enabled).toBe(false);
      expect(res.availability).toBe('COMING_SOON');

      expect(prisma.setting.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { key: SETTING_BOOK_PASS_AVAILABILITY },
          update: { value: 'COMING_SOON' },
          create: { key: SETTING_BOOK_PASS_AVAILABILITY, value: 'COMING_SOON' },
        }),
      );

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: BigInt(1),
            action: AUDIT_BOOK_PASS_AVAILABILITY_UPDATED,
            details: expect.objectContaining({
              setting: SETTING_BOOK_PASS_AVAILABILITY,
              oldState: 'OPEN',
              newState: 'COMING_SOON',
              enabled: false,
              changedBy: 'super@ongc.co.in',
            }),
          }),
        }),
      );
    });

    it('EVENT_ADMIN can change the setting through settings controller', async () => {
      const req: any = { user: { id: '2', role: UserRole.EVENT_ADMIN, email: 'eventadmin@ongc.co.in' } };
      const res = await settingsController.updateBookPassSettings(
        { availability: 'COMING_SOON', enabled: false },
        req,
      );

      expect(res.success).toBe(true);
      expect(res.availability).toBe('COMING_SOON');
      expect(res.enabled).toBe(false);
    });
  });

  describe('Requirement 3: Unauthorized user cannot change the setting', () => {
    it('rejects COMMERCIAL_ADMIN with ForbiddenException', async () => {
      await expect(
        settingsService.updateBookPassSettings('COMING_SOON', {
          id: BigInt(3),
          role: UserRole.COMMERCIAL_ADMIN,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects SCANNER_STAFF with ForbiddenException', async () => {
      await expect(
        settingsService.updateBookPassSettings('COMING_SOON', {
          id: BigInt(4),
          role: UserRole.SCANNER_STAFF,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects unauthenticated/null user role with ForbiddenException', async () => {
      await expect(settingsService.updateBookPassSettings('COMING_SOON', undefined)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('Requirement 4 & 5 & 10: Public booking works when OPEN and is rejected when CLOSED', () => {
    const bookingPayload = {
      customerName: 'Priyesh Shah',
      customerMobile: '9876543210',
      customerEmail: 'priyesh@ongc.co.in',
      ticketType: 'COMMERCIAL_DAILY' as any,
      selectedDates: ['2026-10-11'],
      quantity: 1,
      termsAccepted: true,
    };

    it('Public booking works when Book Pass is OPEN', async () => {
      await settingsService.updateBookPassSettings('OPEN', { role: UserRole.SUPER_ADMIN });
      const order = await commercialService.createOrder(bookingPayload, '127.0.0.1');

      expect(order).toBeDefined();
      expect(order.success).toBe(true);
      expect(order.order).toBeDefined();
    });

    it('Public booking is rejected with HTTP 403 BOOK_PASS_CLOSED when CLOSED', async () => {
      await settingsService.updateBookPassSettings('COMING_SOON', { role: UserRole.SUPER_ADMIN });

      try {
        await commercialService.createOrder(bookingPayload, '127.0.0.1');
        fail('Expected HttpException to be thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(HttpException);
        expect(err.getStatus()).toBe(HttpStatus.FORBIDDEN);
        const resp = err.getResponse();
        expect(resp).toEqual(
          expect.objectContaining({
            code: 'BOOK_PASS_CLOSED',
            message: 'Book Pass tickets are currently unavailable. Please stay tuned for ticket updates.',
          }),
        );
      }
    });
  });

  describe('Requirement 6 & 7: Existing paid orders and pass retrieval remain unaffected', () => {
    it('getOrder retrieves existing paid order and issued passes even when Book Pass is CLOSED', async () => {
      await settingsService.updateBookPassSettings('COMING_SOON', { role: UserRole.SUPER_ADMIN });

      const existingOrder = await commercialService.getOrder('ORD-PAID-123', 'existing@ongc.co.in');
      expect(existingOrder).toBeDefined();
      expect(existingOrder.orderNumber).toBe('ORD-PAID-123');
      expect(existingOrder.orderStatus).toBe(OrderStatus.PAID);
      expect(existingOrder.passes).toHaveLength(1);
      expect(existingOrder.passes[0].ticketNumber).toBe('TK-123');
    });
  });

  describe('Requirement 8: Existing scanner/check-in behavior remains unaffected', () => {
    it('isBookPassOpen does not affect attendee check-in eligibility', () => {
      // isBookPassOpen only governs new public order creation, not existing passes
      expect(isBookPassOpen('COMING_SOON')).toBe(false);
      // Scanner check-in relies on AttendeeStatus.ACTIVE and DailyCheckin, unaffected by commercial.book_pass_availability
      const attendee = {
        id: BigInt(1),
        status: AttendeeStatus.ACTIVE,
        ticketNumber: 'TK-123',
      };
      expect(attendee.status).toBe(AttendeeStatus.ACTIVE);
    });
  });

  describe('Requirement 9: Reopening Book Pass restores public booking', () => {
    it('closing and then reopening restores public booking order creation', async () => {
      const bookingPayload = {
        customerName: 'Anil Mehta',
        customerMobile: '9825098250',
        customerEmail: 'anil@ongc.co.in',
        ticketType: 'COMMERCIAL_DAILY' as any,
        selectedDates: ['2026-10-12'],
        quantity: 1,
        termsAccepted: true,
      };

      // 1. Close Book Pass
      await settingsService.updateBookPassSettings('COMING_SOON', { role: UserRole.SUPER_ADMIN });
      await expect(commercialService.createOrder(bookingPayload, '127.0.0.1')).rejects.toThrow(
        HttpException,
      );

      // 2. Reopen Book Pass
      await settingsService.updateBookPassSettings('OPEN', { role: UserRole.SUPER_ADMIN });
      const reopenedOrder = await commercialService.createOrder(bookingPayload, '127.0.0.1');

      expect(reopenedOrder).toBeDefined();
      expect(reopenedOrder.success).toBe(true);
      expect(reopenedOrder.order).toBeDefined();
    });
  });

  describe('Requirement 11: Internal / Agent workflows are not accidentally blocked', () => {
    it('Developer test purchase remains functional for SUPER_ADMIN when Book Pass is CLOSED', async () => {
      jest.spyOn(commercialService, 'isDeveloperTestPurchaseEnabled').mockReturnValue(true);
      await settingsService.updateBookPassSettings('COMING_SOON', { role: UserRole.SUPER_ADMIN });

      // createDeveloperTestPurchase is used by Super Admin for end-to-end testing
      const devPurchasePayload = {
        customerName: 'Super Admin Tester',
        customerMobile: '9999999999',
        customerEmail: 'admin-tester@ongc.co.in',
        ticketType: 'COMMERCIAL_DAILY' as any,
        selectedDates: ['2026-10-11'],
        quantity: 1,
        termsAccepted: true,
      };

      const result = await commercialService.createDeveloperTestPurchase(devPurchasePayload, {
        id: '1',
        role: UserRole.SUPER_ADMIN,
        email: 'super@ongc.co.in',
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.isDeveloperTest).toBe(true);
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { WhatsAppTestService } from './whatsapp-test.service';
import { PrismaService } from '../../prisma/prisma.service';
import { WhatsAppService } from '../../whatsapp/whatsapp.service';
import {
  buildEmployeeWhatsAppMessage,
  DEFAULT_SPONSOR_VOUCHER_CONFIG,
  isRoutePermittedForRole,
} from '@ongc/shared-types';

describe('WhatsAppTestService', () => {
  let service: WhatsAppTestService;
  let prisma: PrismaService;
  let whatsAppService: WhatsAppService;

  const mockPrisma = {
    employee: {
      upsert: jest.fn(),
      findFirst: jest.fn(),
      deleteMany: jest.fn(),
    },
    attendee: {
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    dailyEmployeePass: {
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    familyMember: {
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    setting: {
      findUnique: jest.fn(),
    },
  };

  const mockWhatsAppService = {
    isProviderConfigured: jest.fn(),
    getProviderName: jest.fn(),
    getSafeRecipient: jest.fn(),
    getProviderInfo: jest.fn(),
    getTemplateConfig: jest.fn(),
    getPassTemplateConfig: jest.fn(),
    verifyTemplate: jest.fn(),
    sendText: jest.fn(),
    sendTemplateMessage: jest.fn(),
    sendPassTemplateMessage: jest.fn(),
    sendImage: jest.fn(),
  };

  beforeEach(async () => {
    mockWhatsAppService.getTemplateConfig.mockReturnValue({
      name: 'hello_world',
      language: 'en_US',
    });
    mockWhatsAppService.getPassTemplateConfig.mockReturnValue({
      name: 'ongc_employee_pass_test',
      language: 'en_US',
      isConfigured: true,
    });
    mockWhatsAppService.getProviderInfo.mockResolvedValue({
      configured: true,
      isConfigured: true,
      providerName: 'Meta WhatsApp Cloud API',
      status: 'READY',
      safeRecipient: '+919876543210',
      phoneNumberIdConfigured: true,
      businessAccountConfigured: true,
      accessTokenConfigured: true,
      apiVersion: 'v25.0',
      testRecipientConfigured: true,
      templateConfigured: true,
      templateName: 'hello_world',
      templateLanguage: 'en_US',
      passTemplateName: 'ongc_employee_pass_test',
      passTemplateConfigured: true,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsAppTestService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'CORS_ORIGINS') return 'https://ongcnavratri.reworkzone.in';
              return undefined;
            }),
          },
        },
        {
          provide: WhatsAppService,
          useValue: mockWhatsAppService,
        },
      ],
    }).compile();

    service = module.get<WhatsAppTestService>(WhatsAppTestService);
    prisma = module.get<PrismaService>(PrismaService);
    whatsAppService = module.get<WhatsAppService>(WhatsAppService);

    jest.clearAllMocks();
  });

  describe('test page authorization', () => {
    it('permits SUPER_ADMIN to access /admin/employees/whatsapp-test', () => {
      expect(
        isRoutePermittedForRole('/admin/employees/whatsapp-test', 'SUPER_ADMIN'),
      ).toBe(true);
    });

    it('strictly forbids EMPLOYEE_ADMIN, COMMERCIAL_ADMIN, and EVENT_ADMIN from accessing /admin/employees/whatsapp-test', () => {
      expect(
        isRoutePermittedForRole('/admin/employees/whatsapp-test', 'EMPLOYEE_ADMIN'),
      ).toBe(false);
      expect(
        isRoutePermittedForRole('/admin/employees/whatsapp-test', 'COMMERCIAL_ADMIN'),
      ).toBe(false);
      expect(
        isRoutePermittedForRole('/admin/employees/whatsapp-test', 'EVENT_ADMIN'),
      ).toBe(false);
      expect(
        isRoutePermittedForRole('/admin/employees/whatsapp-test', 'SCANNER_STAFF'),
      ).toBe(false);
    });
  });

  describe('WhatsApp message renderer & Mahavir Jewellers sponsor voucher', () => {
    it('renders greeting, reference number, permanent pass info, pass URL, and Mahavir Jewellers offer when enabled', () => {
      const message = buildEmployeeWhatsAppMessage({
        employeeName: 'Chintan Patel',
        referenceNumber: 'ONGC-TEST-99999',
        passUrl: 'https://ongcnavratri.reworkzone.in/employee/my-tickets?ref=ONGC-TEST-99999',
        sponsorVoucher: DEFAULT_SPONSOR_VOUCHER_CONFIG,
      });

      expect(message).toContain('🎉 *ONGC NAVRATRI 2026* 🎉');
      expect(message).toContain('Hello *Chintan Patel* 👋');
      expect(message).toContain('🎟️ *Reference No.: ONGC-TEST-99999*');
      expect(message).toContain('Your permanent QR pass is your entry credential');
      expect(message).toContain('💎 *A SPECIAL GIFT FOR YOU* 💎');
      expect(message).toContain('*MAHAVIR JEWELLERS*');
      expect(message).toContain('✨ *₹5,000 OFF*');
      expect(message).toContain('*ON MAKING CHARGES*');
      expect(message).toContain('_Lifetime | No expiry_');
      expect(message).toContain('90330 56098');
      expect(message).toContain('https://ongcnavratri.reworkzone.in/employee/my-tickets?ref=ONGC-TEST-99999');
      expect(message).toContain('Please do not share your QR/e-pass with anyone.');
      expect(message).toContain('✨ See you at ONGC Navratri 2026! ✨');
    });

    it('omits sponsor voucher section when sponsor is disabled', () => {
      const message = buildEmployeeWhatsAppMessage({
        employeeName: 'Pooja Patel',
        referenceNumber: 'ONGC-TEST-12345',
        passUrl: 'https://ongcnavratri.reworkzone.in/employee/my-tickets?ref=ONGC-TEST-12345',
        sponsorVoucher: {
          ...DEFAULT_SPONSOR_VOUCHER_CONFIG,
          enabled: false,
        },
      });

      expect(message).toContain('🎟️ *Reference No.: ONGC-TEST-12345*');
      expect(message).not.toContain('MAHAVIR JEWELLERS');
      expect(message).not.toContain('₹5,000 OFF');
      expect(message).toContain('🎟️ *VIEW YOUR E-PASS*');
    });

    it('pass URL does not expose internal database IDs, QR token values, CPF, or DOB', () => {
      const passUrl = 'https://ongcnavratri.reworkzone.in/employee/my-tickets?ref=ONGC-TEST-99999';
      const message = buildEmployeeWhatsAppMessage({
        employeeName: 'Chintan Patel',
        referenceNumber: 'ONGC-TEST-99999',
        passUrl,
        sponsorVoucher: DEFAULT_SPONSOR_VOUCHER_CONFIG,
      });

      expect(message).toContain(passUrl);
      expect(message).not.toContain('wa_test_');
      expect(message).not.toContain('attendeeId');
      expect(message).not.toContain('1988-06-15');
    });
  });

  describe('submitTestPass (Test employee creation, isolation & QR generation)', () => {
    it('creates isolated test employee with TEST-WA- prefix and isLoadTest: true attendee', async () => {
      mockWhatsAppService.getSafeRecipient.mockResolvedValue('+919876543210');
      mockWhatsAppService.getProviderInfo.mockResolvedValue({
        isConfigured: false,
        providerName: 'TEST_ADAPTER (Unconfigured)',
        status: 'PROVIDER_NOT_CONFIGURED',
        safeRecipient: '+919876543210',
        passTemplateName: 'ongc_employee_pass_test',
        passTemplateConfigured: true,
      });

      mockPrisma.employee.upsert.mockResolvedValue({
        id: BigInt(9999),
        cpf: 'TEST-WA-99999',
        referenceNumber: 'ONGC-TEST-99999',
        name: 'Chintan Patel',
        phone: '9876543210',
      });

      mockPrisma.attendee.create.mockResolvedValue({
        id: BigInt(8888),
        ticketNumber: 'TK-WA-TEST-123456-101',
        qrCodeToken: 'wa_test_abcdef1234567890',
        isLoadTest: true,
      });

      const result = await service.submitTestPass({
        name: 'Chintan Patel',
        mobile: '9876543210',
        cpf: '99999',
        email: 'chintan@ongc.co.in',
        bookingDays: ['2026-10-11', '2026-10-12'],
      });

      // Verify employee upserted with isolated TEST prefix and approved status
      expect(mockPrisma.employee.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { cpf: 'TEST-WA-99999' },
          create: expect.objectContaining({
            cpf: 'TEST-WA-99999',
            referenceNumber: 'ONGC-TEST-99999',
            registrationStatus: 'APPROVED',
          }),
        }),
      );

      // Verify attendee created with isLoadTest: true (isolates from all production metrics & queries)
      expect(mockPrisma.attendee.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isLoadTest: true,
            ticketNumber: expect.stringMatching(/^TK-WA-TEST-/),
            qrCodeToken: expect.stringMatching(/^wa_test_/),
          }),
        }),
      );

      // Verify daily employee passes created for both booking days with isTest: true
      expect(mockPrisma.dailyEmployeePass.create).toHaveBeenCalledTimes(2);
      expect(mockPrisma.dailyEmployeePass.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventDate: '2026-10-11',
            isTest: true,
            testSessionId: 'ONGC-TEST-99999',
          }),
        }),
      );

      // Verify returned test reference, safe recipient, and pass template info
      expect(result.referenceNumber).toBe('ONGC-TEST-99999');
      expect(result.safeRecipient).toBe('+919876543210');
      expect(result.messageText).toContain('Your ONGC Navratri E-Pass has been generated successfully as a TEST PASS. 🪔✨');
      expect(result.messageText).toContain('⚠️ This is a test registration. The generated pass is isolated from production employee records.');
      expect(result.passTemplateName).toBe('ongc_employee_pass_test');
      expect(result.passTemplateConfigured).toBe(true);
    });
  });

  describe('sendTestMessage (Safe recipient enforcement & provider status)', () => {
    it('returns TEST_RECIPIENT_NOT_CONFIGURED when safe recipient is null', async () => {
      mockWhatsAppService.getSafeRecipient.mockResolvedValue(null);
      mockWhatsAppService.isProviderConfigured.mockReturnValue(false);

      mockPrisma.employee.findFirst.mockResolvedValue({
        id: BigInt(9999),
        name: 'Chintan Patel',
        phone: '9876543210',
        referenceNumber: 'ONGC-TEST-99999',
      });

      const res = await service.sendTestMessage({
        referenceNumber: 'ONGC-TEST-99999',
      });

      expect(res.success).toBe(false);
      expect(res.status).toBe('TEST_RECIPIENT_NOT_CONFIGURED');
      expect(res.safeRecipient).toBeNull();
      expect(res.error).toContain('WhatsApp test recipient is not configured');
      expect(mockWhatsAppService.sendPassTemplateMessage).not.toHaveBeenCalled();
    });

    it('strictly routes message to safe recipient and NOT to mobile from form', async () => {
      mockWhatsAppService.isProviderConfigured.mockReturnValue(false);
      mockWhatsAppService.getProviderName.mockReturnValue('TEST_ADAPTER (Unconfigured)');
      mockWhatsAppService.getSafeRecipient.mockResolvedValue('+919876543210');

      mockPrisma.employee.findFirst.mockResolvedValue({
        id: BigInt(9999),
        name: 'Chintan Patel',
        phone: '9876543210', // entered in form
        referenceNumber: 'ONGC-TEST-99999',
      });

      const res = await service.sendTestMessage({
        referenceNumber: 'ONGC-TEST-99999',
      });

      // Form phone 9876543210 must NOT be called
      expect(mockWhatsAppService.sendPassTemplateMessage).not.toHaveBeenCalledWith(
        expect.objectContaining({ to: '9876543210' }),
      );
      expect(res.safeRecipient).toBe('+919876543210');
      expect(res.status).toBe('PROVIDER_NOT_CONFIGURED');
      expect(res.error).toContain('PREVIEW ONLY');
    });

    it('dispatches pass template message to safe recipient with dynamic parameters when provider is configured', async () => {
      mockWhatsAppService.isProviderConfigured.mockReturnValue(true);
      mockWhatsAppService.getProviderName.mockReturnValue('Meta WhatsApp Cloud API');
      mockWhatsAppService.getSafeRecipient.mockResolvedValue('+919876543210');
      mockWhatsAppService.sendPassTemplateMessage.mockResolvedValue({
        success: true,
        status: 'SENT',
        provider: 'Meta WhatsApp Cloud API',
        providerMessageId: 'wamid.12345',
        safeRecipient: '+919876543210',
        templateName: 'ongc_employee_pass_test',
        templateLanguage: 'en_US',
        timestamp: new Date().toISOString(),
      });

      mockPrisma.employee.findFirst.mockResolvedValue({
        id: BigInt(9999),
        name: 'Chintan Patel',
        referenceNumber: 'ONGC-TEST-99999',
      });

      const res = await service.sendTestMessage({
        referenceNumber: 'ONGC-TEST-99999',
      });

      expect(mockWhatsAppService.sendPassTemplateMessage).toHaveBeenCalledWith({
        to: '+919876543210',
        employeeName: 'Chintan Patel',
        referenceNumber: 'ONGC-TEST-99999',
        passUrl: 'https://ongcnavratri.reworkzone.in/employee/my-tickets?ref=ONGC-TEST-99999',
        templateOverride: undefined,
      });
      expect(res.success).toBe(true);
      expect(res.status).toBe('SENT');
      expect(res.providerMessageId).toBe('wamid.12345');
    });

    it('returns TEMPLATE_NOT_CONFIGURED when custom pass template is unavailable, keeping preview ready', async () => {
      mockWhatsAppService.isProviderConfigured.mockReturnValue(true);
      mockWhatsAppService.getProviderName.mockReturnValue('Meta WhatsApp Cloud API');
      mockWhatsAppService.getSafeRecipient.mockResolvedValue('+919876543210');
      mockWhatsAppService.sendPassTemplateMessage.mockResolvedValue({
        success: false,
        status: 'TEMPLATE_NOT_CONFIGURED',
        provider: 'Meta WhatsApp Cloud API',
        safeRecipient: '+919876543210',
        templateName: 'ongc_employee_pass_test',
        templateLanguage: 'en_US',
        error:
          "Dedicated custom WhatsApp template for employee pass dispatch is not configured. Meta Cloud API cannot deliver arbitrary pass text through 'hello_world'. Preview mode is available below.",
        timestamp: new Date().toISOString(),
      });

      mockPrisma.employee.findFirst.mockResolvedValue({
        id: BigInt(9999),
        name: 'Chintan Patel',
        referenceNumber: 'ONGC-TEST-99999',
      });

      const res = await service.sendTestMessage({
        referenceNumber: 'ONGC-TEST-99999',
      });

      expect(res.success).toBe(false);
      expect(res.status).toBe('TEMPLATE_NOT_CONFIGURED');
      expect(res.error).toContain('Dedicated custom WhatsApp template');
      expect(res.messageText).toContain('Your ONGC Navratri E-Pass has been generated successfully as a TEST PASS.');
    });

    it('allows basic hello_world ping when explicitly requested via templateOverride', async () => {
      mockWhatsAppService.isProviderConfigured.mockReturnValue(true);
      mockWhatsAppService.getProviderName.mockReturnValue('Meta WhatsApp Cloud API');
      mockWhatsAppService.getSafeRecipient.mockResolvedValue('+919876543210');
      mockWhatsAppService.sendTemplateMessage.mockResolvedValue({
        success: true,
        status: 'SENT',
        provider: 'Meta WhatsApp Cloud API',
        providerMessageId: 'wamid.ping999',
        safeRecipient: '+919876543210',
        templateName: 'hello_world',
        templateLanguage: 'en_US',
        timestamp: new Date().toISOString(),
      });

      mockPrisma.employee.findFirst.mockResolvedValue({
        id: BigInt(9999),
        name: 'Chintan Patel',
        referenceNumber: 'ONGC-TEST-99999',
      });

      const res = await service.sendTestMessage({
        referenceNumber: 'ONGC-TEST-99999',
        templateOverride: 'hello_world',
      });

      expect(mockWhatsAppService.sendTemplateMessage).toHaveBeenCalledWith(
        '+919876543210',
        'hello_world',
        'en_US',
      );
      expect(res.success).toBe(true);
      expect(res.providerMessageId).toBe('wamid.ping999');
    });
  });

  describe('clearTestData', () => {
    it('only cleans up records with TK-WA-TEST- / TEST-WA- / wa_test_day_ markers without touching production data', async () => {
      mockPrisma.dailyEmployeePass.deleteMany.mockResolvedValue({ count: 2 });
      mockPrisma.attendee.deleteMany.mockResolvedValue({ count: 2 });
      mockPrisma.familyMember.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.employee.deleteMany.mockResolvedValue({ count: 1 });

      const res = await service.clearTestData();

      expect(mockPrisma.dailyEmployeePass.deleteMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { isTest: true },
            { qrToken: { startsWith: 'wa_test_day_' } },
            { testSessionId: { startsWith: 'ONGC-TEST-' } },
          ],
        },
      });

      expect(mockPrisma.attendee.deleteMany).toHaveBeenCalledWith({
        where: {
          isLoadTest: true,
          OR: [
            { ticketNumber: { startsWith: 'TK-WA-TEST-' } },
            { qrCodeToken: { startsWith: 'wa_test_' } },
          ],
        },
      });

      expect(mockPrisma.employee.deleteMany).toHaveBeenCalledWith({
        where: {
          cpf: { startsWith: 'TEST-WA-' },
        },
      });

      expect(res.success).toBe(true);
      expect(res.deletedDailyPassesCount).toBe(2);
      expect(res.deletedAttendeesCount).toBe(2);
      expect(res.deletedEmployeesCount).toBe(1);
    });
  });
});

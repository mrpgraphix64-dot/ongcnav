import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { WhatsAppService } from './whatsapp.service';
import { PrismaService } from '../prisma/prisma.service';

describe('WhatsAppService', () => {
  let service: WhatsAppService;
  let configService: ConfigService;
  let prisma: PrismaService;

  const mockPrisma = {
    setting: {
      findUnique: jest.fn(),
    },
  };

  const mockConfigValues: Record<string, string | undefined> = {
    WHATSAPP_ACCESS_TOKEN: undefined,
    WHATSAPP_PHONE_NUMBER_ID: undefined,
    WHATSAPP_BUSINESS_ACCOUNT_ID: undefined,
    WHATSAPP_API_VERSION: undefined,
    WHATSAPP_TEST_RECIPIENT: undefined,
    WHATSAPP_TEST_TEMPLATE_NAME: undefined,
    WHATSAPP_TEST_TEMPLATE_LANGUAGE: undefined,
  };

  beforeEach(async () => {
    mockConfigValues.WHATSAPP_ACCESS_TOKEN = undefined;
    mockConfigValues.WHATSAPP_PHONE_NUMBER_ID = undefined;
    mockConfigValues.WHATSAPP_BUSINESS_ACCOUNT_ID = undefined;
    mockConfigValues.WHATSAPP_API_VERSION = undefined;
    mockConfigValues.WHATSAPP_TEST_RECIPIENT = undefined;
    mockConfigValues.WHATSAPP_TEST_TEMPLATE_NAME = undefined;
    mockConfigValues.WHATSAPP_TEST_TEMPLATE_LANGUAGE = undefined;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsAppService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => mockConfigValues[key]),
          },
        },
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<WhatsAppService>(WhatsAppService);
    configService = module.get<ConfigService>(ConfigService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('isProviderConfigured', () => {
    it('returns false when credentials are empty/undefined', () => {
      mockConfigValues.WHATSAPP_ACCESS_TOKEN = undefined;
      mockConfigValues.WHATSAPP_PHONE_NUMBER_ID = undefined;
      expect(service.isProviderConfigured()).toBe(false);
    });

    it('returns true when valid credentials are present', () => {
      mockConfigValues.WHATSAPP_ACCESS_TOKEN = 'test_access_token_123';
      mockConfigValues.WHATSAPP_PHONE_NUMBER_ID = '1000123456789';
      expect(service.isProviderConfigured()).toBe(true);
    });
  });

  describe('getApiVersion', () => {
    it('defaults to v25.0 when WHATSAPP_API_VERSION is not configured', () => {
      mockConfigValues.WHATSAPP_API_VERSION = undefined;
      expect(service.getApiVersion()).toBe('v25.0');
    });

    it('returns configured API version with leading v if provided', () => {
      mockConfigValues.WHATSAPP_API_VERSION = 'v25.0';
      expect(service.getApiVersion()).toBe('v25.0');
    });

    it('prepends v if user specifies version as plain number string', () => {
      mockConfigValues.WHATSAPP_API_VERSION = '25.0';
      expect(service.getApiVersion()).toBe('v25.0');
    });
  });

  describe('getTemplateConfig', () => {
    it('defaults to hello_world and en_US when unset', () => {
      expect(service.getTemplateConfig()).toEqual({
        name: 'hello_world',
        language: 'en_US',
      });
    });

    it('returns configured template name and language', () => {
      mockConfigValues.WHATSAPP_TEST_TEMPLATE_NAME = 'ongc_epass_ready';
      mockConfigValues.WHATSAPP_TEST_TEMPLATE_LANGUAGE = 'gu_IN';
      expect(service.getTemplateConfig()).toEqual({
        name: 'ongc_epass_ready',
        language: 'gu_IN',
      });
    });
  });

  describe('normalizePhoneNumber', () => {
    it('normalizes 10-digit Indian numbers to E.164 with +91', () => {
      expect(service.normalizePhoneNumber('8401060482')).toBe('+918401060482');
      expect(service.normalizePhoneNumber('84010-60482')).toBe('+918401060482');
    });

    it('normalizes 12-digit Indian numbers without plus', () => {
      expect(service.normalizePhoneNumber('918401060482')).toBe('+918401060482');
    });

    it('preserves existing +91 prefixed numbers', () => {
      expect(service.normalizePhoneNumber('+918401060482')).toBe('+918401060482');
    });
  });

  describe('getSafeRecipient', () => {
    it('returns database setting if configured', async () => {
      mockPrisma.setting.findUnique.mockResolvedValueOnce({
        key: 'whatsapp.test_recipient',
        value: '918401060482',
      });
      const recipient = await service.getSafeRecipient();
      expect(recipient).toBe('+918401060482');
    });

    it('returns WHATSAPP_TEST_RECIPIENT env when db setting is missing', async () => {
      mockPrisma.setting.findUnique.mockResolvedValueOnce(null);
      mockConfigValues.WHATSAPP_TEST_RECIPIENT = '918401060482';
      const recipient = await service.getSafeRecipient();
      expect(recipient).toBe('+918401060482');
    });

    it('returns null when neither db setting nor WHATSAPP_TEST_RECIPIENT is configured', async () => {
      mockPrisma.setting.findUnique.mockResolvedValueOnce(null);
      mockConfigValues.WHATSAPP_TEST_RECIPIENT = undefined;
      const recipient = await service.getSafeRecipient();
      expect(recipient).toBeNull();
    });
  });

  describe('getProviderInfo', () => {
    it('returns PROVIDER_NOT_CONFIGURED when token or phone ID is missing', async () => {
      mockPrisma.setting.findUnique.mockResolvedValueOnce(null);
      mockConfigValues.WHATSAPP_ACCESS_TOKEN = undefined;
      mockConfigValues.WHATSAPP_PHONE_NUMBER_ID = undefined;

      const info = await service.getProviderInfo();
      expect(info.configured).toBe(false);
      expect(info.status).toBe('PROVIDER_NOT_CONFIGURED');
    });

    it('returns TEST_RECIPIENT_NOT_CONFIGURED when provider is configured but safe recipient is null', async () => {
      mockPrisma.setting.findUnique.mockResolvedValueOnce(null);
      mockConfigValues.WHATSAPP_ACCESS_TOKEN = 'test_token';
      mockConfigValues.WHATSAPP_PHONE_NUMBER_ID = '1423180970868591';
      mockConfigValues.WHATSAPP_TEST_RECIPIENT = undefined;

      const info = await service.getProviderInfo();
      expect(info.configured).toBe(true);
      expect(info.safeRecipient).toBeNull();
      expect(info.status).toBe('TEST_RECIPIENT_NOT_CONFIGURED');
    });

    it('returns READY with metadata when provider is configured and safe recipient is set', async () => {
      mockPrisma.setting.findUnique.mockResolvedValueOnce(null);
      mockConfigValues.WHATSAPP_ACCESS_TOKEN = 'test_token';
      mockConfigValues.WHATSAPP_PHONE_NUMBER_ID = '1423180970868591';
      mockConfigValues.WHATSAPP_BUSINESS_ACCOUNT_ID = '1618300106696470';
      mockConfigValues.WHATSAPP_TEST_RECIPIENT = '918401060482';

      const info = await service.getProviderInfo();
      expect(info.configured).toBe(true);
      expect(info.safeRecipient).toBe('+918401060482');
      expect(info.phoneNumberIdConfigured).toBe(true);
      expect(info.businessAccountConfigured).toBe(true);
      expect(info.templateName).toBe('hello_world');
      expect(info.templateLanguage).toBe('en_US');
      expect(info.status).toBe('READY');
    });
  });

  describe('verifyTemplate', () => {
    it('always approves standard hello_world template', async () => {
      const res = await service.verifyTemplate('hello_world', 'en_US');
      expect(res.exists).toBe(true);
      expect(res.approved).toBe(true);
    });

    it('fails custom template if WHATSAPP_BUSINESS_ACCOUNT_ID is missing', async () => {
      mockConfigValues.WHATSAPP_ACCESS_TOKEN = 'valid_token';
      mockConfigValues.WHATSAPP_BUSINESS_ACCOUNT_ID = undefined;

      const res = await service.verifyTemplate('custom_tpl', 'en_US');
      expect(res.approved).toBe(false);
      expect(res.error).toContain('WHATSAPP_BUSINESS_ACCOUNT_ID required');
    });
  });

  describe('sendTemplateMessage', () => {
    it('returns TEST_RECIPIENT_NOT_CONFIGURED when recipient is null or empty', async () => {
      const result = await service.sendTemplateMessage(null);
      expect(result.success).toBe(false);
      expect(result.status).toBe('TEST_RECIPIENT_NOT_CONFIGURED');
      expect(result.error).toContain('WhatsApp test recipient is not configured');
    });

    it('returns PROVIDER_NOT_CONFIGURED without calling network if provider not configured', async () => {
      mockConfigValues.WHATSAPP_ACCESS_TOKEN = undefined;
      mockConfigValues.WHATSAPP_PHONE_NUMBER_ID = undefined;

      const result = await service.sendTemplateMessage('+918401060482');
      expect(result.success).toBe(false);
      expect(result.status).toBe('PROVIDER_NOT_CONFIGURED');
      expect(result.error).toContain('not configured');
    });

    it('dispatches Meta template message and returns SENT with provider message ID on success', async () => {
      mockConfigValues.WHATSAPP_ACCESS_TOKEN = 'secret_access_token_123';
      mockConfigValues.WHATSAPP_PHONE_NUMBER_ID = '1423180970868591';
      mockConfigValues.WHATSAPP_API_VERSION = 'v25.0';

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          messaging_product: 'whatsapp',
          contacts: [{ input: '918401060482', wa_id: '918401060482' }],
          messages: [{ id: 'wamid.HBgLMTQyMzE4MDk3MDg2ODU5MQ==' }],
        }),
      } as any);

      const result = await service.sendTemplateMessage('+918401060482', 'hello_world', 'en_US');
      expect(result.success).toBe(true);
      expect(result.status).toBe('SENT');
      expect(result.provider).toBe('Meta WhatsApp Cloud API');
      expect(result.providerMessageId).toBe('wamid.HBgLMTQyMzE4MDk3MDg2ODU5MQ==');
      expect(result.safeRecipient).toBe('+918401060482');
      expect(result.templateName).toBe('hello_world');
      expect(result.templateLanguage).toBe('en_US');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://graph.facebook.com/v25.0/1423180970868591/messages',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer secret_access_token_123',
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: '918401060482',
            type: 'template',
            template: {
              name: 'hello_world',
              language: { code: 'en_US' },
            },
          }),
        }),
      );
    });

    it('handles Meta 400 error and captures metaErrorCode and error message without leaking token', async () => {
      const secretToken = 'secret_access_token_xyz';
      mockConfigValues.WHATSAPP_ACCESS_TOKEN = secretToken;
      mockConfigValues.WHATSAPP_PHONE_NUMBER_ID = '1423180970868591';

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: {
            message: `Template error occurred with token ${secretToken}`,
            type: 'OAuthException',
            code: 132000,
            error_subcode: 2494010,
          },
        }),
      } as any);

      const result = await service.sendTemplateMessage('+918401060482', 'hello_world', 'en_US');
      expect(result.success).toBe(false);
      expect(result.status).toBe('FAILED');
      expect(result.httpStatus).toBe(400);
      expect(result.metaErrorCode).toBe(132000);
      expect(result.metaErrorSubcode).toBe(2494010);
      expect(result.error).not.toContain(secretToken);
      expect(result.error).toContain('[REDACTED]');
    });

    it('handles Meta 401 unauthorized token error safely', async () => {
      mockConfigValues.WHATSAPP_ACCESS_TOKEN = 'invalid_token';
      mockConfigValues.WHATSAPP_PHONE_NUMBER_ID = '1423180970868591';

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          error: {
            message: 'Invalid OAuth access token - Cannot parse access token',
            type: 'OAuthException',
            code: 190,
          },
        }),
      } as any);

      const result = await service.sendTemplateMessage('+918401060482');
      expect(result.success).toBe(false);
      expect(result.status).toBe('FAILED');
      expect(result.httpStatus).toBe(401);
      expect(result.metaErrorCode).toBe(190);
    });

    it('handles Meta 429 rate limit error', async () => {
      mockConfigValues.WHATSAPP_ACCESS_TOKEN = 'valid_token';
      mockConfigValues.WHATSAPP_PHONE_NUMBER_ID = '1423180970868591';

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({
          error: {
            message: 'Message rate limit exceeded',
            type: 'OAuthException',
            code: 80007,
          },
        }),
      } as any);

      const result = await service.sendTemplateMessage('+918401060482');
      expect(result.success).toBe(false);
      expect(result.httpStatus).toBe(429);
      expect(result.metaErrorCode).toBe(80007);
    });

    it('handles Meta 500 server error', async () => {
      mockConfigValues.WHATSAPP_ACCESS_TOKEN = 'valid_token';
      mockConfigValues.WHATSAPP_PHONE_NUMBER_ID = '1423180970868591';

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({
          error: {
            message: 'An unknown error occurred on Meta servers',
            type: 'OAuthException',
            code: 1,
          },
        }),
      } as any);

      const result = await service.sendTemplateMessage('+918401060482');
      expect(result.success).toBe(false);
      expect(result.httpStatus).toBe(500);
      expect(result.metaErrorCode).toBe(1);
    });

    it('handles network timeout / connection abort exception cleanly', async () => {
      mockConfigValues.WHATSAPP_ACCESS_TOKEN = 'valid_token';
      mockConfigValues.WHATSAPP_PHONE_NUMBER_ID = '1423180970868591';

      global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network request timed out after 10000ms'));

      const result = await service.sendTemplateMessage('+918401060482');
      expect(result.success).toBe(false);
      expect(result.status).toBe('FAILED');
      expect(result.error).toContain('timed out');
    });
  });
});

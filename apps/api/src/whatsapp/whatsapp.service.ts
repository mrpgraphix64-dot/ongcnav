import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppDeliveryStatus } from '@ongc/shared-types';

export interface WhatsAppSendResult {
  success: boolean;
  status: WhatsAppDeliveryStatus;
  provider: string;
  providerMessageId?: string | null;
  safeRecipient?: string | null;
  templateName?: string | null;
  templateLanguage?: string | null;
  httpStatus?: number | null;
  metaErrorCode?: number | null;
  metaErrorSubcode?: number | null;
  error?: string | null;
  timestamp: string;
}

export interface WhatsAppProviderInfo {
  configured: boolean;
  isConfigured: boolean;
  providerName: string;
  status: WhatsAppDeliveryStatus;
  safeRecipient: string | null;
  phoneNumberIdConfigured: boolean;
  businessAccountConfigured: boolean;
  accessTokenConfigured: boolean;
  apiVersion: string;
  testRecipientConfigured: boolean;
  templateConfigured: boolean;
  templateName: string;
  templateLanguage: string;
}

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Helper resolving from ConfigService with fallback to process.env.
   */
  private getEnv(key: string): string | undefined {
    const val = this.configService?.get<string>(key);
    if (val !== undefined && val !== null) {
      const s = String(val).trim();
      return s.length > 0 ? s : undefined;
    }
    if (process.env.NODE_ENV !== 'test') {
      const procVal = process.env[key];
      if (procVal && typeof procVal === 'string' && procVal.trim()) {
        return procVal.trim();
      }
    }
    return undefined;
  }

  /**
   * Resolves the configured Meta WhatsApp Graph API version.
   * Defaults to 'v25.0' if not set in server environment.
   */
  getApiVersion(): string {
    const rawVersion = this.getEnv('WHATSAPP_API_VERSION');
    if (rawVersion && rawVersion.trim()) {
      const trimmed = rawVersion.trim();
      return trimmed.startsWith('v') ? trimmed : `v${trimmed}`;
    }
    return 'v25.0';
  }

  /**
   * Evaluates whether real WhatsApp credentials are configured in the environment.
   * Standardized: WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID
   */
  isProviderConfigured(): boolean {
    const token = this.getEnv('WHATSAPP_ACCESS_TOKEN');
    const phoneNumberId = this.getEnv('WHATSAPP_PHONE_NUMBER_ID');

    return Boolean(token && phoneNumberId && token.trim() && phoneNumberId.trim());
  }

  isPhoneNumberIdConfigured(): boolean {
    const phoneNumberId = this.getEnv('WHATSAPP_PHONE_NUMBER_ID');
    return Boolean(phoneNumberId && phoneNumberId.trim());
  }

  isBusinessAccountConfigured(): boolean {
    const wabaId = this.getEnv('WHATSAPP_BUSINESS_ACCOUNT_ID');
    return Boolean(wabaId && wabaId.trim());
  }

  isAccessTokenConfigured(): boolean {
    const token = this.getEnv('WHATSAPP_ACCESS_TOKEN');
    return Boolean(token && token.trim());
  }

  /**
   * Returns human-readable provider name.
   */
  getProviderName(): string {
    if (this.isProviderConfigured()) {
      return 'Meta WhatsApp Cloud API';
    }
    return 'TEST_ADAPTER (Unconfigured)';
  }

  /**
   * Resolves the configured template name and language.
   * Defaults: hello_world / en_US
   */
  getTemplateConfig(): { name: string; language: string } {
    const name = this.getEnv('WHATSAPP_TEST_TEMPLATE_NAME') || 'hello_world';
    const language = this.getEnv('WHATSAPP_TEST_TEMPLATE_LANGUAGE') || 'en_US';
    return {
      name: name.trim(),
      language: language.trim(),
    };
  }

  /**
   * Resolves the configured Super Admin safe test recipient.
   * STRICT SAFETY RULE:
   * - Only resolves when explicitly configured in the database setting 'whatsapp.test_recipient'
   *   or explicitly configured in the environment variable WHATSAPP_TEST_RECIPIENT.
   * - NEVER defaults to a sponsor, customer, or hardcoded phone number.
   * - Returns null if neither is configured.
   */
  async getSafeRecipient(): Promise<string | null> {
    try {
      const setting = await this.prisma.setting.findUnique({
        where: { key: 'whatsapp.test_recipient' },
      });
      if (setting?.value && setting.value.trim()) {
        return this.normalizePhoneNumber(setting.value.trim());
      }
    } catch {
      // In case setting table lookup fails, fallback to env check
    }

    const envRecipient = this.getEnv('WHATSAPP_TEST_RECIPIENT');
    if (envRecipient && envRecipient.trim()) {
      return this.normalizePhoneNumber(envRecipient.trim());
    }

    // No fallback to any customer or sponsor phone number
    return null;
  }

  /**
   * Retrieves overall provider information and readiness status.
   * Never exposes credentials or tokens.
   */
  async getProviderInfo(): Promise<WhatsAppProviderInfo> {
    const isConfigured = this.isProviderConfigured();
    const safeRecipient = await this.getSafeRecipient();
    const templateConfig = this.getTemplateConfig();
    const apiVersion = this.getApiVersion();

    let status: WhatsAppDeliveryStatus = 'READY';
    if (!isConfigured) {
      status = 'PROVIDER_NOT_CONFIGURED';
    } else if (!safeRecipient) {
      status = 'TEST_RECIPIENT_NOT_CONFIGURED';
    }

    return {
      configured: isConfigured,
      isConfigured,
      providerName: this.getProviderName(),
      status,
      safeRecipient,
      phoneNumberIdConfigured: this.isPhoneNumberIdConfigured(),
      businessAccountConfigured: this.isBusinessAccountConfigured(),
      accessTokenConfigured: this.isAccessTokenConfigured(),
      apiVersion,
      testRecipientConfigured: Boolean(safeRecipient),
      templateConfigured: Boolean(templateConfig.name),
      templateName: templateConfig.name,
      templateLanguage: templateConfig.language,
    };
  }

  /**
   * Normalizes an Indian or international phone number to E.164.
   */
  normalizePhoneNumber(phone: string): string {
    const digits = phone.replace(/[^0-9]/g, '');
    if (digits.length === 10) {
      return `+91${digits}`;
    }
    if (digits.length === 12 && digits.startsWith('91')) {
      return `+${digits}`;
    }
    return phone.startsWith('+') ? phone : `+${digits}`;
  }

  /**
   * Verifies if a Meta template exists and is approved.
   * Defaults 'hello_world' to approved (standard Meta developer test template).
   */
  async verifyTemplate(
    templateName: string,
    languageCode: string,
  ): Promise<{ exists: boolean; approved: boolean; error?: string }> {
    // 'hello_world' is Meta's built-in sandbox approved template available on all test numbers
    if (templateName === 'hello_world') {
      return { exists: true, approved: true };
    }

    const wabaId = this.getEnv('WHATSAPP_BUSINESS_ACCOUNT_ID');
    const token = this.getEnv('WHATSAPP_ACCESS_TOKEN');
    const apiVersion = this.getApiVersion();

    if (!wabaId || !wabaId.trim() || !token || !token.trim()) {
      return {
        exists: false,
        approved: false,
        error:
          'WhatsApp template is not configured/approved (WHATSAPP_BUSINESS_ACCOUNT_ID required for custom templates).',
      };
    }

    try {
      const url = `https://graph.facebook.com/${apiVersion}/${wabaId.trim()}/message_templates?name=${encodeURIComponent(templateName)}`;
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        return {
          exists: false,
          approved: false,
          error: 'WhatsApp template is not configured/approved.',
        };
      }

      const data = (await res.json()) as any;
      const matched = Array.isArray(data?.data)
        ? data.data.find(
            (t: any) =>
              t.name === templateName &&
              (!languageCode || t.language === languageCode),
          )
        : null;

      if (!matched) {
        return {
          exists: false,
          approved: false,
          error: `WhatsApp template '${templateName}' does not exist for language '${languageCode}'.`,
        };
      }

      if (matched.status !== 'APPROVED') {
        return {
          exists: true,
          approved: false,
          error: `WhatsApp template '${templateName}' status is '${matched.status}' (must be APPROVED).`,
        };
      }

      return { exists: true, approved: true };
    } catch (err: any) {
      this.logger.warn(`Template verification query failed: ${err.message}`);
      return {
        exists: false,
        approved: false,
        error: 'WhatsApp template verification request failed.',
      };
    }
  }

  /**
   * Sends Meta WhatsApp template message strictly to safe recipient.
   * Never logs or exposes access token.
   */
  async sendTemplateMessage(
    to: string | null | undefined,
    templateName?: string,
    languageCode?: string,
    components?: any[],
  ): Promise<WhatsAppSendResult> {
    const timestamp = new Date().toISOString();
    const provider = this.getProviderName();
    const tplConfig = this.getTemplateConfig();
    const tplName = (templateName || tplConfig.name).trim();
    const tplLang = (languageCode || tplConfig.language).trim();

    if (!to || !to.trim()) {
      this.logger.warn('WhatsApp template send skipped: Test recipient is not configured.');
      return {
        success: false,
        status: 'TEST_RECIPIENT_NOT_CONFIGURED',
        provider,
        safeRecipient: null,
        templateName: tplName,
        templateLanguage: tplLang,
        error:
          'WhatsApp test recipient is not configured. Configure WHATSAPP_TEST_RECIPIENT in server environment or setting.',
        timestamp,
      };
    }

    const recipient = this.normalizePhoneNumber(to);

    if (!this.isProviderConfigured()) {
      this.logger.warn(
        `WhatsApp send skipped: Provider is not configured. Target: ${recipient}. Template: ${tplName}`,
      );
      return {
        success: false,
        status: 'PROVIDER_NOT_CONFIGURED',
        provider,
        safeRecipient: recipient,
        templateName: tplName,
        templateLanguage: tplLang,
        error:
          'WhatsApp Provider credentials (WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID) are not configured. Message was not delivered to phone network.',
        timestamp,
      };
    }

    // Verify template existence and approval status
    const verification = await this.verifyTemplate(tplName, tplLang);
    if (!verification.approved) {
      this.logger.warn(
        `WhatsApp template send rejected: template '${tplName}' is not approved/configured`,
      );
      return {
        success: false,
        status: 'FAILED',
        provider,
        safeRecipient: recipient,
        templateName: tplName,
        templateLanguage: tplLang,
        error: verification.error || 'WhatsApp template is not configured/approved.',
        timestamp,
      };
    }

    const token = this.getEnv('WHATSAPP_ACCESS_TOKEN')!.trim();
    const phoneNumberId = this.getEnv('WHATSAPP_PHONE_NUMBER_ID')!.trim();
    const apiVersion = this.getApiVersion();
    const cleanPhoneForMeta = recipient.replace(/^\+/, '');

    const payload: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanPhoneForMeta,
      type: 'template',
      template: {
        name: tplName,
        language: {
          code: tplLang,
        },
      },
    };

    if (Array.isArray(components) && components.length > 0) {
      payload.template.components = components;
    }

    try {
      const endpoint = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as any;

      if (!response.ok) {
        const metaError = data?.error;
        const metaCode = metaError?.code ?? null;
        const metaSubcode = metaError?.error_subcode ?? null;
        const rawMsg =
          metaError?.message ||
          `HTTP ${response.status} from WhatsApp Cloud API (${apiVersion})`;
        const sanitizedMsg = rawMsg.replace(new RegExp(token, 'g'), '[REDACTED]');
        this.logger.error(
          `WhatsApp Cloud API error [${response.status}]: code=${metaCode}, subcode=${metaSubcode}, message=${sanitizedMsg}`,
        );

        return {
          success: false,
          status: 'FAILED',
          provider,
          safeRecipient: recipient,
          templateName: tplName,
          templateLanguage: tplLang,
          httpStatus: response.status,
          metaErrorCode: metaCode,
          metaErrorSubcode: metaSubcode,
          error: sanitizedMsg,
          timestamp,
        };
      }

      const messageId = data?.messages?.[0]?.id || null;
      this.logger.log(
        `WhatsApp template message '${tplName}' successfully sent to safe recipient ${recipient}. ID: ${messageId}`,
      );

      return {
        success: true,
        status: 'SENT',
        provider,
        providerMessageId: messageId,
        safeRecipient: recipient,
        templateName: tplName,
        templateLanguage: tplLang,
        httpStatus: response.status,
        timestamp,
      };
    } catch (err: any) {
      this.logger.error(`WhatsApp dispatch network error: ${err.message}`, err.stack);
      return {
        success: false,
        status: 'FAILED',
        provider,
        safeRecipient: recipient,
        templateName: tplName,
        templateLanguage: tplLang,
        error: err.message || 'Network error occurred while calling WhatsApp API',
        timestamp,
      };
    }
  }

  /**
   * Sends text message through configured WhatsApp provider or returns clean unconfigured status.
   * Never logs or exposes access token.
   */
  async sendText(to: string | null | undefined, message: string): Promise<WhatsAppSendResult> {
    const timestamp = new Date().toISOString();
    const provider = this.getProviderName();

    if (!to || !to.trim()) {
      this.logger.warn('WhatsApp send skipped: Test recipient is not configured.');
      return {
        success: false,
        status: 'TEST_RECIPIENT_NOT_CONFIGURED',
        provider,
        safeRecipient: null,
        error:
          'WhatsApp test recipient is not configured. Configure WHATSAPP_TEST_RECIPIENT in server environment or setting before sending test messages.',
        timestamp,
      };
    }

    const recipient = this.normalizePhoneNumber(to);

    if (!this.isProviderConfigured()) {
      this.logger.warn(
        `WhatsApp send skipped: Provider is not configured. Target: ${recipient}. Message length: ${message.length}`,
      );
      return {
        success: false,
        status: 'PROVIDER_NOT_CONFIGURED',
        provider,
        safeRecipient: recipient,
        error:
          'WhatsApp Provider credentials (WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID) are not configured. Message was not delivered to phone network.',
        timestamp,
      };
    }

    const token = this.getEnv('WHATSAPP_ACCESS_TOKEN')!.trim();
    const phoneNumberId = this.getEnv('WHATSAPP_PHONE_NUMBER_ID')!.trim();
    const apiVersion = this.getApiVersion();

    try {
      const cleanPhoneForMeta = recipient.replace(/^\+/, '');
      const response = await fetch(
        `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: cleanPhoneForMeta,
            type: 'text',
            text: {
              preview_url: true,
              body: message,
            },
          }),
        },
      );

      const data = (await response.json()) as any;

      if (!response.ok) {
        const metaError = data?.error;
        const metaCode = metaError?.code ?? null;
        const metaSubcode = metaError?.error_subcode ?? null;
        const rawMsg =
          metaError?.message ||
          `HTTP ${response.status} from WhatsApp Cloud API (${apiVersion})`;
        const sanitizedMsg = rawMsg.replace(new RegExp(token, 'g'), '[REDACTED]');
        this.logger.error(`WhatsApp Cloud API error: ${sanitizedMsg}`);
        return {
          success: false,
          status: 'FAILED',
          provider,
          safeRecipient: recipient,
          httpStatus: response.status,
          metaErrorCode: metaCode,
          metaErrorSubcode: metaSubcode,
          error: sanitizedMsg,
          timestamp,
        };
      }

      const messageId = data?.messages?.[0]?.id || null;
      this.logger.log(`WhatsApp message sent successfully. ID: ${messageId}`);

      return {
        success: true,
        status: 'SENT',
        provider,
        providerMessageId: messageId,
        safeRecipient: recipient,
        httpStatus: response.status,
        timestamp,
      };
    } catch (err: any) {
      this.logger.error(`WhatsApp network error: ${err.message}`, err.stack);
      return {
        success: false,
        status: 'FAILED',
        provider,
        safeRecipient: recipient,
        error: err.message || 'Network error occurred while calling WhatsApp API',
        timestamp,
      };
    }
  }

  /**
   * Sends image message through configured WhatsApp provider or returns clean unconfigured status.
   * Never logs or exposes access token.
   */
  async sendImage(
    to: string | null | undefined,
    imageUrl: string,
    caption?: string,
  ): Promise<WhatsAppSendResult> {
    const timestamp = new Date().toISOString();
    const provider = this.getProviderName();

    if (!to || !to.trim()) {
      return {
        success: false,
        status: 'TEST_RECIPIENT_NOT_CONFIGURED',
        provider,
        safeRecipient: null,
        error:
          'WhatsApp test recipient is not configured. Configure WHATSAPP_TEST_RECIPIENT in server environment or setting.',
        timestamp,
      };
    }

    const recipient = this.normalizePhoneNumber(to);

    if (!this.isProviderConfigured()) {
      return {
        success: false,
        status: 'PROVIDER_NOT_CONFIGURED',
        provider,
        safeRecipient: recipient,
        error:
          'Provider media upload/configuration is required before actual image delivery.',
        timestamp,
      };
    }

    const token = this.configService.get<string>('WHATSAPP_ACCESS_TOKEN')!.trim();
    const phoneNumberId = this.configService.get<string>('WHATSAPP_PHONE_NUMBER_ID')!.trim();
    const apiVersion = this.getApiVersion();

    try {
      const cleanPhoneForMeta = recipient.replace(/^\+/, '');
      const response = await fetch(
        `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: cleanPhoneForMeta,
            type: 'image',
            image: {
              link: imageUrl,
              caption: caption || undefined,
            },
          }),
        },
      );

      const data = (await response.json()) as any;

      if (!response.ok) {
        const metaError = data?.error;
        const metaCode = metaError?.code ?? null;
        const metaSubcode = metaError?.error_subcode ?? null;
        const rawMsg = data?.error?.message || `HTTP ${response.status}`;
        const sanitizedMsg = rawMsg.replace(new RegExp(token, 'g'), '[REDACTED]');
        return {
          success: false,
          status: 'FAILED',
          provider,
          safeRecipient: recipient,
          httpStatus: response.status,
          metaErrorCode: metaCode,
          metaErrorSubcode: metaSubcode,
          error: sanitizedMsg,
          timestamp,
        };
      }

      return {
        success: true,
        status: 'SENT',
        provider,
        providerMessageId: data?.messages?.[0]?.id || null,
        safeRecipient: recipient,
        httpStatus: response.status,
        timestamp,
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'FAILED',
        provider,
        safeRecipient: recipient,
        error: err.message,
        timestamp,
      };
    }
  }
}

import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { WhatsAppService } from '../../whatsapp/whatsapp.service';
import {
  DEFAULT_SPONSOR_VOUCHER_CONFIG,
  SponsorVoucherConfig,
  buildEmployeeWhatsAppMessage,
  WhatsAppTestSubmissionResultDto,
  EmployeeCategory,
  AttendeeStatus,
} from '@ongc/shared-types';
import * as crypto from 'crypto';
import {
  SubmitWhatsAppTestPassDto,
  SendWhatsAppTestMessageDto,
} from './whatsapp-test.dto';

@Injectable()
export class WhatsAppTestService {
  private readonly logger = new Logger(WhatsAppTestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly whatsAppService: WhatsAppService,
  ) {}

  /**
   * Resolves the current base web URL for pass hyperlinks and assets.
   */
  private getWebUrl(): string {
    const rawOrigins = this.configService.get<string>('CORS_ORIGINS') || '';
    const origins = rawOrigins
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    // Prefer https origin if available, else first origin or fallback
    const httpsOrigin = origins.find((o) => o.startsWith('https://'));
    if (httpsOrigin) return httpsOrigin;
    if (origins.length > 0 && origins[0]) return origins[0];

    return 'https://ongcnavratri.reworkzone.in';
  }

  /**
   * Resolves the authoritative sponsor voucher configuration.
   * Priority: Database setting 'sponsor.voucher_config' -> DEFAULT_SPONSOR_VOUCHER_CONFIG
   */
  async getSponsorVoucherConfig(): Promise<SponsorVoucherConfig> {
    try {
      const setting = await this.prisma.setting.findUnique({
        where: { key: 'sponsor.voucher_config' },
      });
      if (setting?.value) {
        const parsed = JSON.parse(setting.value);
        return {
          ...DEFAULT_SPONSOR_VOUCHER_CONFIG,
          ...parsed,
          enabled: parsed.enabled !== false,
        };
      }
    } catch (err: any) {
      this.logger.warn(`Failed reading sponsor.voucher_config setting: ${err.message}`);
    }

    return { ...DEFAULT_SPONSOR_VOUCHER_CONFIG };
  }

  /**
   * Retrieves WhatsApp Test Lab initial configuration and provider readiness.
   */
  async getConfig() {
    const providerInfo = await this.whatsAppService.getProviderInfo();
    const sponsorVoucher = await this.getSponsorVoucherConfig();
    const webUrl = this.getWebUrl();
    const voucherImageUrl = `${webUrl}${sponsorVoucher.voucherImagePath || '/images/sponsors/mahavir-jewellers-voucher.jpg'}`;

    return {
      configured: providerInfo.configured,
      isConfigured: providerInfo.configured,
      provider: providerInfo.providerName,
      providerName: providerInfo.providerName,
      providerStatus: providerInfo.status,
      safeRecipient: providerInfo.safeRecipient,
      phoneNumberIdConfigured: providerInfo.phoneNumberIdConfigured,
      businessAccountConfigured: providerInfo.businessAccountConfigured,
      accessTokenConfigured: providerInfo.accessTokenConfigured,
      apiVersion: providerInfo.apiVersion,
      testRecipientConfigured: providerInfo.testRecipientConfigured,
      templateConfigured: providerInfo.templateConfigured,
      templateName: providerInfo.templateName,
      templateLanguage: providerInfo.templateLanguage,
      sponsorVoucher,
      voucherImageUrl,
      isolationMode: 'ISOLATED_TEST_MODE',
      notice:
        'Test messages are sent only to the configured Super Admin safe test recipient. Real employee records and mobile numbers are never contacted.',
    };
  }

  /**
   * Submits the duplicate test registration form and creates an isolated test pass.
   * STRICT TEST ISOLATION:
   * - Never touches OngcEmployeeMaster
   * - Creates Employee with test prefix 'TEST-WA-'
   * - Creates Attendee with isLoadTest: true so all production queries, statistics, and gates ignore it
   */
  async submitTestPass(
    dto: SubmitWhatsAppTestPassDto,
    adminUserEmail?: string,
  ): Promise<WhatsAppTestSubmissionResultDto> {
    const rawCpf = dto.cpf.trim();
    const testCpf = `TEST-WA-${rawCpf}`;
    const testRefNo = `ONGC-TEST-${rawCpf}`;
    const cleanMobile = dto.mobile.trim();
    const testQrToken = `wa_test_${crypto.randomBytes(16).toString('hex')}`;
    const testTicketNumber = `TK-WA-TEST-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    const categoryEnum = dto.category
      ? (dto.category as EmployeeCategory)
      : EmployeeCategory.REGULAR;

    // 1. Upsert isolated test employee
    const employee = await this.prisma.employee.upsert({
      where: { cpf: testCpf },
      create: {
        cpf: testCpf,
        referenceNumber: testRefNo,
        name: dto.name.trim(),
        phone: cleanMobile,
        email: dto.email.trim().toLowerCase(),
        designation: 'Test Participant',
        department: 'Test Lab Administration',
        employeeCategory: categoryEnum,
        bookingDays: dto.bookingDays || [],
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
        dateOfJoining: dto.dateOfJoining ? new Date(dto.dateOfJoining) : null,
        guidelinesAcceptedAt: new Date(),
        guidelinesVersion: 'test-lab-v1',
      },
      update: {
        referenceNumber: testRefNo,
        name: dto.name.trim(),
        phone: cleanMobile,
        email: dto.email.trim().toLowerCase(),
        employeeCategory: categoryEnum,
        bookingDays: dto.bookingDays || [],
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
        dateOfJoining: dto.dateOfJoining ? new Date(dto.dateOfJoining) : null,
      },
    });

    // 2. Create isolated test attendee
    const attendee = await this.prisma.attendee.create({
      data: {
        registrationType: 'EMPLOYEE',
        name: dto.name.trim(),
        mobile: cleanMobile,
        email: dto.email.trim().toLowerCase(),
        category: 'General',
        employeeId: employee.id,
        ticketNumber: testTicketNumber,
        qrCodeToken: testQrToken,
        status: AttendeeStatus.ACTIVE,
        bookingDays: dto.bookingDays || [],
        isLoadTest: true, // EXCLUDES FROM ALL PRODUCTION METRICS & QUERIES
      },
    });

    // 3. Handle family members if present
    if (Array.isArray(dto.familyMembers) && dto.familyMembers.length > 0) {
      for (const fm of dto.familyMembers) {
        if (!fm.name || !fm.name.trim()) continue;
        const fmToken = `wa_test_fm_${crypto.randomBytes(16).toString('hex')}`;
        const fmTicketNumber = `TK-WA-TEST-FM-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

        const createdFm = await this.prisma.familyMember.create({
          data: {
            employeeId: employee.id,
            name: fm.name.trim(),
            relation: fm.relation?.trim() || 'Family Member',
            phone: fm.mobileNo?.trim() || cleanMobile,
            email: fm.email?.trim().toLowerCase() || dto.email.trim().toLowerCase(),
            dateOfBirth: fm.dateOfBirth ? new Date(fm.dateOfBirth) : null,
          },
        });

        await this.prisma.attendee.create({
          data: {
            registrationType: 'EMPLOYEE',
            name: fm.name.trim(),
            mobile: fm.mobileNo?.trim() || cleanMobile,
            email: fm.email?.trim().toLowerCase() || dto.email.trim().toLowerCase(),
            category: 'Family Member',
            employeeId: employee.id,
            familyMemberId: createdFm.id,
            ticketNumber: fmTicketNumber,
            qrCodeToken: fmToken,
            status: AttendeeStatus.ACTIVE,
            bookingDays: fm.bookingDays || dto.bookingDays || [],
            isLoadTest: true,
          },
        });
      }
    }

    // 4. Construct pass link and message
    const webUrl = this.getWebUrl();
    const passUrl = `${webUrl}/employee/my-tickets?ref=${encodeURIComponent(testRefNo)}`;
    const sponsorVoucher = await this.getSponsorVoucherConfig();
    const voucherImageUrl = `${webUrl}${sponsorVoucher.voucherImagePath || '/images/sponsors/mahavir-jewellers-voucher.jpg'}`;

    const messageText = buildEmployeeWhatsAppMessage({
      employeeName: dto.name.trim(),
      referenceNumber: testRefNo,
      passUrl,
      sponsorVoucher,
    });

    const safeRecipient = await this.whatsAppService.getSafeRecipient();
    const providerInfo = await this.whatsAppService.getProviderInfo();

    // 5. Record test audit log
    try {
      await this.prisma.auditLog.create({
        data: {
          action: 'WHATSAPP_TEST_PASS_GENERATED',
          details: {
            referenceNumber: testRefNo,
            cpfEntered: rawCpf,
            testCpf,
            safeRecipient,
            attendeeId: attendee.id.toString(),
            employeeId: employee.id.toString(),
            adminUser: adminUserEmail || 'SUPER_ADMIN',
            isTest: true,
            source: 'WHATSAPP_TEST_LAB',
          },
        },
      });
    } catch (auditErr: any) {
      this.logger.warn(`Failed writing audit log: ${auditErr.message}`);
    }

    return {
      referenceNumber: testRefNo,
      attendeeId: attendee.id.toString(),
      employeeId: employee.id.toString(),
      ticketNumber: testTicketNumber,
      qrToken: testQrToken,
      passUrl,
      safeRecipient,
      messageText,
      voucherImageUrl,
      sponsorVoucher,
      providerStatus: providerInfo.status,
      providerName: providerInfo.providerName,
      isConfigured: providerInfo.isConfigured,
      templateName: providerInfo.templateName,
      templateLanguage: providerInfo.templateLanguage,
    };
  }

  /**
   * Dispatches the WhatsApp test message strictly to the configured safe test recipient.
   * Ignores any phone number entered in the employee form.
   */
  async sendTestMessage(dto: SendWhatsAppTestMessageDto, adminUserEmail?: string) {
    const safeRecipient =
      dto.safeRecipientOverride?.trim() ||
      (await this.whatsAppService.getSafeRecipient());

    // Resolve test employee / attendee by reference number
    const employee = await this.prisma.employee.findFirst({
      where: { referenceNumber: dto.referenceNumber },
      include: {
        attendees: {
          where: { isLoadTest: true },
          orderBy: { id: 'asc' },
        },
      },
    });

    const webUrl = this.getWebUrl();
    const passUrl = `${webUrl}/employee/my-tickets?ref=${encodeURIComponent(dto.referenceNumber)}`;
    const sponsorVoucher = await this.getSponsorVoucherConfig();
    const voucherImageUrl = `${webUrl}${sponsorVoucher.voucherImagePath || '/images/sponsors/mahavir-jewellers-voucher.jpg'}`;

    const employeeName = employee?.name || 'ONGC Test Participant';
    const messageText = buildEmployeeWhatsAppMessage({
      employeeName,
      referenceNumber: dto.referenceNumber,
      passUrl,
      sponsorVoucher,
    });

    const isConfigured = this.whatsAppService.isProviderConfigured();
    const providerName = this.whatsAppService.getProviderName();
    const tplConfig = this.whatsAppService.getTemplateConfig();

    if (!safeRecipient) {
      return {
        success: false,
        status: 'TEST_RECIPIENT_NOT_CONFIGURED',
        provider: providerName,
        providerMessageId: null,
        safeRecipient: null,
        referenceNumber: dto.referenceNumber,
        templateName: tplConfig.name,
        templateLanguage: tplConfig.language,
        messageText,
        voucherImageUrl,
        error:
          'WhatsApp test recipient is not configured. Configure WHATSAPP_TEST_RECIPIENT in server environment or setting before sending test messages.',
      };
    }

    if (!isConfigured) {
      // Record unconfigured test audit log
      try {
        await this.prisma.auditLog.create({
          data: {
            action: 'WHATSAPP_TEST_MESSAGE_SENT',
            details: {
              referenceNumber: dto.referenceNumber,
              testRecipient: safeRecipient,
              provider: providerName,
              templateName: tplConfig.name,
              templateLanguage: tplConfig.language,
              status: 'PROVIDER_NOT_CONFIGURED',
              error:
                'WhatsApp Provider is not configured (WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID missing). Message preview is ready.',
              adminUser: adminUserEmail || 'SUPER_ADMIN',
              isTest: true,
              source: 'WHATSAPP_TEST_LAB',
            },
          },
        });
      } catch {}

      return {
        success: false,
        status: 'PROVIDER_NOT_CONFIGURED',
        provider: providerName,
        providerMessageId: null,
        safeRecipient,
        referenceNumber: dto.referenceNumber,
        templateName: tplConfig.name,
        templateLanguage: tplConfig.language,
        messageText,
        voucherImageUrl,
        error:
          'PREVIEW ONLY — WHATSAPP PROVIDER NOT CONFIGURED. To deliver real WhatsApp messages, configure WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID in environment.',
      };
    }

    // Provider is configured: dispatch Meta template message (Phase 1)
    const sendResult = await this.whatsAppService.sendTemplateMessage(
      safeRecipient,
      tplConfig.name,
      tplConfig.language,
    );

    // Record test audit log
    try {
      await this.prisma.auditLog.create({
        data: {
          action: 'WHATSAPP_TEST_MESSAGE_SENT',
          details: {
            referenceNumber: dto.referenceNumber,
            testRecipient: safeRecipient,
            provider: sendResult.provider,
            providerMessageId: sendResult.providerMessageId || null,
            templateName: sendResult.templateName || tplConfig.name,
            templateLanguage: sendResult.templateLanguage || tplConfig.language,
            httpStatus: sendResult.httpStatus || null,
            metaErrorCode: sendResult.metaErrorCode || null,
            status: sendResult.status,
            success: sendResult.success,
            error: sendResult.error || null,
            adminUser: adminUserEmail || 'SUPER_ADMIN',
            isTest: true,
            source: 'WHATSAPP_TEST_LAB',
          },
        },
      });
    } catch {}

    return {
      ...sendResult,
      safeRecipient,
      referenceNumber: dto.referenceNumber,
      templateName: sendResult.templateName || tplConfig.name,
      templateLanguage: sendResult.templateLanguage || tplConfig.language,
      messageText,
      voucherImageUrl,
    };
  }

  /**
   * Removes all isolated test records created by the WhatsApp Test Lab.
   * STRICT GUARD: Only removes records with test prefixes and isLoadTest: true.
   * Never touches real employees or attendees.
   */
  async clearTestData() {
    // 1. Delete test attendees
    const attendeesResult = await this.prisma.attendee.deleteMany({
      where: {
        isLoadTest: true,
        OR: [
          { ticketNumber: { startsWith: 'TK-WA-TEST-' } },
          { qrCodeToken: { startsWith: 'wa_test_' } },
        ],
      },
    });

    // 2. Delete test family members of test employees
    await this.prisma.familyMember.deleteMany({
      where: {
        employee: {
          cpf: { startsWith: 'TEST-WA-' },
        },
      },
    });

    // 3. Delete test employees
    const employeesResult = await this.prisma.employee.deleteMany({
      where: {
        cpf: { startsWith: 'TEST-WA-' },
      },
    });

    this.logger.log(
      `Cleaned up WhatsApp test lab records: ${attendeesResult.count} attendees, ${employeesResult.count} employees.`,
    );

    return {
      success: true,
      message: 'WhatsApp Test Lab test data cleared successfully.',
      deletedAttendeesCount: attendeesResult.count,
      deletedEmployeesCount: employeesResult.count,
    };
  }
}

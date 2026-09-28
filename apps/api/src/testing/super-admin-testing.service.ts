import { Injectable, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { SettingsService } from '../settings/settings.service';
import { UserRole, OrderStatus } from '@ongc/shared-types';
import * as QRCode from 'qrcode';

@Injectable()
export class SuperAdminTestingService {
  private readonly logger = new Logger(SuperAdminTestingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly settingsService: SettingsService,
  ) {}

  /**
   * Retrieves the latest commercial order and passes for preview.
   * If none exists in DB, returns a high-fidelity sample fixture.
   */
  async getTestingPreview(userRole?: string | null) {
    const role = (userRole || '').toUpperCase().trim();
    if (role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only SUPER_ADMIN can access Testing & Preview.');
    }

    // 1. Fetch latest paid commercial order from database
    const latestOrder = await this.prisma.commercialOrder.findFirst({
      where: {
        orderStatus: OrderStatus.PAID,
      },
      include: {
        attendees: {
          orderBy: { id: 'asc' },
        },
      },
      orderBy: {
        id: 'desc',
      },
    });

    let orderData: any;
    let passesData: any[];
    let isSampleFixture = false;

    if (latestOrder && latestOrder.attendees.length > 0) {
      const isTestPayment = (latestOrder.metadata as any)?.isTestPayment === true;
      const testPaymentRef = (latestOrder.metadata as any)?.testPaymentReference || null;
      const paymentRef = latestOrder.razorpayPaymentId || testPaymentRef || 'N/A';

      passesData = await Promise.all(
        latestOrder.attendees.map(async (a) => {
          let qrSvg: string | null = null;
          try {
            qrSvg = await QRCode.toString(a.qrCodeToken, {
              type: 'svg',
              errorCorrectionLevel: 'M',
              margin: 1,
            });
          } catch {
            qrSvg = null;
          }

          return {
            id: a.id.toString(),
            ticketNumber: a.ticketNumber,
            qrCodeToken: a.qrCodeToken,
            token: a.qrCodeToken,
            qrSvg,
            name: a.name,
            attendeeName: a.name,
            mobile: a.mobile,
            category: a.category,
            status: a.status,
            bookingDays: a.bookingDays as string[],
            isTestPayment,
          };
        }),
      );

      orderData = {
        orderNumber: latestOrder.orderNumber,
        customerName: latestOrder.customerName,
        customerMobile: latestOrder.customerMobile,
        customerEmail: latestOrder.customerEmail,
        ticketType: latestOrder.ticketType,
        selectedDates: latestOrder.selectedDates as string[],
        quantity: latestOrder.quantity,
        amountInr: latestOrder.amountPaise / 100,
        amountPaise: latestOrder.amountPaise,
        orderStatus: latestOrder.orderStatus,
        paymentStatus: latestOrder.paymentStatus,
        paymentReference: paymentRef,
        createdAt: latestOrder.createdAt.toISOString(),
        paidAt: latestOrder.paidAt ? latestOrder.paidAt.toISOString() : null,
        isTestPayment,
        isSampleFixture: false,
        passes: passesData,
      };
    } else {
      // High fidelity sample fixture with 2 passes
      isSampleFixture = true;
      const samplePasses = [
        {
          id: 'sample-1',
          ticketNumber: 'NR26-SAMPLE-1001',
          qrCodeToken: 'SAMPLE_ONGC_PREVIEW_TOKEN_01',
          token: 'SAMPLE_ONGC_PREVIEW_TOKEN_01',
          name: 'Smt. Aarti K. Patel',
          attendeeName: 'Smt. Aarti K. Patel',
          mobile: '9876543210',
          category: 'Daily Pass',
          status: 'ACTIVE',
          bookingDays: ['2026-10-15'],
          isTestPayment: false,
        },
        {
          id: 'sample-2',
          ticketNumber: 'NR26-SAMPLE-1002',
          qrCodeToken: 'SAMPLE_ONGC_PREVIEW_TOKEN_02',
          token: 'SAMPLE_ONGC_PREVIEW_TOKEN_02',
          name: 'Shri Kirit Patel',
          attendeeName: 'Shri Kirit Patel',
          mobile: '9876543210',
          category: 'Daily Pass',
          status: 'ACTIVE',
          bookingDays: ['2026-10-15'],
          isTestPayment: false,
        },
      ];

      passesData = await Promise.all(
        samplePasses.map(async (p) => {
          let qrSvg: string | null = null;
          try {
            qrSvg = await QRCode.toString(p.qrCodeToken, {
              type: 'svg',
              errorCorrectionLevel: 'M',
              margin: 1,
            });
          } catch {
            qrSvg = null;
          }
          return {
            ...p,
            qrSvg,
          };
        }),
      );

      orderData = {
        orderNumber: 'ORD-SAMPLE-20261015-TEST',
        customerName: 'Smt. Aarti K. Patel',
        customerMobile: '9876543210',
        customerEmail: 'sample.attendee@example.com',
        ticketType: 'COMMERCIAL_DAILY',
        selectedDates: ['2026-10-15'],
        quantity: 2,
        amountInr: 998,
        amountPaise: 99800,
        orderStatus: 'PAID',
        paymentStatus: 'CAPTURED',
        paymentReference: 'pay_sample_test_gateway',
        createdAt: new Date().toISOString(),
        paidAt: new Date().toISOString(),
        isTestPayment: false,
        isSampleFixture: true,
        passes: passesData,
      };
    }

    // 2. Generate email HTML using MailService with inline QR Data-URI
    const emailData = {
      orderNumber: orderData.orderNumber,
      customerName: orderData.customerName,
      customerEmail: orderData.customerEmail,
      customerMobile: orderData.customerMobile,
      ticketType: orderData.ticketType,
      selectedDates: orderData.selectedDates,
      quantity: orderData.quantity,
      amountInr: orderData.amountInr,
      amountPaise: orderData.amountPaise,
      passes: passesData.map((p) => ({
        token: p.token,
        ticketNumber: p.ticketNumber,
        attendeeName: p.name,
        category: p.category,
      })),
    };

    const emailBuilt = await this.mailService.buildCommercialTicketEmail(emailData, {
      embedQrAsDataUri: true,
    });

    // 3. Fetch payment settings
    const paymentSettings = await this.settingsService.getPaymentSettings(userRole);

    return {
      order: orderData,
      emailPreview: {
        subject: emailBuilt.subject,
        html: emailBuilt.html,
        fromName: 'ONGC Navratri 2026',
        fromEmail: this.mailService.getMailboxAddress(),
        isConfigured: this.mailService.isLiveMailConfigured(),
      },
      paymentGateway: {
        status: paymentSettings.enabled ? 'ENABLED' : 'DISABLED',
        enabled: paymentSettings.enabled,
        environment: paymentSettings.environment,
        gateway: paymentSettings.gateway,
        isConfigured: paymentSettings.isConfigured,
      },
      serverTime: new Date().toISOString(),
    };
  }

  /**
   * Dispatches a test transactional email strictly to the authenticated Super Admin.
   */
  async sendTestEmail(user: { id?: string | bigint; role?: string; email?: string }) {
    const role = (user?.role || '').toUpperCase().trim();
    if (role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only SUPER_ADMIN can send test emails.');
    }

    // Authoritative resolution of destination email from session/DB
    let adminEmail = (user?.email || '').trim().toLowerCase();
    if (!adminEmail && user?.id) {
      const dbUser = await this.prisma.user.findUnique({
        where: { id: BigInt(user.id) },
        select: { email: true },
      });
      adminEmail = (dbUser?.email || '').trim().toLowerCase();
    }

    if (!adminEmail || !adminEmail.includes('@')) {
      throw new BadRequestException(
        'Could not verify Super Admin email from authenticated session. Please verify your account email.',
      );
    }

    // Retrieve latest order or sample fixture
    const previewData = await this.getTestingPreview(role);
    const order = previewData.order;

    const emailData = {
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerMobile: order.customerMobile,
      ticketType: order.ticketType,
      selectedDates: order.selectedDates,
      quantity: order.quantity,
      amountInr: order.amountInr,
      amountPaise: order.amountPaise,
      passes: order.passes.map((p: any) => ({
        token: p.token,
        ticketNumber: p.ticketNumber,
        attendeeName: p.name,
        category: p.category,
      })),
    };

    this.logger.log(`Dispatching test E-Pass transactional email to Super Admin: [${adminEmail}]`);

    const result = await this.mailService.sendTestCommercialTicketEmail(emailData, adminEmail);

    if (!result.success) {
      throw new BadRequestException(
        result.error || 'Failed to dispatch test email. Please check mail server settings.',
      );
    }

    return {
      success: true,
      recipient: adminEmail,
      message: `Test E-Pass transactional email successfully dispatched to ${adminEmail}`,
      messageId: result.messageId,
      dispatchedAt: new Date().toISOString(),
    };
  }
}

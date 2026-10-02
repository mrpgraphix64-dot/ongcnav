import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as QRCode from 'qrcode';
import {
  SendEmailOptions,
  CommercialTicketEmailData,
  EmployeeDailyPassEmailData,
  MailSendResult,
  EmailAttachment,
} from './mail.types';
import { getEmailBrandingUrls } from './branding-assets';
import {
  getEventDayTheme,
  EventDayTheme,
  buildDailyEmployeePassPresentation,
  DailyEmployeePassPresentation,
} from '@ongc/shared-types';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly apiKey: string;
  private readonly mailbox: string;
  private readonly baseUrl: string;
  private readonly mailboxResourceIdOverride?: string;
  private readonly webUrl: string;
  private readonly apiUrl: string;
  private cachedResourceId: string | null = null;
  private isConfigured: boolean;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = (this.configService.get<string>('HOSTINGER_MAIL_API_KEY') || '').trim();
    this.mailbox = (
      this.configService.get<string>('HOSTINGER_MAILBOX') || 'ticket@ongcnavratri.tech'
    ).trim();
    this.baseUrl = (
      this.configService.get<string>('HOSTINGER_MAIL_API_BASE_URL') || 'https://api.mail.hostinger.com'
    ).replace(/\/+$/, '');
    this.mailboxResourceIdOverride = (
      this.configService.get<string>('HOSTINGER_MAILBOX_RESOURCE_ID') || ''
    ).trim() || undefined;

    const rawWebUrl =
      this.configService.get<string>('APP_URL') ||
      this.configService.get<string>('WEB_URL') ||
      'https://ongcnavratri.reworkzone.in';
    this.webUrl = rawWebUrl.replace(/\/+$/, '');

    const rawApiUrl =
      this.configService.get<string>('API_URL') ||
      (rawWebUrl.includes('localhost') ? 'http://localhost:3001' : 'https://api-ongcnavratri.reworkzone.in');
    this.apiUrl = rawApiUrl.replace(/\/+$/, '');

    this.isConfigured = !!this.apiKey;

    // Startup configuration validation: clearly reports status without exposing secret
    if (this.isConfigured) {
      this.logger.log(
        `Hostinger Mail API initialized for mailbox [${this.mailbox}] (API key configured).`,
      );
    } else {
      this.logger.warn(
        `HOSTINGER_MAIL_API_KEY is not configured. Mail delivery is operating in safe sandbox/mock mode.`,
      );
    }
  }

  /**
   * Safe check whether the live mail API key is available
   */
  isLiveMailConfigured(): boolean {
    return this.isConfigured;
  }

  /**
   * Get configured mailbox address
   */
  getMailboxAddress(): string {
    return this.mailbox;
  }

  /**
   * Resolve Hostinger mailbox resource ID (e.g. AC...)
   * Queries /api/v1/me and caches result in memory
   */
  async getMailboxResourceId(): Promise<string> {
    if (this.mailboxResourceIdOverride) {
      return this.mailboxResourceIdOverride;
    }

    if (this.cachedResourceId) {
      return this.cachedResourceId;
    }

    if (!this.apiKey) {
      return 'AC_MOCK_MAILBOX_RESOURCE_ID';
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/me`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`Hostinger /api/v1/me returned HTTP ${response.status}`);
      }

      const body = (await response.json()) as any;
      const mailboxes = body?.data?.mailboxes || [];

      if (!Array.isArray(mailboxes) || mailboxes.length === 0) {
        throw new Error('No mailboxes found in Hostinger account for this API key.');
      }

      // Try matching configured mailbox address (case-insensitive)
      const matched = mailboxes.find(
        (mb: any) =>
          typeof mb?.address === 'string' &&
          mb.address.toLowerCase() === this.mailbox.toLowerCase(),
      );

      const chosen = matched || mailboxes[0];
      if (!chosen?.resourceId) {
        throw new Error('Mailbox resourceId is missing in Hostinger account payload.');
      }

      this.cachedResourceId = chosen.resourceId;
      this.logger.log(
        `Resolved Hostinger mailbox resource ID for [${chosen.address || this.mailbox}].`,
      );
      return chosen.resourceId;
    } catch (err: any) {
      this.logger.error(
        `Failed to resolve Hostinger mailbox resource ID: ${err?.message || 'Unknown network error'}.`,
      );
      throw err;
    }
  }

  /**
   * Send an email via the Hostinger Mail API (POST /api/v1/mailboxes/{mailboxResourceId}/send)
   */
  async sendEmail(options: SendEmailOptions): Promise<MailSendResult> {
    const recipients = (Array.isArray(options.to) ? options.to : [options.to])
      .map((e) => (e || '').trim())
      .filter(Boolean);

    if (recipients.length === 0) {
      return { success: false, error: 'No recipient email addresses provided.' };
    }

    // In non-configured / mock mode, safely simulate success without failing
    if (!this.isConfigured) {
      const masked = this.maskEmail(recipients[0]);
      this.logger.log(
        `[Safe Mock Mail] Message "${options.subject}" to ${masked} mocked successfully.`,
      );
      return { success: true, messageId: 'mock-hostinger-msg-id' };
    }

    try {
      const resourceId = await this.getMailboxResourceId();

      const payload: any = {
        to: recipients,
        displayName: options.displayName || 'ONGC Navratri 2026',
        subject: options.subject,
        html: options.html,
        text: options.text || this.stripHtml(options.html),
      };

      if (options.attachments && options.attachments.length > 0) {
        payload.attachments = options.attachments;
      }

      const response = await fetch(
        `${this.baseUrl}/api/v1/mailboxes/${encodeURIComponent(resourceId)}/send`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(30000),
        },
      );

      // Hostinger Mail API returns 204 No Content on successful message dispatch
      if (response.status === 204 || response.ok) {
        const masked = this.maskEmail(recipients[0]);
        this.logger.log(`Transactional email successfully dispatched to ${masked}.`);
        return { success: true };
      }

      // Safe error parsing: do NOT leak customer data or API keys
      let errorMsg = `HTTP ${response.status}`;
      try {
        const errJson = (await response.json()) as any;
        if (errJson?.error) {
          errorMsg = `${errorMsg} - ${errJson.error}`;
        }
      } catch {
        // Body was not JSON
      }

      this.logger.error(`Hostinger Mail API error: ${errorMsg}`);
      return {
        success: false,
        error: `Hostinger Mail delivery failed: ${errorMsg}`,
        statusCode: response.status,
      };
    } catch (err: any) {
      const isTimeout = err?.name === 'TimeoutError' || err?.code === 'ABORT_ERR';
      const safeErr = isTimeout
        ? 'Request timed out after 30 seconds'
        : err?.message || 'Network error';

      this.logger.error(`Hostinger Mail dispatch error: ${safeErr}`);
      return {
        success: false,
        error: `Hostinger Mail dispatch error: ${safeErr}`,
      };
    }
  }

  /**
   * Formats dates array into a readable string
   */
  private formatDates(dates?: string[] | null, ticketType?: string): string {
    if (ticketType === 'COMMERCIAL_SEASON') {
      return '11–19 October 2026 (All 9 Nights)';
    }
    if (ticketType === 'COMMERCIAL_ANY_DAY') {
      return 'Valid on Any 1 Night (11–19 Oct 2026)';
    }
    if (!dates || dates.length === 0) {
      return '11–19 October 2026';
    }
    if (dates.length >= 9) {
      return 'All 9 Days (11–19 Oct 2026)';
    }

    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];

    const formatted = dates.map((d) => {
      const parts = d.split('-');
      if (parts.length === 3) {
        const day = parseInt(parts[2], 10);
        const mIdx = parseInt(parts[1], 10) - 1;
        return `${day} ${monthNames[mIdx] || parts[1]}`;
      }
      return d;
    });

    return formatted.join(', ');
  }

  /**
   * Builds the official commercial ticket confirmation email HTML and text payload.
   * If embedQrAsDataUri is true, QR code is embedded as inline base64 data-uri for browser preview.
   */
  async buildCommercialTicketEmail(
    data: CommercialTicketEmailData,
    options?: { embedQrAsDataUri?: boolean },
  ): Promise<{
    subject: string;
    html: string;
    text: string;
    attachments: EmailAttachment[];
  }> {
    const embedAsDataUri = Boolean(options?.embedQrAsDataUri);
    const formattedDates = this.formatDates(data.selectedDates, data.ticketType);
    const passTypeLabel =
      data.ticketType === 'COMMERCIAL_SEASON'
        ? 'Season Pass (All 9 Nights)'
        : data.ticketType === 'COMMERCIAL_MANDLI'
        ? 'Mandli Pass'
        : data.ticketType === 'COMMERCIAL_ANY_DAY'
        ? 'Any Day Pass'
        : 'Daily Entry Pass';

    const passTiming =
      data.ticketType === 'COMMERCIAL_MANDLI'
        ? '12:00 AM – 4:00 AM'
        : '8:00 PM – 4:00 AM';

    const brandingUrls = getEmailBrandingUrls(this.webUrl);
    const attachments: EmailAttachment[] = [];

    // Generate individual pass cards with real, scannable QR codes (FIRST CONTENT)
    const passesHtmlParts = await Promise.all(
      data.passes.map(async (pass, idx) => {
        const passUrl = `${this.webUrl}/ticket/${encodeURIComponent(pass.token)}`;
        const safeTicketNum = pass.ticketNumber.replace(/[^A-Za-z0-9]/g, '');
        const cid = `qr-${safeTicketNum}-${idx + 1}`;

        // Generate real scannable PNG QR code containing strictly the attendee's qrCodeToken
        let base64Png = '';
        try {
          const qrBuffer = await QRCode.toBuffer(pass.token, {
            type: 'png',
            width: 280,
            margin: 2,
            errorCorrectionLevel: 'M',
          });
          base64Png = qrBuffer.toString('base64');
        } catch {
          this.logger.error(`Failed to generate QR buffer for ticket ${pass.ticketNumber}`);
        }

        if (base64Png && !embedAsDataUri) {
          attachments.push({
            filename: `QR-${pass.ticketNumber}.png`,
            content: base64Png,
            contentType: 'image/png',
            cid,
            encoding: 'base64',
          });
        }

        const qrImgSrc = base64Png
          ? embedAsDataUri
            ? `data:image/png;base64,${base64Png}`
            : `cid:${cid}`
          : '';

        return `
          <!-- PASS CARD ${idx + 1} -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(145deg, #5A0F21 0%, #7A1930 60%, #3D0714 100%); border: 2px solid #D4AF37; border-radius: 16px; margin-bottom: 20px; text-align: center; color: #FFFFFF; box-shadow: 0 4px 15px rgba(90, 15, 33, 0.3);">
            <tr>
              <td style="padding: 22px 18px; text-align: center;">
                <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #F5E6B3; font-weight: bold; margin-bottom: 4px;">
                  ONGC NAVRATRI 2026 &bull; OFFICIAL E-PASS
                </div>
                <div style="font-size: 12px; font-weight: 700; color: #D4AF37; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">
                  ${passTypeLabel.toUpperCase()} &bull; E-PASS TICKET #${idx + 1}
                </div>
                <div style="font-size: 20px; font-weight: 800; color: #FFFFFF; margin: 4px 0 2px 0;">
                  ${this.escapeHtml(pass.attendeeName || data.customerName)}
                </div>

                <!-- REAL SCANNABLE QR CODE CONTAINER -->
                <table cellpadding="0" cellspacing="0" border="0" align="center" style="background-color: #FFFFFF; border-radius: 14px; margin: 12px auto 14px auto; box-shadow: 0 3px 12px rgba(0,0,0,0.25);">
                  <tr>
                    <td align="center" style="padding: 14px; background-color: #FFFFFF; border-radius: 14px;">
                      ${base64Png ? `
                        <img src="${qrImgSrc}" alt="Entry QR Pass - ${pass.ticketNumber}" width="200" height="200" style="display: block; width: 200px; height: 200px; margin: 0 auto; border: 0;" />
                      ` : `
                        <div style="width: 200px; height: 200px; line-height: 200px; text-align: center; color: #7A1930; font-size: 12px; font-weight: bold;">
                          QR code available via link below
                        </div>
                      `}
                      <div style="font-size: 11px; font-weight: 900; letter-spacing: 2px; color: #7A1930; text-transform: uppercase; margin-top: 8px;">
                        SCAN AT ENTRY
                      </div>
                    </td>
                  </tr>
                </table>

                <div style="font-size: 13px; font-family: 'Courier New', Courier, monospace; color: #FDE047; font-weight: bold; margin-bottom: 4px;">
                  Ticket Number: ${pass.ticketNumber}
                </div>
                <div style="font-size: 12px; color: #F5E6B3; margin-bottom: 14px;">
                  Event Date: ${formattedDates}
                </div>

                <!-- VIEW MY E-PASS SECURE BUTTON -->
                <div>
                  <a href="${passUrl}" style="display: inline-block; background-color: #D4AF37; color: #5A0F21; font-weight: 800; font-size: 13px; padding: 12px 24px; text-decoration: none; border-radius: 8px; letter-spacing: 0.5px; box-shadow: 0 2px 6px rgba(0,0,0,0.2);">
                    VIEW MY E-PASS &rarr;
                  </a>
                </div>
              </td>
            </tr>
          </table>
        `;
      }),
    );

    const passesHtml = passesHtmlParts.join('');

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>ONGC Navratri 2026 Passes</title>
</head>
<body style="margin: 0; padding: 0; background-color: #FAF6EF; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #2A1810;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #FAF6EF; padding: 24px 12px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 640px; background-color: #FFFFFF; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border: 1px solid #E5D5BA;">
          <!-- 1. HEADER: CLEAN CORPORATE / PREMIUM PASS STRUCTURE -->
          <tr>
            <td style="background-color: #3B0813; background: linear-gradient(180deg, #4A0C1A 0%, #150207 100%); padding: 32px 20px 24px 20px; text-align: center; color: #FFFFFF; border-bottom: 3px solid #D4AF37;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" align="center">
                <!-- A) ONGC LOGO (CENTERED, MODESTLY SIZED, BREATHING ROOM, TRANSPARENT) -->
                <tr>
                  <td align="center" style="padding-bottom: 14px;">
                    <img src="${brandingUrls.ongcLogoUrl}" alt="ONGC Logo" width="120" style="display: block; width: 120px; max-width: 120px; height: auto; margin: 0 auto; border: 0; background: transparent;" />
                  </td>
                </tr>
                <!-- B) NAVRATRI 2026 (PREMIUM SERIF / DISPLAY-STYLE IN GOLD) -->
                <tr>
                  <td align="center" style="padding-bottom: 8px;">
                    <div style="font-family: 'Cinzel', 'Georgia', 'Times New Roman', serif; font-size: 24px; font-weight: 800; color: #D4AF37; letter-spacing: 4px; text-transform: uppercase; line-height: 1.2; text-shadow: 0 1px 3px rgba(0,0,0,0.5);">
                      NAVRATRI 2026
                    </div>
                  </td>
                </tr>
                <!-- C) AHMEDABAD • OFFICIAL DIGITAL E-PASS (SMALLER UPPERCASE SUBTITLE) -->
                <tr>
                  <td align="center">
                    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 11px; font-weight: 700; color: #F5E6B3; letter-spacing: 2px; text-transform: uppercase;">
                      Ahmedabad &bull; Official Digital E-Pass
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- MAIN CONTENT BODY -->
          <tr>
            <td style="padding: 24px 20px;">
              <!-- 2. SUCCESS CONFIRMATION BADGE -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 18px; text-align: center;">
                <tr>
                  <td align="center">
                    <span style="display: inline-block; background-color: #ECFDF5; border: 1px solid #A7F3D0; color: #065F46; font-size: 12px; font-weight: 800; padding: 6px 14px; rounded: 20px; border-radius: 20px; letter-spacing: 0.5px;">
                      ✓ PAYMENT / BOOKING CONFIRMED &bull; PASS READY
                    </span>
                  </td>
                </tr>
              </table>

              <!-- 3. YOUR E-PASS — FIRST MAJOR VISUAL CONTENT -->
              <div style="text-align: center; margin-bottom: 14px;">
                <h2 style="font-size: 20px; font-weight: 800; color: #7A1930; margin: 0 0 4px 0; letter-spacing: 0.5px;">
                  YOUR E-PASS${data.passes.length > 1 ? 'ES' : ''}
                </h2>
                <p style="font-size: 13px; color: #5A4A3E; margin: 0;">
                  Present the QR code below at the entry gate for instant verification.
                </p>
              </div>

              ${passesHtml}

              <!-- 4. QR WARNING -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #FEF3C7; border: 1px solid #F59E0B; border-radius: 10px; margin: 0 0 24px 0;">
                <tr>
                  <td style="padding: 12px 16px; font-size: 12px; color: #92400E; font-weight: 600; line-height: 1.5; text-align: center;">
                    ⚠️ <strong>Important:</strong> This QR code is unique to this pass. Please do not share or forward it.
                  </td>
                </tr>
              </table>

              <!-- 5. E-PASS BOOKING DETAILS -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #FDF9F3; border: 1px solid #E5D5BA; border-radius: 12px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 18px;">
                    <div style="font-size: 13px; font-weight: 800; color: #7A1930; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 12px; border-bottom: 1px solid #E5D5BA; pb-2;">
                      E-PASS BOOKING DETAILS
                    </div>
                    <table width="100%" cellpadding="4" cellspacing="0" border="0" style="font-size: 13px;">
                      <tr>
                        <td style="color: #7A6557; width: 42%;">Order Reference:</td>
                        <td style="font-weight: bold; font-family: monospace; color: #7A1930;">${data.orderNumber}</td>
                      </tr>
                      <tr>
                        <td style="color: #7A6557;">Pass Type:</td>
                        <td style="font-weight: bold; color: #2A1810;">${passTypeLabel}</td>
                      </tr>
                      <tr>
                        <td style="color: #7A6557;">Event Date:</td>
                        <td style="font-weight: bold; color: #2A1810;">${formattedDates}</td>
                      </tr>
                      <tr>
                        <td style="color: #7A6557;">Pass Quantity:</td>
                        <td style="font-weight: bold; color: #2A1810;">${data.quantity} Pass${data.quantity > 1 ? 'es' : ''}</td>
                      </tr>
                      <tr>
                        <td style="color: #7A6557;">Amount Paid:</td>
                        <td style="font-weight: bold; color: #166534;">₹${data.amountInr.toLocaleString('en-IN')}</td>
                      </tr>
                      <tr>
                        <td style="color: #7A6557;">Booking Status:</td>
                        <td style="font-weight: bold; color: #047857;">CONFIRMED</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- 6. EVENT INFORMATION -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #FDF9F3; border: 1px solid #E5D5BA; border-radius: 12px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 18px;">
                    <div style="font-size: 13px; font-weight: 800; color: #7A1930; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 12px; border-bottom: 1px solid #E5D5BA; pb-2;">
                      EVENT INFORMATION
                    </div>
                    <table width="100%" cellpadding="4" cellspacing="0" border="0" style="font-size: 13px;">
                      <tr>
                        <td style="color: #7A6557; width: 42%;">Venue:</td>
                        <td style="font-weight: bold; color: #2A1810;">Malaviya Cricket Ground ONGC, Ahmedabad</td>
                      </tr>
                      <tr>
                        <td style="color: #7A6557;">Event:</td>
                        <td style="font-weight: bold; color: #2A1810;">ONGC Navratri 2026</td>
                      </tr>
                      <tr>
                        <td style="color: #7A6557;">Event Dates:</td>
                        <td style="font-weight: bold; color: #2A1810;">11–19 October 2026</td>
                      </tr>
                      <tr>
                        <td style="color: #7A6557;">Gates Open:</td>
                        <td style="font-weight: bold; color: #2A1810;">From 7:00 PM</td>
                      </tr>
                      <tr>
                        <td style="color: #7A6557;">Pass Timing:</td>
                        <td style="font-weight: bold; color: #7A1930;">${passTiming}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- 8. ENTRY GUIDELINES -->
              <div style="background-color: #FAF5F0; border: 1px solid #D4AF37; border-radius: 12px; padding: 18px 20px; margin-bottom: 24px;">
                <h4 style="font-size: 13px; font-weight: 800; color: #7A1930; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 10px 0;">
                  ENTRY GUIDELINES
                </h4>
                <ul style="margin: 0; padding-left: 20px; font-size: 12px; color: #4A3B32; line-height: 1.7;">
                  <li>Keep your digital pass ready at the entry gate.</li>
                  <li>Show the QR code to scanning staff.</li>
                  <li>Each QR is unique to its pass.</li>
                  <li>Do not share or forward the QR code.</li>
                  <li>Follow venue security and entry instructions.</li>
                  <li>Pass validity follows the selected pass type, booking date, and timing (${passTiming}).</li>
                  <li>Tickets are strictly non-refundable and non-transferable under any circumstances.</li>
                </ul>
              </div>

              <!-- 9. OUR PARTNERS / SPONSORS -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top: 1px solid #E5D5BA; margin-top: 8px; padding-top: 22px;">
                <tr>
                  <td align="center" style="padding-bottom: 16px;">
                    <div style="font-size: 11px; font-weight: 800; letter-spacing: 2px; color: #7A1930; text-transform: uppercase;">
                      OUR PARTNERS
                    </div>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-bottom: 10px;">
                    <div style="font-size: 10px; font-weight: 700; letter-spacing: 1.5px; color: #8A7264; text-transform: uppercase; margin-bottom: 12px;">
                      TITLE SPONSOR
                    </div>
                    <!-- TITLE SPONSORS LOGOS (Responsive: side-by-side on desktop, stacks on mobile) -->
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 0 auto; text-align: center;">
                      <tr>
                        <td align="center" style="text-align: center; font-size: 0; padding: 0;">
                          <!--[if mso]>
                          <table cellpadding="0" cellspacing="0" border="0" align="center"><tr><td valign="middle" style="padding: 6px;">
                          <![endif]-->
                          <div style="display: inline-block; vertical-align: middle; padding: 6px; font-size: 13px;">
                            <table cellpadding="0" cellspacing="0" border="0" style="background-color: #FFFFFF; border: 1px solid #EAE0D5; border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.04);">
                              <tr>
                                <td align="center" valign="middle" style="padding: 10px 14px;">
                                  <img src="${brandingUrls.zairaDiamondLogoUrl}" alt="Zaira Diamond" width="150" style="display: block; width: 150px; max-width: 100%; height: auto; max-height: 65px; object-fit: contain; border: 0;" />
                                </td>
                              </tr>
                            </table>
                          </div>
                          <!--[if mso]>
                          </td><td valign="middle" style="padding: 6px;">
                          <![endif]-->
                          <div style="display: inline-block; vertical-align: middle; padding: 6px; font-size: 13px;">
                            <table cellpadding="0" cellspacing="0" border="0" style="background-color: #FFFFFF; border: 1px solid #EAE0D5; border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.04);">
                              <tr>
                                <td align="center" valign="middle" style="padding: 10px 14px;">
                                  <img src="${brandingUrls.omSanctuaryLogoUrl}" alt="Om Sanctuary Palace" width="130" style="display: block; width: 130px; max-width: 100%; height: auto; max-height: 65px; object-fit: contain; border: 0;" />
                                </td>
                              </tr>
                            </table>
                          </div>
                          <!--[if mso]>
                          </td></tr></table>
                          <![endif]-->
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top: 14px; padding-bottom: 6px;">
                    <div style="font-size: 10px; font-weight: 700; letter-spacing: 1.5px; color: #8A7264; text-transform: uppercase; margin-bottom: 10px;">
                      MEDIA PARTNER
                    </div>
                    <!-- Lalkaar News Logo -->
                    <table cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 0 auto;">
                      <tr>
                        <td align="center" valign="middle" style="padding: 10px 18px; background-color: #FFFFFF; border: 1px solid #EAE0D5; border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.04);">
                          <img src="${brandingUrls.lalkaarLogoUrl}" alt="Lalkaar News" width="95" style="display: block; width: 95px; max-width: 100%; height: auto; max-height: 70px; object-fit: contain; border: 0;" />
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- 9. EVENT ORGANISER (DIGANT ART) -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top: 1px solid #E5D5BA; margin-top: 18px; padding-top: 22px; text-align: center;">
                <tr>
                  <td align="center">
                    <div style="font-size: 10px; font-weight: 800; letter-spacing: 2px; color: #8A7264; text-transform: uppercase; margin-bottom: 10px;">
                      EVENT ORGANISER
                    </div>
                    <table cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 0 auto;">
                      <tr>
                        <td align="center" style="padding: 5px 8px; background-color: #FFFFFF; border: 1px solid #EAE0D5; border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.04);">
                          <img src="${brandingUrls.digantArtLogoUrl}" alt="Digant Art" width="65" height="65" style="display: block; width: 65px; max-width: 100%; height: auto; max-height: 65px; border-radius: 6px; border: 0;" />
                        </td>
                      </tr>
                    </table>
                    <div style="font-size: 11px; font-weight: 700; color: #7A1930; margin-top: 8px; letter-spacing: 0.5px;">
                      Digant Art
                    </div>
                    <div style="font-size: 10px; color: #8A7264; margin-top: 2px;">
                      Official Event Organiser
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- 10. SUPPORT & CONTACT FOOTER -->
          <tr>
            <td style="background-color: #2A1810; padding: 26px 20px; text-align: center; color: #E5D5BA; font-size: 12px; line-height: 1.6;">
              <div style="font-weight: 800; font-size: 13px; color: #FFFFFF; letter-spacing: 0.5px; margin-bottom: 8px;">
                Need Assistance?
              </div>
              <div style="margin: 0 0 4px 0; color: #E5D5BA;">
                Support: <a href="mailto:ongcnavratri@gmail.com" style="color: #F5E6B3; text-decoration: underline; font-weight: 600;">ongcnavratri@gmail.com</a>
              </div>
              <div style="margin: 0 0 12px 0; color: #E5D5BA;">
                E-Pass / Ticket Assistance: <a href="mailto:ticket@ongcnavratri.tech" style="color: #F5E6B3; text-decoration: underline; font-weight: 600;">ticket@ongcnavratri.tech</a>
              </div>
              <div style="font-size: 11px; color: #A69080; border-top: 1px solid rgba(229, 213, 186, 0.15); padding-top: 10px; margin-top: 10px;">
                This is an automated ticket confirmation.<br />
                Please do not reply to this email.
              </div>

              <!-- 11. REWORKZONE CREDIT / E-TICKETING SYSTEM (SUBTLE, RESTRAINED, ABSOLUTE BOTTOM) -->
              <div style="border-top: 1px solid rgba(229, 213, 186, 0.15); padding-top: 12px; margin-top: 14px; text-align: center; white-space: nowrap;">
                <span style="font-size: 10px; color: #8A7264; letter-spacing: 0.3px; white-space: nowrap; display: inline-block;">
                  E-Ticketing &amp; E-Pass System by <a href="https://reworkzone.com" target="_blank" rel="noopener noreferrer" style="color: #DC2626; font-size: 10px; font-weight: 700; text-decoration: none; white-space: nowrap;">Reworkzone.com</a>
                </span>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const textContent = `
ONGC
NAVRATRI 2026
Ahmedabad • Official Digital E-Pass

PAYMENT / BOOKING CONFIRMED • PASS READY

YOUR DIGITAL PASS${data.passes.length > 1 ? 'ES' : ''}:
${data.passes
  .map(
    (p, i) => `
Pass #${i + 1} (${p.category || 'E-Pass'})
Attendee: ${p.attendeeName || data.customerName}
Ticket ID: ${p.ticketNumber}
Event Date: ${formattedDates}
Pass Timing: ${passTiming}
View My Ticket: ${this.webUrl}/ticket/${encodeURIComponent(p.token)}
`,
  )
  .join('\n')}

IMPORTANT:
This QR code is unique to this pass. Please do not share or forward it.

BOOKING DETAILS:
Order Reference: ${data.orderNumber}
Pass Type: ${passTypeLabel}
Event Date: ${formattedDates}
Pass Quantity: ${data.quantity} Pass${data.quantity > 1 ? 'es' : ''}
Amount Paid: ₹${data.amountInr.toLocaleString('en-IN')}
Booking Status: CONFIRMED

EVENT INFORMATION:
Venue: Malaviya Cricket Ground ONGC, Ahmedabad
Event: ONGC Navratri 2026
Event Dates: 11–19 October 2026
Gates Open: From 7:00 PM
Pass Timing: ${passTiming}

ENTRY GUIDELINES:
- Keep your digital pass ready at the entry gate.
- Show the QR code to scanning staff.
- Each QR is unique to its pass.
- Do not share or forward the QR code.
- Follow venue security and entry instructions.
- Pass validity follows the selected pass type, booking date, and timing.
- Tickets are strictly non-refundable and non-transferable under any circumstances.

OUR PARTNERS:
TITLE SPONSOR:
Zaira Diamond, Om Sanctuary Palace

MEDIA PARTNER:
Lalkaar News

EVENT ORGANISER:
Digant Art
Official Event Organiser

NEED ASSISTANCE?

Support:
ongcnavratri@gmail.com

E-Pass / Ticket Assistance:
ticket@ongcnavratri.tech

This is an automated ticket confirmation.
Please do not reply to this email.

E-Ticketing & E-Pass System by
Reworkzone.com (https://reworkzone.com)
    `.trim();

    const emailSubject =
      data.subject || `Your ONGC Navratri 2026 E-Pass is Ready 🎉 - Order #${data.orderNumber}`;

    return {
      subject: emailSubject,
      html: htmlContent,
      text: textContent,
      attachments,
    };
  }

  /**
   * Sends the official commercial ticket confirmation email to customer
   */
  async sendCommercialTicketEmail(data: CommercialTicketEmailData): Promise<MailSendResult> {
    const built = await this.buildCommercialTicketEmail(data, { embedQrAsDataUri: false });

    return this.sendEmail({
      to: data.customerEmail,
      subject: built.subject,
      html: built.html,
      text: built.text,
      displayName: 'ONGC Navratri 2026',
      attachments: built.attachments,
    });
  }

  /**
   * Sends a test commercial ticket confirmation email to authenticated Super Admin
   */
  async sendTestCommercialTicketEmail(
    data: CommercialTicketEmailData,
    superAdminEmail: string,
  ): Promise<MailSendResult> {
    const built = await this.buildCommercialTicketEmail(data, { embedQrAsDataUri: false });

    return this.sendEmail({
      to: superAdminEmail,
      subject: `TEST — ONGC Navratri 2026 E-Pass - ${data.orderNumber}`,
      html: built.html,
      text: built.text,
      displayName: 'ONGC Navratri 2026',
      attachments: built.attachments,
    });
  }

  /**
   * Builds the official employee daily pass email HTML and text payload.
   */
  async buildEmployeeDailyPassEmail(
    data: EmployeeDailyPassEmailData,
    options?: { embedQrAsDataUri?: boolean },
  ): Promise<{
    subject: string;
    html: string;
    text: string;
    attachments: EmailAttachment[];
  }> {
    const embedAsDataUri = Boolean(options?.embedQrAsDataUri);
    const brandingUrls = getEmailBrandingUrls(this.webUrl);
    const attachments: EmailAttachment[] = [];

    const formattedDate = this.formatDates([data.eventDate]);
    const cid = `qr-daily-${data.ticketNumber.replace(/[^A-Za-z0-9]/g, '')}`;

    let base64Png = '';
    try {
      const qrBuffer = await QRCode.toBuffer(data.qrToken, {
        type: 'png',
        width: 280,
        margin: 2,
        errorCorrectionLevel: 'M',
      });
      base64Png = qrBuffer.toString('base64');
    } catch {
      this.logger.error(`Failed to generate QR buffer for daily employee pass ${data.ticketNumber}`);
    }

    if (base64Png && !embedAsDataUri) {
      attachments.push({
        filename: `Daily-Pass-${data.eventDate}.png`,
        content: base64Png,
        contentType: 'image/png',
        cid,
        encoding: 'base64',
      });
    }

    const qrImgSrc = base64Png
      ? embedAsDataUri
        ? `data:image/png;base64,${base64Png}`
        : `cid:${cid}`
      : '';

    const isFamily = !(
      data.relation.toLowerCase().includes('employee') ||
      data.relation.toLowerCase().includes('primary') ||
      data.relation.toLowerCase().includes('self')
    );

    const presentation = buildDailyEmployeePassPresentation({
      eventDate: data.eventDate,
      ticketNumber: data.ticketNumber,
      qrToken: data.qrToken,
      attendeeName: data.attendeeName,
      isFamily,
      relation: data.relation,
      employeeName: data.employeeName,
      employeeCpf: data.cpf,
      referenceNumber: data.referenceNumber || data.cpf,
      department: data.department,
    });
    const dayTheme: EventDayTheme = presentation.theme;
    const viewTicketUrl = data.viewTicketUrl || `${this.webUrl}/employee/daily-pass/${data.qrToken}`;
    const downloadPdfUrl = data.downloadPdfUrl || `${this.apiUrl}/public/employee/daily-pass/${data.qrToken}/pdf`;

    const emailSubject =
      data.subjectOverride ||
      `Your ONGC Navratri Entry Pass for Night ${presentation.nightNumber} (${presentation.eventDateFormatted}) - ${presentation.attendeeName}`;

    // Optional direct PDF attachment
    if (data.pdfBuffer && data.pdfBuffer.length > 0) {
      attachments.push({
        filename: `ONGC-Pass-${data.eventDate}-${data.attendeeName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
        content: data.pdfBuffer.toString('base64'),
        contentType: 'application/pdf',
      });
    }

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(emailSubject)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #FAF6EF; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #2A1810;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #FAF6EF; padding: 24px 12px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 640px; background-color: #FFFFFF; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border: 1px solid #E5D5BA; border-top: 6px solid ${dayTheme.primaryColor};">
          <!-- BRAND HEADER -->
          <tr>
            <td style="background-color: #FFFFFF; border-top: 4px solid ${dayTheme.primaryColor}; border-bottom: 2px solid ${dayTheme.secondaryColor}; padding: 24px 20px 18px 20px; text-align: center;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" align="center">
                <tr>
                  <td align="center" style="padding-bottom: 8px;">
                    <img src="${brandingUrls.ongcLogoUrl}" alt="ONGC Logo" width="100" style="display: block; width: 100px; max-width: 100px; height: auto; margin: 0 auto; border: 0; background: transparent;" />
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-bottom: 2px;">
                    <div style="font-family: 'Cinzel', 'Georgia', serif; font-size: 20px; font-weight: 800; color: ${dayTheme.primaryColor}; letter-spacing: 3px; text-transform: uppercase; line-height: 1.2;">
                      ONGC NAVRATRI 2026
                    </div>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <div style="font-size: 11px; font-weight: 700; color: ${dayTheme.secondaryColor}; letter-spacing: 1.5px; text-transform: uppercase;">
                      OFFICIAL EMPLOYEE & FAMILY ENTRY E-PASS
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- MAIN BODY -->
          <tr>
            <td style="padding: 24px 20px;">
              <!-- GREETING & STATUS ANNOUNCEMENT -->
              <div style="font-size: 15px; font-weight: 700; color: #2A1810; margin-bottom: 6px;">
                Hello ${this.escapeHtml(presentation.attendeeName)},
              </div>
              <div style="font-size: 13px; color: #4A3B32; line-height: 1.5; margin-bottom: 16px;">
                Your official entry pass for:
                <div style="margin: 8px 0; padding: 12px 16px; background-color: ${dayTheme.bgColor}; border-left: 4px solid ${dayTheme.primaryColor}; border-radius: 8px; border: 1px solid #EADDCF;">
                  <div style="font-size: 15px; font-weight: 800; color: ${dayTheme.primaryColor};">
                    ${presentation.eventDateFormatted} (${dayTheme.dayOfWeek})
                  </div>
                  <div style="font-size: 12px; font-weight: 800; color: ${dayTheme.secondaryColor}; text-transform: uppercase; letter-spacing: 1px; margin-top: 2px;">
                    NIGHT ${presentation.nightNumber} OF 9 — ${presentation.themeTitle}
                  </div>
                  <div style="font-size: 11px; color: #6E5C50; margin-top: 2px;">
                    Visual Motif: ${presentation.motifName}
                  </div>
                </div>
                is ready. Please present this date-specific pass at the gate.
              </div>

              <!-- ==================== TICKET PREVIEW ==================== -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #FFFFFF; border: 2px solid ${dayTheme.secondaryColor}; border-top: 4px solid ${dayTheme.primaryColor}; border-radius: 16px; margin-bottom: 22px; text-align: center; color: #2A1810; box-shadow: 0 4px 16px rgba(0,0,0,0.06);">
                <tr>
                  <td style="padding: 20px 18px; text-align: center;">
                    <!-- TOP TICKET TAG -->
                    <div style="display: inline-block; background-color: ${dayTheme.primaryColor}; border-radius: 20px; padding: 4px 14px; font-size: 11px; font-weight: 800; color: #FFFFFF; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">
                      NIGHT ${presentation.nightNumber} &bull; ${presentation.themeTitle}
                    </div>

                    <!-- ATTENDEE NAME -->
                    <div style="font-size: 22px; font-weight: 900; color: ${dayTheme.primaryColor}; margin: 4px 0 2px 0;">
                      ${this.escapeHtml(presentation.attendeeName)}
                    </div>
                    <div style="font-size: 11px; font-weight: 800; color: ${dayTheme.secondaryColor}; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px;">
                      PASS HOLDER: ${presentation.isFamily ? 'FAMILY MEMBER' : 'EMPLOYEE'}
                    </div>

                    <!-- ATTENDEE / PRIMARY EMPLOYEE METADATA -->
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #FAF8F5; border-radius: 10px; border: 1px solid #EADDCF; margin-bottom: 14px; text-align: left;">
                      <tr>
                        <td style="padding: 10px 14px; font-size: 11px; line-height: 1.6; color: #4A3B32;">
                          <div><strong>Pass Holder:</strong> <span style="color: ${dayTheme.primaryColor}; font-weight: 800;">${presentation.isFamily ? 'FAMILY MEMBER' : 'EMPLOYEE'}</span></div>
                          ${presentation.isFamily ? `
                            <div><strong>Attendee Name:</strong> <span style="color: #1A1A1A; font-weight: 700;">${this.escapeHtml(presentation.attendeeName)}</span></div>
                            <div><strong>Relationship:</strong> <span style="color: #1A1A1A;">${this.escapeHtml(presentation.relation)}</span></div>
                            <div><strong>Primary Employee:</strong> <span style="color: #1A1A1A; font-weight: 700;">${this.escapeHtml(presentation.primaryEmployeeName)}</span></div>
                            <div><strong>Ref No.:</strong> <span style="font-family: monospace; color: #1A1A1A; font-weight: 700;">${this.escapeHtml(presentation.referenceNumber || presentation.employeeCpf)}</span></div>
                          ` : `
                            <div><strong>Employee Name:</strong> <span style="color: #1A1A1A; font-weight: 700;">${this.escapeHtml(presentation.attendeeName)}</span></div>
                            <div><strong>Ref No.:</strong> <span style="font-family: monospace; color: #1A1A1A; font-weight: 700;">${this.escapeHtml(presentation.referenceNumber || presentation.employeeCpf)}</span></div>
                            <div><strong>Department:</strong> <span style="color: #1A1A1A;">${this.escapeHtml(presentation.department)}</span></div>
                          `}
                          <div><strong>Ticket Number:</strong> <span style="font-family: monospace; font-weight: 700; color: #1A1A1A;">${this.escapeHtml(presentation.ticketNumber)}</span></div>
                          <div><strong>Authorized Date:</strong> <span style="font-weight: 800; color: ${dayTheme.primaryColor};">${presentation.eventDateFormatted}</span></div>
                          <div><strong>Venue:</strong> ${presentation.venue.name}</div>
                          <div><strong>Entry Timing:</strong> ${presentation.entryTiming}</div>
                        </td>
                      </tr>
                    </table>

                    <!-- QR CODE CONTAINER -->
                    <table cellpadding="0" cellspacing="0" border="0" align="center" style="background-color: #FFFFFF; border-radius: 12px; margin: 10px auto; border: 2px solid ${dayTheme.secondaryColor};">
                      <tr>
                        <td align="center" style="padding: 12px; background-color: #FFFFFF; border-radius: 10px;">
                          ${base64Png ? `
                            <img src="${qrImgSrc}" alt="Entry QR - ${presentation.ticketNumber}" width="190" height="190" style="display: block; width: 190px; height: 190px; margin: 0 auto; border: 0;" />
                          ` : `
                            <div style="width: 190px; height: 190px; line-height: 190px; text-align: center; color: ${dayTheme.primaryColor}; font-size: 12px; font-weight: bold;">
                              QR code loading...
                            </div>
                          `}
                          <div style="display: inline-block; background-color: ${dayTheme.bgColor}; border: 1px solid ${dayTheme.primaryColor}; border-radius: 12px; padding: 4px 10px; margin-top: 8px; font-size: 10px; font-weight: 900; letter-spacing: 1px; color: ${dayTheme.primaryColor}; text-transform: uppercase;">
                            VALID STRICTLY ON ${presentation.eventDateFormatted.toUpperCase()}
                          </div>
                        </td>
                      </tr>
                    </table>

                    <div style="font-size: 11px; color: #6E5C50; margin-top: 4px;">
                      Single-entry credential valid strictly for ${presentation.eventDateFormatted}.
                    </div>
                  </td>
                </tr>
              </table>

              <!-- ==================== ACTION CTA BUTTONS ==================== -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 18px 0 20px 0;">
                <tr>
                  <td align="center">
                    <table cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
                      <tr>
                        <td align="center" style="padding: 6px;">
                          <a href="${viewTicketUrl}" target="_blank" style="display: inline-block; background-color: ${dayTheme.primaryColor}; color: #FFFFFF; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; font-weight: 800; text-decoration: none; padding: 13px 24px; border-radius: 12px; letter-spacing: 0.5px; border: 1px solid ${dayTheme.secondaryColor}; box-shadow: 0 2px 6px rgba(0,0,0,0.15);">
                            &#x1F39F;&#xFE0F; VIEW TICKET
                          </a>
                        </td>
                        <td align="center" style="padding: 6px;">
                          <a href="${downloadPdfUrl}" target="_blank" style="display: inline-block; background-color: #FAF5EE; color: ${dayTheme.primaryColor}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; font-weight: 800; text-decoration: none; padding: 13px 24px; border-radius: 12px; letter-spacing: 0.5px; border: 2px solid ${dayTheme.secondaryColor}; box-shadow: 0 2px 6px rgba(0,0,0,0.08);">
                            &#x1F4E5; DOWNLOAD PDF
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- INSTRUCTIONS BELOW BUTTONS -->
              <div style="text-align: center; margin-bottom: 22px;">
                <p style="font-size: 13px; color: #4A3B32; margin: 0 0 4px 0;">
                  Your QR code is also included in the ticket above.
                </p>
                <p style="font-size: 13px; font-weight: 700; color: #2A1810; margin: 0 0 4px 0;">
                  Please show this QR at the entry gate.
                </p>
                <p style="font-size: 12px; font-weight: 600; color: ${dayTheme.primaryColor}; margin: 0;">
                  This QR is valid only for the date shown on the ticket (${dayTheme.fullDateLabel}).
                </p>
              </div>

              <!-- GUIDELINES -->
              <div style="background-color: #FAF5F0; border: 1px solid ${dayTheme.secondaryColor}; border-left: 4px solid ${dayTheme.primaryColor}; border-radius: 12px; padding: 16px 18px; margin-bottom: 22px;">
                <h4 style="font-size: 12px; font-weight: 800; color: ${dayTheme.primaryColor}; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px 0;">
                  ENTRY GUIDELINES
                </h4>
                <ul style="margin: 0; padding-left: 18px; font-size: 12px; color: #4A3B32; line-height: 1.6;">
                  <li>Keep this digital pass or downloaded PDF ready on your mobile device at the gate.</li>
                  <li>Each attendee must present their own specific QR pass.</li>
                  <li>This pass allows <strong>single entry only</strong> on ${dayTheme.fullDateLabel}.</li>
                  <li>Once scanned, the pass cannot be reused on the same day or any other date.</li>
                  <li>Passes are strictly non-transferable. Please carry valid photo ID.</li>
                </ul>
              </div>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background-color: #2A1810; padding: 24px 20px; text-align: center; color: #E5D5BA; font-size: 12px; line-height: 1.6;">
              <div style="font-weight: 800; font-size: 13px; color: #FFFFFF; letter-spacing: 0.5px; margin-bottom: 6px;">
                ONGC Navratri 2026 Organizing Committee
              </div>
              <div style="font-size: 11px; color: #A69080;">
                For assistance, contact <a href="mailto:ongcnavratri@gmail.com" style="color: #F5E6B3; text-decoration: underline;">ongcnavratri@gmail.com</a>
              </div>
              <div style="font-size: 11px; color: #A69080; border-top: 1px solid rgba(229, 213, 186, 0.15); padding-top: 8px; margin-top: 8px;">
                Official date-specific pass delivery &bull; Organizer: Digant Art &bull; Venue: Malaviya Cricket Ground ONGC
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    const textContent = `
ONGC NAVRATRI 2026
Your Daily Entry Pass

Hello ${presentation.attendeeName},

Your entry pass for:
${dayTheme.fullDateLabel} (${dayTheme.dayOfWeek})
NIGHT ${presentation.nightNumber} — ${presentation.themeTitle}
is ready.

PASS DETAILS:
Attendee: ${presentation.attendeeName}
Pass Type: ${presentation.passTypeWithRelation}
${presentation.isFamily ? `Primary Employee: ${presentation.primaryEmployeeName}\nRef No.: ${presentation.referenceNumber || presentation.employeeCpf}\nRelationship: ${presentation.relation}\n` : `Ref No.: ${presentation.referenceNumber || presentation.employeeCpf}\n`}Ticket No: ${presentation.ticketNumber}
Date: ${dayTheme.fullDateLabel}
Venue: Malaviya Cricket Ground ONGC, Ahmedabad
Gates Open: From 7:00 PM

ACTIONS:
- View Online Ticket: ${viewTicketUrl}
- Download PDF Ticket: ${downloadPdfUrl}

Your QR code is also included in the ticket above.
Please show this QR at the entry gate.
This QR is valid only for the date shown on the ticket.

ONGC Navratri 2026 Organizing Committee
Organizer: Digant Art
    `.trim();

    return {
      subject: emailSubject,
      html: htmlContent,
      text: textContent,
      attachments,
    };
  }

  /**
   * Sends the date-specific entry pass email to employee or family member
   */
  async sendEmployeeDailyPassEmail(data: EmployeeDailyPassEmailData): Promise<MailSendResult> {
    const built = await this.buildEmployeeDailyPassEmail(data, { embedQrAsDataUri: false });

    return this.sendEmail({
      to: data.recipientEmail,
      subject: built.subject,
      html: built.html,
      text: built.text,
      displayName: 'ONGC Navratri 2026',
      attachments: built.attachments,
    });
  }

  /**
   * Generates the rendered HTML preview for an employee daily pass email
   */
  async previewEmployeeDailyPassEmail(
    data: EmployeeDailyPassEmailData,
  ): Promise<{ subject: string; html: string; text: string }> {
    const built = await this.buildEmployeeDailyPassEmail(data, { embedQrAsDataUri: true });
    return {
      subject: built.subject,
      html: built.html,
      text: built.text,
    };
  }

  /**
   * Sends the official password reset OTP email
   */
  async sendPasswordResetOtpEmail(to: string, otp: string): Promise<MailSendResult> {
    const textContent = `
Hello,

We received a request to reset your ONGC Navratri account password.

Your password reset OTP is:

${otp}

This OTP expires in 10 minutes.

Do not share this OTP with anyone.

If you did not request a password reset, you can safely ignore this email.

Regards,
ONGC Navratri Team
    `.trim();

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Your ONGC Navratri Account Password Reset OTP</title>
</head>
<body style="margin: 0; padding: 0; background-color: #FAF6EF; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #2A1810;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #FAF6EF; padding: 24px 12px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 540px; background-color: #FFFFFF; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border: 1px solid #E5D5BA;">
          <!-- HEADER -->
          <tr>
            <td style="background: linear-gradient(135deg, #7A1930 0%, #5A0F21 100%); padding: 28px 24px; text-align: center; color: #FFFFFF; border-bottom: 3px solid #D4AF37;">
              <div style="font-size: 11px; font-weight: bold; letter-spacing: 2px; color: #F5E6B3; text-transform: uppercase;">
                Oil and Natural Gas Corporation Ltd.
              </div>
              <h1 style="margin: 6px 0 0 0; font-size: 22px; font-weight: 800; color: #FFFFFF; letter-spacing: 0.5px;">
                ONGC NAVRATRI 2026
              </h1>
              <p style="margin: 4px 0 0 0; font-size: 13px; color: #F5E6B3;">
                Account Security &bull; Entry Control Portal
              </p>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="padding: 28px 24px;">
              <p style="font-size: 15px; margin: 0 0 14px 0; color: #2A1810; font-weight: 600;">
                Hello,
              </p>
              <p style="font-size: 14px; line-height: 1.6; color: #4A3B32; margin: 0 0 20px 0;">
                We received a request to reset your ONGC Navratri account password.
              </p>

              <!-- OTP CARD -->
              <div style="background: linear-gradient(145deg, #FAF5F0 0%, #F5EFEB 100%); border: 2px dashed #D4AF37; border-radius: 14px; padding: 24px 16px; margin: 0 0 20px 0; text-align: center;">
                <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #7A1930; margin-bottom: 8px;">
                  Your Password Reset OTP
                </div>
                <div style="font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 900; letter-spacing: 8px; color: #5A0F21; padding: 6px 0;">
                  ${this.escapeHtml(otp)}
                </div>
                <div style="font-size: 12px; font-weight: 600; color: #92400E; margin-top: 8px;">
                  &#x23F1; This OTP expires in <strong>10 minutes</strong>
                </div>
              </div>

              <!-- NOTICE -->
              <div style="background-color: #FEF3C7; border: 1px solid #F59E0B; border-radius: 10px; padding: 12px 16px; margin: 0 0 20px 0; font-size: 13px; color: #92400E; font-weight: 500; line-height: 1.5;">
                &#x1F512; <strong>Security Notice:</strong> Do not share this OTP with anyone. ONGC staff will never ask for your OTP or password.
              </div>

              <p style="font-size: 13px; line-height: 1.6; color: #6E5C50; margin: 0 0 20px 0;">
                If you did not request a password reset, you can safely ignore this email. Your current password remains active and secure.
              </p>

              <p style="font-size: 14px; margin: 0; color: #2A1810;">
                Regards,<br>
                <strong>ONGC Navratri Team</strong>
              </p>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background-color: #2A1810; padding: 20px; text-align: center; color: #E5D5BA; font-size: 11px; line-height: 1.5;">
              <p style="margin: 0 0 4px 0; font-weight: bold; color: #FFFFFF;">
                ONGC Navratri 2026 Organizing Committee
              </p>
              <p style="margin: 0; color: #A69080;">
                This is an automated transactional security message. Please do not reply directly to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    return this.sendEmail({
      to,
      subject: 'Your ONGC Navratri Account Password Reset OTP',
      html: htmlContent,
      text: textContent,
      displayName: 'ONGC Navratri 2026',
    });
  }

  /**
   * Helper to safely mask customer email for logs (e.g. j***e@example.com)
   */
  maskEmail(email: string): string {
    if (!email) return '***';
    const parts = email.split('@');
    if (parts.length !== 2) return '***@***';
    const name = parts[0];
    const domain = parts[1];
    if (name.length <= 2) {
      return `${name[0]}***@${domain}`;
    }
    return `${name[0]}***${name[name.length - 1]}@${domain}`;
  }

  /**
   * Simple HTML escaping for template injection prevention
   */
  private escapeHtml(str: string): string {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Strip HTML tags for plain text fallback
   */
  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
  }
}

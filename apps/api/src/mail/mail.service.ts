import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as QRCode from 'qrcode';
import {
  SendEmailOptions,
  CommercialTicketEmailData,
  MailSendResult,
  EmailAttachment,
} from './mail.types';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly apiKey: string;
  private readonly mailbox: string;
  private readonly baseUrl: string;
  private readonly mailboxResourceIdOverride?: string;
  private readonly webUrl: string;
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
          signal: AbortSignal.timeout(10000),
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
        ? 'Request timed out after 10 seconds'
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
   * Sends the official commercial ticket confirmation email
   */
  async sendCommercialTicketEmail(data: CommercialTicketEmailData): Promise<MailSendResult> {
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

    const portalUrl = `${this.webUrl}/my-tickets?orderNumber=${encodeURIComponent(data.orderNumber)}`;
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

        if (base64Png) {
          attachments.push({
            filename: `QR-${pass.ticketNumber}.png`,
            content: base64Png,
            contentType: 'image/png',
            cid,
            encoding: 'base64',
          });
        }

        const qrImgSrc = base64Png ? `cid:${cid}` : '';

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
          <!-- 1. ONGC NAVRATRI HEADER -->
          <tr>
            <td style="background: linear-gradient(135deg, #7A1930 0%, #5A0F21 100%); padding: 28px 24px; text-align: center; color: #FFFFFF; border-bottom: 3px solid #D4AF37;">
              <div style="font-size: 12px; font-weight: bold; letter-spacing: 2px; color: #F5E6B3; text-transform: uppercase;">
                Oil and Natural Gas Corporation Ltd.
              </div>
              <h1 style="margin: 8px 0 4px 0; font-size: 26px; font-weight: 800; color: #FFFFFF; letter-spacing: 0.5px;">
                ONGC NAVRATRI 2026
              </h1>
              <p style="margin: 0; font-size: 14px; color: #F5E6B3;">
                Ahmedabad &bull; Official Digital Entry Pass
              </p>
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
                        <td style="font-weight: bold; color: #2A1810;">ONGC Ground, Chandkheda, Ahmedabad</td>
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

              <!-- 7. RECOVERY / MY TICKETS PORTAL LINK -->
              <div style="background-color: #F5EFEB; border-radius: 12px; padding: 16px; margin-bottom: 24px; text-align: center;">
                <p style="font-size: 13px; color: #5A4A3E; margin: 0 0 10px 0;">
                  Access your passes anytime online by entering your <strong>Order Number</strong> and <strong>Mobile Number</strong>:
                </p>
                <a href="${portalUrl}" style="display: inline-block; background-color: #7A1930; color: #FFFFFF; font-weight: bold; font-size: 13px; padding: 10px 20px; text-decoration: none; border-radius: 8px;">
                  Access My Tickets Portal &rarr;
                </a>
              </div>

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
              <div style="border-top: 1px solid #E5D5BA; padding: 20px 0 16px 0; text-align: center;">
                <div style="font-size: 11px; font-weight: 800; letter-spacing: 2px; color: #7A1930; text-transform: uppercase; margin-bottom: 12px;">
                  OUR PARTNERS
                </div>
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td align="center" style="font-size: 12px; color: #4A3B32; padding-bottom: 8px;">
                      <div style="font-size: 10px; font-weight: bold; color: #8A7264; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">
                        TITLE SPONSORS
                      </div>
                      <strong style="color: #2A1810; font-size: 13px;">Zaira Diamond</strong> &bull; <strong style="color: #2A1810; font-size: 13px;">Om Sanctuary Palace</strong>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="font-size: 12px; color: #4A3B32; padding-top: 4px;">
                      <div style="font-size: 10px; font-weight: bold; color: #8A7264; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">
                        MEDIA SPONSOR
                      </div>
                      <strong style="color: #2A1810; font-size: 13px;">Lalkaar News</strong>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- 10. EVENT ORGANISER -->
              <div style="border-top: 1px solid #E5D5BA; padding: 18px 0 6px 0; text-align: center;">
                <div style="font-size: 10px; font-weight: 800; letter-spacing: 2px; color: #8A7264; text-transform: uppercase; margin-bottom: 6px;">
                  EVENT ORGANISER
                </div>
                <div style="font-size: 13px; font-weight: 800; color: #7A1930;">
                  ONGC Navratri 2026 Organizing Committee
                </div>
                <div style="font-size: 11px; color: #6E5C50; margin-top: 2px;">
                  Oil and Natural Gas Corporation Ltd. - Ahmedabad
                </div>
              </div>
            </td>
          </tr>

          <!-- 11. FOOTER -->
          <tr>
            <td style="background-color: #2A1810; padding: 24px; text-align: center; color: #E5D5BA; font-size: 12px; line-height: 1.5;">
              <p style="margin: 0 0 6px 0; font-weight: bold; color: #FFFFFF;">
                Need assistance?
              </p>
              <p style="margin: 0 0 8px 0;">
                Support: <a href="mailto:${this.mailbox}" style="color: #D4AF37; text-decoration: none;">${this.mailbox}</a>
              </p>
              <p style="margin: 0; font-size: 11px; color: #A69080;">
                This is an automated ticket confirmation. Please do not reply directly to this email.
              </p>
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
ONGC NAVRATRI 2026 - OFFICIAL ENTRY PASS
Oil and Natural Gas Corporation Ltd. - Ahmedabad
Ahmedabad • Official Digital Entry Pass

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
Venue: ONGC Ground, Chandkheda, Ahmedabad
Event: ONGC Navratri 2026
Event Dates: 11–19 October 2026
Gates Open: From 7:00 PM
Pass Timing: ${passTiming}

ONLINE PORTAL:
Access your passes anytime online: ${portalUrl}

ENTRY GUIDELINES:
- Keep your digital pass ready at the entry gate.
- Show the QR code to scanning staff.
- Each QR is unique to its pass.
- Do not share or forward the QR code.
- Follow venue security and entry instructions.
- Pass validity follows the selected pass type, booking date, and timing.
- Tickets are strictly non-refundable and non-transferable under any circumstances.

OUR PARTNERS:
Title Sponsors: Zaira Diamond, Om Sanctuary Palace
Media Sponsor: Lalkaar News

EVENT ORGANISER:
ONGC Navratri 2026 Organizing Committee
Oil and Natural Gas Corporation Ltd. - Ahmedabad

Need assistance? Contact us at: ${this.mailbox}
This is an automated ticket confirmation. Please do not reply to this email.
    `.trim();

    return this.sendEmail({
      to: data.customerEmail,
      subject: `Your ONGC Navratri 2026 E-Pass is Ready 🎉 - Order #${data.orderNumber}`,
      html: htmlContent,
      text: textContent,
      displayName: 'ONGC Navratri 2026',
      attachments,
    });
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

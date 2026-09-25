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
      this.configService.get<string>('HOSTINGER_MAILBOX') || 'tickets@ongcnavratri.tech'
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
        this.logger.log(`Transactional ticket email successfully dispatched to ${masked}.`);
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
        : 'Daily Entry Pass';

    const portalUrl = `${this.webUrl}/my-tickets?orderNumber=${encodeURIComponent(data.orderNumber)}`;
    const attachments: EmailAttachment[] = [];

    // Generate individual pass cards with real, scannable QR codes
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
          <div style="background: linear-gradient(145deg, #5A0F21 0%, #7A1930 60%, #3D0714 100%); border: 2px solid #D4AF37; border-radius: 16px; padding: 22px 18px; margin-bottom: 22px; text-align: center; color: #FFFFFF; box-shadow: 0 4px 15px rgba(90, 15, 33, 0.3);">
            <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #F5E6B3; font-weight: bold; margin-bottom: 4px;">
              Pass Holder ${data.passes.length > 1 ? `#${idx + 1}` : ''} &bull; ${pass.category || 'Commercial Pass'}
            </div>
            <div style="font-size: 20px; font-weight: 800; color: #FFFFFF; margin: 4px 0 2px 0;">
              ${this.escapeHtml(pass.attendeeName || data.customerName)}
            </div>
            <div style="font-size: 13px; font-family: 'Courier New', Courier, monospace; color: #FDE047; font-weight: bold; margin-bottom: 14px;">
              Ticket ID: ${pass.ticketNumber}
            </div>

            <!-- REAL SCANNABLE QR CODE CONTAINER -->
            <div style="background-color: #FFFFFF; border-radius: 14px; padding: 14px; display: inline-block; margin: 6px auto 14px auto; box-shadow: 0 3px 12px rgba(0,0,0,0.25);">
              ${base64Png ? `
                <img src="${qrImgSrc}" alt="Entry QR Pass" width="200" height="200" style="display: block; width: 200px; height: 200px; margin: 0 auto; border: 0;" />
              ` : `
                <div style="width: 200px; height: 200px; display: flex; align-items: center; justify-content: center; color: #7A1930; font-size: 12px; font-weight: bold;">
                  QR code available via link below
                </div>
              `}
              <div style="font-size: 11px; font-weight: 900; letter-spacing: 2px; color: #7A1930; text-transform: uppercase; margin-top: 8px;">
                SCAN AT ENTRY
              </div>
            </div>

            <!-- VIEW MY TICKET SECURE BUTTON -->
            <div style="margin-top: 6px;">
              <a href="${passUrl}" style="display: inline-block; background-color: #D4AF37; color: #5A0F21; font-weight: 800; font-size: 13px; padding: 11px 24px; text-decoration: none; border-radius: 8px; letter-spacing: 0.5px; box-shadow: 0 2px 6px rgba(0,0,0,0.2);">
                VIEW MY TICKET &rarr;
              </a>
            </div>
          </div>
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
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #FFFFFF; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border: 1px solid #E5D5BA;">
          <!-- HEADER -->
          <tr>
            <td style="background: linear-gradient(135deg, #7A1930 0%, #5A0F21 100%); padding: 32px 24px; text-align: center; color: #FFFFFF; border-bottom: 3px solid #D4AF37;">
              <div style="font-size: 12px; font-weight: bold; letter-spacing: 2px; color: #F5E6B3; text-transform: uppercase;">
                Oil and Natural Gas Corporation Ltd.
              </div>
              <h1 style="margin: 8px 0 4px 0; font-size: 26px; font-weight: 800; color: #FFFFFF;">
                ONGC Navratri 2026
              </h1>
              <p style="margin: 0; font-size: 14px; color: #F5E6B3;">
                Ahmedabad &bull; Official Commercial Entry Passes
              </p>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="padding: 28px 24px;">
              <p style="font-size: 16px; margin: 0 0 16px 0;">
                Dear <strong>${this.escapeHtml(data.customerName)}</strong>,
              </p>
              <p style="font-size: 14px; line-height: 1.6; color: #4A3B32; margin: 0 0 20px 0;">
                Thank you for booking your passes for the <strong>ONGC Navratri Festival 2026</strong>. Your payment has been confirmed and your digital passes are ready.
              </p>

              <!-- ORDER SUMMARY CARD -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #FDF9F3; border: 1px solid #E5D5BA; border-radius: 12px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 16px;">
                    <table width="100%" cellpadding="4" cellspacing="0" border="0" style="font-size: 13px;">
                      <tr>
                        <td style="color: #7A6557; width: 40%;">Order Reference:</td>
                        <td style="font-weight: bold; font-family: monospace; color: #7A1930;">${data.orderNumber}</td>
                      </tr>
                      <tr>
                        <td style="color: #7A6557;">Pass Type:</td>
                        <td style="font-weight: bold; color: #2A1810;">${passTypeLabel}</td>
                      </tr>
                      <tr>
                        <td style="color: #7A6557;">Event Dates:</td>
                        <td style="font-weight: bold; color: #2A1810;">${formattedDates}</td>
                      </tr>
                      <tr>
                        <td style="color: #7A6557;">Passes Count:</td>
                        <td style="font-weight: bold; color: #2A1810;">${data.quantity} Pass${data.quantity > 1 ? 'es' : ''}</td>
                      </tr>
                      <tr>
                        <td style="color: #7A6557;">Total Amount Paid:</td>
                        <td style="font-weight: bold; color: #166534;">₹${data.amountInr.toLocaleString('en-IN')}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- PASSES LIST -->
              <h3 style="font-size: 16px; color: #7A1930; margin: 0 0 12px 0;">
                Your Digital Passes (${data.passes.length})
              </h3>
              ${passesHtml}

              <!-- RECOVERY / PORTAL LINK -->
              <div style="background-color: #F5EFEB; border-radius: 12px; padding: 16px; margin: 24px 0; text-align: center;">
                <p style="font-size: 13px; color: #5A4A3E; margin: 0 0 10px 0;">
                  You can also view, print, or download your passes anytime online by entering your <strong>Order Number</strong> and <strong>Mobile Number</strong>:
                </p>
                <a href="${portalUrl}" style="display: inline-block; background-color: #7A1930; color: #FFFFFF; font-weight: bold; font-size: 13px; padding: 10px 20px; text-decoration: none; border-radius: 8px;">
                  Access My Tickets Portal &rarr;
                </a>
              </div>

              <!-- VENUE GUIDELINES -->
              <div style="border-top: 1px solid #E5D5BA; padding-top: 20px; font-size: 12px; color: #6E5C50; line-height: 1.6;">
                <strong style="color: #7A1930; font-size: 13px;">Important Entry Guidelines:</strong>
                <ul style="margin: 8px 0 0 0; padding-left: 20px;">
                  <li>Entry gates open daily at <strong>7:00 PM</strong> at <strong>ONGC Ground, Chandkheda, Ahmedabad</strong>.</li>
                  <li>Present your unique digital QR pass at the express turnstiles for fast entry.</li>
                  <li>Each QR pass is valid for one person per night.</li>
                  <li>Please carry a valid government-issued photo ID for security verification.</li>
                </ul>
              </div>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background-color: #2A1810; padding: 24px; text-align: center; color: #E5D5BA; font-size: 12px; line-height: 1.5;">
              <p style="margin: 0 0 6px 0; font-weight: bold; color: #FFFFFF;">
                ONGC Navratri 2026 Organizing Committee
              </p>
              <p style="margin: 0 0 8px 0;">
                For support and inquiries: <a href="mailto:${this.mailbox}" style="color: #D4AF37; text-decoration: none;">${this.mailbox}</a>
              </p>
              <p style="margin: 0; font-size: 11px; color: #A69080;">
                This is an automated transactional message regarding your official ticket booking. Please do not reply directly to this email.
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
ONGC NAVRATRI 2026 - TICKET CONFIRMATION
Oil and Natural Gas Corporation Ltd. - Ahmedabad

Dear ${data.customerName},

Thank you for booking your passes for the ONGC Navratri Festival 2026. Your payment has been confirmed and your digital passes are ready.

ORDER DETAILS:
Order Number: ${data.orderNumber}
Pass Type: ${passTypeLabel}
Event Dates: ${formattedDates}
Passes Count: ${data.quantity} Pass${data.quantity > 1 ? 'es' : ''}
Total Amount Paid: ₹${data.amountInr.toLocaleString('en-IN')}

YOUR PASSES:
${data.passes.map((p, i) => `Pass #${i + 1} (${p.category || 'Commercial Pass'}): Ticket ID: ${p.ticketNumber} | View Pass: ${this.webUrl}/ticket/${p.token}`).join('\n')}

ONLINE PORTAL:
Access your passes anytime online: ${portalUrl}

ENTRY GUIDELINES:
- Venue: ONGC Ground, Chandkheda, Ahmedabad
- Gates open daily at 7:00 PM
- Present individual digital QR passes at the gate
- Please carry a valid photo ID

Need assistance? Contact us at: ${this.mailbox}
    `.trim();

    return this.sendEmail({
      to: data.customerEmail,
      subject: `Your ONGC Navratri 2026 Passes - Order #${data.orderNumber}`,
      html: htmlContent,
      text: textContent,
      displayName: 'ONGC Navratri 2026',
      attachments,
    });
  }

  /**
   * Helper to safely mask customer email for logs (e.g. j***e@example.com)
   */
  private maskEmail(email: string): string {
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

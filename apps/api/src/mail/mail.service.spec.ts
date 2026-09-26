import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { MailService } from './mail.service';

describe('MailService (Hostinger Mail API)', () => {
  let service: MailService;
  let configService: ConfigService;
  let originalFetch: typeof global.fetch;

  beforeAll(() => {
    originalFetch = global.fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  describe('When HOSTINGER_MAIL_API_KEY is configured', () => {
    const mockApiKey = 'mock_hostinger_api_key_test_token';
    const mockMailbox = 'ticket@ongcnavratri.tech';
    const mockBaseUrl = 'https://api.mail.hostinger.com';

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          MailService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'HOSTINGER_MAIL_API_KEY') return mockApiKey;
                if (key === 'HOSTINGER_MAILBOX') return mockMailbox;
                if (key === 'HOSTINGER_MAIL_API_BASE_URL') return mockBaseUrl;
                if (key === 'APP_URL') return 'https://ongcnavratri.reworkzone.in';
                return undefined;
              }),
            },
          },
        ],
      }).compile();

      service = module.get<MailService>(MailService);
      configService = module.get<ConfigService>(ConfigService);
    });

    it('reports live mail configured as true', () => {
      expect(service.isLiveMailConfigured()).toBe(true);
      expect(service.getMailboxAddress()).toBe(mockMailbox);
    });

    it('successfully resolves mailbox resourceId from /api/v1/me and sends email via /send', async () => {
      const mockFetch = jest.fn();
      global.fetch = mockFetch;

      // 1. /api/v1/me response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            orderResourceId: 'OR123456',
            mailboxes: [
              {
                resourceId: 'AC_TEST_MAILBOX_1',
                address: 'ticket@ongcnavratri.tech',
              },
            ],
          },
        }),
      });

      // 2. /api/v1/mailboxes/AC_TEST_MAILBOX_1/send response (204 No Content)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      const result = await service.sendCommercialTicketEmail({
        orderNumber: 'ORD-COMM-20261011-TEST1',
        customerName: 'Aarav Patel',
        customerEmail: 'aarav@example.com',
        ticketType: 'COMMERCIAL_DAILY',
        selectedDates: ['2026-10-11'],
        quantity: 1,
        amountInr: 500,
        passes: [
          {
            ticketNumber: 'TK-COMM-TEST1-1-A1B2',
            token: 'secret_token_1234567890abcdef',
            category: 'Commercial Pass',
          },
        ],
      });

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Verify call 1: GET /api/v1/me
      const [meUrl, meOptions] = mockFetch.mock.calls[0];
      expect(meUrl).toBe('https://api.mail.hostinger.com/api/v1/me');
      expect(meOptions.headers.Authorization).toBe(`Bearer ${mockApiKey}`);

      // Verify call 2: POST /api/v1/mailboxes/AC_TEST_MAILBOX_1/send
      const [sendUrl, sendOptions] = mockFetch.mock.calls[1];
      expect(sendUrl).toBe('https://api.mail.hostinger.com/api/v1/mailboxes/AC_TEST_MAILBOX_1/send');
      expect(sendOptions.headers.Authorization).toBe(`Bearer ${mockApiKey}`);

      const body = JSON.parse(sendOptions.body);
      expect(body.to).toEqual(['aarav@example.com']);
      expect(body.subject).toContain('ORD-COMM-20261011-TEST1');
      expect(body.html).toContain('ONGC NAVRATRI 2026');
      expect(body.html).toContain('YOUR E-PASS');
      expect(body.html).toContain('Aarav Patel');
      expect(body.html).toContain('TK-COMM-TEST1-1-A1B2');
      expect(body.html).toContain('SCAN AT ENTRY');
      expect(body.html).toContain('VIEW MY E-PASS');
      expect(body.html).toContain('/ticket/secret_token_1234567890abcdef');
      expect(body.html).toContain('This QR code is unique to this pass. Please do not share or forward it.');
      expect(body.html).toContain('E-PASS BOOKING DETAILS');
      expect(body.html).toContain('EVENT INFORMATION');
      expect(body.html).toContain('8:00 PM – 4:00 AM');
      expect(body.html).toContain('non-refundable and non-transferable');
      expect(body.html).toContain('OUR PARTNERS');
      expect(body.html).toContain('TITLE SPONSOR');
      expect(body.html).toContain('MEDIA PARTNER');
      expect(body.html).toContain('src="cid:zaira-logo"');
      expect(body.html).toContain('src="cid:om-sanctuary-logo"');
      expect(body.html).toContain('src="cid:lalkaar-logo"');
      expect(body.html).toContain('ORGANISED BY');
      expect(body.html).toContain('src="cid:digant-art-logo"');
      expect(body.html).toContain('ONGC Navratri 2026');

      // Verify pass is positioned BEFORE booking details (Pass-first visual hierarchy)
      const passIndex = body.html.indexOf('YOUR E-PASS');
      const bookingDetailsIndex = body.html.indexOf('E-PASS BOOKING DETAILS');
      expect(passIndex).toBeGreaterThan(-1);
      expect(bookingDetailsIndex).toBeGreaterThan(-1);
      expect(passIndex).toBeLessThan(bookingDetailsIndex);

      // Verify no raw token exposure outside /ticket/
      const tokenOccurrences = body.html.split('secret_token_1234567890abcdef').length - 1;
      expect(tokenOccurrences).toBe(1); // Only in the href="/ticket/..."
      expect(body.html).not.toContain('rzp_');
      expect(body.html).not.toContain('order_DBJOW');

      // Verify attachments contain 1 QR + 5 branding inline CID images = 6 attachments
      expect(body.attachments).toBeDefined();
      expect(body.attachments.length).toBe(6);
      expect(body.attachments[0].filename).toBe('QR-TK-COMM-TEST1-1-A1B2.png');
      expect(body.attachments[0].contentType).toBe('image/png');
      expect(body.attachments[0].cid).toBe('qr-TKCOMMTEST11A1B2-1');
      expect(body.html).toContain(`src="cid:${body.attachments[0].cid}"`);

      // Verify branding attachments are present
      const cids = body.attachments.map((a: any) => a.cid);
      expect(cids).toContain('navratri-logo');
      expect(cids).toContain('zaira-logo');
      expect(cids).toContain('om-sanctuary-logo');
      expect(cids).toContain('lalkaar-logo');
      expect(cids).toContain('digant-art-logo');
    });

    it('correctly handles MANDLI pass timing (12:00 AM – 4:00 AM)', async () => {
      const mockFetch = jest.fn();
      global.fetch = mockFetch;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            mailboxes: [{ resourceId: 'AC_TEST_MAILBOX_1', address: 'ticket@ongcnavratri.tech' }],
          },
        }),
      });

      mockFetch.mockResolvedValueOnce({ ok: true, status: 204 });

      const result = await service.sendCommercialTicketEmail({
        orderNumber: 'ORD-COMM-MANDLI-1',
        customerName: 'Bhavin Shah',
        customerEmail: 'bhavin@example.com',
        ticketType: 'COMMERCIAL_MANDLI',
        selectedDates: ['2026-10-12'],
        quantity: 1,
        amountInr: 149,
        passes: [
          {
            ticketNumber: 'TK-COMM-MANDLI-1-1',
            token: 'token_mandli_xyz',
            category: 'Commercial Pass',
            attendeeName: 'Bhavin Shah',
          },
        ],
      });

      expect(result.success).toBe(true);
      const [, sendOptions] = mockFetch.mock.calls[1];
      const body = JSON.parse(sendOptions.body);

      expect(body.html).toContain('Mandli Pass');
      expect(body.html).toContain('12:00 AM – 4:00 AM');
      expect(body.text).toContain('12:00 AM – 4:00 AM');
      expect(body.html).toContain('TK-COMM-MANDLI-1-1');
    });

    it('correctly handles ANY DAY pass timing (8:00 PM – 4:00 AM)', async () => {
      const mockFetch = jest.fn();
      global.fetch = mockFetch;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            mailboxes: [{ resourceId: 'AC_TEST_MAILBOX_1', address: 'ticket@ongcnavratri.tech' }],
          },
        }),
      });

      mockFetch.mockResolvedValueOnce({ ok: true, status: 204 });

      const result = await service.sendCommercialTicketEmail({
        orderNumber: 'ORD-COMM-ANYDAY-1',
        customerName: 'Kavita Dave',
        customerEmail: 'kavita@example.com',
        ticketType: 'COMMERCIAL_ANY_DAY',
        selectedDates: ['2026-10-15'],
        quantity: 1,
        amountInr: 279,
        passes: [
          {
            ticketNumber: 'TK-COMM-ANYDAY-1-1',
            token: 'token_anyday_xyz',
            category: 'Commercial Pass',
            attendeeName: 'Kavita Dave',
          },
        ],
      });

      expect(result.success).toBe(true);
      const [, sendOptions] = mockFetch.mock.calls[1];
      const body = JSON.parse(sendOptions.body);

      expect(body.html).toContain('Any Day Pass');
      expect(body.html).toContain('8:00 PM – 4:00 AM');
      expect(body.text).toContain('8:00 PM – 4:00 AM');
    });

    it('correctly represents SEASON pass with multiple attendees and 9 nights', async () => {
      const mockFetch = jest.fn();
      global.fetch = mockFetch;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            mailboxes: [{ resourceId: 'AC_TEST_MAILBOX_1', address: 'ticket@ongcnavratri.tech' }],
          },
        }),
      });

      mockFetch.mockResolvedValueOnce({ ok: true, status: 204 });

      const result = await service.sendCommercialTicketEmail({
        orderNumber: 'ORD-COMM-SEASON-MULTIPLE',
        customerName: 'Mehul Desai',
        customerEmail: 'mehul@example.com',
        ticketType: 'COMMERCIAL_SEASON',
        selectedDates: [
          '2026-10-11', '2026-10-12', '2026-10-13',
          '2026-10-14', '2026-10-15', '2026-10-16',
          '2026-10-17', '2026-10-18', '2026-10-19',
        ],
        quantity: 2,
        amountInr: 3500,
        passes: [
          {
            ticketNumber: 'TK-COMM-SEAS-1-A1',
            token: 'token_attendee_1',
            category: 'Commercial Pass',
            attendeeName: 'Mehul Desai',
          },
          {
            ticketNumber: 'TK-COMM-SEAS-2-B2',
            token: 'token_attendee_2',
            category: 'Commercial Pass',
            attendeeName: 'Rina Desai',
          },
        ],
      });

      expect(result.success).toBe(true);
      const [, sendOptions] = mockFetch.mock.calls[1];
      const body = JSON.parse(sendOptions.body);

      expect(body.html).toContain('Season Pass (All 9 Nights)');
      expect(body.html).toContain('11–19 October 2026 (All 9 Nights)');
      expect(body.html).toContain('Mehul Desai');
      expect(body.html).toContain('Rina Desai');
      expect(body.attachments).toHaveLength(7);
      expect(body.attachments[0].filename).toBe('QR-TK-COMM-SEAS-1-A1.png');
      expect(body.attachments[1].filename).toBe('QR-TK-COMM-SEAS-2-B2.png');
      // Plus 5 branding attachments
      expect(body.attachments.map((a: any) => a.cid)).toEqual(
        expect.arrayContaining(['navratri-logo', 'zaira-logo', 'om-sanctuary-logo', 'lalkaar-logo', 'digant-art-logo']),
      );
    });

    it('safely handles Hostinger Mail API HTTP errors without crashing', async () => {
      const mockFetch = jest.fn();
      global.fetch = mockFetch;

      // 1. /api/v1/me response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            mailboxes: [{ resourceId: 'AC_TEST_1', address: 'ticket@ongcnavratri.tech' }],
          },
        }),
      });

      // 2. /send fails with 500
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal Mail Gateway Error' }),
      });

      const result = await service.sendEmail({
        to: 'customer@example.com',
        subject: 'Test Subject',
        html: '<p>Test</p>',
      });

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(500);
      expect(result.error).toContain('500');
    });

    it('handles network timeouts gracefully', async () => {
      const mockFetch = jest.fn();
      global.fetch = mockFetch;

      const timeoutError: any = new Error('The operation was aborted');
      timeoutError.name = 'TimeoutError';
      mockFetch.mockRejectedValueOnce(timeoutError);

      const result = await service.sendEmail({
        to: 'customer@example.com',
        subject: 'Timeout Test',
        html: '<p>Timeout</p>',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('timed out');
    });

    it('sends password reset OTP email with required text and formatting', async () => {
      const mockFetch = jest.fn();
      global.fetch = mockFetch;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            mailboxes: [{ resourceId: 'AC_TEST_MAILBOX_1', address: 'ticket@ongcnavratri.tech' }],
          },
        }),
      });

      mockFetch.mockResolvedValueOnce({ ok: true, status: 204 });

      const result = await service.sendPasswordResetOtpEmail('admin@ongc.co.in', '654321');

      expect(result.success).toBe(true);
      const [, sendOptions] = mockFetch.mock.calls[1];
      const body = JSON.parse(sendOptions.body);

      expect(body.to).toEqual(['admin@ongc.co.in']);
      expect(body.subject).toBe('Your ONGC Navratri Account Password Reset OTP');
      expect(body.html).toContain('654321');
      expect(body.html).toContain('This OTP expires in');
      expect(body.html).toContain('10 minutes');
      expect(body.html).toContain('Do not share this OTP with anyone.');
      expect(body.html).toContain('ONGC Navratri Team');
      expect(body.text).toContain('Hello,');
      expect(body.text).toContain('We received a request to reset your ONGC Navratri account password.');
      expect(body.text).toContain('654321');
      expect(body.text).toContain('This OTP expires in 10 minutes.');
      expect(body.text).toContain('Do not share this OTP with anyone.');
      expect(body.text).toContain('If you did not request a password reset, you can safely ignore this email.');
      expect(body.text).toContain('ONGC Navratri Team');

      // Verify no sensitive internal fields exist
      expect(body.html).not.toContain('SUPER_ADMIN');
      expect(body.html).not.toContain('staffId');
      expect(body.html).not.toContain('agentId');
    });

    describe('Commercial E-Pass Email Branding & Inline Logo Attachments (Section 10)', () => {
      it('verifies all 13 requirements for inline CIDs, email safety, and pass hierarchy', async () => {
        const mockFetch = jest.fn();
        global.fetch = mockFetch;

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              mailboxes: [{ resourceId: 'AC_TEST_MAILBOX_1', address: 'ticket@ongcnavratri.tech' }],
            },
          }),
        });

        mockFetch.mockResolvedValueOnce({ ok: true, status: 204 });

        const result = await service.sendCommercialTicketEmail({
          orderNumber: 'ORD-COMM-BRANDING-1',
          customerName: 'Pooja Shah',
          customerEmail: 'pooja@example.com',
          ticketType: 'COMMERCIAL_DAILY',
          selectedDates: ['2026-10-14'],
          quantity: 2,
          amountInr: 1000,
          passes: [
            { ticketNumber: 'TK-BRAND-1', token: 'token_pooja_1', category: 'Commercial Pass', attendeeName: 'Pooja Shah' },
            { ticketNumber: 'TK-BRAND-2', token: 'token_pooja_2', category: 'Commercial Pass', attendeeName: 'Rohan Shah' },
          ],
        });

        expect(result.success).toBe(true);
        const [, sendOptions] = mockFetch.mock.calls[1];
        const body = JSON.parse(sendOptions.body);

        const attachmentCids = body.attachments.map((a: any) => a.cid);

        // 1. Navratri logo CID is included.
        expect(attachmentCids).toContain('navratri-logo');

        // 2. Zaira Diamond logo CID is included.
        expect(attachmentCids).toContain('zaira-logo');

        // 3. Om Sanctuary Palace logo CID is included.
        expect(attachmentCids).toContain('om-sanctuary-logo');

        // 4. Lalkaar News logo CID is included.
        expect(attachmentCids).toContain('lalkaar-logo');

        // 5. Digant Art logo CID is included.
        expect(attachmentCids).toContain('digant-art-logo');

        // 6. HTML references the exact matching CIDs.
        expect(body.html).toContain('src="cid:navratri-logo"');
        expect(body.html).toContain('src="cid:zaira-logo"');
        expect(body.html).toContain('src="cid:om-sanctuary-logo"');
        expect(body.html).toContain('src="cid:lalkaar-logo"');
        expect(body.html).toContain('src="cid:digant-art-logo"');

        // 7. No local filesystem paths appear in HTML.
        expect(body.html).not.toMatch(/C:[\\/]/);
        expect(body.html).not.toMatch(/\/apps\/api/);
        expect(body.html).not.toMatch(/\/images\//);

        // 8. No external image URLs are required.
        expect(body.html).not.toMatch(/<img[^>]+src=["']https?:\/\//);

        // 9. QR CID still works.
        expect(attachmentCids).toContain('qr-TKBRAND1-1');
        expect(attachmentCids).toContain('qr-TKBRAND2-2');
        expect(body.html).toContain('src="cid:qr-TKBRAND1-1"');
        expect(body.html).toContain('src="cid:qr-TKBRAND2-2"');

        // 10. Multi-pass emails still contain each unique QR.
        const qrAttachments = body.attachments.filter((a: any) => a.filename.startsWith('QR-'));
        expect(qrAttachments).toHaveLength(2);
        expect(qrAttachments[0].cid).not.toBe(qrAttachments[1].cid);

        // 11. Existing ticket/order information is unchanged.
        expect(body.html).toContain('ORD-COMM-BRANDING-1');
        expect(body.html).toContain('Pooja Shah');
        expect(body.html).toContain('Rohan Shah');
        expect(body.html).toContain('TK-BRAND-1');
        expect(body.html).toContain('TK-BRAND-2');
        expect(body.html).toContain('₹1,000');

        // 12. No raw QR token is exposed outside secure link.
        expect(body.html).toContain('/ticket/token_pooja_1');
        expect(body.html).toContain('/ticket/token_pooja_2');
        const token1Count = body.html.split('token_pooja_1').length - 1;
        expect(token1Count).toBe(1);

        // 13. No payment/internal IDs are exposed.
        expect(body.html).not.toContain('rzp_');
        expect(body.html).not.toContain('order_DBJOW');
        expect(body.html).not.toContain('staffId');
        expect(body.html).not.toContain('SUPER_ADMIN');

        // Hierarchy check: Navratri logo header -> Digital Pass -> Sponsors -> Organiser
        const navratriLogoIdx = body.html.indexOf('src="cid:navratri-logo"');
        const passCardIdx = body.html.indexOf('src="cid:qr-TKBRAND1-1"');
        const sponsorsIdx = body.html.indexOf('OUR PARTNERS');
        const organiserIdx = body.html.indexOf('ORGANISED BY');
        expect(navratriLogoIdx).toBeGreaterThan(-1);
        expect(passCardIdx).toBeGreaterThan(navratriLogoIdx);
        expect(sponsorsIdx).toBeGreaterThan(passCardIdx);
        expect(organiserIdx).toBeGreaterThan(sponsorsIdx);
      });
    });
  });

  describe('When HOSTINGER_MAIL_API_KEY is missing', () => {
    let unconfiguredService: MailService;
    let loggerWarnSpy: jest.SpyInstance;

    beforeEach(async () => {
      loggerWarnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          MailService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'HOSTINGER_MAILBOX') return 'ticket@ongcnavratri.tech';
                return undefined;
              }),
            },
          },
        ],
      }).compile();

      unconfiguredService = module.get<MailService>(MailService);
    });

    afterEach(() => {
      loggerWarnSpy.mockRestore();
    });

    it('reports live mail configured as false and logs a safe warning', () => {
      expect(unconfiguredService.isLiveMailConfigured()).toBe(false);
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('HOSTINGER_MAIL_API_KEY is not configured'),
      );
    });

    it('operates safely in sandbox/mock mode without failing or crashing', async () => {
      const result = await unconfiguredService.sendCommercialTicketEmail({
        orderNumber: 'ORD-COMM-MOCK-1',
        customerName: 'Mock User',
        customerEmail: 'mock@example.com',
        ticketType: 'COMMERCIAL_SEASON',
        selectedDates: ['2026-10-11', '2026-10-12'],
        quantity: 1,
        amountInr: 1500,
        passes: [{ ticketNumber: 'TK-1', token: 'tok_1', category: 'Commercial Pass' }],
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('mock-hostinger-msg-id');
    });
  });

  describe('Logging Security Check', () => {
    it('never leaks api key, raw QR token, or email content to stdout/logger', async () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

      const secretKey = 'super_secret_hostinger_token_123';
      const secretToken = 'ultra_secret_qr_token_abcdef';

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          MailService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'HOSTINGER_MAIL_API_KEY') return secretKey;
                if (key === 'HOSTINGER_MAILBOX') return 'ticket@ongcnavratri.tech';
                return undefined;
              }),
            },
          },
        ],
      }).compile();

      const testService = module.get<MailService>(MailService);

      global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network failure'));

      await testService.sendCommercialTicketEmail({
        orderNumber: 'ORD-123',
        customerName: 'Sensitive User',
        customerEmail: 'sensitive.person@example.com',
        ticketType: 'COMMERCIAL_DAILY',
        selectedDates: ['2026-10-11'],
        quantity: 1,
        amountInr: 500,
        passes: [{ ticketNumber: 'TK-1', token: secretToken, category: 'Commercial Pass' }],
      });

      const allLoggedMessages = [
        ...logSpy.mock.calls.map((c) => String(c[0])),
        ...errorSpy.mock.calls.map((c) => String(c[0])),
      ].join(' ');

      expect(allLoggedMessages).not.toContain(secretKey);
      expect(allLoggedMessages).not.toContain(secretToken);

      logSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });
});

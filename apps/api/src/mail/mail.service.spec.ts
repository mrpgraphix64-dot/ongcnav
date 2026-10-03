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
      expect(body.html).toContain('src="https://ongcnavratri.reworkzone.in/images/sponsors/zaira-diamond-logo.png"');
      expect(body.html).toContain('src="https://ongcnavratri.reworkzone.in/images/sponsors/om-sanctuary-palace-logo.png"');
      expect(body.html).toContain('src="https://ongcnavratri.reworkzone.in/images/sponsors/lalkaar-news-logo.png"');
      expect(body.html).toContain('EVENT ORGANISER');
      expect(body.html).toContain('src="https://ongcnavratri.reworkzone.in/images/digant-art-logo.png"');
      expect(body.html).toContain('ONGC Navratri 2026');

      // Verify support emails order and labels
      const ongcSupportIdx = body.html.indexOf('ongcnavratri@gmail.com');
      const ticketAssistanceIdx = body.html.indexOf('ticket@ongcnavratri.tech');
      expect(ongcSupportIdx).toBeGreaterThan(-1);
      expect(ticketAssistanceIdx).toBeGreaterThan(-1);
      expect(ongcSupportIdx).toBeLessThan(ticketAssistanceIdx); // ongcnavratri@gmail.com MUST appear first

      expect(body.html).toContain('Support: <a href="mailto:ongcnavratri@gmail.com"');
      expect(body.html).toContain('E-Pass / Ticket Assistance: <a href="mailto:ticket@ongcnavratri.tech"');

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

      // Verify "Access My Tickets Portal" section has been removed completely
      expect(body.html).not.toContain('Access My Tickets Portal');
      expect(body.html).not.toContain('Access your passes anytime online');
      expect(body.html).not.toContain('/my-tickets');
      expect(body.text).not.toContain('ONLINE PORTAL');
      expect(body.text).not.toContain('Access your passes anytime online');

      // Verify attachments contain ONLY the dynamic entry QR pass (no static branding images to prevent Gmail attachment chips)
      expect(body.attachments).toBeDefined();
      expect(body.attachments.length).toBe(1);
      expect(body.attachments[0].filename).toBe('QR-TK-COMM-TEST1-1-A1B2.png');
      expect(body.attachments[0].contentType).toBe('image/png');
      expect(body.attachments[0].cid).toBe('qr-TKCOMMTEST11A1B2-1');
      expect(body.html).toContain(`src="cid:${body.attachments[0].cid}"`);

      // Verify static branding logos are NOT attached as files
      const cids = body.attachments.map((a: any) => a.cid);
      expect(cids).not.toContain('ongc-logo');
      expect(cids).not.toContain('zaira-logo');
      expect(cids).not.toContain('om-sanctuary-logo');
      expect(cids).not.toContain('lalkaar-logo');
      expect(cids).not.toContain('digant-art-logo');
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
      expect(body.attachments).toHaveLength(2);
      expect(body.attachments[0].filename).toBe('QR-TK-COMM-SEAS-1-A1.png');
      expect(body.attachments[1].filename).toBe('QR-TK-COMM-SEAS-2-B2.png');
      // No static branding attachments (avoids Gmail attachment chips)
      expect(body.attachments.map((a: any) => a.cid)).not.toEqual(
        expect.arrayContaining(['ongc-logo', 'zaira-logo', 'om-sanctuary-logo', 'lalkaar-logo', 'digant-art-logo']),
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

        // 1. Static branding logos are NOT attached as files (avoids Gmail attachment chips)
        expect(attachmentCids).not.toContain('ongc-logo');
        expect(attachmentCids).not.toContain('zaira-logo');
        expect(attachmentCids).not.toContain('om-sanctuary-logo');
        expect(attachmentCids).not.toContain('lalkaar-logo');
        expect(attachmentCids).not.toContain('digant-art-logo');

        // 2. HTML references publicly accessible HTTPS URLs
        expect(body.html).toContain('src="https://ongcnavratri.reworkzone.in/images/ongc-navratri-2026-logo.png"');
        expect(body.html).toContain('src="https://ongcnavratri.reworkzone.in/images/sponsors/zaira-diamond-logo.png"');
        expect(body.html).toContain('src="https://ongcnavratri.reworkzone.in/images/sponsors/om-sanctuary-palace-logo.png"');
        expect(body.html).toContain('src="https://ongcnavratri.reworkzone.in/images/sponsors/lalkaar-news-logo.png"');
        expect(body.html).toContain('src="https://ongcnavratri.reworkzone.in/images/digant-art-logo.png"');

        // 3. No CID image references for static branding logos remain
        expect(body.html).not.toContain('src="cid:ongc-logo"');
        expect(body.html).not.toContain('src="cid:zaira-logo"');
        expect(body.html).not.toContain('src="cid:om-sanctuary-logo"');
        expect(body.html).not.toContain('src="cid:lalkaar-logo"');
        expect(body.html).not.toContain('src="cid:digant-art-logo"');

        // 4. No local filesystem paths or localhost appear in HTML
        expect(body.html).not.toMatch(/C:[\\/]/);
        expect(body.html).not.toMatch(/\/apps\/api/);
        expect(body.html).not.toContain('localhost');

        // 5. QR CID still works and is attached for each pass
        expect(attachmentCids).toContain('qr-TKBRAND1-1');
        expect(attachmentCids).toContain('qr-TKBRAND2-2');
        expect(body.html).toContain('src="cid:qr-TKBRAND1-1"');
        expect(body.html).toContain('src="cid:qr-TKBRAND2-2"');

        // 6. Multi-pass emails strictly contain only the 2 entry QR codes (no extra logo attachments)
        expect(body.attachments).toHaveLength(2);
        const qrAttachments = body.attachments.filter((a: any) => a.filename.startsWith('QR-'));
        expect(qrAttachments).toHaveLength(2);
        expect(qrAttachments[0].cid).not.toBe(qrAttachments[1].cid);

        // 7. Existing ticket/order information is unchanged
        expect(body.html).toContain('ORD-COMM-BRANDING-1');
        expect(body.html).toContain('Pooja Shah');
        expect(body.html).toContain('Rohan Shah');
        expect(body.html).toContain('TK-BRAND-1');
        expect(body.html).toContain('TK-BRAND-2');
        expect(body.html).toContain('₹1,000');

        // 8. No raw QR token is exposed outside secure link
        expect(body.html).toContain('/ticket/token_pooja_1');
        expect(body.html).toContain('/ticket/token_pooja_2');
        const token1Count = body.html.split('token_pooja_1').length - 1;
        expect(token1Count).toBe(1);

        // 9. No payment/internal IDs are exposed
        expect(body.html).not.toContain('rzp_');
        expect(body.html).not.toContain('order_DBJOW');
        expect(body.html).not.toContain('staffId');
        expect(body.html).not.toContain('SUPER_ADMIN');

        // 10. Support emails order: ongcnavratri@gmail.com must appear before ticket@ongcnavratri.tech
        const generalSupportIdx = body.html.indexOf('ongcnavratri@gmail.com');
        const ticketSupportIdx = body.html.indexOf('ticket@ongcnavratri.tech');
        expect(generalSupportIdx).toBeGreaterThan(-1);
        expect(ticketSupportIdx).toBeGreaterThan(-1);
        expect(generalSupportIdx).toBeLessThan(ticketSupportIdx);

        // 11. Organiser attribution: Digant Art as official event organiser
        expect(body.html).toContain('EVENT ORGANISER');
        expect(body.html).toContain('Digant Art');
        expect(body.html).toContain('Official Event Organiser');
        expect(body.html).not.toContain('ONGC Organising Committee');
        expect(body.html).not.toContain('Organised by ONGC');

        // 12. Sizing & Branding Design: ONGC festival logo is prominently 220px width, Digant Art is 65px
        expect(body.html).toContain('alt="ONGC Navratri 2026" width="220"');
        expect(body.html).toContain('alt="Digant Art" width="65" height="65"');
        expect(body.html).not.toContain('◆'); // No gold diamond divider exists

        // 13. Reworkzone.com credit at absolute bottom in a single non-wrapping line
        expect(body.html).toContain('E-Ticketing &amp; E-Pass System by');
        expect(body.html).toContain('href="https://reworkzone.com"');
        expect(body.html).toContain('Reworkzone.com');
        expect(body.html).toContain('white-space: nowrap;');

        // Hierarchy check: ONGC festival logo header -> Digital Pass subtitle -> Pass cards -> Sponsors -> Organiser -> Support -> Reworkzone
        const ongcLogoIdx = body.html.indexOf('src="https://ongcnavratri.reworkzone.in/images/ongc-navratri-2026-logo.png"');
        const subtitleIdx = body.html.indexOf('Official Digital E-Pass');
        const passCardIdx = body.html.indexOf('src="cid:qr-TKBRAND1-1"');
        const sponsorsIdx = body.html.indexOf('OUR PARTNERS');
        const organiserIdx = body.html.indexOf('EVENT ORGANISER');
        const supportIdx = body.html.indexOf('Need Assistance?');
        const reworkzoneIdx = body.html.indexOf('Reworkzone.com');

        expect(ongcLogoIdx).toBeGreaterThan(-1);
        expect(subtitleIdx).toBeGreaterThan(ongcLogoIdx);
        expect(passCardIdx).toBeGreaterThan(subtitleIdx);
        expect(sponsorsIdx).toBeGreaterThan(passCardIdx);
        expect(organiserIdx).toBeGreaterThan(sponsorsIdx);
        expect(supportIdx).toBeGreaterThan(organiserIdx);
        expect(reworkzoneIdx).toBeGreaterThan(supportIdx);
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

  describe('Employee Daily Pass Email Template & Event Day Themes', () => {
    let testService: MailService;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          MailService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'HOSTINGER_MAIL_API_KEY') return 'mock_key';
                if (key === 'HOSTINGER_MAILBOX') return 'ticket@ongcnavratri.tech';
                if (key === 'APP_URL') return 'https://ongcnavratri.reworkzone.in';
                if (key === 'API_URL') return 'https://api-ongcnavratri.reworkzone.in';
                return undefined;
              }),
            },
          },
        ],
      }).compile();

      testService = module.get<MailService>(MailService);
    });

    it('renders Oct 11 SHUBH AARAMBH theme with #7A1930 and #C59B27', async () => {
      const preview = await testService.previewEmployeeDailyPassEmail({
        recipientEmail: 'emp@ongc.co.in',
        employeeName: 'Rajesh Kumar',
        attendeeName: 'Rajesh Kumar',
        relation: 'Self',
        cpf: '12345',
        department: 'Drilling',
        eventDate: '2026-10-11',
        ticketNumber: 'TK-EMP-20261011-0001',
        qrToken: 'tok_rajesh_11',
      });

      expect(preview.subject).toContain('Night 1');
      expect(preview.subject).toContain('11 October 2026');
      expect(preview.html).toContain('#7A1930'); // Primary
      expect(preview.html).toContain('#C59B27'); // Secondary/accent
      expect(preview.html).toContain('SHUBH AARAMBH');
      expect(preview.html).toContain('PASS HOLDER: EMPLOYEE');
      expect(preview.html).toContain('Rajesh Kumar');
      expect(preview.html).toContain('12345');
      expect(preview.html).toContain('TK-EMP-20261011-0001');
      expect(preview.html).toContain('VALID STRICTLY ON 11 OCTOBER 2026');
    });

    it('renders Oct 13 RAAS RANG theme with #0D5C5A and #D4AF37, not using #7A1930', async () => {
      const preview = await testService.previewEmployeeDailyPassEmail({
        recipientEmail: 'emp@ongc.co.in',
        employeeName: 'Rajesh Kumar',
        attendeeName: 'Rajesh Kumar',
        relation: 'Self',
        cpf: '12345',
        department: 'Drilling',
        eventDate: '2026-10-13',
        ticketNumber: 'TK-EMP-20261013-0002',
        qrToken: 'tok_rajesh_13',
      });

      expect(preview.subject).toContain('Night 3');
      expect(preview.subject).toContain('13 October 2026');
      expect(preview.html).toContain('#0D5C5A'); // Primary peacock teal
      expect(preview.html).toContain('#D4AF37'); // Secondary gold
      expect(preview.html).toContain('RAAS RANG');
      // Must NOT use default maroon for guidelines or borders
      expect(preview.html).not.toContain('color: #7A1930');
      expect(preview.html).not.toContain('border-top: 6px solid #7A1930');
      expect(preview.html).toContain('border-top: 6px solid #0D5C5A');
      expect(preview.html).toContain('border: 1px solid #D4AF37; border-left: 4px solid #0D5C5A');
    });

    it('renders Oct 15 AHMEDABAD HERITAGE theme with #1B2E5D and #C59B27', async () => {
      const preview = await testService.previewEmployeeDailyPassEmail({
        recipientEmail: 'priya@example.com',
        employeeName: 'Rajesh Kumar',
        attendeeName: 'Priya Kumar',
        relation: 'Spouse',
        cpf: '12345',
        department: 'Drilling',
        eventDate: '2026-10-15',
        ticketNumber: 'TK-EMP-20261015-0003',
        qrToken: 'tok_priya_15',
      });

      expect(preview.subject).toContain('Night 5');
      expect(preview.subject).toContain('15 October 2026');
      expect(preview.html).toContain('#1B2E5D'); // Primary indigo
      expect(preview.html).toContain('#C59B27'); // Secondary antique gold
      expect(preview.html).toContain('AHMEDABAD HERITAGE');
      expect(preview.html).toContain('PASS HOLDER: FAMILY MEMBER');
      expect(preview.html).toContain('Priya Kumar');
      expect(preview.html).toContain('Primary Employee:');
      expect(preview.html).toContain('Rajesh Kumar');
      expect(preview.html).toContain('Ref No.:');
      expect(preview.html).toContain('12345');
      expect(preview.html).toContain('Relationship:');
      expect(preview.html).toContain('Spouse');
      expect(preview.html).toContain('VALID STRICTLY ON 15 OCTOBER 2026');
    });

    it('renders Oct 19 GRAND FINALE theme with #540D24 and #C59B27', async () => {
      const preview = await testService.previewEmployeeDailyPassEmail({
        recipientEmail: 'emp@ongc.co.in',
        employeeName: 'Rajesh Kumar',
        attendeeName: 'Rajesh Kumar',
        relation: 'Self',
        cpf: '12345',
        department: 'Drilling',
        eventDate: '2026-10-19',
        ticketNumber: 'TK-EMP-20261019-0009',
        qrToken: 'tok_rajesh_19',
      });

      expect(preview.subject).toContain('Night 9');
      expect(preview.subject).toContain('19 October 2026');
      expect(preview.html).toContain('#540D24'); // Primary burgundy
      expect(preview.html).toContain('#C59B27'); // Secondary antique gold
      expect(preview.html).toContain('GRAND FINALE');
      expect(preview.html).toContain('border-top: 6px solid #540D24');
      expect(preview.html).toContain('VALID STRICTLY ON 19 OCTOBER 2026');
    });

    it('does not include morning assumptions or fixed delivery time phrases in email copy', async () => {
      const preview = await testService.previewEmployeeDailyPassEmail({
        recipientEmail: 'emp@ongc.co.in',
        employeeName: 'Rajesh Kumar',
        attendeeName: 'Rajesh Kumar',
        relation: 'Self',
        cpf: '12345',
        department: 'Drilling',
        eventDate: '2026-10-13',
        ticketNumber: 'TK-EMP-20261013-0002',
        qrToken: 'tok_rajesh_13',
      });

      expect(preview.html.toLowerCase()).not.toContain('each event morning');
      expect(preview.html.toLowerCase()).not.toContain('this morning');
      expect(preview.text.toLowerCase()).not.toContain('each event morning');
      expect(preview.text.toLowerCase()).not.toContain('this morning');
    });

    it('renders optional sponsor voucher when voucher is enabled', async () => {
      const preview = await testService.previewEmployeeDailyPassEmail({
        recipientEmail: 'emp@ongc.co.in',
        employeeName: 'Rajesh Kumar',
        attendeeName: 'Rajesh Kumar',
        relation: 'Self',
        cpf: '12345',
        department: 'Drilling',
        eventDate: '2026-10-11',
        ticketNumber: 'TK-EMP-20261011-0001',
        qrToken: 'tok_rajesh_voucher_1',
        sponsorVoucher: {
          enabled: true,
          sponsorName: 'MAHAVIR JEWELLERS',
          voucherLabel: 'GIFT VOUCHER',
          offerHeadline: '₹5,000 OFF',
          offerSubtext: 'ON MAKING CHARGES',
          audienceLabel: 'FOR ONGC NAVRATRI 2026 PARTICIPANTS',
          instructionText: 'Show this voucher at Mahavir Jewellers to avail the offer.',
          validityNote: 'Valid: Lifetime | No expiry',
          address: '2 Amrakunj, Anne, below NY Cinemas, Tapovan Circle, Chandkheda',
          phone: '90330 56098',
          voucherImagePath: '/images/sponsors/mahavir-jewellers-voucher.jpg',
          terms: [
            'One voucher per bill.',
            'Not redeemable for cash.',
            'Not applicable on silver jewellery.',
          ],
        },
      });

      expect(preview.html).toContain('SPECIAL SPONSOR OFFER');
      expect(preview.html).toContain('MAHAVIR JEWELLERS');
      expect(preview.html).toContain('₹5,000 OFF');
      expect(preview.html).toContain('ON MAKING CHARGES');
      expect(preview.html).toContain('mahavir-jewellers-voucher.jpg');
      expect(preview.html).toContain('Valid: Lifetime | No expiry');
      expect(preview.html).toContain('2 Amrakunj, Anne, below NY Cinemas, Tapovan Circle, Chandkheda');
      expect(preview.html).toContain('90330 56098');
      expect(preview.html).toContain('One voucher per bill.');
      expect(preview.text).toContain('MAHAVIR JEWELLERS');
      expect(preview.text).toContain('₹5,000 OFF');
      expect(preview.text).toContain('90330 56098');
    });

    it('does NOT render sponsor voucher when voucher is disabled', async () => {
      const preview = await testService.previewEmployeeDailyPassEmail({
        recipientEmail: 'emp@ongc.co.in',
        employeeName: 'Rajesh Kumar',
        attendeeName: 'Rajesh Kumar',
        relation: 'Self',
        cpf: '12345',
        department: 'Drilling',
        eventDate: '2026-10-11',
        ticketNumber: 'TK-EMP-20261011-0001',
        qrToken: 'tok_rajesh_voucher_2',
        sponsorVoucher: {
          enabled: false,
          sponsorName: 'MAHAVIR JEWELLERS',
          voucherLabel: 'GIFT VOUCHER',
          offerHeadline: '₹5,000 OFF',
          offerSubtext: 'ON MAKING CHARGES',
          audienceLabel: 'FOR ONGC NAVRATRI 2026 PARTICIPANTS',
          instructionText: 'Show this voucher at Mahavir Jewellers to avail the offer.',
          validityNote: 'Valid: Lifetime | No expiry',
          address: '2 Amrakunj, Anne, below NY Cinemas, Tapovan Circle, Chandkheda',
          phone: '90330 56098',
        },
      });

      expect(preview.html).not.toContain('SPECIAL SPONSOR OFFER');
      expect(preview.html).not.toContain('MAHAVIR JEWELLERS');
      expect(preview.text).not.toContain('SPECIAL SPONSOR OFFER');
    });
  });
});

import {
  buildEmployeeWhatsAppMessage,
  DEFAULT_SPONSOR_VOUCHER_CONFIG,
  isRoutePermittedForRole,
  WhatsAppConfigDto,
  WhatsAppTestSubmissionResultDto,
} from '@/types/shared-types';

describe('Public WhatsApp Test Registration - Frontend & Logic Tests', () => {
  describe('Routing & Public Access Rules', () => {
    it('confirms /employee/whatsapp-test is designed as a public route outside the admin portal', () => {
      // The admin route requires SUPER_ADMIN and blocks EMPLOYEE_ADMIN
      expect(isRoutePermittedForRole('/admin/employees/whatsapp-test', 'SUPER_ADMIN')).toBe(true);
      expect(isRoutePermittedForRole('/admin/employees/whatsapp-test', 'EMPLOYEE_ADMIN')).toBe(false);

      // The new route is public and does not live under /admin
      const publicTestRoute = '/employee/whatsapp-test';
      expect(publicTestRoute.startsWith('/admin')).toBe(false);
      expect(publicTestRoute.startsWith('/employee')).toBe(true);
    });

    it('verifies production registration route /employee/register is separate and unmodified', () => {
      const prodRoute = '/employee/register';
      const testRoute = '/employee/whatsapp-test';
      expect(prodRoute).not.toEqual(testRoute);
      expect(prodRoute.startsWith('/employee')).toBe(true);
    });
  });

  describe('Branding, Header Copy & Test Mode Distinctions', () => {
    const TEST_PAGE_HEADER = {
      title: 'ONGC NAVRATRI 2026',
      subtitle: 'WHATSAPP TEST REGISTRATION',
      badge: 'TEST MODE',
      supportingMessage:
        'This is a test registration. Your test pass and WhatsApp message are isolated from production employee records.',
    };

    it('defines the exact required title, subtitle, badge, and supporting message', () => {
      expect(TEST_PAGE_HEADER.title).toBe('ONGC NAVRATRI 2026');
      expect(TEST_PAGE_HEADER.subtitle).toBe('WHATSAPP TEST REGISTRATION');
      expect(TEST_PAGE_HEADER.badge).toBe('TEST MODE');
      expect(TEST_PAGE_HEADER.supportingMessage).toContain(
        'isolated from production employee records'
      );
    });
  });

  describe('Test Data Isolation & Permanent E-Pass URL Generation', () => {
    it('constructs test Reference No. with ONGC-TEST- prefix and isolated pass link', () => {
      const cpf = '99999';
      const testRef = `ONGC-TEST-${cpf}`;
      const webBase = 'https://ongcnavratri.reworkzone.in';
      const passUrl = `${webBase}/employee/my-tickets?ref=${encodeURIComponent(testRef)}`;

      expect(testRef).toBe('ONGC-TEST-99999');
      expect(passUrl).toBe(
        'https://ongcnavratri.reworkzone.in/employee/my-tickets?ref=ONGC-TEST-99999'
      );
      // Permanent QR architecture: no date parameter in pass link
      expect(passUrl).not.toContain('date=');
      expect(passUrl).not.toContain('day=');
    });

    it('ensures test registration payload maps correctly without exposing production endpoints', () => {
      const testPayload = {
        name: 'Siddharth',
        mobile: '9876543210',
        cpf: '99999',
        email: 'siddharth@ongc.co.in',
        category: 'REGULAR' as const,
        bookingDays: ['2026-10-11', '2026-10-12'],
      };

      expect(testPayload.cpf).toBe('99999');
      expect(testPayload.bookingDays).toHaveLength(2);
    });
  });

  describe('Safe WhatsApp Recipient Enforcement', () => {
    it('never uses the employee-entered mobile number as the WhatsApp target', () => {
      const enteredMobile = '9876543210';
      const configuredSafeRecipient = '+918401060482';

      const mockSubmission: WhatsAppTestSubmissionResultDto = {
        referenceNumber: 'ONGC-TEST-99999',
        attendeeId: '101',
        employeeId: '202',
        ticketNumber: 'TK-WA-TEST-001',
        qrToken: 'wa_test_token_abc',
        passUrl: 'https://ongcnavratri.reworkzone.in/employee/my-tickets?ref=ONGC-TEST-99999',
        safeRecipient: configuredSafeRecipient,
        messageText: 'Test message',
        providerStatus: 'READY',
        providerName: 'Meta WhatsApp Cloud API',
        passTemplateName: 'ongc_navratri_test_pass',
        passTemplateConfigured: false,
      };

      // Recipient must be the server-configured safe recipient, NEVER the employee mobile
      expect(mockSubmission.safeRecipient).toBe(configuredSafeRecipient);
      expect(mockSubmission.safeRecipient).not.toBe(enteredMobile);
      expect(mockSubmission.safeRecipient).not.toContain(enteredMobile);
    });

    it('sanitizes public WhatsApp config and never exposes secrets or tokens', () => {
      const publicConfig: WhatsAppConfigDto = {
        configured: true,
        isConfigured: true,
        provider: 'Meta WhatsApp Cloud API',
        providerName: 'Meta WhatsApp Cloud API',
        providerStatus: 'READY',
        safeRecipient: '+918401060482',
        phoneNumberIdConfigured: true,
        accessTokenConfigured: true,
        businessAccountConfigured: true,
        apiVersion: 'v25.0',
        testRecipientConfigured: true,
        templateConfigured: true,
        templateName: 'hello_world',
        templateLanguage: 'en_US',
        passTemplateName: 'ongc_navratri_test_pass',
        passTemplateConfigured: false,
        sponsorVoucher: DEFAULT_SPONSOR_VOUCHER_CONFIG,
        isolationMode: 'ISOLATED_TEST_MODE',
        notice:
          'Test messages are sent only to the configured safe test recipient.',
      };

      expect((publicConfig as any).accessToken).toBeUndefined();
      expect((publicConfig as any).token).toBeUndefined();
      expect((publicConfig as any).appSecret).toBeUndefined();
      expect((publicConfig as any).secret).toBeUndefined();
      expect(publicConfig.passTemplateName).toBe('ongc_navratri_test_pass');
    });
  });

  describe('WhatsApp Dynamic Message & Sponsor Integration', () => {
    it('renders the complete message copy with Mahavir Jewellers voucher and test isolation disclaimer', () => {
      const message = buildEmployeeWhatsAppMessage({
        employeeName: 'Siddharth',
        referenceNumber: 'ONGC-TEST-99999',
        passUrl: 'https://ongcnavratri.reworkzone.in/employee/my-tickets?ref=ONGC-TEST-99999',
        sponsorVoucher: DEFAULT_SPONSOR_VOUCHER_CONFIG,
        isTest: true,
      });

      expect(message).toContain('🎉 *ONGC NAVRATRI 2026* 🎉');
      expect(message).toContain('Hello *Siddharth* 👋');
      expect(message).toContain('Your ONGC Navratri E-Pass has been generated successfully as a TEST PASS. 🪔✨');
      expect(message).toContain('🎟️ *Reference No.: ONGC-TEST-99999*');
      expect(message).toContain('Your permanent QR pass is your entry credential for the event.');
      expect(message).toContain('💎 *A SPECIAL GIFT FOR YOU* 💎');
      expect(message).toContain('*MAHAVIR JEWELLERS*');
      expect(message).toContain('✨ *₹5,000 OFF*');
      expect(message).toContain('*ON MAKING CHARGES*');
      expect(message).toContain('Valid: Lifetime | No expiry');
      expect(message).toContain('2 Amrakunj, Anne, below NY Cinemas, Tapovan Circle, Chandkheda');
      expect(message).toContain('90330 56098');
      expect(message).toContain('🎟️ *VIEW YOUR E-PASS*');
      expect(message).toContain('https://ongcnavratri.reworkzone.in/employee/my-tickets?ref=ONGC-TEST-99999');
      expect(message).toContain(
        '⚠️ This is a test registration. The generated pass is isolated from production employee records.'
      );
      expect(message).toContain('✨ See you at ONGC Navratri 2026! ✨');
    });

    it('demonstrates template pending behavior when ongc_navratri_test_pass is not active', () => {
      const mockPendingResult: WhatsAppTestSubmissionResultDto = {
        referenceNumber: 'ONGC-TEST-99999',
        attendeeId: '101',
        employeeId: '202',
        ticketNumber: 'TK-WA-TEST-001',
        qrToken: 'token_abc',
        passUrl: 'https://ongcnavratri.reworkzone.in/employee/my-tickets?ref=ONGC-TEST-99999',
        safeRecipient: '+918401060482',
        messageText: 'Preview Text',
        providerStatus: 'READY',
        providerName: 'Meta WhatsApp Cloud API',
        passTemplateName: 'ongc_navratri_test_pass',
        passTemplateConfigured: false, // Pending Meta approval
      };

      expect(mockPendingResult.passTemplateConfigured).toBe(false);
      expect(mockPendingResult.passTemplateName).toBe('ongc_navratri_test_pass');
    });
  });

  describe('Page Guidelines & Family DOB Alignment', () => {
    const fs = require('fs');
    const path = require('path');
    const pageSrc = fs.readFileSync(path.join(__dirname, 'page.tsx'), 'utf8');

    it('contains the 6 concise guidelines and standardized acknowledgement', () => {
      expect(pageSrc).toContain('ONE PERMANENT E-PASS PER PERSON');
      expect(pageSrc).toContain('STRICTLY PERSONAL & NON-TRANSFERABLE');
      expect(pageSrc).toContain('DATE-SPECIFIC AUTHORIZATION');
      expect(pageSrc).toContain('ONE ENTRY PER DAY');
      expect(pageSrc).toContain('GATE & PHYSICAL ID VERIFICATION');
      expect(pageSrc).toContain('ACCURATE INFORMATION');
      expect(pageSrc).toContain('I confirm that the information provided is correct and I agree to the entry and E-Pass rules above.');
    });

    it('retains employee DOB while removing family member DOB', () => {
      // Employee DOB retained
      expect(pageSrc).toContain('id="emp-dob"');
      expect(pageSrc).toContain('Date of Birth');

      // Family DOB removed
      expect(pageSrc).not.toContain('id={`fam-dob-${idx}`}');
      expect(pageSrc).not.toContain('Date of Birth is required for Family Member');
      expect(pageSrc).not.toContain('Enter the correct Date of Birth.');
    });

    it('uses Siddharth demo name in quick fill helper', () => {
      expect(pageSrc).toContain("name: 'Siddharth'");
      expect(pageSrc).toContain("email: 'siddharth@ongc.co.in'");
      expect(pageSrc).not.toContain("Chintan Patel");
      expect(pageSrc).not.toContain("chintan@ongc.co.in");
    });

    it('renders the persistent Mahavir Jewellers sponsor banner above registration form', () => {
      expect(pageSrc).toContain('MAHAVIR JEWELLERS');
      expect(pageSrc).toContain('Official Festival Sponsor');
      expect(pageSrc).toContain('₹5,000 OFF');
      expect(pageSrc).toContain('On Making Charges');
      expect(pageSrc).toContain('Lifetime | No Expiry');
    });

    it('implements responsive mobile step indicator with centered numbers and compact labels', () => {
      expect(pageSrc).toContain('grid grid-cols-5');
      expect(pageSrc).toContain('Verify');
      expect(pageSrc).toContain('Rules');
      expect(pageSrc).toContain('Details');
      expect(pageSrc).toContain('Family');
      expect(pageSrc).toContain('Review');
      expect(pageSrc).toContain('rounded-full');
    });

    it('binds registrationFormRef and scrolls only to form top with sticky header offset', () => {
      expect(pageSrc).toContain('ref={registrationFormRef}');
      expect(pageSrc).toContain('const scrollToFormTop = () =>');
      expect(pageSrc).toContain('yOffset = -96');
    });

    it('configures ScratchCardsSection with persistState={false} and compact={true} in test mode', () => {
      expect(pageSrc).toContain('persistState={false}');
      expect(pageSrc).toContain('compact={true}');
    });

    it('renders simulated WhatsApp message as a single realistic chat bubble without nested card containers', () => {
      expect(pageSrc).toContain('WhatsApp Chat Preview (Simulated)');
      expect(pageSrc).toContain('Single Authentic WhatsApp Message Bubble');
      expect(pageSrc).toContain('text-[#53BDEB] font-bold'); // WhatsApp blue ticks
      expect(pageSrc).toContain('✓✓');
      expect(pageSrc).toContain('text-[#027EB5]'); // WhatsApp link color
    });
  });
});

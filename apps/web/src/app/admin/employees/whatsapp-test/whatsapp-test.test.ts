import {
  buildEmployeeWhatsAppMessage,
  DEFAULT_SPONSOR_VOUCHER_CONFIG,
  isRoutePermittedForRole,
} from '@/types/shared-types';

describe('WhatsApp Test Lab - Frontend Unit Tests', () => {
  describe('Route Permitted Authorization', () => {
    const route = '/admin/employees/whatsapp-test';

    it('allows SUPER_ADMIN to access WhatsApp Test Lab', () => {
      expect(isRoutePermittedForRole(route, 'SUPER_ADMIN')).toBe(true);
    });

    it('strictly forbids other roles from accessing WhatsApp Test Lab', () => {
      expect(isRoutePermittedForRole(route, 'EMPLOYEE_ADMIN')).toBe(false);
      expect(isRoutePermittedForRole(route, 'COMMERCIAL_ADMIN')).toBe(false);
      expect(isRoutePermittedForRole(route, 'EVENT_ADMIN')).toBe(false);
      expect(isRoutePermittedForRole(route, 'ADMIN')).toBe(false);
      expect(isRoutePermittedForRole(route, 'GATE_MANAGER')).toBe(false);
      expect(isRoutePermittedForRole(route, 'SCANNER_STAFF')).toBe(false);
      expect(isRoutePermittedForRole(route, 'REGISTRATION_STAFF')).toBe(false);
      expect(isRoutePermittedForRole(route, 'REPORT_VIEWER')).toBe(false);
    });
  });

  describe('WhatsApp Message Renderer & Sponsor Integration', () => {
    it('generates the exact WhatsApp copy with Mahavir Jewellers voucher offer', () => {
      const message = buildEmployeeWhatsAppMessage({
        employeeName: 'Chintan Patel',
        referenceNumber: 'ONGC-TEST-99999',
        passUrl: 'https://ongcnavratri.reworkzone.in/employee/my-tickets?ref=ONGC-TEST-99999',
        sponsorVoucher: DEFAULT_SPONSOR_VOUCHER_CONFIG,
      });

      expect(message).toContain('🎉 *ONGC NAVRATRI 2026* 🎉');
      expect(message).toContain('Hello *Chintan Patel* 👋');
      expect(message).toContain('🎟️ *Reference No.: ONGC-TEST-99999*');
      expect(message).toContain('Your permanent QR pass is your entry credential for the event.');
      expect(message).toContain('💎 *A SPECIAL GIFT FOR YOU* 💎');
      expect(message).toContain('*MAHAVIR JEWELLERS*');
      expect(message).toContain('✨ *₹5,000 OFF*');
      expect(message).toContain('*ON MAKING CHARGES*');
      expect(message).toContain('_Lifetime | No expiry_');
      expect(message).toContain('2 Amrakunj, Anne, below NY Cinemas, Tapovan Circle, Chandkheda');
      expect(message).toContain('90330 56098');
      expect(message).toContain('🎟️ *VIEW YOUR E-PASS*');
      expect(message).toContain('https://ongcnavratri.reworkzone.in/employee/my-tickets?ref=ONGC-TEST-99999');
      expect(message).toContain('Please do not share your QR/e-pass with anyone.');
      expect(message).toContain('✨ See you at ONGC Navratri 2026! ✨');
    });

    it('safely omits the sponsor block when sponsor voucher is disabled', () => {
      const message = buildEmployeeWhatsAppMessage({
        employeeName: 'Rahul Sharma',
        referenceNumber: 'ONGC-TEST-10001',
        passUrl: 'https://ongcnavratri.reworkzone.in/employee/my-tickets?ref=ONGC-TEST-10001',
        sponsorVoucher: {
          ...DEFAULT_SPONSOR_VOUCHER_CONFIG,
          enabled: false,
        },
      });

      expect(message).toContain('🎟️ *Reference No.: ONGC-TEST-10001*');
      expect(message).not.toContain('MAHAVIR JEWELLERS');
      expect(message).not.toContain('₹5,000 OFF');
      expect(message).toContain('🎟️ *VIEW YOUR E-PASS*');
      expect(message).toContain('https://ongcnavratri.reworkzone.in/employee/my-tickets?ref=ONGC-TEST-10001');
    });

    it('does not expose internal tokens or sensitive credentials in passUrl', () => {
      const message = buildEmployeeWhatsAppMessage({
        employeeName: 'Chintan Patel',
        referenceNumber: 'ONGC-TEST-99999',
        passUrl: 'https://ongcnavratri.reworkzone.in/employee/my-tickets?ref=ONGC-TEST-99999',
        sponsorVoucher: DEFAULT_SPONSOR_VOUCHER_CONFIG,
      });

      expect(message).not.toContain('token=');
      expect(message).not.toContain('secret');
      expect(message).not.toContain('dob=');
      expect(message).not.toContain('password');
    });
  });

  describe('Delivery Status & Safe Recipient Guarding', () => {
    it('recognizes TEST_RECIPIENT_NOT_CONFIGURED and TEMPLATE_NOT_CONFIGURED as valid delivery statuses', () => {
      const status1: import('@/types/shared-types').WhatsAppDeliveryStatus =
        'TEST_RECIPIENT_NOT_CONFIGURED';
      const status2: import('@/types/shared-types').WhatsAppDeliveryStatus =
        'TEMPLATE_NOT_CONFIGURED';
      expect(status1).toBe('TEST_RECIPIENT_NOT_CONFIGURED');
      expect(status2).toBe('TEMPLATE_NOT_CONFIGURED');
    });

    it('WhatsAppConfigDto excludes access tokens or secrets from client model', () => {
      const config: import('@/types/shared-types').WhatsAppConfigDto = {
        configured: true,
        isConfigured: true,
        provider: 'Meta WhatsApp Cloud API',
        providerName: 'Meta WhatsApp Cloud API',
        providerStatus: 'READY',
        safeRecipient: '+918401060482',
        phoneNumberIdConfigured: true,
        businessAccountConfigured: true,
        apiVersion: 'v25.0',
        testRecipientConfigured: true,
        templateConfigured: true,
        templateName: 'hello_world',
        templateLanguage: 'en_US',
        sponsorVoucher: DEFAULT_SPONSOR_VOUCHER_CONFIG,
        voucherImageUrl: '/images/sponsors/mahavir-jewellers-voucher.jpg',
        isolationMode: 'ISOLATED_TEST_MODE',
        notice: 'Test only',
      };

      expect((config as any).accessToken).toBeUndefined();
      expect((config as any).token).toBeUndefined();
      expect((config as any).appSecret).toBeUndefined();
      expect(config.apiVersion).toBe('v25.0');
      expect(config.safeRecipient).toBe('+918401060482');
    });
  });
});

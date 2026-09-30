import React from 'react';
import ReactDOMServer from 'react-dom/server';
import AdminSettingsPage from './page';
import { AUTH_SESSION_KEY } from '@/lib/auth-session';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(() => null),
  }),
}));

class MockStorage {
  private store: Record<string, string> = {};
  getItem(key: string) {
    return this.store[key] !== undefined ? this.store[key] : null;
  }
  setItem(key: string, value: string) {
    this.store[key] = String(value);
  }
  removeItem(key: string) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

const mockStorage = new MockStorage();
(global as any).localStorage = mockStorage;
if (typeof (global as any).window === 'undefined') {
  (global as any).window = {};
}
(global as any).window.localStorage = mockStorage;

describe('Book Pass Availability Admin Settings UI Tests', () => {
  beforeEach(() => {
    mockStorage.clear();
    jest.clearAllMocks();
  });

  describe('Role-based Tab Access', () => {
    it('does NOT render Book Pass tab for unauthorized users or scanner staff', () => {
      localStorage.setItem(
        AUTH_SESSION_KEY,
        JSON.stringify({ id: 'staff-1', name: 'Scanner Staff', email: 'scanner@ongc.co.in', role: 'SCANNER_STAFF' }),
      );

      const html = ReactDOMServer.renderToStaticMarkup(<AdminSettingsPage />);
      expect(html).not.toContain('Book Pass');
      expect(html).not.toContain('BOOK PASS AVAILABILITY');
    });

    it('renders Book Pass tab for SUPER_ADMIN', () => {
      localStorage.setItem(
        AUTH_SESSION_KEY,
        JSON.stringify({ id: 'super-1', name: 'Super Admin', email: 'super@ongc.co.in', role: 'SUPER_ADMIN' }),
      );

      const html = ReactDOMServer.renderToStaticMarkup(<AdminSettingsPage />);
      expect(html).toContain('Book Pass');
    });

    it('renders Book Pass tab for EVENT_ADMIN', () => {
      localStorage.setItem(
        AUTH_SESSION_KEY,
        JSON.stringify({ id: 'event-1', name: 'Event Admin', email: 'event@ongc.co.in', role: 'EVENT_ADMIN' }),
      );

      const html = ReactDOMServer.renderToStaticMarkup(<AdminSettingsPage />);
      expect(html).toContain('Book Pass');
    });

    it('renders Book Pass tab for ADMIN', () => {
      localStorage.setItem(
        AUTH_SESSION_KEY,
        JSON.stringify({ id: 'admin-1', name: 'Admin', email: 'admin@ongc.co.in', role: 'ADMIN' }),
      );

      const html = ReactDOMServer.renderToStaticMarkup(<AdminSettingsPage />);
      expect(html).toContain('Book Pass');
    });
  });

  describe('Book Pass Controls rendering when tab is selected', () => {
    it('renders Book Pass availability controls when tab=bookpass', () => {
      localStorage.setItem(
        AUTH_SESSION_KEY,
        JSON.stringify({ id: 'super-1', name: 'Super Admin', email: 'super@ongc.co.in', role: 'SUPER_ADMIN' }),
      );

      // Mock window.location.search with tab=bookpass
      delete (global as any).window.location;
      (global as any).window.location = new URL('https://ongcnavratri.reworkzone.in/admin/settings?tab=bookpass');

      const html = ReactDOMServer.renderToStaticMarkup(<AdminSettingsPage />);

      // Section header
      expect(html).toContain('BOOK PASS AVAILABILITY');
      expect(html).toContain('Public Booking Status');

      // Live status and toggle buttons
      expect(html).toContain('data-testid="server-bookpass-status"');
      expect(html).toContain('data-testid="bookpass-toggle-open"');
      expect(html).toContain('data-testid="bookpass-toggle-coming-soon"');
      expect(html).toContain('data-testid="save-bookpass-settings"');

      // Explanatory copy
      expect(html).toContain('OPEN');
      expect(html).toContain('COMING SOON');
      expect(html).toContain('Operation Safeguards');
      expect(html).toContain('Existing paid orders, issued E-Passes, turnstile check-ins, and agent offline bookings remain 100% operational');
      expect(html).toContain('Save Settings');
    });
  });
});

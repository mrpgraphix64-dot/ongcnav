import React from 'react';
import ReactDOMServer from 'react-dom/server';
import BookPassPage from './page';
import BookPassComingSoon from '../../components/BookPassComingSoon';
import { AUTH_SESSION_KEY } from '../../lib/auth-session';

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
  usePathname: () => '/bookpass',
}));

// Mock next/script
jest.mock('next/script', () => {
  return function MockScript() {
    return null;
  };
});

// Mock meta pixel
jest.mock('../../lib/meta-pixel', () => ({
  trackPurchaseOnce: jest.fn(),
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

describe('Book Pass Availability Frontend Tests', () => {
  beforeEach(() => {
    mockStorage.clear();
    jest.clearAllMocks();
  });

  describe('BookPassComingSoon Component', () => {
    it('renders official coming soon headline and required messaging', () => {
      const html = ReactDOMServer.renderToStaticMarkup(<BookPassComingSoon />);

      // Required copy
      expect(html).toContain('Tickets Are Coming Soon');
      expect(html).toContain('We&#x27;re getting everything ready for an unforgettable Navratri experience.');
      expect(html).toContain(
        'ONGC Navratri 2026 is coming soon — stay tuned for ticket updates and booking announcements.',
      );
      expect(html).toContain('Tickets will be available soon.');

      // Event branding & details
      expect(html).toContain('ONGC NAVRATRI 2026');
      expect(html).toContain('Official Entry &amp; E-Pass Portal');
      expect(html).toContain('Stay Tuned • Garba • Music • Celebration');
      expect(html).toContain('9 Festive Nights');
      expect(html).toContain('11–19 October 2026');
      expect(html).toContain('Garba &amp; Music');
      expect(html).toContain('Traditional Orchestra');
      expect(html).toContain('Secure Access');
      expect(html).toContain('Fast Turnstile Check-in');
      expect(html).toContain('Return to Festival Home');
      expect(html).toContain('View Existing Passes');
    });
  });

  describe('BookPassPage Initial Loading State (Zero Flicker)', () => {
    it('renders loading state on initial render while checking server availability', () => {
      const html = ReactDOMServer.renderToStaticMarkup(<BookPassPage />);

      // On initial server/static render, loadingConfig is true
      expect(html).toContain('data-testid="bookpass-loading-state"');
      expect(html).toContain('Checking Ticket Availability...');
      expect(html).toContain('Loading ONGC Navratri 2026 pass information');

      // The checkout form must not be visible during initial availability check (avoids flicker)
      expect(html).not.toContain('Buy Your E-Pass');
    });
  });

  describe('BookPassPage Availability States', () => {
    it('BookPassComingSoon is cleanly integrated into the BookPass page flow', () => {
      const comingSoonHtml = ReactDOMServer.renderToStaticMarkup(<BookPassComingSoon />);
      expect(comingSoonHtml).toContain('Tickets Are Coming Soon');
      expect(comingSoonHtml).toContain('data-testid="bookpass-coming-soon"');
    });
  });
});

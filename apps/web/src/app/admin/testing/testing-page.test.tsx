import React from 'react';
import ReactDOMServer from 'react-dom/server';
import SuperAdminTestingPage from './page';
import SuperAdminTestingView from '@/components/admin/SuperAdminTestingView';
import TicketPassCard from '@/components/TicketPassCard';
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

describe('SuperAdminTestingPage UI Tests', () => {
  beforeEach(() => {
    mockStorage.clear();
    jest.clearAllMocks();
  });

  it('renders Access Restricted when user is not SUPER_ADMIN', () => {
    localStorage.setItem(
      AUTH_SESSION_KEY,
      JSON.stringify({ id: 'staff-1', name: 'Event Admin', email: 'admin@ongc.co.in', role: 'EVENT_ADMIN' }),
    );

    const html = ReactDOMServer.renderToStaticMarkup(<SuperAdminTestingPage />);
    expect(html).toContain('Access Restricted');
    expect(html).toContain('Return to Dashboard');
  });

  it('renders Testing & Preview Lab when authenticated as SUPER_ADMIN', () => {
    localStorage.setItem(
      AUTH_SESSION_KEY,
      JSON.stringify({ id: 'super-1', name: 'Super Admin', email: 'super@ongc.co.in', role: 'SUPER_ADMIN' }),
    );

    const mockInitialData: any = {
      order: {
        orderNumber: 'ORD-COMM-20261015-1234',
        customerName: 'Aarti Patel',
        customerMobile: '9876543210',
        customerEmail: 'aarti@example.com',
        ticketType: 'COMMERCIAL_DAILY',
        selectedDates: ['2026-10-15'],
        quantity: 1,
        amountInr: 499,
        paymentReference: 'pay_test_123',
        passes: [
          {
            id: 'pass-1',
            name: 'Aarti Patel',
            ticketNumber: 'NR26-1001',
            token: 'TOKEN123',
            qrSvg: '<svg></svg>',
          },
        ],
      },
      emailPreview: {
        subject: 'ONGC Navratri 2026 Passes',
        html: '<p>Email Preview</p>',
        fromName: 'ONGC Navratri 2026',
        fromEmail: 'ticket@ongcnavratri.tech',
        isConfigured: true,
      },
      paymentGateway: {
        status: 'ENABLED',
        enabled: true,
        environment: 'TEST',
        gateway: 'Razorpay',
        isConfigured: true,
      },
      serverTime: new Date().toISOString(),
    };

    const html = ReactDOMServer.renderToStaticMarkup(<SuperAdminTestingView initialData={mockInitialData} />);
    expect(html).toContain('Testing &amp; Preview Lab');
    expect(html).toContain('SUPER ADMIN');
    expect(html).toContain('Customer Booking Page Preview');
    expect(html).toContain('PREVIEW MODE');
    expect(html).toContain('PAYMENT: ON');
    expect(html).toContain('Open Live Book Pass');
    expect(html).toContain('Payment Gateway Status');
    expect(html).toContain('Send Test Transactional Email');
    expect(html).toContain('Latest E-Pass Preview');
    expect(html).toContain('E-Pass Email Template Preview');
    expect(html).toContain('Open Live Pass');
    expect(html).toContain('ORD-COMM-20261015-1234');
  });

  it('renders PAYMENT: OFF and disabled booking controls when gateway is disabled', () => {
    localStorage.setItem(
      AUTH_SESSION_KEY,
      JSON.stringify({ id: 'super-1', name: 'Super Admin', email: 'super@ongc.co.in', role: 'SUPER_ADMIN' }),
    );

    const mockDisabledData: any = {
      order: {
        orderNumber: 'ORD-COMM-SAMPLE-001',
        customerName: 'Test Customer',
        customerMobile: '9876543210',
        customerEmail: 'test@example.com',
        ticketType: 'COMMERCIAL_DAILY',
        selectedDates: ['2026-10-15'],
        quantity: 1,
        amountInr: 249,
        paymentReference: 'pay_sample',
        passes: [],
      },
      emailPreview: {
        subject: 'Preview',
        html: '<p>Preview</p>',
        fromName: 'ONGC',
        fromEmail: 'test@ongc.com',
        isConfigured: false,
      },
      paymentGateway: {
        status: 'DISABLED',
        enabled: false,
        environment: 'TEST',
        gateway: 'Razorpay',
        isConfigured: false,
      },
      serverTime: new Date().toISOString(),
    };

    const html = ReactDOMServer.renderToStaticMarkup(<SuperAdminTestingView initialData={mockDisabledData} />);
    expect(html).toContain('PAYMENT: OFF');
    expect(html).toContain('Online payments are currently unavailable');
    expect(html).toContain('ONLINE PAYMENT UNAVAILABLE');
  });

  it('TicketPassCard renders correctly with attendee details and QR fallback', () => {
    const ticket = {
      name: 'Shri Ramesh Kumar',
      ticketNumber: 'NR26-1001-A',
      category: 'Daily Pass',
      bookingDays: ['2026-10-15'],
      registrationType: 'COMMERCIAL',
      qrSvg: '<svg id="test-qr"></svg>',
    };

    const html = ReactDOMServer.renderToStaticMarkup(<TicketPassCard ticket={ticket} id="testTicketCard" />);
    expect(html).toContain('Shri Ramesh Kumar');
    expect(html).toContain('NR26-1001-A');
    expect(html).toContain('Daily Pass');
    expect(html).toContain('Malaviya Cricket Ground ONGC');
    expect(html).toContain('test-qr');
    expect(html).toContain('Scan for Gate Verification');
  });
});

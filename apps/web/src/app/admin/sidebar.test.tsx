import React from 'react';
import ReactDOMServer from 'react-dom/server';
import AdminLayout from './layout';
import { AUTH_SESSION_KEY } from '@/lib/auth-session';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  usePathname: () => '/admin',
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

(global as any).fetch = jest.fn((url: string) => {
  if (url.includes('/event-control/status')) {
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          activeDate: '2026-10-01',
          eventStatus: 'open',
          scanningEnabled: true,
          emergencyStopped: false,
        }),
    });
  }
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  });
});

describe('Admin Portal Sidebar Navigation Reorganization', () => {
  beforeEach(() => {
    mockStorage.clear();
    jest.clearAllMocks();
  });

  it('renders Super Admin sidebar with correct 5 sections and reorganized nav items', () => {
    mockStorage.setItem(
      AUTH_SESSION_KEY,
      JSON.stringify({
        id: '1',
        name: 'Super Admin',
        email: 'superadmin@ongc.internal',
        role: 'SUPER_ADMIN',
      }),
    );

    const html = ReactDOMServer.renderToStaticMarkup(
      <AdminLayout>
        <div id="test-content">Dashboard Content</div>
      </AdminLayout>,
    );

    // Section headers
    expect(html).toContain('GLOBAL');
    expect(html).toContain('OPERATIONS');
    expect(html).toContain('EMPLOYEES');
    expect(html).toContain('E-PASS');
    expect(html).toContain('TEST LAB');

    // GLOBAL items
    expect(html).toContain('Event Control');
    expect(html).toContain('Dashboard');
    expect(html).toContain('Attendees &amp; Passes');
    expect(html).toContain('Gates');
    expect(html).toContain('Staff Management');
    expect(html).toContain('Settings');

    // OPERATIONS items
    expect(html).toContain('Help Desk Overrides');
    expect(html).toContain('Daily Closing');
    expect(html).toContain('Reports &amp; Export');
    expect(html).toContain('Turnstile Scanner');
    expect(html).toContain('Incident Response');

    // EMPLOYEES items (employee-specific only)
    expect(html).toContain('Employees');
    expect(html).toContain('ONGC Employee Master');
    expect(html).toContain('Bulk Upload');

    // E-PASS items
    expect(html).toContain('E-Pass Orders');
    expect(html).toContain('Customers &amp; Passes');
    expect(html).toContain('Agents');
    expect(html).toContain('Inventory &amp; Quotas');
    expect(html).toContain('Allocations');
    expect(html).toContain('Commercial Reports');
    expect(html).toContain('Ticket Delivery');

    // TEST LAB items
    expect(html).toContain('Traffic Test Lab');
    expect(html).toContain('Testing &amp; Preview');

    // Verify ordering by checking relative positions of section headers
    const globalPos = html.indexOf('GLOBAL');
    const operationsPos = html.indexOf('OPERATIONS');
    const employeesPos = html.indexOf('EMPLOYEES');
    const epassPos = html.indexOf('E-PASS');
    const testLabPos = html.indexOf('TEST LAB');

    expect(globalPos).toBeLessThan(operationsPos);
    expect(operationsPos).toBeLessThan(employeesPos);
    expect(employeesPos).toBeLessThan(epassPos);
    expect(epassPos).toBeLessThan(testLabPos);

    // Verify Attendees & Passes is under GLOBAL (before OPERATIONS header)
    const attendeesPos = html.indexOf('Attendees &amp; Passes');
    expect(attendeesPos).toBeGreaterThan(globalPos);
    expect(attendeesPos).toBeLessThan(operationsPos);

    // Verify Reports & Export is under OPERATIONS (between OPERATIONS and EMPLOYEES)
    const reportsPos = html.indexOf('Reports &amp; Export');
    expect(reportsPos).toBeGreaterThan(operationsPos);
    expect(reportsPos).toBeLessThan(employeesPos);
  });
});

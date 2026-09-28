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

describe('Payment Settings UI Tab Tests', () => {
  beforeEach(() => {
    mockStorage.clear();
    jest.clearAllMocks();
  });

  it('does NOT render Payment Settings tab for regular EVENT_ADMIN', () => {
    localStorage.setItem(
      AUTH_SESSION_KEY,
      JSON.stringify({ id: 'staff-1', name: 'Event Admin', email: 'admin@ongc.co.in', role: 'EVENT_ADMIN' }),
    );

    const html = ReactDOMServer.renderToStaticMarkup(<AdminSettingsPage />);
    expect(html).not.toContain('Payment Settings');
  });

  it('renders Payment Settings tab option for authenticated SUPER_ADMIN', () => {
    localStorage.setItem(
      AUTH_SESSION_KEY,
      JSON.stringify({ id: 'super-1', name: 'Super Admin', email: 'super@ongc.co.in', role: 'SUPER_ADMIN' }),
    );

    const html = ReactDOMServer.renderToStaticMarkup(<AdminSettingsPage />);
    expect(html).toContain('Payment Settings');
  });
});

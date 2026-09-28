import React from 'react';
import ReactDOMServer from 'react-dom/server';
import AdminLoginPage from './page';
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

describe('Admin Login Page Cross-Tab Auth UI Tests', () => {
  beforeEach(() => {
    mockStorage.clear();
    jest.clearAllMocks();
  });

  it('renders standard login form with email and password fields when unauthenticated', () => {
    const html = ReactDOMServer.renderToStaticMarkup(<AdminLoginPage />);
    expect(html).toContain('ENTRY CONTROL PORTAL');
    expect(html).toContain('Welcome Back');
    expect(html).toContain('type="email"');
    expect(html).toContain('name@ongc.co.in');
    expect(html).toContain('Password');
    expect(html).toContain('LOGIN');
  });

  it('renders verifying session state when an existing session is detected on mount', () => {
    localStorage.setItem(
      AUTH_SESSION_KEY,
      JSON.stringify({ id: 'admin-1', name: 'Admin Staff', email: 'admin@ongc.co.in', role: 'SUPER_ADMIN' }),
    );

    const html = ReactDOMServer.renderToStaticMarkup(<AdminLoginPage />);
    expect(html).toContain('Verifying Admin Session...');
    expect(html).toContain('Redirecting to operations portal...');
  });
});

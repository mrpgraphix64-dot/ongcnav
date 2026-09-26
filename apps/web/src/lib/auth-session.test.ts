/// <reference types="jest" />

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
const eventListeners: Record<string, Function[]> = {};

const mockWindow: any = {
  addEventListener: (event: string, cb: Function) => {
    eventListeners[event] = eventListeners[event] || [];
    eventListeners[event].push(cb);
  },
  removeEventListener: (event: string, cb: Function) => {
    if (eventListeners[event]) {
      eventListeners[event] = eventListeners[event].filter((fn) => fn !== cb);
    }
  },
  dispatchEvent: (event: any) => {
    const list = eventListeners[event.type || 'storage'] || [];
    list.forEach((fn) => fn(event));
    return true;
  },
};

(global as any).window = mockWindow;
(global as any).localStorage = mockStorage;
(global as any).StorageEvent = class MockStorageEvent {
  type = 'storage';
  key: string;
  newValue: string | null;
  constructor(type: string, init?: { key?: string; newValue?: string | null }) {
    this.key = init?.key || '';
    this.newValue = init?.newValue ?? null;
  }
};
(global as any).CustomEvent = class MockCustomEvent {
  type: string;
  detail: any;
  constructor(type: string, init?: { detail?: any }) {
    this.type = type;
    this.detail = init?.detail;
  }
};

import {
  getStoredAuthUser,
  setStoredAuthUser,
  clearStoredAuth,
  isAgentRole,
  isAdminRole,
  getPortalForRole,
  subscribeToAuthSync,
  AUTH_SESSION_KEY,
  LEGACY_ADMIN_KEY,
} from './auth-session';

describe('Web Auth Session & Cross-Tab Synchronization', () => {
  beforeEach(() => {
    mockStorage.clear();
    jest.clearAllMocks();
  });

  describe('Role Classification & Portal Routing', () => {
    it('correctly identifies commercial agent roles', () => {
      expect(isAgentRole('COMMERCIAL_AGENT')).toBe(true);
      expect(isAgentRole('COMMERCIAL_SUB_AGENT')).toBe(true);
      expect(isAgentRole('commercial_agent')).toBe(true);
      expect(isAgentRole('SUPER_ADMIN')).toBe(false);
      expect(isAgentRole('SCANNER_STAFF')).toBe(false);
      expect(isAgentRole(null)).toBe(false);
    });

    it('correctly identifies administrative staff roles', () => {
      expect(isAdminRole('SUPER_ADMIN')).toBe(true);
      expect(isAdminRole('ADMIN')).toBe(true);
      expect(isAdminRole('COMMERCIAL_ADMIN')).toBe(true);
      expect(isAdminRole('EMPLOYEE_ADMIN')).toBe(true);
      expect(isAdminRole('COMMERCIAL_AGENT')).toBe(false);
      expect(isAdminRole('SCANNER_STAFF')).toBe(false);
    });

    it('routes roles to their canonical portal locations', () => {
      // Agent portal
      expect(getPortalForRole('COMMERCIAL_AGENT')).toBe('/agent');
      expect(getPortalForRole('COMMERCIAL_SUB_AGENT')).toBe('/agent');
      expect(getPortalForRole('commercial_agent')).toBe('/agent');

      // Scanner / gate operator portal
      expect(getPortalForRole('SCANNER_STAFF')).toBe('/scanner');
      expect(getPortalForRole('GATE_OPERATOR')).toBe('/scanner');

      // Registration staff portal
      expect(getPortalForRole('REGISTRATION_STAFF')).toBe('/admin/attendees');

      // Admin portals (E-Pass Admin, Employee Admin, Super Admin, Event Admin, Gate Manager, Help Desk)
      expect(getPortalForRole('COMMERCIAL_ADMIN')).toBe('/admin');
      expect(getPortalForRole('EMPLOYEE_ADMIN')).toBe('/admin');
      expect(getPortalForRole('SUPER_ADMIN')).toBe('/admin');
      expect(getPortalForRole('ADMIN')).toBe('/admin');
      expect(getPortalForRole('EVENT_ADMIN')).toBe('/admin');
      expect(getPortalForRole('GATE_MANAGER')).toBe('/admin');
      expect(getPortalForRole('HELP_DESK')).toBe('/admin');
    });
  });

  describe('Storage Persistence & Single Session Management', () => {
    const mockAdmin = {
      id: '1',
      name: 'ONGC Super Admin',
      email: 'admin@ongc.co.in',
      role: 'SUPER_ADMIN',
    };

    const mockAgent = {
      id: '10',
      name: 'Siddharth Agent',
      email: 'siddharth@agent.com',
      role: 'COMMERCIAL_AGENT',
    };

    it('setStoredAuthUser persists user to both unified and legacy storage keys', () => {
      setStoredAuthUser(mockAdmin);

      expect(mockStorage.getItem(AUTH_SESSION_KEY)).toBe(JSON.stringify(mockAdmin));
      expect(mockStorage.getItem(LEGACY_ADMIN_KEY)).toBe(JSON.stringify(mockAdmin));
      expect(getStoredAuthUser()).toEqual(mockAdmin);
    });

    it('logging in as an agent overwrites any existing admin session in storage', () => {
      setStoredAuthUser(mockAdmin);
      expect(getStoredAuthUser()?.role).toBe('SUPER_ADMIN');

      setStoredAuthUser(mockAgent);
      expect(getStoredAuthUser()?.role).toBe('COMMERCIAL_AGENT');
      expect(getStoredAuthUser()?.email).toBe('siddharth@agent.com');
    });

    it('clearStoredAuth removes all stored auth keys from localStorage', () => {
      setStoredAuthUser(mockAdmin);
      expect(getStoredAuthUser()).not.toBeNull();

      clearStoredAuth();
      expect(mockStorage.getItem(AUTH_SESSION_KEY)).toBeNull();
      expect(mockStorage.getItem(LEGACY_ADMIN_KEY)).toBeNull();
      expect(getStoredAuthUser()).toBeNull();
    });
  });

  describe('Cross-Tab Synchronization Subscription', () => {
    it('notifies subscribers when storage event occurs', () => {
      const listener = jest.fn();
      const unsubscribe = subscribeToAuthSync(listener);

      // Simulate a storage event from another tab (e.g. logout)
      const storageEvent = new (global as any).StorageEvent('storage', {
        key: AUTH_SESSION_KEY,
        newValue: null,
      });
      mockWindow.dispatchEvent(storageEvent);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'LOGOUT' }),
      );

      unsubscribe();
    });

    it('notifies subscribers when a new user logs in from another tab', () => {
      const listener = jest.fn();
      const unsubscribe = subscribeToAuthSync(listener);

      const newUser = { id: '2', name: 'New Staff', email: 'staff@ongc.co.in', role: 'ADMIN' };
      const storageEvent = new (global as any).StorageEvent('storage', {
        key: AUTH_SESSION_KEY,
        newValue: JSON.stringify(newUser),
      });
      mockWindow.dispatchEvent(storageEvent);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'LOGIN', user: newUser }),
      );

      unsubscribe();
    });
  });
});

/**
 * Unified Application Auth Session & Cross-Portal Tab Synchronization
 *
 * Ensures a single authenticated session across all tabs and browser contexts.
 * When a user logs in, logs out, or switches role (e.g. Admin -> Agent or Agent -> Admin),
 * all open tabs synchronize in real-time via BroadcastChannel and Storage events.
 */

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  staffId?: string | null;
  assignedGates?: any[];
  parentAgentId?: string | null;
  [key: string]: any;
}

export type AuthSyncEventType = 'LOGIN' | 'LOGOUT' | 'SESSION_EXPIRED';

export interface AuthSyncEvent {
  type: AuthSyncEventType;
  user?: AuthUser | null;
  timestamp: number;
}

export const AUTH_SESSION_KEY = 'ongc_auth_user';
export const LEGACY_ADMIN_KEY = 'ongc_admin_user';
export const AUTH_SYNC_EVENT_KEY = 'ongc_auth_sync_event';
const BROADCAST_CHANNEL_NAME = 'ongc_auth_sync_channel';

// In-memory reference for BroadcastChannel
let channelInstance: BroadcastChannel | null = null;

function getBroadcastChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined') return null;
  if (!('BroadcastChannel' in window)) return null;

  if (!channelInstance) {
    try {
      channelInstance = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    } catch {
      channelInstance = null;
    }
  }
  return channelInstance;
}

/**
 * Retrieve the active authenticated user profile from storage.
 */
export function getStoredAuthUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(AUTH_SESSION_KEY) || localStorage.getItem(LEGACY_ADMIN_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Persist the active authenticated user and broadcast the login event across all tabs.
 */
export function setStoredAuthUser(user: AuthUser): void {
  if (typeof window === 'undefined') return;

  const event: AuthSyncEvent = {
    type: 'LOGIN',
    user,
    timestamp: Date.now(),
  };

  try {
    const serialized = JSON.stringify(user);
    localStorage.setItem(AUTH_SESSION_KEY, serialized);
    localStorage.setItem(LEGACY_ADMIN_KEY, serialized);
    localStorage.setItem(AUTH_SYNC_EVENT_KEY, JSON.stringify(event));
  } catch {}

  // Broadcast across tabs via BroadcastChannel
  try {
    const ch = getBroadcastChannel();
    if (ch) {
      ch.postMessage(event);
    }
  } catch {}

  // Broadcast in current tab
  try {
    window.dispatchEvent(new CustomEvent('ongc:auth-sync', { detail: event }));
  } catch {}
}

/**
 * Clear the authenticated session and broadcast the logout event across all tabs.
 */
export function clearStoredAuth(): void {
  if (typeof window === 'undefined') return;

  const event: AuthSyncEvent = {
    type: 'LOGOUT',
    user: null,
    timestamp: Date.now(),
  };

  try {
    localStorage.removeItem(AUTH_SESSION_KEY);
    localStorage.removeItem(LEGACY_ADMIN_KEY);
    localStorage.setItem(AUTH_SYNC_EVENT_KEY, JSON.stringify(event));
  } catch {}

  // Broadcast across tabs
  try {
    const ch = getBroadcastChannel();
    if (ch) {
      ch.postMessage(event);
    }
  } catch {}

  // Broadcast in current tab
  try {
    window.dispatchEvent(new CustomEvent('ongc:auth-sync', { detail: event }));
  } catch {}
}

/**
 * Check if a role belongs strictly to Commercial Agents / Sub-Agents
 */
export function isAgentRole(role?: string | null): boolean {
  if (!role) return false;
  const upper = String(role).toUpperCase();
  return upper === 'COMMERCIAL_AGENT' || upper === 'COMMERCIAL_SUB_AGENT';
}

/**
 * Check if a role belongs to Administrative / Management staff
 */
export function isAdminRole(role?: string | null): boolean {
  if (!role) return false;
  const upper = String(role).toUpperCase();
  const adminRoles = [
    'SUPER_ADMIN',
    'ADMIN',
    'EVENT_ADMIN',
    'COMMERCIAL_ADMIN',
    'EMPLOYEE_ADMIN',
    'GATE_MANAGER',
    'HELP_DESK',
  ];
  return adminRoles.includes(upper);
}

/**
 * Determine the canonical home portal path for a user role
 */
export function getPortalForRole(role?: string | null): string {
  if (isAgentRole(role)) {
    return '/agent';
  }
  const upper = String(role || '').toUpperCase();
  if (upper === 'SCANNER_STAFF' || upper === 'GATE_OPERATOR') {
    return '/scanner';
  }
  if (upper === 'REGISTRATION_STAFF') {
    return '/admin/attendees';
  }
  return '/admin';
}

/**
 * Subscribe to authentication events (login, logout, account switch) across tabs and windows.
 */
export function subscribeToAuthSync(callback: (event: AuthSyncEvent) => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  // 1. Cross-tab BroadcastChannel listener
  const ch = getBroadcastChannel();
  const handleBroadcast = (msgEvent: MessageEvent) => {
    if (msgEvent?.data?.type) {
      callback(msgEvent.data as AuthSyncEvent);
    }
  };
  if (ch) {
    ch.addEventListener('message', handleBroadcast);
  }

  // 2. Cross-tab Storage event listener (works even if BroadcastChannel is unavailable)
  const handleStorage = (storageEvent: StorageEvent) => {
    if (storageEvent.key === AUTH_SYNC_EVENT_KEY && storageEvent.newValue) {
      try {
        const parsed = JSON.parse(storageEvent.newValue);
        if (parsed?.type) {
          callback(parsed as AuthSyncEvent);
          return;
        }
      } catch {}
    }

    if (storageEvent.key === AUTH_SESSION_KEY || storageEvent.key === LEGACY_ADMIN_KEY) {
      if (!storageEvent.newValue) {
        callback({ type: 'LOGOUT', user: null, timestamp: Date.now() });
      } else {
        try {
          const parsed = JSON.parse(storageEvent.newValue);
          callback({ type: 'LOGIN', user: parsed, timestamp: Date.now() });
        } catch {}
      }
    }
  };
  window.addEventListener('storage', handleStorage);

  // 3. Current-tab custom event listener
  const handleCustom = (customEvt: Event) => {
    const detail = (customEvt as CustomEvent)?.detail;
    if (detail?.type) {
      callback(detail as AuthSyncEvent);
    }
  };
  window.addEventListener('ongc:auth-sync', handleCustom);

  // Unsubscribe function
  return () => {
    if (ch) {
      ch.removeEventListener('message', handleBroadcast);
    }
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener('ongc:auth-sync', handleCustom);
  };
}

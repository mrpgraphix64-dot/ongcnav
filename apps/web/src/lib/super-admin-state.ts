import { fetchApi } from './api';

export interface SuperAdminState {
  superAdminFullPower: boolean;
  fullPowerActive: boolean;
  maintenanceMode: boolean;
  maintenanceModeActive: boolean;
  isProduction: boolean;
  nodeEnv?: string;
  environment?: string;
}

export const SUPER_ADMIN_SYNC_EVENT = 'ongc:super-admin-sync';
const BROADCAST_CHANNEL_NAME = 'ongc_super_admin_sync_channel';
const STORAGE_SYNC_KEY = 'ongc_super_admin_sync_event';

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
 * Broadcast super admin state changes across local event listeners,
 * BroadcastChannel (cross-tab), and storage (fallback).
 */
export function broadcastSuperAdminSync(state?: SuperAdminState): void {
  if (typeof window === 'undefined') return;

  const detail = state || null;
  try {
    window.dispatchEvent(new CustomEvent(SUPER_ADMIN_SYNC_EVENT, { detail }));
  } catch {}

  try {
    const ch = getBroadcastChannel();
    if (ch) {
      ch.postMessage({ type: 'SYNC', state: detail, timestamp: Date.now() });
    }
  } catch {}

  try {
    localStorage.setItem(
      STORAGE_SYNC_KEY,
      JSON.stringify({ timestamp: Date.now(), state: detail })
    );
  } catch {}
}

/**
 * Subscribe to real-time super admin setting synchronization.
 */
export function subscribeToSuperAdminSync(
  callback: (state?: SuperAdminState) => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleCustomEvent = (e: any) => {
    callback(e?.detail);
  };

  const handleStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_SYNC_KEY && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        callback(parsed.state);
      } catch {
        callback();
      }
    }
  };

  let ch: BroadcastChannel | null = null;
  const handleMessage = (e: MessageEvent) => {
    if (e.data?.type === 'SYNC') {
      callback(e.data.state);
    }
  };

  try {
    window.addEventListener(SUPER_ADMIN_SYNC_EVENT, handleCustomEvent);
    window.addEventListener('storage', handleStorage);
    ch = getBroadcastChannel();
    if (ch) {
      ch.addEventListener('message', handleMessage);
    }
  } catch {}

  return () => {
    try {
      window.removeEventListener(SUPER_ADMIN_SYNC_EVENT, handleCustomEvent);
      window.removeEventListener('storage', handleStorage);
      if (ch) {
        ch.removeEventListener('message', handleMessage);
      }
    } catch {}
  };
}

/**
 * Fetch fresh super-admin configuration from backend API.
 */
export async function fetchSuperAdminSettings(): Promise<SuperAdminState | null> {
  try {
    const res = await fetchApi<any>('/admin/settings/super-admin');
    if (!res) return null;
    return {
      superAdminFullPower: Boolean(res.superAdminFullPower),
      fullPowerActive: Boolean(res.fullPowerActive ?? res.superAdminFullPower ?? res.fullPower),
      maintenanceMode: Boolean(res.maintenanceMode),
      maintenanceModeActive: Boolean(res.maintenanceMode ?? res.maintenanceModeActive),
      isProduction: Boolean(res.isProduction),
      nodeEnv: res.nodeEnv || res.environment || 'staging',
      environment: res.environment || res.nodeEnv || 'staging',
    };
  } catch {
    return null;
  }
}

/**
 * Disable Full Power mode with server-side API call and immediate sync broadcast.
 */
export async function disableSuperAdminFullPower(): Promise<{ success: boolean; message: string }> {
  const res = await fetchApi<any>('/admin/settings/super-admin/full-power', {
    method: 'POST',
    body: JSON.stringify({ enabled: false }),
  });
  const updatedState = await fetchSuperAdminSettings();
  broadcastSuperAdminSync(updatedState || undefined);
  return {
    success: true,
    message: res?.message || 'SUPER_ADMIN Full Power has been turned OFF.',
  };
}

/**
 * Disable Maintenance Mode with server-side API call and immediate sync broadcast.
 */
export async function disableSuperAdminMaintenanceMode(): Promise<{ success: boolean; message: string }> {
  const res = await fetchApi<any>('/admin/settings/super-admin/maintenance-mode', {
    method: 'POST',
    body: JSON.stringify({ enabled: false }),
  });
  const updatedState = await fetchSuperAdminSettings();
  broadcastSuperAdminSync(updatedState || undefined);
  return {
    success: true,
    message: res?.message || 'Maintenance Mode has been turned OFF.',
  };
}

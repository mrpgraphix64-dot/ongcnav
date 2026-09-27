'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings,
  Calendar,
  QrCode,
  ScanLine,
  Bell,
  Shield,
  Save,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  DoorOpen,
  Trash2,
  X,
  Lock,
  Building,
  Clock,
  Sparkles,
  Zap,
  Power,
  ShieldAlert,
  Wrench,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { getStoredAuthUser, subscribeToAuthSync } from '@/lib/auth-session';
import { subscribeToSuperAdminSync, broadcastSuperAdminSync } from '@/lib/super-admin-state';

type TabType = 'general' | 'event' | 'qr' | 'scanner' | 'notifications' | 'security' | 'gates' | 'danger';

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('general');
  const [groups, setGroups] = useState<Record<string, any>>({});
  const [gates, setGates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Authenticated user & role check
  const [currentUser, setCurrentUser] = useState<{ id?: string; role?: string; email?: string } | null>(null);
  const isSuperAdmin = (currentUser?.role || '').toUpperCase() === 'SUPER_ADMIN';

  // Super Admin Control Center state
  const [superAdminData, setSuperAdminData] = useState<{
    superAdminFullPower: boolean;
    fullPowerActive: boolean;
    isProduction: boolean;
    nodeEnv: string;
    maintenanceMode: boolean;
    adminTestDataDeleteEnabled: boolean;
  } | null>(null);
  const [fullPowerModalOpen, setFullPowerModalOpen] = useState(false);
  const [fullPowerConfirmText, setFullPowerConfirmText] = useState('');
  const [fullPowerSubmitting, setFullPowerSubmitting] = useState(false);
  const [fullPowerError, setFullPowerError] = useState<string | null>(null);

  const [maintenanceModalOpen, setMaintenanceModalOpen] = useState(false);
  const [maintenanceConfirmText, setMaintenanceConfirmText] = useState('');
  const [maintenanceSubmitting, setMaintenanceSubmitting] = useState(false);
  const [maintenanceError, setMaintenanceError] = useState<string | null>(null);

  // Danger zone confirmation
  const [dangerConfirm, setDangerConfirm] = useState('');
  const [dangerSubmitting, setDangerSubmitting] = useState(false);

  const loadSuperAdminSettings = async () => {
    try {
      const res = await fetchApi<any>('/admin/settings/super-admin');
      if (res) {
        setSuperAdminData({
          superAdminFullPower: Boolean(res.superAdminFullPower),
          fullPowerActive: Boolean(res.fullPowerActive),
          isProduction: Boolean(res.isProduction),
          nodeEnv: String(res.nodeEnv || 'development'),
          maintenanceMode: Boolean(res.maintenanceMode),
          adminTestDataDeleteEnabled: Boolean(res.adminTestDataDeleteEnabled),
        });
      }
    } catch {
      setSuperAdminData(null);
    }
  };

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await fetchApi('/admin/settings');
      if (data) {
        setGroups(data.groups || {});
        setGates(data.gates || []);
      }
    } catch (e: any) {
      setMsg({ text: e.message || 'Failed to load settings', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 1. Synchronous auth profile retrieval from local storage
    const stored = getStoredAuthUser();
    if (stored) {
      setCurrentUser(stored as any);
      if ((stored.role || '').toUpperCase() === 'SUPER_ADMIN') {
        loadSuperAdminSettings();
      }
    }

    // 2. Authoritative server-side session verification
    fetchApi('/auth/me')
      .then((res: any) => {
        if (res?.user) {
          setCurrentUser(res.user);
          if ((res.user.role || '').toUpperCase() === 'SUPER_ADMIN') {
            loadSuperAdminSettings();
          }
        }
      })
      .catch(() => {});

    // 3. Cross-tab auth synchronization
    const unsubscribe = subscribeToAuthSync((event) => {
      if (event.type === 'LOGIN' && event.user) {
        setCurrentUser(event.user as any);
        if ((event.user.role || '').toUpperCase() === 'SUPER_ADMIN') {
          loadSuperAdminSettings();
        }
      } else if (event.type === 'LOGOUT' || event.type === 'SESSION_EXPIRED') {
        setCurrentUser(null);
        setSuperAdminData(null);
      }
    });

    const unsubscribeSync = subscribeToSuperAdminSync(() => {
      loadSuperAdminSettings();
    });

    loadSettings();

    return () => {
      unsubscribe?.();
      unsubscribeSync?.();
    };
  }, []);

  const handleInputChange = (group: string, field: string, value: any) => {
    setGroups((prev) => ({
      ...prev,
      [group]: {
        ...(prev[group] || {}),
        [field]: value,
      },
    }));
  };

  const handleSaveGroup = async (group: string) => {
    setSaving(true);
    setMsg(null);
    try {
      const payload = groups[group] || {};
      await fetchApi(`/admin/settings/${group}`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setMsg({ text: `${group.toUpperCase()} settings saved successfully.`, type: 'success' });
    } catch (e: any) {
      setMsg({ text: e.message || `Failed to save ${group} settings`, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleResetData = async (e: React.FormEvent) => {
    e.preventDefault();
    if (dangerConfirm.trim().toUpperCase() !== 'RESET') {
      alert('You must type RESET to confirm.');
      return;
    }

    setDangerSubmitting(true);
    try {
      await fetchApi('/admin/settings/reset-data', {
        method: 'POST',
        body: JSON.stringify({ confirmation: dangerConfirm }),
      });
      setMsg({ text: 'Event test data reset completed.', type: 'success' });
      setDangerConfirm('');
    } catch (e: any) {
      alert(e.message || 'Reset failed.');
    } finally {
      setDangerSubmitting(false);
    }
  };

  const currentGroup = groups[activeTab] || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 rounded-3xl bg-white border border-stone-200/80 card-shadow">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 uppercase">
              System Configuration
            </span>
            <h2 className="font-outfit font-extrabold text-2xl text-ink mt-1 flex items-center gap-2">
              <Settings className="w-6 h-6 text-maroon" />
              <span>Event Portal Settings</span>
            </h2>
            <p className="text-xs text-ink-soft mt-0.5">
              Control event parameters, turnstile hardware thresholds, QR policies, and audit configurations.
            </p>
          </div>
        </div>
      </div>

      {/* Flash Alert */}
      {msg && (
        <div
          className={`p-4 rounded-2xl flex items-center justify-between shadow-xs transition-all ${
            msg.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border border-rose-300 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-3">
            {msg.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span className="text-sm font-semibold">{msg.text}</span>
          </div>
          <button
            onClick={() => setMsg(null)}
            className="p-1 rounded-lg hover:bg-black/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-stone-100 rounded-2xl border border-stone-200 text-xs font-bold">
        {[
          { id: 'general', label: 'General', icon: Building },
          { id: 'event', label: 'Event Dates', icon: Calendar },
          { id: 'qr', label: 'QR Pass', icon: QrCode },
          { id: 'scanner', label: 'Scanner', icon: ScanLine },
          { id: 'notifications', label: 'Notifications', icon: Bell },
          { id: 'security', label: 'Security & Access', icon: Shield },
          { id: 'gates', label: 'Gates Overview', icon: DoorOpen },
          { id: 'danger', label: 'Danger Zone', icon: AlertTriangle },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
                isActive
                  ? 'bg-maroon text-white shadow-xs'
                  : 'text-stone-600 hover:text-ink hover:bg-white/60'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-gold' : 'text-stone-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div className="bg-white rounded-3xl border border-stone-200/80 card-shadow p-6">
        {/* 1. General Settings */}
        {activeTab === 'general' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSaveGroup('general');
            }}
            className="space-y-4 max-w-2xl"
          >
            <h3 className="font-outfit font-extrabold text-lg text-ink">General Festival Details</h3>
            <div>
              <label className="block text-xs font-bold text-ink mb-1">Event Name</label>
              <input
                type="text"
                value={currentGroup.event_name || ''}
                onChange={(e) => handleInputChange('general', 'event_name', e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-stone-200 bg-cream-soft text-ink focus:outline-maroon font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-ink mb-1">Organization</label>
              <input
                type="text"
                value={currentGroup.organization || ''}
                onChange={(e) => handleInputChange('general', 'organization', e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-stone-200 bg-cream-soft text-ink focus:outline-maroon font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-ink mb-1">Venue Location</label>
              <input
                type="text"
                value={currentGroup.venue || ''}
                onChange={(e) => handleInputChange('general', 'venue', e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-stone-200 bg-cream-soft text-ink focus:outline-maroon font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-ink mb-1">Description</label>
              <textarea
                rows={3}
                value={currentGroup.description || ''}
                onChange={(e) => handleInputChange('general', 'description', e.target.value)}
                className="w-full text-xs p-3.5 rounded-xl border border-stone-200 bg-cream-soft text-ink focus:outline-maroon font-medium"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-maroon hover:bg-maroon-dark text-white text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save General Settings'}</span>
            </button>
          </form>
        )}

        {/* 2. Event Dates */}
        {activeTab === 'event' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSaveGroup('event');
            }}
            className="space-y-4 max-w-2xl"
          >
            <h3 className="font-outfit font-extrabold text-lg text-ink">Operational Dates &amp; Times</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-ink mb-1">Festival Start Date</label>
                <input
                  type="date"
                  value={currentGroup.start_date || ''}
                  onChange={(e) => handleInputChange('event', 'start_date', e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-stone-200 bg-cream-soft text-ink focus:outline-maroon font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-ink mb-1">Festival End Date</label>
                <input
                  type="date"
                  value={currentGroup.end_date || ''}
                  onChange={(e) => handleInputChange('event', 'end_date', e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-stone-200 bg-cream-soft text-ink focus:outline-maroon font-medium"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-ink mb-1">Gate Opening Time (IST)</label>
                <input
                  type="time"
                  value={currentGroup.opening_time || ''}
                  onChange={(e) => handleInputChange('event', 'opening_time', e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-stone-200 bg-cream-soft text-ink focus:outline-maroon font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-ink mb-1">Gate Closing Time (IST)</label>
                <input
                  type="time"
                  value={currentGroup.closing_time || ''}
                  onChange={(e) => handleInputChange('event', 'closing_time', e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-stone-200 bg-cream-soft text-ink focus:outline-maroon font-medium"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-ink mb-1">Max Overall Venue Capacity</label>
                <input
                  type="number"
                  value={currentGroup.max_capacity || ''}
                  onChange={(e) => handleInputChange('event', 'max_capacity', e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-stone-200 bg-cream-soft text-ink focus:outline-maroon font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-ink mb-1">Event Status</label>
                <select
                  value={currentGroup.status || 'active'}
                  onChange={(e) => handleInputChange('event', 'status', e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-stone-200 bg-cream-soft text-ink focus:outline-maroon font-medium"
                >
                  <option value="active">Active (Gates Operable)</option>
                  <option value="paused">Paused (Scanning Suspended)</option>
                  <option value="closed">Closed (Event Complete)</option>
                </select>
              </div>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-maroon hover:bg-maroon-dark text-white text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Event Timing'}</span>
            </button>
          </form>
        )}

        {/* 3. QR Pass */}
        {activeTab === 'qr' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSaveGroup('qr');
            }}
            className="space-y-4 max-w-2xl"
          >
            <h3 className="font-outfit font-extrabold text-lg text-ink">QR Pass Issuance Policies</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-ink mb-1">Ticket Number Prefix</label>
                <input
                  type="text"
                  value={currentGroup.ticket_prefix || ''}
                  onChange={(e) => handleInputChange('qr', 'ticket_prefix', e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-stone-200 bg-cream-soft text-ink focus:outline-maroon font-mono font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-ink mb-1">Starting Sequence Number</label>
                <input
                  type="number"
                  value={currentGroup.starting_number || ''}
                  onChange={(e) => handleInputChange('qr', 'starting_number', e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-stone-200 bg-cream-soft text-ink focus:outline-maroon font-mono"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-ink mb-1">QR Code Render Size (px)</label>
                <input
                  type="number"
                  value={currentGroup.code_size || '300'}
                  onChange={(e) => handleInputChange('qr', 'code_size', e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-stone-200 bg-cream-soft text-ink focus:outline-maroon"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-ink mb-1">Error Correction Level</label>
                <select
                  value={currentGroup.error_correction || 'M'}
                  onChange={(e) => handleInputChange('qr', 'error_correction', e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-stone-200 bg-cream-soft text-ink focus:outline-maroon font-medium"
                >
                  <option value="L">L (7% redundant)</option>
                  <option value="M">M (15% redundant - Recommended)</option>
                  <option value="Q">Q (25% redundant)</option>
                  <option value="H">H (30% redundant)</option>
                </select>
              </div>
            </div>
            <div className="space-y-2 pt-2">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!currentGroup.auto_generate_qr}
                  onChange={(e) => handleInputChange('qr', 'auto_generate_qr', e.target.checked)}
                  className="rounded text-maroon focus:ring-maroon"
                />
                <span className="text-xs font-semibold text-ink">Auto-generate QR code upon attendee registration</span>
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!currentGroup.auto_generate_ticket}
                  onChange={(e) => handleInputChange('qr', 'auto_generate_ticket', e.target.checked)}
                  className="rounded text-maroon focus:ring-maroon"
                />
                <span className="text-xs font-semibold text-ink">Automatically assign sequential Ticket ID</span>
              </label>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-maroon hover:bg-maroon-dark text-white text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save QR Policies'}</span>
            </button>
          </form>
        )}

        {/* 4. Scanner */}
        {activeTab === 'scanner' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSaveGroup('scanner');
            }}
            className="space-y-4 max-w-2xl"
          >
            <h3 className="font-outfit font-extrabold text-lg text-ink">Turnstile Scanner Device Controls</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-ink mb-1">Scan Timeout (Seconds)</label>
                <input
                  type="number"
                  value={currentGroup.timeout_seconds || '10'}
                  onChange={(e) => handleInputChange('scanner', 'timeout_seconds', e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-stone-200 bg-cream-soft text-ink focus:outline-maroon"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-ink mb-1">Auto-Reset Result Delay (Seconds)</label>
                <input
                  type="number"
                  value={currentGroup.auto_reset_seconds || '3'}
                  onChange={(e) => handleInputChange('scanner', 'auto_reset_seconds', e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-stone-200 bg-cream-soft text-ink focus:outline-maroon"
                />
              </div>
            </div>
            <div className="space-y-2 pt-2">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!currentGroup.auto_start_camera}
                  onChange={(e) => handleInputChange('scanner', 'auto_start_camera', e.target.checked)}
                  className="rounded text-maroon focus:ring-maroon"
                />
                <span className="text-xs font-semibold text-ink">Auto-start camera viewport on scanner load</span>
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!currentGroup.auto_verify_qr}
                  onChange={(e) => handleInputChange('scanner', 'auto_verify_qr', e.target.checked)}
                  className="rounded text-maroon focus:ring-maroon"
                />
                <span className="text-xs font-semibold text-ink">Instantly verify QR code upon camera frame capture</span>
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!currentGroup.prevent_duplicate_checkin}
                  onChange={(e) => handleInputChange('scanner', 'prevent_duplicate_checkin', e.target.checked)}
                  className="rounded text-maroon focus:ring-maroon"
                />
                <span className="text-xs font-semibold text-ink">Enforce strict turnstile duplicate prevention (Block re-entry)</span>
              </label>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-maroon hover:bg-maroon-dark text-white text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Scanner Settings'}</span>
            </button>
          </form>
        )}

        {/* 5. Notifications */}
        {activeTab === 'notifications' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSaveGroup('notifications');
            }}
            className="space-y-4 max-w-2xl"
          >
            <h3 className="font-outfit font-extrabold text-lg text-ink">Alerts &amp; Dispatch Channels</h3>
            <div className="space-y-3">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!currentGroup.email_ticket}
                  onChange={(e) => handleInputChange('notifications', 'email_ticket', e.target.checked)}
                  className="rounded text-maroon focus:ring-maroon"
                />
                <span className="text-xs font-semibold text-ink">Email digital pass to ONGC employee</span>
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!currentGroup.duplicate_scan_alert}
                  onChange={(e) => handleInputChange('notifications', 'duplicate_scan_alert', e.target.checked)}
                  className="rounded text-maroon focus:ring-maroon"
                />
                <span className="text-xs font-semibold text-ink">Alert control room on high-frequency duplicate attempts</span>
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!currentGroup.invalid_qr_alert}
                  onChange={(e) => handleInputChange('notifications', 'invalid_qr_alert', e.target.checked)}
                  className="rounded text-maroon focus:ring-maroon"
                />
                <span className="text-xs font-semibold text-ink">Flag suspicious or fraudulent QR scan codes</span>
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!currentGroup.daily_attendance_report}
                  onChange={(e) => handleInputChange('notifications', 'daily_attendance_report', e.target.checked)}
                  className="rounded text-maroon focus:ring-maroon"
                />
                <span className="text-xs font-semibold text-ink">Generate daily closing attendance summary report</span>
              </label>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-maroon hover:bg-maroon-dark text-white text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Notification Settings'}</span>
            </button>
          </form>
        )}

        {/* 6. Security */}
        {activeTab === 'security' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSaveGroup('security');
            }}
            className="space-y-4 max-w-2xl"
          >
            <h3 className="font-outfit font-extrabold text-lg text-ink">Security &amp; Operational Policies</h3>
            <div className="space-y-3">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!currentGroup.require_admin_login}
                  onChange={(e) => handleInputChange('security', 'require_admin_login', e.target.checked)}
                  className="rounded text-maroon focus:ring-maroon"
                />
                <span className="text-xs font-semibold text-ink">Enforce strict authentication for staff &amp; scanner operators</span>
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!currentGroup.allow_manual_checkin}
                  onChange={(e) => handleInputChange('security', 'allow_manual_checkin', e.target.checked)}
                  className="rounded text-maroon focus:ring-maroon"
                />
                <span className="text-xs font-semibold text-ink">Allow authorized Help Desk supervisors to record manual entry overrides</span>
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!currentGroup.log_scan_attempts}
                  onChange={(e) => handleInputChange('security', 'log_scan_attempts', e.target.checked)}
                  className="rounded text-maroon focus:ring-maroon"
                />
                <span className="text-xs font-semibold text-ink">Record all valid and rejected turnstile scan attempts to persistent audit trail</span>
              </label>
            </div>
            <div>
              <label className="block text-xs font-bold text-ink mb-1">Audit Log Retention (Days)</label>
              <input
                type="number"
                value={currentGroup.audit_log_days || '90'}
                onChange={(e) => handleInputChange('security', 'audit_log_days', e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-stone-200 bg-cream-soft text-ink focus:outline-maroon max-w-xs font-medium"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-maroon hover:bg-maroon-dark text-white text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Security Policies'}</span>
            </button>
          </form>
        )}

        {/* 7. Gates Overview */}
        {activeTab === 'gates' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-outfit font-extrabold text-lg text-ink">Physical Gates</h3>
                <p className="text-xs text-ink-soft">Registered turnstile checkpoints.</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-stone-50 text-stone-600 font-bold border-b border-stone-200">
                    <th className="py-3 px-4">Gate Name</th>
                    <th className="py-3 px-3">Gate Code</th>
                    <th className="py-3 px-4">Location / Description</th>
                    <th className="py-3 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {gates.map((g) => (
                    <tr key={g.id} className="hover:bg-cream/40">
                      <td className="py-3 px-4 font-bold text-ink">{g.name}</td>
                      <td className="py-3 px-3 font-mono text-stone-600">{g.code}</td>
                      <td className="py-3 px-4 text-stone-600">{g.location || 'General Access'}</td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          {g.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 8. Danger Zone */}
        {activeTab === 'danger' && (
          <div className="space-y-6 max-w-3xl">
            {/* ONLY RENDER SUPER_ADMIN FULL POWER & MAINTENANCE MODE CONTROLS FOR SUPER_ADMIN */}
            {isSuperAdmin && (
              <>
                {/* --------------------------------------------
                    1. ⚡ SUPER ADMIN FULL POWER CARD
                   -------------------------------------------- */}
                <div
                  className={`p-6 rounded-2xl border transition-all ${
                    !superAdminData?.isProduction && (superAdminData?.fullPowerActive || superAdminData?.superAdminFullPower)
                      ? 'border-rose-400 bg-rose-50/80 shadow-md ring-1 ring-rose-300'
                      : 'border-stone-200 bg-white shadow-xs'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          !superAdminData?.isProduction && (superAdminData?.fullPowerActive || superAdminData?.superAdminFullPower)
                            ? 'bg-rose-600 text-white animate-pulse'
                            : 'bg-rose-100 text-rose-700'
                        }`}
                      >
                        <Zap className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-outfit font-black text-base text-rose-950 flex items-center gap-2">
                          <span>⚡ SUPER ADMIN FULL POWER</span>
                        </h4>
                        <p className="text-xs text-stone-600 mt-0.5">
                          Enable unrestricted business-level destructive controls for SUPER_ADMIN in staging/development.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-bold text-stone-500">Status:</span>
                      {superAdminData?.isProduction ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-stone-200 text-stone-700 border border-stone-300">
                          Unavailable in Production
                        </span>
                      ) : !superAdminData?.isProduction && (superAdminData?.fullPowerActive || superAdminData?.superAdminFullPower) ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-600 text-white border border-rose-700 shadow-xs">
                          <span className="w-2 h-2 rounded-full bg-amber-300 animate-ping" />
                          ACTIVE
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-stone-100 text-stone-700 border border-stone-300">
                          OFF
                        </span>
                      )}
                    </div>
                  </div>

                  {/* PROMINENT RED WARNING WHEN FULL POWER IS ACTIVE */}
                  {!superAdminData?.isProduction && (superAdminData?.fullPowerActive || superAdminData?.superAdminFullPower) && (
                    <div className="mt-4 p-4 rounded-xl bg-rose-600 text-white shadow-sm flex items-start gap-3 animate-in fade-in">
                      <AlertTriangle className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <div className="font-outfit font-black text-sm tracking-wide text-amber-200 flex items-center gap-2">
                          <span>⚡ FULL POWER ACTIVE</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/20 uppercase">
                            {superAdminData?.nodeEnv || 'staging'}
                          </span>
                        </div>
                        <p className="text-xs text-rose-50 leading-relaxed font-medium">
                          SUPER_ADMIN destructive deletion controls are currently enabled. Normal safe deletion safeguards and protection rules are bypassed.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* DESCRIPTION */}
                  <div className="mt-4 text-xs text-stone-600 space-y-1.5 bg-stone-50 p-3.5 rounded-xl border border-stone-200/80">
                    <p className="leading-relaxed">
                      Allows SUPER_ADMIN to permanently delete otherwise protected business records in staging/development.
                    </p>
                    {!(!superAdminData?.isProduction && (superAdminData?.fullPowerActive || superAdminData?.superAdminFullPower)) && (
                      <p className="text-stone-500 font-medium">
                        When OFF: normal safe deletion rules remain active.
                      </p>
                    )}
                  </div>

                  {/* ACTION BUTTON */}
                  <div className="pt-4">
                    {superAdminData?.isProduction ? (
                      <button
                        disabled
                        className="px-4 py-2.5 rounded-xl bg-stone-200 text-stone-500 text-xs font-bold cursor-not-allowed"
                      >
                        Full Power is unavailable in Production
                      </button>
                    ) : !superAdminData?.isProduction && (superAdminData?.fullPowerActive || superAdminData?.superAdminFullPower) ? (
                      <button
                        type="button"
                        disabled={fullPowerSubmitting}
                        onClick={async () => {
                          try {
                            setFullPowerSubmitting(true);
                            const res = await fetchApi<any>('/admin/settings/super-admin/full-power', {
                              method: 'POST',
                              body: JSON.stringify({ enabled: false }),
                            });
                            setMsg({ text: res.message || 'SUPER_ADMIN Full Power deactivated.', type: 'success' });
                            setSuperAdminData((prev) => prev ? { ...prev, fullPowerActive: false, superAdminFullPower: false } : prev);
                            await loadSuperAdminSettings();
                            broadcastSuperAdminSync();
                          } catch (e: any) {
                            setMsg({ text: e.message || 'Failed to deactivate Full Power', type: 'error' });
                          } finally {
                            setFullPowerSubmitting(false);
                          }
                        }}
                        className="px-5 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-900 text-white text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-2"
                      >
                        <Power className="w-4 h-4 text-rose-400" />
                        <span>{fullPowerSubmitting ? 'Deactivating...' : 'Deactivate Full Power'}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setFullPowerConfirmText('');
                          setFullPowerError(null);
                          setFullPowerModalOpen(true);
                        }}
                        className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-2"
                      >
                        <Zap className="w-4 h-4 text-amber-300" />
                        <span>Enable Full Power</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* --------------------------------------------
                    2. 🛠 MAINTENANCE MODE CARD
                   -------------------------------------------- */}
                <div
                  className={`p-6 rounded-2xl border transition-all ${
                    superAdminData?.maintenanceMode
                      ? 'border-amber-400 bg-amber-50/80 shadow-md ring-1 ring-amber-300'
                      : 'border-stone-200 bg-white shadow-xs'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          superAdminData?.maintenanceMode
                            ? 'bg-amber-600 text-white animate-pulse'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        <Wrench className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-outfit font-black text-base text-amber-950 flex items-center gap-2">
                          <span>🛠 MAINTENANCE MODE</span>
                        </h4>
                        <p className="text-xs text-stone-600 mt-0.5">
                          Temporarily disable public registration and E-Pass purchase while keeping administration and scanner operations available.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-bold text-stone-500">Status:</span>
                      {superAdminData?.maintenanceMode ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-600 text-white border border-amber-700 shadow-xs">
                          <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                          ACTIVE
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-stone-100 text-stone-700 border border-stone-300">
                          OFF
                        </span>
                      )}
                    </div>
                  </div>

                  {/* PROMINENT AMBER WARNING WHEN MAINTENANCE MODE IS ACTIVE */}
                  {superAdminData?.maintenanceMode && (
                    <div className="mt-4 p-4 rounded-xl bg-amber-500 text-white shadow-sm flex items-start gap-3 animate-in fade-in">
                      <ShieldAlert className="w-5 h-5 text-white shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <div className="font-outfit font-black text-sm tracking-wide">
                          🟠 MAINTENANCE MODE ACTIVE
                        </div>
                        <p className="text-xs text-amber-50 leading-relaxed font-medium">
                          Public registration and E-Pass purchase are currently suspended. Turnstile scanner operations and administration consoles remain fully active.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* DESCRIPTION */}
                  <div className="mt-4 text-xs text-stone-600 space-y-1.5 bg-stone-50 p-3.5 rounded-xl border border-stone-200/80">
                    <p className="leading-relaxed">
                      Blocks public registration / E-Pass purchase while leaving admin and scanner operations available.
                    </p>
                  </div>

                  {/* ACTION BUTTON */}
                  <div className="pt-4">
                    {superAdminData?.maintenanceMode ? (
                      <button
                        type="button"
                        disabled={maintenanceSubmitting}
                        onClick={async () => {
                          try {
                            setMaintenanceSubmitting(true);
                            const res = await fetchApi<any>('/admin/settings/super-admin/maintenance-mode', {
                              method: 'POST',
                              body: JSON.stringify({ enabled: false }),
                            });
                            setMsg({ text: res.message || 'System Maintenance Mode deactivated.', type: 'success' });
                            setSuperAdminData((prev) => prev ? { ...prev, maintenanceMode: false } : prev);
                            await loadSuperAdminSettings();
                            broadcastSuperAdminSync();
                          } catch (e: any) {
                            setMsg({ text: e.message || 'Failed to deactivate Maintenance Mode', type: 'error' });
                          } finally {
                            setMaintenanceSubmitting(false);
                          }
                        }}
                        className="px-5 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-900 text-white text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-2"
                      >
                        <Power className="w-4 h-4 text-amber-400" />
                        <span>{maintenanceSubmitting ? 'Deactivating...' : 'Deactivate Maintenance Mode'}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setMaintenanceConfirmText('');
                          setMaintenanceError(null);
                          setMaintenanceModalOpen(true);
                        }}
                        className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-2"
                      >
                        <Power className="w-4 h-4" />
                        <span>Enable Maintenance Mode</span>
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* --------------------------------------------
                3. ⚠ EXISTING DATA PURGE
               -------------------------------------------- */}
            <div className="p-6 rounded-2xl border border-stone-200 bg-white space-y-4">
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 space-y-2">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                  <span>Restricted Administrative Action</span>
                </div>
                <p className="text-xs text-rose-800">
                  Purging event data will clear test scan events and simulate a clean slate. Type{' '}
                  <strong className="font-mono bg-white px-1.5 py-0.5 rounded border border-rose-300">
                    RESET
                  </strong>{' '}
                  to authorize.
                </p>
              </div>

              <form onSubmit={handleResetData} className="space-y-3 max-w-md">
                <div>
                  <label className="block text-xs font-bold text-ink mb-1">Type RESET to confirm</label>
                  <input
                    type="text"
                    placeholder="RESET"
                    value={dangerConfirm}
                    onChange={(e) => setDangerConfirm(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-rose-300 bg-white font-mono font-bold text-rose-900 focus:outline-rose-600"
                  />
                </div>
                <button
                  type="submit"
                  disabled={dangerConfirm.trim().toUpperCase() !== 'RESET' || dangerSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {dangerSubmitting ? 'Purging...' : 'Execute Data Purge'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: CONFIRM FULL POWER ACTIVATION */}
      {fullPowerModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 border border-rose-300 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 flex items-center justify-center shrink-0">
                <Zap className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h3 className="font-outfit font-black text-lg text-rose-950">
                  Enable SUPER_ADMIN Full Power
                </h3>
                <span className="text-xs font-bold text-rose-600 uppercase tracking-wide">
                  Destructive Mode Authorization
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-2">
              <p className="font-bold">
                ⚠️ WARNING: Bypasses all deletion protections!
              </p>
              <p className="leading-relaxed">
                Enabling Full Power grants authority to permanently delete any commercial orders, passes, employee tickets, scanned passes, and payment records.
              </p>
              <p className="font-medium text-rose-800">
                Type <strong>ENABLE FULL POWER</strong> below to activate.
              </p>
            </div>

            {fullPowerError && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span className="font-semibold">{fullPowerError}</span>
              </div>
            )}

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (fullPowerConfirmText.trim() !== 'ENABLE FULL POWER') {
                  setFullPowerError('You must type ENABLE FULL POWER exactly.');
                  return;
                }
                try {
                  setFullPowerSubmitting(true);
                  setFullPowerError(null);
                  const res = await fetchApi<any>('/admin/settings/super-admin/full-power', {
                    method: 'POST',
                    body: JSON.stringify({
                      enabled: true,
                      confirmation: fullPowerConfirmText.trim(),
                    }),
                  });
                  setMsg({ text: res.message || 'SUPER_ADMIN FULL POWER ENABLED.', type: 'success' });
                  setFullPowerModalOpen(false);
                  setFullPowerConfirmText('');
                  setFullPowerError(null);
                  setSuperAdminData((prev) => prev ? { ...prev, fullPowerActive: true, superAdminFullPower: true } : prev);
                  await loadSuperAdminSettings();
                  broadcastSuperAdminSync();
                } catch (err: any) {
                  setFullPowerError(`Unable to enable Full Power. ${err.message || 'Server error occurred.'}`);
                } finally {
                  setFullPowerSubmitting(false);
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1.5">
                  Confirmation Phrase
                </label>
                <input
                  type="text"
                  placeholder="ENABLE FULL POWER"
                  value={fullPowerConfirmText}
                  onChange={(e) => {
                    setFullPowerConfirmText(e.target.value);
                    if (fullPowerError) setFullPowerError(null);
                  }}
                  className="w-full text-xs px-3.5 py-3 rounded-xl border border-rose-300 font-mono font-bold text-rose-900 focus:outline-rose-600 bg-white"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setFullPowerModalOpen(false);
                    setFullPowerConfirmText('');
                    setFullPowerError(null);
                  }}
                  disabled={fullPowerSubmitting}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-stone-600 hover:text-stone-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={fullPowerConfirmText.trim() !== 'ENABLE FULL POWER' || fullPowerSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black transition shadow-sm disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  <Zap className="w-4 h-4 text-amber-300" />
                  <span>{fullPowerSubmitting ? 'Enabling...' : 'Authorize Full Power'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CONFIRM MAINTENANCE MODE ACTIVATION */}
      {maintenanceModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 border border-amber-300 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
                <Power className="w-6 h-6 text-amber-700" />
              </div>
              <div>
                <h3 className="font-outfit font-black text-lg text-amber-950">
                  Enable Maintenance Mode
                </h3>
                <span className="text-xs font-bold text-amber-700 uppercase tracking-wide">
                  Public Intake Suspension
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2">
              <p className="font-bold">
                Public intake will be paused immediately!
              </p>
              <p className="leading-relaxed">
                Public registration and commercial pass purchasing routes will respond with HTTP 503 Maintenance. Scanner turnstiles and gate entry operations will NOT be affected.
              </p>
              <p className="font-medium text-amber-800">
                Type <strong>ENABLE MAINTENANCE</strong> below to activate.
              </p>
            </div>

            {maintenanceError && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-700" />
                <span className="font-semibold">{maintenanceError}</span>
              </div>
            )}

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (maintenanceConfirmText.trim() !== 'ENABLE MAINTENANCE') {
                  setMaintenanceError('You must type ENABLE MAINTENANCE exactly.');
                  return;
                }
                try {
                  setMaintenanceSubmitting(true);
                  setMaintenanceError(null);
                  const res = await fetchApi<any>('/admin/settings/super-admin/maintenance-mode', {
                    method: 'POST',
                    body: JSON.stringify({
                      enabled: true,
                      confirmation: maintenanceConfirmText.trim(),
                    }),
                  });
                  setMsg({ text: res.message || 'System Maintenance Mode enabled.', type: 'success' });
                  setMaintenanceModalOpen(false);
                  setMaintenanceConfirmText('');
                  setMaintenanceError(null);
                  setSuperAdminData((prev) => prev ? { ...prev, maintenanceMode: true } : prev);
                  await loadSuperAdminSettings();
                  broadcastSuperAdminSync();
                } catch (err: any) {
                  setMaintenanceError(`Unable to enable Maintenance Mode. ${err.message || 'Server error occurred.'}`);
                } finally {
                  setMaintenanceSubmitting(false);
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1.5">
                  Confirmation Phrase
                </label>
                <input
                  type="text"
                  placeholder="ENABLE MAINTENANCE"
                  value={maintenanceConfirmText}
                  onChange={(e) => {
                    setMaintenanceConfirmText(e.target.value);
                    if (maintenanceError) setMaintenanceError(null);
                  }}
                  className="w-full text-xs px-3.5 py-3 rounded-xl border border-amber-300 font-mono font-bold text-amber-900 focus:outline-amber-600 bg-white"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setMaintenanceModalOpen(false);
                    setMaintenanceConfirmText('');
                    setMaintenanceError(null);
                  }}
                  disabled={maintenanceSubmitting}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-stone-600 hover:text-stone-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={maintenanceConfirmText.trim() !== 'ENABLE MAINTENANCE' || maintenanceSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black transition shadow-sm disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  <Power className="w-4 h-4" />
                  <span>{maintenanceSubmitting ? 'Enabling...' : 'Activate Maintenance'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

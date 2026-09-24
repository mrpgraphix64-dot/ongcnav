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
} from 'lucide-react';
import { fetchApi } from '@/lib/api';

type TabType = 'general' | 'event' | 'qr' | 'scanner' | 'notifications' | 'security' | 'gates' | 'danger';

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('general');
  const [groups, setGroups] = useState<Record<string, any>>({});
  const [gates, setGates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Danger zone confirmation
  const [dangerConfirm, setDangerConfirm] = useState('');
  const [dangerSubmitting, setDangerSubmitting] = useState(false);

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
    loadSettings();
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
          <div className="space-y-4 max-w-xl">
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

            <form onSubmit={handleResetData} className="space-y-3">
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
        )}
      </div>
    </div>
  );
}

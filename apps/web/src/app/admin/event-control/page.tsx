'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertOctagon,
  Lock,
  Unlock,
  Play,
  Pause,
  Clock,
  Users,
  Calendar,
  Sliders,
  X,
  AlertTriangle,
  RotateCcw,
  DoorOpen,
  ArrowRight,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';

interface GateItem {
  id: string;
  name: string;
  code: string;
  type: string;
  location: string;
  isOpen: boolean;
  status: string;
  checkinsToday: number;
  maximumCapacity: number | null;
  capacityEnabled: boolean;
  blockWhenFull: boolean;
  capacityPercentage: number;
  isCapacityReached: boolean;
  capacityStatusLevel: 'normal' | 'warning' | 'critical' | 'full';
}

interface AuditItem {
  id: string;
  action: string;
  reason: string;
  gateName: string | null;
  userName: string;
  createdAt: string;
}

interface EventControlData {
  activeDate: string;
  isManualDateOverride: boolean;
  eventStatus: 'open' | 'closed';
  scanningEnabled: boolean;
  rawScanningEnabled: boolean;
  emergencyStopped: boolean;
  emergencyReason: string | null;
  kpis: {
    totalRegistered: number;
    bookedForToday: number;
    checkedInToday: number;
    pendingToday: number;
    attendanceRate: number;
    openGatesCount: number;
    totalGatesCount: number;
    activeStaffCount: number;
  };
  gates: GateItem[];
  recentAudits: AuditItem[];
}

export default function EventControlPage() {
  const [data, setData] = useState<EventControlData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Date selection state
  const [dateInput, setDateInput] = useState('');

  // Emergency Modal State
  const [emergencyModalOpen, setEmergencyModalOpen] = useState(false);
  const [emergencyReasonInput, setEmergencyReasonInput] = useState('');

  // Gate Capacity Modal State
  const [activeGateModal, setActiveGateModal] = useState<GateItem | null>(null);
  const [gateCapacityForm, setGateCapacityForm] = useState({
    maximum_capacity: '',
    capacity_enabled: false,
    block_when_full: false,
  });

  const loadData = useCallback(async () => {
    try {
      const res = await fetchApi<EventControlData>('/admin/event-control');
      if (res) {
        setData(res);
        setDateInput(res.activeDate);
      }
    } catch (e: any) {
      setMsg({ text: e.message || 'Failed to load Event Control data', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Format date display (e.g. "Thursday, 24 September 2026")
  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        return d.toLocaleDateString('en-US', {
          weekday: 'long',
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        });
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  // Format relative time or IST timestamp
  const formatTimeDisplay = (isoStr: string) => {
    try {
      const date = new Date(isoStr);
      return date.toLocaleTimeString('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return '';
    }
  };

  // 1. Toggle Event Status (Open <-> Closed)
  const handleToggleStatus = async () => {
    if (!data) return;
    const targetStatus = data.eventStatus === 'open' ? 'CLOSED' : 'OPEN';
    const confirmed = window.confirm(
      `Change overall event entry status to ${targetStatus}? ${
        targetStatus === 'CLOSED' ? 'All gate scanners will reject attendees.' : ''
      }`,
    );
    if (!confirmed) return;

    setActionLoading(true);
    try {
      const res = await fetchApi<any>('/admin/event-control/toggle-status', {
        method: 'POST',
      });
      setMsg({ text: res.message || `Event status changed to ${targetStatus}.`, type: 'success' });
      await loadData();
    } catch (e: any) {
      setMsg({ text: e.message || 'Failed to change event status', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  // 2. Toggle Scanning Enabled (Active <-> Suspended)
  const handleToggleScanning = async () => {
    setActionLoading(true);
    try {
      const res = await fetchApi<any>('/admin/event-control/toggle-scanning', {
        method: 'POST',
      });
      setMsg({ text: res.message || 'Scanning status updated.', type: 'success' });
      await loadData();
    } catch (e: any) {
      setMsg({ text: e.message || 'Failed to toggle scanning', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  // 3. Emergency Stop
  const handleEmergencyStop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emergencyReasonInput.trim()) {
      alert('Please enter a mandatory justification / reason for emergency stop.');
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetchApi<any>('/admin/event-control/emergency-stop', {
        method: 'POST',
        body: JSON.stringify({ reason: emergencyReasonInput.trim() }),
      });
      setEmergencyModalOpen(false);
      setEmergencyReasonInput('');
      setMsg({ text: res.message || 'EMERGENCY STOP ACTIVATED ACROSS ALL GATES', type: 'error' });
      await loadData();
    } catch (e: any) {
      setMsg({ text: e.message || 'Failed to activate emergency stop', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  // 4. Emergency Resume
  const handleEmergencyResume = async () => {
    const confirmed = window.confirm('Resume normal scanning operations across all gates?');
    if (!confirmed) return;

    setActionLoading(true);
    try {
      const res = await fetchApi<any>('/admin/event-control/emergency-resume', {
        method: 'POST',
      });
      setMsg({ text: res.message || 'Emergency stop cleared. Entry scanning resumed.', type: 'success' });
      await loadData();
    } catch (e: any) {
      setMsg({ text: e.message || 'Failed to clear emergency stop', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  // 5. Set Date / Reset Date
  const handleSetDate = async (newDate: string) => {
    setActionLoading(true);
    try {
      const res = await fetchApi<any>('/admin/event-control/set-date', {
        method: 'POST',
        body: JSON.stringify({ active_date: newDate }),
      });
      setMsg({ text: res.message || `Operational date updated to ${newDate}`, type: 'success' });
      await loadData();
    } catch (e: any) {
      setMsg({ text: e.message || 'Failed to set operational date', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  // 6. Toggle Gate Open / Close
  const handleToggleGateOpen = async (gateId: string) => {
    setActionLoading(true);
    try {
      const res = await fetchApi<any>(`/admin/event-control/gates/${gateId}/toggle-open`, {
        method: 'POST',
      });
      setMsg({ text: res.message || 'Gate lane status updated.', type: 'success' });
      await loadData();
    } catch (e: any) {
      setMsg({ text: e.message || 'Failed to toggle gate lane', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  // 7. Open Gate Capacity Modal
  const openCapacityModal = (gate: GateItem) => {
    setActiveGateModal(gate);
    setGateCapacityForm({
      maximum_capacity: gate.maximumCapacity !== null ? String(gate.maximumCapacity) : '',
      capacity_enabled: gate.capacityEnabled,
      block_when_full: gate.blockWhenFull,
    });
  };

  // 8. Save Gate Capacity Limits
  const handleSaveGateCapacity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGateModal) return;

    setActionLoading(true);
    try {
      const capNum = gateCapacityForm.maximum_capacity.trim() !== ''
        ? parseInt(gateCapacityForm.maximum_capacity, 10)
        : null;

      const res = await fetchApi<any>(`/admin/event-control/gates/${activeGateModal.id}/capacity`, {
        method: 'PUT',
        body: JSON.stringify({
          maximum_capacity: capNum,
          capacity_enabled: gateCapacityForm.capacity_enabled,
          block_when_full: gateCapacityForm.block_when_full,
        }),
      });

      setMsg({ text: res.message || 'Capacity settings updated.', type: 'success' });
      setActiveGateModal(null);
      await loadData();
    } catch (e: any) {
      setMsg({ text: e.message || 'Failed to update capacity settings', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center">
        <div className="w-10 h-10 border-4 border-maroon border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm font-semibold text-ink-soft font-outfit">Loading Event Control Console...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center bg-white rounded-3xl border border-stone-200">
        <p className="text-sm text-rose-600 font-semibold mb-3">Failed to load console data.</p>
        <button
          onClick={loadData}
          className="px-4 py-2 rounded-xl bg-maroon text-white text-xs font-bold hover:bg-maroon-dark transition"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Flash Alerts */}
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
              <AlertOctagon className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span className="text-xs sm:text-sm font-semibold">{msg.text}</span>
          </div>
          <button
            onClick={() => setMsg(null)}
            className="p-1 hover:bg-black/5 rounded-lg text-ink-soft hover:text-ink transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. Top Command Console Card (Matching Laravel index.blade.php) */}
      <div className="p-6 rounded-3xl bg-white border border-stone-200/80 card-shadow relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {/* Master Event Status Badge */}
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  data.eventStatus === 'open'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-rose-100 text-rose-800 border border-rose-300'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    data.eventStatus === 'open' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                  }`}
                />
                Event {data.eventStatus.toUpperCase()}
              </span>

              {/* Scanning Active / Off Badge */}
              <span
                className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase ${
                  data.scanningEnabled && !data.emergencyStopped
                    ? 'bg-blue-100 text-blue-800 border border-blue-200'
                    : 'bg-rose-100 text-rose-800 border border-rose-200'
                }`}
              >
                Scanning: {data.scanningEnabled && !data.emergencyStopped ? 'ACTIVE' : 'OFF'}
              </span>

              {/* Emergency Stopped Badge */}
              {data.emergencyStopped && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-extrabold bg-rose-600 text-white uppercase animate-bounce">
                  <AlertOctagon className="w-3.5 h-3.5" />
                  EMERGENCY STOPPED
                </span>
              )}
            </div>

            <h2 className="font-outfit font-extrabold text-2xl text-ink">
              Central Event Operations Console
            </h2>

            <p className="text-xs text-ink-soft mt-1">
              Active Operational Date:{' '}
              <span className="font-bold text-maroon font-outfit text-sm">
                {formatDateDisplay(data.activeDate)}
              </span>
              {data.isManualDateOverride ? (
                <span className="ml-1.5 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  Manual Override
                </span>
              ) : (
                <span className="ml-1.5 text-[11px] font-semibold text-stone-500 bg-stone-100 px-2 py-0.5 rounded">
                  System Date
                </span>
              )}
            </p>
          </div>

          {/* Command Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Date Switch Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSetDate(dateInput);
              }}
              className="flex items-center gap-1.5 bg-cream-soft p-1.5 rounded-2xl border border-stone-200"
            >
              <input
                type="date"
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
                disabled={actionLoading}
                className="text-xs px-2.5 py-1.5 rounded-xl border border-stone-200 bg-white font-semibold focus:outline-maroon"
              />
              <button
                type="submit"
                disabled={actionLoading}
                className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-ink text-xs font-bold transition cursor-pointer"
              >
                Set Date
              </button>
              {data.isManualDateOverride && (
                <button
                  type="button"
                  onClick={() => handleSetDate('')}
                  disabled={actionLoading}
                  className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                  title="Reset to today's system date"
                >
                  Reset
                </button>
              )}
            </form>

            {/* Toggle Event Status Form */}
            <button
              type="button"
              onClick={handleToggleStatus}
              disabled={actionLoading}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-2xs cursor-pointer ${
                data.eventStatus === 'open'
                  ? 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              {data.eventStatus === 'open' ? (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Close Event</span>
                </>
              ) : (
                <>
                  <Unlock className="w-4 h-4" />
                  <span>Open Event</span>
                </>
              )}
            </button>

            {/* Toggle Scanning Form */}
            <button
              type="button"
              onClick={handleToggleScanning}
              disabled={actionLoading}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-2xs cursor-pointer ${
                data.scanningEnabled
                  ? 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {data.scanningEnabled ? (
                <>
                  <Pause className="w-4 h-4" />
                  <span>Pause Scanning</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span>Enable Scanning</span>
                </>
              )}
            </button>

            {/* Emergency Stop / Resume */}
            {!data.emergencyStopped ? (
              <button
                type="button"
                onClick={() => setEmergencyModalOpen(true)}
                disabled={actionLoading}
                className="px-4 py-2.5 rounded-xl text-xs font-extrabold bg-rose-600 hover:bg-rose-700 text-white transition flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <AlertOctagon className="w-4 h-4" />
                <span>STOP ALL SCANNING</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleEmergencyResume}
                disabled={actionLoading}
                className="px-4 py-2.5 rounded-xl text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white transition flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>RESUME NORMAL OPERATIONS</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. Emergency Modal */}
      {emergencyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 border border-rose-200 card-shadow space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h3 className="font-outfit font-extrabold text-lg text-ink">
                  Emergency Stop Confirmation
                </h3>
                <p className="text-xs text-rose-600 font-semibold">Immediate halt to all gate scanners</p>
              </div>
            </div>

            <p className="text-xs text-ink/75 leading-relaxed">
              Activating emergency stop will immediately reject all QR scans and manual entries across all gates with a suspension alert. Only Super Admins and Event Admins can resume scanning.
            </p>

            <form onSubmit={handleEmergencyStop} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-ink mb-1">
                  Reason for Emergency Stop <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Venue capacity incident, safety drill, power restart"
                  value={emergencyReasonInput}
                  onChange={(e) => setEmergencyReasonInput(e.target.value)}
                  className="w-full text-xs px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-rose-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEmergencyModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl text-xs font-extrabold bg-rose-600 hover:bg-rose-700 text-white transition cursor-pointer"
                >
                  Confirm Emergency Stop
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Live Operational KPIs (Matching Laravel 7-column KPI grid) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {/* KPI 1: Registered Total */}
        <div className="p-4 rounded-2xl bg-white border border-stone-200/80 card-shadow">
          <div className="text-[10px] font-bold tracking-wider uppercase text-ink-soft font-outfit">
            Registered Total
          </div>
          <div className="font-outfit font-extrabold text-2xl text-ink mt-1">
            {data.kpis.totalRegistered.toLocaleString()}
          </div>
          <div className="text-[10px] text-stone-400 mt-0.5">All event attendees</div>
        </div>

        {/* KPI 2: Booked Today */}
        <div className="p-4 rounded-2xl bg-white border border-stone-200/80 card-shadow">
          <div className="text-[10px] font-bold tracking-wider uppercase text-ink-soft font-outfit">
            Booked Today
          </div>
          <div className="font-outfit font-extrabold text-2xl text-maroon mt-1">
            {data.kpis.bookedForToday.toLocaleString()}
          </div>
          <div className="text-[10px] text-stone-400 mt-0.5">Selected date pass</div>
        </div>

        {/* KPI 3: Checked In */}
        <div className="p-4 rounded-2xl bg-white border border-stone-200/80 card-shadow">
          <div className="text-[10px] font-bold tracking-wider uppercase text-emerald-800 font-outfit">
            Checked In
          </div>
          <div className="font-outfit font-extrabold text-2xl text-emerald-700 mt-1">
            {data.kpis.checkedInToday.toLocaleString()}
          </div>
          <div className="text-[10px] text-emerald-600 mt-0.5">Active entries</div>
        </div>

        {/* KPI 4: Pending Arrival */}
        <div className="p-4 rounded-2xl bg-white border border-stone-200/80 card-shadow">
          <div className="text-[10px] font-bold tracking-wider uppercase text-amber-800 font-outfit">
            Pending Arrival
          </div>
          <div className="font-outfit font-extrabold text-2xl text-amber-700 mt-1">
            {data.kpis.pendingToday.toLocaleString()}
          </div>
          <div className="text-[10px] text-amber-600 mt-0.5">Yet to arrive</div>
        </div>

        {/* KPI 5: Attendance Rate */}
        <div className="p-4 rounded-2xl bg-white border border-stone-200/80 card-shadow">
          <div className="text-[10px] font-bold tracking-wider uppercase text-ink-soft font-outfit">
            Attendance Rate
          </div>
          <div className="font-outfit font-extrabold text-2xl text-ink mt-1">
            {data.kpis.attendanceRate}%
          </div>
          <div className="w-full bg-stone-100 rounded-full h-1.5 mt-1.5 overflow-hidden">
            <div
              className="bg-maroon h-1.5 rounded-full transition-all"
              style={{ width: `${Math.min(100, Math.max(0, data.kpis.attendanceRate))}%` }}
            />
          </div>
        </div>

        {/* KPI 6: Open Gates */}
        <div className="p-4 rounded-2xl bg-white border border-stone-200/80 card-shadow">
          <div className="text-[10px] font-bold tracking-wider uppercase text-ink-soft font-outfit">
            Open Gates
          </div>
          <div className="font-outfit font-extrabold text-2xl text-ink mt-1">
            {data.kpis.openGatesCount}{' '}
            <span className="text-xs font-normal text-stone-400">
              / {data.kpis.totalGatesCount}
            </span>
          </div>
          <div className="text-[10px] text-stone-400 mt-0.5">Active lanes</div>
        </div>

        {/* KPI 7: On-Duty Staff */}
        <div className="p-4 rounded-2xl bg-white border border-stone-200/80 card-shadow">
          <div className="text-[10px] font-bold tracking-wider uppercase text-ink-soft font-outfit">
            On-Duty Staff
          </div>
          <div className="font-outfit font-extrabold text-2xl text-ink mt-1">
            {data.kpis.activeStaffCount}
          </div>
          <div className="text-[10px] text-stone-400 mt-0.5">Active personnel</div>
        </div>
      </div>

      {/* 5. Gate Live Status & Capacity Controls Table (Exact Laravel layout) */}
      <div className="bg-white rounded-3xl border border-stone-200/80 card-shadow overflow-hidden">
        <div className="p-5 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="font-outfit font-extrabold text-base text-ink flex items-center gap-2">
              <DoorOpen className="w-4 h-4 text-maroon" />
              <span>Gate Live Status &amp; Capacity Controls</span>
            </h3>
            <p className="text-xs text-ink-soft mt-0.5">
              Control lane availability, set maximum capacity limits, and enforce automatic blockades when full.
            </p>
          </div>
          <span className="text-xs text-stone-500 font-semibold bg-stone-50 px-3 py-1 rounded-xl border border-stone-200">
            Active Date: {formatDateDisplay(data.activeDate)}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-stone-50/80 text-stone-600 font-bold border-b border-stone-200/70 font-outfit">
                <th className="py-3.5 px-4">Gate</th>
                <th className="py-3.5 px-3">Type / Location</th>
                <th className="py-3.5 px-3">Status</th>
                <th className="py-3.5 px-3">Check-ins Today</th>
                <th className="py-3.5 px-3">Capacity &amp; Occupancy</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {data.gates.length > 0 ? (
                data.gates.map((gate) => (
                  <tr
                    key={gate.id}
                    className={`hover:bg-cream/40 transition-colors ${
                      !gate.isOpen ? 'bg-stone-50/50 opacity-80' : ''
                    }`}
                  >
                    {/* Gate Name & Code */}
                    <td className="py-3.5 px-4 font-bold text-ink">
                      <div className="font-outfit text-sm text-maroon font-bold">{gate.name}</div>
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono bg-stone-100 text-stone-700 mt-0.5">
                        {gate.code}
                      </span>
                    </td>

                    {/* Type / Location */}
                    <td className="py-3.5 px-3">
                      <div className="font-semibold text-stone-800">{gate.type}</div>
                      <div className="text-[11px] text-stone-400">{gate.location}</div>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            gate.isOpen
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              gate.isOpen ? 'bg-emerald-500' : 'bg-rose-500'
                            }`}
                          />
                          {gate.isOpen ? 'OPEN' : 'CLOSED'}
                        </span>
                        {gate.isCapacityReached && gate.capacityEnabled && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-rose-600 text-white uppercase">
                            FULL
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Check-ins Today */}
                    <td className="py-3.5 px-3 font-mono font-bold text-ink">
                      <span className="text-sm font-outfit text-emerald-700">
                        {gate.checkinsToday.toLocaleString()}
                      </span>
                    </td>

                    {/* Capacity & Occupancy Meter */}
                    <td className="py-3.5 px-3 min-w-[200px]">
                      {gate.capacityEnabled && gate.maximumCapacity && gate.maximumCapacity > 0 ? (
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] font-semibold text-stone-600">
                            <span>
                              {gate.checkinsToday.toLocaleString()} / {gate.maximumCapacity.toLocaleString()}
                            </span>
                            <span
                              className={`font-bold font-mono ${
                                gate.capacityPercentage >= 90
                                  ? 'text-rose-600'
                                  : gate.capacityPercentage >= 70
                                  ? 'text-amber-600'
                                  : 'text-emerald-600'
                              }`}
                            >
                              {gate.capacityPercentage}%
                            </span>
                          </div>
                          <div className="w-full bg-stone-100 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                gate.capacityPercentage >= 90
                                  ? 'bg-rose-500'
                                  : gate.capacityPercentage >= 70
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.min(100, gate.capacityPercentage)}%` }}
                            />
                          </div>
                          {gate.blockWhenFull && (
                            <span className="text-[10px] text-rose-600 font-semibold block">
                              &bull; Blocking scans when full
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-stone-400 italic">No limit set</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleToggleGateOpen(gate.id)}
                          disabled={actionLoading}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                            gate.isOpen
                              ? 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          }`}
                        >
                          {gate.isOpen ? 'Close Lane' : 'Open Lane'}
                        </button>

                        <button
                          type="button"
                          onClick={() => openCapacityModal(gate)}
                          className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-cream-soft hover:bg-stone-200 text-ink border border-stone-200 transition cursor-pointer"
                        >
                          Limits
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-stone-400">
                    No active gates configured.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. Gate Capacity Modal */}
      {activeGateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 border border-stone-200 card-shadow space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h4 className="font-outfit font-extrabold text-base text-ink">
                {activeGateModal.name} Capacity Limits
              </h4>
              <button
                type="button"
                onClick={() => setActiveGateModal(null)}
                className="text-stone-400 hover:text-stone-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveGateCapacity} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-ink mb-1">Maximum Capacity</label>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 1500"
                  value={gateCapacityForm.maximum_capacity}
                  onChange={(e) =>
                    setGateCapacityForm({ ...gateCapacityForm, maximum_capacity: e.target.value })
                  }
                  className="w-full text-xs px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-maroon font-semibold"
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-ink cursor-pointer">
                  <input
                    type="checkbox"
                    checked={gateCapacityForm.capacity_enabled}
                    onChange={(e) =>
                      setGateCapacityForm({
                        ...gateCapacityForm,
                        capacity_enabled: e.target.checked,
                      })
                    }
                    className="rounded border-stone-300 text-maroon focus:ring-maroon"
                  />
                  <span>Enable Capacity Monitoring</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-semibold text-rose-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={gateCapacityForm.block_when_full}
                    onChange={(e) =>
                      setGateCapacityForm({
                        ...gateCapacityForm,
                        block_when_full: e.target.checked,
                      })
                    }
                    className="rounded border-stone-300 text-rose-600 focus:ring-rose-500"
                  />
                  <span>Block check-ins automatically when full</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveGateModal(null)}
                  className="px-3 py-2 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-maroon text-white hover:bg-maroon-dark transition cursor-pointer"
                >
                  Save Limits
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Recent Operational Audit Logs (Latest 15) */}
      <div className="bg-white rounded-3xl border border-stone-200/80 card-shadow p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-outfit font-extrabold text-base text-ink flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-maroon" />
              <span>Recent Operational Actions</span>
            </h3>
            <p className="text-xs text-ink-soft">
              Real-time audit log of gate changes, status switches, and manual overrides.
            </p>
          </div>
          <span className="text-xs font-bold text-maroon font-outfit bg-maroon-50 px-2.5 py-1 rounded-lg border border-maroon/20">
            Latest 15 Actions
          </span>
        </div>

        <div className="space-y-2">
          {data.recentAudits.length > 0 ? (
            data.recentAudits.map((log) => {
              const isEmergency = log.action.includes('emergency');
              const isOpen = log.action.includes('open') || log.action.includes('resumed');
              return (
                <div
                  key={log.id}
                  className="p-3 rounded-xl bg-cream/40 border border-stone-200/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs"
                >
                  <div className="flex items-start sm:items-center gap-2.5 flex-wrap">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                        isEmergency
                          ? 'bg-rose-100 text-rose-800'
                          : isOpen
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-stone-100 text-stone-800'
                      }`}
                    >
                      {log.action.replace(/_/g, ' ')}
                    </span>
                    <span className="font-semibold text-ink">
                      {log.reason || 'Executed by administrator'}
                    </span>
                    {log.gateName && (
                      <span className="text-[11px] text-maroon font-bold">({log.gateName})</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-stone-400 text-[11px] shrink-0">
                    <span>
                      By: <strong className="text-stone-600">{log.userName}</strong>
                    </span>
                    <span>{formatTimeDisplay(log.createdAt)}</span>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-xs text-stone-400 italic py-2">No operational actions recorded yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

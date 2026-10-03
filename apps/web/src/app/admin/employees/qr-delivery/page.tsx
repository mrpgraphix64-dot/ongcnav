'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Mail,
  RefreshCw,
  Send,
  CheckCircle2,
  AlertCircle,
  X,
  Search,
  Filter,
  Eye,
  Printer,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Users,
  QrCode,
  Clock,
  Sparkles,
  Save,
  RotateCcw,
  Copy,
  Calendar,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import AdminModal from '@/components/admin/AdminModal';
import {
  buildDailyEmployeePassPresentation,
  DailyEmployeePassPresentation,
} from '@ongc/shared-types';
import DailyEmployeeTicketCard from '@/components/pass/DailyEmployeeTicketCard';

interface PermanentPassItem {
  id: string;
  attendeeId: string;
  attendeeName: string;
  relation: string;
  isFamily: boolean;
  employeeName: string;
  cpf: string;
  referenceNumber: string;
  department: string;
  email: string;
  phone: string;
  qrCodeToken: string;
  ticketNumber: string;
  bookingDays: string[];
  status: string;
  qrStatus: 'ACTIVE' | 'PENDING';
  emailStatus: 'PENDING' | 'SENDING' | 'SENT' | 'FAILED';
  emailSentAt: string | null;
  emailError: string | null;
  createdAt: string;
}

interface QrReleaseScheduleState {
  enabled: boolean;
  releaseDate: string;
  releaseTime: string;
  timezone: string;
  status: string;
  lastRunAt: string | null;
  lastRunMessage: string | null;
  stats: {
    eligibleCount: number;
    qrGeneratedCount: number;
    sentCount: number;
    failedCount: number;
  };
}

export default function EmployeeQrReleasePage() {
  // Statistics and release schedule
  const [schedule, setSchedule] = useState<QrReleaseScheduleState>({
    enabled: true,
    releaseDate: '2026-10-10',
    releaseTime: '10:00',
    timezone: 'Asia/Kolkata',
    status: 'IDLE',
    lastRunAt: null,
    lastRunMessage: null,
    stats: {
      eligibleCount: 0,
      qrGeneratedCount: 0,
      sentCount: 0,
      failedCount: 0,
    },
  });
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [executingAction, setExecutingAction] = useState<string | null>(null);

  // Passes table state
  const [passes, setPasses] = useState<PermanentPassItem[]>([]);
  const [passesLoading, setPassesLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [emailStatusFilter, setEmailStatusFilter] = useState('ALL');
  const [qrStatusFilter, setQrStatusFilter] = useState('ALL');

  // Messages and actions
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [viewPass, setViewPass] = useState<PermanentPassItem | null>(null);
  const [sendingSingleEmailId, setSendingSingleEmailId] = useState<string | null>(null);
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);

  // 1. Load Schedule & Stats
  const loadScheduleAndStats = useCallback(async () => {
    try {
      setScheduleLoading(true);
      const res = await fetchApi<any>('/settings/qr-release-schedule');
      if (res) {
        setSchedule({
          enabled: Boolean(res.enabled ?? true),
          releaseDate: res.releaseDate || '2026-10-10',
          releaseTime: res.releaseTime || '10:00',
          timezone: res.timezone || 'Asia/Kolkata',
          status: res.status || 'IDLE',
          lastRunAt: res.lastRunAt || null,
          lastRunMessage: res.lastRunMessage || null,
          stats: {
            eligibleCount: res.stats?.eligibleCount ?? 0,
            qrGeneratedCount: res.stats?.qrGeneratedCount ?? 0,
            sentCount: res.stats?.sentCount ?? 0,
            failedCount: res.stats?.failedCount ?? 0,
          },
        });
      }
    } catch (err: any) {
      console.error('Failed to load QR release schedule:', err);
    } finally {
      setScheduleLoading(false);
    }
  }, []);

  // 2. Load Passes
  const loadPasses = useCallback(async () => {
    try {
      setPassesLoading(true);
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '20');
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (emailStatusFilter !== 'ALL') params.set('emailStatus', emailStatusFilter);
      if (qrStatusFilter !== 'ALL') params.set('qrStatus', qrStatusFilter);

      const res = await fetchApi<{
        passes: PermanentPassItem[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      }>(`/admin/employees/qr-release/passes?${params.toString()}`);

      setPasses(res.passes || []);
      setTotalCount(res.total || 0);
      setTotalPages(res.totalPages || 1);
    } catch (err: any) {
      console.error('Failed to load permanent passes:', err);
    } finally {
      setPassesLoading(false);
    }
  }, [page, searchQuery, emailStatusFilter, qrStatusFilter]);

  useEffect(() => {
    loadScheduleAndStats();
  }, [loadScheduleAndStats]);

  useEffect(() => {
    loadPasses();
  }, [loadPasses]);

  // Handle Save Schedule
  const handleSaveSchedule = async () => {
    try {
      setSavingSchedule(true);
      await fetchApi('/settings/qr-release-schedule', {
        method: 'POST',
        body: JSON.stringify({
          enabled: schedule.enabled,
          releaseDate: schedule.releaseDate,
          releaseTime: schedule.releaseTime,
          timezone: schedule.timezone,
        }),
      });
      setActionMessage({
        type: 'success',
        text: 'Employee QR Release Schedule updated successfully.',
      });
      await loadScheduleAndStats();
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: err.message || 'Failed to update schedule.',
      });
    } finally {
      setSavingSchedule(false);
    }
  };

  // Handle Send Now / Retry Failed
  const handleExecuteRelease = async (action: 'SEND_NOW' | 'RETRY_FAILED') => {
    const isRetry = action === 'RETRY_FAILED';
    const confirmText = isRetry
      ? 'Are you sure you want to retry sending failed QR emails now?'
      : 'Are you sure you want to trigger the permanent QR release now? This will send QR emails to all eligible approved employees/family members.';

    if (!window.confirm(confirmText)) {
      return;
    }

    try {
      setExecutingAction(action);
      const res = await fetchApi<any>('/settings/qr-release-schedule/execute', {
        method: 'POST',
        body: JSON.stringify({ action }),
      });
      setActionMessage({
        type: 'success',
        text: res.message || `Permanent QR Release (${action}) executed successfully.`,
      });
      await loadScheduleAndStats();
      await loadPasses();
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: err.message || `Failed to execute ${action}.`,
      });
    } finally {
      setExecutingAction(null);
    }
  };

  // Handle Individual Email Send
  const handleSendSingleEmail = async (attendeeId: string) => {
    try {
      setSendingSingleEmailId(attendeeId);
      await fetchApi('/admin/employees/qr-release/send-email', {
        method: 'POST',
        body: JSON.stringify({ attendeeId }),
      });
      setActionMessage({
        type: 'success',
        text: 'Permanent entry pass email dispatched successfully.',
      });
      await loadScheduleAndStats();
      await loadPasses();
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: err.message || 'Failed to dispatch pass email.',
      });
    } finally {
      setSendingSingleEmailId(null);
    }
  };

  // Copy token to clipboard
  const handleCopyToken = (token: string, id: string) => {
    navigator.clipboard.writeText(token);
    setCopiedTokenId(id);
    setTimeout(() => setCopiedTokenId(null), 2000);
  };

  // Format booking days
  const formatDaysDisplay = (days: string[]) => {
    if (!days || days.length === 0) return 'None';
    if (days.length >= 9) return 'All 9 Days (11–19 Oct)';
    return days
      .map((d) => {
        const parts = d.split('-');
        if (parts.length === 3) {
          const dt = new Date(`${d}T00:00:00`);
          return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        }
        return d;
      })
      .join(', ');
  };

  return (
    <div className="space-y-5">
      {/* HEADER */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-maroon-soft text-maroon">
              <QrCode className="w-5 h-5" />
            </span>
            <h1 className="font-cinzel text-xl sm:text-2xl font-bold text-ink">
              EMPLOYEE QR RELEASE
            </h1>
          </div>
          <p className="text-xs text-ink-soft max-w-2xl leading-relaxed">
            One permanent QR is issued to each approved employee/family member and remains valid for all selected event dates.
            The server verifies entry date-by-date at the turnstiles.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => {
              loadScheduleAndStats();
              loadPasses();
            }}
            className="p-2.5 rounded-xl border border-stone-200 hover:bg-stone-50 text-stone-600 transition-colors shadow-2xs"
            title="Refresh statistics and passes"
          >
            <RefreshCw className={`w-4 h-4 ${scheduleLoading || passesLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ACTION BANNER */}
      {actionMessage && (
        <div
          className={`py-3 px-4 rounded-xl border text-xs font-semibold flex items-center justify-between gap-3 ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{actionMessage.text}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="text-stone-400 hover:text-ink cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* UNIFIED METRIC CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Eligible */}
        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-ink-soft uppercase tracking-wider block">
              Eligible
            </span>
            <span className="font-outfit font-black text-2xl text-ink leading-none block">
              {scheduleLoading ? '—' : schedule.stats.eligibleCount.toLocaleString()}
            </span>
            <span className="text-[10px] text-stone-400">Approved attendees</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center text-stone-600">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* QR Generated */}
        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">
              QR Generated
            </span>
            <span className="font-outfit font-black text-2xl text-purple-700 leading-none block">
              {scheduleLoading ? '—' : schedule.stats.qrGeneratedCount.toLocaleString()}
            </span>
            <span className="text-[10px] text-purple-400">Permanent tokens</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
            <QrCode className="w-5 h-5" />
          </div>
        </div>

        {/* Emails Sent */}
        <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-xs flex items-center justify-between bg-emerald-50/20">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
              Emails Sent
            </span>
            <span className="font-outfit font-black text-2xl text-emerald-700 leading-none block">
              {scheduleLoading ? '—' : schedule.stats.sentCount.toLocaleString()}
            </span>
            <span className="text-[10px] text-emerald-500">Delivered passes</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-100/60 flex items-center justify-center text-emerald-700">
            <Mail className="w-5 h-5" />
          </div>
        </div>

        {/* Failed */}
        <div className="bg-white p-4 rounded-2xl border border-rose-200 shadow-xs flex items-center justify-between bg-rose-50/20">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider block">
              Failed
            </span>
            <span className="font-outfit font-black text-2xl text-rose-700 leading-none block">
              {scheduleLoading ? '—' : schedule.stats.failedCount.toLocaleString()}
            </span>
            <span className="text-[10px] text-rose-500">Delivery errors</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-100/60 flex items-center justify-center text-rose-700">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* RELEASE SCHEDULE CARD */}
      <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-maroon" />
            <h2 className="font-cinzel font-bold text-base text-ink tracking-wide">
              RELEASE SCHEDULE
            </h2>
          </div>

          {/* Status Badge */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
              Status:
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border ${
                schedule.status === 'COMPLETED'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : schedule.status === 'RUNNING'
                  ? 'bg-blue-50 text-blue-800 border-blue-200 animate-pulse'
                  : schedule.status === 'PARTIAL_FAILURE' || schedule.status === 'FAILED'
                  ? 'bg-rose-50 text-rose-800 border-rose-200'
                  : 'bg-stone-100 text-stone-700 border-stone-200'
              }`}
            >
              {schedule.status}
            </span>
          </div>
        </div>

        {/* Schedule Inputs & Actions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          {/* Automatic Release Toggle */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-stone-600 uppercase tracking-wider block">
              Automatic Release
            </label>
            <button
              type="button"
              onClick={() => setSchedule((s) => ({ ...s, enabled: !s.enabled }))}
              className={`w-full py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                schedule.enabled
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-2xs'
                  : 'bg-stone-100 border-stone-300 text-stone-600'
              }`}
            >
              <span>{schedule.enabled ? 'Automatic: ON' : 'Automatic: OFF'}</span>
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  schedule.enabled ? 'bg-emerald-600' : 'bg-stone-400'
                }`}
              />
            </button>
          </div>

          {/* Release Date */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-stone-600 uppercase tracking-wider block">
              Release Date (YYYY-MM-DD)
            </label>
            <input
              type="date"
              value={schedule.releaseDate}
              onChange={(e) => setSchedule((s) => ({ ...s, releaseDate: e.target.value }))}
              className="w-full py-2 px-3 rounded-xl border border-stone-200 text-xs font-bold text-ink focus:border-maroon focus:outline-hidden"
            />
          </div>

          {/* Release Time & Timezone */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-stone-600 uppercase tracking-wider block">
              Release Time (IST)
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="time"
                value={schedule.releaseTime}
                onChange={(e) => setSchedule((s) => ({ ...s, releaseTime: e.target.value }))}
                className="w-full py-2 px-3 rounded-xl border border-stone-200 text-xs font-bold text-ink focus:border-maroon focus:outline-hidden"
              />
              <span className="text-[10px] font-bold text-stone-400 uppercase shrink-0">
                IST
              </span>
            </div>
          </div>

          {/* Save Schedule Button */}
          <div>
            <button
              type="button"
              onClick={handleSaveSchedule}
              disabled={savingSchedule}
              className="w-full py-2 px-4 rounded-xl bg-stone-900 hover:bg-black text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <Save className={`w-3.5 h-3.5 ${savingSchedule ? 'animate-spin' : ''}`} />
              <span>{savingSchedule ? 'Saving...' : 'SAVE SCHEDULE'}</span>
            </button>
          </div>
        </div>

        {/* Action Controls: Send Now & Retry Failed */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-stone-100">
          <div className="text-xs text-stone-500">
            {schedule.lastRunAt ? (
              <span>
                Last execution: <strong>{new Date(schedule.lastRunAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</strong>
                {schedule.lastRunMessage && ` &bull; ${schedule.lastRunMessage}`}
              </span>
            ) : (
              <span>No execution has taken place yet.</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleExecuteRelease('SEND_NOW')}
              disabled={executingAction !== null}
              className="py-2 px-4 rounded-xl bg-maroon hover:bg-maroon-dark text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <Send className={`w-3.5 h-3.5 ${executingAction === 'SEND_NOW' ? 'animate-spin' : ''}`} />
              <span>SEND NOW</span>
            </button>

            {schedule.stats.failedCount > 0 && (
              <button
                type="button"
                onClick={() => handleExecuteRelease('RETRY_FAILED')}
                disabled={executingAction !== null}
                className="py-2 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${executingAction === 'RETRY_FAILED' ? 'animate-spin' : ''}`} />
                <span>RETRY FAILED ({schedule.stats.failedCount})</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* PASSES LIST SECTION */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden space-y-4 p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-cinzel font-bold text-base text-ink">
              APPROVED ATTENDEES &amp; PERMANENT PASSES
            </h3>
            <p className="text-xs text-stone-500">
              Each approved attendee holds a single permanent QR token valid for all registered dates.
            </p>
          </div>

          {/* FILTERS */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search name, CPF, ref no..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-stone-200 text-xs focus:border-maroon focus:outline-hidden"
              />
            </div>

            <select
              value={emailStatusFilter}
              onChange={(e) => {
                setEmailStatusFilter(e.target.value);
                setPage(1);
              }}
              className="py-1.5 px-3 rounded-xl border border-stone-200 text-xs font-semibold focus:border-maroon focus:outline-hidden bg-white"
            >
              <option value="ALL">All Email Status</option>
              <option value="SENT">Sent</option>
              <option value="PENDING">Pending</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>
        </div>

        {/* TABLE */}
        <div className="overflow-x-auto border border-stone-200 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 text-stone-600 font-bold uppercase tracking-wider text-[10px] border-b border-stone-200">
              <tr>
                <th className="py-2.5 px-3">Attendee &amp; Role</th>
                <th className="py-2.5 px-3">Primary / Ref No.</th>
                <th className="py-2.5 px-3">Permanent QR Token</th>
                <th className="py-2.5 px-3">Registered Dates</th>
                <th className="py-2.5 px-3 text-center">QR Status</th>
                <th className="py-2.5 px-3 text-center">Email Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {passesLoading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-stone-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-maroon" />
                    <span>Loading permanent passes...</span>
                  </td>
                </tr>
              ) : passes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-stone-400">
                    No approved attendees found matching criteria.
                  </td>
                </tr>
              ) : (
                passes.map((p) => {
                  const hasToken = Boolean(p.qrCodeToken && p.qrCodeToken.trim() !== '');
                  return (
                    <tr key={p.id} className="hover:bg-stone-50/60 transition-colors">
                      {/* Attendee & Role */}
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-ink">{p.attendeeName}</div>
                        <div className="text-[10px] text-stone-500 flex items-center gap-1.5 mt-0.5">
                          <span className="font-semibold text-maroon">{p.relation}</span>
                          <span>&bull;</span>
                          <span>{p.email || p.phone || 'No direct contact'}</span>
                        </div>
                      </td>

                      {/* Primary / Ref No */}
                      <td className="py-2.5 px-3">
                        <div className="font-mono font-bold text-maroon">{p.referenceNumber}</div>
                        <div className="text-[10px] text-stone-500">
                          {p.employeeName} (CPF: {p.cpf})
                        </div>
                      </td>

                      {/* Permanent QR Token */}
                      <td className="py-2.5 px-3 font-mono">
                        {hasToken ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-stone-700 bg-stone-100 px-2 py-0.5 rounded border border-stone-200">
                              {p.qrCodeToken.substring(0, 10)}...{p.qrCodeToken.substring(p.qrCodeToken.length - 6)}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyToken(p.qrCodeToken, p.id)}
                              className="text-stone-400 hover:text-ink cursor-pointer"
                              title="Copy permanent QR token"
                            >
                              {copiedTokenId === p.id ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-stone-400 italic">Auto-generated on release</span>
                        )}
                      </td>

                      {/* Registered Booking Days */}
                      <td className="py-2.5 px-3">
                        <span className="text-[11px] font-semibold text-stone-800">
                          {formatDaysDisplay(p.bookingDays)}
                        </span>
                        <div className="text-[10px] text-stone-400">
                          {p.bookingDays.length} day(s) authorized
                        </div>
                      </td>

                      {/* QR Status */}
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                            p.qrStatus === 'ACTIVE'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : 'bg-stone-100 text-stone-600 border-stone-200'
                          }`}
                        >
                          {p.qrStatus}
                        </span>
                      </td>

                      {/* Email Status */}
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                            p.emailStatus === 'SENT'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : p.emailStatus === 'FAILED'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                          title={p.emailError || undefined}
                        >
                          {p.emailStatus}
                        </span>
                        {p.emailSentAt && (
                          <div className="text-[9px] text-stone-400 mt-0.5">
                            {new Date(p.emailSentAt).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setViewPass(p)}
                            className="p-1.5 rounded-lg border border-stone-200 hover:bg-stone-100 text-stone-700 transition-colors shadow-2xs"
                            title="Preview Permanent Pass"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSendSingleEmail(p.attendeeId)}
                            disabled={sendingSingleEmailId === p.attendeeId}
                            className="p-1.5 rounded-lg border border-maroon/30 bg-maroon/5 hover:bg-maroon/10 text-maroon transition-colors shadow-2xs disabled:opacity-50"
                            title={p.emailStatus === 'SENT' ? 'Resend Pass Email' : 'Send Pass Email'}
                          >
                            <Send className={`w-3.5 h-3.5 ${sendingSingleEmailId === p.attendeeId ? 'animate-spin' : ''}`} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-500 pt-2">
          <div>
            Showing <strong>{passes.length}</strong> of <strong>{totalCount}</strong> permanent passes
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-2.5 py-1 rounded-lg border border-stone-200 bg-white font-bold disabled:opacity-40 cursor-pointer"
              >
                Previous
              </button>
              <span>
                Page <strong>{page}</strong> of <strong>{totalPages}</strong>
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-2.5 py-1 rounded-lg border border-stone-200 bg-white font-bold disabled:opacity-40 cursor-pointer"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      {/* VIEW PERMANENT PASS MODAL */}
      {viewPass && (() => {
        const firstDate = viewPass.bookingDays[0] || '2026-10-11';
        const presentation: DailyEmployeePassPresentation = buildDailyEmployeePassPresentation({
          eventDate: firstDate,
          ticketNumber: viewPass.ticketNumber,
          qrToken: viewPass.qrCodeToken,
          status: viewPass.status,
          attendeeName: viewPass.attendeeName,
          isFamily: viewPass.isFamily,
          relation: viewPass.relation,
          employeeName: viewPass.employeeName,
          employeeCpf: viewPass.cpf,
          department: viewPass.department,
        });

        return (
          <AdminModal
            isOpen={!!viewPass}
            onClose={() => setViewPass(null)}
            title="Official Permanent Entry Pass"
          >
            <div className="space-y-4 p-1">
              <DailyEmployeeTicketCard
                presentation={presentation}
              />

              <div className="pt-2 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl bg-gold text-maroon-deep font-bold text-xs hover:bg-gold-light transition-all flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Pass</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewPass(null)}
                  className="px-4 py-2 rounded-xl border border-stone-200 text-xs font-bold text-ink hover:bg-stone-100"
                >
                  Close
                </button>
              </div>
            </div>
          </AdminModal>
        );
      })()}
    </div>
  );
}

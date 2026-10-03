'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Users,
  QrCode,
  Clock,
  Save,
  RotateCcw,
  Copy,
  Info,
  ExternalLink,
  ShieldAlert,
  Flame,
  Check,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import AdminModal from '@/components/admin/AdminModal';
import {
  buildDailyEmployeePassPresentation,
  DailyEmployeePassPresentation,
  EmployeeQrEmailDeliveryItem,
  EmailDeliveryStatus,
  SponsorVoucherConfig,
  DEFAULT_SPONSOR_VOUCHER_CONFIG,
} from '@ongc/shared-types';
import DailyEmployeeTicketCard from '@/components/pass/DailyEmployeeTicketCard';
import { Gift, Sparkles } from 'lucide-react';

interface QrReleaseScheduleState {
  enabled: boolean;
  releaseDate: string;
  releaseTime: string;
  timezone: string;
  status: string;
  lastRunAt: string | null;
  lastRunMessage: string | null;
  currentReleaseId?: string | null;
  stats: {
    eligibleCount: number;
    qrGeneratedCount: number;
    queuedCount?: number;
    sendingCount?: number;
    acceptedCount?: number;
    deliveredCount?: number;
    failedCount: number;
    bouncedCount?: number;
    sentCount: number;
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
      queuedCount: 0,
      sendingCount: 0,
      acceptedCount: 0,
      deliveredCount: 0,
      failedCount: 0,
      bouncedCount: 0,
      sentCount: 0,
    },
  });
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [executingAction, setExecutingAction] = useState<string | null>(null);

  // Deliveries table state
  const [deliveries, setDeliveries] = useState<EmployeeQrEmailDeliveryItem[]>([]);
  const [deliveriesLoading, setDeliveriesLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [personTypeFilter, setPersonTypeFilter] = useState('ALL');

  // Messages and modals
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [selectedDelivery, setSelectedDelivery] = useState<EmployeeQrEmailDeliveryItem | null>(null);
  const [viewPassModal, setViewPassModal] = useState<EmployeeQrEmailDeliveryItem | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Sponsor voucher state
  const [voucherConfig, setVoucherConfig] = useState<SponsorVoucherConfig>(DEFAULT_SPONSOR_VOUCHER_CONFIG);
  const [voucherLoading, setVoucherLoading] = useState(true);
  const [updatingVoucher, setUpdatingVoucher] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewSubject, setPreviewSubject] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Load Sponsor Voucher Config
  const loadSponsorVoucher = useCallback(async () => {
    try {
      setVoucherLoading(true);
      const res = await fetchApi<SponsorVoucherConfig>('/admin/employees/qr-release/sponsor-voucher');
      if (res) {
        setVoucherConfig(res);
      }
    } catch (err: any) {
      console.error('Failed to load sponsor voucher configuration:', err);
    } finally {
      setVoucherLoading(false);
    }
  }, []);

  const handleToggleVoucher = async () => {
    const nextState = !voucherConfig.enabled;
    try {
      setUpdatingVoucher(true);
      const res = await fetchApi<SponsorVoucherConfig>('/admin/employees/qr-release/sponsor-voucher', {
        method: 'POST',
        body: JSON.stringify({ enabled: nextState }),
      });
      if (res) {
        setVoucherConfig(res);
      } else {
        setVoucherConfig((prev) => ({ ...prev, enabled: nextState }));
      }
      setActionMessage({
        type: 'success',
        text: `Sponsor gift voucher ${nextState ? 'ENABLED' : 'DISABLED'} successfully.`,
      });
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: err.message || 'Failed to update sponsor voucher status.',
      });
    } finally {
      setUpdatingVoucher(false);
    }
  };

  const handleOpenPreview = async () => {
    try {
      setPreviewLoading(true);
      setShowPreviewModal(true);
      const res = await fetchApi<{ subject: string; html: string; text: string }>(
        '/admin/employees/qr-release/preview-email',
      );
      if (res) {
        setPreviewSubject(res.subject || 'Pass Preview');
        setPreviewHtml(res.html || '');
      }
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: err.message || 'Failed to fetch email preview.',
      });
      setShowPreviewModal(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Confirmation dialogs
  const [confirmModal, setConfirmModal] = useState<{
    type: 'SEND_NOW' | 'RETRY_FAILED';
    isOpen: boolean;
  } | null>(null);

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
          currentReleaseId: res.currentReleaseId || null,
          stats: {
            eligibleCount: res.stats?.eligibleCount ?? 0,
            qrGeneratedCount: res.stats?.qrGeneratedCount ?? 0,
            queuedCount: res.stats?.queuedCount ?? 0,
            sendingCount: res.stats?.sendingCount ?? 0,
            acceptedCount: res.stats?.acceptedCount ?? 0,
            deliveredCount: res.stats?.deliveredCount ?? 0,
            failedCount: res.stats?.failedCount ?? 0,
            bouncedCount: res.stats?.bouncedCount ?? 0,
            sentCount: res.stats?.sentCount ?? 0,
          },
        });
      }
    } catch (err: any) {
      console.error('Failed to load QR release schedule:', err);
    } finally {
      setScheduleLoading(false);
    }
  }, []);

  // 2. Load Deliveries List
  const loadDeliveries = useCallback(async () => {
    try {
      setDeliveriesLoading(true);
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '20');
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (personTypeFilter !== 'ALL') params.set('personType', personTypeFilter);

      const res = await fetchApi<{
        deliveries: EmployeeQrEmailDeliveryItem[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      }>(`/admin/employees/qr-release/deliveries?${params.toString()}`);

      setDeliveries(res.deliveries || []);
      setTotalCount(res.total || 0);
      setTotalPages(res.totalPages || 1);
    } catch (err: any) {
      console.error('Failed to load deliveries:', err);
    } finally {
      setDeliveriesLoading(false);
    }
  }, [page, searchQuery, statusFilter, personTypeFilter]);

  useEffect(() => {
    loadScheduleAndStats();
  }, [loadScheduleAndStats]);

  useEffect(() => {
    loadSponsorVoucher();
  }, [loadSponsorVoucher]);

  useEffect(() => {
    loadDeliveries();
  }, [loadDeliveries]);

  // Polling when release is running
  useEffect(() => {
    if (schedule.status === 'RUNNING' || executingAction) {
      const interval = setInterval(() => {
        loadScheduleAndStats();
        loadDeliveries();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [schedule.status, executingAction, loadScheduleAndStats, loadDeliveries]);

  // Save Schedule
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

  // Trigger Release
  const handleExecuteRelease = async (action: 'SEND_NOW' | 'RETRY_FAILED') => {
    setConfirmModal(null);
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
      await loadDeliveries();
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: err.message || `Failed to execute ${action}.`,
      });
    } finally {
      setExecutingAction(null);
    }
  };

  // Retry individual delivery
  const handleRetrySingle = async (deliveryId: string) => {
    try {
      setRetryingId(deliveryId);
      const res = await fetchApi<any>(`/admin/employees/qr-release/deliveries/${deliveryId}/retry`, {
        method: 'POST',
      });
      if (res.success) {
        setActionMessage({ type: 'success', text: res.message || 'Retry email dispatched.' });
      } else {
        setActionMessage({ type: 'error', text: res.message || 'Retry failed.' });
      }
      await loadScheduleAndStats();
      await loadDeliveries();
      if (selectedDelivery && selectedDelivery.id === deliveryId) {
        setSelectedDelivery(null);
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to retry email.' });
    } finally {
      setRetryingId(null);
    }
  };

  // Send Test Email
  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmailAddress.trim() || !testEmailAddress.includes('@')) {
      setActionMessage({ type: 'error', text: 'Please enter a valid administrator email address.' });
      return;
    }
    try {
      setSendingTestEmail(true);
      const res = await fetchApi<any>('/admin/employees/qr-release/send-test-email', {
        method: 'POST',
        body: JSON.stringify({ testEmail: testEmailAddress.trim() }),
      });
      if (res.success) {
        setActionMessage({ type: 'success', text: res.message });
        setTestEmailAddress('');
      } else {
        setActionMessage({ type: 'error', text: res.message });
      }
      await loadScheduleAndStats();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to dispatch test email.' });
    } finally {
      setSendingTestEmail(false);
    }
  };

  // Copy helper
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Format Status Badge
  const getStatusBadge = (status: EmailDeliveryStatus | string) => {
    switch (status) {
      case 'DELIVERED':
        return 'bg-emerald-50 text-emerald-800 border-emerald-300';
      case 'ACCEPTED':
        return 'bg-blue-50 text-blue-800 border-blue-300';
      case 'SENDING':
        return 'bg-amber-50 text-amber-800 border-amber-300 animate-pulse';
      case 'QUEUED':
        return 'bg-stone-100 text-stone-700 border-stone-300';
      case 'FAILED':
        return 'bg-rose-50 text-rose-800 border-rose-300';
      case 'BOUNCED':
        return 'bg-orange-50 text-orange-800 border-orange-300';
      case 'REJECTED':
        return 'bg-purple-50 text-purple-800 border-purple-300';
      default:
        return 'bg-stone-100 text-stone-700 border-stone-200';
    }
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
            Server authorizes entry date-by-date at the gate turnstiles.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => {
              loadScheduleAndStats();
              loadDeliveries();
            }}
            className="p-2.5 rounded-xl border border-stone-200 hover:bg-stone-50 text-stone-600 transition-colors shadow-2xs cursor-pointer"
            title="Refresh statistics and deliveries"
          >
            <RefreshCw className={`w-4 h-4 ${scheduleLoading || deliveriesLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ACTION BANNER */}
      {actionMessage && (
        <div
          className={`py-3 px-4 rounded-xl border text-xs font-semibold flex items-center justify-between gap-3 ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : actionMessage.type === 'info'
              ? 'bg-blue-50 border-blue-200 text-blue-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : actionMessage.type === 'info' ? (
              <Info className="w-4 h-4 text-blue-600 shrink-0" />
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

      {/* TOP METRICS: COMPACT 8-METRIC GRID */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
        {/* Eligible */}
        <div className="bg-white p-3 rounded-xl border border-stone-200 shadow-2xs">
          <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">Eligible</span>
          <span className="font-outfit font-black text-xl text-ink leading-none mt-1 block">
            {scheduleLoading ? '—' : schedule.stats.eligibleCount.toLocaleString()}
          </span>
          <span className="text-[9px] text-stone-400 mt-0.5 block">Approved</span>
        </div>

        {/* QR Generated */}
        <div className="bg-white p-3 rounded-xl border border-purple-200 bg-purple-50/20 shadow-2xs">
          <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">QR Generated</span>
          <span className="font-outfit font-black text-xl text-purple-700 leading-none mt-1 block">
            {scheduleLoading ? '—' : schedule.stats.qrGeneratedCount.toLocaleString()}
          </span>
          <span className="text-[9px] text-purple-400 mt-0.5 block">Permanent</span>
        </div>

        {/* Queued */}
        <div className="bg-white p-3 rounded-xl border border-stone-200 shadow-2xs">
          <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">Queued</span>
          <span className="font-outfit font-black text-xl text-stone-700 leading-none mt-1 block">
            {scheduleLoading ? '—' : (schedule.stats.queuedCount ?? 0).toLocaleString()}
          </span>
          <span className="text-[9px] text-stone-400 mt-0.5 block">Pending</span>
        </div>

        {/* Sending */}
        <div className="bg-white p-3 rounded-xl border border-amber-200 bg-amber-50/20 shadow-2xs">
          <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">Sending</span>
          <span className="font-outfit font-black text-xl text-amber-700 leading-none mt-1 block">
            {scheduleLoading ? '—' : (schedule.stats.sendingCount ?? 0).toLocaleString()}
          </span>
          <span className="text-[9px] text-amber-400 mt-0.5 block">In transit</span>
        </div>

        {/* Accepted */}
        <div className="bg-white p-3 rounded-xl border border-blue-200 bg-blue-50/20 shadow-2xs">
          <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">Accepted</span>
          <span className="font-outfit font-black text-xl text-blue-700 leading-none mt-1 block">
            {scheduleLoading ? '—' : (schedule.stats.acceptedCount ?? 0).toLocaleString()}
          </span>
          <span className="text-[9px] text-blue-400 mt-0.5 block">Hostinger OK</span>
        </div>

        {/* Delivered */}
        <div className="bg-white p-3 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-2xs">
          <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Delivered</span>
          <span className="font-outfit font-black text-xl text-emerald-700 leading-none mt-1 block">
            {scheduleLoading ? '—' : (schedule.stats.deliveredCount ?? 0).toLocaleString()}
          </span>
          <span className="text-[9px] text-emerald-500 mt-0.5 block">Confirmed</span>
        </div>

        {/* Failed */}
        <div className="bg-white p-3 rounded-xl border border-rose-200 bg-rose-50/20 shadow-2xs">
          <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider block">Failed</span>
          <span className="font-outfit font-black text-xl text-rose-700 leading-none mt-1 block">
            {scheduleLoading ? '—' : schedule.stats.failedCount.toLocaleString()}
          </span>
          <span className="text-[9px] text-rose-500 mt-0.5 block">Retryable</span>
        </div>

        {/* Bounced */}
        <div className="bg-white p-3 rounded-xl border border-orange-200 bg-orange-50/20 shadow-2xs">
          <span className="text-[10px] font-bold text-orange-800 uppercase tracking-wider block">Bounced</span>
          <span className="font-outfit font-black text-xl text-orange-700 leading-none mt-1 block">
            {scheduleLoading ? '—' : (schedule.stats.bouncedCount ?? 0).toLocaleString()}
          </span>
          <span className="text-[9px] text-orange-500 mt-0.5 block">Hard/Soft</span>
        </div>
      </div>

      {/* PROVIDER CAPABILITY CALLOUT */}
      <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-3 text-xs text-amber-900 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong>Configured Email Provider: Hostinger Mail API.</strong> Outbound sends return HTTP 204 and are marked{' '}
          <span className="font-bold uppercase text-blue-700">PROVIDER ACCEPTED</span>. Terminal{' '}
          <span className="font-bold uppercase text-emerald-700">DELIVERED</span> or{' '}
          <span className="font-bold uppercase text-rose-700">FAILED</span> statuses are verified through Hostinger Outbound Delivery Logs reconciliation (or mailbox webhooks). If Hostinger logs have not recorded delivery yet, status remains honestly displayed as <strong>PROVIDER ACCEPTED</strong>.
        </div>
      </div>

      {/* RELEASE CONTROLS & SCHEDULE */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-maroon" />
            <h2 className="font-cinzel font-bold text-base text-ink tracking-wide">
              RELEASE SCHEDULE &amp; EXECUTION
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Status:</span>
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

        {/* Schedule Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
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
              <span className={`w-2.5 h-2.5 rounded-full ${schedule.enabled ? 'bg-emerald-600' : 'bg-stone-400'}`} />
            </button>
          </div>

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
              <span className="text-[10px] font-bold text-stone-400 uppercase shrink-0">IST</span>
            </div>
          </div>

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

        {/* Action Buttons: Send Now & Retry Failed */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-stone-100">
          <div className="text-xs text-stone-500">
            {schedule.lastRunAt ? (
              <span>
                Last execution: <strong>{new Date(schedule.lastRunAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</strong>
                {schedule.lastRunMessage && ` • ${schedule.lastRunMessage}`}
              </span>
            ) : (
              <span>No execution has taken place yet.</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirmModal({ type: 'SEND_NOW', isOpen: true })}
              disabled={executingAction !== null}
              className="py-2 px-4 rounded-xl bg-maroon hover:bg-maroon-dark text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <Send className={`w-3.5 h-3.5 ${executingAction === 'SEND_NOW' ? 'animate-spin' : ''}`} />
              <span>SEND NOW</span>
            </button>

            {schedule.stats.failedCount > 0 && (
              <button
                type="button"
                onClick={() => setConfirmModal({ type: 'RETRY_FAILED', isOpen: true })}
                disabled={executingAction !== null}
                className="py-2 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${executingAction === 'RETRY_FAILED' ? 'animate-spin' : ''}`} />
                <span>RETRY FAILED ({schedule.stats.failedCount})</span>
              </button>
            )}
          </div>
        </div>

        {/* SEND TEST EMAIL BOX & SPONSOR CONTROLS */}
        <div className="pt-3 border-t border-stone-100 space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <form onSubmit={handleSendTestEmail} className="flex flex-col sm:flex-row items-center gap-2">
              <div className="text-xs text-stone-600 font-bold whitespace-nowrap">Send Test Pass:</div>
              <input
                type="email"
                placeholder="admin@ongc.co.in"
                value={testEmailAddress}
                onChange={(e) => setTestEmailAddress(e.target.value)}
                className="py-1.5 px-3 rounded-xl border border-stone-200 text-xs w-full sm:w-64 focus:border-maroon focus:outline-hidden"
              />
              <button
                type="submit"
                disabled={sendingTestEmail || !testEmailAddress.trim()}
                className="py-1.5 px-3 rounded-xl border border-stone-300 hover:bg-stone-100 text-xs font-bold text-stone-700 transition-colors disabled:opacity-40 cursor-pointer shrink-0"
              >
                {sendingTestEmail ? 'Sending...' : 'Send Test Email'}
              </button>
              <span className="text-[10px] text-stone-400">Isolated (isTest=true, never affects production metrics)</span>
            </form>

            {/* PREVIEW PASS EMAIL BUTTON */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleOpenPreview}
                disabled={previewLoading}
                className="py-1.5 px-3.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <Eye className="w-3.5 h-3.5 text-amber-700" />
                <span>{previewLoading ? 'Loading Preview...' : 'Preview Email Template'}</span>
              </button>
            </div>
          </div>

          {/* COMPACT SPONSOR OFFER STATUS CHIP & TOGGLE */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-2.5 rounded-xl bg-linear-to-r from-amber-50/60 via-stone-50 to-amber-50/40 border border-amber-200/80">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white border border-amber-200 text-[11px] font-bold">
                <Gift className="w-3.5 h-3.5 text-maroon" />
                <span className="text-stone-500 uppercase tracking-wider text-[10px]">SPONSOR OFFER:</span>
                <span
                  className={`inline-flex items-center gap-1 font-extrabold uppercase text-[10px] ${
                    voucherConfig.enabled ? 'text-emerald-700' : 'text-stone-400'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${voucherConfig.enabled ? 'bg-emerald-600' : 'bg-stone-400'}`}
                  />
                  {voucherConfig.enabled ? 'ENABLED' : 'DISABLED'}
                </span>
              </div>

              <div className="text-xs text-stone-700 font-semibold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>
                  <strong className="text-maroon font-bold">{voucherConfig.sponsorName}</strong>
                  {' — '}
                  <span className="text-amber-800 font-bold">{voucherConfig.offerHeadline} {voucherConfig.offerSubtext}</span>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleToggleVoucher}
                disabled={updatingVoucher || voucherLoading}
                className={`py-1 px-3 rounded-lg text-xs font-bold transition-all border cursor-pointer flex items-center gap-1.5 ${
                  voucherConfig.enabled
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                    : 'bg-white text-stone-600 border-stone-300 hover:bg-stone-50'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${voucherConfig.enabled ? 'bg-emerald-600' : 'bg-stone-400'}`} />
                <span>{updatingVoucher ? 'Updating...' : voucherConfig.enabled ? 'Voucher Active' : 'Enable Voucher'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* DELIVERIES TABLE SECTION */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden space-y-4 p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-cinzel font-bold text-base text-ink">
              EMAIL DELIVERY MONITORING
            </h3>
            <p className="text-xs text-stone-500">
              Complete visibility into recipient email states, provider acceptance, and error classifications.
            </p>
          </div>

          {/* FILTERS */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search name, ref no, email, msg ID..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-stone-200 text-xs focus:border-maroon focus:outline-hidden"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="py-1.5 px-3 rounded-xl border border-stone-200 text-xs font-semibold focus:border-maroon focus:outline-hidden bg-white"
            >
              <option value="ALL">All Statuses</option>
              <option value="QUEUED">Queued</option>
              <option value="SENDING">Sending</option>
              <option value="ACCEPTED">Accepted</option>
              <option value="DELIVERED">Delivered</option>
              <option value="FAILED">Failed</option>
              <option value="BOUNCED">Bounced</option>
              <option value="REJECTED">Rejected</option>
            </select>

            <select
              value={personTypeFilter}
              onChange={(e) => {
                setPersonTypeFilter(e.target.value);
                setPage(1);
              }}
              className="py-1.5 px-3 rounded-xl border border-stone-200 text-xs font-semibold focus:border-maroon focus:outline-hidden bg-white"
            >
              <option value="ALL">All Types</option>
              <option value="EMPLOYEE">Employees Only</option>
              <option value="FAMILY">Family Members Only</option>
            </select>
          </div>
        </div>

        {/* TABLE */}
        <div className="overflow-x-auto border border-stone-200 rounded-xl">
          <table className="w-full text-left text-xs text-stone-700">
            <thead className="bg-stone-50 text-[10px] uppercase font-bold text-stone-500 tracking-wider border-b border-stone-200">
              <tr>
                <th className="py-2.5 px-3">Recipient</th>
                <th className="py-2.5 px-3">Ref No.</th>
                <th className="py-2.5 px-3">Person</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Provider</th>
                <th className="py-2.5 px-3">Sent / Accepted</th>
                <th className="py-2.5 px-3">Retries</th>
                <th className="py-2.5 px-3">Error / Reason</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 font-medium">
              {deliveriesLoading ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-stone-400">
                    <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2" />
                    Loading email deliveries...
                  </td>
                </tr>
              ) : deliveries.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-stone-400">
                    No email deliveries found matching current filters.
                  </td>
                </tr>
              ) : (
                deliveries.map((d) => (
                  <tr key={d.id} className="hover:bg-stone-50/80 transition-colors">
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-ink">{d.attendeeName}</div>
                      <div className="text-[11px] text-stone-500 font-mono">{d.recipientEmail}</div>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] font-bold text-maroon">
                      {d.referenceNumber}
                    </td>
                    <td className="py-2.5 px-3 text-stone-600">
                      {d.isFamily ? `${d.relation} of ${d.employeeName}` : 'Employee (Self)'}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${d.isFamily ? 'bg-amber-50 text-amber-800' : 'bg-stone-100 text-stone-700'}`}>
                        {d.isFamily ? 'Family' : 'Employee'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusBadge(d.status)}`}>
                        {d.status === 'ACCEPTED' ? 'PROVIDER ACCEPTED' : d.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[10px] text-stone-500">
                      {d.provider}
                    </td>
                    <td className="py-2.5 px-3 text-[11px] text-stone-600">
                      {d.acceptedAt ? new Date(d.acceptedAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-center">
                      {d.retryCount}
                    </td>
                    <td className="py-2.5 px-3 max-w-xs truncate text-[11px] text-rose-700" title={d.lastError || undefined}>
                      {d.lastError || '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedDelivery(d)}
                          className="p-1.5 rounded-lg border border-stone-200 hover:bg-stone-100 text-stone-700 shadow-2xs cursor-pointer"
                          title="View Delivery Details & Error Log"
                        >
                          <Info className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewPassModal(d)}
                          className="p-1.5 rounded-lg border border-stone-200 hover:bg-stone-100 text-stone-700 shadow-2xs cursor-pointer"
                          title="Preview Permanent Pass"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {(d.status === 'FAILED' || d.status === 'BOUNCED') && (
                          <button
                            type="button"
                            onClick={() => handleRetrySingle(d.id)}
                            disabled={retryingId === d.id}
                            className="p-1.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 shadow-2xs cursor-pointer disabled:opacity-50"
                            title="Retry Email"
                          >
                            <RotateCcw className={`w-3.5 h-3.5 ${retryingId === d.id ? 'animate-spin' : ''}`} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-500 pt-2">
          <div>
            Showing <strong>{deliveries.length}</strong> of <strong>{totalCount}</strong> email delivery records
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

      {/* ERROR / DELIVERY DETAILS MODAL */}
      {selectedDelivery && (
        <AdminModal
          isOpen={!!selectedDelivery}
          onClose={() => setSelectedDelivery(null)}
          title="Email Delivery Details"
        >
          <div className="space-y-4 text-xs">
            <div className="bg-stone-50 p-3.5 rounded-xl border border-stone-200 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-stone-500 uppercase font-bold block">Recipient</span>
                  <span className="font-bold text-ink">{selectedDelivery.attendeeName}</span>
                  <span className="block font-mono text-[11px] text-stone-600">{selectedDelivery.recipientEmail}</span>
                </div>
                <div>
                  <span className="text-[10px] text-stone-500 uppercase font-bold block">Reference No.</span>
                  <span className="font-mono font-bold text-maroon">{selectedDelivery.referenceNumber}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-stone-200">
                <div>
                  <span className="text-[10px] text-stone-500 uppercase font-bold block">Status</span>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusBadge(selectedDelivery.status)}`}>
                    {selectedDelivery.status}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-stone-500 uppercase font-bold block">Retry Count</span>
                  <span className="font-bold">{selectedDelivery.retryCount} / {selectedDelivery.maxRetries}</span>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] text-stone-500 uppercase font-bold block">Lifecycle Timestamps</span>
              <div className="grid grid-cols-2 gap-2 bg-white p-3 rounded-xl border border-stone-200 font-mono text-[11px]">
                <div>Queued: {selectedDelivery.queuedAt ? new Date(selectedDelivery.queuedAt).toLocaleString('en-IN') : '—'}</div>
                <div>Started: {selectedDelivery.startedAt ? new Date(selectedDelivery.startedAt).toLocaleString('en-IN') : '—'}</div>
                <div>Accepted: {selectedDelivery.acceptedAt ? new Date(selectedDelivery.acceptedAt).toLocaleString('en-IN') : '—'}</div>
                <div>Delivered: {selectedDelivery.deliveredAt ? new Date(selectedDelivery.deliveredAt).toLocaleString('en-IN') : '—'}</div>
              </div>
            </div>

            {selectedDelivery.lastError && (
              <div className="space-y-1.5">
                <span className="text-[10px] text-rose-700 uppercase font-bold block">Error Classification</span>
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1 text-rose-900">
                  <div className="font-bold">{selectedDelivery.errorType || 'UNKNOWN_ERROR'}</div>
                  <div>{selectedDelivery.lastError}</div>
                  {selectedDelivery.lastProviderError && (
                    <div className="text-[10px] text-rose-700 font-mono mt-1 pt-1 border-t border-rose-200">
                      Provider Error: {selectedDelivery.lastProviderError}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => copyToClipboard(selectedDelivery.lastError || selectedDelivery.recipientEmail)}
                className="px-3 py-1.5 rounded-xl border border-stone-200 text-stone-700 hover:bg-stone-50 font-bold flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copiedText ? 'Copied' : 'Copy Error Details'}</span>
              </button>

              <div className="flex items-center gap-2">
                {(selectedDelivery.status === 'FAILED' || selectedDelivery.status === 'BOUNCED') && (
                  <button
                    type="button"
                    onClick={() => handleRetrySingle(selectedDelivery.id)}
                    disabled={retryingId === selectedDelivery.id}
                    className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Retry Email</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedDelivery(null)}
                  className="px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-black text-white font-bold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </AdminModal>
      )}

      {/* VIEW PASS MODAL */}
      {viewPassModal && (() => {
        const firstDate = viewPassModal.bookingDays[0] || '2026-10-11';
        const presentation: DailyEmployeePassPresentation = buildDailyEmployeePassPresentation({
          eventDate: firstDate,
          ticketNumber: viewPassModal.ticketNumber,
          qrToken: viewPassModal.qrCodeToken,
          status: 'ACTIVE',
          attendeeName: viewPassModal.attendeeName,
          isFamily: viewPassModal.isFamily,
          relation: viewPassModal.relation,
          employeeName: viewPassModal.employeeName,
          employeeCpf: viewPassModal.cpf,
          department: '',
        });

        return (
          <AdminModal
            isOpen={!!viewPassModal}
            onClose={() => setViewPassModal(null)}
            title="Official Permanent Entry Pass"
          >
            <div className="space-y-4 p-1">
              <DailyEmployeeTicketCard presentation={presentation} />
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
                  onClick={() => setViewPassModal(null)}
                  className="px-4 py-2 rounded-xl border border-stone-200 text-xs font-bold text-ink hover:bg-stone-100"
                >
                  Close
                </button>
              </div>
            </div>
          </AdminModal>
        );
      })()}

      {/* CONFIRMATION MODAL: SEND NOW / RETRY FAILED */}
      {confirmModal && (
        <AdminModal
          isOpen={confirmModal.isOpen}
          onClose={() => setConfirmModal(null)}
          title={confirmModal.type === 'SEND_NOW' ? 'Release Employee QR Emails?' : 'Retry Failed Emails?'}
        >
          <div className="space-y-4 text-xs">
            <p className="text-stone-600 leading-relaxed">
              {confirmModal.type === 'SEND_NOW'
                ? 'This will send the permanent QR email to all eligible approved employees and family members who have not already received a successful release.'
                : 'This will re-attempt delivery for all failed or bounced email addresses up to the retry limit.'}
            </p>

            <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 space-y-1 font-medium">
              <div className="flex justify-between">
                <span>Total Eligible:</span>
                <span className="font-bold">{schedule.stats.eligibleCount}</span>
              </div>
              <div className="flex justify-between">
                <span>Already Delivered / Accepted:</span>
                <span className="font-bold text-emerald-700">{schedule.stats.sentCount}</span>
              </div>
              <div className="flex justify-between">
                <span>Failed / Retryable:</span>
                <span className="font-bold text-rose-700">{schedule.stats.failedCount}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 rounded-xl border border-stone-200 text-stone-700 hover:bg-stone-50 font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleExecuteRelease(confirmModal.type)}
                disabled={executingAction !== null}
                className="px-4 py-2 rounded-xl bg-maroon hover:bg-maroon-dark text-white font-bold"
              >
                {confirmModal.type === 'SEND_NOW' ? 'Start Release' : 'Retry Failed'}
              </button>
            </div>
          </div>
        </AdminModal>
      )}
      {/* EMAIL PREVIEW MODAL */}
      {showPreviewModal && (
        <AdminModal
          isOpen={showPreviewModal}
          onClose={() => setShowPreviewModal(false)}
          title="Permanent Pass Email Template Preview"
          subtitle={previewSubject || 'Subject preview'}
          maxWidth="4xl"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-stone-600 bg-stone-50 p-2.5 rounded-xl border border-stone-200">
              <div>
                <span className="font-bold text-ink">Subject:</span>{' '}
                <span className="font-mono text-stone-700">{previewSubject || 'Loading subject...'}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[10px] uppercase font-bold text-stone-400">Voucher Status:</span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    voucherConfig.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-700'
                  }`}
                >
                  {voucherConfig.enabled ? 'Voucher Enabled' : 'Voucher Disabled'}
                </span>
              </div>
            </div>

            {previewLoading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-2 text-stone-500">
                <RefreshCw className="w-6 h-6 animate-spin text-maroon" />
                <span className="text-xs font-medium">Generating email preview...</span>
              </div>
            ) : previewHtml ? (
              <div className="rounded-xl border border-stone-300 overflow-hidden bg-white shadow-inner max-h-[70vh] overflow-y-auto">
                <iframe
                  title="Email Preview"
                  srcDoc={previewHtml}
                  className="w-full min-h-[680px] border-none"
                  sandbox="allow-same-origin"
                />
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-stone-500">No preview HTML available.</div>
            )}

            <div className="flex justify-end pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="px-4 py-2 rounded-xl bg-stone-900 hover:bg-black text-white text-xs font-bold transition-all cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </AdminModal>
      )}
    </div>
  );
}

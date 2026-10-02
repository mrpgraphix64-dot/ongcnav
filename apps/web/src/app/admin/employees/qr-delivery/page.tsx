'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Calendar,
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
  ChevronDown,
  ShieldCheck,
  Users,
  QrCode,
  ArrowRight,
  Clock,
  Layers,
  Sparkles,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import AdminModal from '@/components/admin/AdminModal';
import {
  OFFICIAL_EVENT_DATES,
  getEventDayTheme,
  buildDailyEmployeePassPresentation,
  EmployeeDispatchSchedule,
} from '@ongc/shared-types';
import DailyEmployeeTicketCard from '@/components/pass/DailyEmployeeTicketCard';

interface DeliveryStats {
  eventDate: string;
  eligibleCount: number;
  generatedCount: number;
  sentCount: number;
  failedCount: number;
  pendingCount: number;
  checkedInCount: number;
}

interface DailyPassItem {
  id: string;
  attendeeId: string;
  eventDate: string;
  ticketNumber: string;
  qrToken: string;
  qrSvg: string | null;
  attendeeName: string;
  relation: string;
  isFamily: boolean;
  employeeName: string;
  cpf: string;
  department: string;
  email: string;
  phone: string;
  status: string;
  lifecycleStatus?: 'ELIGIBLE' | 'PASS_GENERATED' | 'EMAIL_SENT' | 'EMAIL_FAILED' | 'CHECKED_IN' | string;
  emailStatus: 'PENDING' | 'SENDING' | 'SENT' | 'FAILED';
  emailSentAt: string | null;
  emailError: string | null;
  checkedInAt: string | null;
  createdAt: string;
}

export default function DailyQrDeliveryPage() {
  const [selectedDate, setSelectedDate] = useState<string>(OFFICIAL_EVENT_DATES[0]);
  const [stats, setStats] = useState<DeliveryStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [passes, setPasses] = useState<DailyPassItem[]>([]);
  const [passesLoading, setPassesLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [searchQuery, setSearchQuery] = useState('');
  const [emailStatusFilter, setEmailStatusFilter] = useState('ALL');
  const [passStatusFilter, setPassStatusFilter] = useState('ALL');

  const [generating, setGenerating] = useState(false);
  const [sendingEmails, setSendingEmails] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [viewPass, setViewPass] = useState<DailyPassItem | null>(null);

  // Dispatch schedule state
  const [schedule, setSchedule] = useState<EmployeeDispatchSchedule | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleTime, setScheduleTime] = useState('17:00');
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);

  // Collapsible panels state (default collapsed for operational compactness)
  const [scheduleExpanded, setScheduleExpanded] = useState(false);
  const [manualActionsExpanded, setManualActionsExpanded] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  // Active date tracking to prevent out-of-order race conditions
  const activeDateRef = React.useRef(selectedDate);
  useEffect(() => {
    activeDateRef.current = selectedDate;
  }, [selectedDate]);

  // Load stats for current selected date
  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const data = await fetchApi<DeliveryStats>(`/admin/employees/daily-passes/stats?date=${selectedDate}`);
      setStats(data);
    } catch (err: any) {
      console.error('Failed to load stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, [selectedDate]);

  // Load schedule for current selected date
  const loadSchedule = useCallback(async () => {
    const targetDate = selectedDate;
    setScheduleLoading(true);
    setScheduleError(null);
    try {
      const res = await fetchApi<{
        schedule?: EmployeeDispatchSchedule | null;
        defaultDispatchTime?: string;
        dispatchTime?: string;
        enabled?: boolean;
      }>(`/admin/employees/daily-passes/dispatch-schedule?date=${targetDate}`);

      // Avoid overwriting if user already switched date
      if (activeDateRef.current !== targetDate) {
        return;
      }

      // Check whether response was { schedule } or direct object
      const loadedSchedule =
        res && 'schedule' in res
          ? res.schedule
          : res && typeof res === 'object' && 'dispatchTime' in res
          ? (res as unknown as EmployeeDispatchSchedule)
          : null;

      const fallbackTime = res?.defaultDispatchTime || '17:00';

      if (loadedSchedule) {
        setSchedule(loadedSchedule);
        setScheduleTime(loadedSchedule.dispatchTime || fallbackTime);
        setScheduleEnabled(Boolean(loadedSchedule.enabled));
      } else {
        // No schedule configured yet
        setSchedule(null);
        setScheduleTime(fallbackTime);
        setScheduleEnabled(false);
      }
    } catch (err: any) {
      if (activeDateRef.current === targetDate) {
        console.error('Failed to load dispatch schedule:', err);
        setScheduleError(err.message || 'Failed to load schedule');
        setSchedule(null);
      }
    } finally {
      if (activeDateRef.current === targetDate) {
        setScheduleLoading(false);
      }
    }
  }, [selectedDate]);

  // Load passes list
  const loadPasses = useCallback(async () => {
    setPassesLoading(true);
    try {
      const params = new URLSearchParams({
        date: selectedDate,
        page: page.toString(),
        limit: '20',
      });
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      if (emailStatusFilter !== 'ALL') params.append('emailStatus', emailStatusFilter);
      if (passStatusFilter !== 'ALL') params.append('status', passStatusFilter);

      const res = await fetchApi<{
        passes: DailyPassItem[];
        total: number;
        page: number;
        totalPages: number;
      }>(`/admin/employees/daily-passes?${params.toString()}`);

      setPasses(res.passes || []);
      setTotalCount(res.total || 0);
      setTotalPages(res.totalPages || 1);
    } catch (err: any) {
      console.error('Failed to load passes:', err);
    } finally {
      setPassesLoading(false);
    }
  }, [selectedDate, page, searchQuery, emailStatusFilter, passStatusFilter]);

  useEffect(() => {
    loadStats();
    loadPasses();
    loadSchedule();
  }, [loadStats, loadPasses, loadSchedule]);

  // Generate passes for selected date
  const handleGeneratePasses = async () => {
    setGenerating(true);
    setActionMessage(null);
    try {
      const res = await fetchApi<{
        success: boolean;
        message: string;
        generatedCount: number;
        existingCount: number;
      }>('/admin/employees/daily-passes/generate', {
        method: 'POST',
        body: JSON.stringify({ eventDate: selectedDate }),
      });
      setActionMessage({ type: 'success', text: res.message });
      await loadStats();
      await loadPasses();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to generate passes' });
    } finally {
      setGenerating(false);
    }
  };

  // Send emails
  const handleSendEmails = async (retryFailedOnly: boolean = false) => {
    setSendingEmails(true);
    setActionMessage(null);
    try {
      const res = await fetchApi<{
        success: boolean;
        message: string;
        sentCount: number;
        failedCount: number;
      }>('/admin/employees/daily-passes/send-emails', {
        method: 'POST',
        body: JSON.stringify({ eventDate: selectedDate, retryFailedOnly }),
      });
      setActionMessage({ type: 'success', text: res.message });
      await loadStats();
      await loadPasses();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to dispatch emails' });
    } finally {
      setSendingEmails(false);
    }
  };

  const formatDateDisplay = (iso: string) => {
    const d = new Date(`${iso}T00:00:00`);
    return d.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  };

  const formatTimeTo12Hour = (timeStr: string) => {
    if (!timeStr) return '';
    const [hStr, mStr] = timeStr.split(':');
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    if (isNaN(h) || isNaN(m)) return timeStr;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    const minuteStr = m < 10 ? `0${m}` : `${m}`;
    return `${hour12}:${minuteStr} ${ampm}`;
  };

  // Save schedule for selected date
  const handleSaveSchedule = async () => {
    setSavingSchedule(true);
    try {
      const res = await fetchApi<{
        success?: boolean;
        message?: string;
        schedule?: EmployeeDispatchSchedule;
        dispatchTime?: string;
        enabled?: boolean;
      }>(
        '/admin/employees/daily-passes/dispatch-schedule',
        {
          method: 'POST',
          body: JSON.stringify({
            eventDate: selectedDate,
            dispatchTime: scheduleTime,
            enabled: scheduleEnabled,
          }),
        }
      );

      const savedSchedule =
        res && 'schedule' in res && res.schedule
          ? res.schedule
          : res && typeof res === 'object' && 'dispatchTime' in res
          ? (res as unknown as EmployeeDispatchSchedule)
          : null;

      if (savedSchedule) {
        setSchedule(savedSchedule);
        setScheduleTime(savedSchedule.dispatchTime);
        setScheduleEnabled(Boolean(savedSchedule.enabled));
        setActionMessage({
          type: 'success',
          text: `Dispatch schedule for ${formatDateDisplay(selectedDate)} saved: ${
            savedSchedule.enabled ? 'ON' : 'OFF'
          } at ${formatTimeTo12Hour(savedSchedule.dispatchTime)} IST.`,
        });
      } else {
        const fallbackSched: EmployeeDispatchSchedule = {
          eventDate: selectedDate,
          dispatchTime: scheduleTime,
          timezone: 'Asia/Kolkata',
          enabled: scheduleEnabled,
          updatedAt: new Date().toISOString(),
        };
        setSchedule(fallbackSched);
        setActionMessage({
          type: 'success',
          text: `Dispatch schedule for ${formatDateDisplay(selectedDate)} saved: ${
            scheduleEnabled ? 'ON' : 'OFF'
          } at ${formatTimeTo12Hour(scheduleTime)} IST.`,
        });
      }
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: err.message || 'Failed to save dispatch schedule',
      });
    } finally {
      setSavingSchedule(false);
    }
  };

  const getNextDispatchDisplay = () => {
    if (scheduleLoading) {
      return {
        statusText: 'Loading schedule configuration...',
        colorClass: 'text-stone-500',
        badgeClass: 'bg-stone-100 text-stone-600 border-stone-200',
      };
    }

    if (scheduleError) {
      return {
        statusText: `Error loading schedule: ${scheduleError}`,
        colorClass: 'text-rose-600',
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
      };
    }

    // No schedule saved in database yet
    if (!schedule) {
      return {
        statusText: 'Automatic dispatch is not configured for this date.',
        colorClass: 'text-stone-500',
        badgeClass: 'bg-stone-100 text-stone-600 border-stone-200',
      };
    }

    // Saved schedule exists, but is disabled
    if (!scheduleEnabled) {
      return {
        statusText: 'Automatic dispatch is disabled for this date.',
        colorClass: 'text-stone-500',
        badgeClass: 'bg-stone-100 text-stone-600 border-stone-200',
      };
    }

    // Saved schedule is enabled — check execution state
    if (schedule.lastRunStatus === 'RUNNING') {
      return {
        statusText: 'Automatic dispatch is currently running...',
        colorClass: 'text-blue-700 animate-pulse',
        badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
      };
    }

    if (schedule.lastRunStatus === 'SUCCESS' && schedule.lastRunAt) {
      const runDate = new Date(schedule.lastRunAt);
      const runTimeStr = runDate.toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
      return {
        statusText: `Automatic dispatch completed at ${runTimeStr} IST (${schedule.lastRunMessage || 'Dispatched successfully'}).`,
        colorClass: 'text-emerald-700',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      };
    }

    if (schedule.lastRunStatus === 'PARTIAL_FAILURE') {
      return {
        statusText: `Automatic dispatch partially failed: ${schedule.lastFailedCount || 0} email(s) failed.`,
        colorClass: 'text-amber-700',
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
      };
    }

    if (schedule.lastRunStatus === 'FAILED') {
      return {
        statusText: `Automatic dispatch execution failed: ${schedule.lastRunMessage || 'Check server logs'}.`,
        colorClass: 'text-rose-700',
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
      };
    }

    // Scheduled, has not run yet — compare selectedDate with current IST date
    const d = new Date(`${selectedDate}T00:00:00`);
    const dayName = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
    const timeFormatted = formatTimeTo12Hour(scheduleTime);

    // Compute current IST date string (YYYY-MM-DD)
    const istParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const istYear = istParts.find((p) => p.type === 'year')?.value || '';
    const istMonth = istParts.find((p) => p.type === 'month')?.value || '';
    const istDay = istParts.find((p) => p.type === 'day')?.value || '';
    const currentIstDate = `${istYear}-${istMonth}-${istDay}`;

    if (selectedDate === currentIstDate) {
      return {
        statusText: `Automatic dispatch scheduled for Today at ${timeFormatted} IST.`,
        colorClass: 'text-emerald-800 font-bold',
        badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      };
    } else if (selectedDate < currentIstDate) {
      return {
        statusText: `Event date has passed (${formatDateDisplay(selectedDate)}).`,
        colorClass: 'text-stone-500',
        badgeClass: 'bg-stone-100 text-stone-600 border-stone-200',
      };
    }

    return {
      statusText: `Automatic dispatch scheduled for ${dayName} at ${timeFormatted} IST.`,
      colorClass: 'text-amber-800',
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    };
  };

  return (
    <div className="space-y-3">
      {/* ACTION BANNER */}
      {actionMessage && (
        <div
          className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2.5 ${
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

      {/* 1. COMPACT EVENT DATE SELECTOR TABS */}
      <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-stone-200/80 shadow-2xs space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-ink uppercase tracking-wider">
            <Calendar className="w-3.5 h-3.5 text-maroon" />
            <span>Official Event Nights</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Auto-Dispatch Pill */}
            <div
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border transition-colors ${
                scheduleLoading
                  ? 'bg-stone-100 text-stone-500 border-stone-200'
                  : scheduleError
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : !schedule
                  ? 'bg-stone-100 text-stone-600 border-stone-200'
                  : scheduleEnabled
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-stone-100 text-stone-600 border-stone-200'
              }`}
            >
              <Clock className={`w-3 h-3 ${scheduleLoading ? 'animate-spin' : ''}`} />
              <span>
                {scheduleLoading
                  ? 'Auto: Loading...'
                  : scheduleError
                  ? 'Auto: Error'
                  : !schedule
                  ? 'Auto: Not Configured'
                  : scheduleEnabled
                  ? `Auto: ON (${formatTimeTo12Hour(schedule.dispatchTime || scheduleTime)} IST)`
                  : 'Auto: OFF'}
              </span>
            </div>

            {/* Night Theme Badge */}
            {(() => {
              const currentTheme = getEventDayTheme(selectedDate);
              return (
                <div
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border transition-colors"
                  style={{
                    backgroundColor: currentTheme.bgColor,
                    borderColor: `${currentTheme.primaryColor}40`,
                    color: currentTheme.primaryColor,
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: currentTheme.secondaryColor }}
                  />
                  <span>Night {currentTheme.dayNumber} &bull; {currentTheme.themeTitle}</span>
                </div>
              );
            })()}
          </div>
        </div>

        {/* 9 Event Date Buttons (Shorter height) */}
        <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-1.5">
          {OFFICIAL_EVENT_DATES.map((d, idx) => {
            const isSelected = selectedDate === d;
            const theme = getEventDayTheme(d);
            return (
              <button
                key={d}
                type="button"
                onClick={() => {
                  setSelectedDate(d);
                  setPage(1);
                  setActionMessage(null);
                }}
                style={
                  isSelected
                    ? {
                        backgroundColor: theme.primaryColor,
                        borderColor: theme.primaryColor,
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.18)',
                      }
                    : {
                        backgroundColor: theme.bgColor,
                        borderColor: `${theme.primaryColor}38`,
                      }
                }
                className={`py-1.5 px-2 rounded-lg border text-center transition-all cursor-pointer ${
                  isSelected ? 'scale-[1.02]' : 'hover:scale-[1.01]'
                }`}
              >
                <div
                  className="text-[9px] uppercase font-bold tracking-wider"
                  style={{
                    color: isSelected ? theme.secondaryColor : theme.primaryColor,
                  }}
                >
                  Night {idx + 1}
                </div>
                <div
                  className={`font-outfit font-black text-xs leading-tight mt-0.5 ${
                    isSelected ? 'text-white' : 'text-stone-800'
                  }`}
                >
                  {formatDateDisplay(d)}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. COMPACT STATS STRIP FOR SELECTED DATE */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {/* Eligible */}
        <div className="bg-white py-2 px-3 rounded-xl border border-stone-200/80 shadow-2xs flex items-center justify-between min-h-[55px]">
          <span className="text-[10px] font-bold text-ink-soft uppercase tracking-wider">Eligible</span>
          <span className="font-outfit font-black text-xl text-ink leading-none">
            {statsLoading ? '—' : stats?.eligibleCount.toLocaleString() ?? 0}
          </span>
        </div>

        {/* Generated */}
        <div className="bg-white py-2 px-3 rounded-xl border border-stone-200/80 shadow-2xs flex items-center justify-between min-h-[55px]">
          <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider">Generated</span>
          <span className="font-outfit font-black text-xl text-purple-700 leading-none">
            {statsLoading ? '—' : stats?.generatedCount.toLocaleString() ?? 0}
          </span>
        </div>

        {/* Sent */}
        <div className="bg-emerald-50/40 py-2 px-3 rounded-xl border border-emerald-200/80 shadow-2xs flex items-center justify-between min-h-[55px]">
          <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Emails Sent</span>
          <span className="font-outfit font-black text-xl text-emerald-700 leading-none">
            {statsLoading ? '—' : stats?.sentCount.toLocaleString() ?? 0}
          </span>
        </div>

        {/* Failed */}
        <div className="bg-rose-50/40 py-2 px-3 rounded-xl border border-rose-200/80 shadow-2xs flex items-center justify-between min-h-[55px]">
          <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider">Failed</span>
          <span className="font-outfit font-black text-xl text-rose-700 leading-none">
            {statsLoading ? '—' : stats?.failedCount.toLocaleString() ?? 0}
          </span>
        </div>

        {/* Pending */}
        <div className="bg-amber-50/40 py-2 px-3 rounded-xl border border-amber-200/80 shadow-2xs flex items-center justify-between min-h-[55px]">
          <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Pending</span>
          <span className="font-outfit font-black text-xl text-amber-700 leading-none">
            {statsLoading ? '—' : stats?.pendingCount.toLocaleString() ?? 0}
          </span>
        </div>

        {/* Scans */}
        <div className="bg-blue-50/40 py-2 px-3 rounded-xl border border-blue-200/80 shadow-2xs flex items-center justify-between min-h-[55px]">
          <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">Gate Scans</span>
          <span className="font-outfit font-black text-xl text-blue-700 leading-none">
            {statsLoading ? '—' : stats?.checkedInCount.toLocaleString() ?? 0}
          </span>
        </div>
      </div>

      {/* 3, 4, 5. COLLAPSIBLE CONTROLS STRIP (SCHEDULE, MANUAL ACTIONS, FILTERS) */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-white px-3 py-2 rounded-xl border border-stone-200/80 shadow-2xs">
        <div className="flex items-center gap-2 flex-wrap">
          {/* QR Dispatch Schedule Accordion Button */}
          <button
            type="button"
            onClick={() => setScheduleExpanded((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
              scheduleExpanded
                ? 'bg-maroon text-white border-maroon shadow-2xs'
                : scheduleEnabled
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
            }`}
          >
            <Clock className={`w-3.5 h-3.5 ${scheduleLoading ? 'animate-spin' : ''}`} />
            <span>
              QR DISPATCH SCHEDULE &bull;{' '}
              {scheduleLoading
                ? 'Loading...'
                : scheduleError
                ? 'Error'
                : !schedule
                ? 'Not Configured'
                : scheduleEnabled
                ? `ON &bull; ${formatTimeTo12Hour(schedule.dispatchTime || scheduleTime)}`
                : 'OFF'}
            </span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${scheduleExpanded ? 'rotate-180' : ''}`} />
          </button>

          {/* Manual Actions Accordion Button */}
          <button
            type="button"
            onClick={() => setManualActionsExpanded((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
              manualActionsExpanded
                ? 'bg-stone-800 text-white border-stone-800 shadow-2xs'
                : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-gold-deep" />
            <span>MANUAL ACTIONS</span>
            {stats && (stats.pendingCount > 0 || stats.failedCount > 0) && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            )}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${manualActionsExpanded ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Search & Filters Accordion Button */}
        {(() => {
          const hasActiveFilters = searchQuery.trim() !== '' || emailStatusFilter !== 'ALL' || passStatusFilter !== 'ALL';
          return (
            <button
              type="button"
              onClick={() => setFiltersExpanded((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                filtersExpanded || hasActiveFilters
                  ? 'bg-maroon/10 text-maroon border-maroon/40 shadow-2xs'
                  : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>SEARCH &amp; FILTERS</span>
              {hasActiveFilters && (
                <span className="w-2 h-2 rounded-full bg-maroon shrink-0" />
              )}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${filtersExpanded ? 'rotate-180' : ''}`} />
            </button>
          );
        })()}
      </div>

      {/* EXPANDED: QR DISPATCH SCHEDULE CONFIGURATION */}
      {scheduleExpanded && (
        <div className="bg-white p-4 rounded-xl border border-stone-200/90 shadow-xs space-y-3 animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b border-stone-100 pb-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-maroon" />
              <h3 className="font-outfit font-black text-xs text-ink tracking-tight uppercase">
                QR Dispatch Schedule Configuration &bull; {formatDateDisplay(selectedDate)}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setScheduleExpanded(false)}
              className="text-stone-400 hover:text-ink text-xs font-bold cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-end">
            {/* Event Date */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-ink-soft uppercase tracking-wider">
                Event Date
              </label>
              <div className="py-1.5 px-2.5 rounded-lg border border-stone-200 bg-stone-50 font-outfit font-black text-xs text-ink flex items-center justify-between">
                <span>{formatDateDisplay(selectedDate)}</span>
                <span className="text-[10px] text-ink-soft font-normal">{selectedDate}</span>
              </div>
            </div>

            {/* Automatic Dispatch Toggle */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-ink-soft uppercase tracking-wider">
                Automatic Dispatch
              </label>
              <div className="p-0.5 rounded-lg border border-stone-200 bg-stone-50 flex items-center">
                <button
                  type="button"
                  disabled={scheduleLoading}
                  onClick={() => setScheduleEnabled(true)}
                  className={`flex-1 py-1 rounded text-xs font-bold transition-all cursor-pointer disabled:opacity-50 ${
                    scheduleEnabled
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-stone-600 hover:text-ink'
                  }`}
                >
                  ON
                </button>
                <button
                  type="button"
                  disabled={scheduleLoading}
                  onClick={() => setScheduleEnabled(false)}
                  className={`flex-1 py-1 rounded text-xs font-bold transition-all cursor-pointer disabled:opacity-50 ${
                    !scheduleEnabled
                      ? 'bg-stone-600 text-white shadow-2xs'
                      : 'text-stone-600 hover:text-ink'
                  }`}
                >
                  OFF
                </button>
              </div>
            </div>

            {/* Dispatch Time */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-ink-soft uppercase tracking-wider">
                Dispatch Time
              </label>
              <input
                type="time"
                value={scheduleTime}
                disabled={scheduleLoading}
                onChange={(e) => setScheduleTime(e.target.value)}
                className="w-full py-1.5 px-2 rounded-lg border border-stone-200 bg-white font-outfit font-bold text-xs text-ink focus:outline-none focus:ring-1 focus:ring-maroon cursor-pointer disabled:opacity-50"
              />
            </div>

            {/* Timezone (Read-only) */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-ink-soft uppercase tracking-wider">
                Timezone
              </label>
              <div className="py-1.5 px-2.5 rounded-lg border border-stone-200 bg-stone-50 font-mono text-xs text-ink font-semibold flex items-center justify-between">
                <span>Asia/Kolkata</span>
                <span className="text-stone-500 font-sans font-bold">(IST)</span>
              </div>
            </div>
          </div>

          {/* Next Dispatch Status Banner & Save Schedule Button */}
          {(() => {
            const nextDispatch = getNextDispatchDisplay();
            return (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2 border-t border-stone-100 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-ink-soft">Next Dispatch:</span>
                  <span className={`font-semibold ${nextDispatch.colorClass}`}>
                    {nextDispatch.statusText}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleSaveSchedule}
                  disabled={savingSchedule || scheduleLoading}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-lg bg-maroon text-white text-xs font-bold hover:bg-maroon-dark transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
                >
                  {savingSchedule ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  <span>Save Schedule</span>
                </button>
              </div>
            );
          })()}
        </div>
      )}

      {/* EXPANDED: MANUAL ACTIONS PANEL */}
      {manualActionsExpanded && (
        <div className="bg-gradient-to-r from-cream-light to-white p-3.5 rounded-xl border border-gold/40 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 animate-in fade-in duration-150">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-stone-200 text-stone-700">
                Admin Override
              </span>
              <h3 className="font-outfit font-extrabold text-xs text-ink flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-maroon" />
                <span>Manual Actions for {formatDateDisplay(selectedDate)}</span>
              </h3>
            </div>
            <p className="text-[11px] text-ink-soft mt-0.5">
              Deliveries are idempotent. Use manual buttons for immediate generation or emailing.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleGeneratePasses}
              disabled={generating}
              className="px-3 py-1.5 rounded-lg bg-maroon text-white font-bold text-xs hover:bg-maroon-dark transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {generating ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <QrCode className="w-3.5 h-3.5 text-gold-light" />
              )}
              <span>1. Generate Today's Passes</span>
            </button>

            <button
              type="button"
              onClick={() => handleSendEmails(false)}
              disabled={sendingEmails || (stats?.pendingCount === 0 && stats?.failedCount === 0)}
              className="px-3 py-1.5 rounded-lg bg-gold text-maroon-deep font-extrabold text-xs hover:bg-gold-light transition-all shadow-2xs flex items-center gap-1.5 border border-maroon/20 cursor-pointer disabled:opacity-50"
            >
              {sendingEmails ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>2. Send QR Pass Emails</span>
            </button>

            {stats && stats.failedCount > 0 && (
              <button
                type="button"
                onClick={() => handleSendEmails(true)}
                disabled={sendingEmails}
                className="px-3 py-1.5 rounded-lg bg-rose-100 text-rose-800 border border-rose-300 font-bold text-xs hover:bg-rose-200 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Retry {stats.failedCount} Failed</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setManualActionsExpanded(false)}
              className="p-1 text-stone-400 hover:text-ink cursor-pointer ml-1"
              title="Collapse"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* EXPANDED: SEARCH & FILTERS ROW */}
      {filtersExpanded && (
        <div className="bg-white p-3 rounded-xl border border-stone-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 animate-in fade-in duration-150">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search Attendee Name, Employee CPF, Email, Ticket..."
              className="w-full pl-9 pr-7 py-1.5 rounded-lg border border-stone-200 text-xs focus:outline-none focus:border-maroon bg-cream/30"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-ink cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1 text-xs">
              <span className="text-ink-soft text-[11px] font-bold">Email:</span>
              <select
                value={emailStatusFilter}
                onChange={(e) => {
                  setEmailStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="bg-transparent border-none text-xs font-bold text-ink focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Delivery States</option>
                <option value="SENT">Sent</option>
                <option value="FAILED">Failed</option>
                <option value="PENDING">Pending</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1 text-xs">
              <span className="text-ink-soft text-[11px] font-bold">Status:</span>
              <select
                value={passStatusFilter}
                onChange={(e) => {
                  setPassStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="bg-transparent border-none text-xs font-bold text-ink focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Attendees &amp; Passes</option>
                <option value="ELIGIBLE">Eligible (Pass Not Generated)</option>
                <option value="PASS_GENERATED">Pass Generated (Email Pending)</option>
                <option value="EMAIL_SENT">Email Sent</option>
                <option value="EMAIL_FAILED">Email Failed</option>
                <option value="CHECKED_IN">Checked In</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setEmailStatusFilter('ALL');
                setPassStatusFilter('ALL');
                setPage(1);
              }}
              className="px-2 py-1 text-[11px] font-bold text-stone-500 hover:text-maroon transition-colors cursor-pointer"
            >
              Reset
            </button>

            <button
              type="button"
              onClick={() => setFiltersExpanded(false)}
              className="p-1 text-stone-400 hover:text-ink cursor-pointer"
              title="Collapse Filters"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 6. COMPACT ELIGIBILITY NOTICE */}
      {stats && stats.eligibleCount > 0 && stats.generatedCount === 0 && (
        <div className="py-2 px-3.5 bg-amber-50/90 border border-amber-300/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-amber-900 shadow-2xs min-h-[46px]">
          <div className="flex items-center gap-2 truncate">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
            <div className="truncate">
              <strong>{stats.eligibleCount} approved attendees</strong> eligible for {formatDateDisplay(selectedDate)}.
              <span className="text-stone-600 ml-1">Daily passes have not yet been generated.</span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleGeneratePasses}
            disabled={generating}
            className="px-3 py-1 bg-maroon hover:bg-maroon-dark text-white font-bold text-xs rounded-lg transition-all shrink-0 shadow-2xs cursor-pointer disabled:opacity-50"
          >
            {generating ? 'Generating...' : 'Generate Passes'}
          </button>
        </div>
      )}

      {/* PASSES DATA TABLE */}
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-stone-50/80 border-b border-stone-200/70 text-ink-soft uppercase text-[10px] font-bold tracking-wider">
                <th className="py-2 px-3 font-bold">Attendee</th>
                <th className="py-2 px-3 font-bold">Role / Family</th>
                <th className="py-2 px-3 font-bold">Employee &amp; CPF</th>
                <th className="py-2 px-3 font-bold">Recipient Email</th>
                <th className="py-2 px-3 font-bold">Email Status</th>
                <th className="py-2 px-3 font-bold">Pass Status</th>
                <th className="py-2 px-3 font-bold">Check-in</th>
                <th className="py-2 px-3 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {passesLoading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-ink-soft">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-maroon mb-2" />
                    <span>Loading daily passes...</span>
                  </td>
                </tr>
              ) : passes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-ink-soft">
                    <QrCode className="w-7 h-7 text-stone-300 mx-auto mb-1.5" />
                    <p className="font-semibold text-ink text-xs sm:text-sm">No attendees found matching filter for this date</p>
                    <p className="text-[11px] text-ink-soft mt-0.5">
                      {stats && stats.eligibleCount > 0
                        ? `Click "Generate Today's Passes" above to generate passes for ${stats.eligibleCount} eligible attendees.`
                        : 'No employees are registered or approved for this event date.'}
                    </p>
                  </td>
                </tr>
              ) : (
                passes.map((p) => {
                  const isEligibleOnly = p.lifecycleStatus === 'ELIGIBLE' || p.status === 'ELIGIBLE';
                  const isPassGenerated = p.lifecycleStatus === 'PASS_GENERATED';
                  const isEmailSent = p.lifecycleStatus === 'EMAIL_SENT' || p.emailStatus === 'SENT';
                  const isEmailFailed = p.lifecycleStatus === 'EMAIL_FAILED' || p.emailStatus === 'FAILED';
                  const isCheckedIn = p.lifecycleStatus === 'CHECKED_IN' || !!p.checkedInAt;

                  return (
                    <tr key={p.id} className="hover:bg-cream/40 transition-colors">
                      {/* Attendee */}
                      <td className="py-2 px-3">
                        <div className="font-bold text-ink text-xs sm:text-sm leading-tight">{p.attendeeName}</div>
                        <div className="font-mono text-[9px] text-stone-400 mt-0.5">{p.ticketNumber}</div>
                      </td>

                      {/* Role / Family */}
                      <td className="py-2 px-3">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${
                            p.isFamily
                              ? 'bg-purple-50 text-purple-800 border-purple-200'
                              : 'bg-blue-50 text-blue-800 border-blue-200'
                          }`}
                        >
                          {p.relation}
                        </span>
                      </td>

                      {/* Employee & CPF */}
                      <td className="py-2 px-3">
                        <div className="font-semibold text-ink text-xs leading-tight">{p.employeeName}</div>
                        {p.cpf && (
                          <div className="font-mono text-[10px] text-maroon font-bold mt-0.5">CPF: {p.cpf}</div>
                        )}
                      </td>

                      {/* Recipient Email */}
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-1 text-ink-soft text-xs">
                          <Mail className="w-3 h-3 text-stone-400 shrink-0" />
                          <span className="truncate max-w-[150px]">{p.email || '—'}</span>
                        </div>
                      </td>

                      {/* Email Status */}
                      <td className="py-2 px-3">
                        {isEligibleOnly ? (
                          <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-medium bg-stone-100 text-stone-500 border border-stone-200">
                            Pass Not Generated
                          </span>
                        ) : isEmailSent ? (
                          <div>
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200 uppercase">
                              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                              <span>Email Sent</span>
                            </span>
                            {p.emailSentAt && (
                              <div className="text-[9px] text-ink-soft mt-0.5">
                                {new Date(p.emailSentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            )}
                          </div>
                        ) : isEmailFailed ? (
                          <div>
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-rose-50 text-rose-800 border border-rose-200 uppercase">
                              <AlertCircle className="w-2.5 h-2.5 text-rose-600" />
                              <span>Email Failed</span>
                            </span>
                            {p.emailError && (
                              <div className="text-[9px] text-rose-600 truncate max-w-[110px] mt-0.5" title={p.emailError}>
                                {p.emailError}
                              </div>
                            )}
                          </div>
                        ) : p.emailStatus === 'SENDING' ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-blue-50 text-blue-800 border border-blue-200 uppercase">
                            <RefreshCw className="w-2.5 h-2.5 animate-spin text-blue-600" />
                            <span>Sending</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200 uppercase">
                            <Clock className="w-2.5 h-2.5 text-amber-600" />
                            <span>Email Pending</span>
                          </span>
                        )}
                      </td>

                      {/* Pass Status */}
                      <td className="py-2 px-3">
                        {isEligibleOnly ? (
                          <span className="inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
                            ELIGIBLE
                          </span>
                        ) : isCheckedIn ? (
                          <span className="inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-blue-100 text-blue-900 border border-blue-300">
                            CHECKED IN
                          </span>
                        ) : isPassGenerated ? (
                          <span className="inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-purple-100 text-purple-900 border border-purple-300">
                            PASS GENERATED
                          </span>
                        ) : (
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase border ${
                              p.status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-rose-50 text-rose-800 border-rose-200'
                            }`}
                          >
                            {p.status}
                          </span>
                        )}
                      </td>

                      {/* Check-in */}
                      <td className="py-2 px-3">
                        {p.checkedInAt ? (
                          <div className="text-[10px] font-bold text-blue-800">
                            {new Date(p.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        ) : (
                          <span className="text-[10px] text-stone-400 font-semibold">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-2 px-3 text-right">
                        {p.qrToken ? (
                          <button
                            type="button"
                            onClick={() => setViewPass(p)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-stone-100 hover:bg-maroon hover:text-white text-ink text-[11px] font-bold transition-colors cursor-pointer"
                            title="View Scannable QR Pass"
                          >
                            <QrCode className="w-3 h-3" />
                            <span>View QR</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-stone-400 italic">Pass Not Generated</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        <div className="py-2.5 px-3 border-t border-stone-200/80 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-ink-soft">
          <div>
            Showing <strong>{passes.length}</strong> of <strong>{totalCount}</strong> passes
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-2.5 py-1 rounded-md border border-stone-200 bg-white font-bold disabled:opacity-40 cursor-pointer text-xs"
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
                className="px-2.5 py-1 rounded-md border border-stone-200 bg-white font-bold disabled:opacity-40 cursor-pointer text-xs"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      {/* VIEW QR MODAL */}
      {viewPass && (() => {
        const presentation = buildDailyEmployeePassPresentation({
          eventDate: viewPass.eventDate,
          ticketNumber: viewPass.ticketNumber,
          qrToken: viewPass.qrToken,
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
            title="Daily Entry QR Pass"
          >
            <div className="space-y-4 p-1">
              <DailyEmployeeTicketCard
                presentation={presentation}
                qrSvg={viewPass.qrSvg}
              />

              <div className="pt-2 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl bg-gold text-maroon-deep font-bold text-xs hover:bg-gold-light transition-all flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print QR Pass</span>
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

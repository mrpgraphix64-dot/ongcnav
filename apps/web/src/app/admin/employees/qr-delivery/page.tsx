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
    <div className="space-y-6">
      {/* ACTION BANNER */}
      {actionMessage && (
        <div
          className={`p-4 rounded-2xl border text-sm font-semibold flex items-center justify-between gap-3 ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {actionMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{actionMessage.text}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="text-stone-400 hover:text-ink cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* EVENT DATE SELECTOR TABS */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-xs space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-2 text-xs font-bold text-ink uppercase tracking-wider">
            <Calendar className="w-4 h-4 text-maroon" />
            <span>Select Official Event Date:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* COMPACT AUTO-DISPATCH PILL */}
            <div
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
                scheduleLoading
                  ? 'bg-stone-100 text-stone-500 border-stone-200'
                  : scheduleError
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : !schedule
                  ? 'bg-stone-100 text-stone-600 border-stone-200'
                  : schedule.enabled
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-stone-100 text-stone-600 border-stone-200'
              }`}
            >
              <Clock className={`w-3.5 h-3.5 ${scheduleLoading ? 'animate-spin' : ''}`} />
              <span>
                {scheduleLoading
                  ? 'Auto-Dispatch: Loading...'
                  : scheduleError
                  ? 'Auto-Dispatch: Error'
                  : !schedule
                  ? 'Auto-Dispatch: Not Configured'
                  : schedule.enabled
                  ? `Auto-Dispatch: ON (${formatTimeTo12Hour(schedule.dispatchTime || scheduleTime)} IST)`
                  : 'Auto-Dispatch: OFF'}
              </span>
            </div>

            {(() => {
              const currentTheme = getEventDayTheme(selectedDate);
              const nightIdx = currentTheme.dayNumber;
              return (
                <div
                  className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border transition-colors"
                  style={{
                    backgroundColor: currentTheme.bgColor,
                    borderColor: `${currentTheme.primaryColor}40`,
                    color: currentTheme.primaryColor,
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: currentTheme.secondaryColor }}
                  />
                  <span className="font-outfit font-extrabold uppercase">
                    Night {nightIdx} • {currentTheme.themeTitle}
                  </span>
                  <span className="text-[10px] text-stone-500 font-medium hidden sm:inline">
                    ({currentTheme.motifName.split('/')[0].trim()})
                  </span>
                </div>
              );
            })()}
          </div>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-2">
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
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.16)',
                      }
                    : {
                        backgroundColor: theme.bgColor,
                        borderColor: `${theme.primaryColor}38`,
                      }
                }
                className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer relative overflow-hidden ${
                  isSelected ? 'scale-[1.02]' : 'hover:scale-[1.01]'
                }`}
              >
                <div className="flex items-center justify-center gap-1.5">
                  <span
                    className="text-[10px] uppercase font-bold tracking-wider"
                    style={{
                      color: isSelected ? theme.secondaryColor : theme.primaryColor,
                    }}
                  >
                    Night {idx + 1}
                  </span>
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{
                      backgroundColor: theme.secondaryColor,
                    }}
                  />
                </div>
                <div
                  className={`font-outfit font-black text-xs sm:text-sm mt-0.5 ${
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

      {/* STATS CARDS FOR SELECTED DATE */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Eligible */}
        <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-xs">
          <div className="text-[11px] font-bold text-ink-soft uppercase tracking-wider">Eligible Attendees</div>
          <div className="font-outfit font-black text-2xl text-ink mt-1">
            {statsLoading ? '—' : stats?.eligibleCount.toLocaleString() ?? 0}
          </div>
          <div className="text-[10px] text-ink-soft mt-1">Registered for {formatDateDisplay(selectedDate)}</div>
        </div>

        {/* Generated */}
        <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-xs">
          <div className="text-[11px] font-bold text-ink-soft uppercase tracking-wider">QR Passes Generated</div>
          <div className="font-outfit font-black text-2xl text-purple-700 mt-1">
            {statsLoading ? '—' : stats?.generatedCount.toLocaleString() ?? 0}
          </div>
          <div className="text-[10px] text-purple-600 mt-1">Unique tokens issued</div>
        </div>

        {/* Sent */}
        <div className="bg-white p-4 rounded-2xl border border-emerald-200 bg-emerald-50/30 shadow-xs">
          <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Emails Sent</div>
          <div className="font-outfit font-black text-2xl text-emerald-700 mt-1">
            {statsLoading ? '—' : stats?.sentCount.toLocaleString() ?? 0}
          </div>
          <div className="text-[10px] text-emerald-600 mt-1">Delivered to inbox</div>
        </div>

        {/* Failed */}
        <div className="bg-white p-4 rounded-2xl border border-rose-200 bg-rose-50/30 shadow-xs">
          <div className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">Failed Emails</div>
          <div className="font-outfit font-black text-2xl text-rose-700 mt-1">
            {statsLoading ? '—' : stats?.failedCount.toLocaleString() ?? 0}
          </div>
          <div className="text-[10px] text-rose-600 mt-1">Ready for retry</div>
        </div>

        {/* Pending */}
        <div className="bg-white p-4 rounded-2xl border border-amber-200 bg-amber-50/30 shadow-xs">
          <div className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Pending Dispatch</div>
          <div className="font-outfit font-black text-2xl text-amber-700 mt-1">
            {statsLoading ? '—' : stats?.pendingCount.toLocaleString() ?? 0}
          </div>
          <div className="text-[10px] text-amber-600 mt-1">Awaiting send</div>
        </div>

        {/* Checked In */}
        <div className="bg-white p-4 rounded-2xl border border-blue-200 bg-blue-50/30 shadow-xs">
          <div className="text-[11px] font-bold text-blue-800 uppercase tracking-wider">Gate Scans</div>
          <div className="font-outfit font-black text-2xl text-blue-700 mt-1">
            {statsLoading ? '—' : stats?.checkedInCount.toLocaleString() ?? 0}
          </div>
          <div className="text-[10px] text-blue-600 mt-1">Attended event</div>
        </div>
      </div>

      {/* QR DISPATCH SCHEDULE CARD */}
      <div className="bg-white p-5 rounded-2xl border border-stone-200/90 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-maroon" />
              <h2 className="font-outfit font-black text-base text-ink tracking-tight">
                QR DISPATCH SCHEDULE
              </h2>
            </div>
            <p className="text-xs text-ink-soft mt-0.5">
              Automated server-side pass generation and email dispatch for official event dates in Asia/Kolkata (IST).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold border ${
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
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  scheduleLoading
                    ? 'bg-stone-400 animate-pulse'
                    : scheduleError
                    ? 'bg-rose-500'
                    : !schedule
                    ? 'bg-stone-400'
                    : scheduleEnabled
                    ? 'bg-emerald-500 animate-pulse'
                    : 'bg-stone-400'
                }`}
              />
              {scheduleLoading
                ? 'Loading...'
                : scheduleError
                ? 'Error'
                : !schedule
                ? 'Not Configured'
                : scheduleEnabled
                ? `Auto-Dispatch: ON (${formatTimeTo12Hour(scheduleTime)} IST)`
                : 'Auto-Dispatch: OFF'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
          {/* Selected Event Date */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-ink-soft uppercase tracking-wider">
              Event Date
            </label>
            <div className="p-2.5 rounded-xl border border-stone-200 bg-stone-50 font-outfit font-black text-sm text-ink flex items-center justify-between">
              <span>{formatDateDisplay(selectedDate)}</span>
              <span className="text-xs text-ink-soft font-normal">{selectedDate}</span>
            </div>
          </div>

          {/* Automatic Dispatch Toggle */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-ink-soft uppercase tracking-wider">
              Automatic Dispatch
            </label>
            <div className="p-1 rounded-xl border border-stone-200 bg-stone-50 flex items-center">
              <button
                type="button"
                disabled={scheduleLoading}
                onClick={() => setScheduleEnabled(true)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer disabled:opacity-50 ${
                  scheduleEnabled
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-stone-600 hover:text-ink'
                }`}
              >
                ON
              </button>
              <button
                type="button"
                disabled={scheduleLoading}
                onClick={() => setScheduleEnabled(false)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer disabled:opacity-50 ${
                  !scheduleEnabled
                    ? 'bg-stone-600 text-white shadow-xs'
                    : 'text-stone-600 hover:text-ink'
                }`}
              >
                OFF
              </button>
            </div>
          </div>

          {/* Dispatch Time */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-ink-soft uppercase tracking-wider">
              Dispatch Time
            </label>
            <input
              type="time"
              value={scheduleTime}
              disabled={scheduleLoading}
              onChange={(e) => setScheduleTime(e.target.value)}
              className="w-full p-2 rounded-xl border border-stone-200 bg-white font-outfit font-bold text-sm text-ink focus:outline-none focus:ring-2 focus:ring-maroon/20 focus:border-maroon cursor-pointer disabled:opacity-50"
            />
          </div>

          {/* Timezone (Read-only) */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-ink-soft uppercase tracking-wider">
              Timezone
            </label>
            <div className="p-2.5 rounded-xl border border-stone-200 bg-stone-50 font-mono text-xs text-ink font-semibold flex items-center justify-between">
              <span>Asia/Kolkata</span>
              <span className="text-stone-500 font-sans font-bold">(IST)</span>
            </div>
          </div>
        </div>

        {/* Next Dispatch Status Banner & Save Schedule Button */}
        {(() => {
          const nextDispatch = getNextDispatchDisplay();
          return (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-stone-100">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-bold text-ink-soft">Next Dispatch:</span>
                <span className={`font-semibold ${nextDispatch.colorClass}`}>
                  {nextDispatch.statusText}
                </span>
              </div>

              <button
                type="button"
                onClick={handleSaveSchedule}
                disabled={savingSchedule || scheduleLoading}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-maroon text-white text-xs font-bold hover:bg-maroon-dark transition-all shadow-xs disabled:opacity-50 cursor-pointer"
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

      {/* ACTION TOOLBAR - MANUAL / ADMIN OVERRIDE */}
      <div className="bg-gradient-to-r from-cream-light to-white p-4 sm:p-5 rounded-2xl border border-gold/40 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-stone-200 text-stone-700">
              Admin Override
            </span>
            <h2 className="font-outfit font-extrabold text-sm text-ink flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-maroon" />
              <span>Manual Actions for {formatDateDisplay(selectedDate)}</span>
            </h2>
          </div>
          <p className="text-xs text-ink-soft mt-0.5">
            Deliveries are idempotent. Use manual buttons for immediate generation or emailing, or let the automatic dispatch run on schedule.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleGeneratePasses}
            disabled={generating}
            className="px-4 py-2.5 rounded-xl bg-maroon text-white font-bold text-xs hover:bg-maroon-dark transition-all shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
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
            className="px-4 py-2.5 rounded-xl bg-gold text-maroon-deep font-extrabold text-xs hover:bg-gold-light transition-all shadow-xs flex items-center gap-2 border border-maroon/20 cursor-pointer disabled:opacity-50"
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
              className="px-3.5 py-2.5 rounded-xl bg-rose-100 text-rose-800 border border-rose-300 font-bold text-xs hover:bg-rose-200 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry {stats.failedCount} Failed</span>
            </button>
          )}
        </div>
      </div>

      {/* FILTER & SEARCH */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search by Attendee Name, Employee CPF, Email, or Ticket ID..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-stone-200 text-xs focus:outline-none focus:border-maroon bg-cream/30"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-ink cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Email Status */}
          <div className="flex items-center gap-1.5 bg-stone-50 border border-stone-200 rounded-xl px-3 py-1.5 text-xs">
            <span className="text-ink-soft">Email:</span>
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

          {/* Pass Status */}
          {/* Pass Lifecycle Status Filter */}
          <div className="flex items-center gap-1.5 bg-stone-50 border border-stone-200 rounded-xl px-3 py-1.5 text-xs">
            <span className="text-ink-soft">Status:</span>
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
        </div>
      </div>

      {/* ELIGIBLE NOTICE BANNER */}
      {stats && stats.eligibleCount > 0 && stats.generatedCount === 0 && (
        <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
            <div>
              <strong>{stats.eligibleCount} approved attendees</strong> are eligible for {formatDateDisplay(selectedDate)}.
              <span className="text-stone-600 ml-1">Daily passes have not yet been generated.</span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleGeneratePasses}
            disabled={generating}
            className="px-3.5 py-1.5 bg-maroon text-white font-bold text-xs rounded-xl hover:bg-maroon-dark transition-all shrink-0 shadow-xs cursor-pointer disabled:opacity-50"
          >
            {generating ? 'Generating...' : "1. Generate Today's Passes"}
          </button>
        </div>
      )}

      {/* PASSES DATA TABLE */}
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-stone-50/80 border-b border-stone-200/70 text-ink-soft uppercase text-[10px] font-bold tracking-wider">
                <th className="py-3 px-4 font-bold">Attendee</th>
                <th className="py-3 px-4 font-bold">Role / Family</th>
                <th className="py-3 px-4 font-bold">Employee &amp; CPF</th>
                <th className="py-3 px-4 font-bold">Recipient Email</th>
                <th className="py-3 px-4 font-bold">Email Status</th>
                <th className="py-3 px-4 font-bold">Pass Status</th>
                <th className="py-3 px-4 font-bold">Check-in</th>
                <th className="py-3 px-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {passesLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-ink-soft">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-maroon mb-2" />
                    <span>Loading daily passes...</span>
                  </td>
                </tr>
              ) : passes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-ink-soft">
                    <QrCode className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                    <p className="font-semibold text-ink text-sm">No attendees found matching filter for this date</p>
                    <p className="text-xs text-ink-soft mt-1">
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
                      <td className="py-3 px-4">
                        <div className="font-bold text-ink text-sm">{p.attendeeName}</div>
                        <div className="font-mono text-[10px] text-stone-400 mt-0.5">{p.ticketNumber}</div>
                      </td>

                      {/* Role / Family */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                            p.isFamily
                              ? 'bg-purple-50 text-purple-800 border-purple-200'
                              : 'bg-blue-50 text-blue-800 border-blue-200'
                          }`}
                        >
                          {p.relation}
                        </span>
                      </td>

                      {/* Employee & CPF */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-ink">{p.employeeName}</div>
                        {p.cpf && (
                          <div className="font-mono text-[11px] text-maroon font-bold mt-0.5">CPF: {p.cpf}</div>
                        )}
                      </td>

                      {/* Recipient Email */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1 text-ink-soft">
                          <Mail className="w-3 h-3 text-stone-400 shrink-0" />
                          <span className="truncate max-w-[170px]">{p.email || '—'}</span>
                        </div>
                      </td>

                      {/* Email Status */}
                      <td className="py-3 px-4">
                        {isEligibleOnly ? (
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-stone-100 text-stone-500 border border-stone-200">
                            Pass Not Generated
                          </span>
                        ) : isEmailSent ? (
                          <div>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200 uppercase">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
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
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold bg-rose-50 text-rose-800 border border-rose-200 uppercase">
                              <AlertCircle className="w-3 h-3 text-rose-600" />
                              <span>Email Failed</span>
                            </span>
                            {p.emailError && (
                              <div className="text-[9px] text-rose-600 truncate max-w-[120px] mt-0.5" title={p.emailError}>
                                {p.emailError}
                              </div>
                            )}
                          </div>
                        ) : p.emailStatus === 'SENDING' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold bg-blue-50 text-blue-800 border border-blue-200 uppercase">
                            <RefreshCw className="w-3 h-3 animate-spin text-blue-600" />
                            <span>Sending</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200 uppercase">
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>Email Pending</span>
                          </span>
                        )}
                      </td>

                      {/* Pass Status */}
                      <td className="py-3 px-4">
                        {isEligibleOnly ? (
                          <span className="inline-block px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
                            ELIGIBLE
                          </span>
                        ) : isCheckedIn ? (
                          <span className="inline-block px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-900 border border-blue-300">
                            CHECKED IN
                          </span>
                        ) : isPassGenerated ? (
                          <span className="inline-block px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-purple-100 text-purple-900 border border-purple-300">
                            PASS GENERATED
                          </span>
                        ) : (
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
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
                      <td className="py-3 px-4">
                        {p.checkedInAt ? (
                          <div className="text-[10px] font-bold text-blue-800">
                            {new Date(p.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        ) : (
                          <span className="text-[10px] text-stone-400 font-semibold">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        {p.qrToken ? (
                          <button
                            type="button"
                            onClick={() => setViewPass(p)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-stone-100 hover:bg-maroon hover:text-white text-ink text-xs font-bold transition-colors cursor-pointer"
                            title="View Scannable QR Pass"
                          >
                            <QrCode className="w-3.5 h-3.5" />
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
        <div className="p-4 border-t border-stone-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-ink-soft">
          <div>
            Showing <strong>{passes.length}</strong> of <strong>{totalCount}</strong> passes
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 rounded-lg border border-stone-200 bg-white font-bold disabled:opacity-40 cursor-pointer"
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
                className="px-3 py-1.5 rounded-lg border border-stone-200 bg-white font-bold disabled:opacity-40 cursor-pointer"
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

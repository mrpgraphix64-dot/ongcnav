'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  DoorOpen,
  ScanLine,
  UploadCloud,
  UserPlus,
  Gauge,
  Sparkles,
  ArrowRight,
  Activity,
  QrCode,
  Inbox,
  X,
  Loader2,
  Check,
  CalendarCheck,
  Shield,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { getStoredAuthUser, subscribeToAuthSync } from '@/lib/auth-session';

interface GateActivity {
  id: string;
  name: string;
  code: string;
  type: string;
  count: number;
  isOpen?: boolean;
}

interface RecentCheckin {
  id: string;
  name: string;
  ticket_id: string;
  category: string;
  gate: string;
  checked_in_at: string;
}

interface DashboardStats {
  today: string;
  totalAttendees: number;
  checkedInCount: number;
  pendingCount: number;
  duplicateAttemptsCount: number;
  checkInPercentage: number;
  gatesActivity: GateActivity[];
  totalGateCheckinsToday: number;
  recentCheckIns: RecentCheckin[];
  eventStatus?: 'open' | 'closed';
  scanningEnabled?: boolean;
  emergencyStopped?: boolean;
}

export default function OperationsDashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    today: '',
    totalAttendees: 0,
    checkedInCount: 0,
    pendingCount: 0,
    duplicateAttemptsCount: 0,
    checkInPercentage: 0,
    gatesActivity: [],
    totalGateCheckinsToday: 0,
    recentCheckIns: [],
    eventStatus: 'open',
    scanningEnabled: true,
    emergencyStopped: false,
  });

  const [loading, setLoading] = useState(true);

  // Quick Add Attendee Modal State
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [addForm, setAddForm] = useState({
    name: '',
    mobile: '',
    email: '',
    category: 'General',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Read authenticated user role for Event Control button display
  const [userRole, setUserRole] = useState<string>('SUPER_ADMIN');
  useEffect(() => {
    const cached = getStoredAuthUser();
    if (cached?.role) {
      setUserRole(String(cached.role).toUpperCase());
    }

    const unsubscribe = subscribeToAuthSync((event) => {
      if (event.type === 'LOGIN' && event.user?.role) {
        setUserRole(String(event.user.role).toUpperCase());
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const isSuperOrEventAdmin =
    userRole === 'SUPER_ADMIN' ||
    userRole === 'EVENT_ADMIN' ||
    userRole === 'ADMIN';

  const isCommercialAdmin = userRole === 'COMMERCIAL_ADMIN';
  const canManageEmployee =
    userRole === 'SUPER_ADMIN' ||
    userRole === 'EMPLOYEE_ADMIN' ||
    userRole === 'REGISTRATION_STAFF' ||
    userRole === 'ADMIN';
  const canManageCommercial =
    userRole === 'SUPER_ADMIN' ||
    userRole === 'COMMERCIAL_ADMIN';

  // Fetch real live stats from NestJS
  const fetchStats = useCallback(async () => {
    try {
      const data = await fetchApi<DashboardStats>('/admin/dashboard/live-stats');
      if (data) {
        setStats(data);
      }
    } catch {
      // Gracefully ignore temporary network failures during polling
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + 3.5s live polling matching Laravel dashboard behavior
  useEffect(() => {
    let isMounted = true;
    fetchStats();

    const interval = setInterval(() => {
      // Only poll when the tab is visible to prevent unnecessary resource usage
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchStats();
      }
    }, 3500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [fetchStats]);

  // Handle Quick Add Attendee submission
  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    setSubmitting(true);

    try {
      const res = await fetchApi('/admin/attendees', {
        method: 'POST',
        body: JSON.stringify(addForm),
      });

      setFormSuccess(res?.message || 'Attendee registered successfully!');
      setAddForm({ name: '', mobile: '', email: '', category: 'General' });

      // Refresh stats immediately
      await fetchStats();

      setTimeout(() => {
        setAddModalOpen(false);
        setFormSuccess(null);
      }, 1200);
    } catch (err: any) {
      setFormError(err.message || 'Failed to add attendee. Please check inputs.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 w-full max-w-[1920px] mx-auto">
      {/* 1. HERO SECTION */}
      <div className="relative overflow-hidden rounded-2xl bg-white border border-stone-200/70 card-shadow p-5 sm:p-6 lg:p-8">
        {/* Subtle dot texture, top-right corner only */}
        <div
          className="absolute top-0 right-0 w-48 h-48 dot-texture opacity-30 pointer-events-none"
          style={{
            maskImage: 'radial-gradient(circle at top right, black, transparent 70%)',
            WebkitMaskImage: 'radial-gradient(circle at top right, black, transparent 70%)',
          }}
        />

        <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl lg:max-w-2xl xl:max-w-3xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-maroon-50 text-maroon text-[11px] font-bold uppercase tracking-wider font-outfit">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Real-time Entry Operations</span>
            </div>
            <h1 className="text-2xl sm:text-[28px] font-outfit font-bold text-ink leading-tight">
              ONGC Navratri <span className="text-maroon">Entry Control</span>
            </h1>
            <p className="text-xs sm:text-sm text-ink-soft">
              Live check-in monitoring, QR verification analytics, and gate operations for the ONGC Ground Event.
            </p>
          </div>

          {/* Action Buttons Hierarchy */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 shrink-0 w-full sm:w-auto justify-start sm:justify-end">
            {isSuperOrEventAdmin && (
              <Link
                href="/admin/event-control"
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-cream-soft border border-stone-200 text-ink text-xs sm:text-sm font-bold hover:border-maroon/50 transition-all shadow-xs"
              >
                <Gauge className="w-4 h-4 text-maroon" />
                <span>Event Control</span>
              </Link>
            )}

            {canManageCommercial && !isSuperOrEventAdmin && (
              <>
                <Link
                  href="/admin/commercial/orders"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-stone-200 text-ink text-xs sm:text-sm font-semibold hover:border-maroon/50 hover:bg-cream-soft transition-all shadow-xs"
                >
                  <CalendarCheck className="w-4 h-4 text-maroon" />
                  <span>E-Pass Orders</span>
                </Link>
                <Link
                  href="/admin/commercial/agents"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-stone-200 text-ink text-xs sm:text-sm font-semibold hover:border-maroon/50 hover:bg-cream-soft transition-all shadow-xs"
                >
                  <Shield className="w-4 h-4 text-maroon" />
                  <span>Agents Network</span>
                </Link>
              </>
            )}

            {canManageEmployee && (
              <>
                <button
                  onClick={() => {
                    setFormError(null);
                    setFormSuccess(null);
                    setAddModalOpen(true);
                  }}
                  type="button"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-stone-200 text-ink text-xs sm:text-sm font-semibold hover:border-maroon/50 hover:bg-cream-soft transition-all shadow-xs cursor-pointer"
                >
                  <UserPlus className="w-4 h-4 text-maroon" />
                  <span>Add Attendee</span>
                </button>

                <Link
                  href="/admin/bulk-upload"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-stone-200 text-ink text-xs sm:text-sm font-semibold hover:border-maroon/50 hover:bg-cream-soft transition-all shadow-xs"
                >
                  <UploadCloud className="w-4 h-4 text-maroon" />
                  <span>Upload CSV</span>
                </Link>
              </>
            )}

            {/* PRIMARY ACTION: Live Scanner (Distinct Highlight) */}
            <Link
              href="/scanner"
              className="relative group flex items-center gap-2.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-maroon via-maroon-dark to-maroon text-white text-xs sm:text-sm font-bold border-2 border-gold/60 hover:border-gold hover:shadow-lg transition-all transform hover:-translate-y-0.5"
            >
              <span className="w-2 h-2 rounded-full bg-gold animate-ping" />
              <ScanLine className="w-4 h-4 text-gold-light group-hover:rotate-6 transition-transform" />
              <span className="font-outfit tracking-wide">LIVE SCANNER</span>
            </Link>
          </div>
        </div>
      </div>

      {/* 2. 4 ACTION-ORIENTED KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 xl:gap-5">
        {/* Card 1: Total People */}
        <div className="bg-white rounded-2xl p-5 border border-stone-200/70 card-shadow flex flex-col justify-between hover:border-maroon/30 transition-all">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-ink-soft font-outfit">
                Total People
              </span>
              <div className="w-9 h-9 rounded-xl bg-maroon-50 text-maroon flex items-center justify-center border border-maroon/20">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-3xl xl:text-4xl font-outfit font-black text-ink leading-none">
                {stats.totalAttendees.toLocaleString()}
              </div>
              <p className="text-xs text-ink-soft mt-1.5 font-medium">
                {isCommercialAdmin ? 'Event Passes & Registrations' : 'Employees + Family Members'}
              </p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-stone-100">
            <Link
              href={isCommercialAdmin ? '/admin/commercial/orders' : '/admin/attendees'}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-maroon hover:text-maroon-dark group"
            >
              <span>{isCommercialAdmin ? 'View E-Pass Orders' : 'View Attendees'}</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>

        {/* Card 2: Checked In */}
        <div className="bg-white rounded-2xl p-5 border border-stone-200/70 card-shadow flex flex-col justify-between hover:border-emerald-300 transition-all">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-ink-soft font-outfit">
                Checked In
              </span>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-3xl xl:text-4xl font-outfit font-black text-emerald-700 leading-none">
                {stats.checkedInCount.toLocaleString()}
              </div>
              <p className="text-xs text-ink-soft mt-1.5 font-medium">
                <span className="font-bold text-emerald-700">
                  {stats.checkInPercentage}%
                </span>{' '}
                of registered people
              </p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-stone-100">
            <Link
              href={isCommercialAdmin ? '/admin/commercial/orders' : '/admin/attendees?status=checked_in'}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 group"
            >
              <span>{isCommercialAdmin ? 'View Order Records' : 'View Check-ins'}</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>

        {/* Card 3: Pending */}
        <div className="bg-white rounded-2xl p-5 border border-stone-200/70 card-shadow flex flex-col justify-between hover:border-amber-300 transition-all">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-ink-soft font-outfit">
                Pending
              </span>
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-3xl xl:text-4xl font-outfit font-black text-amber-700 leading-none">
                {stats.pendingCount.toLocaleString()}
              </div>
              <p className="text-xs text-ink-soft mt-1.5 font-medium">
                Awaiting Entry
              </p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-stone-100">
            <Link
              href={isCommercialAdmin ? '/admin/commercial/orders' : '/admin/attendees?status=pending'}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 hover:text-amber-800 group"
            >
              <span>{isCommercialAdmin ? 'View Commercial Orders' : 'View Pending'}</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>

        {/* Card 4: Duplicate Attempts */}
        <div className="bg-white rounded-2xl p-5 border border-stone-200/70 card-shadow flex flex-col justify-between hover:border-rose-300 transition-all">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-ink-soft font-outfit">
                Duplicate Attempts
              </span>
              <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-3xl xl:text-4xl font-outfit font-black text-rose-700 leading-none">
                {stats.duplicateAttemptsCount.toLocaleString()}
              </div>
              <p className="text-xs text-ink-soft mt-1.5 font-medium">
                Prevented re-entry alerts
              </p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-stone-100">
            <Link
              href="/scanner"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-700 hover:text-rose-800 group"
            >
              <span>View Scan Logs</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </div>

      {/* 3. TODAY'S GATE ACTIVITY */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-stone-200/70 card-shadow space-y-4">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-maroon/10 text-maroon flex items-center justify-center shrink-0">
              <DoorOpen className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-outfit font-bold text-ink">
                Today's Gate Activity
              </h3>
              <p className="text-xs text-ink-soft">
                Real-time check-in volume distributed across entry gates
              </p>
            </div>
          </div>
          <div className="text-right flex items-center gap-2">
            <span className="text-xs font-semibold text-ink-soft">Total Today:</span>
            <span className="font-outfit font-black text-maroon text-base">
              {stats.totalGateCheckinsToday.toLocaleString()}
            </span>
            <Link
              href="/admin/gates"
              className="ml-2 text-xs font-bold text-maroon hover:underline hidden sm:inline"
            >
              Manage Gates &rarr;
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-2.5 sm:gap-3 lg:gap-4">
          {stats.gatesActivity.length > 0 ? (
            stats.gatesActivity.map((ga) => (
              <Link
                key={ga.id}
                href="/admin/gates"
                className="p-3 sm:p-3.5 lg:p-4 rounded-xl bg-cream-soft border border-stone-200/60 hover:border-gold hover:bg-white transition-all text-center group block shadow-2xs"
              >
                <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-maroon text-gold-light font-outfit">
                  {ga.code || 'GATE'}
                </span>
                <div className="font-outfit font-bold text-sm text-ink group-hover:text-maroon transition-colors truncate mt-1">
                  {ga.name}
                </div>
                <div className="text-[10px] text-ink-soft mb-1 capitalize">
                  {ga.type.toLowerCase()} Entry
                </div>
                <div className="font-outfit font-black text-xl text-maroon">
                  {ga.count.toLocaleString()}
                </div>
                <div className="text-[10px] text-ink-soft">check-ins</div>
              </Link>
            ))
          ) : (
            <div className="col-span-full py-6 text-center text-xs text-ink-soft">
              No active gates configured.
            </div>
          )}
        </div>
      </div>

      {/* 4. LIVE CAPACITY & RECENT CHECK-INS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-12 gap-5 sm:gap-6">
        {/* Live Capacity & Check-in Meter (2/3 width on desktop, 8/12 on xl) */}
        <div className="lg:col-span-2 xl:col-span-8 bg-white rounded-2xl p-5 sm:p-6 lg:p-7 border border-stone-200/70 card-shadow space-y-6 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-4">
              <div>
                <h3 className="text-base font-outfit font-bold text-ink flex items-center gap-2">
                  <Activity className="w-4 h-4 text-maroon" />
                  <span>Live Capacity &amp; Check-in Meter</span>
                </h3>
                <p className="text-xs text-ink-soft mt-0.5">
                  Real-time gate processing and attendance load
                </p>
              </div>

              {stats.emergencyStopped ? (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-rose-700 bg-rose-50 px-3 py-1 rounded-full border border-rose-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                  <span>Emergency Stop</span>
                </span>
              ) : !stats.scanningEnabled || stats.eventStatus === 'closed' ? (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  <span>Scanning Suspended</span>
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Gate Active</span>
                </span>
              )}
            </div>

            {/* Metrics breakdown */}
            <div className="mt-5 p-3.5 sm:p-4 rounded-xl bg-cream-soft border border-stone-200/60 flex flex-wrap items-center justify-between gap-3 sm:gap-4">
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                <span className="text-xs font-semibold text-ink-soft">Current Status:</span>
                <div className="flex items-center gap-1.5 text-xs font-bold text-ink flex-wrap">
                  <span className="font-outfit font-extrabold text-maroon">
                    {stats.totalAttendees.toLocaleString()}
                  </span>{' '}
                  <span className="text-ink-soft font-normal">Registered</span>
                  <span className="text-stone-300">&bull;</span>
                  <span className="font-outfit font-extrabold text-emerald-700">
                    {stats.checkedInCount.toLocaleString()}
                  </span>{' '}
                  <span className="text-ink-soft font-normal">Checked In</span>
                  <span className="text-stone-300">&bull;</span>
                  <span className="font-outfit font-extrabold text-amber-700">
                    {stats.pendingCount.toLocaleString()}
                  </span>{' '}
                  <span className="text-ink-soft font-normal">Pending</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-maroon bg-white px-2.5 py-1 rounded-lg border border-maroon/20 font-mono">
                  {stats.checkInPercentage}% Capacity
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2 mt-5">
              <div className="flex justify-between text-xs font-semibold text-ink-soft">
                <span>Gate Check-in Progress</span>
                <span className="text-maroon font-bold font-outfit">
                  {stats.checkedInCount.toLocaleString()} / {stats.totalAttendees.toLocaleString()} People ({stats.checkInPercentage}%)
                </span>
              </div>
              <div className="w-full h-3 bg-stone-100 rounded-full overflow-hidden p-0.5 border border-stone-200/50">
                <div
                  className="h-full bg-gradient-to-r from-maroon to-gold rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${Math.min(100, Math.max(0, stats.checkInPercentage))}%` }}
                />
              </div>
            </div>

            {/* Workflow Steps */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-5">
              <div className="p-3.5 sm:p-4 rounded-xl bg-cream-soft border border-stone-200/50 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold text-maroon font-mono">01</span>
                  <UploadCloud className="w-3.5 h-3.5 text-maroon" />
                </div>
                <div className="font-outfit font-semibold text-sm text-ink">Upload / Add</div>
                <div className="text-xs text-ink-soft">Import attendees or add employee pass</div>
              </div>
              <div className="p-3.5 sm:p-4 rounded-xl bg-cream-soft border border-stone-200/50 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold text-maroon font-mono">02</span>
                  <QrCode className="w-3.5 h-3.5 text-maroon" />
                </div>
                <div className="font-outfit font-semibold text-sm text-ink">Issue QR Pass</div>
                <div className="text-xs text-ink-soft">Generate unique secure ticket pass</div>
              </div>
              <div className="p-3.5 sm:p-4 rounded-xl bg-cream-soft border border-stone-200/50 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold text-maroon font-mono">03</span>
                  <ScanLine className="w-3.5 h-3.5 text-maroon" />
                </div>
                <div className="font-outfit font-semibold text-sm text-ink">Gate Scanner</div>
                <div className="text-xs text-ink-soft">Scan and verify entry instantly</div>
              </div>
            </div>
          </div>

          {/* Quick Action Links inside Live Capacity Card */}
          <div className="pt-4 border-t border-stone-100 flex items-center justify-between flex-wrap gap-2.5">
            {canManageEmployee ? (
              <Link
                href="/admin/attendees"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cream-soft hover:bg-stone-200/60 text-ink text-xs font-bold transition-colors font-outfit"
              >
                <Users className="w-3.5 h-3.5 text-maroon" />
                <span>VIEW ALL ATTENDEES</span>
              </Link>
            ) : (
              <Link
                href="/admin/commercial/orders"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cream-soft hover:bg-stone-200/60 text-ink text-xs font-bold transition-colors font-outfit"
              >
                <CalendarCheck className="w-3.5 h-3.5 text-maroon" />
                <span>VIEW E-PASS ORDERS</span>
              </Link>
            )}
            <Link
              href="/scanner"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-maroon text-white text-xs font-bold hover:bg-maroon-dark transition-colors border border-gold/40 shadow-xs font-outfit"
            >
              <ScanLine className="w-3.5 h-3.5 text-gold-light" />
              <span>OPEN SCANNER</span>
            </Link>
          </div>
        </div>

        {/* Recent Check-ins Card (1/3 width on desktop, 4/12 on xl) */}
        <div className="lg:col-span-1 xl:col-span-4 bg-white rounded-2xl p-5 sm:p-6 lg:p-7 border border-stone-200/70 card-shadow space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-stone-100 pb-4">
              <div>
                <h3 className="text-base font-outfit font-bold text-ink">Recent Check-ins</h3>
                <p className="text-xs text-ink-soft mt-0.5">Latest scanned admissions</p>
              </div>
              <Link
                href={isCommercialAdmin ? '/admin/commercial/orders' : '/admin/attendees?status=checked_in'}
                className="text-xs text-maroon font-bold hover:underline flex items-center gap-1"
              >
                <span>View All</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="space-y-2.5 mt-4">
              {stats.recentCheckIns && stats.recentCheckIns.length > 0 ? (
                stats.recentCheckIns.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-cream-soft border border-stone-200/50 space-y-1.5 hover:border-maroon/30 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> CHECKED IN
                        </span>
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-white text-stone-700 border border-stone-200 shrink-0 truncate max-w-[100px] sm:max-w-[130px] xl:max-w-[180px]">
                          {item.category}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono font-bold text-maroon shrink-0">
                        {item.ticket_id}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      <div className="font-outfit font-bold text-xs text-ink truncate">
                        {item.name}
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[11px] font-bold text-ink">{item.checked_in_at}</span>
                        <span className="text-[10px] text-ink-soft ml-1">&bull; {item.gate}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-10 text-ink-soft text-xs space-y-2">
                  <div className="w-10 h-10 rounded-full bg-cream-soft mx-auto flex items-center justify-center text-stone-400">
                    <Inbox className="w-5 h-5" />
                  </div>
                  <p className="font-medium text-stone-600">
                    No entries yet — Waiting for the first successful scan.
                  </p>
                  <Link
                    href="/scanner"
                    className="inline-flex items-center gap-1 text-maroon font-bold hover:underline pt-1"
                  >
                    <span>Launch Scanner</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-stone-100 text-center">
            <Link
              href={isCommercialAdmin ? '/admin/commercial/orders' : '/admin/attendees?status=checked_in'}
              className="text-xs font-bold text-maroon hover:underline inline-flex items-center gap-1 font-outfit"
            >
              <span>{isCommercialAdmin ? 'View Commercial Orders' : 'View All Checked In Attendees'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* 5. QUICK ADD ATTENDEE MODAL */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-xs">
          <div
            className="bg-white border border-stone-200 rounded-2xl p-5 sm:p-6 max-w-md w-full shadow-2xl space-y-5 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-stone-100 pb-4">
              <h3 className="text-lg font-outfit font-bold text-ink flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-maroon" />
                <span>Add Event Attendee</span>
              </h3>
              <button
                onClick={() => setAddModalOpen(false)}
                className="text-stone-400 hover:text-ink transition-colors p-1"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{formSuccess}</span>
              </div>
            )}

            <form onSubmit={handleQuickAdd} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink-soft mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Patel"
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-stone-200 text-ink placeholder-stone-400 text-sm focus:outline-none focus:border-maroon focus:ring-1 focus:ring-maroon"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-soft mb-1">
                  Mobile Number (10 Digits)
                </label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 9876543210"
                  pattern="[0-9]{10}"
                  maxLength={10}
                  minLength={10}
                  inputMode="numeric"
                  value={addForm.mobile}
                  onChange={(e) =>
                    setAddForm({
                      ...addForm,
                      mobile: e.target.value.replace(/[^0-9]/g, ''),
                    })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-stone-200 text-ink placeholder-stone-400 text-sm focus:outline-none focus:border-maroon focus:ring-1 focus:ring-maroon"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-soft mb-1">
                  Email Address (Optional)
                </label>
                <input
                  type="email"
                  placeholder="e.g. rahul@gmail.com"
                  value={addForm.email}
                  onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-stone-200 text-ink placeholder-stone-400 text-sm focus:outline-none focus:border-maroon focus:ring-1 focus:ring-maroon"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-soft mb-1">
                  Ticket Category
                </label>
                <select
                  value={addForm.category}
                  onChange={(e) => setAddForm({ ...addForm, category: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-stone-200 text-ink text-sm focus:outline-none focus:border-maroon focus:ring-1 focus:ring-maroon"
                >
                  <option value="General">General Pass</option>
                  <option value="VIP">VIP Pass</option>
                  <option value="VVIP">VVIP Pass</option>
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-ink-soft hover:text-ink cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-maroon text-white text-sm font-semibold hover:bg-maroon-dark transition-colors shadow-xs disabled:opacity-60 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <span>Create &amp; Generate QR</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

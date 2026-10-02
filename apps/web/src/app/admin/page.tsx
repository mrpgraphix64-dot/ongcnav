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
    <div className="space-y-4 lg:space-y-5 2xl:space-y-6 w-full max-w-[1920px] mx-auto">
      {/* 1. HERO SECTION */}
      <div className="relative overflow-hidden rounded-2xl bg-white border border-stone-200/70 card-shadow p-4 sm:p-5 lg:p-6 2xl:p-8">
        {/* Subtle dot texture, top-right corner only */}
        <div
          className="absolute top-0 right-0 w-48 h-48 dot-texture opacity-30 pointer-events-none"
          style={{
            maskImage: 'radial-gradient(circle at top right, black, transparent 70%)',
            WebkitMaskImage: 'radial-gradient(circle at top right, black, transparent 70%)',
          }}
        />

        <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="space-y-0.5 max-w-xl lg:max-w-2xl">
            <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-maroon font-outfit">
              <Sparkles className="w-3 h-3 text-maroon" />
              <span>Real-time Entry Operations</span>
            </div>
            <h1 className="text-lg sm:text-xl font-outfit font-bold text-ink leading-tight">
              ONGC Navratri <span className="text-maroon">Entry Control</span>
            </h1>
            <p className="text-xs text-ink-soft">
              Live check-in monitoring, QR verification analytics, and gate operations.
            </p>
          </div>

          {/* Action Buttons Hierarchy */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {isSuperOrEventAdmin && (
              <Link
                href="/admin/event-control"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cream-soft border border-stone-200 text-ink text-xs font-bold hover:border-maroon/50 transition-all shadow-2xs"
              >
                <Gauge className="w-3.5 h-3.5 text-maroon" />
                <span>Event Control</span>
              </Link>
            )}

            {canManageCommercial && !isSuperOrEventAdmin && (
              <>
                <Link
                  href="/admin/commercial/orders"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-stone-200 text-ink text-xs font-semibold hover:border-maroon/50 hover:bg-cream-soft transition-all shadow-2xs"
                >
                  <CalendarCheck className="w-3.5 h-3.5 text-maroon" />
                  <span>E-Pass Orders</span>
                </Link>
                <Link
                  href="/admin/commercial/agents"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-stone-200 text-ink text-xs font-semibold hover:border-maroon/50 hover:bg-cream-soft transition-all shadow-2xs"
                >
                  <Shield className="w-3.5 h-3.5 text-maroon" />
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
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-stone-200 text-ink text-xs font-semibold hover:border-maroon/50 hover:bg-cream-soft transition-all shadow-2xs cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5 text-maroon" />
                  <span>Add Attendee</span>
                </button>

                <Link
                  href="/admin/bulk-upload"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-stone-200 text-ink text-xs font-semibold hover:border-maroon/50 hover:bg-cream-soft transition-all shadow-2xs"
                >
                  <UploadCloud className="w-3.5 h-3.5 text-maroon" />
                  <span>Upload CSV</span>
                </Link>
              </>
            )}

            {/* PRIMARY ACTION: Live Scanner (Only for Operational / Super Admin roles) */}
            {!isCommercialAdmin && userRole !== 'EMPLOYEE_ADMIN' && (
              <Link
                href="/scanner"
                className="relative group flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-maroon via-maroon-dark to-maroon text-white text-xs font-bold border border-gold/60 hover:border-gold hover:shadow-xs transition-all"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-gold animate-ping" />
                <ScanLine className="w-3.5 h-3.5 text-gold-light" />
                <span className="font-outfit tracking-wide">LIVE SCANNER</span>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* 2. COMPACT HORIZONTAL STATS STRIP */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {/* Card 1: Total People */}
        <Link
          href={isCommercialAdmin ? '/admin/commercial/orders' : '/admin/attendees'}
          className="bg-white py-2 px-3 rounded-xl border border-stone-200/80 shadow-2xs flex items-center justify-between min-h-[58px] hover:border-maroon/40 transition-all group"
        >
          <div className="min-w-0">
            <span className="text-[10px] font-bold text-ink-soft uppercase tracking-wider block">
              Total People
            </span>
            <span className="text-[10px] text-stone-400 truncate block">
              {isCommercialAdmin ? 'Passes' : 'Employees + Family'}
            </span>
          </div>
          <div className="font-outfit font-black text-xl text-ink group-hover:text-maroon transition-colors ml-2 text-right">
            {stats.totalAttendees.toLocaleString()}
          </div>
        </Link>

        {/* Card 2: Checked In */}
        <Link
          href={isCommercialAdmin ? '/admin/commercial/orders' : '/admin/attendees?status=checked_in'}
          className="bg-emerald-50/40 py-2 px-3 rounded-xl border border-emerald-200/80 shadow-2xs flex items-center justify-between min-h-[58px] hover:border-emerald-400 transition-all group"
        >
          <div className="min-w-0">
            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
              Checked In
            </span>
            <span className="text-[10px] text-emerald-600 font-semibold truncate block">
              {stats.checkInPercentage}% turnout
            </span>
          </div>
          <div className="font-outfit font-black text-xl text-emerald-700 ml-2 text-right">
            {stats.checkedInCount.toLocaleString()}
          </div>
        </Link>

        {/* Card 3: Pending */}
        <Link
          href={isCommercialAdmin ? '/admin/commercial/orders' : '/admin/attendees?status=pending'}
          className="bg-amber-50/40 py-2 px-3 rounded-xl border border-amber-200/80 shadow-2xs flex items-center justify-between min-h-[58px] hover:border-amber-400 transition-all group"
        >
          <div className="min-w-0">
            <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
              Pending
            </span>
            <span className="text-[10px] text-amber-600 truncate block">
              Awaiting Entry
            </span>
          </div>
          <div className="font-outfit font-black text-xl text-amber-700 ml-2 text-right">
            {stats.pendingCount.toLocaleString()}
          </div>
        </Link>

        {/* Card 4: Duplicate Attempts */}
        <Link
          href={
            isCommercialAdmin
              ? '/admin/commercial/orders'
              : userRole === 'EMPLOYEE_ADMIN'
              ? '/admin/attendees'
              : '/scanner'
          }
          className="bg-rose-50/40 py-2 px-3 rounded-xl border border-rose-200/80 shadow-2xs flex items-center justify-between min-h-[58px] hover:border-rose-400 transition-all group"
        >
          <div className="min-w-0">
            <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider block">
              Duplicate Attempts
            </span>
            <span className="text-[10px] text-rose-600 truncate block">
              Alerts prevented
            </span>
          </div>
          <div className="font-outfit font-black text-xl text-rose-700 ml-2 text-right">
            {stats.duplicateAttemptsCount.toLocaleString()}
          </div>
        </Link>
      </div>

      {/* 3. TODAY'S GATE ACTIVITY */}
      <div className="bg-white rounded-xl p-3 sm:p-3.5 border border-stone-200/80 shadow-2xs space-y-2.5">
        <div className="flex items-center justify-between border-b border-stone-100 pb-2 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-maroon/10 text-maroon flex items-center justify-center shrink-0">
              <DoorOpen className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-outfit font-bold text-ink">
                Today's Gate Activity
              </h3>
              <p className="text-[10px] text-ink-soft">
                Real-time check-in volume distributed across entry gates
              </p>
            </div>
          </div>
          <div className="text-right flex items-center gap-2">
            <span className="text-[10px] font-semibold text-ink-soft">Total Today:</span>
            <span className="font-outfit font-black text-maroon text-xs sm:text-sm">
              {stats.totalGateCheckinsToday.toLocaleString()}
            </span>
            {isSuperOrEventAdmin && (
              <Link
                href="/admin/gates"
                className="ml-1.5 text-[10px] font-bold text-maroon hover:underline hidden sm:inline"
              >
                Manage Gates &rarr;
              </Link>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-2">
          {stats.gatesActivity.length > 0 ? (
            stats.gatesActivity.map((ga) => {
              const cardContent = (
                <>
                  <span className="inline-block px-1.5 py-0.2 rounded text-[8px] font-black uppercase tracking-wider bg-maroon text-gold-light font-outfit">
                    {ga.code || 'GATE'}
                  </span>
                  <div className="font-outfit font-bold text-xs text-ink group-hover:text-maroon transition-colors truncate mt-0.5">
                    {ga.name}
                  </div>
                  <div className="text-[9px] text-ink-soft mb-0.5 capitalize">
                    {ga.type.toLowerCase()} Entry
                  </div>
                  <div className="font-outfit font-black text-base text-maroon leading-tight">
                    {ga.count.toLocaleString()}
                  </div>
                  <div className="text-[8px] text-ink-soft">check-ins</div>
                </>
              );

              return isSuperOrEventAdmin ? (
                <Link
                  key={ga.id}
                  href="/admin/gates"
                  className="p-2 rounded-lg bg-cream-soft border border-stone-200/60 hover:border-gold hover:bg-white transition-all text-center group block shadow-2xs"
                >
                  {cardContent}
                </Link>
              ) : (
                <div
                  key={ga.id}
                  className="p-2 rounded-lg bg-cream-soft border border-stone-200/60 text-center block shadow-2xs"
                >
                  {cardContent}
                </div>
              );
            })
          ) : (
            <div className="col-span-full py-4 text-center text-xs text-ink-soft">
              No active gates configured.
            </div>
          )}
        </div>
      </div>

      {/* 4. LIVE CAPACITY & RECENT CHECK-INS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-12 gap-2.5 sm:gap-3">
        {/* Live Capacity & Check-in Meter (2/3 width on desktop, 8/12 on xl) */}
        <div className="lg:col-span-2 xl:col-span-8 bg-white rounded-xl p-3 sm:p-3.5 border border-stone-200/80 shadow-2xs space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-2">
              <div>
                <h3 className="text-sm sm:text-base font-outfit font-bold text-ink flex items-center gap-2">
                  <Activity className="w-4 h-4 text-maroon" />
                  <span>Live Capacity &amp; Check-in Meter</span>
                </h3>
                <p className="text-[11px] 2xl:text-xs text-ink-soft mt-0.5">
                  Real-time gate processing and attendance load
                </p>
              </div>

              {stats.emergencyStopped ? (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-rose-700 bg-rose-50 px-2.5 2xl:px-3 py-0.5 2xl:py-1 rounded-full border border-rose-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                  <span>Emergency Stop</span>
                </span>
              ) : !stats.scanningEnabled || stats.eventStatus === 'closed' ? (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 2xl:px-3 py-0.5 2xl:py-1 rounded-full border border-amber-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  <span>Scanning Suspended</span>
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 2xl:px-3 py-0.5 2xl:py-1 rounded-full border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Gate Active</span>
                </span>
              )}
            </div>

            {/* Metrics breakdown */}
            <div className="mt-3.5 2xl:mt-4 p-3 2xl:p-3.5 rounded-xl bg-cream-soft border border-stone-200/60 flex flex-wrap items-center justify-between gap-2.5 sm:gap-3">
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                <span className="text-[11px] 2xl:text-xs font-semibold text-ink-soft">Current Status:</span>
                <div className="flex items-center gap-1.5 text-[11px] 2xl:text-xs font-bold text-ink flex-wrap">
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
                <span className="text-[11px] 2xl:text-xs font-bold text-maroon bg-white px-2 2xl:px-2.5 py-0.5 2xl:py-1 rounded-lg border border-maroon/20 font-mono">
                  {stats.checkInPercentage}% Capacity
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1.5 2xl:space-y-2 mt-3.5 2xl:mt-4">
              <div className="flex justify-between text-[11px] 2xl:text-xs font-semibold text-ink-soft">
                <span>Gate Check-in Progress</span>
                <span className="text-maroon font-bold font-outfit">
                  {stats.checkedInCount.toLocaleString()} / {stats.totalAttendees.toLocaleString()} People ({stats.checkInPercentage}%)
                </span>
              </div>
              <div className="w-full h-2.5 2xl:h-3 bg-stone-100 rounded-full overflow-hidden p-0.5 border border-stone-200/50">
                <div
                  className="h-full bg-gradient-to-r from-maroon to-gold rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${Math.min(100, Math.max(0, stats.checkInPercentage))}%` }}
                />
              </div>
            </div>

            {/* Workflow Steps */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 2xl:gap-3 pt-3.5 2xl:pt-4">
              <div className="p-2.5 sm:p-3 2xl:p-3.5 rounded-xl bg-cream-soft border border-stone-200/50 space-y-0.5 2xl:space-y-1">
                <div className="flex items-center gap-1.5 2xl:gap-2">
                  <span className="text-[11px] 2xl:text-xs font-extrabold text-maroon font-mono">01</span>
                  <UploadCloud className="w-3 2xl:w-3.5 h-3 2xl:h-3.5 text-maroon" />
                </div>
                <div className="font-outfit font-semibold text-xs sm:text-sm text-ink">Upload / Add</div>
                <div className="text-[11px] 2xl:text-xs text-ink-soft">Import attendees or add employee pass</div>
              </div>
              <div className="p-2.5 sm:p-3 2xl:p-3.5 rounded-xl bg-cream-soft border border-stone-200/50 space-y-0.5 2xl:space-y-1">
                <div className="flex items-center gap-1.5 2xl:gap-2">
                  <span className="text-[11px] 2xl:text-xs font-extrabold text-maroon font-mono">02</span>
                  <QrCode className="w-3 2xl:w-3.5 h-3 2xl:h-3.5 text-maroon" />
                </div>
                <div className="font-outfit font-semibold text-xs sm:text-sm text-ink">Issue QR Pass</div>
                <div className="text-[11px] 2xl:text-xs text-ink-soft">Generate unique secure ticket pass</div>
              </div>
              <div className="p-2.5 sm:p-3 2xl:p-3.5 rounded-xl bg-cream-soft border border-stone-200/50 space-y-0.5 2xl:space-y-1">
                <div className="flex items-center gap-1.5 2xl:gap-2">
                  <span className="text-[11px] 2xl:text-xs font-extrabold text-maroon font-mono">03</span>
                  <ScanLine className="w-3 2xl:w-3.5 h-3 2xl:h-3.5 text-maroon" />
                </div>
                <div className="font-outfit font-semibold text-xs sm:text-sm text-ink">Gate Scanner</div>
                <div className="text-[11px] 2xl:text-xs text-ink-soft">Scan and verify entry instantly</div>
              </div>
            </div>
          </div>

          {/* Quick Action Links inside Live Capacity Card */}
          <div className="pt-3 2xl:pt-3.5 border-t border-stone-100 flex items-center justify-between flex-wrap gap-2">
            {canManageEmployee ? (
              <Link
                href="/admin/attendees"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 2xl:px-3.5 2xl:py-2 rounded-xl bg-cream-soft hover:bg-stone-200/60 text-ink text-xs font-bold transition-colors font-outfit"
              >
                <Users className="w-3 2xl:w-3.5 h-3 2xl:h-3.5 text-maroon" />
                <span>VIEW ALL ATTENDEES</span>
              </Link>
            ) : (
              <Link
                href="/admin/commercial/orders"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 2xl:px-3.5 2xl:py-2 rounded-xl bg-cream-soft hover:bg-stone-200/60 text-ink text-xs font-bold transition-colors font-outfit"
              >
                <CalendarCheck className="w-3 2xl:w-3.5 h-3 2xl:h-3.5 text-maroon" />
                <span>VIEW E-PASS ORDERS</span>
              </Link>
            )}
            <Link
              href="/scanner"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 2xl:px-4 2xl:py-2 rounded-xl bg-maroon text-white text-xs font-bold hover:bg-maroon-dark transition-colors border border-gold/40 shadow-xs font-outfit"
            >
              <ScanLine className="w-3 2xl:w-3.5 h-3 2xl:h-3.5 text-gold-light" />
              <span>OPEN SCANNER</span>
            </Link>
          </div>
        </div>

        {/* Recent Check-ins Card (1/3 width on desktop, 4/12 on xl) */}
        <div className="lg:col-span-1 xl:col-span-4 bg-white rounded-2xl p-4 sm:p-5 2xl:p-6 border border-stone-200/70 card-shadow space-y-3 2xl:space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-stone-100 pb-2.5 2xl:pb-3">
              <div>
                <h3 className="text-sm sm:text-base font-outfit font-bold text-ink">Recent Check-ins</h3>
                <p className="text-[11px] 2xl:text-xs text-ink-soft mt-0.5">Latest scanned admissions</p>
              </div>
              <Link
                href={isCommercialAdmin ? '/admin/commercial/orders' : '/admin/attendees?status=checked_in'}
                className="text-xs text-maroon font-bold hover:underline flex items-center gap-1"
              >
                <span>View All</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="space-y-2 2xl:space-y-2.5 mt-3 2xl:mt-3.5">
              {stats.recentCheckIns && stats.recentCheckIns.length > 0 ? (
                stats.recentCheckIns.map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 2xl:p-3 rounded-xl bg-cream-soft border border-stone-200/50 space-y-1 2xl:space-y-1.5 hover:border-maroon/30 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="inline-flex items-center gap-1 text-[8px] 2xl:text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> CHECKED IN
                        </span>
                        <span className="text-[8px] 2xl:text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-white text-stone-700 border border-stone-200 shrink-0 truncate max-w-[100px] sm:max-w-[130px] xl:max-w-[180px]">
                          {item.category}
                        </span>
                      </div>
                      <div className="text-[10px] 2xl:text-[11px] font-mono font-bold text-maroon shrink-0">
                        {item.ticket_id}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      <div className="font-outfit font-bold text-xs text-ink truncate">
                        {item.name}
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[10px] 2xl:text-[11px] font-bold text-ink">{item.checked_in_at}</span>
                        <span className="text-[9px] 2xl:text-[10px] text-ink-soft ml-1">&bull; {item.gate}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 2xl:py-10 text-ink-soft text-xs space-y-2">
                  <div className="w-9 h-9 2xl:w-10 2xl:h-10 rounded-full bg-cream-soft mx-auto flex items-center justify-center text-stone-400">
                    <Inbox className="w-4 h-4 2xl:w-5 2xl:h-5" />
                  </div>
                  <p className="font-medium text-stone-600 text-xs">
                    No entries yet — Waiting for the first successful scan.
                  </p>
                  <Link
                    href="/scanner"
                    className="inline-flex items-center gap-1 text-maroon font-bold hover:underline pt-0.5"
                  >
                    <span>Launch Scanner</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              )}
            </div>
          </div>

          <div className="pt-2.5 2xl:pt-3 border-t border-stone-100 text-center">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-ink/40 backdrop-blur-xs">
          <div
            className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 2xl:p-6 max-w-md w-full max-h-[calc(100vh-2rem)] overflow-y-auto shadow-2xl space-y-3.5 2xl:space-y-4 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="text-base sm:text-lg font-outfit font-bold text-ink flex items-center gap-2">
                <UserPlus className="w-4 h-4 2xl:w-5 2xl:h-5 text-maroon" />
                <span>Add Event Attendee</span>
              </h3>
              <button
                onClick={() => setAddModalOpen(false)}
                className="text-stone-400 hover:text-ink transition-colors p-1"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4 2xl:w-5 2xl:h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-2.5 2xl:p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 2xl:w-4 2xl:h-4 shrink-0 text-rose-600" />
                <span>{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div className="p-2.5 2xl:p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <Check className="w-3.5 h-3.5 2xl:w-4 2xl:h-4 shrink-0 text-emerald-600" />
                <span>{formSuccess}</span>
              </div>
            )}

            <form onSubmit={handleQuickAdd} className="space-y-3 2xl:space-y-3.5">
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
                  className="w-full px-3 py-2 2xl:px-3.5 2xl:py-2.5 rounded-xl bg-white border border-stone-200 text-ink placeholder-stone-400 text-xs sm:text-sm focus:outline-none focus:border-maroon focus:ring-1 focus:ring-maroon"
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
                  className="w-full px-3 py-2 2xl:px-3.5 2xl:py-2.5 rounded-xl bg-white border border-stone-200 text-ink placeholder-stone-400 text-xs sm:text-sm focus:outline-none focus:border-maroon focus:ring-1 focus:ring-maroon"
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
                  className="w-full px-3 py-2 2xl:px-3.5 2xl:py-2.5 rounded-xl bg-white border border-stone-200 text-ink placeholder-stone-400 text-xs sm:text-sm focus:outline-none focus:border-maroon focus:ring-1 focus:ring-maroon"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-soft mb-1">
                  Ticket Category
                </label>
                <select
                  value={addForm.category}
                  onChange={(e) => setAddForm({ ...addForm, category: e.target.value })}
                  className="w-full px-3 py-2 2xl:px-3.5 2xl:py-2.5 rounded-xl bg-white border border-stone-200 text-ink text-xs sm:text-sm focus:outline-none focus:border-maroon focus:ring-1 focus:ring-maroon"
                >
                  <option value="General">General Pass</option>
                  <option value="VIP">VIP Pass</option>
                  <option value="VVIP">VVIP Pass</option>
                </select>
              </div>

              <div className="pt-2.5 2xl:pt-3 flex items-center justify-end gap-2.5 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-ink-soft hover:text-ink cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-1.5 2xl:gap-2 px-4 py-2 2xl:px-5 2xl:py-2.5 rounded-xl bg-maroon text-white text-xs sm:text-sm font-semibold hover:bg-maroon-dark transition-colors shadow-xs disabled:opacity-60 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 2xl:w-4 2xl:h-4 animate-spin" />
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

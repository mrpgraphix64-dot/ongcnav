'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Gauge,
  DoorOpen,
  Users,
  Shield,
  UploadCloud,
  LifeBuoy,
  ScanLine,
  AlertTriangle,
  CalendarCheck,
  BarChart3,
  Settings,
  FlaskConical,
  Globe,
  ExternalLink,
  LogOut,
  ChevronDown,
  RefreshCw,
  Calendar,
  Menu,
  X,
  Headphones,
  ShieldAlert,
  ArrowLeft,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';

interface AdminUser {
  id?: string;
  staffId?: string;
  name?: string;
  email?: string;
  role?: string;
  assignedGates?: any[];
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
  isSectionHeader?: string;
}

// Canonical Laravel navigation items
const ALL_NAV_ITEMS: NavItem[] = [
  // 1. Event Control (Super Admin, Event Admin)
  {
    label: 'Event Control',
    href: '/admin/event-control',
    icon: Gauge,
    roles: ['SUPER_ADMIN', 'EVENT_ADMIN'],
  },
  // 2. Dashboard (Super Admin, Event Admin, Gate Manager)
  {
    label: 'Dashboard',
    href: '/admin',
    icon: LayoutDashboard,
    roles: ['SUPER_ADMIN', 'EVENT_ADMIN', 'GATE_MANAGER'],
  },
  // 3. Gates (Super Admin, Event Admin, Gate Manager)
  {
    label: 'Gates',
    href: '/admin/gates',
    icon: DoorOpen,
    roles: ['SUPER_ADMIN', 'EVENT_ADMIN', 'GATE_MANAGER'],
  },
  // 4. Staff Management (Super Admin, Event Admin)
  {
    label: 'Staff Management',
    href: '/admin/staff',
    icon: Shield,
    roles: ['SUPER_ADMIN', 'EVENT_ADMIN'],
  },
  // 5. Attendees & Passes (Super Admin, Employee Admin, Registration Staff ONLY - employee-only)
  {
    label: 'Attendees & Passes',
    href: '/admin/attendees',
    icon: Users,
    roles: ['SUPER_ADMIN', 'EMPLOYEE_ADMIN', 'REGISTRATION_STAFF'],
  },
  // 6. Bulk Upload (Super Admin, Employee Admin, Registration Staff ONLY - employee-only)
  {
    label: 'Bulk Upload',
    href: '/admin/bulk-upload',
    icon: UploadCloud,
    roles: ['SUPER_ADMIN', 'EMPLOYEE_ADMIN', 'REGISTRATION_STAFF'],
  },
  // Commercial Orders (Super Admin, Commercial Admin)
  {
    label: 'Commercial Orders',
    href: '/admin/commercial/orders',
    icon: CalendarCheck,
    roles: ['SUPER_ADMIN', 'COMMERCIAL_ADMIN'],
  },
  // Commercial Agents (Super Admin, Commercial Admin)
  {
    label: 'Commercial Agents',
    href: '/admin/commercial/agents',
    icon: Shield,
    roles: ['SUPER_ADMIN', 'COMMERCIAL_ADMIN'],
  },
  // Agent Portal (Commercial Agent, Commercial Sub Agent)
  {
    label: 'Agent Portal',
    href: '/agent',
    icon: Calendar,
    roles: ['COMMERCIAL_AGENT', 'COMMERCIAL_SUB_AGENT'],
  },
  // 7. Help Desk Overrides (Super Admin, Employee Admin, Event Admin, Gate Manager, Registration Staff)
  {
    label: 'Help Desk Overrides',
    href: '/admin/helpdesk',
    icon: LifeBuoy,
    roles: ['SUPER_ADMIN', 'EMPLOYEE_ADMIN', 'EVENT_ADMIN', 'GATE_MANAGER', 'REGISTRATION_STAFF'],
  },
  // 8. Turnstile Scanner (Super Admin, Event Admin, Gate Manager)
  {
    label: 'Turnstile Scanner',
    href: '/scanner',
    icon: ScanLine,
    roles: ['SUPER_ADMIN', 'EVENT_ADMIN', 'GATE_MANAGER'],
  },
  // 9. Incident Response (Super Admin, Event Admin, Gate Manager)
  {
    label: 'Incident Response',
    href: '/admin/incidents',
    icon: AlertTriangle,
    roles: ['SUPER_ADMIN', 'EVENT_ADMIN', 'GATE_MANAGER'],
  },
  // 10. Daily Closing (Super Admin, Event Admin, Gate Manager, Report Viewer)
  {
    label: 'Daily Closing',
    href: '/admin/daily-closing',
    icon: CalendarCheck,
    roles: ['SUPER_ADMIN', 'EVENT_ADMIN', 'GATE_MANAGER', 'REPORT_VIEWER'],
  },
  // 11. Reports & Export (Super Admin, Event Admin, Gate Manager, Report Viewer)
  {
    label: 'Reports & Export',
    href: '/admin/reports',
    icon: BarChart3,
    roles: ['SUPER_ADMIN', 'EVENT_ADMIN', 'GATE_MANAGER', 'REPORT_VIEWER'],
  },
  // 12. Settings (Super Admin, Event Admin)
  {
    label: 'Settings',
    href: '/admin/settings',
    icon: Settings,
    roles: ['SUPER_ADMIN', 'EVENT_ADMIN'],
  },
  // 13. Traffic Test Lab (Super Admin, Event Admin)
  {
    label: 'Traffic Test Lab',
    href: '/admin/traffic-test',
    icon: FlaskConical,
    roles: ['SUPER_ADMIN', 'EVENT_ADMIN'],
    isSectionHeader: 'TEST LAB',
  },
];

// Dedicated navigation for Scanner Staff
const SCANNER_STAFF_NAV_ITEMS: NavItem[] = [
  {
    label: 'My Gate',
    href: '/admin/my-gate',
    icon: DoorOpen,
    roles: ['SCANNER_STAFF'],
  },
  {
    label: 'Turnstile Scanner',
    href: '/scanner',
    icon: ScanLine,
    roles: ['SCANNER_STAFF'],
  },
  {
    label: 'Help Desk Overrides',
    href: '/admin/helpdesk',
    icon: LifeBuoy,
    roles: ['SCANNER_STAFF'],
  },
  {
    label: 'Incident Response',
    href: '/admin/incidents',
    icon: AlertTriangle,
    roles: ['SCANNER_STAFF'],
  },
];

function normalizeRole(role?: string): string {
  if (!role) return 'SUPER_ADMIN';
  const r = role.toUpperCase();
  if (r === 'ADMIN') return 'EVENT_ADMIN';
  if (r === 'GATE_OPERATOR') return 'SCANNER_STAFF';
  if (r === 'GATE_SUPERVISOR') return 'GATE_MANAGER';
  if (r === 'HELP_DESK') return 'REGISTRATION_STAFF';
  if (r === 'VOLUNTEER') return 'REPORT_VIEWER';
  return r;
}

function getPageMeta(pathname: string): { title: string; subtitle: string } {
  if (pathname === '/admin' || pathname === '/admin/') {
    return {
      title: 'Dashboard Overview',
      subtitle: 'Real-time registration, ticket verification, and gate access management.',
    };
  }
  if (pathname.startsWith('/admin/my-gate')) {
    return {
      title: 'My Gate',
      subtitle: 'Assigned gate turnstile terminal, lane stats, and scanner launch pad.',
    };
  }
  if (pathname.startsWith('/admin/event-control')) {
    return {
      title: 'Event Control',
      subtitle: 'Central command for emergency stops, scanning states, gate statuses, and operational dates.',
    };
  }
  if (pathname.startsWith('/admin/gates')) {
    return {
      title: 'Gates',
      subtitle: 'Manage physical turnstiles, capacities, and staff station assignments.',
    };
  }
  if (pathname.startsWith('/admin/staff')) {
    return {
      title: 'Staff Management',
      subtitle: 'Manage gate operators, supervisors, roles, and credential access.',
    };
  }
  if (pathname.startsWith('/admin/attendees')) {
    return {
      title: 'Attendees & Passes',
      subtitle: 'Registered employees, family members, QR tickets, and entry status.',
    };
  }
  if (pathname.startsWith('/admin/bulk-upload')) {
    return {
      title: 'Bulk Upload',
      subtitle: 'Upload, validate, and issue ticket batches with dry-run verification.',
    };
  }
  if (pathname.startsWith('/admin/helpdesk') || pathname.startsWith('/admin/help-desk')) {
    return {
      title: 'Help Desk Overrides',
      subtitle: 'Attendee lookup, manual check-in justification, and ticket status reversal.',
    };
  }
  if (pathname.startsWith('/admin/incidents')) {
    return {
      title: 'Incident Response',
      subtitle: 'Log, monitor, and resolve gate security, medical, and crowd incidents.',
    };
  }
  if (pathname.startsWith('/admin/daily-closing')) {
    return {
      title: 'Daily Closing',
      subtitle: 'End-of-night operational reconciliation and official closing audit report.',
    };
  }
  if (pathname.startsWith('/admin/reports')) {
    return {
      title: 'Reports & Export',
      subtitle: 'Event analytics, gate turnstile throughput, and audit reports.',
    };
  }
  if (pathname.startsWith('/admin/settings')) {
    return {
      title: 'Settings',
      subtitle: 'System configuration, operational policies, and scanner parameters.',
    };
  }
  if (pathname.startsWith('/admin/commercial/orders')) {
    return {
      title: 'Commercial Orders',
      subtitle: 'Audit public and agent ticket sales, payment verification, and pass delivery.',
    };
  }
  if (pathname.startsWith('/admin/commercial/agents')) {
    return {
      title: 'Commercial Agents',
      subtitle: 'Agent directory, master inventory allocations, and sub-agent network oversight.',
    };
  }
  if (pathname.startsWith('/agent')) {
    return {
      title: 'Commercial Agent Portal',
      subtitle: 'Offline pass booking, inventory balances, and sub-agent distribution.',
    };
  }
  if (pathname.startsWith('/admin/traffic-test')) {
    return {
      title: 'Traffic Test Lab',
      subtitle: 'Turnstile scanner load testing and high-concurrency simulation lab.',
    };
  }

  return {
    title: 'ONGC Operations',
    subtitle: 'Event QR entry control and turnstile management.',
  };
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  // If on /admin/login, bypass the Admin Shell completely so it renders full-screen
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  // Hydrate user from localStorage first for zero-flash initial render
  const [user, setUser] = useState<AdminUser | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('ongc_admin_user');
        return cached ? JSON.parse(cached) : null;
      } catch {
        return null;
      }
    }
    return null;
  });

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Operational Status from backend (/event-control/status)
  const [statusLoading, setStatusLoading] = useState(true);
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const [eventStatus, setEventStatus] = useState<'open' | 'closed' | null>(null);
  const [scanningEnabled, setScanningEnabled] = useState<boolean | null>(null);
  const [emergencyStopped, setEmergencyStopped] = useState<boolean | null>(null);

  // Fetch real authenticated user profile
  useEffect(() => {
    let isMounted = true;

    async function loadUserProfile() {
      try {
        const res = await fetchApi('/auth/me');
        if (isMounted && res?.user) {
          setUser(res.user);
          try {
            localStorage.setItem('ongc_admin_user', JSON.stringify(res.user));
          } catch {}
        }
      } catch {
        // If unauthenticated, redirect to /admin/login
        if (isMounted) {
          try {
            localStorage.removeItem('ongc_admin_user');
          } catch {}
          router.push('/admin/login');
        }
      }
    }

    loadUserProfile();
    return () => {
      isMounted = false;
    };
  }, [router]);

  // Fetch real event-control status periodically from backend
  useEffect(() => {
    let isMounted = true;

    async function loadStatus() {
      try {
        const res = await fetchApi('/event-control/status');
        if (isMounted && res) {
          setActiveDate(res.activeDate || null);
          setEventStatus(res.eventStatus || 'open');
          setScanningEnabled(typeof res.scanningEnabled === 'boolean' ? res.scanningEnabled : true);
          setEmergencyStopped(typeof res.emergencyStopped === 'boolean' ? res.emergencyStopped : false);
        }
      } catch {
        // Leave in neutral state if endpoint fails
      } finally {
        if (isMounted) {
          setStatusLoading(false);
        }
      }
    }

    loadStatus();
    const interval = setInterval(loadStatus, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await fetchApi('/auth/logout', { method: 'POST' });
    } catch {}
    try {
      localStorage.removeItem('ongc_admin_user');
    } catch {}
    router.push('/admin/login');
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      window.location.reload();
    }, 200);
  };

  // Close dropdown on outside click
  const dropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute authorized navigation items for current user's role
  const normalizedRole = normalizeRole(user?.role);
  const isScannerStaff = normalizedRole === 'SCANNER_STAFF';

  const visibleNavItems = isScannerStaff
    ? SCANNER_STAFF_NAV_ITEMS
    : ALL_NAV_ITEMS.filter((item) => item.roles.includes(normalizedRole));

  // Role-based route authorization check
  const isAuthorized = (() => {
    if (!user) return true; // allow initial paint while validating
    if (normalizedRole === 'SUPER_ADMIN') return true;

    const matchedNav = ALL_NAV_ITEMS.find(
      (item) => item.href === pathname || pathname.startsWith(`${item.href}/`),
    );
    if (!matchedNav) return true;
    return matchedNav.roles.includes(normalizedRole);
  })();

  const pageMeta = getPageMeta(pathname);
  const userInitials = (user?.name || user?.staffId || 'Admin')
    .slice(0, 2)
    .toUpperCase();

  const roleBadgeLabel = normalizedRole.replace(/_/g, ' ');

  return (
    <div className="h-screen w-screen flex flex-col font-sans bg-cream text-ink selection:bg-maroon selection:text-white overflow-hidden">
      {/* Emergency Stop Top Alert Banner (shown only when emergency stop is active) */}
      {emergencyStopped === true && (
        <div className="bg-maroon text-white px-4 py-2 text-center text-xs font-black tracking-widest uppercase flex items-center justify-center gap-2 border-b border-gold/40 shadow-md shrink-0 z-50">
          <ShieldAlert className="w-4 h-4 text-gold animate-bounce" />
          <span>ALL GATES EMERGENCY STOP ACTIVATED — ALL SCANNING SUSPENDED</span>
        </div>
      )}

      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Mobile Sidebar Backdrop */}
        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-xs lg:hidden transition-opacity"
          />
        )}

        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-64 h-full bg-white border-r border-stone-200/70 flex flex-col transition-transform duration-200 lg:static lg:z-auto lg:shrink-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
        >
          {/* Sidebar Logo & Branding */}
          <Link
            href="/admin"
            onClick={() => setSidebarOpen(false)}
            className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-stone-100 shrink-0 hover:opacity-95 transition-opacity"
          >
            <img
              src="/images/logo-web.png"
              alt="ONGC Logo"
              className="h-10 w-auto max-w-[160px] object-contain shrink-0"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
                const fallback = (e.target as HTMLElement).nextElementSibling;
                if (fallback) fallback.classList.remove('hidden');
              }}
            />
            <div className="hidden h-10 w-10 rounded-xl bg-maroon text-white flex items-center justify-center font-outfit font-black text-sm shrink-0">
              ONGC
            </div>
            <div className="min-w-0">
              <div className="font-outfit font-bold text-[14px] leading-tight text-ink">
                ONGC Navratri
              </div>
              <div className="text-[11px] font-semibold text-maroon tracking-wide">
                2026 &bull; Entry Portal
              </div>
            </div>
          </Link>

          {/* Navigation Links (Strictly Role-Filtered matching Laravel hierarchy) */}
          <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === '/admin'
                  ? pathname === '/admin'
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <React.Fragment key={item.href}>
                  {item.isSectionHeader && (
                    <div className="px-3 pt-3 pb-1 text-[10px] font-extrabold tracking-wider text-ink-soft uppercase font-outfit">
                      {item.isSectionHeader}
                    </div>
                  )}
                  <Link
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                      isActive
                        ? 'bg-maroon text-white shadow-xs'
                        : 'text-ink/80 hover:bg-cream-soft hover:text-ink'
                    }`}
                  >
                    <Icon
                      className={`w-[18px] h-[18px] shrink-0 ${
                        isActive ? 'text-gold-light' : 'text-ink-soft'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </React.Fragment>
              );
            })}

            {/* Public Event Link Button */}
            <div className="pt-3 mt-3 border-t border-stone-100">
              <div className="px-3 pb-1.5 text-[10px] font-extrabold tracking-wider text-ink-soft uppercase font-outfit">
                Public Event
              </div>
              <a
                href="/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-bold text-maroon bg-gradient-to-r from-gold/15 to-gold/25 border border-gold/40 hover:border-maroon/50 hover:bg-gold/30 transition-all group shadow-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Globe className="w-[18px] h-[18px] text-maroon group-hover:scale-110 transition-transform" />
                  <span className="truncate">Go to Website</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-maroon/80 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform shrink-0" />
              </a>
            </div>
          </nav>

          {/* Sidebar Footer: User Session & Support */}
          <div className="p-3 border-t border-stone-100 space-y-2 shrink-0">
            {/* Authenticated User Quick Info */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-cream-soft border border-stone-200/60">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-full bg-maroon text-white flex items-center justify-center font-outfit font-bold text-xs shrink-0">
                  {userInitials}
                </div>
                <div className="min-w-0">
                  <div className="font-outfit font-bold text-xs text-ink truncate">
                    {user?.name || user?.staffId || 'Portal Administrator'}
                  </div>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 uppercase tracking-wide">
                    {roleBadgeLabel}
                  </span>
                </div>
              </div>
              <button
                onClick={handleLogout}
                title="Sign Out"
                className="p-1.5 rounded-lg text-ink-soft hover:bg-white hover:text-rose-600 transition-colors shrink-0"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

            {/* Support Card: Authentic operational contact label without unverified numbers */}
            <div className="flex items-center gap-2.5 bg-white rounded-xl p-2.5 border border-stone-200/50">
              <div className="w-7 h-7 rounded-full bg-maroon/10 text-maroon flex items-center justify-center shrink-0">
                <Headphones className="w-3.5 h-3.5" />
              </div>
              <div className="text-[11px] min-w-0">
                <div className="font-semibold text-ink">Gate Operations Support</div>
                <div className="text-ink-soft truncate">Event Control Room</div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden bg-cream">
          {/* Top Bar Header */}
          <header className="shrink-0 z-30 bg-cream/95 backdrop-blur-sm border-b border-stone-200/70">
            <div className="px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
              {/* Left: Mobile trigger & Page Titles */}
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="lg:hidden w-9 h-9 rounded-lg bg-white border border-stone-200 text-ink flex items-center justify-center shrink-0 shadow-xs"
                  aria-label="Open navigation menu"
                >
                  <Menu className="w-[18px] h-[18px]" />
                </button>

                <div className="min-w-0">
                  <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-maroon font-outfit">
                    <span>ONGC NAVRATRI</span>
                    <span className="text-stone-300">&bull;</span>
                    <span className="text-ink-soft">ENTRY CONTROL PORTAL</span>
                  </div>
                  <h1 className="font-outfit font-bold text-lg sm:text-xl text-ink truncate leading-tight">
                    {pageMeta.title}
                  </h1>
                  <p className="text-xs text-ink-soft truncate hidden sm:block">
                    {pageMeta.subtitle}
                  </p>
                </div>
              </div>

              {/* Right: Real Operational Status, Real Event Date, Scanner Shortcut & User Menu */}
              <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
                {/* Event Operational Status (Real backend state or explicit neutral loading) */}
                {statusLoading ? (
                  <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-100 border border-stone-200 text-xs font-semibold text-stone-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-pulse" />
                    <span>Checking Status...</span>
                  </div>
                ) : emergencyStopped === true ? (
                  <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                    <span>Emergency Stop Active</span>
                  </div>
                ) : scanningEnabled === false || eventStatus === 'closed' ? (
                  <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    <span>Scanning Suspended</span>
                  </div>
                ) : eventStatus === 'open' && scanningEnabled === true ? (
                  <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Gate Active</span>
                  </div>
                ) : (
                  <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-100 border border-stone-200 text-xs font-semibold text-stone-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
                    <span>Status Neutral</span>
                  </div>
                )}

                {/* Event Operational Date (From backend settings or neutral indicator) */}
                <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-stone-200 text-xs font-semibold text-ink shadow-xs">
                  <Calendar className="w-[14px] h-[14px] text-maroon" />
                  <span>{activeDate ? activeDate : 'Event Schedule'}</span>
                </div>

                {/* Quick Scan Button (Mobile) */}
                <Link
                  href="/scanner"
                  className="md:hidden w-9 h-9 rounded-lg bg-maroon text-white flex items-center justify-center shadow-xs"
                  title="Open Scanner"
                >
                  <ScanLine className="w-[16px] h-[16px]" />
                </Link>

                {/* Page Refresh Button */}
                <button
                  onClick={handleRefresh}
                  type="button"
                  className="w-9 h-9 rounded-lg bg-white border border-stone-200 text-ink flex items-center justify-center hover:border-maroon/40 transition-colors shrink-0 shadow-xs cursor-pointer"
                  title="Refresh Page"
                >
                  <RefreshCw
                    className={`w-[16px] h-[16px] text-maroon ${
                      isRefreshing ? 'animate-spin' : ''
                    }`}
                  />
                </button>

                {/* User Profile Dropdown */}
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    type="button"
                    className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-white border border-stone-200 hover:border-maroon/40 transition-colors shrink-0 shadow-xs cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-lg bg-maroon text-white flex items-center justify-center font-outfit font-bold text-xs shrink-0">
                      {userInitials}
                    </div>
                    <div className="hidden sm:block text-left min-w-0">
                      <div className="font-outfit font-bold text-xs text-ink truncate max-w-[130px]">
                        {user?.name || user?.staffId || 'Administrator'}
                      </div>
                      <span className="inline-block text-[9px] font-extrabold px-1.5 py-0.2 bg-amber-100 text-amber-900 rounded border border-amber-200 uppercase">
                        {roleBadgeLabel}
                      </span>
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-stone-400 hidden sm:block" />
                  </button>

                  {/* Dropdown Menu */}
                  {userMenuOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl border border-stone-200 shadow-xl z-50 py-2">
                      <div className="px-4 py-2 border-b border-stone-100">
                        <p className="font-outfit font-bold text-xs text-ink truncate">
                          {user?.name || user?.staffId || 'Portal Administrator'}
                        </p>
                        <p className="text-[11px] text-ink-soft truncate">
                          {user?.email || user?.staffId || ''}
                        </p>
                        <div className="mt-1.5">
                          <span className="inline-flex items-center gap-1 text-[9px] font-extrabold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            {`${roleBadgeLabel} • OFFICIAL`}
                          </span>
                        </div>
                      </div>

                      <div className="py-1">
                        <Link
                          href="/admin/settings"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-ink hover:bg-cream-soft transition-colors"
                        >
                          <Settings className="w-3.5 h-3.5 text-stone-400" />
                          <span>Portal Settings</span>
                        </Link>
                        <a
                          href="/"
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-ink hover:bg-cream-soft transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-stone-400" />
                          <span>View Public Site</span>
                        </a>
                      </div>

                      <div className="pt-1 border-t border-stone-100">
                        <button
                          onClick={() => {
                            setUserMenuOpen(false);
                            handleLogout();
                          }}
                          className="w-full flex items-center gap-2 px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 text-left transition-colors cursor-pointer"
                        >
                          <LogOut className="w-3.5 h-3.5 text-rose-500" />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </header>

          {/* Main Body: Operational viewport with RBAC guard */}
          <main className="flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
            {!isAuthorized ? (
              <div className="max-w-xl mx-auto my-12 p-8 bg-white rounded-2xl border border-rose-200 shadow-sm text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-outfit font-bold text-ink">403 Access Denied</h2>
                <p className="text-sm text-ink-soft">
                  Your assigned role (<strong>{roleBadgeLabel}</strong>) does not have authorization
                  to access this operational module.
                </p>
                <div className="pt-2">
                  <Link
                    href={isScannerStaff ? '/scanner' : '/admin'}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-maroon text-white text-xs font-bold font-outfit hover:bg-maroon-dark transition-colors shadow-xs"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Return to {isScannerStaff ? 'Turnstile Scanner' : 'Dashboard'}</span>
                  </Link>
                </div>
              </div>
            ) : (
              children
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

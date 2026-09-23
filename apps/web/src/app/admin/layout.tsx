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
  CheckCircle2,
  ShieldAlert,
  Headphones,
  Sparkles,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';

interface AdminUser {
  id?: string;
  staffId?: string;
  name?: string;
  email?: string;
  role?: string;
  isDemo?: boolean;
  assignedGates?: any[];
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
  isSectionHeader?: string;
}

const ALL_NAV_ITEMS: NavItem[] = [
  // 1. Event Control
  {
    label: 'Event Control',
    href: '/admin/event-control',
    icon: Gauge,
    roles: ['SUPER_ADMIN', 'EVENT_ADMIN'],
  },
  // 2. Dashboard
  {
    label: 'Dashboard',
    href: '/admin',
    icon: LayoutDashboard,
    roles: ['SUPER_ADMIN', 'EVENT_ADMIN', 'GATE_MANAGER'],
  },
  // 3. Gates
  {
    label: 'Gates',
    href: '/admin/gates',
    icon: DoorOpen,
    roles: ['SUPER_ADMIN', 'EVENT_ADMIN', 'GATE_MANAGER'],
  },
  // 4. Staff Management
  {
    label: 'Staff',
    href: '/admin/staff',
    icon: Shield,
    roles: ['SUPER_ADMIN', 'EVENT_ADMIN'],
  },
  // 5. Attendee List
  {
    label: 'Attendee List',
    href: '/admin/attendees',
    icon: Users,
    roles: ['SUPER_ADMIN', 'EVENT_ADMIN', 'REGISTRATION_STAFF'],
  },
  // 6. Bulk Upload
  {
    label: 'Bulk Upload',
    href: '/admin/bulk-upload',
    icon: UploadCloud,
    roles: ['SUPER_ADMIN', 'EVENT_ADMIN', 'REGISTRATION_STAFF'],
  },
  // 7. Help Desk
  {
    label: 'Help Desk',
    href: '/admin/helpdesk',
    icon: LifeBuoy,
    roles: ['SUPER_ADMIN', 'EVENT_ADMIN', 'GATE_MANAGER', 'REGISTRATION_STAFF'],
  },
  // 8. Live Scanner
  {
    label: 'Live Scanner',
    href: '/scanner',
    icon: ScanLine,
    roles: ['SUPER_ADMIN', 'EVENT_ADMIN', 'GATE_MANAGER'],
  },
  // 9. Incidents
  {
    label: 'Incidents',
    href: '/admin/incidents',
    icon: AlertTriangle,
    roles: ['SUPER_ADMIN', 'EVENT_ADMIN', 'GATE_MANAGER'],
  },
  // 10. Daily Closing
  {
    label: 'Daily Closing',
    href: '/admin/daily-closing',
    icon: CalendarCheck,
    roles: ['SUPER_ADMIN', 'EVENT_ADMIN', 'GATE_MANAGER', 'REPORT_VIEWER'],
  },
  // 11. Reports
  {
    label: 'Reports',
    href: '/admin/reports',
    icon: BarChart3,
    roles: ['SUPER_ADMIN', 'EVENT_ADMIN', 'GATE_MANAGER', 'REPORT_VIEWER'],
  },
  // 12. Settings
  {
    label: 'Settings',
    href: '/admin/settings',
    icon: Settings,
    roles: ['SUPER_ADMIN', 'EVENT_ADMIN'],
  },
  // 13. Traffic Test Lab
  {
    label: 'Traffic / Scanner Test',
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
    label: 'Live Scanner',
    href: '/scanner',
    icon: ScanLine,
    roles: ['SCANNER_STAFF'],
  },
  {
    label: 'Help Desk',
    href: '/admin/helpdesk',
    icon: LifeBuoy,
    roles: ['SCANNER_STAFF'],
  },
  {
    label: 'Incidents',
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
      title: 'Operations Dashboard',
      subtitle: 'Live check-in monitoring, QR verification analytics, and gate operations.',
    };
  }
  if (pathname.startsWith('/admin/my-gate')) {
    return {
      title: 'My Gate Operations',
      subtitle: 'On-ground turnstile scanner station and shift summary.',
    };
  }
  if (pathname.startsWith('/admin/event-control')) {
    return {
      title: 'Event Control Console',
      subtitle: 'Central command for gates, scanning states, emergency controls, and operational dates.',
    };
  }
  if (pathname.startsWith('/admin/gates')) {
    return {
      title: 'Gate Management',
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
      title: 'Attendee Passes Directory',
      subtitle: 'Manage registered employees, family members, QR tickets, and entry status.',
    };
  }
  if (pathname.startsWith('/admin/bulk-upload')) {
    return {
      title: 'Bulk CSV Upload',
      subtitle: 'Upload, validate, and issue ticket batches with dry-run verification.',
    };
  }
  if (pathname.startsWith('/admin/helpdesk')) {
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
      title: 'Daily Closing Audit',
      subtitle: 'End-of-night operational reconciliation and official closing audit report.',
    };
  }
  if (pathname.startsWith('/admin/reports')) {
    return {
      title: 'Reports & Analytics',
      subtitle: 'Comprehensive gate throughput, attendance curves, and data exports.',
    };
  }
  if (pathname.startsWith('/admin/settings')) {
    return {
      title: 'System Settings',
      subtitle: 'Configure event dates, QR parameters, scanner thresholds, and security policies.',
    };
  }
  if (pathname.startsWith('/admin/traffic-test')) {
    return {
      title: 'Traffic / Scanner Test Lab',
      subtitle: 'High-throughput simulation lab to stress-test turnstiles and check-in APIs.',
    };
  }

  return {
    title: 'ONGC Entry Control',
    subtitle: 'Real-time registration, ticket verification, and gate access management.',
  };
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  // Authentication & User State
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

  // Operational Status from /event-control/status
  const [activeDate, setActiveDate] = useState('11 – 19 Oct 2026');
  const [eventStatus, setEventStatus] = useState<'open' | 'closed'>('open');
  const [scanningEnabled, setScanningEnabled] = useState(true);
  const [emergencyStopped, setEmergencyStopped] = useState(false);

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
      } catch (err: any) {
        // If unauthenticated, redirect to login
        if (isMounted) {
          try {
            localStorage.removeItem('ongc_admin_user');
          } catch {}
          router.push('/login');
        }
      }
    }

    loadUserProfile();
    return () => {
      isMounted = false;
    };
  }, [router]);

  // Fetch real event-control status periodically
  useEffect(() => {
    let isMounted = true;

    async function loadStatus() {
      try {
        const res = await fetchApi('/event-control/status');
        if (isMounted && res) {
          if (res.activeDate) setActiveDate(res.activeDate);
          if (res.eventStatus) setEventStatus(res.eventStatus);
          if (typeof res.scanningEnabled === 'boolean') setScanningEnabled(res.scanningEnabled);
          if (typeof res.emergencyStopped === 'boolean') setEmergencyStopped(res.emergencyStopped);
        }
      } catch {
        // Fallback gracefully without breaking UI
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
    router.push('/login');
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

  const pageMeta = getPageMeta(pathname);
  const userInitials = (user?.name || user?.staffId || 'Admin')
    .slice(0, 2)
    .toUpperCase();

  const roleBadgeLabel = user?.isDemo
    ? 'DEMO ADMIN'
    : normalizedRole.replace(/_/g, ' ');

  return (
    <div className="h-screen w-screen flex flex-col font-sans bg-cream text-ink selection:bg-maroon selection:text-white overflow-hidden">
      {/* Emergency Stop Top Alert Banner */}
      {emergencyStopped && (
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
                // If image fails, fallback to maroon badge
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

          {/* Navigation Links (Role-Filtered) */}
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

            {/* Support Hotline */}
            <div className="flex items-center gap-2.5 bg-white rounded-xl p-2.5 border border-stone-200/50">
              <div className="w-7 h-7 rounded-full bg-maroon/10 text-maroon flex items-center justify-center shrink-0">
                <Headphones className="w-3.5 h-3.5" />
              </div>
              <div className="text-[11px] min-w-0">
                <div className="font-semibold text-ink">Gate Operations Support</div>
                <div className="text-ink-soft truncate">+91 98250 00000</div>
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

              {/* Right: Operational Status, Event Date, Scanner Shortcut & User Menu */}
              <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
                {/* Event Operational Status */}
                {scanningEnabled && !emergencyStopped ? (
                  <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Gate Active</span>
                  </div>
                ) : (
                  <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                    <span>Scanning Suspended</span>
                  </div>
                )}

                {/* Event Operational Date */}
                <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-stone-200 text-xs font-semibold text-ink shadow-xs">
                  <Calendar className="w-[14px] h-[14px] text-maroon" />
                  <span>{activeDate}</span>
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
                  className="w-9 h-9 rounded-lg bg-white border border-stone-200 text-ink flex items-center justify-center hover:border-maroon/40 transition-colors shrink-0 shadow-xs"
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
                    className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-white border border-stone-200 hover:border-maroon/40 transition-colors shrink-0 shadow-xs"
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
                          {user?.email || 'admin@ongc.co.in'}
                        </p>
                        <div className="mt-1.5">
                          <span className="inline-flex items-center gap-1 text-[9px] font-extrabold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            {user?.isDemo
                              ? 'DEMO ACCESS • TEMPORARY'
                              : `${roleBadgeLabel} • OFFICIAL`}
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
                          className="w-full flex items-center gap-2 px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 text-left transition-colors"
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

          {/* Main Body: The scrollable operational viewport */}
          <main className="flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

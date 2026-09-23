'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Radio,
  DoorOpen,
  Users,
  Search,
  Headphones,
  AlertTriangle,
  BarChart3,
  CheckCheck,
  Activity,
  LogOut,
  ShieldAlert,
  ChevronRight,
  Menu,
  X,
  QrCode,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { label: 'Event Control', href: '/admin/event-control', icon: Radio },
  { label: 'Gates', href: '/admin/gates', icon: DoorOpen },
  { label: 'Staff Management', href: '/admin/staff', icon: Users },
  { label: 'Attendees & Passes', href: '/admin/attendees', icon: Search },
  { label: 'Help Desk Overrides', href: '/admin/helpdesk', icon: Headphones },
  { label: 'Incident Response', href: '/admin/incidents', icon: AlertTriangle },
  { label: 'Reports & Export', href: '/admin/reports', icon: BarChart3 },
  { label: 'Daily Closing', href: '/admin/daily-closing', icon: CheckCheck },
  { label: 'Traffic Test Lab', href: '/admin/traffic-test', icon: Activity },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [emergencyActive, setEmergencyActive] = useState(false);
  const [activeDate, setActiveDate] = useState('2026-09-23');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    async function loadStatus() {
      try {
        const res = await fetchApi('/admin/event-control/status');
        setEmergencyActive(res.isEmergencyStopped);
        setActiveDate(res.activeEventDate);
      } catch {}
    }
    loadStatus();
    const interval = setInterval(loadStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    try {
      await fetchApi('/auth/logout', { method: 'POST' });
    } catch {}
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-red-600">
      {/* Emergency Stop Top Alert Banner */}
      {emergencyActive && (
        <div className="bg-red-600 text-white px-4 py-2 text-center text-xs font-black tracking-widest uppercase flex items-center justify-center gap-2 shadow-lg">
          <ShieldAlert className="w-4 h-4 animate-bounce" />
          <span>ALL GATES EMERGENCY STOP ACTIVATED — ALL SCANNING SUSPENDED</span>
        </div>
      )}

      {/* Main Admin Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Mobile Sidebar Backdrop */}
        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          />
        )}

        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between transition-transform duration-200 lg:static lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div>
            {/* Sidebar Branding */}
            <div className="h-16 px-6 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-lg bg-red-600 text-white font-black flex items-center justify-center text-xs shadow-md">
                  ओ
                </span>
                <div>
                  <span className="font-extrabold text-sm tracking-tight text-white block">
                    ONGC COMMAND
                  </span>
                  <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block">
                    Active: {activeDate}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Links */}
            <nav className="p-3 space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-red-600 text-white shadow-lg shadow-red-900/30'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Sidebar Footer */}
          <div className="p-4 border-t border-slate-800 space-y-2">
            <Link
              href="/scanner"
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-amber-950/60 border border-amber-500/30 text-amber-300 text-xs font-bold hover:bg-amber-900/40 transition-colors"
            >
              <QrCode className="w-4 h-4" />
              Open Turnstile Scanner
            </Link>

            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </button>
          </div>
        </aside>

        {/* Content Body */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          {/* Top Bar */}
          <header className="h-16 px-6 border-b border-slate-800 bg-slate-900/40 backdrop-blur flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white lg:hidden"
              >
                <Menu className="w-5 h-5" />
              </button>
              <h1 className="font-bold text-base text-white capitalize">
                {pathname.replace('/admin/', '').replace('/admin', 'Operations Dashboard') || 'Dashboard'}
              </h1>
            </div>

            <div className="flex items-center gap-4 text-xs">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Timezone: Asia/Kolkata (IST)</span>
              </div>
            </div>
          </header>

          <main className="p-6 flex-1">{children}</main>
        </div>
      </div>
    </div>
  );
}

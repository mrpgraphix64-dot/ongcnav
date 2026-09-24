'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Lock,
  User,
  ShieldCheck,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Info,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';

export default function AdminLoginPage() {
  const router = useRouter();

  const [identifier, setIdentifier] = useState('admin@ongc.co.in');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetchApi('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          identifier: identifier.trim(),
          password,
        }),
      });

      if (res?.user) {
        try {
          localStorage.setItem('ongc_admin_user', JSON.stringify(res.user));
        } catch {}
      }

      const role = String(res?.user?.role || '').toUpperCase();
      if (role === 'SCANNER_STAFF' || role === 'GATE_OPERATOR') {
        router.push('/scanner');
      } else {
        router.push('/admin');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid credentials. Enter your registered Staff Email or Staff ID.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setError(null);
    setLoading(true);

    try {
      // First attempt official demo auth endpoint
      let res;
      try {
        res = await fetchApi('/auth/demo', { method: 'POST' });
      } catch {
        // Fallback to standard admin fallback credentials
        res = await fetchApi('/auth/login', {
          method: 'POST',
          body: JSON.stringify({
            identifier: 'admin@ongc.co.in',
            password: 'admin123',
          }),
        });
      }

      if (res?.user) {
        try {
          localStorage.setItem('ongc_admin_user', JSON.stringify(res.user));
        } catch {}
      }

      const role = String(res?.user?.role || '').toUpperCase();
      if (role === 'SCANNER_STAFF' || role === 'GATE_OPERATOR') {
        router.push('/scanner');
      } else {
        router.push('/admin');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to authenticate demo admin session.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen font-sans bg-cream text-ink flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 relative selection:bg-maroon selection:text-white">
      {/* Background decorative ambient circles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-maroon/5 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-gold/10 blur-3xl" />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        {/* Login Card Container */}
        <div className="bg-white rounded-3xl border border-stone-200/80 card-shadow p-7 sm:p-9 relative overflow-hidden">
          {/* Subtle gold accent bar at top */}
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-maroon via-gold to-maroon" />

          {/* Dot pattern subtle accent */}
          <div className="absolute top-0 right-0 w-32 h-32 dot-texture opacity-30 pointer-events-none" />

          {/* Top Header & Branding */}
          <div className="text-center space-y-3 pb-6 border-b border-stone-100">
            <div className="flex justify-center">
              <img
                src="/images/logo-web.png"
                alt="ONGC Logo"
                className="h-14 w-auto max-w-[200px] object-contain"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                  const fallback = (e.target as HTMLElement).nextElementSibling;
                  if (fallback) fallback.classList.remove('hidden');
                }}
              />
              <div className="hidden h-12 w-12 rounded-2xl bg-maroon text-white flex items-center justify-center font-outfit font-black text-lg">
                ONGC
              </div>
            </div>

            <div className="space-y-0.5">
              <div className="font-outfit font-extrabold text-xs tracking-widest uppercase text-maroon">
                ONGC NAVRATRI
              </div>
              <div className="font-outfit font-black text-[15px] tracking-wider uppercase text-ink">
                ENTRY CONTROL PORTAL
              </div>
            </div>

            <div className="pt-2">
              <h2 className="text-2xl font-outfit font-bold text-ink">Welcome Back</h2>
              <p className="text-xs text-ink-soft mt-1">
                Sign in to manage registrations, tickets and entry operations.
              </p>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Standard Login Form */}
          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-ink-soft mb-1.5">
                Email / Admin ID
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  required
                  placeholder="admin@ongc.co.in"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white border border-stone-200 text-ink placeholder-stone-400 text-sm focus:outline-none focus:border-maroon focus:ring-1 focus:ring-maroon"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-soft mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white border border-stone-200 text-ink placeholder-stone-400 text-sm focus:outline-none focus:border-maroon focus:ring-1 focus:ring-maroon"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-maroon text-white font-outfit font-bold text-sm hover:bg-maroon-dark transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-60 cursor-pointer"
              >
                <span>{loading ? 'AUTHENTICATING...' : 'LOGIN'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>

          {/* Quick Demo Bypass */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-stone-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-3 text-ink-soft font-medium">or quick testing</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDemoLogin}
            disabled={loading}
            className="w-full group relative flex flex-col items-center justify-center p-3.5 rounded-xl bg-gradient-to-r from-cream-soft to-gold/15 border-2 border-gold/60 text-maroon font-outfit font-bold hover:border-maroon hover:bg-gold/25 transition-all duration-200 cursor-pointer disabled:opacity-60"
          >
            <div className="flex items-center gap-2 text-sm">
              <ShieldCheck className="w-4 h-4 text-maroon group-hover:scale-110 transition-transform" />
              <span>CONTINUE AS ADMIN</span>
            </div>
            <span className="text-[11px] font-medium text-amber-800 tracking-wide mt-0.5">
              Demo access &bull; Temporary
            </span>
          </button>

          {/* Bottom Back link */}
          <div className="mt-6 text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft hover:text-maroon transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to ONGC Navratri Homepage</span>
            </Link>
          </div>
        </div>

        {/* Footer Notice */}
        <p className="mt-6 text-center text-xs text-ink-soft">
          ONGC Navratri 2026 &middot; Entry Control System &middot; Authorized Personnel Only
        </p>
      </div>
    </div>
  );
}

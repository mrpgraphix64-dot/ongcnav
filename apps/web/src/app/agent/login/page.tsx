'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Lock,
  Mail,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Ticket,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { setStoredAuthUser } from '@/lib/auth-session';
import PasswordInput from '@/components/PasswordInput';

function AgentLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
          identifier: email.trim(),
          password,
        }),
      });

      if (res?.user) {
        setStoredAuthUser(res.user);
      }

      const role = String(res?.user?.role || '').toUpperCase();
      if (role === 'COMMERCIAL_AGENT' || role === 'COMMERCIAL_SUB_AGENT') {
        if (redirectUrl && redirectUrl.startsWith('/agent')) {
          router.push(redirectUrl);
        } else {
          router.push('/agent');
        }
      } else if (role === 'SUPER_ADMIN' || role === 'COMMERCIAL_ADMIN') {
        router.push(redirectUrl || '/admin/commercial/orders');
      } else {
        router.push('/agent');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid credentials. Please verify your registered agent email and password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen font-sans bg-cream text-ink flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 relative selection:bg-maroon selection:text-white">
      {/* Background ambient decorative shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-maroon/5 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-gold/10 blur-3xl" />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-white rounded-3xl border border-stone-200/80 shadow-xl p-7 sm:p-9 relative overflow-hidden">
          {/* Gold & Maroon gradient accent line */}
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-maroon via-gold to-maroon" />

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
              <div className="font-outfit font-extrabold text-xs tracking-widest uppercase text-maroon flex items-center justify-center gap-1.5">
                <Ticket className="w-3.5 h-3.5 text-gold" />
                <span>ONGC NAVRATRI 2026</span>
              </div>
              <div className="font-outfit font-black text-lg tracking-wider uppercase text-ink">
                E-Pass Agent Portal
              </div>
            </div>

            <div className="pt-2">
              <h2 className="text-xl font-outfit font-bold text-ink">Agent Sign In</h2>
              <p className="text-xs text-ink-soft mt-1">
                Enter your registered agent email to access offline pass booking and inventory distribution.
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

          {/* Agent Login Form */}
          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-ink-soft mb-1.5">
                Agent Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="email"
                  required
                  autoComplete="username"
                  placeholder="agent@domain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white border border-stone-200 text-ink placeholder-stone-400 text-sm focus:outline-none focus:border-maroon focus:ring-1 focus:ring-maroon"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-ink-soft">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-semibold text-maroon hover:text-maroon-dark transition-colors"
                >
                  Forgot Password?
                </Link>
              </div>
              <PasswordInput
                required
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                iconLeft={<Lock className="w-4 h-4" />}
                className="w-full py-2.5 rounded-xl bg-white border border-stone-200 text-ink placeholder-stone-400 text-sm focus:outline-none focus:border-maroon focus:ring-1 focus:ring-maroon"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-maroon text-white font-outfit font-bold text-sm hover:bg-maroon-dark transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-60 cursor-pointer"
              >
                <span>{loading ? 'AUTHENTICATING...' : 'SIGN IN TO AGENT PORTAL'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>

          {/* Navigation link */}
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
          ONGC Navratri 2026 &middot; Official E-Pass Distribution Network &middot; Authorized Agents Only
        </p>
      </div>
    </div>
  );
}

export default function AgentLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-cream" />}>
      <AgentLoginForm />
    </Suspense>
  );
}

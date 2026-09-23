'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Lock,
  User,
  ShieldCheck,
  AlertCircle,
  LogIn,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { UserRole } from '@ongc/shared-types';

export default function LoginPage() {
  const router = useRouter();

  const [identifier, setIdentifier] = useState('admin@ongcnavratri.in');
  const [password, setPassword] = useState('Admin@2026');
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

      // Redirect based on user role
      if (res.user.role === UserRole.GATE_OPERATOR) {
        router.push('/scanner');
      } else {
        router.push('/admin');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid email/Staff ID or password');
    } finally {
      setLoading(false);
    }
  };

  const quickDemoLogin = (role: UserRole) => {
    if (role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN) {
      setIdentifier('admin@ongcnavratri.in');
      setPassword('Admin@2026');
    } else if (role === UserRole.GATE_SUPERVISOR) {
      setIdentifier('supervisor@ongcnavratri.in');
      setPassword('Supervisor@2026');
    } else if (role === UserRole.GATE_OPERATOR) {
      setIdentifier('operator@ongcnavratri.in');
      setPassword('Operator@2026');
    } else if (role === UserRole.HELP_DESK) {
      setIdentifier('helpdesk@ongcnavratri.in');
      setPassword('HelpDesk@2026');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between selection:bg-red-600">
      <header className="p-4 border-b border-slate-800 bg-slate-900/60 backdrop-blur">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-white text-base">
            <span className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center text-white font-black text-xs">
              ओ
            </span>
            <span>ONGC Navratri Entry System</span>
          </Link>
          <Link
            href="/"
            className="text-xs font-semibold text-slate-400 hover:text-white"
          >
            ← Public Portal
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-red-950/60 border border-red-500/30 text-red-400 flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-black text-white">Staff & Admin Login</h1>
            <p className="text-xs text-slate-400">
              Access turnstile scanner, gate control, reports, and traffic test lab.
            </p>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-red-950/60 border border-red-500/40 flex items-center gap-2.5 text-xs text-red-200">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Email or Staff ID
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  required
                  placeholder="admin@ongcnavratri.in"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:border-red-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:border-red-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-red-900/40 transition-all disabled:opacity-50"
            >
              {loading ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Fill Buttons */}
          <div className="pt-4 border-t border-slate-800 space-y-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block text-center">
              Quick Role Switch (Demo Mode)
            </span>
            <div className="grid grid-cols-2 gap-2 text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => quickDemoLogin(UserRole.SUPER_ADMIN)}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-left"
              >
                👑 Super Admin
              </button>
              <button
                type="button"
                onClick={() => quickDemoLogin(UserRole.GATE_SUPERVISOR)}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-left"
              >
                🛡️ Gate Supervisor
              </button>
              <button
                type="button"
                onClick={() => quickDemoLogin(UserRole.GATE_OPERATOR)}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-left"
              >
                📱 Gate Operator
              </button>
              <button
                type="button"
                onClick={() => quickDemoLogin(UserRole.HELP_DESK)}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-left"
              >
                🎧 Help Desk
              </button>
            </div>
          </div>
        </div>
      </main>

      <footer className="p-4 border-t border-slate-800 text-center text-xs text-slate-500">
        ONGC Entry Management Architecture 2.0 • Secured with JWT & Session Cookies
      </footer>
    </div>
  );
}

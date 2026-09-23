'use client';

import React from 'react';
import Link from 'next/link';
import { Settings, Clock, ArrowLeft, LayoutDashboard } from 'lucide-react';

export default function SettingsPendingPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white rounded-2xl border border-stone-200/80 p-8 card-shadow space-y-6">
        <div className="flex items-center gap-3 border-b border-stone-100 pb-5">
          <div className="w-12 h-12 rounded-2xl bg-maroon/10 text-maroon flex items-center justify-center">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-outfit font-bold text-2xl text-ink">
              System &amp; Event Settings
            </h1>
            <p className="text-xs text-ink-soft">
              Configure event dates, QR parameters, turnstile thresholds, and security policies.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3 text-amber-900 text-xs">
          <Clock className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block text-sm font-outfit text-amber-950">
              Phase 1 Migration Notice: Feature Implementation Pending
            </span>
            <p className="mt-1">
              The Admin Shell, Role-Based Navigation, and Route structure for <code>/admin/settings</code> are active. The 7 configuration tabs (General, Event, QR, Scanner, Notifications, Security, Gates) and Danger Zone Reset controls will be connected in Phase 11 (Settings &amp; Configuration).
            </p>
          </div>
        </div>

        <div className="pt-2">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-maroon text-white font-outfit font-bold text-xs hover:bg-maroon-dark transition-all shadow-xs"
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Return to Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

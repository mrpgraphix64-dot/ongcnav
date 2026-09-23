'use client';

import React from 'react';
import Link from 'next/link';
import { DoorOpen, ScanLine, LifeBuoy, Clock } from 'lucide-react';

export default function MyGatePage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white rounded-2xl border border-stone-200/80 p-8 card-shadow space-y-6">
        <div className="flex items-center gap-3 border-b border-stone-100 pb-5">
          <div className="w-12 h-12 rounded-2xl bg-maroon/10 text-maroon flex items-center justify-center">
            <DoorOpen className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-outfit font-bold text-2xl text-ink">
              My Gate Operations Console
            </h1>
            <p className="text-xs text-ink-soft">
              Stationary gate management and shift statistics for scanner operators.
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
              The Admin Shell, Role-Based Navigation, and Authenticated Session Routing for <code>/admin/my-gate</code> are active. Full real-time gate metrics and shift logs will be connected in Phase 5 (Staff &amp; Gate Console).
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <Link
            href="/scanner"
            className="flex items-center gap-4 p-5 rounded-xl bg-maroon text-white font-outfit font-bold hover:bg-maroon-dark transition-all shadow-md group"
          >
            <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
              <ScanLine className="w-5 h-5 text-gold-light" />
            </div>
            <div>
              <div className="text-sm">Launch Live Scanner</div>
              <div className="text-[11px] font-normal text-white/80">Open camera turnstile viewfinder</div>
            </div>
          </Link>

          <Link
            href="/admin/helpdesk"
            className="flex items-center gap-4 p-5 rounded-xl bg-cream-soft border border-stone-200 text-ink font-outfit font-bold hover:border-maroon/40 transition-all shadow-xs"
          >
            <div className="w-10 h-10 rounded-lg bg-maroon/10 flex items-center justify-center">
              <LifeBuoy className="w-5 h-5 text-maroon" />
            </div>
            <div>
              <div className="text-sm">Help Desk Manual Lookup</div>
              <div className="text-[11px] font-normal text-ink-soft">Resolve disputed passes &amp; manual entry</div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}

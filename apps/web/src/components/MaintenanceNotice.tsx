'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Clock, ShieldCheck, Ticket } from 'lucide-react';
import { fetchApi } from '@/lib/api';

export default function MaintenanceNotice({
  children,
  pageType = 'registration',
}: {
  children: React.ReactNode;
  pageType?: 'registration' | 'booking';
}) {
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function checkMaintenance() {
      try {
        const res = await fetchApi('/public/maintenance-status');
        if (mounted && res?.maintenance) {
          setIsMaintenance(true);
        }
      } catch {
        // Fallback to active if check fails
      } finally {
        if (mounted) setChecking(false);
      }
    }
    checkMaintenance();
    return () => {
      mounted = false;
    };
  }, []);

  if (checking) {
    return <>{children}</>;
  }

  if (isMaintenance) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl border border-amber-200/80 shadow-xl p-8 text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto shadow-inner">
            <AlertTriangle className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-extrabold bg-amber-100 text-amber-900 border border-amber-300 uppercase tracking-wide">
              System Maintenance Active
            </span>
            <h2 className="font-outfit font-black text-2xl text-stone-900">
              {pageType === 'booking' ? 'Pass Purchasing Paused' : 'Registration Paused'}
            </h2>
            <p className="text-sm text-stone-600 leading-relaxed">
              Online {pageType === 'booking' ? 'pass booking' : 'employee pass registration'} is temporarily paused for scheduled system maintenance.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 text-left space-y-2 text-xs text-stone-700">
            <div className="flex items-center gap-2 font-bold text-stone-800">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Gate Operations Normal</span>
            </div>
            <p className="text-stone-600 leading-normal">
              QR pass scanning, turnstiles, and entry checkpoints remain fully functional for all issued tickets.
            </p>
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <Link
              href="/my-tickets"
              className="w-full py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm transition shadow-sm flex items-center justify-center gap-2"
            >
              <Ticket className="w-4 h-4" />
              <span>View / Download Existing Passes</span>
            </Link>
            <Link
              href="/"
              className="w-full py-2.5 px-4 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-xs transition"
            >
              Return to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

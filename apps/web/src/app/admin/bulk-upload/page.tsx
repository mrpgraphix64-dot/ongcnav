'use client';

import React from 'react';
import Link from 'next/link';
import { UploadCloud, Clock, ArrowLeft, Users } from 'lucide-react';

export default function BulkUploadPendingPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white rounded-2xl border border-stone-200/80 p-8 card-shadow space-y-6">
        <div className="flex items-center gap-3 border-b border-stone-100 pb-5">
          <div className="w-12 h-12 rounded-2xl bg-maroon/10 text-maroon flex items-center justify-center">
            <UploadCloud className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-outfit font-bold text-2xl text-ink">
              Bulk CSV Attendee Upload
            </h1>
            <p className="text-xs text-ink-soft">
              Interactive 2-step CSV import wizard with dry-run validation and batch ticket issuance.
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
              The Admin Shell, Role-Based Navigation, and Route structure for <code>/admin/bulk-upload</code> are active. The interactive 2-step CSV validation wizard, inline correction table, and batch ticket generator will be fully migrated in Phase 6 (Attendees, Passes &amp; Bulk Upload).
            </p>
          </div>
        </div>

        <div className="pt-2">
          <Link
            href="/admin/attendees"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-maroon text-white font-outfit font-bold text-xs hover:bg-maroon-dark transition-all shadow-xs"
          >
            <Users className="w-4 h-4" />
            <span>Go to Attendee List</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

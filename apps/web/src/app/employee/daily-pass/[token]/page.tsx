'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Printer,
  Download,
  Share2,
  ArrowLeft,
  AlertTriangle,
  Calendar,
  MapPin,
  Clock,
  ShieldCheck,
  Ticket as TicketIcon,
  CheckCircle2,
} from 'lucide-react';
import {
  PublicDailyPassResponseDto,
  getEventDayTheme,
  buildDailyEmployeePassPresentation,
  DailyEmployeePassPresentation,
} from '@/types/shared-types';
import { fetchApi } from '@/lib/api';
import DailyEmployeeTicketCard from '@/components/pass/DailyEmployeeTicketCard';

export default function EmployeeDailyPassPage() {
  const params = useParams();
  const token = params.token as string;

  const [pass, setPass] = useState<PublicDailyPassResponseDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const pdfDownloadUrl = `${apiBaseUrl}/public/employee/daily-pass/${token}/pdf`;

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [token, loading]);

  useEffect(() => {
    async function loadPass() {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchApi<PublicDailyPassResponseDto>(`/public/employee/daily-pass/${token}`);
        setPass(data);
      } catch (err: any) {
        setError(err.message || 'Unable to retrieve this daily entry pass.');
      } finally {
        setLoading(false);
      }
    }

    if (token) {
      loadPass();
    }
  }, [token]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-24 px-4">
        <div className="w-12 h-12 border-4 border-maroon border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-maroon font-bold text-sm">Loading Official Event Pass...</p>
        <p className="text-stone-400 text-xs mt-1">Verifying encrypted pass token</p>
      </div>
    );
  }

  if (error || !pass) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 px-4">
        <div className="bg-white border border-stone-200 p-8 rounded-3xl shadow-lg max-w-md w-full text-center space-y-4">
          <div className="w-14 h-14 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold font-cinzel text-maroon">Pass Not Found or Inactive</h1>
          <p className="text-xs text-ink-soft leading-relaxed">
            {error || 'This digital pass could not be found or has not been released yet.'}
          </p>
          <div className="pt-3">
            <Link
              href="/employee/my-tickets"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-maroon text-white font-bold text-xs hover:bg-maroon-dark transition-all shadow-xs"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Pass Lookup</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const presentation: DailyEmployeePassPresentation =
    pass.presentation ||
    buildDailyEmployeePassPresentation({
      eventDate: pass.eventDate,
      ticketNumber: pass.ticketNumber,
      qrToken: pass.token,
      status: pass.status,
      attendeeName: pass.attendeeName,
      isFamily: pass.isFamily,
      relation: pass.relation,
      employeeName: pass.employeeName,
      employeeCpf: pass.employeeCpf,
      department: pass.department,
    });

  const waShareText = encodeURIComponent(
    `Official ONGC Navratri 2026 E-Pass\nNight ${presentation.nightNumber}: ${presentation.themeTitle} (${presentation.eventDateFormatted})\nAttendee: ${presentation.attendeeName}\nRef No: ${presentation.referenceNumber || presentation.employeeCpf}\nVenue: Malaviya Cricket Ground ONGC, Ahmedabad\nGates Open: 7:00 PM\n\nView Online: ${typeof window !== 'undefined' ? window.location.href : ''}`
  );

  return (
    <div className="flex-1 py-8 px-4 sm:px-6 max-w-2xl mx-auto w-full print:p-0 print:max-w-none">
      {/* Top Navigation & Quick Actions (Hidden in Print) */}
      <div className="flex items-center justify-between gap-3 mb-6 print:hidden">
        <Link
          href="/employee/my-tickets"
          className="text-xs font-semibold text-stone-600 hover:text-maroon flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>My Passes</span>
        </Link>

        <div className="flex items-center gap-2">
          <a
            href={pdfDownloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            download={`ONGC-Pass-${presentation.referenceNumber || presentation.employeeCpf}.pdf`}
            className="px-3.5 py-1.5 rounded-xl bg-maroon text-white text-xs font-bold hover:bg-maroon-dark transition-all shadow-xs flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download PDF</span>
          </a>

          <button
            onClick={() => window.print()}
            type="button"
            className="px-3 py-1.5 rounded-xl bg-white border border-stone-200 text-stone-700 text-xs font-bold hover:bg-stone-50 transition-colors shadow-xs flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Print</span>
          </button>
        </div>
      </div>

      {/* Main Ticket Card Container using Shared Component */}
      <DailyEmployeeTicketCard
        presentation={presentation}
        qrSvg={pass.qrSvg}
      />

      {/* Action Buttons Below Ticket (Hidden in Print) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 print:hidden">
        <a
          href={pdfDownloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          download={`ONGC-Pass-${pass.ticketNumber}.pdf`}
          className="py-3 px-4 rounded-xl bg-maroon text-white text-xs font-bold hover:bg-maroon-dark transition-all flex items-center justify-center gap-2 shadow-xs"
        >
          <Download className="w-4 h-4" />
          <span>Download PDF Ticket</span>
        </a>

        <button
          onClick={() => window.print()}
          type="button"
          className="py-3 px-4 rounded-xl bg-white border border-stone-200 text-stone-700 text-xs font-bold hover:bg-stone-50 transition-colors flex items-center justify-center gap-2 shadow-xs"
        >
          <Printer className="w-4 h-4 text-maroon" />
          <span>Print Pass</span>
        </button>

        <a
          href={`https://wa.me/?text=${waShareText}`}
          target="_blank"
          rel="noopener noreferrer"
          className="py-3 px-4 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 shadow-xs"
        >
          <Share2 className="w-4 h-4" />
          <span>Share Pass</span>
        </a>
      </div>
    </div>
  );
}

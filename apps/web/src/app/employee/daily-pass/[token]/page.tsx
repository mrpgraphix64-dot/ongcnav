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
import { fetchApi } from '@/lib/api';
import { PublicDailyPassResponseDto, getEventDayTheme } from '@/types/shared-types';

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

  const theme = pass.dayTheme || getEventDayTheme(pass.eventDate);
  const waShareText = encodeURIComponent(
    `Official ONGC Navratri 2026 E-Pass\nDay ${theme.dayNumber}: ${theme.themeTitle} (${theme.fullDateLabel})\nAttendee: ${pass.attendeeName}\nTicket No: ${pass.ticketNumber}\nVenue: Malaviya Cricket Ground ONGC, Ahmedabad\nGates Open: 7:00 PM\n\nView Online: ${typeof window !== 'undefined' ? window.location.href : ''}`
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
            download={`ONGC-Pass-${pass.ticketNumber}.pdf`}
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

      {/* Main Ticket Card Container */}
      <div
        className="bg-white rounded-3xl shadow-xl border-2 overflow-hidden print:shadow-none print:border print:rounded-none"
        style={{ borderColor: theme.secondaryColor }}
      >
        {/* Top Header Banner with Theme Primary Color */}
        <div
          className="px-6 py-4 text-center text-white relative"
          style={{ backgroundColor: theme.primaryColor }}
        >
          <p className="text-[10px] sm:text-xs font-semibold tracking-widest uppercase opacity-90">
            Oil and Natural Gas Corporation Limited
          </p>
          <h1 className="font-cinzel text-xl sm:text-2xl font-bold tracking-wide mt-0.5">
            ONGC NAVRATRI 2026
          </h1>
          <p
            className="text-[11px] sm:text-xs font-bold tracking-wider uppercase mt-1"
            style={{ color: theme.secondaryColor }}
          >
            Official Employee &amp; Family Entry Pass
          </p>
        </div>

        {/* Hero Day & Theme Strip */}
        <div
          className="border-b px-6 py-4 flex items-center gap-4"
          style={{
            backgroundColor: theme.bgColor,
            borderColor: `${theme.secondaryColor}40`,
          }}
        >
          {/* Day Number Block */}
          <div
            className="flex flex-col items-center justify-center rounded-2xl px-3.5 py-2 shrink-0 border"
            style={{
              backgroundColor: '#FFFFFF',
              borderColor: theme.secondaryColor,
              minWidth: '70px',
            }}
          >
            <span
              className="text-3xl sm:text-4xl font-black leading-none"
              style={{ color: theme.primaryColor }}
            >
              {theme.dayLabel}
            </span>
            <span
              className="text-[10px] font-bold uppercase tracking-wider mt-0.5"
              style={{ color: theme.secondaryColor }}
            >
              {theme.monthLabel}
            </span>
          </div>

          {/* Theme Information */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md tracking-wider text-white"
                style={{ backgroundColor: theme.primaryColor }}
              >
                DAY {theme.dayNumber} OF 9
              </span>
              <span className="text-[11px] font-bold text-stone-600 uppercase tracking-wide">
                {theme.dayOfWeek}
              </span>
            </div>
            <h2
              className="text-lg sm:text-xl font-bold font-cinzel leading-snug mt-1 truncate"
              style={{ color: theme.primaryColor }}
            >
              {theme.themeTitle}
            </h2>
            <p className="text-xs text-stone-600 flex items-center gap-1.5 mt-0.5">
              <span>Motif:</span>
              <span className="font-semibold text-stone-800">{theme.motifName}</span>
            </p>
          </div>
        </div>

        {/* Ticket Content Body */}
        <div className="p-6 space-y-6">
          {/* Attendee Details Card */}
          <div className="bg-stone-50 rounded-2xl p-4 border border-stone-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 border-b border-stone-200/80 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                  Attendee Name
                </span>
                <h3 className="text-lg sm:text-xl font-bold text-stone-900 leading-tight">
                  {pass.attendeeName}
                </h3>
              </div>
              <span
                className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide border self-start sm:self-auto"
                style={{
                  backgroundColor: `${theme.primaryColor}15`,
                  color: theme.primaryColor,
                  borderColor: `${theme.primaryColor}30`,
                }}
              >
                {pass.passType}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-stone-500 text-[10px] uppercase font-medium">Ticket Number</p>
                <p className="font-mono font-bold text-stone-800 text-sm mt-0.5">{pass.ticketNumber}</p>
              </div>
              <div>
                <p className="text-stone-500 text-[10px] uppercase font-medium">Valid Date</p>
                <p className="font-bold text-sm mt-0.5" style={{ color: theme.primaryColor }}>
                  {theme.fullDateLabel}
                </p>
              </div>
              <div>
                <p className="text-stone-500 text-[10px] uppercase font-medium">Employee Reference</p>
                <p className="font-medium text-stone-800 mt-0.5">
                  {pass.employeeName} <span className="text-stone-500">({pass.employeeCpf})</span>
                </p>
              </div>
              <div>
                <p className="text-stone-500 text-[10px] uppercase font-medium">Department / Location</p>
                <p className="font-medium text-stone-800 mt-0.5">{pass.department}</p>
              </div>
            </div>
          </div>

          {/* Pure White QR Code Display Box */}
          <div className="flex flex-col items-center justify-center p-6 bg-white rounded-2xl border-2 border-dashed border-stone-300 relative">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-stone-200 flex items-center justify-center w-56 h-56 max-w-full">
              {pass.qrSvg ? (
                <div
                  className="w-full h-full flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:max-w-full"
                  dangerouslySetInnerHTML={{ __html: pass.qrSvg }}
                />
              ) : (
                <div className="text-xs text-stone-400">QR Code Unavailable</div>
              )}
            </div>

            {/* Date-specific Validation Alert Badge */}
            <div
              className="mt-4 px-4 py-1.5 rounded-full text-center text-xs font-bold tracking-wide uppercase border flex items-center gap-1.5"
              style={{
                backgroundColor: theme.bgColor,
                color: theme.primaryColor,
                borderColor: theme.secondaryColor,
              }}
            >
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>Valid strictly on {theme.fullDateLabel}</span>
            </div>

            <p className="text-[11px] text-stone-500 mt-2 text-center font-medium">
              Single-scan entry pass for designated employee gates. Non-transferable.
            </p>
          </div>

          {/* Venue & Event Guidelines */}
          <div className="rounded-2xl p-4 bg-amber-50/50 border border-amber-200/60 text-xs space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-amber-900 uppercase tracking-wide text-[11px]">
              <MapPin className="w-3.5 h-3.5 text-amber-700" />
              <span>Venue &amp; Entry Guidelines</span>
            </div>
            <p className="font-semibold text-stone-800">
              {pass.venue.name}, {pass.venue.address}
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-stone-600 text-[11px] pt-1 border-t border-amber-200/40">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-700" /> Gates Open: {pass.venue.gatesOpen}
              </span>
              <span>•</span>
              <span>Organizer: {pass.organizer}</span>
            </div>
            <p className="text-[10px] text-amber-800 leading-relaxed pt-1">
              Important: Please present this digital QR or the printed PDF pass at the gate. Turnstile scanners will reject passes scanned on the wrong date or scanned more than once.
            </p>
          </div>
        </div>

        {/* Footer Security Notice */}
        <div className="bg-stone-100 px-6 py-3 border-t border-stone-200 text-center">
          <p className="text-[10px] text-stone-500">
            Pass Token: <span className="font-mono">{pass.token.substring(0, 16)}...</span> • Official ONGC Entry E-Pass
          </p>
        </div>
      </div>

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

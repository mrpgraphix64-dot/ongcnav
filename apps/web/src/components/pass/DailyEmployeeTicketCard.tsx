'use client';

import React from 'react';
import {
  MapPin,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Sparkles,
  User,
  Users,
} from 'lucide-react';
import { DailyEmployeePassPresentation } from '@/types/shared-types';

interface DailyEmployeeTicketCardProps {
  presentation: DailyEmployeePassPresentation;
  qrSvg?: string | null;
  className?: string;
  showSecurityFooter?: boolean;
}

export default function DailyEmployeeTicketCard({
  presentation,
  qrSvg,
  className = '',
  showSecurityFooter = true,
}: DailyEmployeeTicketCardProps) {
  const theme = presentation.theme;

  return (
    <div
      className={`bg-white rounded-3xl shadow-xl border-2 overflow-hidden print:shadow-none print:border print:rounded-none transition-colors ${className}`}
      style={{ borderColor: theme.secondaryColor }}
    >
      {/* Top Accent Strip & Header */}
      <div
        className="px-6 py-4 text-center bg-white border-b-2 relative"
        style={{
          borderTop: `5px solid ${theme.primaryColor}`,
          borderColor: `${theme.secondaryColor}40`,
        }}
      >
        <p className="text-[10px] sm:text-xs font-semibold tracking-widest uppercase text-stone-500">
          Oil and Natural Gas Corporation Limited
        </p>
        <h1
          className="font-cinzel text-xl sm:text-2xl font-black tracking-wide mt-0.5"
          style={{ color: theme.primaryColor }}
        >
          ONGC NAVRATRI 2026
        </h1>
        <p
          className="text-[11px] sm:text-xs font-bold tracking-wider uppercase mt-0.5"
          style={{ color: theme.secondaryColor }}
        >
          Official Employee &amp; Family Entry Pass
        </p>
      </div>

      {/* Prominent Hero Night & Date Banner */}
      <div
        className="border-b px-6 py-4 flex items-center gap-4 transition-colors"
        style={{
          backgroundColor: theme.bgColor,
          borderColor: `${theme.secondaryColor}50`,
        }}
      >
        {/* Big Day Number Block */}
        <div
          className="flex flex-col items-center justify-center rounded-2xl px-3.5 py-2.5 shrink-0 border shadow-xs"
          style={{
            backgroundColor: '#FFFFFF',
            borderColor: theme.secondaryColor,
            minWidth: '72px',
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
              className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full tracking-wider text-white shadow-xs"
              style={{ backgroundColor: theme.primaryColor }}
            >
              NIGHT {presentation.nightNumber} OF 9
            </span>
            <span
              className="text-[11px] font-bold uppercase tracking-wider"
              style={{ color: theme.secondaryColor }}
            >
              {theme.dayOfWeek}
            </span>
          </div>

          <h2
            className="text-lg sm:text-2xl font-black font-cinzel leading-tight mt-1 truncate"
            style={{ color: theme.primaryColor }}
          >
            NIGHT {presentation.nightNumber} &bull; {presentation.themeTitle}
          </h2>

          <div className="flex items-center gap-2 text-xs text-stone-600 mt-0.5 flex-wrap">
            <span className="font-semibold text-stone-700">
              Valid Strictly: <strong style={{ color: theme.primaryColor }}>{presentation.eventDateFormatted}</strong>
            </span>
            <span className="text-stone-300">&bull;</span>
            <span className="text-stone-500 italic">Motif: {presentation.motifName}</span>
          </div>
        </div>
      </div>

      {/* Ticket Content Body */}
      <div className="p-6 space-y-5">
        {/* Attendee & Primary Employee Hierarchy Card */}
        <div
          className="rounded-2xl p-4 border space-y-3"
          style={{
            backgroundColor: '#FAF9F6',
            borderColor: '#E7E2DA',
          }}
        >
          {/* Header row: Attendee Name + Pass Type Badge */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-stone-200/80 pb-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">
                Attendee Name
              </span>
              <h3
                className="text-xl sm:text-2xl font-black leading-tight tracking-tight"
                style={{ color: theme.primaryColor }}
              >
                {presentation.attendeeName}
              </h3>
            </div>

            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border self-start sm:self-auto shadow-xs"
              style={{
                backgroundColor: theme.bgColor,
                color: theme.primaryColor,
                borderColor: theme.secondaryColor,
              }}
            >
              {presentation.isFamily ? (
                <Users className="w-3.5 h-3.5" />
              ) : (
                <User className="w-3.5 h-3.5" />
              )}
              <span>{presentation.passHolderLabel}</span>
            </span>
          </div>

          {/* Detailed Hierarchy: Family Member vs Employee */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {presentation.isFamily ? (
              <>
                <div className="p-2.5 rounded-xl bg-white border border-stone-200/80">
                  <p className="text-stone-500 text-[10px] uppercase font-bold tracking-wider">
                    Primary Employee
                  </p>
                  <p className="font-bold text-stone-900 text-sm mt-0.5">
                    {presentation.primaryEmployeeName}
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-white border border-stone-200/80">
                  <p className="text-stone-500 text-[10px] uppercase font-bold tracking-wider">
                    Ref No.
                  </p>
                  <p className="font-mono font-bold text-stone-900 text-sm mt-0.5">
                    {presentation.referenceNumber || presentation.employeeCpf}
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="p-2.5 rounded-xl bg-white border border-stone-200/80">
                  <p className="text-stone-500 text-[10px] uppercase font-bold tracking-wider">
                    Ref No.
                  </p>
                  <p className="font-mono font-bold text-stone-900 text-sm mt-0.5">
                    {presentation.referenceNumber || presentation.employeeCpf}
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-white border border-stone-200/80">
                  <p className="text-stone-500 text-[10px] uppercase font-bold tracking-wider">
                    Department / Location
                  </p>
                  <p className="font-bold text-stone-900 text-sm mt-0.5">
                    {presentation.department}
                  </p>
                </div>
              </>
            )}

            <div className="p-2.5 rounded-xl bg-white border border-stone-200/80">
              <p className="text-stone-500 text-[10px] uppercase font-bold tracking-wider">
                Pass Status
              </p>
              <p className="font-bold text-emerald-700 text-sm mt-0.5">
                {presentation.status || 'ACTIVE'}
              </p>
            </div>

            <div className="p-2.5 rounded-xl bg-white border border-stone-200/80">
              <p className="text-stone-500 text-[10px] uppercase font-bold tracking-wider">
                Authorized Event Date
              </p>
              <p className="font-bold text-sm mt-0.5" style={{ color: theme.primaryColor }}>
                {presentation.eventDateFormatted}
              </p>
            </div>
          </div>
        </div>

        {/* Pure White QR Code Display Box (Clean, no dark gradient block) */}
        <div
          className="flex flex-col items-center justify-center p-6 bg-white rounded-2xl border-2 relative"
          style={{ borderColor: theme.secondaryColor }}
        >
          <div
            className="bg-white p-4 rounded-2xl shadow-sm border-2 flex items-center justify-center w-56 h-56 max-w-full"
            style={{ borderColor: `${theme.primaryColor}30` }}
          >
            {qrSvg ? (
              <div
                className="w-full h-full flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:max-w-full"
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
            ) : (
              <div className="text-xs text-stone-400 font-medium">QR Code Ready</div>
            )}
          </div>

          {/* Date-Specific Validation Alert Badge */}
          <div
            className="mt-4 px-4 py-1.5 rounded-full text-center text-xs font-bold tracking-wide uppercase border flex items-center gap-1.5 shadow-xs"
            style={{
              backgroundColor: theme.bgColor,
              color: theme.primaryColor,
              borderColor: theme.primaryColor,
            }}
          >
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>Valid strictly on {presentation.eventDateFormatted}</span>
          </div>

          <p className="text-[11px] text-stone-500 mt-2 text-center font-medium">
            Single-scan entry pass for designated employee turnstiles. Non-transferable.
          </p>
        </div>

        {/* Venue & Event Guidelines */}
        <div
          className="rounded-2xl p-4 border text-xs space-y-2"
          style={{
            backgroundColor: '#FFFDF9',
            borderColor: '#E8DEC8',
          }}
        >
          <div
            className="flex items-center gap-1.5 font-bold uppercase tracking-wide text-[11px]"
            style={{ color: theme.primaryColor }}
          >
            <MapPin className="w-3.5 h-3.5" style={{ color: theme.primaryColor }} />
            <span>Venue &amp; Entry Guidelines</span>
          </div>
          <p className="font-semibold text-stone-800">
            {presentation.venue.name}, {presentation.venue.address}
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-stone-600 text-[11px] pt-1 border-t border-amber-200/40">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-stone-500" /> Entry Timing: {presentation.entryTiming}
            </span>
            <span>&bull;</span>
            <span>Organizer: {presentation.organizer}</span>
          </div>
          <p className="text-[10px] text-stone-500 leading-relaxed pt-1">
            Important: Please present this digital QR or the printed pass at the gate. Turnstile scanners will reject passes scanned on any other date or scanned more than once.
          </p>
        </div>
      </div>

      {/* Security Footer Notice */}
      {showSecurityFooter && (
        <div
          className="px-6 py-3 border-t text-center text-[10px] text-stone-500"
          style={{
            backgroundColor: '#F9F8F6',
            borderColor: '#EAE6DF',
          }}
        >
          Pass Token:{' '}
          <span className="font-mono text-stone-700">
            {presentation.qrToken ? `${presentation.qrToken.substring(0, 16)}...` : 'SECURE-TOKEN'}
          </span>{' '}
          &bull; Official ONGC Entry E-Pass &bull; Night {presentation.nightNumber}
        </div>
      )}
    </div>
  );
}

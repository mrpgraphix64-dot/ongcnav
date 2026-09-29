'use client';

import React from 'react';
import { AlertTriangle, Ticket } from 'lucide-react';

export interface TicketPassData {
  id?: string;
  attendeeName?: string;
  name?: string;
  ticketNumber?: string;
  ticket_id?: string;
  registrationType?: string;
  category?: string;
  relation?: string;
  employee?: any;
  ticketType?: string;
  passType?: string;
  bookingDays?: string[];
  date?: string;
  isTestPayment?: boolean;
  qrSvg?: string | null;
  qrCodeToken?: string;
  token?: string;
  status?: string;
}

interface TicketPassCardProps {
  ticket: TicketPassData;
  id?: string;
  className?: string;
  showTestBadge?: boolean;
}

export default function TicketPassCard({
  ticket,
  id = 'printableTicket',
  className = '',
  showTestBadge = true,
}: TicketPassCardProps) {
  if (!ticket) return null;

  const attendeeName = ticket.attendeeName || ticket.name || 'Valued Attendee';
  const ticketId = ticket.ticketNumber || ticket.ticket_id || ticket.token || ticket.qrCodeToken || 'PASS';
  const isCommercial =
    ticket.registrationType === 'COMMERCIAL' ||
    ticket.category === 'Commercial Pass' ||
    ticket.relation === 'Commercial Pass' ||
    !ticket.employee;

  const passTypeLabel = (() => {
    const t = (ticket.ticketType || ticket.category || ticket.passType || '').toUpperCase();
    if (t.includes('SEASON')) return 'Season Pass';
    if (t.includes('MANDLI')) return 'Mandli Pass';
    if (t.includes('ANY_DAY')) return 'Any Day Pass';
    if (t.includes('DAILY')) return 'Daily Pass';
    if (isCommercial) return 'Daily Pass';
    return ticket.relation || ticket.category || 'Attendee Pass';
  })();

  const eventDateLabel = (() => {
    if (ticket.bookingDays && ticket.bookingDays.length > 0) {
      if (ticket.bookingDays.length >= 9 || passTypeLabel === 'Season Pass') {
        return '11–19 October 2026 (All 9 Days)';
      }
      return ticket.bookingDays.join(', ');
    }
    if (passTypeLabel === 'Season Pass') {
      return '11–19 October 2026 (All 9 Days)';
    }
    return ticket.date || '11–19 October 2026';
  })();

  return (
    <div className={`space-y-4 ${className}`}>
      {showTestBadge && ticket.isTestPayment && (
        <div className="p-3 bg-amber-100 border border-amber-300 rounded-2xl text-amber-900 text-xs font-bold text-center uppercase tracking-wider flex items-center justify-center gap-2 shadow-xs">
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
          <span>STAGING TEST PASS &bull; NOT A REAL PURCHASE</span>
        </div>
      )}

      {/* Printable Ticket Card */}
      <div
        id={id}
        className="relative overflow-hidden rounded-3xl bg-white border-2 border-gold/60 shadow-xl print:border-2 print:border-black print:shadow-none"
      >
        {/* Maroon Accent Top Bar */}
        <div className="h-2 bg-gradient-to-r from-maroon-deep via-gold to-maroon" />

        <div className="p-6 sm:p-8 text-center space-y-5">
          {/* Logo & Event Title */}
          <div className="space-y-2">
            <img
              src="/images/logo-web.png"
              alt="ONGC Logo"
              className="h-14 w-auto max-w-[200px] object-contain mx-auto"
            />
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-maroon">
                Official Event Entry Pass
              </div>
              <h1 className="font-cinzel font-bold text-xl text-ink mt-0.5">
                ONGC NAVRATRI 2026 E-PASS
              </h1>
            </div>
          </div>

          <div className="border-t border-dashed border-stone-200" />

          {/* Attendee Name */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-ink-soft">
              Attendee Name
            </div>
            <div className="font-cinzel font-bold text-2xl text-maroon mt-0.5">
              {attendeeName}
            </div>
          </div>

          {/* Ticket Details Grid */}
          <div className="grid grid-cols-2 gap-3 bg-cream-soft p-4 rounded-2xl text-left border border-stone-200/80">
            <div>
              <div className="text-[9px] font-bold uppercase tracking-widest text-ink-soft">
                Ticket Number
              </div>
              <div className="font-mono font-bold text-maroon text-sm mt-0.5">
                {ticketId}
              </div>
            </div>
            <div>
              <div className="text-[9px] font-bold uppercase tracking-widest text-ink-soft">
                Pass Type
              </div>
              <div className="font-outfit font-bold text-ink text-sm mt-0.5">
                {passTypeLabel}
              </div>
            </div>
            <div>
              <div className="text-[9px] font-bold uppercase tracking-widest text-ink-soft">
                Venue
              </div>
              <div className="font-semibold text-ink text-xs mt-0.5">
                Malaviya Cricket Ground ONGC
              </div>
            </div>
            <div>
              <div className="text-[9px] font-bold uppercase tracking-widest text-ink-soft">
                Entry Timing
              </div>
              <div className="font-semibold text-ink text-xs mt-0.5">
                7:00 PM onwards
              </div>
            </div>
            <div className="col-span-2">
              <div className="text-[9px] font-bold uppercase tracking-widest text-ink-soft">
                Event Date
              </div>
              <div className="font-semibold text-maroon text-sm mt-0.5">
                {eventDateLabel}
              </div>
            </div>
          </div>

          {/* QR Code Section */}
          <div className="space-y-2">
            <div className="inline-block p-4 bg-white rounded-2xl border-2 border-stone-200 shadow-sm">
              {ticket.qrSvg ? (
                <div
                  className="w-44 h-44 mx-auto"
                  dangerouslySetInnerHTML={{ __html: ticket.qrSvg }}
                />
              ) : (
                <div className="w-44 h-44 flex flex-col items-center justify-center bg-stone-50 rounded-xl">
                  <Ticket className="w-10 h-10 text-maroon mb-2" />
                  <span className="font-mono text-xs font-bold text-stone-700">{ticketId}</span>
                </div>
              )}
            </div>
            <div className="text-[10px] text-ink-soft font-mono uppercase tracking-widest">
              Scan for Gate Verification
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

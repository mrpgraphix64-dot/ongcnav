'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Printer,
  Share2,
  ArrowLeft,
  AlertTriangle,
  Award,
  Ticket,
} from 'lucide-react';
import PublicHeader from '@/components/PublicHeader';
import PublicFooter from '@/components/PublicFooter';
import TicketGuidelines from '@/components/TicketGuidelines';
import TicketPassCard from '@/components/TicketPassCard';
import { fetchApi } from '@/lib/api';

export default function TicketPassPage() {
  const params = useParams();
  const token = params.token as string;

  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Ensure viewport starts at the top on mount and re-verifies at the top
    // when asynchronous ticket data finishes loading and the full pass renders.
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [token, loading]);

  useEffect(() => {
    async function loadTicket() {
      try {
        setLoading(true);
        const data = await fetchApi(`/public/ticket/${token}`);
        setTicket(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load ticket pass');
      } finally {
        setLoading(false);
      }
    }

    if (token) {
      loadTicket();
    }
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex flex-col justify-between">
        <PublicHeader />
        <div className="py-32 text-center space-y-4">
          <div className="w-12 h-12 border-4 border-maroon border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-maroon font-bold text-sm">Loading Secure Digital Pass...</p>
        </div>
        <PublicFooter />
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="min-h-screen bg-cream flex flex-col justify-between">
        <PublicHeader />
        <div className="py-24 max-w-md mx-auto px-4 text-center space-y-4">
          <div className="bg-white border border-stone-200 p-8 rounded-3xl shadow-lg space-y-4">
            <AlertTriangle className="w-12 h-12 text-amber-600 mx-auto" />
            <h1 className="text-xl font-bold font-cinzel text-maroon">Pass Not Found</h1>
            <p className="text-xs text-ink-soft">{error || 'This digital pass is unrecognized.'}</p>
            <div className="pt-4">
              <Link
                href="/my-tickets"
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-maroon text-white font-bold text-xs hover:bg-maroon-dark transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Return to Ticket Lookup</span>
              </Link>
            </div>
          </div>
        </div>
        <PublicFooter />
      </div>
    );
  }

  const attendeeName = ticket.attendeeName || ticket.name;
  const ticketId = ticket.ticketNumber || ticket.ticket_id || token;
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

  const waMessage = encodeURIComponent(
    `Hi ${attendeeName},\nHere is your official ONGC Navratri 2026 E-Pass!\n\nTicket Number: ${ticketId}\nPass Type: ${passTypeLabel}\nVenue: Malaviya Cricket Ground ONGC, Ahmedabad\nDate: ${eventDateLabel}\nEntry Timing: 7:00 PM onwards\n\nPlease show this QR ticket at the entry gate.`
  );

  return (
    <div className="min-h-screen bg-cream text-ink flex flex-col justify-between print:bg-white print:p-0">
      <div className="print:hidden">
        <PublicHeader />
      </div>

      <main className="flex-grow max-w-md mx-auto w-full px-4 py-8 space-y-5">
        {/* Action Bar Top */}
        <div className="flex items-center justify-between print:hidden">
          <Link
            href={isCommercial ? '/my-tickets' : '/employee/my-tickets'}
            className="text-xs text-maroon hover:underline flex items-center gap-1.5 font-bold"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Pass Search
          </Link>

          <button
            onClick={() => window.print()}
            className="px-3.5 py-1.5 rounded-xl bg-white border border-stone-300 text-xs font-bold text-ink hover:text-maroon transition-all shadow-xs flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5 text-maroon" /> Print Pass
          </button>
        </div>

        {/* Printable Ticket Card */}
        <TicketPassCard ticket={ticket} id="printableTicket" />

        {/* Action Buttons: Print & WhatsApp Share */}
        <div className="grid grid-cols-2 gap-3 print:hidden">
          <button
            onClick={() => window.print()}
            type="button"
            className="py-3 px-4 rounded-xl bg-white border border-stone-200 text-ink text-sm font-semibold hover:border-maroon/40 transition-colors flex items-center justify-center gap-2 shadow-xs"
          >
            <Printer className="w-4 h-4 text-maroon" /> Download / Print
          </button>

          <a
            href={`https://wa.me/?text=${waMessage}`}
            target="_blank"
            rel="noopener noreferrer"
            className="py-3 px-4 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 shadow-xs"
          >
            <Share2 className="w-4 h-4" /> Share Pass
          </a>
        </div>

        {/* Ticket Guidelines */}
        <TicketGuidelines className="mt-2" />
      </main>

      <div className="print:hidden">
        <PublicFooter />
      </div>
    </div>
  );
}

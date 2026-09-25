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
import { fetchApi } from '@/lib/api';

export default function TicketPassPage() {
  const params = useParams();
  const token = params.token as string;

  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
  const category = isCommercial
    ? 'Commercial Pass'
    : (ticket.relation || ticket.category || 'ONGC Attendee');
  const waMessage = encodeURIComponent(
    `Hi ${attendeeName},\nHere is your official Entry Pass for ONGC Navratri 2026!\n\nTicket ID: ${ticketId}\nCategory: ${category}\nVenue: ONGC Ground, Chandkheda, Ahmedabad\nDate: 11-19 Oct 2026\n\nPlease show this QR ticket at the entry gate.`
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

        {ticket.isTestPayment && (
          <div className="p-3 bg-amber-100 border border-amber-300 rounded-2xl text-amber-900 text-xs font-bold text-center uppercase tracking-wider flex items-center justify-center gap-2 shadow-xs">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>STAGING TEST PASS &bull; NOT A REAL PURCHASE</span>
          </div>
        )}

        {/* Printable Ticket Card */}
        <div
          id="printableTicket"
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
                  ONGC Navratri 2026
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
                  Ticket ID
                </div>
                <div className="font-mono font-bold text-maroon text-sm mt-0.5">
                  {ticketId}
                </div>
              </div>
              <div>
                <div className="text-[9px] font-bold uppercase tracking-widest text-ink-soft">
                  Category
                </div>
                <div className="font-outfit font-bold text-ink text-sm mt-0.5">
                  {category}
                </div>
              </div>
              <div>
                <div className="text-[9px] font-bold uppercase tracking-widest text-ink-soft">
                  Venue
                </div>
                <div className="font-semibold text-ink text-sm mt-0.5">
                  ONGC Ground
                </div>
              </div>
              <div>
                <div className="text-[9px] font-bold uppercase tracking-widest text-ink-soft">
                  Gate
                </div>
                <div className="font-semibold text-ink text-sm mt-0.5">
                  Main Gate
                </div>
              </div>
              <div className="col-span-2">
                <div className="text-[9px] font-bold uppercase tracking-widest text-ink-soft">
                  Event Date
                </div>
                <div className="font-semibold text-maroon text-sm mt-0.5">
                  11&ndash;19 October 2026
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
      </main>

      <div className="print:hidden">
        <PublicFooter />
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Printer,
  Calendar,
  CheckCircle,
  AlertTriangle,
  Download,
  ShieldCheck,
  Building,
  User,
  Clock,
  ArrowLeft,
} from 'lucide-react';
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
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-400 font-medium text-sm">Loading Secure Digital Pass...</p>
        </div>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-8 rounded-2xl text-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
          <h1 className="text-xl font-bold">Pass Not Found</h1>
          <p className="text-sm text-slate-400">{error || 'This digital pass is unrecognized.'}</p>
          <div className="pt-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-red-600 text-white font-semibold text-sm hover:bg-red-700"
            >
              <ArrowLeft className="w-4 h-4" />
              Return Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isCheckedIn = ticket.checkins && ticket.checkins.length > 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 print:bg-white print:p-0 print:text-black">
      {/* Top action bar (hidden during print) */}
      <div className="w-full max-w-md flex items-center justify-between mb-4 print:hidden">
        <Link
          href={`/my-tickets?cpf=${ticket.employee.cpf}`}
          className="text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" />
          All Family Passes
        </Link>

        <button
          onClick={() => window.print()}
          className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-white flex items-center gap-1.5 shadow"
        >
          <Printer className="w-3.5 h-3.5" />
          Print / Save PDF
        </button>
      </div>

      {/* Main Ticket Card */}
      <div className="w-full max-w-md bg-gradient-to-b from-slate-900 to-slate-900/95 border-2 border-slate-800 rounded-3xl overflow-hidden shadow-2xl shadow-red-950/20 print:border print:border-black print:shadow-none print:bg-white">
        {/* Pass Header */}
        <div className="bg-gradient-to-r from-red-700 via-red-600 to-amber-600 p-6 text-white text-center relative overflow-hidden print:bg-red-700">
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="w-6 h-6 rounded bg-white text-red-700 font-black text-xs flex items-center justify-center">
              ओ
            </span>
            <span className="font-black tracking-wider text-sm uppercase">
              ONGC Cultural Committee
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight">
            NAVRATRI MAHOTSAV 2026
          </h1>
          <p className="text-xs text-red-100 font-medium mt-0.5">
            OFFICIAL DIGITAL ENTRY PASS
          </p>

          <div className="mt-3 inline-block px-3 py-1 rounded-full bg-black/25 backdrop-blur-sm text-[11px] font-mono tracking-widest text-amber-200">
            {ticket.ticketNumber}
          </div>
        </div>

        {/* QR Section */}
        <div className="p-6 text-center border-b border-dashed border-slate-800 print:border-gray-300">
          <div className="inline-block p-4 bg-white rounded-2xl shadow-inner border border-slate-200">
            {ticket.qrSvg ? (
              <div
                className="w-48 h-48 mx-auto"
                dangerouslySetInnerHTML={{ __html: ticket.qrSvg }}
              />
            ) : (
              <div className="w-48 h-48 flex items-center justify-center text-slate-800 font-mono text-xs">
                QR CODE
              </div>
            )}
          </div>

          <p className="text-[11px] text-slate-400 mt-2 font-mono print:text-black">
            Scan at Turnstile Gate Reader
          </p>
        </div>

        {/* Pass Holder Details */}
        <div className="p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">
                {ticket.relation}
              </span>
              <h2 className="text-xl font-bold text-white print:text-black">
                {ticket.attendeeName}
              </h2>
            </div>
            <span
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase ${
                ticket.status === 'ACTIVE'
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40'
                  : 'bg-red-950/80 text-red-300 border border-red-500/40'
              }`}
            >
              {ticket.status}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 print:bg-gray-50 print:border-gray-200">
            <div>
              <span className="text-slate-400 block text-[10px]">EMPLOYEE CPF</span>
              <span className="font-bold text-white font-mono print:text-black">
                {ticket.employee.cpf}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">EMPLOYEE NAME</span>
              <span className="font-medium text-white print:text-black">
                {ticket.employee.name}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">DESIGNATION</span>
              <span className="font-medium text-slate-300 print:text-black truncate block">
                {ticket.employee.designation}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">DEPARTMENT</span>
              <span className="font-medium text-slate-300 print:text-black truncate block">
                {ticket.employee.department}
              </span>
            </div>
          </div>

          {/* Booking Days */}
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
              Authorized Festival Nights ({ticket.employee.bookingDays.length})
            </span>
            <div className="flex flex-wrap gap-1.5">
              {ticket.employee.bookingDays.map((d: string) => (
                <span
                  key={d}
                  className="px-2 py-0.5 rounded bg-slate-800 text-[11px] font-mono text-slate-300 print:border print:border-gray-300 print:text-black"
                >
                  {d}
                </span>
              ))}
            </div>
          </div>

          {/* Today Check-in Status */}
          {isCheckedIn && (
            <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 flex items-center gap-2.5 text-xs text-emerald-300">
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <span className="font-bold">Checked In Today:</span>{' '}
                {ticket.checkins[0]?.gateName} at{' '}
                {new Date(ticket.checkins[0]?.checkinTime).toLocaleTimeString('en-IN', {
                  timeZone: 'Asia/Kolkata',
                })}
              </div>
            </div>
          )}
        </div>

        {/* Pass Footer */}
        <div className="bg-slate-950 p-4 text-center border-t border-slate-800 text-[10px] text-slate-400 print:bg-white print:border-gray-200">
          Valid only with ONGC ID Card or Government Photo ID • Non-transferable
        </div>
      </div>
    </div>
  );
}

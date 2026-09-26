'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Ticket,
  Search,
  Mail,
  Send,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';

export default function CommercialTicketsPage() {
  const [ticketSearch, setTicketSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketSearch.trim()) return;

    try {
      setLoading(true);
      setError(null);
      setSearchResult(null);
      setResendSuccess(null);

      // Search through commercial orders for this ticket or phone or email
      const res = await fetchApi(`/commercial/admin/orders?search=${encodeURIComponent(ticketSearch.trim())}`);
      const orders = res?.orders || [];
      if (orders.length === 0) {
        setError(`No commercial orders or passes found matching "${ticketSearch}".`);
      } else {
        setSearchResult(orders[0]);
      }
    } catch (err: any) {
      setError(err?.message || 'Error looking up commercial ticket');
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmail = async (orderId: string) => {
    try {
      setResending(true);
      setResendSuccess(null);
      await fetchApi(`/commercial/admin/orders/${orderId}/resend-email`, {
        method: 'POST',
      });
      setResendSuccess('Ticket confirmation email resent successfully!');
    } catch (err: any) {
      setError(err?.message || 'Failed to resend confirmation email');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Ticket className="w-6 h-6 text-maroon" />
            <h1 className="text-2xl font-bold font-outfit text-ink">E-Pass Ticket Delivery</h1>
          </div>
          <p className="text-sm text-ink-soft mt-1">
            Search commercial tickets, verify customer email delivery, and resend digital pass confirmations.
          </p>
        </div>
        <Link
          href="/admin/commercial/orders"
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl bg-white border border-stone-200 text-ink hover:bg-stone-50 transition-colors shadow-xs"
        >
          View All Orders
        </Link>
      </div>

      {/* Ticket Lookup Form */}
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-xs p-6 space-y-4">
        <h2 className="text-base font-bold text-ink font-outfit">Look up E-Pass by Ticket ID, Order #, or Customer Contact</h2>
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={ticketSearch}
              onChange={(e) => setTicketSearch(e.target.value)}
              placeholder="Enter ticket number (e.g. EPASS-...), order number, mobile, or email..."
              className="w-full pl-10 pr-4 py-2.5 bg-stone-50/50 border border-stone-200 rounded-xl text-sm text-ink placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-maroon/20 focus:border-maroon focus:bg-white"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !ticketSearch.trim()}
            className="px-5 py-2.5 bg-maroon text-white text-xs font-bold rounded-xl hover:bg-maroon-dark disabled:opacity-50 transition-colors shadow-xs flex items-center gap-2 shrink-0"
          >
            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            Lookup Pass
          </button>
        </form>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {resendSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{resendSuccess}</span>
        </div>
      )}

      {/* Result Card */}
      {searchResult && (
        <div className="bg-white rounded-2xl border border-stone-200/80 shadow-xs p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-stone-100 gap-3">
            <div>
              <div className="text-xs font-bold text-ink-soft uppercase tracking-wider">
                Order #{searchResult.orderNumber}
              </div>
              <div className="text-lg font-bold text-ink font-outfit mt-0.5">
                {searchResult.customerName}
              </div>
              <div className="text-xs text-ink-soft">
                {searchResult.customerPhone} &bull; {searchResult.customerEmail}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                searchResult.status === 'PAID' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-stone-100 text-stone-600'
              }`}>
                {searchResult.status}
              </span>
              <button
                onClick={() => handleResendEmail(searchResult.id)}
                disabled={resending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-maroon text-white text-xs font-semibold hover:bg-maroon-dark transition-colors shadow-xs"
              >
                <Send className="w-3 h-3" />
                {resending ? 'Sending...' : 'Resend Email'}
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold text-ink-soft uppercase tracking-wider mb-2">Issued Tickets</h3>
            <div className="space-y-2">
              {searchResult.passes?.map((p: any) => (
                <div key={p.id} className="p-3 rounded-xl bg-stone-50 border border-stone-200/60 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Ticket className="w-4 h-4 text-maroon" />
                    <div>
                      <div className="font-mono text-xs font-bold text-ink">{p.ticketNumber}</div>
                      <div className="text-[11px] text-ink-soft">{p.category || 'COMMERCIAL'} &bull; {p.status}</div>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-emerald-600">Valid</span>
                </div>
              )) || (
                <div className="text-xs text-ink-soft">No individual pass records found on this order.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

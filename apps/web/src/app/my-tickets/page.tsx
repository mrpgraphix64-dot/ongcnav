'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Search,
  Ticket,
  AlertCircle,
  CheckCircle2,
  Award,
  ArrowRight,
  Clock,
  Calendar,
  ShieldCheck,
  Phone,
  Hash,
} from 'lucide-react';
import PublicHeader from '@/components/PublicHeader';
import PublicFooter from '@/components/PublicFooter';
import PageHero from '@/components/PageHero';
import { fetchApi } from '@/lib/api';
import {
  validateCommercialLookup,
  buildCommercialOrderUrl,
  formatPassDates,
  getOrderStatusBadge,
} from './my-tickets-utils';

function CommercialTicketsContent() {
  const searchParams = useSearchParams();
  const initialOrderNumber = searchParams.get('orderNumber') || searchParams.get('order') || '';
  const initialMobile = searchParams.get('mobile') || searchParams.get('phone') || '';

  const [orderNumber, setOrderNumber] = useState(initialOrderNumber);
  const [orderMobile, setOrderMobile] = useState(initialMobile);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Commercial Order search
  const handleCommercialSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setResult(null);

    const validation = validateCommercialLookup(orderNumber, orderMobile);
    if (!validation.isValid) {
      setError(validation.error || 'Please enter a valid Commercial Order Number and 10-digit mobile number');
      return;
    }

    setLoading(true);

    try {
      const url = buildCommercialOrderUrl(validation.cleanOrderNumber, validation.cleanMobile);
      const data = await fetchApi(url);
      setResult(data);
    } catch (err: any) {
      if (
        err.status === 404 ||
        err.statusCode === 404 ||
        (err.message && err.message.toLowerCase().includes('not found'))
      ) {
        setError(
          `Commercial order "${orderNumber.trim().toUpperCase()}" was not found. Please verify your order number and 10-digit mobile number.`,
        );
      } else {
        setError(err.message || 'Failed to lookup commercial order. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Deep-link auto-search if both order and mobile are present in URL query
  useEffect(() => {
    if (initialOrderNumber && initialMobile) {
      handleCommercialSearch();
    }
  }, [initialOrderNumber, initialMobile]);

  return (
    <div className="py-12 sm:py-16 bg-cream relative">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        {/* LOOKUP CARD */}
        <div className="max-w-xl mx-auto bg-white rounded-3xl p-6 sm:p-10 border border-stone-200/90 shadow-xl space-y-6 relative overflow-hidden">
          {/* HEADER ICON & TITLE */}
          <div className="text-center space-y-2">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-maroon-soft text-maroon flex items-center justify-center border border-maroon/20 shadow-xs">
              <Ticket className="w-7 h-7 text-maroon" />
            </div>
            <h2 className="font-cinzel font-bold text-2xl text-ink">Commercial Pass Retrieval</h2>
            <p className="text-xs sm:text-sm text-ink-soft">
              Enter your Commercial Order Number and registered 10-digit mobile number to access and download your official QR passes.
            </p>
          </div>

          {/* ERROR ALERT */}
          {error && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {/* COMMERCIAL ORDER FORM */}
          <form onSubmit={handleCommercialSearch} className="space-y-4">
            <div>
              <label
                htmlFor="order_number"
                className="block text-xs font-bold text-ink-soft uppercase tracking-wider mb-2"
              >
                Commercial Order Number
              </label>
              <div className="relative">
                <Hash className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  id="order_number"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  required
                  autoFocus
                  placeholder="e.g. ORD-COMM-20261011-ABC123"
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-stone-50 border border-stone-200 text-ink font-mono font-bold text-base placeholder:font-sans placeholder:font-normal placeholder:text-stone-400 focus:bg-white focus:outline-none focus:border-maroon shadow-xs transition-colors uppercase"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="order_mobile"
                className="block text-xs font-bold text-ink-soft uppercase tracking-wider mb-2"
              >
                Registered Mobile Number (10 Digits)
              </label>
              <div className="relative">
                <Phone className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="tel"
                  id="order_mobile"
                  maxLength={10}
                  value={orderMobile}
                  onChange={(e) => setOrderMobile(e.target.value.replace(/\D/g, ''))}
                  required
                  placeholder="e.g. 9876543210"
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-stone-50 border border-stone-200 text-ink font-mono text-base placeholder:font-sans placeholder:font-normal placeholder:text-stone-400 focus:bg-white focus:outline-none focus:border-maroon shadow-xs transition-colors"
                />
              </div>
              <p className="text-[11px] text-ink-soft mt-1.5">
                Enter the Indian mobile number provided during commercial ticket booking.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-xl text-sm font-bold bg-maroon text-white hover:bg-maroon-dark transition-all duration-200 shadow-md border border-gold/40 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <Search className="w-4 h-4 text-gold-light" />
              <span>{loading ? 'LOOKING UP ORDER...' : 'FIND COMMERCIAL PASSES'}</span>
            </button>
          </form>

          {/* FOOTER LINK */}
          <div className="pt-4 border-t border-stone-100 text-center space-y-2">
            <p className="text-xs text-ink/70">Looking to purchase passes?</p>
            <Link
              href="/bookpass"
              aria-label="Book your pass"
              data-testid="book-pass-link"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-maroon hover:text-gold-dark transition-colors"
            >
              <span>BOOK YOUR PASS</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* RESULTS SECTION */}
        {result && (
          <div className="space-y-8 animate-fadeIn">
            {(() => {
              const statusInfo = getOrderStatusBadge(result.orderStatus, result.paymentStatus);
              const passes = result.passes || [];
              const hasPasses = passes.length > 0;
              const formattedDates = formatPassDates(result.selectedDates, result.ticketType);

              return (
                <>
                  {/* STATUS HEADER BANNER */}
                  <div className="text-center max-w-xl mx-auto space-y-2">
                    <div
                      className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-2 shadow-inner border ${
                        statusInfo.isPaid
                          ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                          : statusInfo.isPending
                          ? 'bg-amber-100 text-amber-700 border-amber-300'
                          : 'bg-rose-100 text-rose-700 border-rose-300'
                      }`}
                    >
                      {statusInfo.isPaid ? (
                        <CheckCircle2 className="w-9 h-9" />
                      ) : statusInfo.isPending ? (
                        <Clock className="w-9 h-9" />
                      ) : (
                        <AlertCircle className="w-9 h-9" />
                      )}
                    </div>

                    <h2 className="font-cinzel font-bold text-3xl sm:text-4xl text-maroon drop-shadow-sm">
                      {statusInfo.isPaid
                        ? 'Order Confirmed & Paid! 🎉'
                        : statusInfo.isPending
                        ? 'Payment Pending ⏳'
                        : 'Order Incomplete ⚠️'}
                    </h2>

                    <p className="font-outfit font-semibold text-base sm:text-lg text-gold-muted">
                      {statusInfo.isPaid
                        ? hasPasses
                          ? 'Your official ONGC Navratri 2026 entry passes are ready.'
                          : 'Payment verified. See note below to unlock full QR entry passes.'
                        : statusInfo.isPending
                        ? 'We are awaiting final payment confirmation from Razorpay.'
                        : result.failureReason || 'Payment could not be verified or was cancelled.'}
                    </p>
                  </div>

                  {/* UNVERIFIED MOBILE NOTICE (IDOR GUARD) */}
                  {statusInfo.isPaid && !hasPasses && (
                    <div className="p-4 sm:p-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm flex items-start gap-3 shadow-xs">
                      <ShieldCheck className="w-5 h-5 shrink-0 text-amber-700 mt-0.5" />
                      <div className="space-y-1">
                        <div className="font-bold text-amber-950">Security Notice: Pass Details Protected</div>
                        <p className="text-amber-800 leading-relaxed">
                          This order was verified, but the mobile number entered did not match the purchaser&apos;s registered phone number. To view your active QR entry passes, please re-search above using the 10-digit mobile number provided during booking.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* PENDING PAYMENT NOTICE */}
                  {statusInfo.isPending && (
                    <div className="p-4 sm:p-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm flex items-start gap-3 shadow-xs">
                      <Clock className="w-5 h-5 shrink-0 text-amber-700 mt-0.5" />
                      <div className="space-y-1">
                        <div className="font-bold text-amber-950">Awaiting Bank / UPI Confirmation</div>
                        <p className="text-amber-800 leading-relaxed">
                          If you have already paid via UPI or card, please wait 1&ndash;2 minutes and refresh this page. Once Razorpay sends payment confirmation, your entry passes will appear here automatically.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* ORDER SUMMARY CARD */}
                  <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-md space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-stone-100">
                      <div>
                        <div className="text-xs font-bold text-ink-soft uppercase tracking-wider">
                          Commercial Order Reference
                        </div>
                        <div className="text-xl sm:text-2xl font-mono font-bold text-maroon">
                          {result.orderNumber}
                        </div>
                        {result.createdAt && (
                          <div className="text-xs text-stone-500 mt-0.5">
                            Booked on{' '}
                            {new Date(result.createdAt).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${statusInfo.badgeClass}`}>
                          {statusInfo.label}
                        </span>
                        {result.paymentStatus && result.paymentStatus !== 'CAPTURED' && (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold bg-stone-100 text-stone-600 border border-stone-200">
                            PAYMENT: {result.paymentStatus}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* ORDER DETAILS GRID */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                      <div className="bg-stone-50 p-3.5 rounded-xl border border-stone-100">
                        <span className="text-stone-500 block text-[11px] font-medium mb-1">
                          Pass Type
                        </span>
                        <span className="font-bold text-ink text-sm">
                          {result.ticketType === 'SEASON' || result.ticketType === 'COMMERCIAL_SEASON'
                            ? 'Season Pass'
                            : 'Daily Pass'}
                        </span>
                      </div>

                      <div className="bg-stone-50 p-3.5 rounded-xl border border-stone-100">
                        <span className="text-stone-500 block text-[11px] font-medium mb-1">
                          Quantity
                        </span>
                        <span className="font-bold text-ink text-sm">
                          {result.quantity} {result.quantity === 1 ? 'Pass' : 'Passes'}
                        </span>
                      </div>

                      <div className="bg-stone-50 p-3.5 rounded-xl border border-stone-100">
                        <span className="text-stone-500 block text-[11px] font-medium mb-1">
                          Total Amount
                        </span>
                        <span className="font-bold text-maroon text-sm font-mono">
                          ₹{Number(result.amountInr || 0).toLocaleString('en-IN')}
                        </span>
                      </div>

                      <div className="bg-stone-50 p-3.5 rounded-xl border border-stone-100">
                        <span className="text-stone-500 block text-[11px] font-medium mb-1">
                          Booking Dates
                        </span>
                        <span className="font-bold text-ink text-xs line-clamp-2">
                          {formattedDates}
                        </span>
                      </div>
                    </div>

                    {/* CUSTOMER INFO STRIP */}
                    <div className="pt-4 border-t border-stone-100 flex flex-wrap items-center justify-between gap-3 text-xs text-ink-soft">
                      <div className="flex items-center gap-4 flex-wrap">
                        {result.customerName && (
                          <div>
                            <span className="text-stone-400 mr-1.5 font-medium">Customer:</span>
                            <span className="font-semibold text-ink">{result.customerName}</span>
                          </div>
                        )}
                        {result.customerMobile && (
                          <div>
                            <span className="text-stone-400 mr-1.5 font-medium">Mobile:</span>
                            <span className="font-mono text-ink">{result.customerMobile}</span>
                          </div>
                        )}
                        {result.customerEmail && (
                          <div>
                            <span className="text-stone-400 mr-1.5 font-medium">Email:</span>
                            <span className="font-mono text-ink">{result.customerEmail}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* COMMERCIAL PASS CARDS */}
                  {hasPasses && (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <h3 className="font-cinzel font-bold text-xl text-maroon flex items-center gap-2">
                          <Ticket className="w-5 h-5 text-gold" />
                          <span>Commercial Passes ({passes.length})</span>
                        </h3>
                        <span className="text-xs text-stone-500">
                          Present individual QR codes at the entry gate
                        </span>
                      </div>

                      {passes.map((pass: any, index: number) => {
                        const passDates = formatPassDates(pass.bookingDays || result.selectedDates, result.ticketType);
                        return (
                          <div
                            key={pass.id || pass.ticketNumber || index}
                            className="ticket-card bg-gradient-to-br from-[#5A0F21] via-[#7A1930] to-[#3D0714] text-white rounded-3xl p-6 sm:p-8 border-2 border-gold/60 shadow-2xl relative overflow-hidden"
                          >
                            {/* Rangoli Pattern & Glow Orbs */}
                            <div className="absolute inset-0 rangoli-pattern pointer-events-none" />
                            <div className="absolute -top-20 -right-20 w-56 h-56 rounded-full bg-gold/20 blur-2xl pointer-events-none" />
                            <div className="absolute -bottom-20 -left-20 w-56 h-56 rounded-full bg-saffron/20 blur-2xl pointer-events-none" />

                            {/* Side Circular Cutouts for Perforated Ticket Effect */}
                            <div className="absolute -left-3.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-cream border-r-2 border-gold/60 z-20" />
                            <div className="absolute -right-3.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-cream border-l-2 border-gold/60 z-20" />

                            <div className="relative z-10 flex flex-col justify-between">
                              {/* CARD HEADER */}
                              <div className="flex items-start justify-between gap-4 pb-4 border-b border-gold/30">
                                <div className="flex items-center gap-3">
                                  <img
                                    src="/images/logo-web.png"
                                    alt="ONGC Logo"
                                    className="h-10 sm:h-12 w-auto object-contain shrink-0 bg-white/95 p-1 rounded-xl border border-gold/50 shadow-md"
                                  />
                                  <div>
                                    <div className="font-cinzel font-bold text-lg sm:text-xl text-gold tracking-wider">
                                      NAVRATRI
                                    </div>
                                    <div className="text-[11px] font-semibold text-gold-light/80 uppercase tracking-widest">
                                      EWC AHMEDABAD 2026
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-gold text-maroon-deep shadow-md">
                                    <Award className="w-3.5 h-3.5" />
                                    <span>
                                      {result.ticketType === 'SEASON' || result.ticketType === 'COMMERCIAL_SEASON'
                                        ? 'SEASON PASS'
                                        : 'COMMERCIAL PASS'}
                                    </span>
                                  </span>
                                </div>
                              </div>

                              {/* PERSON DETAILS & QR CODE */}
                              <div className="py-6 flex flex-col sm:flex-row items-center justify-between gap-6">
                                <div className="space-y-4 text-center sm:text-left flex-1">
                                  <div>
                                    <div className="text-xs font-bold text-gold-light uppercase tracking-wider">
                                      Pass Holder {passes.length > 1 ? `#${index + 1}` : ''}
                                    </div>
                                    <h3 className="font-cinzel font-extrabold text-2xl sm:text-3xl text-white tracking-wide drop-shadow-md">
                                      {pass.name || result.customerName}
                                    </h3>
                                  </div>

                                  <div className="grid grid-cols-2 gap-3 text-xs bg-black/25 p-3.5 rounded-xl border border-gold/30 backdrop-blur-xs">
                                    <div>
                                      <span className="text-gold-light/70 text-[10px] block uppercase font-mono">
                                        Ticket ID
                                      </span>
                                      <span className="font-mono font-bold text-gold text-sm">
                                        {pass.ticketNumber}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-gold-light/70 text-[10px] block uppercase">
                                        Category
                                      </span>
                                      <span className="font-semibold text-white">
                                        {pass.category || 'Commercial Pass'}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-gold-light/70 text-[10px] block uppercase">
                                        Venue
                                      </span>
                                      <span className="font-semibold text-white">
                                        ONGC Ground
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-gold-light/70 text-[10px] block uppercase">
                                        Entry Gate
                                      </span>
                                      <span className="font-semibold text-white">
                                        Main Gate
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* QR CODE BOX */}
                                <div className="shrink-0 flex flex-col items-center">
                                  <div className="p-3 bg-white rounded-2xl shadow-xl border-2 border-gold/70">
                                    {pass.qrSvg ? (
                                      <div
                                        className="w-40 h-40"
                                        dangerouslySetInnerHTML={{ __html: pass.qrSvg }}
                                      />
                                    ) : (
                                      <div className="w-40 h-40 flex flex-col items-center justify-center bg-stone-100 text-stone-700 font-mono text-xs rounded-xl p-2 text-center">
                                        <Ticket className="w-8 h-8 text-maroon mb-1" />
                                        <span>{pass.ticketNumber}</span>
                                      </div>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-gold-light/80 font-mono mt-2 uppercase tracking-widest">
                                    Scan at Entry Gate
                                  </span>
                                </div>
                              </div>

                              {/* CARD FOOTER & ACTIONS */}
                              <div className="pt-4 border-t border-gold/30 flex flex-col sm:flex-row items-center justify-between gap-3">
                                <div className="text-xs text-cream/70 flex items-center gap-1.5">
                                  <Calendar className="w-3.5 h-3.5 text-gold" />
                                  <span>Valid: </span>
                                  <span className="text-gold font-bold">{passDates}</span>
                                </div>

                                <div className="flex items-center gap-2">
                                  <Link
                                    href={`/ticket/${pass.qrCodeToken || pass.ticketNumber}`}
                                    className="px-4 py-2 rounded-xl bg-gold text-maroon-deep text-xs font-bold hover:bg-gold-light transition-colors shadow-sm inline-flex items-center gap-1.5"
                                  >
                                    <span>Open Dedicated Pass</span>
                                    <ArrowRight className="w-3.5 h-3.5" />
                                  </Link>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MyTicketsPage() {
  return (
    <div className="min-h-screen flex flex-col justify-between bg-cream text-ink selection:bg-maroon selection:text-white">
      <PublicHeader />
      <PageHero
        badge="COMMERCIAL PASSES"
        title="CHECK COMMERCIAL TICKET"
        subtitle="Lookup, verify, and retrieve your official commercial entry passes and QR codes."
        breadcrumb="Commercial Tickets"
      />
      <Suspense
        fallback={
          <div className="py-24 text-center text-maroon font-bold">
            Loading Commercial Ticket Portal...
          </div>
        }
      >
        <CommercialTicketsContent />
      </Suspense>
      <PublicFooter />
    </div>
  );
}

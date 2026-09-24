'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Script from 'next/script';
import PublicHeader from '@/components/PublicHeader';
import PublicFooter from '@/components/PublicFooter';
import PageHero from '@/components/PageHero';
import {
  Ticket,
  CheckCircle2,
  AlertCircle,
  CalendarCheck,
  CreditCard,
  QrCode,
  ShieldCheck,
  Loader2,
  Download,
  ExternalLink,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';

const EVENT_DATES = [
  '2026-10-11',
  '2026-10-12',
  '2026-10-13',
  '2026-10-14',
  '2026-10-15',
  '2026-10-16',
  '2026-10-17',
  '2026-10-18',
  '2026-10-19',
];

function formatDateChip(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return {
    weekday: d.toLocaleDateString('en-IN', { weekday: 'short' }),
    day: d.toLocaleDateString('en-IN', { day: '2-digit' }),
    month: d.toLocaleDateString('en-IN', { month: 'short' }),
  };
}

const INDIAN_MOBILE_REGEX = /^[6-9][0-9]{9}$/;

interface GeneratedPass {
  id: string;
  ticketNumber: string;
  qrCodeToken: string;
  qrSvg: string | null;
  name: string;
  mobile: string;
  category: string;
  bookingDays: string[];
}

export default function RegisterPage() {
  // Form State
  const [ticketType, setTicketType] = useState<'COMMERCIAL_DAILY' | 'COMMERCIAL_SEASON'>('COMMERCIAL_DAILY');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [selectedDates, setSelectedDates] = useState<string[]>(['2026-10-11']);

  // Flow & Payment State
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [paymentFailed, setPaymentFailed] = useState(false);

  // Pending Order State
  const [pendingOrder, setPendingOrder] = useState<any>(null);

  // Success State
  const [confirmedOrderNumber, setConfirmedOrderNumber] = useState<string | null>(null);
  const [confirmedPasses, setConfirmedPasses] = useState<GeneratedPass[]>([]);

  // Server-synced pricing config
  const [serverPricing, setServerPricing] = useState<Record<string, any> | null>(null);

  // Load server-side commercial pricing & dates on mount
  useEffect(() => {
    async function loadConfig() {
      try {
        setLoadingConfig(true);
        const res = await fetchApi('/commercial/config');
        if (res?.ticketTypes) {
          const map: Record<string, any> = {};
          res.ticketTypes.forEach((t: any) => {
            map[t.code] = t;
          });
          setServerPricing(map);
        }
      } catch {
        // Fallback to constants
      } finally {
        setLoadingConfig(false);
      }
    }
    loadConfig();
  }, []);

  const toggleDate = (date: string) => {
    setSelectedDates((prev) => {
      if (prev.includes(date)) {
        if (prev.length === 1) return prev; // Keep at least one
        return prev.filter((d) => d !== date);
      }
      return [...prev, date].sort();
    });
  };

  const selectAllDates = () => {
    setSelectedDates([...EVENT_DATES]);
  };

  // Server-authoritative fallback constants (Daily: ₹249 vs ₹499; Season: ₹1,750 vs ₹3,500)
  const dailyPrice = serverPricing?.COMMERCIAL_DAILY?.priceInr ?? 249;
  const dailyOriginalPrice = serverPricing?.COMMERCIAL_DAILY?.originalPriceInr ?? 499;
  const seasonPrice = serverPricing?.COMMERCIAL_SEASON?.priceInr ?? 1750;
  const seasonOriginalPrice = serverPricing?.COMMERCIAL_SEASON?.originalPriceInr ?? 3500;

  // Live estimated pricing (strictly re-verified and enforced server-side)
  const estimatedUnitPrice =
    ticketType === 'COMMERCIAL_SEASON' ? seasonPrice : dailyPrice * selectedDates.length;
  const estimatedOriginalUnitPrice =
    ticketType === 'COMMERCIAL_SEASON' ? seasonOriginalPrice : dailyOriginalPrice * selectedDates.length;
  const estimatedTotal = estimatedUnitPrice * quantity;
  const estimatedOriginalTotal = estimatedOriginalUnitPrice * quantity;
  const estimatedSavings = estimatedOriginalTotal - estimatedTotal;

  // Step 1: Initiate order & launch Razorpay Checkout
  const handleInitiatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || verifying) return;

    if (!name.trim() || name.trim().length < 2) {
      setErrorMessage('Please enter your full name (minimum 2 characters).');
      return;
    }
    const cleanPhone = phone.trim();
    if (!cleanPhone || !INDIAN_MOBILE_REGEX.test(cleanPhone)) {
      setErrorMessage('Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please enter a valid email address for digital pass delivery.');
      return;
    }
    if (ticketType === 'COMMERCIAL_DAILY' && selectedDates.length === 0) {
      setErrorMessage('Please select at least one attendance date.');
      return;
    }

    setErrorMessage('');
    setPaymentFailed(false);
    setSubmitting(true);

    try {
      // 1. Create pending order on backend
      const res = await fetchApi('/commercial/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: name.trim(),
          customerMobile: cleanPhone,
          customerEmail: email.trim().toLowerCase(),
          ticketType,
          selectedDates: ticketType === 'COMMERCIAL_SEASON' ? EVENT_DATES : selectedDates,
          quantity,
        }),
      });

      const orderData = res.order;
      if (!orderData || !orderData.orderNumber) {
        throw new Error('Could not initiate order. Please try again.');
      }

      setPendingOrder(orderData);

      // 2. Open Razorpay Standard Checkout
      if (typeof window !== 'undefined' && (window as any).Razorpay) {
        const options = {
          key: orderData.razorpayKeyId,
          amount: orderData.amountPaise,
          currency: orderData.currency || 'INR',
          name: 'ONGC Navratri 2026',
          description: ticketType === 'COMMERCIAL_SEASON' ? 'All 9 Nights Season Pass' : 'Commercial Entry Pass',
          image: '/images/logo-web.png',
          order_id: orderData.razorpayOrderId.startsWith('order_mock_') ? undefined : orderData.razorpayOrderId,
          prefill: {
            name: orderData.customer.name,
            email: orderData.customer.email,
            contact: orderData.customer.mobile,
          },
          theme: {
            color: '#7A1930',
          },
          handler: async function (response: any) {
            const paymentId = response.razorpay_payment_id;
            const signature = response.razorpay_signature;

            if (!paymentId || !signature) {
              // Never fabricate a payment ID or signature — an incomplete
              // callback response must not reach /commercial/orders/verify.
              setSubmitting(false);
              setPaymentFailed(true);
              setErrorMessage('Payment response was incomplete. Please try again.');
              return;
            }

            await handleVerifyPayment({
              orderNumber: orderData.orderNumber,
              razorpayOrderId: response.razorpay_order_id || orderData.razorpayOrderId,
              razorpayPaymentId: paymentId,
              razorpaySignature: signature,
            });
          },
          modal: {
            ondismiss: function () {
              setSubmitting(false);
              setErrorMessage('Payment cancelled. You can retry when ready.');
            },
          },
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.on('payment.failed', function (response: any) {
          setSubmitting(false);
          setPaymentFailed(true);
          setErrorMessage(response.error?.description || 'Payment was declined. Please try another method.');
        });
        rzp.open();
      } else {
        // Razorpay Checkout failed to load (blocked script, network issue,
        // etc). There is no fallback payment path: we never fabricate a
        // payment ID/signature or call verify without a real gateway
        // interaction. Show a safe error state and let the user retry.
        setSubmitting(false);
        setPaymentFailed(true);
        setErrorMessage(
          'The secure payment gateway could not be loaded. Please check your connection and try again — no payment has been made.',
        );
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to initiate order. Please try again.');
      setSubmitting(false);
    }
  };

  // Step 2: Backend verifies payment signature and issues pass
  const handleVerifyPayment = async (verificationPayload: {
    orderNumber: string;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }) => {
    setSubmitting(false);
    setVerifying(true);
    setErrorMessage('');

    try {
      const res = await fetchApi('/commercial/orders/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(verificationPayload),
      });

      if (res?.passes && res.passes.length > 0) {
        setConfirmedOrderNumber(res.orderNumber);
        setConfirmedPasses(res.passes);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        throw new Error('Payment confirmation succeeded but passes could not be loaded.');
      }
    } catch (err: any) {
      setPaymentFailed(true);
      setErrorMessage(err.message || 'Payment signature verification failed. Please contact support.');
    } finally {
      setVerifying(false);
    }
  };

  const resetForm = () => {
    setName('');
    setEmail('');
    setPhone('');
    setQuantity(1);
    setSelectedDates(['2026-10-11']);
    setErrorMessage('');
    setPaymentFailed(false);
    setPendingOrder(null);
    setConfirmedOrderNumber(null);
    setConfirmedPasses([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-cream text-ink">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <PublicHeader />

      <main className="flex-1">
        {/* PAGE HERO */}
        <PageHero
          badge="OFFICIAL TICKETS"
          title="GET YOUR ENTRY PASS"
          subtitle="Official Commercial & Public Passes for ONGC Navratri 2026, Ahmedabad."
          breadcrumb="Commercial Passes"
        />

        {/* CONTAINER */}
        <div className="max-w-4xl mx-auto py-10 px-4 sm:px-6">
          {verifying ? (
            /* VERIFICATION IN PROGRESS */
            <div className="bg-white rounded-3xl p-12 border border-gold/40 shadow-xl text-center space-y-4">
              <Loader2 className="w-12 h-12 text-maroon animate-spin mx-auto" />
              <h2 className="font-outfit font-extrabold text-2xl text-ink">
                Verifying Payment with Gateway...
              </h2>
              <p className="text-ink-soft text-sm max-w-md mx-auto">
                Please wait while our backend cryptographically confirms your payment and generates your secure QR passes.
              </p>
            </div>
          ) : confirmedPasses.length > 0 ? (
            /* SUCCESS STATE — AUTHORITATIVE CONFIRMED PASSES */
            <div className="space-y-6">
              <div className="bg-white rounded-3xl p-8 sm:p-10 border-2 border-emerald-500/40 shadow-xl text-center space-y-5">
                <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center border border-emerald-200 shadow-inner">
                  <CheckCircle2 className="w-8 h-8" />
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full uppercase tracking-wider border border-emerald-200">
                    Payment Verified &bull; Confirmed
                  </span>
                  <h2 className="font-outfit font-extrabold text-2xl sm:text-3xl text-ink pt-1">
                    Your Passes are Ready!
                  </h2>
                  <p className="text-xs sm:text-sm text-ink-soft">
                    Order Reference:{' '}
                    <span className="font-mono font-bold text-maroon">{confirmedOrderNumber}</span>
                  </p>
                </div>

                <p className="text-xs sm:text-sm text-ink-soft max-w-lg mx-auto">
                  Show your digital QR code at any entry gate for scanning. You can download or print your pass below.
                </p>
              </div>

              {/* GENERATED PASS CARDS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {confirmedPasses.map((pass, index) => (
                  <div
                    key={pass.id || index}
                    className="bg-white rounded-3xl p-6 border border-gold/40 shadow-lg flex flex-col justify-between space-y-4 relative overflow-hidden"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-maroon-dark bg-maroon-soft px-2.5 py-0.5 rounded-full uppercase">
                          Pass #{index + 1}
                        </span>
                        <h3 className="font-outfit font-extrabold text-lg text-ink mt-1">
                          {pass.name}
                        </h3>
                        <p className="text-xs text-ink-soft">Mobile: {pass.mobile}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-mono font-bold text-ink">
                          {pass.ticketNumber}
                        </span>
                        <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">● ACTIVE</p>
                      </div>
                    </div>

                    {/* QR CODE DISPLAY */}
                    <div className="p-4 bg-cream-light rounded-2xl border border-stone-200 flex flex-col items-center justify-center text-center">
                      {pass.qrSvg ? (
                        <div
                          className="w-48 h-48 sm:w-52 sm:h-52 bg-white p-2 rounded-xl shadow-xs border border-stone-200"
                          dangerouslySetInnerHTML={{ __html: pass.qrSvg }}
                        />
                      ) : (
                        <div className="w-48 h-48 bg-stone-100 flex items-center justify-center rounded-xl">
                          <QrCode className="w-12 h-12 text-stone-400" />
                        </div>
                      )}
                      <span className="text-[10px] font-mono text-ink-soft mt-2 tracking-widest uppercase">
                        Gate Scan Token
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs text-ink-soft border-t border-stone-100 pt-3">
                      <div className="flex items-center justify-between">
                        <span>Event Dates:</span>
                        <span className="font-bold text-ink text-[11px]">
                          {pass.bookingDays?.length} Nights
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-500 truncate">
                        {pass.bookingDays?.map((d) => d.slice(5)).join(', ')}
                      </p>
                    </div>

                    <div className="pt-2 flex items-center gap-2">
                      <Link
                        href={`/ticket/${pass.qrCodeToken}`}
                        className="flex-1 py-2.5 rounded-xl bg-gold text-maroon-deep font-bold text-xs hover:bg-gold-light transition-all text-center border border-maroon/20 flex items-center justify-center gap-1.5 shadow-xs"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>View Pass</span>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>

              <div className="text-center pt-4">
                <button
                  onClick={resetForm}
                  type="button"
                  className="px-6 py-2.5 rounded-xl bg-maroon text-white font-bold text-xs hover:bg-maroon-dark transition-all inline-flex items-center gap-2 shadow-md"
                >
                  <Ticket className="w-4 h-4 text-gold-light" />
                  <span>Book Additional Passes</span>
                </button>
              </div>
            </div>
          ) : (
            /* COMMERCIAL PURCHASE FORM */
            <div className="bg-white rounded-3xl p-6 sm:p-10 border border-gold/40 shadow-xl space-y-6">
              {/* HEADER / INTRO */}
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                  <div className="flex items-center gap-2.5">
                    <Ticket className="w-6 h-6 text-maroon" />
                    <div>
                      <h2 className="font-outfit font-extrabold text-xl text-ink">
                        Select Commercial Ticket
                      </h2>
                      <p className="text-xs text-ink-soft">
                        Instant QR Entry Pass with Online Payment Confirmation
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-gold-deep bg-gold/20 px-3 py-1 rounded-full uppercase tracking-wider">
                    Official Ticket
                  </span>
                </div>
              </div>

              {errorMessage && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm font-semibold flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="flex-1">{errorMessage}</div>
                </div>
              )}

              <form onSubmit={handleInitiatePayment} className="space-y-6">
                {/* 1. TICKET TYPE SELECTION */}
                <div className="space-y-2.5">
                  <label className="block text-xs font-bold text-ink">
                    Pass Category <span className="text-rose-600">*</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setTicketType('COMMERCIAL_DAILY')}
                      className={`relative p-5 sm:p-6 rounded-3xl border-2 text-left transition-all duration-200 overflow-hidden ${
                        ticketType === 'COMMERCIAL_DAILY'
                          ? 'border-[#7A1930] bg-gradient-to-b from-[#FAF7F2] via-amber-50/40 to-[#FAF7F2] shadow-xl ring-2 ring-[#7A1930]/15'
                          : 'border-stone-200/90 bg-white hover:border-[#7A1930]/40 hover:shadow-md'
                      }`}
                    >
                      <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full bg-gradient-to-br from-[#D4AF37]/20 via-[#E65100]/10 to-transparent pointer-events-none blur-sm" />

                      <div className="flex items-center justify-between gap-2 mb-3.5 relative z-10">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-amber-500/15 via-[#D4AF37]/20 to-amber-500/15 text-[#7A1930] border border-[#D4AF37]/50 shadow-xs">
                          <Sparkles className="w-3 h-3 text-[#E65100]" />
                          <span>EARLY BIRD OFFER</span>
                        </div>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide bg-[#7A1930] text-[#FAF7F2] shadow-xs">
                          50% OFF
                        </span>
                      </div>

                      <div className="mb-2 relative z-10">
                        <h4 className="font-outfit font-black text-base sm:text-lg text-ink tracking-tight">
                          DAILY ENTRY PASS
                        </h4>
                        <p className="text-[11px] font-medium text-ink-soft">
                          Customizable pass valid for your chosen night(s)
                        </p>
                      </div>

                      <div className="pt-2.5 pb-1 border-t border-stone-200/70 flex items-baseline gap-2.5 flex-wrap relative z-10">
                        <span className="text-xs sm:text-sm text-stone-400 font-bold line-through decoration-rose-600 decoration-2">
                          ₹{dailyOriginalPrice}
                        </span>
                        <span className="font-outfit font-black text-2xl sm:text-3xl text-[#7A1930] tracking-tight">
                          ₹{dailyPrice}
                        </span>
                        <span className="text-xs font-semibold text-ink-soft">
                          / person
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#E65100] mt-1 relative z-10">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#E65100] animate-pulse" />
                        <span>Early Bird Price &bull; Limited Time</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTicketType('COMMERCIAL_SEASON')}
                      className={`relative p-5 sm:p-6 rounded-3xl border-2 text-left transition-all duration-200 overflow-hidden ${
                        ticketType === 'COMMERCIAL_SEASON'
                          ? 'border-[#7A1930] bg-gradient-to-b from-[#FAF7F2] via-amber-50/40 to-[#FAF7F2] shadow-xl ring-2 ring-[#7A1930]/15'
                          : 'border-stone-200/90 bg-white hover:border-[#7A1930]/40 hover:shadow-md'
                      }`}
                    >
                      <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full bg-gradient-to-br from-[#D4AF37]/25 via-[#E65100]/15 to-transparent pointer-events-none blur-sm" />

                      <div className="flex items-center justify-between gap-2 mb-3.5 relative z-10">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-amber-500/15 via-[#D4AF37]/20 to-amber-500/15 text-[#7A1930] border border-[#D4AF37]/50 shadow-xs">
                          <Sparkles className="w-3 h-3 text-[#E65100]" />
                          <span>EARLY BIRD OFFER</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide bg-[#7A1930] text-[#FAF7F2] shadow-xs">
                            50% OFF
                          </span>
                          <span className="text-[10px] font-bold text-[#7A1930] bg-[#D4AF37]/35 border border-[#D4AF37]/60 px-2 py-0.5 rounded-full">
                            Best Value
                          </span>
                        </div>
                      </div>

                      <div className="mb-2 relative z-10">
                        <h4 className="font-outfit font-black text-base sm:text-lg text-ink tracking-tight">
                          SEASON PASS
                        </h4>
                        <p className="text-[11px] font-medium text-ink-soft">
                          All 9 Nights of authentic Garba &bull; Full festival pass
                        </p>
                      </div>

                      <div className="pt-2.5 pb-1 border-t border-stone-200/70 flex items-baseline gap-2.5 flex-wrap relative z-10">
                        <span className="text-xs sm:text-sm text-stone-400 font-bold line-through decoration-rose-600 decoration-2">
                          ₹{seasonOriginalPrice.toLocaleString('en-IN')}
                        </span>
                        <span className="font-outfit font-black text-2xl sm:text-3xl text-[#7A1930] tracking-tight">
                          ₹{seasonPrice.toLocaleString('en-IN')}
                        </span>
                        <span className="text-xs font-semibold text-ink-soft">
                          / person
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#E65100] mt-1 relative z-10">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#E65100] animate-pulse" />
                        <span>Early Bird Price &bull; Limited Time</span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* 2. DATE SELECTION (for Daily Passes) */}
                {ticketType === 'COMMERCIAL_DAILY' && (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CalendarCheck className="w-4 h-4 text-maroon" />
                        <span className="font-outfit font-bold text-xs text-ink">
                          Select Attendance Dates <span className="text-rose-600">*</span>
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={selectAllDates}
                        className="text-xs font-bold text-maroon hover:underline"
                      >
                        Select All 9 Nights
                      </button>
                    </div>

                    <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-2">
                      {EVENT_DATES.map((iso, idx) => {
                        const selected = selectedDates.includes(iso);
                        const { weekday, day, month } = formatDateChip(iso);
                        return (
                          <button
                            key={iso}
                            type="button"
                            onClick={() => toggleDate(iso)}
                            className={`p-2 rounded-xl text-center border-2 transition-all flex flex-col items-center justify-center ${
                              selected
                                ? 'bg-maroon text-white border-maroon shadow-md scale-[1.02]'
                                : 'bg-cream-light text-ink border-stone-200 hover:border-maroon/40'
                            }`}
                          >
                            <span
                              className={`text-[9px] uppercase tracking-wider font-bold ${
                                selected ? 'text-gold-light' : 'text-ink-soft'
                              }`}
                            >
                              Day {idx + 1}
                            </span>
                            <span className="font-outfit font-extrabold text-base leading-tight mt-0.5">
                              {day}
                            </span>
                            <span
                              className={`text-[10px] font-semibold ${
                                selected ? 'text-white/90' : 'text-ink-soft'
                              }`}
                            >
                              {month}
                            </span>
                            <span
                              className={`text-[9px] font-medium mt-0.5 ${
                                selected ? 'text-gold-light/90' : 'text-stone-400'
                              }`}
                            >
                              {weekday}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="p-2.5 rounded-xl bg-amber-50/60 border border-[#D4AF37]/30 flex items-center justify-between text-[11px] text-ink-soft flex-wrap gap-2">
                      <span>
                        Selected: <strong className="text-ink">{selectedDates.length}</strong> of {EVENT_DATES.length} nights
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="text-stone-400 line-through">₹{dailyOriginalPrice * selectedDates.length}</span>
                        <strong className="text-[#7A1930] font-black text-xs">₹{dailyPrice * selectedDates.length}</strong>
                        <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100/80 px-1.5 py-0.2 rounded">50% OFF</span>
                        <span>per pass</span>
                      </span>
                    </div>
                  </div>
                )}

                {/* 3. QUANTITY SELECTION */}
                <div className="space-y-1.5 pt-2">
                  <label className="block text-xs font-bold text-ink">
                    Pass Quantity <span className="text-rose-600">*</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <select
                      value={quantity}
                      onChange={(e) => setQuantity(parseInt(e.target.value, 10))}
                      className="px-4 py-2.5 rounded-xl bg-cream-light border border-stone-300 text-ink text-sm font-bold focus:outline-none focus:border-maroon"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                        <option key={num} value={num}>
                          {num} {num === 1 ? 'Pass' : 'Passes'}
                        </option>
                      ))}
                    </select>
                    <span className="text-xs text-ink-soft">
                      (Maximum 10 passes per single transaction)
                    </span>
                  </div>
                </div>

                {/* 4. CUSTOMER DETAILS */}
                <div className="space-y-4 pt-3 border-t border-stone-100">
                  <h3 className="font-outfit font-extrabold text-sm text-ink">
                    Customer Details (For QR Pass Issuance)
                  </h3>

                  <div>
                    <label className="block text-xs font-bold text-ink mb-1.5">
                      Full Name <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      placeholder="e.g. Priyesh Shah"
                      className="w-full px-4 py-3 rounded-xl bg-cream-light border border-stone-300 text-ink text-sm focus:outline-none focus:border-maroon"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-ink mb-1.5">
                        Mobile No. (10 Digits) <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) =>
                          setPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))
                        }
                        required
                        pattern="[6-9][0-9]{9}"
                        maxLength={10}
                        minLength={10}
                        inputMode="numeric"
                        placeholder="e.g. 9876543210"
                        className="w-full px-4 py-3 rounded-xl bg-cream-light border border-stone-300 text-ink text-sm focus:outline-none focus:border-maroon"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-ink mb-1.5">
                        Email Address <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        placeholder="e.g. priyesh@example.com"
                        className="w-full px-4 py-3 rounded-xl bg-cream-light border border-stone-300 text-ink text-sm focus:outline-none focus:border-maroon"
                      />
                    </div>
                  </div>
                </div>

                {/* 5. ORDER SUMMARY & TOTAL */}
                <div className="p-4 sm:p-6 rounded-3xl bg-gradient-to-br from-[#FAF7F2] to-amber-50/40 border border-[#D4AF37]/40 space-y-3 text-xs shadow-sm">
                  <div className="flex items-center justify-between text-ink-soft">
                    <span>Pass Type:</span>
                    <span className="font-bold text-ink">
                      {ticketType === 'COMMERCIAL_SEASON' ? 'All 9 Nights Season Pass' : 'Daily Entry Pass'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-ink-soft">
                    <span>Nights Count:</span>
                    <span className="font-bold text-ink">
                      {ticketType === 'COMMERCIAL_SEASON' ? '9 Nights' : `${selectedDates.length} Night(s)`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-ink-soft">
                    <span>Quantity:</span>
                    <span className="font-bold text-ink">{quantity} Pass(es)</span>
                  </div>
                  <div className="flex items-center justify-between text-ink-soft">
                    <span>Original Price:</span>
                    <span className="font-semibold text-stone-400 line-through decoration-rose-600 decoration-1.5">
                      ₹{estimatedOriginalTotal.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[#E65100] font-bold">
                    <span className="flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
                      Early Bird Discount (50% OFF):
                    </span>
                    <span>-₹{estimatedSavings.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-stone-200/80 text-sm">
                    <div>
                      <span className="font-outfit font-extrabold text-ink text-base">Payable Amount:</span>
                      <p className="text-[10px] font-bold text-emerald-700">You save ₹{estimatedSavings.toLocaleString('en-IN')}</p>
                    </div>
                    <span className="font-outfit font-black text-2xl sm:text-3xl text-[#7A1930] tracking-tight">
                      ₹{estimatedTotal.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <p className="text-[10px] text-ink-soft italic pt-1">
                    *Final amount is strictly computed and verified on the server.
                  </p>
                </div>

                {/* 6. SUBMIT CTA */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submitting || verifying}
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#D4AF37] via-amber-400 to-[#D4AF37] hover:brightness-105 text-[#7A1930] font-outfit font-black text-base sm:text-lg transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2.5 border border-[#7A1930]/20 disabled:opacity-50 cursor-pointer"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Initializing Secure Gateway...</span>
                      </>
                    ) : (
                      <>
                        <Ticket className="w-5 h-5 text-[#7A1930]" />
                        <span>Book Your Pass &bull; ₹{estimatedTotal.toLocaleString('en-IN')}</span>
                      </>
                    )}
                  </button>
                  <div className="flex items-center justify-center gap-2 text-[11px] text-ink-soft mt-3">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>256-bit Encrypted Payment via Razorpay &bull; Instant Digital QR Delivery</span>
                  </div>
                </div>
              </form>
            </div>
          )}
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Script from 'next/script';
import PublicHeader from '@/components/PublicHeader';
import PublicFooter from '@/components/PublicFooter';
import TicketGuidelines from '@/components/TicketGuidelines';
import {
  Ticket,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  CalendarCheck,
  QrCode,
  ShieldCheck,
  Loader2,
  ExternalLink,
  Sparkles,
  Clock,
  ChevronDown,
  Check,
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
  const d = new Date(iso + 'T00:00:00');
  return {
    weekday: d.toLocaleDateString('en-IN', { weekday: 'short' }),
    day: d.toLocaleDateString('en-IN', { day: '2-digit' }),
    month: d.toLocaleDateString('en-IN', { month: 'short' }),
    fullDate: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
    chipLabel: `${d.toLocaleDateString('en-IN', { month: 'short' })} ${d.getDate()}`,
  };
}

const INDIAN_MOBILE_REGEX = /^[6-9][0-9]{9}$/;

export type TicketTypeCode =
  | 'COMMERCIAL_DAILY'
  | 'COMMERCIAL_SEASON'
  | 'COMMERCIAL_MANDLI'
  | 'COMMERCIAL_ANY_DAY';

interface PassOption {
  code: TicketTypeCode;
  name: string;
  timing: string;
  timingCategory: 'Mandli' | 'Garba';
  price: number;
  originalPrice: number;
  discountLabel: string;
  offerLabel: string;
  description: string;
  isSeason: boolean;
}

const PASS_OPTIONS: PassOption[] = [
  {
    code: 'COMMERCIAL_DAILY',
    name: 'Daily Pass',
    timing: '8:00 PM – 4:00 AM',
    timingCategory: 'Garba',
    price: 249,
    originalPrice: 499,
    discountLabel: '50% OFF',
    offerLabel: 'EARLY BIRD OFFER',
    description: 'Full evening Garba entry for selected night',
    isSeason: false,
  },
  {
    code: 'COMMERCIAL_SEASON',
    name: 'Season Pass',
    timing: '8:00 PM – 4:00 AM',
    timingCategory: 'Garba',
    price: 1750,
    originalPrice: 3500,
    discountLabel: '50% OFF',
    offerLabel: 'ALL 9 NIGHTS',
    description: 'Full festival pass covering all 9 nights of Garba',
    isSeason: true,
  },
  {
    code: 'COMMERCIAL_MANDLI',
    name: 'Mandli Pass',
    timing: '12:00 AM – 4:00 AM',
    timingCategory: 'Mandli',
    price: 149,
    originalPrice: 299,
    discountLabel: '50% OFF',
    offerLabel: 'MIDNIGHT SPECIAL',
    description: 'Post-midnight entry for late-night Mandli Garba',
    isSeason: false,
  },
  {
    code: 'COMMERCIAL_ANY_DAY',
    name: 'Any Day Pass',
    timing: '8:00 PM – 4:00 AM',
    timingCategory: 'Garba',
    price: 279,
    originalPrice: 499,
    discountLabel: '44% OFF',
    offerLabel: 'FLEXIBLE ENTRY',
    description: 'Flexible single-night entry pass for any chosen event night',
    isSeason: false,
  },
];

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

interface CustomQuantityDropdownProps {
  value: number;
  onChange: (val: number) => void;
  disabled?: boolean;
}

function CustomQuantityDropdown({ value, onChange, disabled }: CustomQuantityDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const options = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === 'Escape') {
      setIsOpen(false);
      buttonRef.current?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        const next = Math.min(10, value + 1);
        onChange(next);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        const prev = Math.max(1, value - 1);
        onChange(prev);
      }
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsOpen((prev) => !prev);
    }
  };

  return (
    <div ref={dropdownRef} className="relative w-full sm:w-64">
      <button
        ref={buttonRef}
        type="button"
        id="quantity-dropdown-button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Pass quantity selector, currently ${value} ${value === 1 ? 'Pass' : 'Passes'}`}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        className="w-full px-4 py-3 rounded-2xl bg-cream-light border-2 border-stone-300 hover:border-maroon/60 focus:border-maroon focus:outline-none focus:ring-2 focus:ring-gold/40 text-ink text-sm font-bold flex items-center justify-between transition-all shadow-xs cursor-pointer disabled:opacity-50"
      >
        <span className="flex items-center gap-2">
          <Ticket className="w-4 h-4 text-maroon" />
          <span>{value} {value === 1 ? 'Pass' : 'Passes'}</span>
        </span>
        <ChevronDown
          className={`w-4 h-4 text-maroon transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <ul
          role="listbox"
          aria-labelledby="quantity-dropdown-button"
          tabIndex={-1}
          className="absolute z-30 left-0 right-0 mt-2 py-1.5 bg-white border-2 border-gold/40 rounded-2xl shadow-xl max-h-60 overflow-y-auto focus:outline-none"
        >
          {options.map((num) => {
            const isSelected = num === value;
            return (
              <li
                key={num}
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(num);
                  setIsOpen(false);
                  buttonRef.current?.focus();
                }}
                className={`px-4 py-2.5 text-sm font-semibold flex items-center justify-between cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-maroon text-white'
                    : 'text-ink hover:bg-gold/15 hover:text-maroon'
                }`}
              >
                <span>{num} {num === 1 ? 'Pass' : 'Passes'}</span>
                {isSelected && <Check className="w-4 h-4 text-gold-light" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function BookPassPage() {
  // Form State
  const [ticketType, setTicketType] = useState<TicketTypeCode>('COMMERCIAL_DAILY');
  const [selectedDate, setSelectedDate] = useState<string>('2026-10-11');
  const [quantity, setQuantity] = useState<number>(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

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
  const [isTestOrder, setIsTestOrder] = useState(false);

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
        // Fallback to local constants
      } finally {
        setLoadingConfig(false);
      }
    }
    loadConfig();
  }, []);

  // Single date selection: tapping another date REPLACES the previous date
  const handleSelectDate = (date: string) => {
    setSelectedDate(date);
  };

  // Resolve active option config
  const activeOption = PASS_OPTIONS.find((t) => t.code === ticketType) || PASS_OPTIONS[0];
  const serverItem = serverPricing?.[ticketType];
  const unitPrice = serverItem?.priceInr ?? activeOption.price;
  const originalUnitPrice = serverItem?.originalPriceInr ?? activeOption.originalPrice;
  const activeTiming = serverItem?.timing ?? activeOption.timing;

  // Live estimated pricing (strictly computed and validated server-side on creation)
  const isSeason = ticketType === 'COMMERCIAL_SEASON';

  const unitPricePerPass = unitPrice;
  const originalUnitPricePerPass = originalUnitPrice;

  const estimatedTotal = unitPricePerPass * quantity;
  const estimatedOriginalTotal = originalUnitPricePerPass * quantity;
  const estimatedSavings = Math.max(0, estimatedOriginalTotal - estimatedTotal);

  // Step 1: Initiate order & launch Razorpay Checkout
  const handleInitiatePayment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || name.trim().length < 2) {
      setErrorMessage('Please enter your full name (at least 2 characters).');
      return;
    }
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (!INDIAN_MOBILE_REGEX.test(cleanPhone)) {
      setErrorMessage('Please enter a valid 10-digit Indian mobile number (starting with 6, 7, 8, or 9).');
      return;
    }
    if (!email.trim()) {
      setErrorMessage('Email address is required because your digital QR pass will be sent here.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (!isSeason && !selectedDate) {
      setErrorMessage('Please select a booking date.');
      return;
    }
    if (!termsAccepted) {
      setErrorMessage('Please accept the ticket terms & conditions to continue.');
      return;
    }

    setErrorMessage('');
    setPaymentFailed(false);
    setSubmitting(true);

    try {
      // 1. Create order on backend
      const effectiveDates = isSeason ? EVENT_DATES : [selectedDate];

      const res = await fetchApi('/commercial/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: name.trim(),
          customerMobile: cleanPhone,
          customerEmail: email.trim().toLowerCase(),
          ticketType,
          selectedDates: effectiveDates,
          quantity,
          termsAccepted: true,
        }),
      });

      const orderData = res?.order;
      if (!orderData || !orderData.orderNumber) {
        throw new Error('Could not initiate order. Please try again.');
      }

      // If backend created this as a safe staging test payment order, passes are returned directly
      if (
        (res?.isTestPayment || orderData?.isTestPayment) &&
        Array.isArray(res?.passes) &&
        res.passes.length > 0
      ) {
        setIsTestOrder(true);
        setConfirmedOrderNumber(orderData.orderNumber);
        setConfirmedPasses(res.passes);
        setSubmitting(false);
        return;
      }

      setPendingOrder(orderData);

      // 2. Open Razorpay Standard Checkout
      if (typeof window !== 'undefined' && (window as any).Razorpay) {
        const options = {
          key: orderData.razorpayKeyId,
          amount: orderData.amountPaise,
          currency: orderData.currency || 'INR',
          name: 'ONGC Navratri 2026',
          description: isSeason
            ? 'All 9 Nights Season Pass'
            : activeOption.name,
          image: '/images/logo-web.png',
          order_id:
            typeof orderData.razorpayOrderId === 'string' &&
            orderData.razorpayOrderId.startsWith('order_mock_')
              ? undefined
              : orderData.razorpayOrderId || undefined,
          prefill: {
            name: orderData.customer?.name,
            email: orderData.customer?.email,
            contact: orderData.customer?.mobile,
          },
          theme: {
            color: '#7A1930',
          },
          handler: async function (response: any) {
            const paymentId = response.razorpay_payment_id;
            const signature = response.razorpay_signature;

            if (!paymentId || !signature) {
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
              setErrorMessage('Payment was cancelled. You can retry when ready.');
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
        setSubmitting(false);
        setPaymentFailed(true);
        setErrorMessage(
          'The payment gateway could not be loaded. Please check your connection and try again — no payment has been made.',
        );
      }
    } catch (err: any) {
      setSubmitting(false);
      setErrorMessage(err.message || 'Failed to initiate order. Please try again.');
    }
  };

  // Step 2: Backend cryptographic signature verification & pass generation
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

      if (res.success && res.passes) {
        setConfirmedOrderNumber(res.orderNumber);
        setConfirmedPasses(res.passes);
        setPendingOrder(null);
      } else {
        throw new Error(res.message || 'Payment signature verification failed.');
      }
    } catch (err: any) {
      setErrorMessage(
        err.message ||
          'Payment verification could not be confirmed. If money was deducted, your passes will be issued automatically via email shortly.',
      );
      setPaymentFailed(true);
    } finally {
      setVerifying(false);
    }
  };

  const resetForm = () => {
    setName('');
    setEmail('');
    setPhone('');
    setQuantity(1);
    setSelectedDate('2026-10-11');
    setTicketType('COMMERCIAL_DAILY');
    setErrorMessage('');
    setPaymentFailed(false);
    setPendingOrder(null);
    setConfirmedOrderNumber(null);
    setConfirmedPasses([]);
    setIsTestOrder(false);
    setTermsAccepted(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-cream text-ink">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <PublicHeader />

      <main className="flex-1">
        {/* CONTAINER */}
        <div className="max-w-4xl mx-auto pt-6 sm:pt-8 pb-12 px-4 sm:px-6">
          {/* COMPACT CHECKOUT HEADER (Replaces large marketing hero) */}
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-stone-200">
            <div>
              <h1 className="font-outfit font-black text-2xl sm:text-3xl text-ink tracking-tight">
                Buy Your Commercial Pass
              </h1>
              <p className="text-xs sm:text-sm text-ink-soft">
                Official Digital Entry Passes &bull; ONGC Navratri 2026, Ahmedabad
              </p>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold w-fit">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Official Ticketing Portal</span>
            </div>
          </div>

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
                  {isTestOrder ? (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-900 bg-amber-100 px-3 py-1 rounded-full uppercase tracking-wider border border-amber-300">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      <span>STAGING TEST PAYMENT &bull; NOT A REAL PURCHASE</span>
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full uppercase tracking-wider border border-emerald-200">
                      Payment Verified &bull; Confirmed
                    </span>
                  )}
                  <h2 className="font-outfit font-extrabold text-2xl sm:text-3xl text-ink pt-1">
                    {isTestOrder ? 'Pass Confirmed (Staging Test Mode)' : 'Your Passes are Ready!'}
                  </h2>
                  <p className="text-xs sm:text-sm text-ink-soft">
                    Order Reference:{' '}
                    <span className="font-mono font-bold text-maroon">{confirmedOrderNumber}</span>
                  </p>
                </div>

                {isTestOrder && (
                  <p className="text-xs sm:text-sm text-amber-900 bg-amber-50 p-3 rounded-xl border border-amber-200 max-w-lg mx-auto font-medium">
                    This commercial pass was generated using safe staging test mode without live Razorpay payment. Official QR codes and emails have been generated for testing.
                  </p>
                )}

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
                        {isTestOrder && (
                          <span className="text-[10px] font-bold text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full uppercase ml-2">
                            STAGING TEST PASS
                          </span>
                        )}
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
                        <span>Category:</span>
                        <span className="font-bold text-ink text-[11px]">
                          Commercial Pass
                        </span>
                      </div>
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

              {/* TICKET GUIDELINES */}
              <TicketGuidelines className="mt-6" />

              <div className="text-center pt-4">
                <button
                  onClick={resetForm}
                  type="button"
                  className="px-6 py-2.5 rounded-xl bg-maroon text-white font-bold text-xs hover:bg-maroon-dark transition-all inline-flex items-center gap-2 shadow-md cursor-pointer"
                >
                  <Ticket className="w-4 h-4 text-gold-light" />
                  <span>Buy Additional Passes</span>
                </button>
              </div>
            </div>
          ) : (
            /* COMMERCIAL PURCHASE FORM */
            <div className="bg-white rounded-3xl p-5 sm:p-8 md:p-10 border border-gold/40 shadow-xl space-y-6">
              {errorMessage && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm font-semibold flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="flex-1">{errorMessage}</div>
                </div>
              )}

              <form onSubmit={handleInitiatePayment} className="space-y-6">
                {/* STEP 1 — CATEGORY */}
                <div className="space-y-3">
                  <div>
                    <h2 className="font-outfit font-black text-base sm:text-lg text-ink uppercase tracking-wider flex items-center gap-2">
                      <Ticket className="w-5 h-5 text-maroon" />
                      <span>1. Choose Category <span className="text-rose-600">*</span></span>
                    </h2>
                    <p className="text-xs text-ink-soft">
                      Select your preferred commercial pass category
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {PASS_OPTIONS.map((opt) => {
                      const isSelected = ticketType === opt.code;
                      const sPrice = serverPricing?.[opt.code]?.priceInr ?? opt.price;
                      const sOrigPrice = serverPricing?.[opt.code]?.originalPriceInr ?? opt.originalPrice;
                      const sTiming = serverPricing?.[opt.code]?.timing ?? opt.timing;

                      return (
                        <button
                          key={opt.code}
                          type="button"
                          onClick={() => setTicketType(opt.code)}
                          className={`relative p-5 rounded-2xl border-2 text-left transition-all duration-200 overflow-hidden cursor-pointer flex flex-col justify-between ${
                            isSelected
                              ? 'border-[#7A1930] bg-gradient-to-b from-[#FAF7F2] via-amber-50/40 to-[#FAF7F2] shadow-lg ring-2 ring-[#7A1930]/15'
                              : 'border-stone-200 bg-white hover:border-[#7A1930]/40 hover:shadow-xs'
                          }`}
                        >
                          <div className="w-full">
                            {/* Badges strip */}
                            <div className="flex items-center justify-between gap-2 mb-3">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-[#7A1930] border border-[#D4AF37]/50">
                                <Sparkles className="w-3 h-3 text-[#E65100]" />
                                <span>{opt.offerLabel}</span>
                              </span>
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide bg-[#7A1930] text-[#FAF7F2]">
                                {opt.discountLabel}
                              </span>
                            </div>

                            {/* Pass title & description */}
                            <h3 className="font-outfit font-black text-base sm:text-lg text-ink tracking-tight">
                              {opt.name}
                            </h3>
                            <p className="text-[11px] text-ink-soft leading-snug mt-1">
                              {opt.description}
                            </p>

                            {/* Prominent Timing Chip */}
                            <div className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-stone-100/90 text-stone-800 text-[11px] font-bold border border-stone-200">
                              <Clock className="w-3.5 h-3.5 text-maroon" />
                              <span>{sTiming}</span>
                            </div>
                          </div>

                          {/* Price strip */}
                          <div className="pt-3 mt-3 border-t border-stone-200/70 flex items-baseline justify-between flex-wrap gap-2">
                            <div className="flex items-baseline gap-2">
                              <span className="text-xs text-stone-400 font-bold line-through decoration-rose-600">
                                ₹{sOrigPrice.toLocaleString('en-IN')}
                              </span>
                              <span className="font-outfit font-black text-2xl text-[#7A1930] tracking-tight">
                                ₹{sPrice.toLocaleString('en-IN')}
                              </span>
                              <span className="text-[11px] font-semibold text-ink-soft">
                                {opt.isSeason ? '/ 9 nights' : '/ pass'}
                              </span>
                            </div>

                            <span
                              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                isSelected
                                  ? 'border-maroon bg-maroon text-white'
                                  : 'border-stone-300 bg-white'
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* PROMINENT TIMING CALLOUT */}
                  <div
                    className={`p-4 rounded-2xl border flex items-start gap-3 transition-all ${
                      activeOption.timingCategory === 'Mandli'
                        ? 'bg-amber-50/80 border-amber-300/80 text-amber-950'
                        : 'bg-maroon/5 border-maroon/20 text-maroon-dark'
                    }`}
                  >
                    <Clock
                      className={`w-5 h-5 shrink-0 mt-0.5 ${
                        activeOption.timingCategory === 'Mandli'
                          ? 'text-amber-700'
                          : 'text-maroon'
                      }`}
                    />
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-outfit font-black text-sm uppercase tracking-wide">
                          {activeOption.timingCategory === 'Mandli'
                            ? 'Mandli Pass Timing:'
                            : 'Garba Pass Timing:'}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider ${
                            activeOption.timingCategory === 'Mandli'
                              ? 'bg-amber-200/80 text-amber-900 border border-amber-300'
                              : 'bg-maroon text-white'
                          }`}
                        >
                          {activeTiming}
                        </span>
                      </div>
                      <p className="text-xs text-ink/80 leading-relaxed">
                        {activeOption.timingCategory === 'Mandli'
                          ? 'Post-Midnight Entry: 12:00 AM to 4:00 AM. This pass is exclusively valid for late-night Mandli Garba.'
                          : 'Evening to Late-Night Entry: 8:00 PM to 4:00 AM. Gates open at 7:30 PM for general Garba attendance.'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* STEP 2 — DATE */}
                <div className="space-y-3 pt-6 border-t border-stone-100">
                  <div>
                    <h2 className="font-outfit font-black text-base sm:text-lg text-ink uppercase tracking-wider flex items-center gap-2">
                      <CalendarCheck className="w-5 h-5 text-maroon" />
                      <span>2. Select Date <span className="text-rose-600">*</span></span>
                    </h2>
                    <p className="text-xs text-ink-soft">
                      {isSeason
                        ? 'Season Pass automatically covers all 9 event dates.'
                        : 'Select one booking date for this order.'}
                    </p>
                  </div>

                  {isSeason ? (
                    <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border-2 border-emerald-300 text-emerald-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                          <CheckCircle2 className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="font-outfit font-extrabold text-base text-emerald-950">
                            All Event Dates
                          </h3>
                          <p className="text-xs text-emerald-800">
                            Covers all 9 festival nights (11 Oct – 19 Oct 2026)
                          </p>
                        </div>
                      </div>
                      <span className="self-start sm:self-auto px-3 py-1 rounded-full text-xs font-bold bg-white text-emerald-800 border border-emerald-300 shadow-xs">
                        All 9 Nights Included
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-2">
                        {EVENT_DATES.map((iso, idx) => {
                          const isSelected = selectedDate === iso;
                          const { weekday, chipLabel } = formatDateChip(iso);
                          return (
                            <button
                              key={iso}
                              type="button"
                              onClick={() => handleSelectDate(iso)}
                              className={`p-2 sm:p-2.5 rounded-xl text-center border-2 transition-all flex flex-col items-center justify-center cursor-pointer ${
                                isSelected
                                  ? 'bg-maroon text-white border-maroon shadow-md scale-[1.03] ring-2 ring-gold/40'
                                  : 'bg-cream-light text-ink border-stone-200 hover:border-maroon/50 hover:bg-stone-50'
                              }`}
                            >
                              <span
                                className={`text-[9px] uppercase tracking-wider font-bold ${
                                  isSelected ? 'text-gold-light' : 'text-ink-soft'
                                }`}
                              >
                                Day {idx + 1}
                              </span>
                              <span className="font-outfit font-black text-sm sm:text-base leading-tight mt-0.5">
                                {chipLabel}
                              </span>
                              <span
                                className={`text-[9px] font-medium mt-0.5 ${
                                  isSelected ? 'text-gold-light/90' : 'text-stone-400'
                                }`}
                              >
                                {weekday}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      <div className="p-3 rounded-xl bg-amber-50/70 border border-[#D4AF37]/40 flex items-center justify-between text-xs text-ink flex-wrap gap-2">
                        <span className="flex items-center gap-1.5 font-medium">
                          <CalendarCheck className="w-4 h-4 text-maroon" />
                          <span>Booking Date: <strong className="text-maroon font-bold">{formatDateChip(selectedDate).fullDate} ({formatDateChip(selectedDate).weekday})</strong></span>
                        </span>
                        <span className="text-[11px] text-ink-soft">
                          Tapping another date replaces your selection
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* STEP 3 — QUANTITY */}
                <div className="space-y-2 pt-6 border-t border-stone-100">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <h2 className="font-outfit font-black text-base sm:text-lg text-ink uppercase tracking-wider flex items-center gap-2">
                      <Ticket className="w-5 h-5 text-maroon" />
                      <span>3. Quantity <span className="text-rose-600">*</span></span>
                    </h2>
                    <span className="text-[11px] text-ink-soft">
                      (1 to 10 passes per booking)
                    </span>
                  </div>
                  <p className="text-xs text-ink-soft">
                    All passes will share the selected category ({activeOption.name}) and date ({isSeason ? 'All Event Dates' : formatDateChip(selectedDate).fullDate}).
                  </p>
                  <CustomQuantityDropdown
                    value={quantity}
                    onChange={setQuantity}
                    disabled={submitting || verifying}
                  />
                </div>

                {/* STEP 4 — CUSTOMER DETAILS */}
                <div className="space-y-4 pt-6 border-t border-stone-100">
                  <div>
                    <h2 className="font-outfit font-black text-base sm:text-lg text-ink uppercase tracking-wider">
                      4. Customer Details
                    </h2>
                    <p className="text-xs text-ink-soft">
                      Primary contact details for this booking
                    </p>
                  </div>

                  <div>
                    <label htmlFor="reg-name" className="block text-xs font-bold text-ink mb-1.5">
                      Full Name <span className="text-rose-600">*</span>
                    </label>
                    <input
                      id="reg-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      autoComplete="name"
                      placeholder="e.g. Priyesh Shah"
                      className="w-full px-4 py-3 rounded-xl bg-cream-light border border-stone-300 text-ink text-sm focus:outline-none focus:border-maroon focus:ring-1 focus:ring-maroon"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="reg-phone" className="block text-xs font-bold text-ink mb-1.5">
                        Mobile Number (10 Digits) <span className="text-rose-600">*</span>
                      </label>
                      <input
                        id="reg-phone"
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
                        autoComplete="tel"
                        placeholder="e.g. 9876543210"
                        className="w-full px-4 py-3 rounded-xl bg-cream-light border border-stone-300 text-ink text-sm focus:outline-none focus:border-maroon focus:ring-1 focus:ring-maroon"
                      />
                    </div>

                    <div>
                      <label htmlFor="reg-email" className="block text-xs font-bold text-ink mb-1.5">
                        Email Address <span className="text-rose-600">*</span>
                      </label>
                      <input
                        id="reg-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        inputMode="email"
                        autoComplete="email"
                        placeholder="e.g. priyesh@example.com"
                        className="w-full px-4 py-3 rounded-xl bg-cream-light border border-stone-300 text-ink text-sm focus:outline-none focus:border-maroon focus:ring-1 focus:ring-maroon"
                      />
                      <p className="text-[11px] text-stone-500 mt-1">
                        Your QR pass will be sent to this email.
                      </p>
                    </div>
                  </div>
                </div>

                {/* STEP 5 — REVIEW */}
                <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-[#FAF7F2] to-amber-50/40 border border-[#D4AF37]/40 space-y-3.5 text-xs shadow-sm">
                  <div className="flex items-center justify-between pb-2 border-b border-stone-200/80">
                    <h2 className="font-outfit font-black text-sm sm:text-base text-ink uppercase tracking-wider">
                      5. Review Booking
                    </h2>
                    <span className="text-[11px] font-semibold text-maroon bg-maroon/10 px-2.5 py-0.5 rounded-full">
                      {quantity} {quantity === 1 ? 'Pass' : 'Passes'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1">
                      <span className="text-[11px] text-ink-soft uppercase tracking-wider font-semibold">Pass Category</span>
                      <p className="font-outfit font-extrabold text-sm text-ink">{activeOption.name}</p>
                      <p className="text-[11px] text-maroon font-bold">{activeTiming}</p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[11px] text-ink-soft uppercase tracking-wider font-semibold">Booking Date</span>
                      <p className="font-outfit font-extrabold text-sm text-ink">
                        {isSeason ? 'All Event Dates' : formatDateChip(selectedDate).fullDate}
                      </p>
                      <p className="text-[11px] text-ink-soft">
                        {isSeason ? 'Covers all 9 nights (Oct 11 – 19)' : `${formatDateChip(selectedDate).weekday} night entry`}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[11px] text-ink-soft uppercase tracking-wider font-semibold">Quantity</span>
                      <p className="font-outfit font-bold text-sm text-ink">
                        {quantity} {quantity === 1 ? 'Pass' : 'Passes'}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[11px] text-ink-soft uppercase tracking-wider font-semibold">Customer Details</span>
                      <p className="font-bold text-sm text-ink truncate">
                        {name.trim() || '—'}
                      </p>
                      <p className="text-[11px] text-ink-soft truncate">
                        {phone || '—'} &bull; {email.trim() || '—'}
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-stone-200/80 pt-3 space-y-1.5">
                    <div className="flex items-center justify-between text-ink-soft">
                      <span>Price per Pass:</span>
                      <span className="font-bold text-ink">₹{unitPricePerPass.toLocaleString('en-IN')}</span>
                    </div>

                    <div className="flex items-center justify-between text-ink-soft">
                      <span>Original Price:</span>
                      <span className="font-semibold text-stone-400 line-through decoration-rose-600">
                        ₹{estimatedOriginalTotal.toLocaleString('en-IN')}
                      </span>
                    </div>

                    {estimatedSavings > 0 && (
                      <div className="flex items-center justify-between text-[#E65100] font-bold">
                        <span className="flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
                          Savings ({activeOption.discountLabel}):
                        </span>
                        <span>-₹{estimatedSavings.toLocaleString('en-IN')}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-stone-200/80 text-sm">
                      <span className="font-outfit font-extrabold text-ink text-base">Total Amount:</span>
                      <span className="font-outfit font-black text-2xl sm:text-3xl text-[#7A1930] tracking-tight">
                        ₹{estimatedTotal.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-stone-100 border border-stone-200 text-[11px] text-ink-soft">
                    <strong>Order Rule:</strong> 1 Order = 1 Category + 1 Booking Date + Quantity. If tickets for another date are needed, please place another order after completing this booking. {isSeason && '(Season Pass covers all dates in 1 order).'}
                  </div>
                </div>

                {/* IMPORTANT INFORMATION & TERMS */}
                <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/70 border border-gold/40 space-y-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-maroon shrink-0" />
                    <h3 className="font-outfit font-black text-xs sm:text-sm text-ink uppercase tracking-wider">
                      Important Information
                    </h3>
                  </div>

                  <ul className="space-y-1.5 list-disc list-inside text-xs text-stone-700 leading-relaxed font-medium">
                    <li>Your digital QR pass will be sent to your registered email address.</li>
                    <li>Please enter an active email address that you can access (email is mandatory).</li>
                    <li>Please keep your QR pass ready on your phone at the entry gate.</li>
                    <li>Tickets are non-refundable and non-transferable.</li>
                    <li>Daily / Season / Any Day passes are valid from 8:00 PM to 4:00 AM.</li>
                    <li>Mandli passes are valid only from 12:00 AM to 4:00 AM.</li>
                    <li>Each QR pass is unique to your booking. Do not share your QR pass with unauthorized persons.</li>
                  </ul>

                  <div className="pt-2.5 border-t border-gold/30">
                    <label
                      htmlFor="terms-checkbox"
                      className="flex items-start gap-2.5 cursor-pointer select-none text-ink font-semibold text-xs sm:text-sm"
                    >
                      <input
                        type="checkbox"
                        id="terms-checkbox"
                        data-testid="terms-checkbox"
                        checked={termsAccepted}
                        onChange={(e) => setTermsAccepted(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-stone-300 text-maroon focus:ring-maroon cursor-pointer accent-[#7A1930]"
                      />
                      <span>
                        I have read and agree to the ticket terms & conditions. <span className="text-rose-600">*</span>
                      </span>
                    </label>
                  </div>
                </div>

                {/* STEP 6 — PAYMENT */}
                <div className="space-y-3 pt-2">
                  <button
                    type="submit"
                    disabled={!termsAccepted || submitting || verifying}
                    aria-label="Buy your pass"
                    data-testid="buy-pass-submit"
                    className={`w-full py-4 rounded-2xl font-outfit font-black text-base sm:text-lg transition-all shadow-lg flex items-center justify-center gap-2.5 border ${
                      !termsAccepted || submitting || verifying
                        ? 'bg-stone-200 text-stone-400 border-stone-300 cursor-not-allowed shadow-none'
                        : 'bg-gradient-to-r from-[#D4AF37] via-amber-400 to-[#D4AF37] hover:brightness-105 text-[#7A1930] border-[#7A1930]/20 hover:shadow-xl cursor-pointer'
                    }`}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Initializing Secure Gateway...</span>
                      </>
                    ) : (
                      <>
                        <Ticket className="w-5 h-5 text-[#7A1930]" />
                        <span>BUY YOUR PASS &bull; ₹{estimatedTotal.toLocaleString('en-IN')}</span>
                      </>
                    )}
                  </button>
                  <div className="flex items-center justify-center gap-2 text-[11px] text-ink-soft text-center">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Secure Payment via Razorpay &bull; Instant Digital QR Delivery</span>
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

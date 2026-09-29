'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import PublicHeader from '@/components/PublicHeader';
import PublicFooter from '@/components/PublicFooter';
import TicketGuidelines from '@/components/TicketGuidelines';
import MaintenanceNotice from '@/components/MaintenanceNotice';
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
  Download,
  Lock,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { generateDownloadablePassSvg, resolveOrderSelectedDates } from './bookpass-order.util';
import BookPassSection, {
  EVENT_DATES,
  formatDateChip,
  PASS_OPTIONS,
  INDIAN_MOBILE_REGEX,
  type TicketTypeCode,
} from '@/components/BookPassSection';

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

interface ConfirmedOrderSummary {
  orderNumber: string;
  ticketType: TicketTypeCode;
  selectedDates: string[];
  quantity: number;
  amountInr: number;
  customerEmail: string;
  customerName: string;
}

function getPassTiming(ticketType: TicketTypeCode): string {
  if (ticketType === 'COMMERCIAL_MANDLI') {
    return '12:00 AM – 4:00 AM';
  }
  return '8:00 PM – 4:00 AM';
}

function getPassTypeLabel(ticketType: TicketTypeCode): string {
  switch (ticketType) {
    case 'COMMERCIAL_SEASON':
      return 'Season Pass (All 9 Nights)';
    case 'COMMERCIAL_MANDLI':
      return 'Mandli Pass';
    case 'COMMERCIAL_ANY_DAY':
      return 'Any Day Pass';
    case 'COMMERCIAL_DAILY':
    default:
      return 'Daily Entry Pass';
  }
}

function formatConfirmedDates(dates: string[] | undefined, ticketType: TicketTypeCode): string {
  if (ticketType === 'COMMERCIAL_SEASON') {
    return '11–19 October 2026 (All 9 Nights)';
  }
  if (ticketType === 'COMMERCIAL_ANY_DAY') {
    return 'Valid on Any 1 Night (11–19 Oct 2026)';
  }
  if (!dates || dates.length === 0) {
    return '11–19 October 2026';
  }
  return dates
    .map((d) => {
      const dt = new Date(d + 'T00:00:00');
      return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    })
    .join(', ');
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

function ensureRazorpayLoaded(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if ((window as any).Razorpay) return Promise.resolve(true);

  return new Promise((resolve) => {
    const existing = document.querySelector('script[src*="checkout.razorpay.com"]');
    if (existing) {
      let checks = 0;
      const interval = setInterval(() => {
        checks++;
        if ((window as any).Razorpay) {
          clearInterval(interval);
          resolve(true);
        } else if (checks > 30) {
          clearInterval(interval);
          resolve(false);
        }
      }, 100);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
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
  const [confirmedOrderSummary, setConfirmedOrderSummary] = useState<ConfirmedOrderSummary | null>(null);

  const router = useRouter();

  const handleViewTicket = (e: React.MouseEvent<HTMLAnchorElement>, qrCodeToken: string) => {
    // If opening in a new tab via modifier keys, allow native browser behavior
    if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey || e.button !== 0) {
      return;
    }
    e.preventDefault();
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    router.push(`/ticket/${qrCodeToken}`);
  };

  const handleDownloadPass = (pass: GeneratedPass, passLabel: string, formattedDates: string) => {
    if (pass.qrSvg) {
      const passSvg = generateDownloadablePassSvg({
        ticketNumber: pass.ticketNumber,
        name: pass.name,
        passTypeLabel: passLabel,
        formattedDates,
        qrSvg: pass.qrSvg,
      });
      const blob = new Blob([passSvg], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ONGC-Pass-${pass.ticketNumber}.svg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else {
      window.open(`/ticket/${pass.qrCodeToken}`, '_blank');
    }
  };

  // Server-synced pricing config & authoritative payment gateway state
  const [serverPricing, setServerPricing] = useState<Record<string, any> | null>(null);
  const [paymentEnabled, setPaymentEnabled] = useState<boolean>(false);

  // Load server-side commercial pricing, dates & payment status on mount
  useEffect(() => {
    async function loadConfig() {
      try {
        setLoadingConfig(true);
        const res = await fetchApi('/commercial/config');
        if (res) {
          if (res.ticketTypes) {
            const map: Record<string, any> = {};
            res.ticketTypes.forEach((t: any) => {
              map[t.code] = t;
            });
            setServerPricing(map);
          }
          if (typeof res.paymentEnabled === 'boolean') {
            setPaymentEnabled(res.paymentEnabled);
          }
        }
      } catch {
        // Fallback to local constants; paymentEnabled stays false
      } finally {
        setLoadingConfig(false);
      }
    }
    loadConfig();
  }, []);

  // Step 1: Initiate order & launch Razorpay Checkout from BookPassSection
  const handleInitiatePayment = async (data: {
    ticketType: TicketTypeCode;
    selectedDate: string;
    quantity: number;
    name: string;
    phone: string;
    email: string;
    attendeeNames: string[];
    termsAccepted: boolean;
    estimatedTotal: number;
  }) => {
    if (!paymentEnabled) {
      setErrorMessage('Online payments are currently unavailable. Please try again later.');
      return;
    }

    setErrorMessage('');
    setPaymentFailed(false);
    setSubmitting(true);

    try {
      const cleanPhone = data.phone.replace(/[^0-9]/g, '');
      const isSeason = data.ticketType === 'COMMERCIAL_SEASON';
      const isAnyDay = data.ticketType === 'COMMERCIAL_ANY_DAY';
      const effectiveDates = resolveOrderSelectedDates(data.ticketType, data.selectedDate, EVENT_DATES);

      const res = await fetchApi('/commercial/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: data.name.trim(),
          customerMobile: cleanPhone,
          customerEmail: data.email.trim().toLowerCase(),
          ticketType: data.ticketType,
          selectedDates: effectiveDates,
          quantity: data.quantity,
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
        setConfirmedOrderSummary({
          orderNumber: orderData.orderNumber,
          ticketType: (orderData.ticketType as TicketTypeCode) || data.ticketType,
          selectedDates: (orderData.selectedDates as string[]) || (isSeason ? EVENT_DATES : (isAnyDay ? [] : [data.selectedDate])),
          quantity: orderData.quantity || data.quantity,
          amountInr: orderData.amountInr ?? (orderData.amountPaise ? orderData.amountPaise / 100 : data.estimatedTotal),
          customerEmail: orderData.customer?.email || data.email.trim().toLowerCase(),
          customerName: orderData.customer?.name || data.name.trim(),
        });
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
        setSubmitting(false);
        return;
      }

      setPendingOrder(orderData);

      // 2. Open Razorpay Standard Checkout
      let rzpReady = typeof window !== 'undefined' && Boolean((window as any).Razorpay);
      if (!rzpReady) {
        rzpReady = await ensureRazorpayLoaded();
      }

      if (rzpReady && typeof window !== 'undefined' && (window as any).Razorpay) {
        const activeOption = PASS_OPTIONS.find((t) => t.code === data.ticketType) || PASS_OPTIONS[0];
        const isMockOrTestOrderId =
          typeof orderData.razorpayOrderId === 'string' &&
          (orderData.razorpayOrderId.startsWith('order_mock_') ||
           orderData.razorpayOrderId.startsWith('TEST_ORD_'));
        const options = {
          key: orderData.razorpayKeyId,
          amount: orderData.amountPaise,
          currency: orderData.currency || 'INR',
          name: 'ONGC Navratri 2026',
          description: isSeason
            ? 'All 9 Nights Season Pass'
            : activeOption.name,
          image: '/images/logo-web.png',
          order_id: isMockOrTestOrderId ? undefined : orderData.razorpayOrderId || undefined,
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
        setConfirmedOrderSummary({
          orderNumber: res.orderNumber,
          ticketType: (res.ticketType as TicketTypeCode) || pendingOrder?.ticketType || 'COMMERCIAL_DAILY',
          selectedDates: (res.selectedDates as string[]) || pendingOrder?.selectedDates || [],
          quantity: res.quantity || pendingOrder?.quantity || 1,
          amountInr: res.amountInr ?? (pendingOrder?.amountInr || (pendingOrder?.amountPaise ? pendingOrder.amountPaise / 100 : 0)),
          customerEmail: res.customerEmail || pendingOrder?.customer?.email || '',
          customerName: pendingOrder?.customer?.name || res.customerName || '',
        });
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
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
    setConfirmedOrderSummary(null);
    setIsTestOrder(false);
    setTermsAccepted(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-cream text-ink">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
      <PublicHeader />

      <main className="flex-1">
        <MaintenanceNotice pageType="booking">
        {confirmedPasses.length > 0 ? (
          /* REDESIGNED DIGITAL TICKET CONFIRMATION EXPERIENCE */
          <div className="max-w-3xl mx-auto pt-6 sm:pt-10 pb-16 px-4 sm:px-6 space-y-8">
            {/* 1. ONGC NAVRATRI HEADER */}
            <div className="text-center space-y-3 pb-3 border-b border-stone-200/80">
              <img
                src="/images/logo-web.png"
                alt="ONGC Logo"
                className="h-14 sm:h-16 w-auto max-w-[220px] object-contain mx-auto"
              />
              <div>
                <h1 className="font-cinzel font-black text-2xl sm:text-3xl text-maroon tracking-wide uppercase">
                  ONGC NAVRATRI 2026
                </h1>
                <p className="text-xs sm:text-sm font-semibold text-ink-soft tracking-wider uppercase mt-1">
                  Ahmedabad &bull; Official Digital Entry Pass
                </p>
              </div>
            </div>

            {/* 2. SUCCESS STATE */}
            <div className="text-center space-y-2">
              <div className="inline-flex flex-wrap items-center justify-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-emerald-800 bg-emerald-50 px-4 py-1.5 rounded-full border border-emerald-300 shadow-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>PAYMENT / BOOKING CONFIRMED</span>
                </span>
                {isTestOrder && (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-900 bg-amber-100 px-3 py-1 rounded-full uppercase tracking-wider border border-amber-300 shadow-xs">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    <span>STAGING TEST PAYMENT &bull; NOT A REAL PURCHASE</span>
                  </span>
                )}
              </div>
              <p className="text-sm font-medium text-ink-soft pt-1">
                Your digital entry pass is ready. Show the QR code below at the gate.
              </p>
              {isTestOrder && (
                <p className="text-xs text-amber-900 bg-amber-50 p-3 rounded-xl border border-amber-200 max-w-lg mx-auto font-medium">
                  This E-Pass was generated using safe staging test mode without live Razorpay payment. Official QR codes and emails have been generated for testing.
                </p>
              )}
            </div>

            {/* 3. YOUR DIGITAL PASS — FIRST / MAIN FOCUS */}
            <div className="space-y-4">
              <div className="text-center">
                <h2 className="font-outfit font-black text-xl sm:text-2xl text-ink uppercase tracking-wider">
                  {confirmedPasses.length > 1 ? 'YOUR DIGITAL PASSES' : 'YOUR DIGITAL PASS'}
                </h2>
                <p className="text-xs text-ink-soft mt-1">
                  {confirmedPasses.length > 1
                    ? 'Each pass has a unique QR code. Present individual QR passes at the entrance.'
                    : 'Present this QR pass to security staff at the entrance turnstiles.'}
                </p>
              </div>

              {/* Individual Pass Cards */}
              <div className="space-y-6">
                {confirmedPasses.map((pass, index) => {
                  const passType = confirmedOrderSummary?.ticketType || ticketType;
                  const passLabel = getPassTypeLabel(passType);
                  const formattedDates = formatConfirmedDates(
                    pass.bookingDays?.length ? pass.bookingDays : confirmedOrderSummary?.selectedDates,
                    passType,
                  );

                  return (
                    <div
                      key={pass.id || index}
                      className="bg-white rounded-3xl border-2 border-gold/70 shadow-xl overflow-hidden relative max-w-lg mx-auto"
                    >
                      {/* Top Decorative Gradient Strip */}
                      <div className="h-2.5 bg-gradient-to-r from-maroon-deep via-gold to-maroon" />

                      <div className="p-6 sm:p-8 text-center space-y-4">
                        {/* Header within Card */}
                        <div className="space-y-1">
                          <img
                            src="/images/logo-web.png"
                            alt="ONGC Logo"
                            className="h-10 sm:h-12 w-auto max-w-[180px] object-contain mx-auto"
                          />
                          <div className="text-[10px] font-bold uppercase tracking-widest text-maroon">
                            ONGC NAVRATRI 2026 &bull; OFFICIAL ENTRY PASS
                          </div>
                          <div className="inline-block bg-maroon-soft text-maroon font-bold text-xs px-3 py-1 rounded-full uppercase tracking-wider border border-gold/40">
                            {passLabel} {confirmedPasses.length > 1 ? `• Pass #${index + 1}` : ''}
                          </div>
                        </div>

                        {/* Customer / Attendee Name */}
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-ink-soft">
                            Pass Holder
                          </div>
                          <div className="font-outfit font-extrabold text-xl sm:text-2xl text-ink mt-0.5">
                            {pass.name}
                          </div>
                        </div>

                        {/* QR Code Container (High-contrast quiet zone, scannable) */}
                        <div className="p-4 sm:p-5 bg-white rounded-2xl border-2 border-stone-200 inline-block mx-auto shadow-sm">
                          {pass.qrSvg ? (
                            <div
                              className="w-48 h-48 sm:w-56 sm:h-56 mx-auto bg-white p-2 rounded-xl"
                              dangerouslySetInnerHTML={{ __html: pass.qrSvg }}
                            />
                          ) : (
                            <div className="w-48 h-48 sm:w-56 sm:h-56 bg-stone-100 flex items-center justify-center rounded-xl mx-auto">
                              <QrCode className="w-12 h-12 text-stone-400" />
                            </div>
                          )}
                          <div className="text-[11px] font-mono font-bold text-maroon uppercase tracking-widest mt-2">
                            SCAN AT ENTRY
                          </div>
                        </div>

                        {/* Ticket ID & Dates */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-cream-soft p-3.5 rounded-2xl border border-stone-200/80 text-left text-xs">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-ink-soft tracking-wider block">
                              Ticket ID
                            </span>
                            <span className="font-mono font-bold text-maroon text-sm break-all">
                              {pass.ticketNumber}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-ink-soft tracking-wider block">
                              Event Date
                            </span>
                            <span className="font-semibold text-ink text-xs block">
                              {formattedDates}
                            </span>
                          </div>
                        </div>

                        {/* 4. TICKET ACTIONS (Directly below each ticket) */}
                        <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                          <Link
                            href={`/ticket/${pass.qrCodeToken}`}
                            onClick={(e) => handleViewTicket(e, pass.qrCodeToken)}
                            className="flex-1 py-3 px-4 rounded-xl bg-gold text-maroon-deep font-bold text-xs sm:text-sm hover:bg-gold-light transition-all text-center border border-maroon/20 flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                          >
                            <ExternalLink className="w-4 h-4" />
                            <span>VIEW MY TICKET</span>
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleDownloadPass(pass, passLabel, formattedDates)}
                            className="flex-1 py-3 px-4 rounded-xl bg-maroon text-white font-bold text-xs sm:text-sm hover:bg-maroon-dark transition-all text-center flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                          >
                            <Download className="w-4 h-4 text-gold-light" />
                            <span>DOWNLOAD PASS</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 5. QR WARNING */}
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-center gap-2 text-center text-xs font-semibold text-amber-900 max-w-lg mx-auto shadow-xs">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>This QR code is unique to this pass. Please do not share or forward it.</span>
              </div>
            </div>

            {/* 6. BOOKING DETAILS */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gold/40 shadow-md space-y-4">
              <h3 className="font-outfit font-black text-sm sm:text-base uppercase tracking-wider text-ink border-b border-stone-100 pb-3">
                BOOKING DETAILS
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
                <div>
                  <span className="text-ink-soft block text-[11px] uppercase font-bold tracking-wider">
                    Order Reference
                  </span>
                  <span className="font-mono font-bold text-maroon text-sm sm:text-base break-all">
                    {confirmedOrderSummary?.orderNumber || confirmedOrderNumber}
                  </span>
                </div>
                <div>
                  <span className="text-ink-soft block text-[11px] uppercase font-bold tracking-wider">
                    Pass Type
                  </span>
                  <span className="font-bold text-ink">
                    {getPassTypeLabel(confirmedOrderSummary?.ticketType || ticketType)}
                  </span>
                </div>
                <div>
                  <span className="text-ink-soft block text-[11px] uppercase font-bold tracking-wider">
                    Event Date
                  </span>
                  <span className="font-semibold text-ink">
                    {formatConfirmedDates(
                      confirmedOrderSummary?.selectedDates,
                      confirmedOrderSummary?.ticketType || ticketType,
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-ink-soft block text-[11px] uppercase font-bold tracking-wider">
                    Pass Quantity
                  </span>
                  <span className="font-semibold text-ink">
                    {confirmedPasses.length} {confirmedPasses.length === 1 ? 'Pass' : 'Passes'}
                  </span>
                </div>
                <div>
                  <span className="text-ink-soft block text-[11px] uppercase font-bold tracking-wider">
                    Amount Paid
                  </span>
                  <span className="font-bold text-emerald-700 text-sm sm:text-base">
                    ₹{(confirmedOrderSummary?.amountInr ?? 0).toLocaleString('en-IN')}
                  </span>
                </div>
                <div>
                  <span className="text-ink-soft block text-[11px] uppercase font-bold tracking-wider">
                    Booking Status
                  </span>
                  <span className="inline-block font-extrabold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-300 text-xs">
                    CONFIRMED
                  </span>
                </div>
              </div>
            </div>

            {/* 7. EVENT INFORMATION */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gold/40 shadow-md space-y-4">
              <h3 className="font-outfit font-black text-sm sm:text-base uppercase tracking-wider text-ink border-b border-stone-100 pb-3">
                EVENT INFORMATION
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
                <div>
                  <span className="text-ink-soft block text-[11px] uppercase font-bold tracking-wider">
                    Venue
                  </span>
                  <span className="font-bold text-ink">
                    Malaviya Cricket Ground ONGC, Ahmedabad
                  </span>
                </div>
                <div>
                  <span className="text-ink-soft block text-[11px] uppercase font-bold tracking-wider">
                    Event
                  </span>
                  <span className="font-bold text-maroon">
                    ONGC Navratri 2026
                  </span>
                </div>
                <div>
                  <span className="text-ink-soft block text-[11px] uppercase font-bold tracking-wider">
                    Event Dates
                  </span>
                  <span className="font-semibold text-ink">
                    11–19 October 2026
                  </span>
                </div>
                <div>
                  <span className="text-ink-soft block text-[11px] uppercase font-bold tracking-wider">
                    Gates Open
                  </span>
                  <span className="font-semibold text-ink">
                    From 7:00 PM
                  </span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-ink-soft block text-[11px] uppercase font-bold tracking-wider">
                    Pass Timing
                  </span>
                  <span className="font-bold text-maroon text-sm">
                    {getPassTiming(confirmedOrderSummary?.ticketType || ticketType)}
                  </span>
                </div>
              </div>
            </div>

            {/* 8. ENTRY GUIDELINES */}
            <TicketGuidelines />

            {/* 9. SPONSORS / PARTNERS */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gold/40 shadow-md space-y-5 text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-maroon-soft border border-gold/40 text-maroon text-[11px] font-bold tracking-wider uppercase mx-auto">
                <Sparkles className="w-3.5 h-3.5 text-gold-dark" />
                <span>OUR PARTNERS</span>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="text-[10px] font-bold text-ink-soft uppercase tracking-widest mb-3">
                    TITLE SPONSORS
                  </div>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                    <img
                      src="/images/sponsors/Zaira_Logo_With_Tagline_v17.jpg"
                      alt="Zaira Diamond"
                      className="max-h-16 w-auto object-contain"
                    />
                    <span className="hidden sm:inline text-gold text-xs">◆</span>
                    <img
                      src="/images/sponsors/Om_Resort_Palace_Logowhitebg.jpg"
                      alt="Om Sanctuary Palace"
                      className="max-h-14 w-auto object-contain"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-stone-100">
                  <div className="text-[10px] font-bold text-ink-soft uppercase tracking-widest mb-2">
                    MEDIA SPONSOR
                  </div>
                  <div className="flex items-center justify-center">
                    <img
                      src="/images/sponsors/Lalkaar_News.png"
                      alt="Lalkaar News"
                      className="max-h-12 w-auto object-contain"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 10. EVENT ORGANISER */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gold/40 shadow-md text-center space-y-2">
              <div className="text-[10px] font-bold text-ink-soft uppercase tracking-widest">
                EVENT ORGANISER
              </div>
              <img
                src="/images/digant-art-logo.png"
                alt="Digant Art"
                className="h-12 w-auto object-contain mx-auto rounded-lg"
              />
              <div className="font-outfit font-extrabold text-base text-maroon">
                Digant Art
              </div>
              <p className="text-xs text-ink-soft">
                Official Event Organiser
              </p>
            </div>

            {/* 11. FOOTER & ACTIONS */}
            <div className="text-center space-y-4 pt-2">
              <p className="text-xs text-ink-soft">
                Need assistance? Contact support at{' '}
                <a href="mailto:ongcnavratri@gmail.com" className="text-maroon font-bold hover:underline">
                  ongcnavratri@gmail.com
                </a>
              </p>
              <p className="text-[11px] text-stone-400">
                This is an automated ticket confirmation. Please retain your booking reference.
              </p>
              <div className="pt-2">
                <button
                  onClick={resetForm}
                  type="button"
                  className="px-6 py-3 rounded-xl bg-maroon text-white font-bold text-xs sm:text-sm hover:bg-maroon-dark transition-all inline-flex items-center gap-2 shadow-md cursor-pointer"
                >
                  <Ticket className="w-4 h-4 text-gold-light" />
                  <span>Buy Additional Passes</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* CHECKOUT FORM EXPERIENCE */
          <div className="max-w-4xl mx-auto pt-6 sm:pt-8 pb-12 px-4 sm:px-6">
            {/* COMPACT CHECKOUT HEADER (Replaces large marketing hero) */}
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-stone-200">
              <div>
                <h1 className="font-outfit font-black text-2xl sm:text-3xl text-ink tracking-tight">
                  Buy Your E-Pass
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
            ) : (
              <BookPassSection
                isPreview={false}
                paymentEnabled={paymentEnabled}
                submitting={submitting}
                errorMessage={errorMessage}
                onInitiatePayment={handleInitiatePayment}
              />
          )}
        </div>
        )}
        </MaintenanceNotice>
      </main>

      <PublicFooter />
    </div>
  );
}

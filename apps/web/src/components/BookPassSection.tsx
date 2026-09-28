'use client';

import React, { useState, useEffect } from 'react';
import {
  Ticket,
  AlertCircle,
  ShieldCheck,
  Loader2,
  Sparkles,
  Clock,
  Lock,
  ExternalLink,
  Check,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { resolveOrderSelectedDates } from '@/app/bookpass/bookpass-order.util';

export const EVENT_DATES = [
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

export function formatDateChip(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  return {
    weekday: d.toLocaleDateString('en-IN', { weekday: 'short' }),
    day: d.toLocaleDateString('en-IN', { day: '2-digit' }),
    month: d.toLocaleDateString('en-IN', { month: 'short' }),
    fullDate: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
    chipLabel: `${d.toLocaleDateString('en-IN', { month: 'short' })} ${d.getDate()}`,
  };
}

export const INDIAN_MOBILE_REGEX = /^[6-9][0-9]{9}$/;

export type TicketTypeCode =
  | 'COMMERCIAL_DAILY'
  | 'COMMERCIAL_SEASON'
  | 'COMMERCIAL_MANDLI'
  | 'COMMERCIAL_ANY_DAY';

export interface PassOption {
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

export const PASS_OPTIONS: PassOption[] = [
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

export interface BookPassSectionProps {
  isPreview?: boolean;
  paymentEnabled?: boolean;
  submitting?: boolean;
  errorMessage?: string;
  onInitiatePayment?: (data: {
    ticketType: TicketTypeCode;
    selectedDate: string;
    quantity: number;
    name: string;
    phone: string;
    email: string;
    attendeeNames: string[];
    termsAccepted: boolean;
    estimatedTotal: number;
  }) => void;
}

export default function BookPassSection({
  isPreview = false,
  paymentEnabled: propPaymentEnabled,
  submitting = false,
  errorMessage: propErrorMessage = '',
  onInitiatePayment,
}: BookPassSectionProps) {
  const [ticketType, setTicketType] = useState<TicketTypeCode>('COMMERCIAL_DAILY');
  const [selectedDate, setSelectedDate] = useState<string>('2026-10-11');
  const [quantity, setQuantity] = useState<number>(1);
  const [name, setName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [attendeeNames, setAttendeeNames] = useState<string[]>([]);
  const [termsAccepted, setTermsAccepted] = useState<boolean>(false);
  const [localError, setLocalError] = useState<string>('');
  const [serverPricing, setServerPricing] = useState<Record<string, any> | null>(null);
  const [paymentEnabled, setPaymentEnabled] = useState<boolean>(
    typeof propPaymentEnabled === 'boolean' ? propPaymentEnabled : false,
  );
  const [previewNotice, setPreviewNotice] = useState<string | null>(null);

  // Sync prop changes
  useEffect(() => {
    if (typeof propPaymentEnabled === 'boolean') {
      setPaymentEnabled(propPaymentEnabled);
    }
  }, [propPaymentEnabled]);

  // Load config on mount if not provided
  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetchApi('/commercial/config');
        if (res) {
          if (res.ticketTypes) {
            const map: Record<string, any> = {};
            res.ticketTypes.forEach((t: any) => {
              map[t.code] = t;
            });
            setServerPricing(map);
          }
          if (typeof propPaymentEnabled !== 'boolean' && typeof res.paymentEnabled === 'boolean') {
            setPaymentEnabled(res.paymentEnabled);
          }
        }
      } catch {
        // Fallback gracefully
      }
    }
    loadConfig();
  }, [propPaymentEnabled]);

  // Keep attendee names array synced with quantity
  useEffect(() => {
    const requiredExtraAttendees = Math.max(0, quantity - 1);
    setAttendeeNames((prev) => {
      const updated = [...prev];
      if (updated.length < requiredExtraAttendees) {
        while (updated.length < requiredExtraAttendees) {
          updated.push('');
        }
      } else if (updated.length > requiredExtraAttendees) {
        updated.length = requiredExtraAttendees;
      }
      return updated;
    });
  }, [quantity]);

  // Resolve pricing
  const activeOption = PASS_OPTIONS.find((t) => t.code === ticketType) || PASS_OPTIONS[0];
  const serverItem = serverPricing?.[ticketType];
  const unitPrice = serverItem?.priceInr ?? activeOption.price;
  const originalUnitPrice = serverItem?.originalPriceInr ?? activeOption.originalPrice;
  const activeTiming = serverItem?.timing ?? activeOption.timing;

  const isSeason = ticketType === 'COMMERCIAL_SEASON';
  const isAnyDay = ticketType === 'COMMERCIAL_ANY_DAY';

  const unitPricePerPass = unitPrice;
  const originalUnitPricePerPass = originalUnitPrice;
  const estimatedTotal = unitPricePerPass * quantity;
  const estimatedOriginalTotal = originalUnitPricePerPass * quantity;
  const estimatedSavings = Math.max(0, estimatedOriginalTotal - estimatedTotal);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    setPreviewNotice(null);

    if (isPreview) {
      if (!paymentEnabled) {
        setPreviewNotice('Online payments are currently OFF. Customer checkout is disabled.');
      } else {
        setPreviewNotice(
          'Preview mode simulation only: Real payments cannot be initiated from this Test Lab preview. Use "Open Live Book Pass" to test the real customer checkout.',
        );
      }
      return;
    }

    if (!paymentEnabled) {
      setLocalError('Online payments are currently unavailable. Please try again later.');
      return;
    }

    if (!name.trim() || name.trim().length < 2) {
      setLocalError('Please enter your full name (at least 2 characters).');
      return;
    }
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (!INDIAN_MOBILE_REGEX.test(cleanPhone)) {
      setLocalError('Please enter a valid 10-digit Indian mobile number (starting with 6, 7, 8, or 9).');
      return;
    }
    if (!email.trim()) {
      setLocalError('Email address is required because your digital QR pass will be sent here.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setLocalError('Please enter a valid email address.');
      return;
    }
    if (!isSeason && !isAnyDay && !selectedDate) {
      setLocalError('Please select a booking date.');
      return;
    }
    if (!termsAccepted) {
      setLocalError('Please accept the ticket terms & conditions to continue.');
      return;
    }

    onInitiatePayment?.({
      ticketType,
      selectedDate,
      quantity,
      name,
      phone,
      email,
      attendeeNames,
      termsAccepted,
      estimatedTotal,
    });
  };

  const displayedError = propErrorMessage || localError;

  return (
    <div className="bg-white rounded-3xl p-5 sm:p-8 md:p-10 border border-gold/40 shadow-xl space-y-6">
      {/* Top Banner when payments are disabled */}
      {!paymentEnabled && (
        <div
          data-testid="payment-disabled-banner"
          className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-[#7A1930] text-xs sm:text-sm font-semibold flex items-center justify-between gap-3 animate-in fade-in"
        >
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <div className="font-outfit font-black tracking-wide uppercase text-xs text-amber-800">
                Online Payments Paused
              </div>
              <p className="text-xs text-stone-600 mt-0.5 font-medium">
                Online payments are currently unavailable. Please try again later.
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-700 border border-rose-200 shrink-0">
            PAYMENTS OFF
          </span>
        </div>
      )}

      {/* Preview Simulation Banner */}
      {previewNotice && (
        <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-blue-900 text-xs font-semibold flex items-start gap-2.5">
          <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="flex-1">{previewNotice}</div>
          <button
            type="button"
            onClick={() => setPreviewNotice(null)}
            className="text-blue-500 hover:text-blue-700 text-xs font-bold"
          >
            &times;
          </button>
        </div>
      )}

      {displayedError && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm font-semibold flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">{displayedError}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* STEP 1 — CATEGORY */}
        <div className="space-y-3">
          <div>
            <h2 className="font-outfit font-black text-base sm:text-lg text-ink uppercase tracking-wider flex items-center gap-2">
              <Ticket className="w-5 h-5 text-maroon" />
              <span>
                1. Choose Category <span className="text-rose-600">*</span>
              </span>
            </h2>
            <p className="text-xs text-ink-soft">Select your preferred E-Pass category</p>
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
                    <p className="text-[11px] text-ink-soft leading-snug mt-1">{opt.description}</p>

                    {/* Timing Chip */}
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
                          ? 'border-[#7A1930] bg-[#7A1930] text-[#FAF7F2]'
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
        </div>

        {/* STEP 2 — DATE SELECTION (Omitted for Season Pass and Any Day Pass) */}
        {!isSeason && !isAnyDay && (
          <div className="space-y-3 pt-2">
            <div>
              <h2 className="font-outfit font-black text-base sm:text-lg text-ink uppercase tracking-wider">
                2. Select Date <span className="text-rose-600">*</span>
              </h2>
              <p className="text-xs text-ink-soft">
                Choose the single event date for this booking
              </p>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-2">
              {EVENT_DATES.map((date) => {
                const isSelected = selectedDate === date;
                const chip = formatDateChip(date);

                return (
                  <button
                    key={date}
                    type="button"
                    onClick={() => setSelectedDate(date)}
                    className={`py-3 px-2 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center ${
                      isSelected
                        ? 'border-[#7A1930] bg-[#7A1930] text-[#FAF7F2] shadow-md ring-2 ring-[#7A1930]/30'
                        : 'border-stone-200 bg-stone-50/60 hover:bg-amber-50/50 hover:border-gold text-stone-700'
                    }`}
                  >
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider ${
                        isSelected ? 'text-[#D4AF37]' : 'text-stone-500'
                      }`}
                    >
                      {chip.weekday}
                    </span>
                    <span className="font-outfit font-black text-lg leading-tight mt-0.5">
                      {chip.day}
                    </span>
                    <span
                      className={`text-[10px] font-semibold ${
                        isSelected ? 'text-white/80' : 'text-stone-400'
                      }`}
                    >
                      {chip.month}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 3 — QUANTITY */}
        <div className="space-y-3 pt-2">
          <div>
            <h2 className="font-outfit font-black text-base sm:text-lg text-ink uppercase tracking-wider">
              {isAnyDay || isSeason ? '2. Select Quantity' : '3. Select Quantity'}{' '}
              <span className="text-rose-600">*</span>
            </h2>
            <p className="text-xs text-ink-soft">
              Up to 10 passes can be booked in a single transaction
            </p>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => setQuantity(num)}
                className={`w-10 h-10 rounded-xl font-outfit font-extrabold text-sm transition-all cursor-pointer shrink-0 ${
                  quantity === num
                    ? 'bg-maroon text-white shadow-md'
                    : 'bg-stone-100 hover:bg-stone-200 text-ink'
                }`}
              >
                {num}
              </button>
            ))}
          </div>
        </div>

        {/* STEP 4 — CUSTOMER DETAILS */}
        <div className="space-y-4 pt-2">
          <div>
            <h2 className="font-outfit font-black text-base sm:text-lg text-ink uppercase tracking-wider">
              {isAnyDay || isSeason ? '3. Customer Details' : '4. Customer Details'}{' '}
              <span className="text-rose-600">*</span>
            </h2>
            <p className="text-xs text-ink-soft">
              Primary ticket holder information &bull; Digital pass delivery
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-ink mb-1">
                Full Name <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Rajesh Kumar Patel"
                className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white font-medium text-ink focus:outline-maroon"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-ink mb-1">
                Mobile Number (10 digits) <span className="text-rose-600">*</span>
              </label>
              <input
                type="tel"
                required
                maxLength={10}
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
                placeholder="9876543210"
                className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white font-medium text-ink focus:outline-maroon font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-ink mb-1">
                Email Address <span className="text-rose-600">*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="rajesh.patel@example.com"
                className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white font-medium text-ink focus:outline-maroon"
              />
              <p className="text-[11px] text-stone-500 mt-1">
                Your QR passes and booking confirmation receipt will be delivered to this email.
              </p>
            </div>
          </div>

          {/* Attendee Names for Quantity > 1 */}
          {quantity > 1 && (
            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
              <div className="text-xs font-bold text-ink">Additional Pass Holders (Optional)</div>
              <p className="text-[11px] text-stone-500">
                You can specify the name of each attendee to print on their individualized pass.
              </p>
              <div className="space-y-2">
                {attendeeNames.map((attName, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-xs font-bold text-stone-500 w-16">Pass {idx + 2}:</span>
                    <input
                      type="text"
                      value={attName}
                      onChange={(e) => {
                        const updated = [...attendeeNames];
                        updated[idx] = e.target.value;
                        setAttendeeNames(updated);
                      }}
                      placeholder={`Attendee ${idx + 2} Full Name`}
                      className="flex-1 text-xs px-3 py-2 rounded-xl border border-stone-300 bg-white text-ink focus:outline-maroon"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* STEP 5 (or 4 for Any Day Pass) — REVIEW BOOKING */}
        <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-[#FAF7F2] to-amber-50/40 border border-[#D4AF37]/40 space-y-3.5 text-xs shadow-xs">
          <div className="flex items-center justify-between pb-2 border-b border-stone-200/80">
            <h2 className="font-outfit font-black text-sm sm:text-base text-ink uppercase tracking-wider">
              {isAnyDay || isSeason ? '4. Review Booking' : '5. Review Booking'}
            </h2>
            <span className="text-[11px] font-semibold text-maroon bg-maroon/10 px-2.5 py-0.5 rounded-full">
              {quantity} {quantity === 1 ? 'Pass' : 'Passes'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <span className="text-[11px] text-ink-soft uppercase tracking-wider font-semibold">
                Pass Category
              </span>
              <p className="font-outfit font-extrabold text-sm text-ink">{activeOption.name}</p>
              <p className="text-[11px] text-maroon font-bold">{activeTiming}</p>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] text-ink-soft uppercase tracking-wider font-semibold">
                Booking Date
              </span>
              <p className="font-outfit font-extrabold text-sm text-ink">
                {isSeason
                  ? 'All Event Dates'
                  : isAnyDay
                  ? 'Any 1 Event Night'
                  : formatDateChip(selectedDate).fullDate}
              </p>
              <p className="text-[11px] text-ink-soft">
                {isSeason
                  ? 'Covers all 9 nights (Oct 11 – 19)'
                  : isAnyDay
                  ? 'Valid on any 1 night (Oct 11 – 19)'
                  : `${formatDateChip(selectedDate).weekday} night entry`}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] text-ink-soft uppercase tracking-wider font-semibold">
                Quantity
              </span>
              <p className="font-outfit font-bold text-sm text-ink">
                {quantity} {quantity === 1 ? 'Pass' : 'Passes'}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] text-ink-soft uppercase tracking-wider font-semibold">
                Customer Details
              </span>
              <p className="font-bold text-sm text-ink truncate">{name.trim() || '—'}</p>
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
            <strong>Order Rule:</strong>{' '}
            {isAnyDay
              ? 'Any Day Pass gives 1 flexible entry on any 1 official event night (11–19 Oct 2026).'
              : isSeason
              ? 'Season Pass covers all 9 dates in 1 order.'
              : '1 Order = 1 Category + 1 Booking Date + Quantity.'}
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
                I have read and agree to the ticket terms &amp; conditions.{' '}
                <span className="text-rose-600">*</span>
              </span>
            </label>
          </div>
        </div>

        {/* STEP 6 — PAYMENT ACTION */}
        <div className="space-y-3 pt-2">
          {!paymentEnabled ? (
            /* DISABLED ONLINE PAYMENT STATE */
            <div className="space-y-3" data-testid="payment-disabled-control">
              <div className="p-4 rounded-2xl bg-stone-100 border border-stone-200 text-stone-600 text-center space-y-1">
                <div className="flex items-center justify-center gap-1.5 text-stone-800 font-bold text-xs uppercase tracking-wide">
                  <Lock className="w-3.5 h-3.5 text-stone-500" />
                  <span>Online Payments Unavailable</span>
                </div>
                <p className="text-[11px] text-stone-500">
                  Online payments are currently unavailable. Please try again later.
                </p>
              </div>

              <button
                type="button"
                disabled
                data-testid="buy-pass-submit"
                className="w-full py-4 rounded-2xl font-outfit font-black text-base sm:text-lg bg-stone-200 text-stone-400 border border-stone-300 cursor-not-allowed shadow-none flex items-center justify-center gap-2.5 select-none"
              >
                <Lock className="w-5 h-5 text-stone-400" />
                <span>ONLINE PAYMENT UNAVAILABLE</span>
              </button>
            </div>
          ) : isPreview ? (
            /* PREVIEW ONLY SUBMIT BUTTON (Never triggers real payment) */
            <div className="space-y-3">
              <button
                type="submit"
                data-testid="buy-pass-submit"
                className="w-full py-4 rounded-2xl font-outfit font-black text-base sm:text-lg bg-gradient-to-r from-[#D4AF37] via-amber-400 to-[#D4AF37] hover:brightness-105 text-[#7A1930] border border-[#7A1930]/20 shadow-lg cursor-pointer flex items-center justify-center gap-2.5 transition-all"
              >
                <Ticket className="w-5 h-5 text-[#7A1930]" />
                <span>
                  BUY YOUR PASS &bull; ₹{estimatedTotal.toLocaleString('en-IN')} (PREVIEW ONLY)
                </span>
              </button>
              <div className="flex items-center justify-center gap-2 text-[11px] text-stone-500 text-center">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Visual Simulation &bull; Real payments cannot be initiated in Preview</span>
              </div>
            </div>
          ) : (
            /* REAL CUSTOMER PAYMENT SUBMIT BUTTON */
            <div className="space-y-3">
              <button
                type="submit"
                disabled={!termsAccepted || submitting}
                aria-label="Buy your pass"
                data-testid="buy-pass-submit"
                className={`w-full py-4 rounded-2xl font-outfit font-black text-base sm:text-lg transition-all shadow-lg flex items-center justify-center gap-2.5 border ${
                  !termsAccepted || submitting
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
          )}
        </div>
      </form>
    </div>
  );
}

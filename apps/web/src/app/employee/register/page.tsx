'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Info,
  CheckCircle2,
  CheckCircle,
  AlertCircle,
  User,
  Users,
  Trash2,
  Plus,
  Loader2,
  IdCard,
  Calendar,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Ticket,
  Mail,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import MaintenanceNotice from '@/components/MaintenanceNotice';
import { getEventDayTheme } from '@ongc/shared-types';

// ----------------------------------------------------------------------------
// Event dates for ONGC Navratri 2026.
// ----------------------------------------------------------------------------
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

function formatDateShort(iso: string) {
  const { day, month } = formatDateChip(iso);
  return `${day} ${month}`;
}

const EMPLOYEE_CATEGORIES = [
  { value: 'REGULAR', label: 'Regular Employee', desc: 'Active permanent ONGC employees' },
  { value: 'RETIRED', label: 'Retired Employee', desc: 'Superannuated / retired ONGC personnel' },
  { value: 'CONTRACT', label: 'Contract Employee', desc: 'Tenure-based contract & project staff' },
] as const;

type EmployeeCategory = (typeof EMPLOYEE_CATEGORIES)[number]['value'];

const INDIAN_MOBILE_REGEX = /^[6-9][0-9]{9}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CPF_REGEX = /^[0-9]{5}$/;

interface CommonEmployeeData {
  cpf: string;
  name: string;
  mobile: string;
  email: string;
}

interface FamilyMemberForm {
  localId: string;
  name: string;
  relation: string;
  mobileNo: string;
  email: string;
  selectedDates: string[];
}

function createFamilyMember(): FamilyMemberForm {
  return {
    localId: `fm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: '',
    relation: 'Family Member',
    mobileNo: '',
    email: '',
    selectedDates: [],
  };
}

function DateChipGrid({
  selectedDates,
  onToggle,
  onToggleAll,
}: {
  selectedDates: string[];
  onToggle: (date: string) => void;
  onToggleAll: () => void;
}) {
  const allSelected = selectedDates.length === EVENT_DATES.length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-stone-600">
          Selected: <strong className="text-maroon">{selectedDates.length}</strong> of {EVENT_DATES.length} nights
        </span>
        <button
          type="button"
          onClick={onToggleAll}
          className="text-xs font-bold px-3 py-1 rounded-lg border border-maroon/30 text-maroon hover:bg-maroon-soft transition-colors cursor-pointer"
        >
          {allSelected ? 'Clear All Dates' : 'Select All Dates'}
        </button>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-2">
        {EVENT_DATES.map((iso, idx) => {
          const selected = selectedDates.includes(iso);
          const { weekday, day, month } = formatDateChip(iso);
          const theme = getEventDayTheme(iso);
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onToggle(iso)}
              style={
                selected
                  ? {
                      backgroundColor: theme.primaryColor,
                      borderColor: theme.secondaryColor,
                      color: '#FFFFFF',
                    }
                  : {
                      backgroundColor: theme.bgColor,
                      borderColor: `${theme.primaryColor}38`,
                    }
              }
              className={`p-2 rounded-xl text-center border-2 transition-all flex flex-col items-center justify-center cursor-pointer ${
                selected ? 'scale-[1.02] shadow-md' : 'hover:scale-[1.01]'
              }`}
            >
              <div className="flex items-center justify-center gap-1">
                <span
                  className="text-[9px] uppercase tracking-wider font-bold"
                  style={{
                    color: selected ? theme.secondaryColor : theme.primaryColor,
                  }}
                >
                  Day {idx + 1}
                </span>
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{
                    backgroundColor: theme.secondaryColor,
                  }}
                />
              </div>
              <span
                className={`font-outfit font-extrabold text-base leading-tight mt-0.5 ${
                  selected ? 'text-white' : 'text-stone-900'
                }`}
              >
                {day}
              </span>
              <span
                className={`text-[10px] font-semibold ${
                  selected ? 'text-white/90' : 'text-stone-600'
                }`}
              >
                {month}
              </span>
              <span
                className="text-[9px] font-medium mt-0.5"
                style={{
                  color: selected ? `${theme.secondaryColor}E6` : '#78716c',
                }}
              >
                {weekday}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepIndicator({ step }: { step: 1 | 2 | 3 | 4 }) {
  const steps = [
    { num: 1, label: 'Employee', icon: User },
    { num: 2, label: 'Family', icon: Users },
    { num: 3, label: 'Dates', icon: Calendar },
    { num: 4, label: 'Review', icon: ClipboardCheck },
  ];

  return (
    <div className="w-full pb-4 border-b border-stone-200">
      <div className="grid grid-cols-4 gap-2">
        {steps.map((s) => {
          const Icon = s.icon;
          const active = step === s.num;
          const done = step > s.num;
          return (
            <div
              key={s.num}
              className={`flex items-center gap-2 p-2 rounded-xl border transition-all ${
                active
                  ? 'bg-maroon text-white border-maroon shadow-sm'
                  : done
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-cream-light text-ink-soft border-stone-200'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                  active
                    ? 'bg-white/20 text-white'
                    : done
                    ? 'bg-emerald-600 text-white'
                    : 'bg-stone-200 text-ink-soft'
                }`}
              >
                {done ? <CheckCircle className="w-3.5 h-3.5" /> : s.num}
              </div>
              <div className="hidden sm:block min-w-0">
                <div className="text-[11px] font-bold truncate leading-tight">{s.label}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function EmployeeRegisterPage() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [stepError, setStepError] = useState('');
  const [referenceNumber, setReferenceNumber] = useState<string | null>(null);

  // STEP 1 STATE
  const [category, setCategory] = useState<EmployeeCategory | null>(null);
  const [common, setCommon] = useState<CommonEmployeeData>({
    cpf: '',
    name: '',
    mobile: '',
    email: '',
  });

  // STEP 2 STATE: Family members (Max 3)
  const [familyMembers, setFamilyMembers] = useState<FamilyMemberForm[]>([]);

  // STEP 3 STATE: Dates
  const [employeeDates, setEmployeeDates] = useState<string[]>([]);

  const scrollTop = () => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  };

  const addFamilyMember = () => {
    if (familyMembers.length >= 3) {
      setStepError('Maximum 3 family members are permitted per primary employee.');
      return;
    }
    setStepError('');
    setFamilyMembers((prev) => [...prev, createFamilyMember()]);
  };

  const removeFamilyMember = (index: number) => {
    setFamilyMembers((prev) => prev.filter((_, i) => i !== index));
  };

  const updateFamilyMemberName = (index: number, name: string) => {
    setFamilyMembers((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], name };
      return next;
    });
  };

  const updateFamilyMemberRelation = (index: number, relation: string) => {
    setFamilyMembers((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], relation };
      return next;
    });
  };

  const updateFamilyMemberMobile = (index: number, mobileNo: string) => {
    const digitsOnly = mobileNo.replace(/[^0-9]/g, '').slice(0, 10);
    setFamilyMembers((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], mobileNo: digitsOnly };
      return next;
    });
  };

  const updateFamilyMemberEmail = (index: number, email: string) => {
    setFamilyMembers((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], email };
      return next;
    });
  };

  const toggleEmployeeDate = (date: string) => {
    setEmployeeDates((prev) =>
      prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date].sort()
    );
  };

  const toggleAllEmployeeDates = () => {
    setEmployeeDates((prev) =>
      prev.length === EVENT_DATES.length ? [] : [...EVENT_DATES]
    );
  };

  const toggleFamilyDate = (index: number, date: string) => {
    setFamilyMembers((prev) => {
      const next = [...prev];
      const cur = next[index].selectedDates;
      const updated = cur.includes(date) ? cur.filter((d) => d !== date) : [...cur, date].sort();
      next[index] = { ...next[index], selectedDates: updated };
      return next;
    });
  };

  const toggleAllFamilyDates = (index: number) => {
    setFamilyMembers((prev) => {
      const next = [...prev];
      const cur = next[index].selectedDates;
      const updated = cur.length === EVENT_DATES.length ? [] : [...EVENT_DATES];
      next[index] = { ...next[index], selectedDates: updated };
      return next;
    });
  };

  const applyEmployeeDatesToAll = () => {
    if (employeeDates.length === 0) return;
    setFamilyMembers((prev) =>
      prev.map((m) => ({
        ...m,
        selectedDates: [...employeeDates],
      }))
    );
  };

  // STEP VALIDATORS
  const validateStep1 = (): string | null => {
    if (!category) return 'Please select an employee category.';
    const cpf = common.cpf.trim();
    if (!cpf) return 'Please enter your ONGC CPF number.';
    if (!CPF_REGEX.test(cpf)) return 'Employee CPF No. must accept ONLY 5 numeric digits.';
    if (!common.name.trim()) return 'Please enter the employee full name.';
    const mobile = common.mobile.trim();
    if (!mobile) return 'Please enter the employee 10-digit mobile number.';
    if (!INDIAN_MOBILE_REGEX.test(mobile)) {
      return 'Employee mobile number must be exactly 10 digits starting with 6, 7, 8, or 9.';
    }
    const email = common.email.trim();
    if (!email) return 'Email address is required because your digital QR pass will be sent here.';
    if (!EMAIL_REGEX.test(email)) return 'Please enter a valid email address.';
    return null;
  };

  const validateStep2 = (): string | null => {
    if (familyMembers.length > 3) {
      return 'Maximum 3 family members are permitted per primary employee.';
    }
    for (let i = 0; i < familyMembers.length; i++) {
      const m = familyMembers[i];
      if (!m.name.trim()) return `Please enter the name for Family Member #${i + 1}.`;
      const mobile = m.mobileNo.trim();
      if (!mobile) return `Mobile number is required for Family Member #${i + 1} (${m.name.trim() || 'unnamed'}).`;
      if (!INDIAN_MOBILE_REGEX.test(mobile)) {
        return `Mobile number for Family Member #${i + 1} must be exactly 10 digits starting with 6, 7, 8, or 9.`;
      }
      const email = m.email.trim();
      if (!email) {
        return `Please provide a valid email address for Family Member #${i + 1} (${m.name.trim() || 'unnamed'}). Their ticket will be shared through email for this member.`;
      }
      if (!EMAIL_REGEX.test(email)) {
        return `Please provide a valid email address for Family Member #${i + 1}.`;
      }
    }
    return null;
  };

  const validateStep3 = (): string | null => {
    if (employeeDates.length === 0) return 'Please select at least one attendance date for the employee.';
    return null;
  };

  const goNext = async () => {
    setStepError('');
    setErrorMessage('');

    if (step === 1) {
      const error = validateStep1();
      if (error) {
        setStepError(error);
        return;
      }

      // Verify CPF No. + Mobile No. against Official ONGC Master Data
      setVerifying(true);
      try {
        const verifyRes = await fetchApi('/public/employee/verify', {
          method: 'POST',
          body: JSON.stringify({
            cpf: common.cpf.trim(),
            mobile: common.mobile.trim(),
          }),
        });

        // If official master records exist and return name, ensure name is populated
        if (verifyRes?.name && !common.name.trim()) {
          setCommon((prev) => ({ ...prev, name: verifyRes.name }));
        }

        setStep(2);
        scrollTop();
      } catch (err: any) {
        const msg =
          err.message ||
          'The CPF No. and Mobile No. do not match the official ONGC employee records. Please check the details and try again.';
        setStepError(msg);
        scrollTop();
      } finally {
        setVerifying(false);
      }
      return;
    }

    if (step === 2) {
      const error = validateStep2();
      if (error) {
        setStepError(error);
        return;
      }
      setStep(3);
      scrollTop();
      return;
    }

    if (step === 3) {
      const error = validateStep3();
      if (error) {
        setStepError(error);
        return;
      }
      setStep(4);
      scrollTop();
      return;
    }
  };

  const goBack = () => {
    setStepError('');
    setErrorMessage('');
    setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3 | 4) : s));
    scrollTop();
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const error = validateStep1() || validateStep2() || validateStep3();
    if (error) {
      setStepError(error);
      setErrorMessage(error);
      scrollTop();
      return;
    }

    if (!category) {
      setStepError('Please select an employee category to continue.');
      return;
    }

    setErrorMessage('');
    setSubmitting(true);
    scrollTop();

    try {
      const cleanMobile = common.mobile.trim();
      const payload = {
        name: common.name.trim(),
        phone: cleanMobile,
        cpf: common.cpf.trim(),
        email: common.email.trim().toLowerCase(),
        designation: 'ONGC Employee',
        department: 'EWC Ahmedabad',
        employeeCategory: category,
        registrationType: 'EMPLOYEE',
        bookingDays: employeeDates,
        familyMembers: familyMembers.map((m) => ({
          name: m.name.trim(),
          relation: m.relation.trim() || 'Family Member',
          phone: m.mobileNo.trim(),
          email: m.email.trim().toLowerCase(),
          bookingDays: m.selectedDates.length > 0 ? m.selectedDates : employeeDates,
        })),
      };

      const res = await fetchApi('/public/employee/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const refNo =
        res?.data?.employee?.referenceNumber ||
        res?.employee?.referenceNumber ||
        `ONGC-${common.cpf.trim()}`;
      setReferenceNumber(refNo);
      setSubmitted(true);
      scrollTop();
    } catch (err: any) {
      setErrorMessage(err.message || 'Validation failed. Please check the entered details.');
      scrollTop();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MaintenanceNotice pageType="registration">
      <div className="w-full max-w-3xl mx-auto py-8 px-4 sm:px-6">
        {/* FLOW HERO HEADER */}
        <div className="text-center mb-6">
          <h1 className="font-cinzel font-extrabold text-2xl sm:text-3xl text-maroon uppercase tracking-wide">
            Employee &amp; Family Pass Registration
          </h1>
          <p className="text-ink-soft text-xs sm:text-sm mt-1">
            EWC Navratri 2026 &bull; Dedicated Personnel Pass Portal
          </p>
        </div>

        {submitting ? (
          /* SUBMITTING PROGRESS CARD */
          <div className="bg-white rounded-3xl p-8 sm:p-12 border border-gold/40 shadow-xl text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-cream-light text-maroon mx-auto flex items-center justify-center shadow-inner border border-gold/40">
              <Loader2 className="w-10 h-10 animate-spin text-maroon" />
            </div>

            <div className="space-y-2">
              <div className="inline-block px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold uppercase tracking-wider">
                Processing
              </div>
              <h2 className="font-outfit font-extrabold text-2xl sm:text-3xl text-ink">
                Submitting Registration...
              </h2>
              <div className="w-16 h-1 bg-gold mx-auto rounded-full" />
            </div>

            <p className="text-ink-soft text-sm sm:text-base leading-relaxed max-w-lg mx-auto">
              Please wait while your pass details are being registered and assigned your official Reference Number.
            </p>
          </div>
        ) : submitted ? (
          /* SUCCESS STATE CARD — PENDING ADMIN REVIEW & DAILY QR DELIVERY */
          <div className="bg-white rounded-3xl p-8 sm:p-12 border-2 border-emerald-500/40 shadow-xl text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center shadow-inner border border-emerald-200">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <div className="inline-block px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold uppercase tracking-wider">
                Registration Successful
              </div>
              <h2 className="font-outfit font-extrabold text-2xl sm:text-3xl text-ink">
                Registration Submitted Successfully
              </h2>
              <div className="w-16 h-1 bg-emerald-500 mx-auto rounded-full" />
            </div>

            {/* Official Pass Reference Number Banner */}
            {referenceNumber && (
              <div className="bg-gradient-to-r from-maroon/10 via-gold/15 to-maroon/10 border-2 border-gold/60 rounded-2xl p-5 max-w-lg mx-auto shadow-sm">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-maroon-dark block">
                  Official Pass Reference Number
                </span>
                <span className="font-mono text-2xl sm:text-3xl font-black text-maroon tracking-wider block mt-1">
                  {referenceNumber}
                </span>
                <p className="text-xs text-stone-600 mt-1">
                  Save this Reference Number for pass retrieval and support inquiries.
                </p>
              </div>
            )}

            <p className="text-ink-soft text-sm sm:text-base leading-relaxed max-w-lg mx-auto">
              Your registration for <strong>{common.name}</strong> (CPF: <span className="font-mono font-bold text-ink">{common.cpf}</span>) has been recorded successfully.
            </p>

            {/* Daily QR Delivery Information Banner */}
            <div className="text-left bg-cream-light border border-amber-300/80 rounded-2xl p-5 space-y-3 max-w-lg mx-auto">
              <h3 className="font-outfit font-extrabold text-sm text-maroon flex items-center gap-2">
                <Info className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Pass Delivery Information</span>
              </h3>
              <ul className="text-xs text-ink-soft space-y-2 leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="text-amber-600 font-bold">•</span>
                  <span>
                    After approval, your date-specific QR entry pass will be sent to your registered email address (<strong className="text-ink">{common.email}</strong>) for each selected event day.
                  </span>
                </li>
                {familyMembers.length > 0 && (
                  <li className="flex items-start gap-2">
                    <span className="text-amber-600 font-bold">•</span>
                    <span>
                      <strong>Family Member Passes:</strong> Each registered family member will receive their own date-specific pass directly at their individual registered email address for their selected attendance dates.
                    </span>
                  </li>
                )}
                <li className="flex items-start gap-2">
                  <span className="text-amber-600 font-bold">•</span>
                  <span>
                    <strong>Single-Day Validity:</strong> Each daily QR pass is valid strictly for entry on that specific event day and allows one entry scan.
                  </span>
                </li>
              </ul>
            </div>

            <div className="pt-2 flex items-center justify-center gap-3">
              <Link
                href="/employee/my-tickets"
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-maroon text-white font-bold text-sm hover:bg-maroon-dark transition-all shadow-md inline-flex items-center justify-center gap-2 border border-gold/40 cursor-pointer"
              >
                <Ticket className="w-4 h-4 text-gold-light" />
                <span>View My Passes / Lookup</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        ) : (
          /* STEPPED WIZARD CARD */
          <div className="bg-white rounded-3xl p-6 sm:p-10 border border-gold/40 shadow-xl space-y-6">
            <StepIndicator step={step} />

            {stepError && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-semibold flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1">{stepError}</div>
              </div>
            )}

            {errorMessage && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-semibold flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1">{errorMessage}</div>
              </div>
            )}

            <form onSubmit={submitForm} className="space-y-6">
              {/* ============================== STEP 1 — EMPLOYEE CATEGORY + INFORMATION ============================== */}
              {step === 1 && (
                <div className="space-y-6">
                  {/* Employee Category selection */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                      <div className="flex items-center gap-2">
                        <IdCard className="w-5 h-5 text-maroon" />
                        <h2 className="font-outfit font-extrabold text-base text-ink">
                          Select Employee Category <span className="text-rose-600">*</span>
                        </h2>
                      </div>
                      {category && (
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                          Selected
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {EMPLOYEE_CATEGORIES.map((cat) => {
                        const selected = category === cat.value;
                        return (
                          <button
                            key={cat.value}
                            type="button"
                            onClick={() => {
                              setCategory(cat.value);
                              setStepError('');
                            }}
                            className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                              selected
                                ? 'border-maroon bg-maroon-soft text-maroon shadow-md scale-[1.01]'
                                : 'border-stone-200 bg-cream-light hover:border-maroon/40 text-ink'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-outfit font-extrabold text-sm">{cat.label}</span>
                              {selected && <CheckCircle className="w-4 h-4 text-maroon shrink-0" />}
                            </div>
                            <p className="text-[11px] text-ink-soft leading-snug">{cat.desc}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {category && (
                    <div className="space-y-4 pt-4 border-t border-stone-100">
                      {/* Official ONGC Master Verification Notice */}
                      <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2.5">
                        <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                        <p className="leading-relaxed">
                          <strong>Official ONGC Master-Data Verification:</strong> Your 5-digit CPF No. and 10-digit registered mobile number will be verified against the official ONGC records before proceeding.
                        </p>
                      </div>

                      {/* CPF Field — STRICTLY 5 DIGITS */}
                      <div>
                        <label htmlFor="emp-cpf" className="block text-xs font-bold text-ink mb-1.5">
                          CPF No. (Exactly 5 Digits) <span className="text-rose-600">*</span>
                          <span className="ml-2 text-[10px] font-bold text-maroon-dark bg-maroon-soft px-2 py-0.5 rounded-full uppercase tracking-wide">
                            5-Digit Numeric
                          </span>
                        </label>
                        <input
                          id="emp-cpf"
                          type="text"
                          maxLength={5}
                          minLength={5}
                          value={common.cpf}
                          onChange={(e) =>
                            setCommon((prev) => ({
                              ...prev,
                              cpf: e.target.value.replace(/[^0-9]/g, '').slice(0, 5),
                            }))
                          }
                          required
                          inputMode="numeric"
                          placeholder="e.g. 12345"
                          className="w-full px-4 py-3.5 rounded-xl bg-cream-light border-2 border-maroon/25 text-ink text-lg font-mono font-bold tracking-widest focus:outline-none focus:border-maroon"
                        />
                        <p className="text-[11px] text-stone-500 mt-1">
                          Enter your exact 5-digit ONGC CPF Number (numbers only, no spaces or letters).
                        </p>
                      </div>

                      {/* Employee Name */}
                      <div>
                        <label htmlFor="emp-name" className="block text-xs font-bold text-ink mb-1.5">
                          Employee Full Name <span className="text-rose-600">*</span>
                        </label>
                        <input
                          id="emp-name"
                          type="text"
                          value={common.name}
                          onChange={(e) => setCommon((prev) => ({ ...prev, name: e.target.value }))}
                          required
                          autoComplete="name"
                          placeholder="e.g. Ramesh Kumar Patel"
                          className="w-full px-4 py-3.5 rounded-xl bg-cream-light border border-stone-300 text-ink text-sm focus:outline-none focus:border-maroon"
                        />
                      </div>

                      {/* Mobile Number */}
                      <div>
                        <label htmlFor="emp-mobile" className="block text-xs font-bold text-ink mb-1.5">
                          Mobile No. (10 Digits) <span className="text-rose-600">*</span>
                        </label>
                        <input
                          id="emp-mobile"
                          type="tel"
                          value={common.mobile}
                          onChange={(e) =>
                            setCommon((prev) => ({
                              ...prev,
                              mobile: e.target.value.replace(/[^0-9]/g, '').slice(0, 10),
                            }))
                          }
                          required
                          pattern="[6-9][0-9]{9}"
                          maxLength={10}
                          minLength={10}
                          inputMode="numeric"
                          autoComplete="tel"
                          placeholder="e.g. 9876543210"
                          className="w-full px-4 py-3.5 rounded-xl bg-cream-light border border-stone-300 text-ink text-sm focus:outline-none focus:border-maroon"
                        />
                        <p className="text-[11px] text-stone-500 mt-1">
                          Must be the 10-digit mobile number registered with ONGC master records.
                        </p>
                      </div>

                      {/* Email Address */}
                      <div>
                        <label htmlFor="emp-email" className="block text-xs font-bold text-ink mb-1.5">
                          Email Address <span className="text-rose-600">*</span>
                        </label>
                        <input
                          id="emp-email"
                          type="email"
                          value={common.email}
                          onChange={(e) => setCommon((prev) => ({ ...prev, email: e.target.value }))}
                          required
                          inputMode="email"
                          autoComplete="email"
                          placeholder="e.g. ramesh.patel@ongc.co.in"
                          className="w-full px-4 py-3.5 rounded-xl bg-cream-light border border-stone-300 text-ink text-sm focus:outline-none focus:border-maroon"
                        />
                        <p className="text-[11px] text-stone-500 mt-1">
                          Your daily QR entry pass will be sent to this email address on each selected event day.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ============================== STEP 2 — FAMILY MEMBERS (MAX 3) ============================== */}
              {step === 2 && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-maroon" />
                      <div>
                        <h2 className="font-outfit font-extrabold text-base text-ink">
                          Family Members - Up to 3 family members ({familyMembers.length}/3)
                        </h2>
                        <p className="text-[11px] text-ink-soft">
                          Register up to 3 eligible family members. Each member receives their own pass via email.
                        </p>
                      </div>
                    </div>
                    {familyMembers.length < 3 && (
                      <button
                        type="button"
                        onClick={addFamilyMember}
                        className="px-3.5 py-1.5 rounded-xl bg-maroon text-white font-bold text-xs hover:bg-maroon-dark transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Member</span>
                      </button>
                    )}
                  </div>

                  {familyMembers.length === 0 ? (
                    <div className="p-8 text-center bg-cream-light rounded-2xl border border-stone-200 space-y-3">
                      <Users className="w-10 h-10 text-maroon/40 mx-auto" />
                      <p className="text-sm font-bold text-ink">No family members added</p>
                      <p className="text-xs text-ink-soft max-w-sm mx-auto">
                        If you are attending alone, you can proceed to Date Selection. If family is accompanying you, add up to 3 members below.
                      </p>
                      <button
                        type="button"
                        onClick={addFamilyMember}
                        className="px-4 py-2 rounded-xl bg-maroon-soft text-maroon font-bold text-xs hover:bg-maroon hover:text-white transition-all inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" /> Add Family Member
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {familyMembers.map((fam, idx) => (
                        <div
                          key={fam.localId}
                          className="p-4 sm:p-5 rounded-2xl bg-cream-light border border-stone-200/80 space-y-4"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-outfit font-extrabold text-sm text-ink">
                              Family Member #{idx + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeFamilyMember(idx)}
                              className="text-xs font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Remove
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label htmlFor={`fam-name-${idx}`} className="block text-[11px] font-bold text-ink mb-1">
                                Full Name <span className="text-rose-600">*</span>
                              </label>
                              <input
                                id={`fam-name-${idx}`}
                                type="text"
                                value={fam.name}
                                onChange={(e) => updateFamilyMemberName(idx, e.target.value)}
                                required
                                autoComplete="name"
                                placeholder="e.g. Meena Patel"
                                className="w-full px-3.5 py-2.5 rounded-lg bg-white border border-stone-300 text-ink text-sm focus:outline-none focus:border-maroon"
                              />
                            </div>
                            <div>
                              <label htmlFor={`fam-relation-${idx}`} className="block text-[11px] font-bold text-ink mb-1">
                                Relationship <span className="text-rose-600">*</span>
                              </label>
                              <input
                                id={`fam-relation-${idx}`}
                                type="text"
                                value={fam.relation}
                                onChange={(e) => updateFamilyMemberRelation(idx, e.target.value)}
                                required
                                placeholder="e.g. Spouse / Son / Daughter / Parent"
                                className="w-full px-3.5 py-2.5 rounded-lg bg-white border border-stone-300 text-ink text-sm focus:outline-none focus:border-maroon"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label htmlFor={`fam-mobile-${idx}`} className="block text-[11px] font-bold text-ink mb-1">
                                Mobile No. (10 Digits) <span className="text-rose-600">*</span>
                              </label>
                              <input
                                id={`fam-mobile-${idx}`}
                                type="tel"
                                value={fam.mobileNo}
                                onChange={(e) => updateFamilyMemberMobile(idx, e.target.value)}
                                required
                                pattern="[6-9][0-9]{9}"
                                maxLength={10}
                                minLength={10}
                                inputMode="numeric"
                                autoComplete="tel"
                                placeholder="e.g. 9876543210"
                                className="w-full px-3.5 py-2.5 rounded-lg bg-white border border-stone-300 text-ink text-sm focus:outline-none focus:border-maroon"
                              />
                            </div>
                            <div>
                              <label htmlFor={`fam-email-${idx}`} className="block text-[11px] font-bold text-ink mb-1">
                                Family Member Email <span className="text-rose-600">*</span>
                              </label>
                              <input
                                id={`fam-email-${idx}`}
                                type="email"
                                value={fam.email}
                                onChange={(e) => updateFamilyMemberEmail(idx, e.target.value)}
                                required
                                inputMode="email"
                                placeholder="e.g. meena.patel@example.com"
                                className="w-full px-3.5 py-2.5 rounded-lg bg-white border border-stone-300 text-ink text-sm focus:outline-none focus:border-maroon"
                              />
                              <p className="text-[10px] text-stone-500 mt-1">
                                Please provide a valid email address for the family member. Their ticket will be shared through email for this member.
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ============================== STEP 3 — PER-PERSON DATES ============================== */}
              {step === 3 && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                    <div className="flex items-center gap-2">
                      <CalendarCheck className="w-5 h-5 text-maroon" />
                      <div>
                        <h2 className="font-outfit font-extrabold text-base text-ink">
                          Attendance Date Selection
                        </h2>
                        <p className="text-[11px] text-ink-soft">
                          Select attendance nights for each person. Use Select All Dates or choose individual nights.
                        </p>
                      </div>
                    </div>
                    {familyMembers.length > 0 && employeeDates.length > 0 && (
                      <button
                        type="button"
                        onClick={applyEmployeeDatesToAll}
                        className="px-3 py-1.5 rounded-xl bg-gold/30 hover:bg-gold/50 text-maroon-deep text-xs font-bold transition-all cursor-pointer"
                      >
                        Copy My Dates to Family
                      </button>
                    )}
                  </div>

                  {/* Employee dates */}
                  <div className="p-4 rounded-2xl bg-cream-light border border-stone-200/80 space-y-3">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-maroon" />
                      <span className="font-outfit font-bold text-sm text-ink">
                        {common.name.trim() || 'Employee'} <span className="text-rose-600">*</span>
                      </span>
                    </div>
                    <DateChipGrid
                      selectedDates={employeeDates}
                      onToggle={toggleEmployeeDate}
                      onToggleAll={toggleAllEmployeeDates}
                    />
                  </div>

                  {/* Family member dates */}
                  {familyMembers.map((fam, idx) => (
                    <div
                      key={fam.localId}
                      className="p-4 rounded-2xl bg-cream-light border border-stone-200/80 space-y-3"
                    >
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-maroon" />
                        <span className="font-outfit font-bold text-sm text-ink">
                          {fam.name.trim() || `Family Member #${idx + 1}`} ({fam.relation})
                        </span>
                      </div>
                      <DateChipGrid
                        selectedDates={fam.selectedDates}
                        onToggle={(d) => toggleFamilyDate(idx, d)}
                        onToggleAll={() => toggleAllFamilyDates(idx)}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* ============================== STEP 4 — REVIEW STEP ============================== */}
              {step === 4 && (
                <div className="space-y-6">
                  <div className="pb-3 border-b border-stone-100 flex items-center gap-2">
                    <ClipboardCheck className="w-5 h-5 text-maroon" />
                    <h2 className="font-outfit font-extrabold text-base text-ink">
                      Review Pass Registration Details
                    </h2>
                  </div>

                  {/* Employee details card */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-cream-light border border-stone-200/80 flex flex-col sm:flex-row gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-maroon-soft text-maroon flex items-center justify-center border border-maroon/20 shrink-0 mx-auto sm:mx-0">
                      <User className="w-8 h-8" />
                    </div>
                    <div className="flex-1 space-y-1 text-center sm:text-left">
                      <div className="font-outfit font-extrabold text-base text-ink">{common.name}</div>
                      <div className="text-xs text-ink-soft">
                        CPF: <span className="font-mono font-bold text-ink">{common.cpf}</span> &bull; Mobile: {common.mobile} &bull; Email: {common.email}
                      </div>
                      <div className="text-xs font-bold text-maroon-dark bg-maroon-soft inline-block px-2.5 py-0.5 rounded-full mt-1">
                        {EMPLOYEE_CATEGORIES.find((c) => c.value === category)?.label}
                      </div>
                      <div className="pt-2 text-xs font-semibold text-ink">
                        Attendance Dates ({employeeDates.length}): {employeeDates.map(formatDateShort).join(', ')}
                      </div>
                    </div>
                  </div>

                  {/* Family details card */}
                  {familyMembers.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="font-outfit font-bold text-sm text-ink">
                        Family Members ({familyMembers.length}/3)
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {familyMembers.map((m, idx) => (
                          <div
                            key={m.localId}
                            className="p-3.5 rounded-xl bg-cream-light border border-stone-200 flex items-center gap-3"
                          >
                            <div className="w-10 h-10 rounded-xl bg-maroon-soft text-maroon flex items-center justify-center shrink-0">
                              <User className="w-5 h-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-ink truncate">{m.name} ({m.relation})</p>
                              <p className="text-[11px] text-ink-soft">Mobile: {m.mobileNo}</p>
                              <p className="text-[11px] text-ink-soft truncate">Email: {m.email}</p>
                              <p className="text-[10px] text-maroon font-semibold mt-0.5">
                                {m.selectedDates.length > 0
                                  ? `${m.selectedDates.length} days selected`
                                  : 'No dates selected'}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
                    <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      <strong>Pass Delivery Notice:</strong> An official Pass Reference Number will be assigned upon submission. Date-specific QR entry passes will be sent to the registered email address of each attendee.
                    </p>
                  </div>
                </div>
              )}

              {/* STEP CONTROLS */}
              <div className="pt-4 border-t border-stone-100 flex items-center justify-between">
                {step > 1 ? (
                  <button
                    type="button"
                    onClick={goBack}
                    disabled={verifying || submitting}
                    className="px-5 py-2.5 rounded-xl border border-stone-300 text-ink font-bold text-xs hover:bg-stone-100 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <ChevronLeft className="w-4 h-4" /> Back
                  </button>
                ) : (
                  <div />
                )}

                {step < 4 ? (
                  <button
                    type="button"
                    onClick={goNext}
                    disabled={verifying || submitting}
                    className="px-6 py-2.5 rounded-xl bg-maroon text-white font-bold text-xs hover:bg-maroon-dark transition-all flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {verifying ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Verifying ONGC Master...</span>
                      </>
                    ) : (
                      <>
                        <span>Next</span>
                        <ChevronRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-8 py-3 rounded-xl bg-gold text-maroon-deep font-extrabold text-sm hover:bg-gold-light transition-all shadow-md flex items-center gap-2 border border-maroon/20 disabled:opacity-50 cursor-pointer"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Submitting Registration...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Submit Registration</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </form>
          </div>
        )}
      </div>
    </MaintenanceNotice>
  );
}

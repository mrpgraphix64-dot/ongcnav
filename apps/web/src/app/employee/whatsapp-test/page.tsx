'use client';

import React, { useState, useEffect } from 'react';
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
  ChevronLeft,
  ClipboardCheck,
  Ticket,
  ShieldCheck,
  ArrowRight,
  FileText,
  Lock,
  Send,
  MessageSquare,
  Sparkles,
  ExternalLink,
  Copy,
  Check,
  FlaskConical,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import MaintenanceNotice from '@/components/MaintenanceNotice';
import ScratchCardsSection from '@/components/scratch-cards/ScratchCardsSection';
import {
  getEventDayTheme,
  ALLOWED_FAMILY_RELATIONS,
  AllowedFamilyRelation,
  WhatsAppConfigDto,
  WhatsAppTestSubmissionResultDto,
} from '@ongc/shared-types';

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
const CPF_REGEX = /^[0-9]{5,6}$/;

const REGISTRATION_GUIDELINES = [
  {
    number: 1,
    title: 'ONE PERMANENT E-PASS PER PERSON',
    text: 'One unique, permanent QR/E-Pass is issued to each registered employee and family member for the entire ONGC Navratri 2026 festival.',
  },
  {
    number: 2,
    title: 'STRICTLY PERSONAL & NON-TRANSFERABLE',
    text: 'Your QR code is strictly personal. Do not share, forward, screenshot, or transfer it. Entry will be denied if misused.',
  },
  {
    number: 3,
    title: 'DATE-SPECIFIC AUTHORIZATION',
    text: 'Your permanent QR is valid only on the specific event dates selected during registration. Selected dates cannot be changed at the gate.',
  },
  {
    number: 4,
    title: 'ONE ENTRY PER DAY',
    text: 'Each pass allows a maximum of one successful entry per person per selected event date.',
  },
  {
    number: 5,
    title: 'GATE & PHYSICAL ID VERIFICATION',
    text: 'Keep your digital QR pass ready on your phone. A physical photo ID (ONGC ID / Government ID) may be verified at the entry gate.',
  },
  {
    number: 6,
    title: 'ACCURATE INFORMATION',
    text: 'All participant information must be correct and complete. Passes with discrepancies are subject to review or cancellation.',
  },
];

interface CommonEmployeeData {
  cpf: string;
  name: string;
  mobile: string;
  email: string;
  dateOfBirth: string;
  dateOfJoining: string;
}

interface FamilyMemberForm {
  localId: string;
  name: string;
  relation: AllowedFamilyRelation;
  mobileNo: string;
  email: string;
  selectedDates: string[];
}

function createFamilyMember(): FamilyMemberForm {
  return {
    localId: `fm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: '',
    relation: 'Spouse',
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

function StepIndicator({ step }: { step: 1 | 2 | 3 | 4 | 5 }) {
  const steps = [
    { num: 1, label: 'Verification', icon: ShieldCheck },
    { num: 2, label: 'Guidelines', icon: FileText },
    { num: 3, label: 'Employee', icon: User },
    { num: 4, label: 'Family', icon: Users },
    { num: 5, label: 'Review', icon: ClipboardCheck },
  ];

  return (
    <div className="w-full pb-4 border-b border-stone-200">
      <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
        {steps.map((s) => {
          const active = step === s.num;
          const done = step > s.num;
          return (
            <div
              key={s.num}
              className={`flex items-center gap-1.5 sm:gap-2 p-1.5 sm:p-2 rounded-xl border transition-all ${
                active
                  ? 'bg-maroon text-white border-maroon shadow-sm'
                  : done
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-cream-light text-ink-soft border-stone-200'
              }`}
            >
              <div
                className={`w-5 h-5 sm:w-6 sm:h-6 rounded-lg flex items-center justify-center text-[10px] sm:text-xs font-bold shrink-0 ${
                  active
                    ? 'bg-white/20 text-white'
                    : done
                    ? 'bg-emerald-600 text-white'
                    : 'bg-stone-200 text-ink-soft'
                }`}
              >
                {done ? <CheckCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> : s.num}
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

export default function WhatsAppTestRegistrationPage() {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [stepError, setStepError] = useState('');
  const [testResult, setTestResult] = useState<WhatsAppTestSubmissionResultDto | null>(null);

  // WhatsApp Sending states
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  const [sendWhatsAppSuccess, setSendWhatsAppSuccess] = useState<string | null>(null);
  const [sendWhatsAppError, setSendWhatsAppError] = useState<string | null>(null);
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [copiedRef, setCopiedRef] = useState(false);

  // Configuration from public WhatsApp test config
  const [providerConfig, setProviderConfig] = useState<WhatsAppConfigDto | null>(null);

  useEffect(() => {
    fetchApi('/public/whatsapp-test/config')
      .then((data: any) => {
        if (data) {
          setProviderConfig(data);
        }
      })
      .catch(() => {});
  }, []);

  // STEP 1 STATE: Verification
  const [category, setCategory] = useState<EmployeeCategory | null>('REGULAR');
  const [enabledCategories, setEnabledCategories] = useState<{
    regular: boolean;
    retired: boolean;
    contract: boolean;
  }>({
    regular: true,
    retired: false,
    contract: false,
  });

  useEffect(() => {
    fetchApi('/public/employee-types')
      .then((res: any) => {
        const data = res?.data || res;
        if (data && typeof data === 'object') {
          setEnabledCategories({
            regular: Boolean(data.regular ?? true),
            retired: Boolean(data.retired ?? false),
            contract: Boolean(data.contract ?? false),
          });
        }
      })
      .catch(() => {
        setEnabledCategories({ regular: true, retired: false, contract: false });
      });
  }, []);

  const visibleCategories = EMPLOYEE_CATEGORIES.filter((c) => {
    if (c.value === 'REGULAR') return enabledCategories.regular;
    if (c.value === 'RETIRED') return enabledCategories.retired;
    if (c.value === 'CONTRACT') return enabledCategories.contract;
    return true;
  });

  useEffect(() => {
    if (visibleCategories.length > 0 && (!category || !visibleCategories.some((c) => c.value === category))) {
      setCategory(visibleCategories[0].value);
    }
  }, [enabledCategories, category, visibleCategories]);

  const [common, setCommon] = useState<CommonEmployeeData>({
    cpf: '',
    name: '',
    mobile: '',
    email: '',
    dateOfBirth: '',
    dateOfJoining: '',
  });

  // STEP 2 STATE: Guidelines Acknowledgement
  const [guidelinesAgreed, setGuidelinesAgreed] = useState(false);

  // STEP 3 STATE: Employee Attendance Dates
  const [employeeDates, setEmployeeDates] = useState<string[]>([]);

  // STEP 4 STATE: Family Members (Max 3)
  const [familyMembers, setFamilyMembers] = useState<FamilyMemberForm[]>([]);

  const todayStr = typeof window !== 'undefined' ? new Date().toISOString().split('T')[0] : '2026-10-03';

  const scrollTop = () => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  };

  // Quick preset test data helper for testing team
  const handleQuickFill = () => {
    setCategory('REGULAR');
    setCommon({
      cpf: '99999',
      name: 'Siddharth',
      mobile: '9876543210',
      email: 'siddharth@ongc.co.in',
      dateOfBirth: '1988-06-15',
      dateOfJoining: '2014-08-01',
    });
    setGuidelinesAgreed(true);
    setEmployeeDates([...EVENT_DATES]);
    setFamilyMembers([
      {
        localId: 'fm-1',
        name: 'Pooja Patel',
        relation: 'Spouse',
        mobileNo: '9876543211',
        email: 'pooja.patel@example.com',
        selectedDates: ['2026-10-11', '2026-10-12', '2026-10-13'],
      },
    ]);
    setStepError('');
    setErrorMessage('');
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

  const updateFamilyMemberRelation = (index: number, relation: AllowedFamilyRelation) => {
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
      const member = next[index];
      const selected = member.selectedDates.includes(date);
      member.selectedDates = selected
        ? member.selectedDates.filter((d) => d !== date)
        : [...member.selectedDates, date].sort();
      return next;
    });
  };

  const toggleAllFamilyDates = (index: number) => {
    setFamilyMembers((prev) => {
      const next = [...prev];
      const member = next[index];
      const allSelected = member.selectedDates.length === EVENT_DATES.length;
      member.selectedDates = allSelected ? [] : [...EVENT_DATES];
      return next;
    });
  };

  const validateStep1 = (): string | null => {
    if (!category) return 'Please select your employee category.';
    const cleanCpf = common.cpf.trim();
    if (!cleanCpf) return 'Please enter your CPF number.';
    if (!CPF_REGEX.test(cleanCpf)) return 'CPF number must be 5 or 6 numeric digits.';
    const cleanMobile = common.mobile.trim();
    if (!cleanMobile) return 'Please enter your registered mobile number.';
    if (!INDIAN_MOBILE_REGEX.test(cleanMobile)) {
      return 'Mobile number must be exactly 10 digits starting with 6, 7, 8, or 9.';
    }
    return null;
  };

  const validateStep2 = (): string | null => {
    if (!guidelinesAgreed) {
      return 'You must acknowledge and accept the registration guidelines to proceed.';
    }
    return null;
  };

  const validateStep3 = (): string | null => {
    if (!common.name.trim()) return 'Please enter the employee full name.';
    const email = common.email.trim();
    if (!email) return 'Email address is required because your digital QR pass will be sent here.';
    if (!EMAIL_REGEX.test(email)) return 'Please enter a valid email address.';

    if (!common.dateOfBirth) return 'Date of Birth is required.';
    const dob = new Date(common.dateOfBirth);
    if (isNaN(dob.getTime())) return 'Please enter a valid Date of Birth.';
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (dob > today) return 'Employee Date of Birth cannot be in the future.';
    if (dob.getFullYear() < 1920) return 'Employee Date of Birth must be after year 1920.';

    if (!common.dateOfJoining) return 'Date of Joining is required.';
    const doj = new Date(common.dateOfJoining);
    if (isNaN(doj.getTime())) return 'Please enter a valid Date of Joining.';
    if (doj > today) return 'Employee Date of Joining cannot be in the future.';
    if (doj <= dob) return 'Employee Date of Joining must be after Date of Birth.';

    if (employeeDates.length === 0) return 'Please select at least one attendance date for the employee.';
    return null;
  };

  const validateStep4 = (): string | null => {
    if (familyMembers.length > 3) {
      return 'Maximum 3 family members are permitted per primary employee.';
    }
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    for (let i = 0; i < familyMembers.length; i++) {
      const m = familyMembers[i];
      if (!m.name.trim()) return `Please enter the name for Family Member #${i + 1}.`;
      if (!m.relation || !ALLOWED_FAMILY_RELATIONS.includes(m.relation as any)) {
        return `Please select a valid relationship (Parents, Spouse, or Child) for Family Member #${i + 1}.`;
      }
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

      if (!m.selectedDates || m.selectedDates.length === 0) {
        return `Please select at least one attendance date for Family Member #${i + 1} (${m.name.trim()}). Each family member must have their own independent date selection.`;
      }
    }
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

      setVerifying(true);
      try {
        const verifyRes = await fetchApi('/public/whatsapp-test/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cpf: common.cpf.trim(),
            mobile: common.mobile.trim(),
          }),
        });

        if (verifyRes?.name && !common.name.trim()) {
          setCommon((prev) => ({ ...prev, name: verifyRes.name }));
        }

        setStep(2);
        scrollTop();
      } catch (err: any) {
        const msg =
          err.message ||
          'The CPF No. and Mobile No. do not match official records. In test mode, you can also use test CPF 99999.';
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

    if (step === 4) {
      const error = validateStep4();
      if (error) {
        setStepError(error);
        return;
      }
      setStep(5);
      scrollTop();
      return;
    }
  };

  const goBack = () => {
    setStepError('');
    setErrorMessage('');
    setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3 | 4 | 5) : s));
    scrollTop();
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const error = validateStep1() || validateStep2() || validateStep3() || validateStep4();
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
        mobile: cleanMobile,
        cpf: common.cpf.trim(),
        email: common.email.trim().toLowerCase(),
        category,
        dateOfBirth: common.dateOfBirth || undefined,
        dateOfJoining: common.dateOfJoining || undefined,
        guidelinesAccepted: true,
        bookingDays: employeeDates,
        familyMembers: familyMembers.map((m) => ({
          name: m.name.trim(),
          relation: m.relation.trim() || 'Family Member',
          mobileNo: m.mobileNo.trim() || undefined,
          email: m.email.trim().toLowerCase() || undefined,
          bookingDays: m.selectedDates,
        })),
      };

      const res: WhatsAppTestSubmissionResultDto = await fetchApi('/public/whatsapp-test/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      setTestResult(res);
      setSubmitted(true);
      scrollTop();
    } catch (err: any) {
      setErrorMessage(err.message || 'Validation failed. Please check the entered details.');
      scrollTop();
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendWhatsApp = async (templateOverride?: string) => {
    if (!testResult) return;
    setSendingWhatsApp(true);
    setSendWhatsAppSuccess(null);
    setSendWhatsAppError(null);

    try {
      const res = await fetchApi('/public/whatsapp-test/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referenceNumber: testResult.referenceNumber,
          templateOverride,
        }),
      });

      if (res.status === 'SENT' || res.status === 'SUCCESS' || res.success) {
        setSendWhatsAppSuccess(
          `WhatsApp message successfully dispatched to ${res.safeRecipient || testResult.safeRecipient || 'safe recipient'}! Provider Message ID: ${res.providerMessageId || 'N/A'}`
        );
      } else if (res.status === 'TEMPLATE_NOT_CONFIGURED') {
        setSendWhatsAppError(
          `Custom template '${res.templateName || 'ongc_navratri_test_pass'}' is currently pending Meta approval. Meta Cloud API cannot deliver arbitrary pass text through 'hello_world'. Preview mode is available below.`
        );
      } else if (res.status === 'TEST_RECIPIENT_NOT_CONFIGURED') {
        setSendWhatsAppError(
          'Safe test recipient is not configured in the server environment (WHATSAPP_TEST_RECIPIENT).'
        );
      } else if (res.status === 'PROVIDER_NOT_CONFIGURED') {
        setSendWhatsAppError(
          'WhatsApp Cloud API credentials are not configured in the server environment.'
        );
      } else {
        setSendWhatsAppError(res.error || 'Failed to dispatch WhatsApp message.');
      }
    } catch (err: any) {
      setSendWhatsAppError(err.message || 'Failed to dispatch WhatsApp message.');
    } finally {
      setSendingWhatsApp(false);
    }
  };

  const handleCopyMessage = () => {
    if (!testResult?.messageText) return;
    navigator.clipboard.writeText(testResult.messageText);
    setCopiedMessage(true);
    setTimeout(() => setCopiedMessage(false), 2500);
  };

  const handleCopyRef = () => {
    if (!testResult?.referenceNumber) return;
    navigator.clipboard.writeText(testResult.referenceNumber);
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2500);
  };

  return (
    <MaintenanceNotice pageType="registration">
      <div className="w-full max-w-3xl mx-auto py-8 px-4 sm:px-6">
        {/* FLOW HERO HEADER */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold uppercase tracking-wider mb-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span>TEST MODE</span>
          </div>
          <h1 className="font-cinzel font-extrabold text-2xl sm:text-3xl text-maroon uppercase tracking-wide">
            ONGC NAVRATRI 2026
          </h1>
          <p className="text-amber-800 font-extrabold text-sm sm:text-base uppercase tracking-wider mt-1">
            WHATSAPP TEST REGISTRATION
          </p>
          <p className="text-stone-600 text-xs sm:text-sm mt-1 max-w-lg mx-auto">
            This is a test registration. Your test pass and WhatsApp message are isolated from production employee records.
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
                Processing Test Pass
              </div>
              <h2 className="font-outfit font-extrabold text-2xl sm:text-3xl text-ink">
                Generating Test Registration...
              </h2>
              <div className="w-16 h-1 bg-gold mx-auto rounded-full" />
            </div>

            <p className="text-ink-soft text-sm sm:text-base leading-relaxed max-w-lg mx-auto">
              Please wait while your isolated test pass is generated and the dynamic WhatsApp message is constructed.
            </p>
          </div>
        ) : submitted && testResult ? (
          <div className="space-y-8">
            {/* SUCCESS STATE CARD — TEST REGISTRATION SUCCESSFUL */}
            <div className="bg-white rounded-3xl p-6 sm:p-10 border-2 border-emerald-500/40 shadow-xl text-center space-y-6">
              <div className="w-20 h-20 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center shadow-inner border border-emerald-200">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div className="space-y-2">
                <div className="inline-block px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold uppercase tracking-wider">
                  TEST REGISTRATION SUCCESSFUL
                </div>
                <h2 className="font-outfit font-extrabold text-2xl sm:text-3xl text-ink">
                  Test Pass Generated (Isolated)
                </h2>
                <div className="w-16 h-1 bg-emerald-500 mx-auto rounded-full" />
              </div>

              {/* Official Pass Reference Number Banner */}
              <div className="bg-gradient-to-r from-maroon/10 via-gold/15 to-maroon/10 border-2 border-gold/60 rounded-2xl p-5 max-w-lg mx-auto shadow-sm">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-maroon-dark block">
                  Test Pass Reference Number
                </span>
                <div className="flex items-center justify-center gap-2 mt-1">
                  <span className="font-mono text-2xl sm:text-3xl font-black text-maroon tracking-wider">
                    {testResult.referenceNumber}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyRef}
                    className="p-1.5 rounded-lg bg-white/80 hover:bg-white text-maroon border border-maroon/20 transition cursor-pointer"
                    title="Copy Reference Number"
                  >
                    {copiedRef ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-stone-600 mt-1">
                  Isolated test credential. Production employee records remain completely untouched.
                </p>
              </div>

              {/* 3-Column Info Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left max-w-xl mx-auto">
                <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 space-y-1">
                  <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wide block">
                    Employee Name
                  </span>
                  <span className="font-bold text-ink text-sm block truncate">
                    {common.name}
                  </span>
                  <span className="text-[11px] font-mono text-stone-600 block">
                    CPF: {common.cpf}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wide block">
                    Safe WhatsApp Target
                  </span>
                  <span className="font-bold text-emerald-950 text-sm block font-mono">
                    {testResult.safeRecipient || providerConfig?.safeRecipient || 'Not Configured'}
                  </span>
                  <span className="text-[10px] text-emerald-800 block">
                    Guarded (Super Admin only)
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 space-y-1">
                  <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wide block">
                    Permanent E-Pass
                  </span>
                  <Link
                    href={`/employee/my-tickets?ref=${encodeURIComponent(testResult.referenceNumber)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:text-blue-900 underline mt-0.5"
                  >
                    <span>Open Pass Link</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                  <span className="text-[10px] text-blue-700 block">
                    Permanent QR verified
                  </span>
                </div>
              </div>

              {/* WHATSAPP TEST SECTION */}
              <div className="bg-cream-light border-2 border-stone-300 rounded-3xl p-5 sm:p-7 text-left space-y-5 max-w-xl mx-auto shadow-inner">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-stone-200">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-emerald-700" />
                    <div>
                      <h3 className="font-outfit font-extrabold text-base text-ink">
                        WhatsApp Test Dispatch
                      </h3>
                      <p className="text-[11px] text-stone-500">
                        Meta Cloud API Test Integration
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 w-fit">
                    <span className="w-2 h-2 rounded-full bg-emerald-600" />
                    <span>{testResult.providerName || 'Meta WhatsApp Cloud API'}</span>
                  </span>
                </div>

                {/* Safe Recipient Strict Enforcement Notice */}
                <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-950 flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <strong>Safe Recipient Enforcement:</strong>
                    <p className="text-[11px] text-blue-900">
                      The entered employee mobile ({common.mobile}) is <strong>never</strong> messaged. All test dispatches are routed strictly to the configured safe test recipient ({testResult.safeRecipient || providerConfig?.safeRecipient || 'WHATSAPP_TEST_RECIPIENT'}).
                    </p>
                  </div>
                </div>

                {/* Template State Guidance */}
                {testResult.passTemplateConfigured ? (
                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <strong>Custom Template Active:</strong> Template <code className="font-mono bg-emerald-100 px-1 py-0.5 rounded">{testResult.passTemplateName || 'ongc_navratri_test_pass'}</code> is configured and ready for pass dispatch.
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 flex items-start gap-2">
                    <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div>
                        <strong>Meta Template Pending:</strong> Dedicated custom template <code className="font-mono bg-amber-100 px-1 py-0.5 rounded text-[11px]">{testResult.passTemplateName || 'ongc_navratri_test_pass'}</code> requires active approval in Meta WhatsApp Business Account for dynamic pass parameter delivery ({'{{1}}'}=name, {'{{2}}'}=ref, {'{{3}}'}=url).
                      </div>
                      <p className="text-[11px] text-amber-800">
                        While approval is pending, the exact WhatsApp pass copy is rendered in the preview bubble below. You can also test basic Meta connectivity using the <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">hello_world</code> ping.
                      </p>
                    </div>
                  </div>
                )}

                {/* Feedback Alerts */}
                {sendWhatsAppSuccess && (
                  <div className="p-3.5 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-semibold flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                    <div className="flex-1">{sendWhatsAppSuccess}</div>
                  </div>
                )}

                {sendWhatsAppError && (
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div className="flex-1">{sendWhatsAppError}</div>
                  </div>
                )}

                {/* High-Fidelity WhatsApp Chat Bubble Container */}
                <div className="bg-[#EFEAE2] p-4 sm:p-5 rounded-2xl border border-stone-300 shadow-inner relative">
                  <div className="text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-2 text-center">
                    Simulated WhatsApp Message Preview
                  </div>
                  {/* WhatsApp Message Bubble */}
                  <div className="bg-white rounded-2xl rounded-tl-sm p-4 sm:p-5 shadow space-y-3.5 text-stone-900 text-xs sm:text-[13px] leading-relaxed relative">
                    <div className="text-center font-black text-stone-900 text-sm tracking-wide">
                      🎉 *ONGC NAVRATRI 2026* 🎉
                    </div>

                    <div>
                      Hello <strong>*{common.name}*</strong> 👋
                    </div>

                    <div>
                      Your ONGC Navratri E-Pass has been generated successfully as a TEST PASS. 🪔✨
                    </div>

                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 font-mono font-bold text-amber-950 text-center">
                      🎟️ *Reference No.: {testResult.referenceNumber}*
                    </div>

                    <div className="text-stone-700 text-xs">
                      Your permanent QR pass is your entry credential for the event.
                      <br />
                      Please keep your QR safe and do not share it.
                    </div>

                    {testResult.sponsorVoucher && (
                      <div className="border-t border-b border-dashed border-stone-300 py-3 space-y-2 text-stone-800 bg-stone-50/60 p-3 rounded-xl">
                        <div className="text-center font-black tracking-wide text-xs text-amber-900">
                          💎 *A SPECIAL GIFT FOR YOU* 💎
                        </div>
                        <div className="font-extrabold text-stone-900 text-center text-sm">
                          *{testResult.sponsorVoucher.sponsorName || 'MAHAVIR JEWELLERS'}*
                        </div>
                        <div className="text-center">
                          <span className="font-black text-base text-rose-700">
                            ✨ *{testResult.sponsorVoucher.offerHeadline || '₹5,000 OFF'}*
                          </span>
                          <br />
                          <span className="font-bold text-xs uppercase tracking-wider text-stone-800">
                            *{testResult.sponsorVoucher.offerSubtext || 'ON MAKING CHARGES'}*
                          </span>
                        </div>
                        <div className="text-[11px] text-center text-stone-600 font-medium">
                          {testResult.sponsorVoucher.validityNote || 'Valid: Lifetime | No expiry'}
                        </div>
                        <div className="text-[10px] text-stone-600 pt-1 space-y-0.5 border-t border-stone-200">
                          <div>📍 {testResult.sponsorVoucher.address || '2 Amrakunj, Anne, below NY Cinemas, Tapovan Circle, Chandkheda'}</div>
                          <div>📞 {testResult.sponsorVoucher.phone || '90330 56098'}</div>
                        </div>
                      </div>
                    )}

                    <div className="space-y-1">
                      <div className="font-bold text-stone-900 text-xs">
                        🎟️ *VIEW YOUR E-PASS*
                      </div>
                      <div className="text-blue-700 underline font-mono text-[11px] break-all">
                        {testResult.passUrl}
                      </div>
                    </div>

                    <div className="p-2 rounded-lg bg-amber-100/70 text-amber-900 text-[11px] font-semibold">
                      ⚠️ This is a test registration. The generated pass is isolated from production employee records.
                    </div>

                    <div className="text-center font-extrabold text-xs text-stone-800 pt-1">
                      ✨ See you at ONGC Navratri 2026! ✨
                    </div>
                  </div>
                </div>

                {/* Dispatch Controls */}
                <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  {testResult.passTemplateConfigured ? (
                    <button
                      type="button"
                      onClick={() => handleSendWhatsApp()}
                      disabled={sendingWhatsApp}
                      className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider transition shadow flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {sendingWhatsApp ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Dispatching...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          <span>Send Test Pass WhatsApp</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSendWhatsApp('hello_world')}
                      disabled={sendingWhatsApp}
                      className="flex-1 py-3 px-4 rounded-xl bg-stone-800 hover:bg-stone-900 text-white font-bold text-xs uppercase tracking-wider transition shadow flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {sendingWhatsApp ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Pinging Meta...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          <span>Ping Meta (hello_world)</span>
                        </>
                      )}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleCopyMessage}
                    className="py-3 px-4 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs transition border border-stone-300 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {copiedMessage ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copy Message</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  href={`/employee/my-tickets?ref=${encodeURIComponent(testResult.referenceNumber)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-maroon text-white font-bold text-sm hover:bg-maroon-dark transition-all shadow-md inline-flex items-center justify-center gap-2 border border-gold/40 cursor-pointer"
                >
                  <Ticket className="w-4 h-4 text-gold-light" />
                  <span>View Test E-Pass</span>
                  <ExternalLink className="w-4 h-4" />
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setSubmitted(false);
                    setTestResult(null);
                    setStep(1);
                    scrollTop();
                  }}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-sm transition border border-stone-300 cursor-pointer"
                >
                  Register Another Test Pass
                </button>
              </div>
            </div>

            {/* AESTHETIC 3-CARD SCRATCH & REVEAL SECTION */}
            <ScratchCardsSection referenceNumber={testResult.referenceNumber} />
          </div>
        ) : (
          /* STEPPED WIZARD CARD */
          <div className="bg-white rounded-3xl p-6 sm:p-10 border border-gold/40 shadow-xl space-y-6">
            {/* Quick Preset helper for testing team */}
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <span className="text-[11px] font-bold text-amber-900 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full flex items-center gap-1.5">
                <FlaskConical className="w-3.5 h-3.5 text-amber-700" />
                <span>Test Mode Sandbox</span>
              </span>
              <button
                type="button"
                onClick={handleQuickFill}
                className="text-xs font-bold text-amber-800 hover:text-amber-950 underline cursor-pointer"
              >
                Quick Fill Test Data (CPF: 99999)
              </button>
            </div>

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
              {/* ============================== STEP 1 — CPF + MOBILE MASTER VERIFICATION ============================== */}
              {step === 1 && (
                <div className="space-y-6">
                  {/* Category Selection */}
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
                      {visibleCategories.map((cat) => {
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
                      {/* Master Verification Notice */}
                      <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2.5">
                        <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                        <p className="leading-relaxed">
                          <strong>Test Verification:</strong> Enter your 5-digit CPF No. and 10-digit registered mobile number to verify against records. For test-only submissions, test CPF <code className="font-mono font-bold bg-blue-100 px-1 py-0.5 rounded">99999</code> is also supported.
                        </p>
                      </div>

                      {/* CPF Field — STRICTLY 5 DIGITS */}
                      <div>
                        <label htmlFor="emp-cpf" className="block text-xs font-bold text-ink mb-1.5">
                          CPF No. (5 or 6 Digits) <span className="text-rose-600">*</span>
                          <span className="ml-2 text-[10px] font-bold text-maroon-dark bg-maroon-soft px-2 py-0.5 rounded-full uppercase tracking-wide">
                            Numeric
                          </span>
                        </label>
                        <input
                          id="emp-cpf"
                          type="text"
                          maxLength={6}
                          minLength={5}
                          value={common.cpf}
                          onChange={(e) =>
                            setCommon((prev) => ({
                              ...prev,
                              cpf: e.target.value.replace(/[^0-9]/g, '').slice(0, 6),
                            }))
                          }
                          required
                          inputMode="numeric"
                          placeholder="e.g. 99999"
                          className="w-full px-4 py-3.5 rounded-xl bg-cream-light border-2 border-maroon/25 text-ink text-lg font-mono font-bold tracking-widest focus:outline-none focus:border-maroon"
                        />
                        <p className="text-[11px] text-stone-500 mt-1">
                          Enter your ONGC CPF number or test CPF 99999.
                        </p>
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
                          Enter 10-digit mobile number. In test mode, this number will NOT receive WhatsApp messages (safe recipient only).
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ============================== STEP 2 — PRE-FORM REGISTRATION GUIDELINES ============================== */}
              {step === 2 && (
                <div className="space-y-6">
                  <div className="pb-3 border-b border-stone-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-maroon" />
                      <div>
                        <h2 className="font-outfit font-extrabold text-base text-ink uppercase tracking-wide">
                          ONGC NAVRATRI 2026 REGISTRATION GUIDELINES
                        </h2>
                        <p className="text-[11px] text-ink-soft">
                          Official Code of Conduct &amp; Pass Issuance Terms
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-blue-800 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full">
                      Verified CPF: {common.cpf}
                    </span>
                  </div>

                  <p className="text-xs text-ink-soft leading-relaxed">
                    Please read the following guidelines carefully before proceeding with your registration.
                  </p>

                  {/* Scrollable / Card rules container */}
                  <div className="max-h-[360px] overflow-y-auto space-y-3 pr-2 rounded-2xl bg-cream-light/60 p-4 border border-stone-200">
                    {REGISTRATION_GUIDELINES.map((rule) => (
                      <div
                        key={rule.number}
                        className="p-3.5 rounded-xl bg-white border border-stone-200/80 shadow-2xs space-y-1"
                      >
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-maroon-soft text-maroon font-bold text-[10px] uppercase tracking-wider">
                            RULE {rule.number}
                          </span>
                          <span className="font-outfit font-extrabold text-xs text-ink">
                            {rule.title}
                          </span>
                        </div>
                        <p className="text-xs text-stone-700 leading-relaxed pl-0.5">
                          {rule.text}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Final Acknowledgement Banner */}
                  <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-xs text-amber-950 space-y-2">
                    <div className="font-bold uppercase tracking-wider text-[11px] text-amber-900 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-amber-700" />
                      <span>Final Acknowledgement</span>
                    </div>
                    <p className="leading-relaxed italic">
                      &ldquo;I confirm that the information provided is correct and I agree to the entry and E-Pass rules above.&rdquo;
                    </p>
                  </div>

                  {/* Mandatory Checkbox */}
                  <div className="p-4 rounded-2xl bg-stone-50 border-2 border-maroon/20 hover:border-maroon/40 transition-colors">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={guidelinesAgreed}
                        onChange={(e) => {
                          setGuidelinesAgreed(e.target.checked);
                          if (e.target.checked) setStepError('');
                        }}
                        className="w-5 h-5 rounded text-maroon accent-maroon border-stone-300 focus:ring-maroon mt-0.5 cursor-pointer shrink-0"
                      />
                      <span className="text-xs font-bold text-ink leading-snug">
                        I confirm that the information provided is correct and I agree to the entry and E-Pass rules above. <span className="text-rose-600">*</span>
                      </span>
                    </label>
                  </div>
                </div>
              )}

              {/* ============================== STEP 3 — EMPLOYEE DETAILS & DATES ============================== */}
              {step === 3 && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                    <div className="flex items-center gap-2">
                      <User className="w-5 h-5 text-maroon" />
                      <h2 className="font-outfit font-extrabold text-base text-ink">
                        Employee Information &amp; Dates
                      </h2>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                        CPF: {common.cpf} (Test Verified)
                      </span>
                    </div>
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
                      className="w-full px-4 py-3 rounded-xl bg-cream-light border border-stone-300 text-ink text-sm focus:outline-none focus:border-maroon"
                    />
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
                      className="w-full px-4 py-3 rounded-xl bg-cream-light border border-stone-300 text-ink text-sm focus:outline-none focus:border-maroon"
                    />
                    <p className="text-[11px] text-stone-500 mt-1">
                      Your test digital QR pass reference will be linked to this email address.
                    </p>
                  </div>

                  {/* Date of Birth & Date of Joining Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="emp-dob" className="block text-xs font-bold text-ink mb-1.5">
                        Date of Birth <span className="text-rose-600">*</span>
                      </label>
                      <input
                        id="emp-dob"
                        type="date"
                        max={todayStr}
                        min="1920-01-01"
                        value={common.dateOfBirth}
                        onChange={(e) => setCommon((prev) => ({ ...prev, dateOfBirth: e.target.value }))}
                        required
                        className="w-full px-4 py-3 rounded-xl bg-cream-light border border-stone-300 text-ink text-sm focus:outline-none focus:border-maroon"
                      />
                      <p className="text-[11px] text-stone-500 mt-1">
                        Format: DD / MM / YYYY (Cannot be in the future).
                      </p>
                    </div>

                    <div>
                      <label htmlFor="emp-doj" className="block text-xs font-bold text-ink mb-1.5">
                        Date of Joining <span className="text-rose-600">*</span>
                      </label>
                      <input
                        id="emp-doj"
                        type="date"
                        max={todayStr}
                        min={common.dateOfBirth || '1950-01-01'}
                        value={common.dateOfJoining}
                        onChange={(e) => setCommon((prev) => ({ ...prev, dateOfJoining: e.target.value }))}
                        required
                        className="w-full px-4 py-3 rounded-xl bg-cream-light border border-stone-300 text-ink text-sm focus:outline-none focus:border-maroon"
                      />
                      <p className="text-[11px] text-stone-500 mt-1">
                        Must not be before your Date of Birth or in the future.
                      </p>
                    </div>
                  </div>

                  {/* Employee Attendance Dates with QR clarification */}
                  <div className="pt-2 space-y-3">
                    <div className="p-3.5 bg-amber-50/90 border border-amber-200 rounded-xl text-xs text-amber-950 flex items-start gap-2.5">
                      <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                      <p className="leading-relaxed">
                        <strong>QR Rule:</strong> One permanent QR code will be issued for all your selected event dates. Each QR permits one successful entry per selected event day.
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-cream-light border border-stone-200/80 space-y-3">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-maroon" />
                        <span className="font-outfit font-bold text-sm text-ink">
                          Select Employee Attendance Dates <span className="text-rose-600">*</span>
                        </span>
                      </div>
                      <DateChipGrid
                        selectedDates={employeeDates}
                        onToggle={toggleEmployeeDate}
                        onToggleAll={toggleAllEmployeeDates}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ============================== STEP 4 — FAMILY MEMBERS (MAX 3) ============================== */}
              {step === 4 && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-maroon" />
                      <div>
                        <h2 className="font-outfit font-extrabold text-base text-ink">
                          Family Details ({familyMembers.length}/3)
                        </h2>
                        <p className="text-[11px] text-ink-soft">
                          Register up to 3 eligible family members.
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

                  {/* Family Guidance Box */}
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50/50 border border-blue-200 text-xs text-blue-950 space-y-2">
                    <div className="font-outfit font-extrabold text-sm text-blue-900 flex items-center gap-1.5">
                      <Info className="w-4 h-4 text-blue-700" />
                      <span>FAMILY DETAILS</span>
                    </div>
                    <p className="leading-relaxed">
                      Please enter each family member&apos;s details carefully. The information provided will be reviewed and verified by the event team.
                    </p>
                    <div className="text-[11px] space-y-1 text-blue-900/90 pt-1 font-medium">
                      <p className="font-bold text-blue-950">Important:</p>
                      <p>&bull; Enter the full name correctly.</p>
                      <p>&bull; Enter the correct mobile number.</p>
                      <p>&bull; Enter a valid email address because the family member&apos;s digital QR pass will be sent to their registered email address.</p>
                      <p>&bull; Select event dates separately for each family member.</p>
                      <p>&bull; A family member will only be authorized to enter on the dates selected for that individual.</p>
                    </div>
                  </div>

                  {familyMembers.length === 0 ? (
                    <div className="p-8 text-center bg-cream-light rounded-2xl border border-stone-200 space-y-3">
                      <Users className="w-10 h-10 text-maroon/40 mx-auto" />
                      <p className="text-sm font-bold text-ink">No family members added</p>
                      <p className="text-xs text-ink-soft max-w-sm mx-auto">
                        If you are attending alone, you can proceed directly to the Review screen. If family members are accompanying you, add up to 3 members below.
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
                              <select
                                id={`fam-relation-${idx}`}
                                value={fam.relation}
                                onChange={(e) => updateFamilyMemberRelation(idx, e.target.value as AllowedFamilyRelation)}
                                required
                                className="w-full px-3.5 py-2.5 rounded-lg bg-white border border-stone-300 text-ink text-sm focus:outline-none focus:border-maroon cursor-pointer"
                              >
                                {ALLOWED_FAMILY_RELATIONS.map((rel) => (
                                  <option key={rel} value={rel}>
                                    {rel}
                                  </option>
                                ))}
                              </select>
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
                                Email Address <span className="text-rose-600">*</span>
                              </label>
                              <input
                                id={`fam-email-${idx}`}
                                type="email"
                                value={fam.email}
                                onChange={(e) => updateFamilyMemberEmail(idx, e.target.value)}
                                required
                                inputMode="email"
                                placeholder="e.g. meena@example.com"
                                className="w-full px-3.5 py-2.5 rounded-lg bg-white border border-stone-300 text-ink text-sm focus:outline-none focus:border-maroon"
                              />
                            </div>
                          </div>

                          {/* Independent Date Selection for Family Member */}
                          <div className="pt-2 border-t border-stone-200/60 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-ink">
                                Attendance Dates for {fam.name.trim() || `Member #${idx + 1}`} <span className="text-rose-600">*</span>
                              </span>
                              <span className="text-[10px] text-stone-500 italic">
                                Independent selection
                              </span>
                            </div>
                            <DateChipGrid
                              selectedDates={fam.selectedDates}
                              onToggle={(d) => toggleFamilyDate(idx, d)}
                              onToggleAll={() => toggleAllFamilyDates(idx)}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ============================== STEP 5 — REVIEW STEP ============================== */}
              {step === 5 && (
                <div className="space-y-6">
                  <div className="pb-3 border-b border-stone-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ClipboardCheck className="w-5 h-5 text-maroon" />
                      <h2 className="font-outfit font-extrabold text-base text-ink">
                        Review Test Registration Details
                      </h2>
                    </div>
                    <span className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                      Step 5 of 5
                    </span>
                  </div>

                  {/* Employee Details Card */}
                  <div className="p-5 rounded-2xl bg-cream-light border border-stone-200/80 space-y-3">
                    <div className="flex items-center justify-between border-b border-stone-200/60 pb-2">
                      <span className="font-outfit font-extrabold text-xs uppercase tracking-wider text-maroon">
                        PRIMARY EMPLOYEE DETAILS
                      </span>
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        Test Mode Verified
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-stone-500 font-semibold block">Full Name:</span>
                        <span className="font-bold text-ink text-sm">{common.name}</span>
                      </div>
                      <div>
                        <span className="text-stone-500 font-semibold block">CPF Number:</span>
                        <span className="font-mono font-bold text-maroon text-sm">{common.cpf}</span>
                      </div>
                      <div>
                        <span className="text-stone-500 font-semibold block">Mobile Number:</span>
                        <span className="font-bold text-ink">{common.mobile}</span>
                      </div>
                      <div>
                        <span className="text-stone-500 font-semibold block">Email Address:</span>
                        <span className="font-bold text-ink">{common.email}</span>
                      </div>
                      <div>
                        <span className="text-stone-500 font-semibold block">Date of Birth:</span>
                        <span className="font-bold text-ink">{common.dateOfBirth}</span>
                      </div>
                      <div>
                        <span className="text-stone-500 font-semibold block">Date of Joining:</span>
                        <span className="font-bold text-ink">{common.dateOfJoining}</span>
                      </div>
                      <div className="sm:col-span-2">
                        <span className="text-stone-500 font-semibold block">Employee Category:</span>
                        <span className="font-bold text-maroon-dark bg-maroon-soft px-2.5 py-0.5 rounded-full inline-block mt-0.5">
                          {EMPLOYEE_CATEGORIES.find((c) => c.value === category)?.label}
                        </span>
                      </div>
                      <div className="sm:col-span-2 pt-1 border-t border-stone-200/60">
                        <span className="text-stone-500 font-semibold block mb-1">
                          Employee Selected Attendance Dates ({employeeDates.length}):
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {employeeDates.map((d) => (
                            <span key={d} className="px-2 py-0.5 rounded-md bg-white border border-stone-200 text-xs font-mono font-bold text-ink">
                              {formatDateShort(d)}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Family Members Review Card */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-outfit font-extrabold text-xs uppercase tracking-wider text-maroon">
                        FAMILY MEMBERS ({familyMembers.length}/3)
                      </span>
                    </div>

                    {familyMembers.length === 0 ? (
                      <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 text-xs text-ink-soft text-center">
                        No family members registered. Attending as a single attendee.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {familyMembers.map((fam, idx) => (
                          <div
                            key={fam.localId}
                            className="p-4 rounded-xl bg-cream-light border border-stone-200 space-y-2 text-xs"
                          >
                            <div className="flex items-center justify-between font-bold text-ink">
                              <span className="text-sm">{fam.name} ({fam.relation})</span>
                              <span className="text-[11px] text-maroon font-semibold">Member #{idx + 1}</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-stone-600">
                              <div>Mobile: <strong className="text-ink">{fam.mobileNo}</strong></div>
                              <div>Email: <strong className="text-ink">{fam.email}</strong></div>
                            </div>
                            <div className="pt-1 border-t border-stone-200/60">
                              <span className="text-stone-500 font-semibold block mb-1">
                                Dates ({fam.selectedDates.length}):
                              </span>
                              <div className="flex flex-wrap gap-1">
                                {fam.selectedDates.map((d) => (
                                  <span key={d} className="px-1.5 py-0.5 rounded bg-white border border-stone-200 text-[11px] font-mono">
                                    {formatDateShort(d)}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Review Notice */}
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
                    <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      <strong>Test Mode:</strong> Submitting will generate an isolated test pass with reference <span className="font-mono font-bold">ONGC-TEST-{common.cpf || 'xxxxx'}</span> and prepare the WhatsApp preview.
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
                    <ChevronLeft className="w-4 h-4" />
                    <span>{step === 5 ? 'Back to Edit' : 'Back'}</span>
                  </button>
                ) : (
                  <div />
                )}

                {step < 5 ? (
                  <button
                    type="button"
                    onClick={goNext}
                    disabled={verifying || submitting || (step === 2 && !guidelinesAgreed)}
                    className="px-6 py-2.5 rounded-xl bg-maroon text-white font-bold text-xs hover:bg-maroon-dark transition-all flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {verifying ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Verifying Records...</span>
                      </>
                    ) : (
                      <>
                        <span>{step === 1 ? 'Verify & Proceed' : 'Next Step'}</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-8 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-all flex items-center gap-2 shadow-lg cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Generating Test Pass...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Submit Test Registration</span>
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

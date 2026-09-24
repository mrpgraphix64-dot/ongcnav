'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import {
  Info,
  CheckCircle2,
  CheckCircle,
  PlusCircle,
  AlertCircle,
  User,
  Users,
  Upload,
  Camera,
  RefreshCw,
  Trash2,
  Plus,
  Loader2,
  Home,
  IdCard,
  Calendar,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ShieldAlert,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';

// ----------------------------------------------------------------------------
// Event dates for ONGC Navratri 2026. Submitted through the existing
// `bookingDays: string[]` field on the registration API — no contract change.
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
  { value: 'REGULAR', label: 'Regular Employee' },
  { value: 'RETIRED', label: 'Retired Employee' },
  { value: 'CONTRACT', label: 'Contract Employee' },
] as const;

type EmployeeCategory = (typeof EMPLOYEE_CATEGORIES)[number]['value'];

const INDIAN_MOBILE_REGEX = /^[6-9][0-9]{9}$/;
const VALID_PHOTO_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

function validatePhotoFile(file: File): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (!ext || !VALID_PHOTO_EXTENSIONS.includes(ext)) {
    return 'Please upload a JPG, PNG or WEBP image up to 5 MB.';
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return 'Please upload a JPG, PNG or WEBP image up to 5 MB.';
  }
  return null;
}

interface PhotoState {
  file: File | null;
  previewUrl: string | null;
  fileName: string;
  fileSize: string;
  error: string;
}

const EMPTY_PHOTO: PhotoState = {
  file: null,
  previewUrl: null,
  fileName: '',
  fileSize: '',
  error: '',
};

interface FamilyMemberForm {
  localId: string;
  name: string;
  mobileNo: string;
  photo: PhotoState;
  selectedDates: string[];
}

function createFamilyMember(): FamilyMemberForm {
  return {
    localId: `fm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: '',
    mobileNo: '',
    photo: { ...EMPTY_PHOTO },
    selectedDates: [],
  };
}

// ----------------------------------------------------------------------------
// Reusable photo upload control — used for the employee and for each family
// member. Purely presentational; the caller owns the PhotoState.
// ----------------------------------------------------------------------------
function PhotoUploadBox({
  label,
  helperText,
  photo,
  onSelect,
  onRemove,
  compact,
}: {
  label: string;
  helperText?: string;
  photo: PhotoState;
  onSelect: (file: File) => void;
  onRemove: () => void;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    onSelect(file);
    e.target.value = '';
  };

  return (
    <div>
      <label className="block text-xs font-bold text-ink mb-1">{label}</label>
      {helperText && <p className="text-[11px] text-ink-soft mb-2">{helperText}</p>}

      <input
        type="file"
        ref={inputRef}
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleChange}
      />

      {!photo.previewUrl ? (
        <div
          onClick={() => inputRef.current?.click()}
          className={`cursor-pointer border-2 border-dashed border-stone-300 hover:border-maroon/60 bg-cream-light hover:bg-cream/70 rounded-2xl text-center transition-all group shadow-2xs ${
            compact ? 'p-4' : 'p-6'
          }`}
        >
          <div
            className={`rounded-full bg-maroon-soft text-maroon mx-auto flex items-center justify-center mb-2 group-hover:scale-105 transition-transform border border-maroon/20 ${
              compact ? 'w-10 h-10' : 'w-12 h-12'
            }`}
          >
            <Camera className={compact ? 'w-5 h-5' : 'w-6 h-6'} />
          </div>
          <div className="font-outfit font-bold text-sm text-ink group-hover:text-maroon transition-colors">
            Upload Photo
          </div>
          <div className="text-xs text-ink-soft mt-1">JPG / PNG / WEBP &bull; Max 5 MB</div>
          <div className="mt-3">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white border border-stone-200 text-xs font-bold text-maroon shadow-xs group-hover:border-gold/60">
              <Upload className="w-3.5 h-3.5 text-gold-dark" /> Choose Photo
            </span>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-cream-light border border-gold/40 shadow-xs flex flex-col sm:flex-row items-center gap-4">
          <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border-2 border-gold/60 shadow-md bg-white shrink-0">
            <img src={photo.previewUrl} alt="Photo preview" className="w-full h-full object-cover" />
          </div>

          <div className="flex-1 text-center sm:text-left space-y-1 min-w-0">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
              <span>Photo uploaded</span>
            </div>
            <div className="text-xs font-semibold text-ink truncate max-w-xs">{photo.fileName}</div>
            <div className="text-[11px] text-ink-soft">{photo.fileSize}</div>

            <div className="flex items-center justify-center sm:justify-start gap-2 pt-2">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="px-3 py-1.5 rounded-lg bg-white border border-stone-300 text-ink hover:text-maroon text-xs font-bold transition-colors shadow-2xs inline-flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" /> Change
              </button>
              <button
                type="button"
                onClick={onRemove}
                className="px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 text-xs font-bold transition-colors shadow-2xs inline-flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" /> Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {photo.error && (
        <div className="mt-2 text-xs text-rose-600 font-semibold flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>{photo.error}</span>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Date chip grid — used for the employee and for each family member.
// Selection is always scoped to whichever `selectedDates`/`onToggle` the
// caller passes in, so every person's dates are independent state.
// ----------------------------------------------------------------------------
function DateChipGrid({ selectedDates, onToggle }: { selectedDates: string[]; onToggle: (date: string) => void }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
      {EVENT_DATES.map((iso) => {
        const { weekday, day, month } = formatDateChip(iso);
        const isSelected = selectedDates.includes(iso);
        return (
          <button
            key={iso}
            type="button"
            onClick={() => onToggle(iso)}
            aria-pressed={isSelected}
            className={`relative rounded-2xl border-2 py-3 px-2 text-center transition-all ${
              isSelected
                ? 'bg-maroon border-maroon text-white shadow-md scale-[1.02]'
                : 'bg-white border-stone-200 text-ink hover:border-gold/60 hover:bg-cream-light'
            }`}
          >
            {isSelected && (
              <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gold text-maroon-deep flex items-center justify-center shadow-sm border border-white">
                <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2.5} />
              </div>
            )}
            <div className={`text-[10px] font-bold uppercase tracking-wide ${isSelected ? 'text-gold-light' : 'text-ink-soft'}`}>
              {weekday}
            </div>
            <div className="text-xl font-outfit font-extrabold leading-tight">{day}</div>
            <div className={`text-[10px] font-bold uppercase tracking-wide ${isSelected ? 'text-white/80' : 'text-ink-soft'}`}>
              {month}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function StepIndicator({ step }: { step: 1 | 2 | 3 | 4 }) {
  const steps = [
    { n: 1, label: 'Employee' },
    { n: 2, label: 'Family' },
    { n: 3, label: 'Dates' },
    { n: 4, label: 'Review' },
  ];

  return (
    <div className="flex items-center justify-between mb-8 px-1">
      {steps.map((s, i) => (
        <React.Fragment key={s.n}>
          <div className="flex flex-col items-center gap-1.5 shrink-0">
            <div
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-outfit font-extrabold text-sm border-2 transition-colors ${
                step === s.n
                  ? 'bg-maroon border-maroon text-white shadow-md'
                  : step > s.n
                    ? 'bg-emerald-50 border-emerald-400 text-emerald-600'
                    : 'bg-white border-stone-300 text-ink-soft'
              }`}
            >
              {step > s.n ? <CheckCircle2 className="w-5 h-5" /> : s.n}
            </div>
            <span
              className={`text-[10px] sm:text-xs font-bold uppercase tracking-wide ${
                step === s.n ? 'text-maroon' : 'text-ink-soft'
              }`}
            >
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`flex-1 h-0.5 mx-1.5 sm:mx-2 rounded-full ${step > s.n ? 'bg-emerald-400' : 'bg-stone-200'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

export default function RegisterPage() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [stepError, setStepError] = useState('');

  // Employee identity
  const [cpfNo, setCpfNo] = useState('');
  const [name, setName] = useState('');
  const [mobileNo, setMobileNo] = useState('');
  const [category, setCategory] = useState<EmployeeCategory>('REGULAR');
  const [photo, setPhoto] = useState<PhotoState>({ ...EMPTY_PHOTO });

  // Attendance dates
  const [employeeDates, setEmployeeDates] = useState<string[]>([]);

  // Family members
  const [familyMembers, setFamilyMembers] = useState<FamilyMemberForm[]>([]);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [registeredToken, setRegisteredToken] = useState<string | null>(null);

  const scrollTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  // ---- Employee photo handlers ----
  const handleEmployeePhotoSelect = (file: File) => {
    const error = validatePhotoFile(file);
    if (error) {
      setPhoto({ ...EMPTY_PHOTO, error });
      return;
    }
    if (photo.previewUrl) URL.revokeObjectURL(photo.previewUrl);
    setPhoto({
      file,
      previewUrl: URL.createObjectURL(file),
      fileName: file.name,
      fileSize: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
      error: '',
    });
  };

  const removeEmployeePhoto = () => {
    if (photo.previewUrl) URL.revokeObjectURL(photo.previewUrl);
    setPhoto({ ...EMPTY_PHOTO });
  };

  const toggleEmployeeDate = (date: string) => {
    setEmployeeDates((prev) => (prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date]));
  };

  // ---- Family member handlers ----
  const addFamilyMember = () => {
    if (familyMembers.length >= 6) {
      setStepError('Maximum 6 family members allowed.');
      return;
    }
    setFamilyMembers((prev) => [...prev, createFamilyMember()]);
  };

  const removeFamilyMember = (localId: string) => {
    setFamilyMembers((prev) => {
      const target = prev.find((m) => m.localId === localId);
      if (target?.photo.previewUrl) URL.revokeObjectURL(target.photo.previewUrl);
      return prev.filter((m) => m.localId !== localId);
    });
  };

  const updateFamilyMemberField = (localId: string, field: 'name' | 'mobileNo', value: string) => {
    setFamilyMembers((prev) => prev.map((m) => (m.localId === localId ? { ...m, [field]: value } : m)));
  };

  const handleFamilyPhotoSelect = (localId: string, file: File) => {
    const error = validatePhotoFile(file);
    setFamilyMembers((prev) =>
      prev.map((m) => {
        if (m.localId !== localId) return m;
        if (error) return { ...m, photo: { ...EMPTY_PHOTO, error } };
        if (m.photo.previewUrl) URL.revokeObjectURL(m.photo.previewUrl);
        return {
          ...m,
          photo: {
            file,
            previewUrl: URL.createObjectURL(file),
            fileName: file.name,
            fileSize: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
            error: '',
          },
        };
      }),
    );
  };

  const removeFamilyPhoto = (localId: string) => {
    setFamilyMembers((prev) =>
      prev.map((m) => {
        if (m.localId !== localId) return m;
        if (m.photo.previewUrl) URL.revokeObjectURL(m.photo.previewUrl);
        return { ...m, photo: { ...EMPTY_PHOTO } };
      }),
    );
  };

  const toggleFamilyDate = (localId: string, date: string) => {
    setFamilyMembers((prev) =>
      prev.map((m) =>
        m.localId === localId
          ? {
              ...m,
              selectedDates: m.selectedDates.includes(date)
                ? m.selectedDates.filter((d) => d !== date)
                : [...m.selectedDates, date],
            }
          : m,
      ),
    );
  };

  // ---- Step validation ----
  const validateStep1 = (): string | null => {
    const cleanCpf = cpfNo.trim();
    if (!cleanCpf) return 'Please enter the CPF Number.';
    if (!/^[0-9]{4,10}$/.test(cleanCpf)) return 'CPF Number should be 4 to 10 digits, numbers only.';
    if (!name.trim()) return 'Please enter the employee’s full name.';
    if (!INDIAN_MOBILE_REGEX.test(mobileNo.trim())) {
      return 'Enter a valid 10-digit Indian mobile number starting with 6, 7, 8 or 9.';
    }
    return null;
  };

  const validateStep2 = (): string | null => {
    for (let i = 0; i < familyMembers.length; i++) {
      const fm = familyMembers[i];
      if (!fm.name.trim()) return `Please enter the name for Family Member ${i + 1}.`;
      if (fm.mobileNo.trim() && !INDIAN_MOBILE_REGEX.test(fm.mobileNo.trim())) {
        return `Family Member ${i + 1}'s mobile number must be a valid 10-digit Indian number, or left blank.`;
      }
    }
    return null;
  };

  const validateStep3 = (): string | null => {
    if (employeeDates.length === 0) {
      return 'Please select at least one attendance date for the employee.';
    }
    return null;
  };

  const goNext = () => {
    const validator = step === 1 ? validateStep1 : step === 2 ? validateStep2 : validateStep3;
    const error = validator();
    if (error) {
      setStepError(error);
      return;
    }
    setStepError('');
    setStep((s) => (s < 4 ? ((s + 1) as 1 | 2 | 3 | 4) : s));
    scrollTop();
  };

  const goBack = () => {
    setStepError('');
    setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3 | 4) : s));
    scrollTop();
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    // Defensive re-validation of every step before the real submit.
    const error = validateStep1() || validateStep2() || validateStep3();
    if (error) {
      setStepError(error);
      setErrorMessage(error);
      scrollTop();
      return;
    }

    setErrorMessage('');
    setSubmitting(true);

    try {
      const cleanMobile = mobileNo.trim();
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('phone', cleanMobile);
      formData.append('cpf', cpfNo.trim().toUpperCase());
      formData.append('email', `${cpfNo.trim().toLowerCase()}@ongc.co.in`);
      // designation reverts to its original, generic meaning — the
      // employee category now has its own dedicated field/column instead
      // of being stuffed in here.
      formData.append('designation', 'ONGC Employee');
      formData.append('department', 'EWC Ahmedabad');
      formData.append('employeeCategory', category);

      // The employee's OWN dates only — each family member sends their own
      // independently inside familyMembers[].bookingDays below.
      formData.append('bookingDays', JSON.stringify(employeeDates));

      const formattedFamily = familyMembers.map((m) => ({
        name: m.name.trim(),
        relation: 'Family Member',
        phone: m.mobileNo.trim() || cleanMobile,
        bookingDays: m.selectedDates,
      }));
      formData.append('familyMembers', JSON.stringify(formattedFamily));

      if (photo.file) {
        formData.append('photo', photo.file);
      }
      // Indexed so a missing photo for member N never shifts anyone else's.
      familyMembers.forEach((m, i) => {
        if (m.photo.file) {
          formData.append(`familyPhoto_${i}`, m.photo.file);
        }
      });

      const res = await fetchApi('/public/register', {
        method: 'POST',
        body: formData,
      });

      const qrToken = res.data?.attendee?.qrCodeToken;
      if (qrToken) {
        setRegisteredToken(qrToken);
      }
      setSubmitted(true);
      scrollTop();
    } catch (err: any) {
      setErrorMessage(err.message || 'Validation failed. Please check the entered details.');
      scrollTop();
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSubmitted(false);
    setErrorMessage('');
    setStepError('');
    setStep(1);
    removeEmployeePhoto();
    setName('');
    setMobileNo('');
    setCpfNo('');
    setCategory('REGULAR');
    setEmployeeDates([]);
    familyMembers.forEach((m) => {
      if (m.photo.previewUrl) URL.revokeObjectURL(m.photo.previewUrl);
    });
    setFamilyMembers([]);
    setRegisteredToken(null);
    scrollTop();
  };

  return (
    <div className="font-sans bg-cream text-ink antialiased min-h-screen py-6 px-4 sm:px-6 lg:px-8 flex flex-col justify-between selection:bg-maroon selection:text-white">
      {/* TOP HEADER / PROMINENT BRANDING */}
      <header className="max-w-2xl mx-auto w-full text-center mb-6 pt-2 sm:pt-4">
        <div className="flex justify-between items-center mb-4 max-w-2xl mx-auto">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-maroon hover:text-maroon-dark transition-colors"
          >
            <Home className="w-4 h-4" />
            <span>Home</span>
          </Link>
          <Link href="/my-tickets" className="text-xs font-bold text-maroon hover:underline">
            Already registered? Find Pass
          </Link>
        </div>

        <div className="inline-flex items-center gap-3 sm:gap-4 px-5 py-2.5 sm:px-7 sm:py-3 bg-white rounded-2xl border border-gold/45 shadow-md mb-4 hover:shadow-lg transition-shadow">
          <img src="/images/logo-web.png" alt="ONGC Logo" className="h-11 sm:h-14 w-auto object-contain shrink-0" />
          <div className="h-8 w-px bg-gold/50 mx-0.5" />
          <span className="font-cinzel font-extrabold text-maroon text-lg sm:text-2xl tracking-wider uppercase">
            ONGC AHMEDABAD
          </span>
        </div>

        <h1 className="font-cinzel font-extrabold text-3xl sm:text-5xl text-maroon tracking-tight drop-shadow-xs mt-1">
          EWC Ahmedabad
        </h1>
        <p className="font-outfit text-ink-soft text-base sm:text-lg mt-1.5 font-semibold tracking-wide">
          ONGC Employee &amp; Family Registration
        </p>
      </header>

      {/* MAIN REGISTRATION CONTAINER */}
      <main className="max-w-2xl mx-auto w-full my-auto">
        {submitted ? (
          /* SUCCESS STATE CARD */
          <div className="bg-white rounded-3xl p-8 sm:p-12 border-2 border-emerald-500/30 shadow-xl text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center shadow-inner border border-emerald-200">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <h2 className="font-outfit font-extrabold text-2xl sm:text-3xl text-ink">
                Registration Submitted Successfully
              </h2>
              <div className="w-16 h-1 bg-emerald-500 mx-auto rounded-full" />
            </div>

            <p className="text-ink-soft text-sm sm:text-base leading-relaxed max-w-md mx-auto">
              Thank you. Your EWC Ahmedabad employee and family details have been submitted successfully.
            </p>

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
              {registeredToken ? (
                <Link
                  href={`/ticket/${registeredToken}`}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gold text-maroon-deep font-bold text-sm hover:bg-gold-light transition-all shadow-md inline-flex items-center justify-center gap-2 border border-maroon/20"
                >
                  <span>View &amp; Download My Digital Pass</span>
                </Link>
              ) : (
                <Link
                  href={`/my-tickets?cpf=${cpfNo.trim().toUpperCase()}`}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gold text-maroon-deep font-bold text-sm hover:bg-gold-light transition-all shadow-md inline-flex items-center justify-center gap-2 border border-maroon/20"
                >
                  <span>View All My Passes</span>
                </Link>
              )}

              <button
                onClick={resetForm}
                type="button"
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-maroon text-white font-bold text-sm hover:bg-maroon-dark transition-all shadow-md inline-flex items-center justify-center gap-2 border border-gold/40"
              >
                <PlusCircle className="w-4 h-4 text-gold-light" />
                <span>Register Another Employee</span>
              </button>
            </div>
          </div>
        ) : (
          /* FORM CARD */
          <div className="bg-white rounded-3xl p-6 sm:p-10 border border-gold/40 shadow-xl space-y-6">
            <StepIndicator step={step} />

            {errorMessage && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-semibold flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1">{errorMessage}</div>
              </div>
            )}

            <form onSubmit={submitForm} className="space-y-6">
              {/* ============================== STEP 1 — EMPLOYEE INFORMATION ============================== */}
              {step === 1 && (
                <div className="space-y-5">
                  <div className="flex items-center gap-2.5 pb-3 border-b border-stone-100">
                    <div className="w-8 h-8 rounded-lg bg-maroon-soft text-maroon font-bold text-sm flex items-center justify-center border border-maroon/20">
                      <IdCard className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="font-outfit font-bold text-lg text-maroon uppercase tracking-wide">
                        Employee Information
                      </h2>
                      <p className="text-xs text-ink-soft">CPF-verified identity for entry and communication.</p>
                    </div>
                  </div>

                  {/* CPF — primary identification field, visually prominent */}
                  <div>
                    <label className="block text-xs font-bold text-ink mb-1.5">
                      CPF No. <span className="text-rose-600">*</span>
                      <span className="ml-2 text-[10px] font-bold text-maroon-dark bg-maroon-soft px-2 py-0.5 rounded-full uppercase tracking-wide align-middle">
                        Primary ID
                      </span>
                    </label>
                    <p className="text-[11px] text-ink-soft mb-2">
                      Your official ONGC CPF (employee) number. Numbers only, 4–10 digits.
                    </p>
                    <div className="relative">
                      <IdCard className="w-5 h-5 text-maroon/60 absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={cpfNo}
                        onChange={(e) => setCpfNo(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
                        required
                        inputMode="numeric"
                        placeholder="e.g. 123456"
                        className="w-full pl-12 pr-4 py-4 rounded-xl bg-cream-light border-2 border-maroon/25 text-ink placeholder-stone-400 text-lg font-mono font-bold tracking-widest focus:outline-none focus:border-maroon focus:ring-2 focus:ring-maroon/20"
                      />
                    </div>
                  </div>

                  {/* Full Name */}
                  <div>
                    <label className="block text-xs font-bold text-ink mb-1.5">
                      Employee Full Name <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      placeholder="e.g. Ramesh Kumar Patel"
                      className="w-full px-4 py-3.5 rounded-xl bg-cream-light border border-stone-300 text-ink placeholder-stone-400 text-sm focus:outline-none focus:border-maroon focus:ring-2 focus:ring-maroon/20"
                    />
                  </div>

                  {/* Mobile — required by the system for contact/verification */}
                  <div>
                    <label className="block text-xs font-bold text-ink mb-1.5">
                      Mobile No. (10 Digits) <span className="text-rose-600">*</span>
                    </label>
                    <p className="text-[11px] text-ink-soft mb-1.5">Used for registration-related communication.</p>
                    <input
                      type="tel"
                      value={mobileNo}
                      onChange={(e) => setMobileNo(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
                      required
                      pattern="[6-9][0-9]{9}"
                      maxLength={10}
                      minLength={10}
                      inputMode="numeric"
                      placeholder="e.g. 9876543210"
                      className="w-full px-4 py-3.5 rounded-xl bg-cream-light border border-stone-300 text-ink placeholder-stone-400 text-sm focus:outline-none focus:border-maroon focus:ring-2 focus:ring-maroon/20"
                    />
                  </div>

                  {/* Employee Category — segmented control */}
                  <div>
                    <label className="block text-xs font-bold text-ink mb-1.5">
                      Employee Category <span className="text-rose-600">*</span>
                    </label>
                    <p className="text-[11px] text-ink-soft mb-2">Select the category that applies to you.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {EMPLOYEE_CATEGORIES.map((c) => (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => setCategory(c.value)}
                          aria-pressed={category === c.value}
                          className={`px-3 py-3.5 rounded-xl border-2 text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                            category === c.value
                              ? 'bg-maroon border-maroon text-white shadow-md'
                              : 'bg-white border-stone-200 text-ink hover:border-gold/60 hover:bg-cream-light'
                          }`}
                        >
                          {category === c.value && <CheckCircle2 className="w-4 h-4 text-gold-light shrink-0" />}
                          <span>{c.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Employee Photo */}
                  <PhotoUploadBox
                    label="Employee Photo"
                    helperText="Upload a clear recent photograph. Used for identity verification only."
                    photo={photo}
                    onSelect={handleEmployeePhotoSelect}
                    onRemove={removeEmployeePhoto}
                  />
                </div>
              )}

              {/* ============================== STEP 2 — FAMILY MEMBERS ============================== */}
              {step === 2 && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between gap-4 pb-3 border-b border-stone-100">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-maroon-soft text-maroon font-bold text-sm flex items-center justify-center border border-maroon/20">
                        <Users className="w-4 h-4" />
                      </div>
                      <div>
                        <h2 className="font-outfit font-bold text-lg text-maroon uppercase tracking-wide">
                          Family Members
                        </h2>
                        <p className="text-xs text-ink-soft">Add family members if applicable.</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                      Optional
                    </span>
                  </div>

                  {familyMembers.length === 0 ? (
                    <div className="p-6 rounded-2xl bg-cream-soft/60 border border-stone-200 text-center space-y-3">
                      <p className="text-xs font-semibold text-ink-soft">No family member added</p>
                      <button
                        onClick={addFamilyMember}
                        type="button"
                        className="px-5 py-2.5 rounded-xl bg-maroon text-white font-bold text-xs hover:bg-maroon-dark transition-all inline-flex items-center gap-1.5 shadow-sm border border-gold/40"
                      >
                        <Plus className="w-4 h-4 text-gold-light" />
                        <span>Add Family Member</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {familyMembers.map((member, index) => (
                        <div
                          key={member.localId}
                          className="p-4 sm:p-5 rounded-2xl bg-cream-light border border-stone-200/80 space-y-4"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-outfit font-bold text-sm text-maroon">
                              Family Member {index + 1}
                            </span>
                            <button
                              onClick={() => removeFamilyMember(member.localId)}
                              type="button"
                              className="text-xs font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Remove</span>
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <div>
                              <label className="block text-[11px] font-bold text-ink mb-1">
                                Name <span className="text-rose-600">*</span>
                              </label>
                              <input
                                type="text"
                                value={member.name}
                                onChange={(e) => updateFamilyMemberField(member.localId, 'name', e.target.value)}
                                required
                                placeholder="Full Name"
                                className="w-full px-3.5 py-2.5 rounded-lg bg-white border border-stone-300 text-ink text-sm focus:outline-none focus:border-maroon"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-ink mb-1">
                                Mobile No. (10 Digits)
                              </label>
                              <input
                                type="tel"
                                value={member.mobileNo}
                                onChange={(e) =>
                                  updateFamilyMemberField(
                                    member.localId,
                                    'mobileNo',
                                    e.target.value.replace(/[^0-9]/g, '').slice(0, 10),
                                  )
                                }
                                pattern="[6-9][0-9]{9}"
                                maxLength={10}
                                inputMode="numeric"
                                placeholder="Optional"
                                className="w-full px-3.5 py-2.5 rounded-lg bg-white border border-stone-300 text-ink text-sm focus:outline-none focus:border-maroon"
                              />
                            </div>
                          </div>

                          <PhotoUploadBox
                            label="Photo"
                            photo={member.photo}
                            onSelect={(file) => handleFamilyPhotoSelect(member.localId, file)}
                            onRemove={() => removeFamilyPhoto(member.localId)}
                            compact
                          />

                          {/* Compact date summary — actual date picking happens in Step 3 */}
                          <div className="flex items-center gap-2 pt-1">
                            <CalendarCheck className="w-4 h-4 text-maroon shrink-0" />
                            {member.selectedDates.length > 0 ? (
                              <span className="text-xs font-semibold text-ink">
                                {member.selectedDates.length} date{member.selectedDates.length > 1 ? 's' : ''} selected
                                &bull; {member.selectedDates.map(formatDateShort).join(', ')}
                              </span>
                            ) : (
                              <span className="text-xs font-semibold text-ink-soft">
                                No dates selected yet &mdash; choose in the next step
                              </span>
                            )}
                          </div>
                        </div>
                      ))}

                      <button
                        onClick={addFamilyMember}
                        type="button"
                        className="w-full py-3.5 rounded-2xl bg-cream-soft border border-gold/50 text-maroon font-bold text-sm hover:bg-gold-soft transition-colors flex items-center justify-center gap-2"
                      >
                        <Plus className="w-4 h-4 text-maroon" />
                        <span>Add Another Family Member</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ============================== STEP 3 — ATTENDANCE DATES ============================== */}
              {step === 3 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-2.5 pb-3 border-b border-stone-100">
                    <div className="w-8 h-8 rounded-lg bg-maroon-soft text-maroon font-bold text-sm flex items-center justify-center border border-maroon/20">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="font-outfit font-bold text-lg text-maroon uppercase tracking-wide">
                        Attendance Dates
                      </h2>
                      <p className="text-xs text-ink-soft">
                        Select one or more dates for each person. Selections are independent per person.
                      </p>
                    </div>
                  </div>

                  {/* Employee's own dates */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-cream-light border border-stone-200/80 space-y-3">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-maroon" />
                      <span className="font-outfit font-bold text-sm text-ink">
                        {name.trim() || 'Employee'} <span className="text-rose-600">*</span>
                      </span>
                    </div>
                    <DateChipGrid selectedDates={employeeDates} onToggle={toggleEmployeeDate} />
                  </div>

                  {/* Each family member's independent dates */}
                  {familyMembers.map((member, index) => (
                    <div
                      key={member.localId}
                      className="p-4 sm:p-5 rounded-2xl bg-cream-light border border-stone-200/80 space-y-3"
                    >
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-maroon" />
                        <span className="font-outfit font-bold text-sm text-ink">
                          {member.name.trim() || `Family Member ${index + 1}`}
                        </span>
                        <span className="text-[10px] font-bold text-ink-soft bg-white px-2 py-0.5 rounded-full border border-stone-200">
                          Optional
                        </span>
                      </div>
                      <DateChipGrid
                        selectedDates={member.selectedDates}
                        onToggle={(date) => toggleFamilyDate(member.localId, date)}
                      />
                    </div>
                  ))}

                  {/* IMPORTANT INSTRUCTIONS — near date selection, as requested */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-cream-soft/90 via-white to-cream-soft/90 border border-gold/45 shadow-sm">
                    <div className="flex items-center gap-2 mb-2.5 pb-2 border-b border-gold/25">
                      <div className="w-6 h-6 rounded-lg bg-gold/20 text-maroon flex items-center justify-center shrink-0 border border-gold/40">
                        <ShieldAlert className="w-3.5 h-3.5 text-maroon" />
                      </div>
                      <h3 className="font-outfit font-bold text-sm sm:text-base text-maroon tracking-wide">
                        Important Instructions
                      </h3>
                    </div>
                    <ul className="space-y-1.5 text-xs sm:text-sm text-ink-soft leading-relaxed">
                      {[
                        'Please enter the CPF Number and employee details carefully.',
                        'Upload a clear recent photograph for each person. Each employee/family member must have an individual photograph.',
                        'Select the date(s) on which each person will attend ONGC Navratri.',
                        'Date selection is individual for each person. Selecting a date for one family member does not automatically select it for another.',
                        'Please verify all details before submitting the registration.',
                        'Keep the generated digital pass/QR code available for entry on the selected date(s).',
                        'The QR/digital pass is intended only for the registered person and must not be shared with another person.',
                        'Please carry the required employee/identity information if requested at the entry gate.',
                      ].map((line, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-gold font-bold text-sm leading-none mt-0.5">&bull;</span>
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* ============================== STEP 4 — REVIEW & SUBMIT ============================== */}
              {step === 4 && (
                <div className="space-y-5">
                  <div className="flex items-center gap-2.5 pb-3 border-b border-stone-100">
                    <div className="w-8 h-8 rounded-lg bg-maroon-soft text-maroon font-bold text-sm flex items-center justify-center border border-maroon/20">
                      <ClipboardCheck className="w-4 h-4" />
                    </div>
                    <h2 className="font-outfit font-bold text-lg text-maroon uppercase tracking-wide">
                      Review &amp; Submit
                    </h2>
                  </div>

                  {/* Employee summary */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-cream-light border border-stone-200/80 flex flex-col sm:flex-row gap-4">
                    {photo.previewUrl ? (
                      <img
                        src={photo.previewUrl}
                        alt="Employee"
                        className="w-20 h-20 rounded-2xl object-cover border-2 border-gold/60 shadow-md shrink-0 mx-auto sm:mx-0"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-2xl bg-maroon-soft text-maroon flex items-center justify-center shrink-0 mx-auto sm:mx-0 border border-maroon/20">
                        <User className="w-8 h-8" />
                      </div>
                    )}
                    <div className="flex-1 space-y-1 text-center sm:text-left">
                      <div className="font-outfit font-extrabold text-base text-ink">{name || '—'}</div>
                      <div className="text-xs text-ink-soft">
                        CPF: <span className="font-mono font-bold text-ink">{cpfNo || '—'}</span> &bull; Mobile: {mobileNo || '—'}
                      </div>
                      <div className="text-xs font-bold text-maroon-dark bg-maroon-soft inline-block px-2 py-0.5 rounded-full mt-1">
                        {EMPLOYEE_CATEGORIES.find((c) => c.value === category)?.label}
                      </div>
                      <div className="flex items-center gap-1.5 pt-1 justify-center sm:justify-start flex-wrap">
                        <Calendar className="w-3.5 h-3.5 text-maroon" />
                        {employeeDates.length > 0 ? (
                          <span className="text-xs font-semibold text-ink">{employeeDates.map(formatDateShort).join(', ')}</span>
                        ) : (
                          <span className="text-xs font-semibold text-rose-600">No dates selected</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Family summary */}
                  {familyMembers.length > 0 && (
                    <div className="space-y-3">
                      <div className="text-xs font-bold text-ink-soft uppercase tracking-wide">
                        Family Members ({familyMembers.length})
                      </div>
                      {familyMembers.map((member, index) => (
                        <div
                          key={member.localId}
                          className="p-3.5 rounded-xl bg-cream-light border border-stone-200/80 flex items-center gap-3"
                        >
                          {member.photo.previewUrl ? (
                            <img
                              src={member.photo.previewUrl}
                              alt={member.name}
                              className="w-12 h-12 rounded-xl object-cover border border-gold/50 shrink-0"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-maroon-soft text-maroon flex items-center justify-center shrink-0 border border-maroon/20">
                              <User className="w-5 h-5" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-ink truncate">
                              {member.name || `Family Member ${index + 1}`}
                            </div>
                            <div className="text-[11px] text-ink-soft">
                              {member.selectedDates.length > 0
                                ? member.selectedDates.map(formatDateShort).join(', ')
                                : 'No dates selected'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold flex items-start gap-2">
                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>Please verify all details above before submitting. This registration cannot be edited afterward.</span>
                  </div>
                </div>
              )}

              {/* STEP VALIDATION MESSAGE */}
              {stepError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{stepError}</span>
                </div>
              )}

              {/* NAVIGATION */}
              <div className="pt-2 flex items-center gap-3">
                {step > 1 && (
                  <button
                    type="button"
                    onClick={goBack}
                    className="px-5 py-3.5 rounded-2xl bg-white border border-stone-300 text-ink font-bold text-sm hover:bg-cream-light transition-all inline-flex items-center gap-1.5 shadow-sm"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>
                )}

                {step < 4 ? (
                  <button
                    type="button"
                    onClick={goNext}
                    className="flex-1 py-3.5 rounded-2xl bg-maroon text-white font-bold text-sm hover:bg-maroon-dark transition-all inline-flex items-center justify-center gap-1.5 shadow-md border border-gold/40"
                  >
                    <span>Continue</span>
                    <ChevronRight className="w-4 h-4 text-gold-light" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={submitting}
                    className={`flex-1 py-3.5 rounded-2xl bg-maroon text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 border border-gold/40 ${
                      submitting ? 'opacity-60 cursor-not-allowed' : 'hover:bg-maroon-dark hover:shadow-lg'
                    }`}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5 text-gold-light" />
                        <span>Submit Registration</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {step === 4 && (
                <p className="text-center text-xs text-ink-soft leading-relaxed max-w-lg mx-auto">
                  Your information is collected for EWC Ahmedabad event registration and entry management. Employee
                  photo is used only for administrative verification.
                </p>
              )}
            </form>
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="max-w-2xl mx-auto w-full text-center text-xs text-ink-soft py-6 mt-8 border-t border-stone-200/80">
        <p>&copy; 2026 ONGC Ahmedabad &bull; EWC Registration System</p>
      </footer>
    </div>
  );
}

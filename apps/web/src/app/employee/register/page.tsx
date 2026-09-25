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
  IdCard,
  Calendar,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ShieldCheck,
  Search,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';

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

interface CommonEmployeeData {
  cpf: string;
  name: string;
  mobile: string;
  photo: PhotoState;
}

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
          <p className="text-xs font-bold text-ink group-hover:text-maroon transition-colors">
            Tap to upload photograph
          </p>
          <p className="text-[10px] text-ink-soft mt-1">JPG, PNG or WEBP &bull; Max 5 MB</p>
        </div>
      ) : (
        <div className="flex items-center gap-3 p-3 bg-cream-light rounded-2xl border border-stone-200">
          <img
            src={photo.previewUrl}
            alt="Preview"
            className="w-14 h-14 object-cover rounded-xl border border-gold/50 shadow-xs shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-ink truncate">{photo.fileName}</p>
            <p className="text-[10px] text-ink-soft">{photo.fileSize}</p>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full mt-1">
              <CheckCircle className="w-3 h-3" /> Ready
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="p-2 text-ink-soft hover:text-maroon hover:bg-maroon-soft rounded-lg transition-colors"
              title="Replace photo"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onRemove}
              className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
              title="Remove photo"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {photo.error && (
        <p className="text-[11px] text-rose-600 font-medium mt-1.5 flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {photo.error}
        </p>
      )}
    </div>
  );
}

function DateChipGrid({
  selectedDates,
  onToggle,
}: {
  selectedDates: string[];
  onToggle: (date: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-2">
      {EVENT_DATES.map((iso, idx) => {
        const selected = selectedDates.includes(iso);
        const { weekday, day, month } = formatDateChip(iso);
        return (
          <button
            key={iso}
            type="button"
            onClick={() => onToggle(iso)}
            className={`p-2 rounded-xl text-center border-2 transition-all flex flex-col items-center justify-center ${
              selected
                ? 'bg-maroon text-white border-maroon shadow-md scale-[1.02]'
                : 'bg-white text-ink border-stone-200 hover:border-maroon/40 hover:bg-cream-soft'
            }`}
          >
            <span
              className={`text-[9px] uppercase tracking-wider font-bold ${
                selected ? 'text-gold-light' : 'text-ink-soft'
              }`}
            >
              Day {idx + 1}
            </span>
            <span className="font-outfit font-extrabold text-base leading-tight mt-0.5">{day}</span>
            <span className={`text-[10px] font-semibold ${selected ? 'text-white/90' : 'text-ink-soft'}`}>
              {month}
            </span>
            <span
              className={`text-[9px] font-medium mt-0.5 ${selected ? 'text-gold-light/90' : 'text-stone-400'}`}
            >
              {weekday}
            </span>
          </button>
        );
      })}
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
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [stepError, setStepError] = useState('');
  const [registeredToken, setRegisteredToken] = useState<string | null>(null);

  // STEP 1 STATE
  const [category, setCategory] = useState<EmployeeCategory | null>(null);
  const [common, setCommon] = useState<CommonEmployeeData>({
    cpf: '',
    name: '',
    mobile: '',
    photo: { ...EMPTY_PHOTO },
  });

  // STEP 2 STATE: Family members
  const [familyMembers, setFamilyMembers] = useState<FamilyMemberForm[]>([]);

  // STEP 3 STATE: Dates
  const [employeeDates, setEmployeeDates] = useState<string[]>([]);

  const scrollTop = () => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleEmployeePhotoSelect = (file: File) => {
    const error = validatePhotoFile(file);
    if (error) {
      setCommon((prev) => ({
        ...prev,
        photo: { ...EMPTY_PHOTO, error },
      }));
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    const sizeInMb = (file.size / (1024 * 1024)).toFixed(2);
    setCommon((prev) => ({
      ...prev,
      photo: {
        file,
        previewUrl,
        fileName: file.name,
        fileSize: `${sizeInMb} MB`,
        error: '',
      },
    }));
  };

  const removeEmployeePhoto = () => {
    if (common.photo.previewUrl) {
      URL.revokeObjectURL(common.photo.previewUrl);
    }
    setCommon((prev) => ({ ...prev, photo: { ...EMPTY_PHOTO } }));
  };

  const addFamilyMember = () => {
    if (familyMembers.length >= 6) {
      setStepError('Maximum 6 family members are permitted per employee pass.');
      return;
    }
    setStepError('');
    setFamilyMembers((prev) => [...prev, createFamilyMember()]);
  };

  const removeFamilyMember = (index: number) => {
    const target = familyMembers[index];
    if (target?.photo?.previewUrl) {
      URL.revokeObjectURL(target.photo.previewUrl);
    }
    setFamilyMembers((prev) => prev.filter((_, i) => i !== index));
  };

  const updateFamilyMemberName = (index: number, name: string) => {
    setFamilyMembers((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], name };
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

  const handleFamilyPhotoSelect = (index: number, file: File) => {
    const error = validatePhotoFile(file);
    setFamilyMembers((prev) => {
      const next = [...prev];
      const current = next[index];
      if (error) {
        next[index] = {
          ...current,
          photo: { ...EMPTY_PHOTO, error },
        };
        return next;
      }
      if (current.photo.previewUrl) {
        URL.revokeObjectURL(current.photo.previewUrl);
      }
      const previewUrl = URL.createObjectURL(file);
      const sizeInMb = (file.size / (1024 * 1024)).toFixed(2);
      next[index] = {
        ...current,
        photo: {
          file,
          previewUrl,
          fileName: file.name,
          fileSize: `${sizeInMb} MB`,
          error: '',
        },
      };
      return next;
    });
  };

  const removeFamilyPhoto = (index: number) => {
    setFamilyMembers((prev) => {
      const next = [...prev];
      const current = next[index];
      if (current.photo.previewUrl) {
        URL.revokeObjectURL(current.photo.previewUrl);
      }
      next[index] = { ...current, photo: { ...EMPTY_PHOTO } };
      return next;
    });
  };

  const toggleEmployeeDate = (date: string) => {
    setEmployeeDates((prev) =>
      prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date].sort()
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
    if (!/^[0-9]{4,10}$/.test(cpf)) return 'CPF number must be 4 to 10 digits.';
    if (!common.name.trim()) return 'Please enter the employee full name.';
    const mobile = common.mobile.trim();
    if (!mobile) return 'Please enter the employee 10-digit mobile number.';
    if (!INDIAN_MOBILE_REGEX.test(mobile)) return 'Employee mobile number must be exactly 10 digits starting with 6, 7, 8, or 9.';
    return null;
  };

  const validateStep2 = (): string | null => {
    for (let i = 0; i < familyMembers.length; i++) {
      const m = familyMembers[i];
      if (!m.name.trim()) return `Please enter the name for Family Member #${i + 1}.`;
      const mobile = m.mobileNo.trim();
      if (!mobile) return `Mobile number is required for Family Member #${i + 1} (${m.name.trim() || 'unnamed'}).`;
      if (!INDIAN_MOBILE_REGEX.test(mobile)) return `Mobile number for Family Member #${i + 1} must be exactly 10 digits starting with 6, 7, 8, or 9.`;
    }
    return null;
  };

  const validateStep3 = (): string | null => {
    if (employeeDates.length === 0) return 'Please select at least one attendance date for the employee.';
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

    try {
      const cleanMobile = common.mobile.trim();
      const formData = new FormData();
      formData.append('name', common.name.trim());
      formData.append('phone', cleanMobile);
      formData.append('cpf', common.cpf.trim().toUpperCase());
      formData.append('email', `${common.cpf.trim().toLowerCase()}@ongc.co.in`);
      formData.append('designation', 'ONGC Employee');
      formData.append('department', 'EWC Ahmedabad');
      formData.append('employeeCategory', category);
      formData.append('registrationType', 'EMPLOYEE');
      formData.append('bookingDays', JSON.stringify(employeeDates));

      const formattedFamily = familyMembers.map((m) => ({
        name: m.name.trim(),
        relation: 'Family Member',
        phone: m.mobileNo.trim(),
        bookingDays: m.selectedDates,
      }));
      formData.append('familyMembers', JSON.stringify(formattedFamily));

      if (common.photo.file) {
        formData.append('photo', common.photo.file);
      }
      familyMembers.forEach((m, i) => {
        if (m.photo.file) {
          formData.append(`familyPhoto_${i}`, m.photo.file);
        }
      });

      const res = await fetchApi('/public/employee/register', {
        method: 'POST',
        body: formData,
      });

      const qrToken = res?.attendee?.qrCodeToken;
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
    setCommon({ cpf: '', name: '', mobile: '', photo: { ...EMPTY_PHOTO } });
    setCategory(null);
    setEmployeeDates([]);
    familyMembers.forEach((m) => {
      if (m.photo.previewUrl) URL.revokeObjectURL(m.photo.previewUrl);
    });
    setFamilyMembers([]);
    setRegisteredToken(null);
    scrollTop();
  };

  return (
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

      {submitted ? (
        /* SUCCESS STATE CARD */
        <div className="bg-white rounded-3xl p-8 sm:p-12 border-2 border-emerald-500/30 shadow-xl text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center shadow-inner border border-emerald-200">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <h2 className="font-outfit font-extrabold text-2xl sm:text-3xl text-ink">
              Pass Registration Completed
            </h2>
            <div className="w-16 h-1 bg-emerald-500 mx-auto rounded-full" />
          </div>

          <p className="text-ink-soft text-sm sm:text-base leading-relaxed max-w-md mx-auto">
            Your ONGC employee and family pass details have been recorded. You can view, print, or download your digital entry passes.
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            {registeredToken ? (
              <Link
                href={`/ticket/${registeredToken}`}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gold text-maroon-deep font-bold text-sm hover:bg-gold-light transition-all shadow-md inline-flex items-center justify-center gap-2 border border-maroon/20"
              >
                <span>View &amp; Download Digital Pass</span>
              </Link>
            ) : (
              <Link
                href="/employee/my-tickets"
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gold text-maroon-deep font-bold text-sm hover:bg-gold-light transition-all shadow-md inline-flex items-center justify-center gap-2 border border-maroon/20"
              >
                <span>View All Passes</span>
              </Link>
            )}

            <button
              onClick={resetForm}
              type="button"
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-maroon text-white font-bold text-sm hover:bg-maroon-dark transition-all shadow-md inline-flex items-center justify-center gap-2 border border-gold/40"
            >
              <PlusCircle className="w-4 h-4 text-gold-light" />
              <span>Register Another Pass</span>
            </button>
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
                          className={`p-4 rounded-2xl border-2 text-left transition-all ${
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
                    {/* CPF Field */}
                    <div>
                      <label htmlFor="emp-cpf" className="block text-xs font-bold text-ink mb-1.5">
                        CPF No. <span className="text-rose-600">*</span>
                        <span className="ml-2 text-[10px] font-bold text-maroon-dark bg-maroon-soft px-2 py-0.5 rounded-full uppercase tracking-wide">
                          Primary Identifier
                        </span>
                      </label>
                      <input
                        id="emp-cpf"
                        type="text"
                        value={common.cpf}
                        onChange={(e) =>
                          setCommon((prev) => ({
                            ...prev,
                            cpf: e.target.value.replace(/[^0-9]/g, '').slice(0, 10),
                          }))
                        }
                        required
                        inputMode="numeric"
                        placeholder="e.g. 123456"
                        className="w-full px-4 py-3.5 rounded-xl bg-cream-light border-2 border-maroon/25 text-ink text-lg font-mono font-bold tracking-widest focus:outline-none focus:border-maroon"
                      />
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
                    </div>

                    {/* Photo Upload */}
                    <PhotoUploadBox
                      label="Employee Photograph"
                      helperText="Recent passport-style photograph for digital pass verification."
                      photo={common.photo}
                      onSelect={handleEmployeePhotoSelect}
                      onRemove={removeEmployeePhoto}
                    />
                  </div>
                )}
              </div>
            )}

            {/* ============================== STEP 2 — FAMILY MEMBERS ============================== */}
            {step === 2 && (
              <div className="space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-maroon" />
                    <div>
                      <h2 className="font-outfit font-extrabold text-base text-ink">
                        Family Members ({familyMembers.length}/6)
                      </h2>
                      <p className="text-[11px] text-ink-soft">
                        Add eligible spouse and dependent family members.
                      </p>
                    </div>
                  </div>
                  {familyMembers.length < 6 && (
                    <button
                      type="button"
                      onClick={addFamilyMember}
                      className="px-3.5 py-1.5 rounded-xl bg-maroon text-white font-bold text-xs hover:bg-maroon-dark transition-all flex items-center gap-1.5 shadow-xs"
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
                      If you are attending alone, you can proceed to Date Selection. If family is accompanying you, add them below.
                    </p>
                    <button
                      type="button"
                      onClick={addFamilyMember}
                      className="px-4 py-2 rounded-xl bg-maroon-soft text-maroon font-bold text-xs hover:bg-maroon hover:text-white transition-all inline-flex items-center gap-1.5"
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
                            className="text-xs font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1"
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
                        </div>

                        <PhotoUploadBox
                          label="Member Photo (Optional)"
                          photo={fam.photo}
                          onSelect={(file) => handleFamilyPhotoSelect(idx, file)}
                          onRemove={() => removeFamilyPhoto(idx)}
                          compact
                        />
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
                        Select which days each person will attend.
                      </p>
                    </div>
                  </div>
                  {familyMembers.length > 0 && employeeDates.length > 0 && (
                    <button
                      type="button"
                      onClick={applyEmployeeDatesToAll}
                      className="px-3 py-1.5 rounded-xl bg-gold/30 hover:bg-gold/50 text-maroon-deep text-xs font-bold transition-all"
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
                  <DateChipGrid selectedDates={employeeDates} onToggle={toggleEmployeeDate} />
                  <p className="text-[11px] text-ink-soft">
                    Selected: {employeeDates.length} of {EVENT_DATES.length} days
                  </p>
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
                        {fam.name.trim() || `Family Member #${idx + 1}`}
                      </span>
                    </div>
                    <DateChipGrid
                      selectedDates={fam.selectedDates}
                      onToggle={(d) => toggleFamilyDate(idx, d)}
                    />
                    <p className="text-[11px] text-ink-soft">
                      Selected: {fam.selectedDates.length} of {EVENT_DATES.length} days
                    </p>
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
                  {common.photo.previewUrl ? (
                    <img
                      src={common.photo.previewUrl}
                      alt="Employee"
                      className="w-20 h-20 rounded-2xl object-cover border-2 border-gold/60 shadow-md shrink-0 mx-auto sm:mx-0"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-2xl bg-maroon-soft text-maroon flex items-center justify-center border border-maroon/20 shrink-0 mx-auto sm:mx-0">
                      <User className="w-8 h-8" />
                    </div>
                  )}
                  <div className="flex-1 space-y-1 text-center sm:text-left">
                    <div className="font-outfit font-extrabold text-base text-ink">{common.name}</div>
                    <div className="text-xs text-ink-soft">
                      CPF: <span className="font-mono font-bold text-ink">{common.cpf}</span> &bull; Mobile: {common.mobile}
                    </div>
                    <div className="text-xs font-bold text-maroon-dark bg-maroon-soft inline-block px-2.5 py-0.5 rounded-full mt-1">
                      {EMPLOYEE_CATEGORIES.find((c) => c.value === category)?.label}
                    </div>
                    <div className="pt-2 text-xs font-semibold text-ink">
                      Dates ({employeeDates.length}): {employeeDates.map(formatDateShort).join(', ')}
                    </div>
                  </div>
                </div>

                {/* Family details card */}
                {familyMembers.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-outfit font-bold text-sm text-ink">
                      Family Members ({familyMembers.length})
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {familyMembers.map((m, idx) => (
                        <div
                          key={m.localId}
                          className="p-3.5 rounded-xl bg-cream-light border border-stone-200 flex items-center gap-3"
                        >
                          {m.photo.previewUrl ? (
                            <img
                              src={m.photo.previewUrl}
                              alt={m.name}
                              className="w-12 h-12 rounded-xl object-cover border border-gold/40 shrink-0"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-maroon-soft text-maroon flex items-center justify-center shrink-0">
                              <User className="w-5 h-5" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-ink truncate">{m.name}</p>
                            <p className="text-[11px] text-ink-soft">Mobile: {m.mobileNo}</p>
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
              </div>
            )}

            {/* STEP CONTROLS */}
            <div className="pt-4 border-t border-stone-100 flex items-center justify-between">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={goBack}
                  className="px-5 py-2.5 rounded-xl border border-stone-300 text-ink font-bold text-xs hover:bg-stone-100 transition-colors flex items-center gap-1.5"
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
                  className="px-6 py-2.5 rounded-xl bg-maroon text-white font-bold text-xs hover:bg-maroon-dark transition-all flex items-center gap-1.5 shadow-md"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-8 py-3 rounded-xl bg-gold text-maroon-deep font-extrabold text-sm hover:bg-gold-light transition-all shadow-md flex items-center gap-2 border border-maroon/20 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Submitting Pass...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirm &amp; Issue Passes</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

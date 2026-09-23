'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Info,
  CheckCircle2,
  CheckCircle,
  PlusCircle,
  AlertCircle,
  User,
  Upload,
  RefreshCw,
  Trash2,
  Plus,
  Loader2,
  Home,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';

interface FamilyMember {
  name: string;
  mobile_no: string;
  relation?: string;
}

export default function RegisterPage() {
  const router = useRouter();

  // Form state matching Laravel EWC registration
  const [name, setName] = useState('');
  const [mobileNo, setMobileNo] = useState('');
  const [cpfNo, setCpfNo] = useState('');
  const [dob, setDob] = useState('');
  const [dateOfJoining, setDateOfJoining] = useState('');

  // Photo upload
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [photoFileName, setPhotoFileName] = useState('');
  const [photoFileSize, setPhotoFileSize] = useState('');
  const [photoError, setPhotoError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Family members
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [registeredToken, setRegisteredToken] = useState<string | null>(null);

  // All 9 dates for season festival pass
  const ALL_FESTIVAL_DATES = [
    '2026-09-23',
    '2026-09-24',
    '2026-09-25',
    '2026-09-26',
    '2026-09-27',
    '2026-09-28',
    '2026-09-29',
    '2026-09-30',
    '2026-10-01',
  ];

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    setPhotoError('');
    const ext = file.name.split('.').pop()?.toLowerCase();
    const validExts = ['jpg', 'jpeg', 'png', 'webp'];

    if (!ext || !validExts.includes(ext)) {
      setPhotoError('Please upload a JPG, PNG or WEBP image up to 5 MB.');
      e.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setPhotoError('Please upload a JPG, PNG or WEBP image up to 5 MB.');
      e.target.value = '';
      return;
    }

    setPhotoFile(file);
    setPhotoPreviewUrl(URL.createObjectURL(file));
    setPhotoFileName(file.name);
    setPhotoFileSize((file.size / (1024 * 1024)).toFixed(2) + ' MB');
  };

  const removePhoto = () => {
    if (photoPreviewUrl) {
      URL.revokeObjectURL(photoPreviewUrl);
    }
    setPhotoFile(null);
    setPhotoPreviewUrl(null);
    setPhotoFileName('');
    setPhotoFileSize('');
    setPhotoError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const addFamilyMember = () => {
    if (familyMembers.length >= 6) {
      alert('Maximum 6 family members allowed');
      return;
    }
    setFamilyMembers([...familyMembers, { name: '', mobile_no: '', relation: 'Family Member' }]);
  };

  const removeFamilyMember = (index: number) => {
    setFamilyMembers(familyMembers.filter((_, i) => i !== index));
  };

  const updateFamilyMember = (index: number, field: keyof FamilyMember, value: string) => {
    const updated = [...familyMembers];
    updated[index][field] = value;
    setFamilyMembers(updated);
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setErrorMessage('');
    setPhotoError('');

    // Frontend Indian Mobile Number Validation
    const indianMobileRegex = /^[6-9][0-9]{9}$/;
    const cleanMobile = mobileNo.trim();

    if (!indianMobileRegex.test(cleanMobile)) {
      setErrorMessage('Enter a valid 10-digit Indian mobile number starting with 6, 7, 8 or 9.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Family Member Validation
    for (let i = 0; i < familyMembers.length; i++) {
      const fm = familyMembers[i];
      const fmName = fm.name.trim();
      const fmMobile = fm.mobile_no.trim();

      if (!fmName) {
        setErrorMessage(`Please enter the name for family member #${i + 1}.`);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      if (fmMobile !== '' && !indianMobileRegex.test(fmMobile)) {
        setErrorMessage(
          `Enter a valid 10-digit Indian mobile number starting with 6, 7, 8 or 9 for family member #${i + 1}.`
        );
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    }

    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('phone', cleanMobile);
      formData.append('cpf', cpfNo.trim().toUpperCase());
      formData.append('email', `${cpfNo.trim().toLowerCase()}@ongc.co.in`);
      formData.append('designation', 'ONGC Employee');
      formData.append('department', 'EWC Ahmedabad');
      formData.append('bookingDays', JSON.stringify(ALL_FESTIVAL_DATES));

      const formattedFamily = familyMembers.map((m) => ({
        name: m.name.trim(),
        relation: m.relation || 'Family Member',
        phone: m.mobile_no.trim() || cleanMobile,
      }));
      formData.append('familyMembers', JSON.stringify(formattedFamily));

      if (photoFile) {
        formData.append('photo', photoFile);
      }

      const res = await fetchApi('/public/register', {
        method: 'POST',
        body: formData,
      });

      const qrToken = res.data?.attendee?.qrCodeToken;
      if (qrToken) {
        setRegisteredToken(qrToken);
      }
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setErrorMessage(err.message || 'Validation failed. Please check the entered details.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSubmitted(false);
    setErrorMessage('');
    removePhoto();
    setName('');
    setMobileNo('');
    setCpfNo('');
    setDob('');
    setDateOfJoining('');
    setFamilyMembers([]);
    setRegisteredToken(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="font-sans bg-cream text-ink antialiased min-h-screen py-6 px-4 sm:px-6 lg:px-8 flex flex-col justify-between selection:bg-maroon selection:text-white">
      {/* TOP HEADER / PROMINENT BRANDING */}
      <header className="max-w-2xl mx-auto w-full text-center mb-6 pt-2 sm:pt-4">
        {/* Navigation Home Link */}
        <div className="flex justify-between items-center mb-4 max-w-2xl mx-auto">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-maroon hover:text-maroon-dark transition-colors"
          >
            <Home className="w-4 h-4" />
            <span>Home</span>
          </Link>
          <Link
            href="/my-tickets"
            className="text-xs font-bold text-maroon hover:underline"
          >
            Already registered? Find Pass
          </Link>
        </div>

        {/* ONGC Logo + ONGC AHMEDABAD Badge */}
        <div className="inline-flex items-center gap-3 sm:gap-4 px-5 py-2.5 sm:px-7 sm:py-3 bg-white rounded-2xl border border-gold/45 shadow-md mb-4 hover:shadow-lg transition-shadow">
          <img
            src="/images/logo-web.png"
            alt="ONGC Logo"
            className="h-11 sm:h-14 w-auto object-contain shrink-0"
          />
          <div className="h-8 w-px bg-gold/50 mx-0.5" />
          <span className="font-cinzel font-extrabold text-maroon text-lg sm:text-2xl tracking-wider uppercase">
            ONGC AHMEDABAD
          </span>
        </div>

        {/* EWC Ahmedabad Title */}
        <h1 className="font-cinzel font-extrabold text-3xl sm:text-5xl text-maroon tracking-tight drop-shadow-xs mt-1">
          EWC Ahmedabad
        </h1>

        {/* Subtitle */}
        <p className="font-outfit text-ink-soft text-base sm:text-lg mt-1.5 font-semibold tracking-wide">
          ONGC Employee & Family Registration
        </p>
      </header>

      {/* MAIN REGISTRATION CONTAINER */}
      <main className="max-w-2xl mx-auto w-full my-auto">
        {/* INSTRUCTION / BEFORE YOU BEGIN PANEL */}
        <div className="mb-6 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-cream-soft/90 via-white to-cream-soft/90 border border-gold/45 shadow-sm text-left">
          <div className="flex items-center gap-2 mb-2.5 pb-2 border-b border-gold/25">
            <div className="w-6 h-6 rounded-lg bg-gold/20 text-maroon flex items-center justify-center shrink-0 border border-gold/40">
              <Info className="w-3.5 h-3.5 text-maroon" />
            </div>
            <h3 className="font-outfit font-bold text-sm sm:text-base text-maroon tracking-wide">
              Before You Begin
            </h3>
          </div>
          <ul className="space-y-1.5 text-xs sm:text-sm text-ink-soft leading-relaxed">
            <li className="flex items-start gap-2">
              <span className="text-gold font-bold text-sm leading-none mt-0.5">&bull;</span>
              <span>This form is for ONGC employees of EWC Ahmedabad.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gold font-bold text-sm leading-none mt-0.5">&bull;</span>
              <span>Please enter your details exactly as per official records.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gold font-bold text-sm leading-none mt-0.5">&bull;</span>
              <span>
                All employee details marked with <span className="text-rose-600 font-bold">*</span> are mandatory.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gold font-bold text-sm leading-none mt-0.5">&bull;</span>
              <span>Family member details are optional.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gold font-bold text-sm leading-none mt-0.5">&bull;</span>
              <span>Please keep your mobile number active for registration-related communication.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gold font-bold text-sm leading-none mt-0.5">&bull;</span>
              <span>After successful submission, your digital pass/QR code will be generated.</span>
            </li>
          </ul>
        </div>

        {/* SUCCESS STATE CARD */}
        {submitted ? (
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
                  <span>View & Download My Digital Pass</span>
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
          <div className="bg-white rounded-3xl p-6 sm:p-10 border border-gold/40 shadow-xl space-y-8">
            {/* ERROR ALERT */}
            {errorMessage && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-semibold flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1">{errorMessage}</div>
              </div>
            )}

            <form onSubmit={submitForm} className="space-y-8">
              {/* SECTION 1 — EMPLOYEE DETAILS */}
              <div className="space-y-5">
                <div className="flex items-center gap-2.5 pb-3 border-b border-stone-100">
                  <div className="w-8 h-8 rounded-lg bg-maroon-soft text-maroon font-bold text-sm flex items-center justify-center border border-maroon/20">
                    1
                  </div>
                  <h2 className="font-outfit font-bold text-lg text-maroon uppercase tracking-wide">
                    EMPLOYEE DETAILS
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* 1. NAME (FULL WIDTH) */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-ink mb-1.5">
                      Employee Name <span className="text-rose-600">*</span>
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

                  {/* 2. MOBILE NO. (TWO COLUMNS ON DESKTOP) */}
                  <div>
                    <label className="block text-xs font-bold text-ink mb-1.5">
                      Mobile No. (10 Digits) <span className="text-rose-600">*</span>
                    </label>
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

                  {/* 3. CPF NO. (TWO COLUMNS ON DESKTOP) */}
                  <div>
                    <label className="block text-xs font-bold text-ink mb-1.5">
                      CPF No. <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={cpfNo}
                      onChange={(e) => setCpfNo(e.target.value.toUpperCase())}
                      required
                      placeholder="e.g. 123456"
                      className="w-full px-4 py-3.5 rounded-xl bg-cream-light border border-stone-300 text-ink placeholder-stone-400 text-sm uppercase font-mono focus:outline-none focus:border-maroon focus:ring-2 focus:ring-maroon/20"
                    />
                  </div>

                  {/* 4. D.O.B. (TWO COLUMNS ON DESKTOP) */}
                  <div>
                    <label className="block text-xs font-bold text-ink mb-1.5">
                      D.O.B. <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="date"
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      required
                      max={new Date().toISOString().split('T')[0]}
                      className="w-full px-4 py-3.5 rounded-xl bg-cream-light border border-stone-300 text-ink text-sm focus:outline-none focus:border-maroon focus:ring-2 focus:ring-maroon/20"
                    />
                  </div>

                  {/* 5. DATE OF JOINING (TWO COLUMNS ON DESKTOP) */}
                  <div>
                    <label className="block text-xs font-bold text-ink mb-1.5">
                      Date of Joining <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="date"
                      value={dateOfJoining}
                      onChange={(e) => setDateOfJoining(e.target.value)}
                      required
                      max={new Date().toISOString().split('T')[0]}
                      className="w-full px-4 py-3.5 rounded-xl bg-cream-light border border-stone-300 text-ink text-sm focus:outline-none focus:border-maroon focus:ring-2 focus:ring-maroon/20"
                    />
                  </div>

                  {/* 6. EMPLOYEE PHOTO (FULL WIDTH UPLOAD AREA) */}
                  <div className="sm:col-span-2 pt-1">
                    <label className="block text-xs font-bold text-ink mb-1">
                      Employee Photo
                    </label>
                    <p className="text-[11px] text-ink-soft mb-2.5">
                      Upload a recent photo for identity verification. (Admin verification only)
                    </p>

                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handlePhotoSelect}
                    />

                    {!photoPreviewUrl ? (
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="cursor-pointer border-2 border-dashed border-stone-300 hover:border-maroon/60 bg-cream-light hover:bg-cream/70 rounded-2xl p-6 text-center transition-all group shadow-2xs"
                      >
                        <div className="w-12 h-12 rounded-full bg-maroon-soft text-maroon mx-auto flex items-center justify-center mb-3 group-hover:scale-105 transition-transform border border-maroon/20">
                          <User className="w-6 h-6" />
                        </div>
                        <div className="font-outfit font-bold text-sm text-ink group-hover:text-maroon transition-colors">
                          Upload Employee Photo
                        </div>
                        <div className="text-xs text-ink-soft mt-1">
                          JPG / PNG / WEBP &bull; Max 5 MB
                        </div>
                        <div className="mt-3.5">
                          <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-white border border-stone-200 text-xs font-bold text-maroon shadow-xs group-hover:border-gold/60">
                            <Upload className="w-3.5 h-3.5 text-gold-dark" /> Choose Photo
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 rounded-2xl bg-cream-light border border-gold/40 shadow-xs flex flex-col sm:flex-row items-center gap-4">
                        <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border-2 border-gold/60 shadow-md bg-white shrink-0">
                          <img
                            src={photoPreviewUrl}
                            alt="Employee Photo Preview"
                            className="w-full h-full object-cover"
                          />
                        </div>

                        <div className="flex-1 text-center sm:text-left space-y-1">
                          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Photo uploaded</span>
                          </div>
                          <div className="text-xs font-semibold text-ink truncate max-w-xs">
                            {photoFileName}
                          </div>
                          <div className="text-[11px] text-ink-soft">{photoFileSize}</div>

                          <div className="flex items-center justify-center sm:justify-start gap-2 pt-2">
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="px-3 py-1.5 rounded-lg bg-white border border-stone-300 text-ink hover:text-maroon text-xs font-bold transition-colors shadow-2xs inline-flex items-center gap-1"
                            >
                              <RefreshCw className="w-3 h-3" /> Change Photo
                            </button>
                            <button
                              type="button"
                              onClick={removePhoto}
                              className="px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 text-xs font-bold transition-colors shadow-2xs inline-flex items-center gap-1"
                            >
                              <Trash2 className="w-3 h-3" /> Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {photoError && (
                      <div className="mt-2 text-xs text-rose-600 font-semibold flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>{photoError}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* SECTION 2 — FAMILY MEMBERS (OPTIONAL) */}
              <div className="space-y-5 pt-4 border-t border-stone-200">
                <div className="flex items-center justify-between gap-4 pb-3 border-b border-stone-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-maroon-soft text-maroon font-bold text-sm flex items-center justify-center border border-maroon/20">
                      2
                    </div>
                    <div>
                      <h2 className="font-outfit font-bold text-lg text-maroon uppercase tracking-wide">
                        FAMILY MEMBERS
                      </h2>
                      <p className="text-xs text-ink-soft">Add family members if applicable.</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                    Optional
                  </span>
                </div>

                {/* EMPTY STATE */}
                {familyMembers.length === 0 ? (
                  <div className="p-6 rounded-2xl bg-cream-soft/60 border border-stone-200 text-center space-y-3">
                    <p className="text-xs font-semibold text-ink-soft">No family member added</p>
                    <button
                      onClick={addFamilyMember}
                      type="button"
                      className="px-5 py-2.5 rounded-xl bg-maroon text-white font-bold text-xs hover:bg-maroon-dark transition-all inline-flex items-center gap-1.5 shadow-sm border border-gold/40"
                    >
                      <Plus className="w-4 h-4 text-gold-light" />
                      <span>+ Add Family Member</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {familyMembers.map((member, index) => (
                      <div
                        key={index}
                        className="p-4 sm:p-5 rounded-2xl bg-cream-light border border-stone-200/80 space-y-4 relative"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-outfit font-bold text-sm text-maroon">
                            Family Member {index + 1}
                          </span>
                          <button
                            onClick={() => removeFamilyMember(index)}
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
                              onChange={(e) => updateFamilyMember(index, 'name', e.target.value)}
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
                              value={member.mobile_no}
                              onChange={(e) =>
                                updateFamilyMember(
                                  index,
                                  'mobile_no',
                                  e.target.value.replace(/[^0-9]/g, '').slice(0, 10)
                                )
                              }
                              pattern="[6-9][0-9]{9}"
                              maxLength={10}
                              inputMode="numeric"
                              placeholder="e.g. 9876543210"
                              className="w-full px-3.5 py-2.5 rounded-lg bg-white border border-stone-300 text-ink text-sm focus:outline-none focus:border-maroon"
                            />
                          </div>
                        </div>
                      </div>
                    ))}

                    <div>
                      <button
                        onClick={addFamilyMember}
                        type="button"
                        className="w-full py-3.5 rounded-2xl bg-cream-soft border border-gold/50 text-maroon font-bold text-sm hover:bg-gold-soft transition-colors flex items-center justify-center gap-2"
                      >
                        <Plus className="w-4 h-4 text-maroon" />
                        <span>+ Add Another Family Member</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* SUBMIT BUTTON & PRIVACY NOTICE */}
              <div className="pt-4 border-t border-stone-200 space-y-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className={`w-full py-4 rounded-2xl bg-maroon text-white font-bold text-base shadow-md transition-all flex items-center justify-center gap-2 border border-gold/40 ${
                    submitting
                      ? 'opacity-60 cursor-not-allowed'
                      : 'hover:bg-maroon-dark hover:shadow-lg'
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

                <p className="text-center text-xs text-ink-soft leading-relaxed max-w-lg mx-auto">
                  Your information is collected for EWC Ahmedabad event registration and entry management. Employee photo is used only for administrative verification.
                </p>
              </div>
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

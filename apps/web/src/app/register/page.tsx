'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  User,
  Users,
  Calendar,
  Upload,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  ArrowRight,
  ShieldCheck,
  Building,
  Phone,
  Mail,
  Briefcase,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';

const EVENT_DATES = [
  { id: '2026-09-23', label: 'Day 1 — 23 Sep (Wed) — Pratipada' },
  { id: '2026-09-24', label: 'Day 2 — 24 Sep (Thu) — Dwitiya' },
  { id: '2026-09-25', label: 'Day 3 — 25 Sep (Fri) — Tritiya' },
  { id: '2026-09-26', label: 'Day 4 — 26 Sep (Sat) — Chaturthi' },
  { id: '2026-09-27', label: 'Day 5 — 27 Sep (Sun) — Panchami' },
  { id: '2026-09-28', label: 'Day 6 — 28 Sep (Mon) — Sasthi' },
  { id: '2026-09-29', label: 'Day 7 — 29 Sep (Tue) — Saptami' },
  { id: '2026-09-30', label: 'Day 8 — 30 Sep (Wed) — Ashtami' },
  { id: '2026-10-01', label: 'Day 9 — 01 Oct (Thu) — Navami & Dussehra' },
];

export default function RegisterPage() {
  const router = useRouter();

  // Employee Form State
  const [cpf, setCpf] = useState('');
  const [name, setName] = useState('');
  const [designation, setDesignation] = useState('');
  const [department, setDepartment] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);

  // Booking Days
  const [bookingDays, setBookingDays] = useState<string[]>([
    '2026-09-23',
    '2026-09-24',
    '2026-09-25',
    '2026-09-26',
    '2026-09-27',
    '2026-09-28',
    '2026-09-29',
    '2026-09-30',
    '2026-10-01',
  ]);

  // Family Members
  const [familyMembers, setFamilyMembers] = useState<
    Array<{ name: string; relation: string; age?: number; gender?: string }>
  >([]);

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const toggleAllDays = () => {
    if (bookingDays.length === EVENT_DATES.length) {
      setBookingDays([]);
    } else {
      setBookingDays(EVENT_DATES.map((d) => d.id));
    }
  };

  const toggleDay = (dayId: string) => {
    if (bookingDays.includes(dayId)) {
      setBookingDays(bookingDays.filter((d) => d !== dayId));
    } else {
      setBookingDays([...bookingDays, dayId]);
    }
  };

  const addFamilyMember = () => {
    if (familyMembers.length >= 6) {
      alert('Maximum 6 family members allowed per registration');
      return;
    }
    setFamilyMembers([
      ...familyMembers,
      { name: '', relation: 'Spouse', age: 30, gender: 'Female' },
    ]);
  };

  const updateFamilyMember = (index: number, field: string, value: any) => {
    const updated = [...familyMembers];
    (updated[index] as any)[field] = value;
    setFamilyMembers(updated);
  };

  const removeFamilyMember = (index: number) => {
    setFamilyMembers(familyMembers.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!cpf.trim() || !name.trim() || !phone.trim() || !email.trim()) {
      setErrorMessage('Please fill in all mandatory employee fields.');
      return;
    }

    if (bookingDays.length === 0) {
      setErrorMessage('Please select at least 1 event night to attend.');
      return;
    }

    // Verify family members
    for (let i = 0; i < familyMembers.length; i++) {
      if (!familyMembers[i].name.trim()) {
        setErrorMessage(`Please enter the name for family member #${i + 1}`);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('cpf', cpf.trim().toUpperCase());
      formData.append('name', name.trim());
      formData.append('designation', designation.trim() || 'Officer');
      formData.append('department', department.trim() || 'General');
      formData.append('phone', phone.trim());
      formData.append('email', email.trim().toLowerCase());
      formData.append('bookingDays', JSON.stringify(bookingDays));
      formData.append('familyMembers', JSON.stringify(familyMembers));

      if (photo) {
        formData.append('photo', photo);
      }

      const res = await fetchApi('/public/register', {
        method: 'POST',
        body: formData,
      });

      if (res.data?.attendee?.qrCodeToken) {
        router.push(`/ticket/${res.data.attendee.qrCodeToken}`);
      } else {
        router.push(`/my-tickets?cpf=${cpf.trim().toUpperCase()}`);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit registration');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between selection:bg-red-600 selection:text-white">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-white text-lg">
            <span className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center text-white font-black text-sm">
              ओ
            </span>
            <span>ONGC Navratri Pass Registration</span>
          </Link>
          <Link
            href="/my-tickets"
            className="text-xs sm:text-sm font-semibold text-amber-400 hover:text-amber-300"
          >
            Already registered? Find Pass
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 flex-1 w-full">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-white">
            Employee & Family Registration
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Complete this form to generate digital QR entry passes for the 2026 festival.
          </p>
        </div>

        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl bg-red-950/60 border border-red-500/50 flex items-center gap-3 text-red-200 text-sm">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Section 1: Employee Primary Details */}
          <div className="p-6 rounded-2xl bg-slate-800/40 border border-slate-800 space-y-6">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-700/60">
              <User className="w-5 h-5 text-red-500" />
              <h2 className="font-bold text-lg text-white">
                1. ONGC Employee Details
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  ONGC CPF Number *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 123456"
                  value={cpf}
                  onChange={(e) => setCpf(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 focus:border-red-500 focus:ring-1 focus:ring-red-500 text-white placeholder-slate-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Full Name (as per ONGC ID) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 focus:border-red-500 focus:ring-1 focus:ring-red-500 text-white placeholder-slate-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Designation *
                </label>
                <div className="relative">
                  <Briefcase className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Superintending Engineer (Drilling)"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 focus:border-red-500 focus:ring-1 focus:ring-red-500 text-white placeholder-slate-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Department / Asset *
                </label>
                <div className="relative">
                  <Building className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Western Onshore Basin"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 focus:border-red-500 focus:ring-1 focus:ring-red-500 text-white placeholder-slate-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Mobile Number (for SMS & Verification) *
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                  <input
                    type="tel"
                    required
                    placeholder="+91 9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 focus:border-red-500 focus:ring-1 focus:ring-red-500 text-white placeholder-slate-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Email Address *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                  <input
                    type="email"
                    required
                    placeholder="name@ongc.co.in"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 focus:border-red-500 focus:ring-1 focus:ring-red-500 text-white placeholder-slate-500"
                  />
                </div>
              </div>
            </div>

            {/* Photo Upload */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Employee Photo (Optional, used for turnstile gate screen display)
              </label>
              <div className="flex items-center gap-4">
                <label className="px-4 py-2.5 rounded-xl bg-slate-900 border border-dashed border-slate-600 hover:border-slate-500 cursor-pointer flex items-center gap-2 text-sm text-slate-300">
                  <Upload className="w-4 h-4 text-slate-400" />
                  <span>{photo ? photo.name : 'Choose JPG/PNG file...'}</span>
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/webp"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setPhoto(e.target.files[0]);
                      }
                    }}
                  />
                </label>
                {photo && (
                  <button
                    type="button"
                    onClick={() => setPhoto(null)}
                    className="text-xs text-red-400 hover:underline"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Attendance Dates */}
          <div className="p-6 rounded-2xl bg-slate-800/40 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700/60">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-amber-400" />
                <h2 className="font-bold text-lg text-white">
                  2. Select Event Nights
                </h2>
              </div>
              <button
                type="button"
                onClick={toggleAllDays}
                className="text-xs font-semibold text-amber-400 hover:underline"
              >
                {bookingDays.length === EVENT_DATES.length
                  ? 'Deselect All'
                  : 'Select All 9 Nights'}
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Passes will be active and authorized for entry exclusively on the dates checked below.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-2">
              {EVENT_DATES.map((day) => {
                const isSelected = bookingDays.includes(day.id);
                return (
                  <button
                    type="button"
                    key={day.id}
                    onClick={() => toggleDay(day.id)}
                    className={`p-3 rounded-xl border text-left text-xs font-medium transition-all flex items-center justify-between ${
                      isSelected
                        ? 'bg-amber-950/40 border-amber-500/50 text-amber-200'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span>{day.label}</span>
                    {isSelected && (
                      <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: Family Members */}
          <div className="p-6 rounded-2xl bg-slate-800/40 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700/60">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-400" />
                <h2 className="font-bold text-lg text-white">
                  3. Immediate Family Members
                </h2>
              </div>
              <button
                type="button"
                onClick={addFamilyMember}
                className="px-3 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/40 hover:bg-emerald-900/60 text-emerald-300 text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Family Member
              </button>
            </div>

            {familyMembers.length === 0 ? (
              <p className="text-sm text-slate-400 italic py-2">
                No family members added. (Click the button above to include spouse, children, or parents).
              </p>
            ) : (
              <div className="space-y-3">
                {familyMembers.map((fam, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-slate-900 border border-slate-700/80 flex flex-col sm:flex-row items-center gap-3"
                  >
                    <span className="w-6 h-6 rounded-full bg-slate-800 text-slate-400 text-xs flex items-center justify-center font-bold">
                      {idx + 1}
                    </span>

                    <input
                      type="text"
                      required
                      placeholder="Family Member Full Name"
                      value={fam.name}
                      onChange={(e) => updateFamilyMember(idx, 'name', e.target.value)}
                      className="w-full sm:flex-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:border-emerald-500"
                    />

                    <select
                      value={fam.relation}
                      onChange={(e) => updateFamilyMember(idx, 'relation', e.target.value)}
                      className="w-full sm:w-36 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:border-emerald-500"
                    >
                      <option value="Spouse">Spouse</option>
                      <option value="Child">Child / Dependent</option>
                      <option value="Parent">Parent</option>
                      <option value="Other">Other Family</option>
                    </select>

                    <input
                      type="number"
                      placeholder="Age"
                      min={1}
                      max={120}
                      value={fam.age || ''}
                      onChange={(e) =>
                        updateFamilyMember(idx, 'age', parseInt(e.target.value, 10))
                      }
                      className="w-full sm:w-20 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:border-emerald-500"
                    />

                    <button
                      type="button"
                      onClick={() => removeFamilyMember(idx)}
                      className="p-2 text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded-lg transition-colors"
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submit Action */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-extrabold text-lg shadow-xl shadow-red-900/40 flex items-center justify-center gap-3 transition-transform hover:-translate-y-0.5 disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Generating Digital Passes...</span>
              ) : (
                <>
                  <ShieldCheck className="w-6 h-6" />
                  <span>Generate Passes ({1 + familyMembers.length} Total)</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

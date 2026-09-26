'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import {
  Search,
  Ticket,
  AlertCircle,
  CheckCircle2,
  Award,
  Users,
  ArrowRight,
  Sparkles,
  Calendar,
  ShieldCheck,
  UserCheck,
  Building2,
  Briefcase,
  IdCard,
  Lock,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import PasswordInput from '@/components/PasswordInput';
import { validateEmployeeLookup, formatEmployeePassDates } from './employee-tickets-utils';

function EmployeeTicketsContent() {
  const [cpf, setCpf] = useState('');
  const [phoneLast4, setPhoneLast4] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setResult(null);

    const validation = validateEmployeeLookup(cpf, phoneLast4);
    if (!validation.isValid) {
      setError(
        validation.error ||
          'Please enter both your ONGC CPF number and the last 4 digits of your registered phone number.',
      );
      return;
    }

    setLoading(true);

    try {
      // Secure submission with required CPF and verified phone last 4 digits
      const url = `/public/my-registration/${validation.cleanCpf}?phoneLast4=${validation.cleanPhoneLast4}`;
      const data = await fetchApi(url);
      setResult(data);
    } catch (err: any) {
      if (
        err.status === 404 ||
        err.statusCode === 404 ||
        (err.message && err.message.toLowerCase().includes('not found'))
      ) {
        setError(`No registration found for CPF: ${cpf.trim().toUpperCase()}`);
      } else {
        setError(
          err.message ||
            'Security verification failed. Please verify your CPF number and phone last 4 digits.',
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="py-10 sm:py-14 bg-cream relative">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        {/* LOOKUP CARD */}
        <div className="max-w-xl mx-auto bg-white rounded-3xl p-6 sm:p-10 border border-gold/40 shadow-xl space-y-6 relative overflow-hidden">
          {/* TOP ACCENT LINE */}
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-maroon-deep via-gold to-maroon" />

          {/* HEADER ICON & TITLE */}
          <div className="text-center space-y-2 pt-2">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-maroon-soft text-maroon flex items-center justify-center border border-maroon/20 shadow-xs">
              <ShieldCheck className="w-7 h-7 text-maroon" />
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-maroon-soft text-maroon border border-maroon/20">
              <Users className="w-3 h-3" />
              <span>Official ONGC Personnel &amp; Family</span>
            </div>
            <h2 className="font-cinzel font-bold text-2xl text-ink">Employee Pass Retrieval</h2>
            <p className="text-xs sm:text-sm text-ink-soft">
              Enter your ONGC CPF Number and registered phone last 4 digits to securely access your official passes.
            </p>
          </div>

          {/* ERROR ALERT */}
          {error && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {/* SECURE CPF + PHONE LAST 4 FORM */}
          <form onSubmit={handleSearch} className="space-y-4">
            <div>
              <label
                htmlFor="employee_cpf"
                className="block text-xs font-bold text-ink-soft uppercase tracking-wider mb-2"
              >
                ONGC CPF Number <span className="text-maroon">*</span>
              </label>
              <div className="relative">
                <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  id="employee_cpf"
                  value={cpf}
                  onChange={(e) => setCpf(e.target.value)}
                  required
                  autoFocus
                  placeholder="e.g. 123456"
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-stone-50 border border-stone-200 text-ink font-mono font-bold text-base placeholder:font-sans placeholder:font-normal placeholder:text-stone-400 focus:bg-white focus:outline-none focus:border-maroon shadow-xs transition-colors uppercase"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="phoneLast4"
                className="block text-xs font-bold text-ink-soft uppercase tracking-wider mb-2"
              >
                Registered Phone Last 4 Digits <span className="text-maroon">*</span>
              </label>
              <PasswordInput
                id="phoneLast4"
                maxLength={4}
                required
                value={phoneLast4}
                onChange={(e) => setPhoneLast4(e.target.value.replace(/\D/g, ''))}
                placeholder="e.g. 3210"
                iconLeft={<Lock className="w-5 h-5" />}
                className="w-full py-3.5 rounded-xl bg-stone-50 border border-stone-200 text-ink font-mono text-base placeholder:font-sans placeholder:text-stone-400 focus:bg-white focus:outline-none focus:border-maroon shadow-xs transition-colors"
              />
              <p className="text-[11px] text-ink-soft mt-1.5">
                Both your CPF and the last 4 digits of your registered mobile number are required for verification.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-xl text-sm font-bold bg-maroon text-white hover:bg-maroon-dark transition-all duration-200 shadow-md border border-gold/40 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <Search className="w-4 h-4 text-gold-light" />
              <span>{loading ? 'VERIFYING CREDENTIALS...' : 'LOOKUP EMPLOYEE PASSES'}</span>
            </button>
          </form>

          {/* FOOTER LINK */}
          <div className="pt-4 border-t border-stone-100 text-center space-y-2">
            <p className="text-xs text-ink/70">Have not registered yet or need to update family?</p>
            <Link
              href="/employee/register"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-maroon hover:text-gold-dark transition-colors"
            >
              <span>Go to ONGC Employee Registration Portal</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* RESULTS SECTION: EMPLOYEE DETAILS & PASSES */}
        {result && (
          <div className="space-y-8 animate-fadeIn">
            {/* SUCCESS HEADER */}
            <div className="text-center max-w-xl mx-auto space-y-2">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 mb-2 shadow-inner border border-emerald-300">
                <CheckCircle2 className="w-9 h-9" />
              </div>

              <h2 className="font-cinzel font-bold text-3xl sm:text-4xl text-maroon drop-shadow-sm">
                Employee Passes Verified! 🎉
              </h2>

              <p className="font-outfit font-semibold text-lg text-gold-muted">
                Official EWC Ahmedabad passes for ONGC Navratri 2026.
              </p>

              <div className="bg-white rounded-2xl p-4 border border-gold/40 shadow-sm inline-flex flex-col sm:flex-row items-center gap-3 text-xs sm:text-sm text-ink-soft">
                <div className="flex items-center gap-2 font-bold text-emerald-700">
                  <Sparkles className="w-4 h-4 text-gold" />
                  <span>ONGC Verified Record</span>
                </div>
                <div className="hidden sm:block text-stone-300">&bull;</div>
                <div className="flex items-center gap-2 font-semibold text-maroon">
                  <Ticket className="w-4 h-4 text-gold" />
                  <span>{result.passes?.length || 0} Digital Passes Issued</span>
                </div>
              </div>

              <p className="text-xs text-ink-soft">
                Present individual QR code passes at the ONGC Ground entry gate for admission.
              </p>
            </div>

            {/* EMPLOYEE IDENTITY PROFILE CARD */}
            {result.employee && (
              <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gold/40 shadow-md space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-100">
                  <div className="space-y-1">
                    <div className="text-[11px] font-bold text-maroon uppercase tracking-wider flex items-center gap-1.5">
                      <IdCard className="w-3.5 h-3.5" />
                      <span>Primary ONGC Employee Identity</span>
                    </div>
                    <h3 className="font-cinzel font-bold text-2xl text-ink">
                      {result.employee.name}
                    </h3>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-maroon-soft text-maroon border border-maroon/20">
                      CPF: {result.employee.cpf}
                    </span>
                    {result.employee.employeeCategory && (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-gold/20 text-maroon-deep border border-gold/40">
                        {result.employee.employeeCategory}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div className="bg-stone-50 p-3.5 rounded-xl border border-stone-100">
                    <span className="text-stone-500 block text-[11px] font-medium mb-1 flex items-center gap-1">
                      <Briefcase className="w-3 h-3 text-stone-400" /> Designation
                    </span>
                    <span className="font-bold text-ink text-sm">
                      {result.employee.designation || 'ONGC Staff'}
                    </span>
                  </div>

                  <div className="bg-stone-50 p-3.5 rounded-xl border border-stone-100">
                    <span className="text-stone-500 block text-[11px] font-medium mb-1 flex items-center gap-1">
                      <Building2 className="w-3 h-3 text-stone-400" /> Department
                    </span>
                    <span className="font-bold text-ink text-sm">
                      {result.employee.department || 'Western Onshore Basin'}
                    </span>
                  </div>

                  <div className="bg-stone-50 p-3.5 rounded-xl border border-stone-100">
                    <span className="text-stone-500 block text-[11px] font-medium mb-1 flex items-center gap-1">
                      <UserCheck className="w-3 h-3 text-stone-400" /> Category
                    </span>
                    <span className="font-bold text-maroon text-sm">
                      {result.employee.employeeCategory || 'Regular Employee'}
                    </span>
                  </div>

                  <div className="bg-stone-50 p-3.5 rounded-xl border border-stone-100">
                    <span className="text-stone-500 block text-[11px] font-medium mb-1">
                      Contact Mobile
                    </span>
                    <span className="font-mono font-bold text-ink text-sm">
                      {result.employee.phone || 'Protected'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* PASSES SECTION */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-cinzel font-bold text-xl text-maroon flex items-center gap-2">
                  <Ticket className="w-5 h-5 text-gold" />
                  <span>Issued Entry Passes ({result.passes?.length || 0})</span>
                </h3>
                <span className="text-xs text-stone-500">
                  Individual passes with unique security tokens
                </span>
              </div>

              {result.passes?.map((pass: any, index: number) => {
                const isPrimary =
                  !pass.isFamily &&
                  (pass.relation === 'Primary Employee' ||
                    pass.relation === 'EMPLOYEE' ||
                    pass.relation === 'Self');
                const passDates = formatEmployeePassDates(pass.bookingDays);

                return (
                  <div
                    key={pass.attendeeId || pass.ticketNumber || index}
                    className="ticket-card bg-gradient-to-br from-[#5A0F21] via-[#7A1930] to-[#3D0714] text-white rounded-3xl p-6 sm:p-8 border-2 border-gold/60 shadow-2xl relative overflow-hidden"
                  >
                    {/* Rangoli Pattern & Glow Orbs */}
                    <div className="absolute inset-0 rangoli-pattern pointer-events-none" />
                    <div className="absolute -top-20 -right-20 w-56 h-56 rounded-full bg-gold/20 blur-2xl pointer-events-none" />
                    <div className="absolute -bottom-20 -left-20 w-56 h-56 rounded-full bg-saffron/20 blur-2xl pointer-events-none" />

                    {/* Side Circular Cutouts for Perforated Ticket Effect */}
                    <div className="absolute -left-3.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-cream border-r-2 border-gold/60 z-20" />
                    <div className="absolute -right-3.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-cream border-l-2 border-gold/60 z-20" />

                    <div className="relative z-10 flex flex-col justify-between">
                      {/* CARD HEADER */}
                      <div className="flex items-start justify-between gap-4 pb-4 border-b border-gold/30">
                        <div className="flex items-center gap-3">
                          <img
                            src="/images/logo-web.png"
                            alt="ONGC Logo"
                            className="h-10 sm:h-12 w-auto object-contain shrink-0 bg-white/95 p-1 rounded-xl border border-gold/50 shadow-md"
                          />
                          <div>
                            <div className="font-cinzel font-bold text-lg sm:text-xl text-gold tracking-wider">
                              NAVRATRI
                            </div>
                            <div className="text-[11px] font-semibold text-gold-light/80 uppercase tracking-widest">
                              EWC AHMEDABAD 2026
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-gold text-maroon-deep shadow-md">
                            <Award className="w-3.5 h-3.5" />
                            <span>
                              {isPrimary
                                ? 'ONGC STAFF'
                                : `FAMILY PASS (${pass.relation || 'Dependent'})`}
                            </span>
                          </span>
                        </div>
                      </div>

                      {/* PERSON DETAILS & QR CODE */}
                      <div className="py-6 flex flex-col sm:flex-row items-center justify-between gap-6">
                        <div className="space-y-4 text-center sm:text-left flex-1">
                          <div>
                            <div className="text-xs font-bold text-gold-light uppercase tracking-wider">
                              Pass Holder {pass.isFamily ? `(Family Member #${index})` : '(Primary Employee)'}
                            </div>
                            <h3 className="font-cinzel font-extrabold text-2xl sm:text-3xl text-white tracking-wide drop-shadow-md">
                              {pass.attendeeName || pass.name}
                            </h3>
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-xs bg-black/25 p-3.5 rounded-xl border border-gold/30 backdrop-blur-xs">
                            <div>
                              <span className="text-gold-light/70 text-[10px] block uppercase font-mono">
                                Ticket ID
                              </span>
                              <span className="font-mono font-bold text-gold text-sm">
                                {pass.ticketNumber || pass.ticket_id}
                              </span>
                            </div>
                            <div>
                              <span className="text-gold-light/70 text-[10px] block uppercase">
                                Relation / Role
                              </span>
                              <span className="font-semibold text-white">
                                {pass.relation || 'Employee'}
                              </span>
                            </div>
                            <div>
                              <span className="text-gold-light/70 text-[10px] block uppercase">
                                Venue
                              </span>
                              <span className="font-semibold text-white">
                                ONGC Ground, Chandkheda
                              </span>
                            </div>
                            <div>
                              <span className="text-gold-light/70 text-[10px] block uppercase">
                                Entry Gate
                              </span>
                              <span className="font-semibold text-white">
                                Staff / Family Gate
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* QR CODE BOX */}
                        <div className="shrink-0 flex flex-col items-center">
                          <div className="p-3 bg-white rounded-2xl shadow-xl border-2 border-gold/70">
                            {pass.qrSvg ? (
                              <div
                                className="w-40 h-40"
                                dangerouslySetInnerHTML={{ __html: pass.qrSvg }}
                              />
                            ) : (
                              <div className="w-40 h-40 flex flex-col items-center justify-center bg-stone-100 text-stone-700 font-mono text-xs rounded-xl p-2 text-center">
                                <Ticket className="w-8 h-8 text-maroon mb-1" />
                                <span>{pass.ticketNumber}</span>
                              </div>
                            )}
                          </div>
                          <span className="text-[10px] text-gold-light/80 font-mono mt-2 uppercase tracking-widest">
                            Scan at Entry Gate
                          </span>
                        </div>
                      </div>

                      {/* CARD FOOTER & ACTIONS */}
                      <div className="pt-4 border-t border-gold/30 flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div className="text-xs text-cream/70 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-gold" />
                          <span>Pass Booking Dates: </span>
                          <span className="text-gold font-bold">{passDates}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <Link
                            href={`/ticket/${pass.qrCodeToken || pass.ticketNumber}`}
                            className="px-4 py-2 rounded-xl bg-gold text-maroon-deep text-xs font-bold hover:bg-gold-light transition-colors shadow-sm inline-flex items-center gap-1.5"
                          >
                            <span>Open Dedicated Pass</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function EmployeeMyTicketsPage() {
  return (
    <Suspense
      fallback={
        <div className="py-24 text-center text-maroon font-bold">
          Loading Employee Ticket Portal...
        </div>
      }
    >
      <EmployeeTicketsContent />
    </Suspense>
  );
}

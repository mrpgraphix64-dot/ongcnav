'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Search,
  Ticket,
  AlertCircle,
  CheckCircle2,
  Printer,
  Share2,
  Award,
  Users,
  ShieldCheck,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import PublicHeader from '@/components/PublicHeader';
import PublicFooter from '@/components/PublicFooter';
import PageHero from '@/components/PageHero';
import { fetchApi } from '@/lib/api';

function MyTicketsContent() {
  const searchParams = useSearchParams();
  const initialCpf = searchParams.get('cpf') || '';

  const [cpf, setCpf] = useState(initialCpf);
  const [phoneLast4, setPhoneLast4] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setResult(null);

    const cleanCpf = cpf.trim().toUpperCase();
    if (!cleanCpf) {
      setError('Please enter your ONGC CPF number or Ticket ID');
      return;
    }

    setLoading(true);

    try {
      // First try CPF lookup
      const url = `/public/my-registration/${cleanCpf}${
        phoneLast4.trim() ? `?phoneLast4=${phoneLast4.trim()}` : ''
      }`;
      const data = await fetchApi(url);
      setResult(data);
    } catch (err: any) {
      // Fallback: try direct ticket token lookup if user entered a Ticket ID or token
      try {
        const ticketData = await fetchApi(`/public/ticket/${cleanCpf}`);
        if (ticketData) {
          setResult({
            employee: ticketData.employee,
            passes: [ticketData],
          });
          return;
        }
      } catch {
        // ignore
      }
      setError(err.message || 'No active passes found for this CPF or Ticket ID');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialCpf) {
      handleSearch();
    }
  }, [initialCpf]);

  return (
    <div className="py-12 sm:py-16 bg-cream relative">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        
        {/* LOOKUP CARD */}
        <div className="max-w-xl mx-auto bg-white rounded-3xl p-8 sm:p-10 border border-stone-200/90 shadow-xl space-y-7 relative overflow-hidden">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-maroon-soft text-maroon flex items-center justify-center border border-maroon/20 shadow-xs">
              <Ticket className="w-7 h-7 text-maroon" />
            </div>
            <h2 className="font-cinzel font-bold text-2xl text-ink">Attendee Pass Verification</h2>
            <p className="text-xs sm:text-sm text-ink-soft">
              Enter your ONGC CPF Number or Ticket ID (e.g. <span className="font-mono font-bold text-maroon">123456</span> or <span className="font-mono font-bold text-maroon">NR2026-000001</span>).
            </p>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSearch} className="space-y-4">
            <div>
              <label htmlFor="ticket_id" className="block text-xs font-bold text-ink-soft uppercase tracking-wider mb-2">
                Enter CPF No. or Ticket Reference
              </label>
              <div className="relative">
                <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  id="ticket_id"
                  value={cpf}
                  onChange={(e) => setCpf(e.target.value)}
                  required
                  autoFocus
                  placeholder="e.g. 123456"
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-stone-50 border border-stone-200 text-ink font-mono font-bold text-base placeholder:font-sans placeholder:font-normal placeholder:text-stone-400 focus:bg-white focus:outline-none focus:border-maroon shadow-xs transition-colors"
                />
              </div>
            </div>

            <div>
              <label htmlFor="phoneLast4" className="block text-xs font-bold text-ink-soft uppercase tracking-wider mb-2">
                Phone Number (Optional - Last 4 Digits)
              </label>
              <input
                type="password"
                id="phoneLast4"
                maxLength={4}
                value={phoneLast4}
                onChange={(e) => setPhoneLast4(e.target.value)}
                placeholder="e.g. 3210"
                className="w-full px-4 py-3 rounded-xl bg-stone-50 border border-stone-200 text-ink font-mono text-sm placeholder:font-sans placeholder:text-stone-400 focus:bg-white focus:outline-none focus:border-maroon shadow-xs transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-xl text-sm font-bold bg-maroon text-white hover:bg-maroon-dark transition-all duration-200 shadow-md border border-gold/40 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <Search className="w-4 h-4 text-gold-light" />
              <span>{loading ? 'LOOKING UP PASSES...' : 'LOOKUP PASS & QR CODE'}</span>
            </button>
          </form>

          <div className="pt-5 border-t border-stone-100 text-center space-y-3">
            <p className="text-xs text-ink/70">
              Have not registered yet?
            </p>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 text-xs font-bold text-maroon hover:text-gold-dark transition-colors"
            >
              <span>Register as an ONGC Employee & Family</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* RESULTS SECTION: REPRODUCING ewc_tickets.blade.php */}
        {result && (
          <div className="space-y-8 animate-fadeIn">
            
            {/* SUCCESS HEADER */}
            <div className="text-center max-w-xl mx-auto">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 mb-4 shadow-inner border border-emerald-300">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              
              <h2 className="font-cinzel font-bold text-3xl sm:text-4xl text-maroon mb-2 drop-shadow-sm">
                You're All Set! 🎉
              </h2>
              
              <p className="font-outfit font-semibold text-lg sm:text-xl text-gold-muted mb-4">
                Your EWC Ahmedabad passes are ready.
              </p>

              <div className="bg-white rounded-2xl p-4 border border-gold/40 shadow-sm inline-flex flex-col sm:flex-row items-center gap-3 text-xs sm:text-sm text-ink-soft">
                <div className="flex items-center gap-2 font-bold text-emerald-700">
                  <Sparkles className="w-4 h-4 text-gold" />
                  <span>Registration Complete</span>
                </div>
                <div className="hidden sm:block text-stone-300">&bull;</div>
                <div className="flex items-center gap-2 font-semibold text-maroon">
                  <Ticket className="w-4 h-4 text-gold" />
                  <span>{result.passes?.length || 0} Digital Passes Generated</span>
                </div>
              </div>

              <p className="text-xs text-ink-soft mt-3">
                Show these QR code passes at the ONGC Ground entry gate for instant access.
              </p>
            </div>

            {/* TICKETS CARDS */}
            <div className="space-y-6">
              {result.passes?.map((pass: any, index: number) => {
                const isEmployee = pass.relation === 'EMPLOYEE' || pass.relation === 'Self' || index === 0;
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
                            <span>{isEmployee ? 'ONGC STAFF' : 'FAMILY PASS'}</span>
                          </span>
                        </div>
                      </div>

                      {/* PERSON DETAILS & QR CODE */}
                      <div className="py-6 flex flex-col sm:flex-row items-center justify-between gap-6">
                        <div className="space-y-4 text-center sm:text-left">
                          <div>
                            <div className="text-xs font-bold text-gold-light uppercase tracking-wider">
                              Pass Holder
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
                                Category
                              </span>
                              <span className="font-semibold text-white">
                                {pass.relation || 'ONGC Staff / Family'}
                              </span>
                            </div>
                            <div>
                              <span className="text-gold-light/70 text-[10px] block uppercase">
                                Venue
                              </span>
                              <span className="font-semibold text-white">
                                ONGC Ground
                              </span>
                            </div>
                            <div>
                              <span className="text-gold-light/70 text-[10px] block uppercase">
                                Entry Gate
                              </span>
                              <span className="font-semibold text-white">
                                Main Gate
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
                                <span>{pass.ticketNumber || pass.ticket_id}</span>
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
                        <div className="text-xs text-cream/70">
                          <span>Event Dates: </span>
                          <span className="text-gold font-bold">11&ndash;19 October 2026</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <Link
                            href={`/ticket/${pass.qrCodeToken || pass.token || pass.ticketNumber}`}
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

export default function MyTicketsPage() {
  return (
    <div className="min-h-screen flex flex-col justify-between bg-cream text-ink selection:bg-maroon selection:text-white">
      <PublicHeader />
      <PageHero
        badge="TICKETS"
        title="CHECK YOUR TICKET"
        subtitle="Lookup, verify, or download your official ONGC Navratri digital QR pass."
        breadcrumb="Check Ticket"
      />
      <Suspense
        fallback={
          <div className="py-24 text-center text-maroon font-bold">
            Loading Ticket Portal...
          </div>
        }
      >
        <MyTicketsContent />
      </Suspense>
      <PublicFooter />
    </div>
  );
}

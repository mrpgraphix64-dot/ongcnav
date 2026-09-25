import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import PublicHeader from '@/components/PublicHeader';
import PublicFooter from '@/components/PublicFooter';
import PageHero from '@/components/PageHero';
import { QrCode, IdCard, Users, Clock, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Before You Arrive — Guidelines & Entry Process | ONGC Navratri 2026',
  description: 'Essential attendee information and entry instructions for ONGC Navratri 2026 — gate rules, QR code passes, parking, and security guidelines.',
};

export default function InformationPage() {
  return (
    <div className="min-h-screen flex flex-col bg-cream text-ink">
      <PublicHeader />

      <main className="flex-1">
        {/* PAGE HERO */}
        <PageHero
          badge="GUIDELINES"
          title="BEFORE YOU ARRIVE"
          subtitle="Essential guidelines, QR pass check-in procedures, and venue entry policies."
          breadcrumb="Before You Arrive"
        />

        {/* MAIN INFORMATION CONTENT */}
        <div className="py-16 sm:py-24 bg-cream relative">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">

            {/* QUICK CHECKLIST TILES */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="bg-white p-6 rounded-2xl border border-stone-200/90 shadow-xs space-y-2">
                <div className="w-10 h-10 rounded-xl bg-maroon-soft text-maroon flex items-center justify-center border border-maroon/20">
                  <QrCode className="w-5 h-5" />
                </div>
                <h3 className="font-cinzel font-bold text-sm text-maroon">1. Digital QR Pass</h3>
                <p className="text-xs text-ink/70 leading-relaxed">Save your QR pass on your phone with maximum screen brightness ready at the turnstile.</p>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-stone-200/90 shadow-xs space-y-2">
                <div className="w-10 h-10 rounded-xl bg-gold-soft text-amber-900 flex items-center justify-center border border-gold/40">
                  <IdCard className="w-5 h-5" />
                </div>
                <h3 className="font-cinzel font-bold text-sm text-maroon">2. ONGC / Photo ID</h3>
                <p className="text-xs text-ink/70 leading-relaxed">Employees are advised to carry their official ONGC identity card or government ID for verification.</p>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-stone-200/90 shadow-xs space-y-2">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center border border-emerald-200">
                  <Users className="w-5 h-5" />
                </div>
                <h3 className="font-cinzel font-bold text-sm text-maroon">3. Family Pass Grouping</h3>
                <p className="text-xs text-ink/70 leading-relaxed">Each family member must scan their respective QR pass for designated headcount recording.</p>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-stone-200/90 shadow-xs space-y-2">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-800 flex items-center justify-center border border-blue-200">
                  <Clock className="w-5 h-5" />
                </div>
                <h3 className="font-cinzel font-bold text-sm text-maroon">4. Early Arrival</h3>
                <p className="text-xs text-ink/70 leading-relaxed">Gates open 60 minutes before the evening Aarti to ensure smooth, queue-free security checks.</p>
              </div>
            </div>

            {/* DETAILED ENTRY GUIDELINES */}
            <div className="bg-white rounded-3xl p-8 sm:p-12 border border-stone-200 space-y-8 shadow-xs">
              <div className="space-y-2 pb-4 border-b border-stone-100">
                <span className="text-xs font-bold text-gold-muted uppercase tracking-widest">Entry &amp; Security Process</span>
                <h2 className="font-cinzel font-extrabold text-2xl sm:text-3xl text-maroon">Venue Check-In &amp; Gate Verification</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-xs sm:text-sm text-ink/80 leading-relaxed">
                <div className="space-y-4">
                  <h4 className="font-cinzel font-bold text-base text-ink flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>What to Carry</span>
                  </h4>
                  <ul className="space-y-2 pl-6 list-disc text-stone-600">
                    <li>Digital QR code pass on your mobile device (or printed paper pass).</li>
                    <li>Valid photo ID (ONGC identity card, Aadhaar, driving license).</li>
                    <li>Traditional Garba wooden dandiyas (if participating in Dandiya Raas circles).</li>
                    <li>Personal hydration flasks (purified refill water stations are provided on grounds).</li>
                  </ul>
                </div>

                <div className="space-y-4">
                  <h4 className="font-cinzel font-bold text-base text-ink flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                    <span>Prohibited Items &amp; Activities</span>
                  </h4>
                  <ul className="space-y-2 pl-6 list-disc text-stone-600">
                    <li>Strictly no tobacco, gutkha, smoking, or intoxicating substances on ONGC premises.</li>
                    <li>Sharp objects, metal sticks, weapons, or inflammable articles are forbidden.</li>
                    <li>Commercial video cameras, drones, or recording rigs without media accreditation.</li>
                    <li>Outside commercial fast-food or disposable plastic carry bags.</li>
                  </ul>
                </div>
              </div>

              {/* GATE ALLOCATION & PARKING */}
              <div className="pt-6 border-t border-stone-100 space-y-4">
                <h4 className="font-cinzel font-bold text-base text-maroon">Gate Allocation &amp; Parking Protocols</h4>
                <p className="text-xs sm:text-sm text-ink/75 leading-relaxed">
                  The venue operates dedicated entry channels:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div className="p-4 rounded-xl bg-cream-soft border border-stone-200 space-y-1">
                    <span className="font-bold text-maroon">Gate 1 (Main Entrance)</span>
                    <p className="text-ink/70">Primary attendee entry, EWC registrations, pedestrian access.</p>
                  </div>
                  <div className="p-4 rounded-xl bg-cream-soft border border-stone-200 space-y-1">
                    <span className="font-bold text-maroon">Gate 2 (Vehicular / VIP)</span>
                    <p className="text-ink/70">Designated vehicles with ONGC vehicle pass stickers.</p>
                  </div>
                  <div className="p-4 rounded-xl bg-cream-soft border border-stone-200 space-y-1">
                    <span className="font-bold text-maroon">Gate 3 (Staff / Service)</span>
                    <p className="text-ink/70">Performers, cultural troupes, technical crew, catering vendors.</p>
                  </div>
                </div>
              </div>

              {/* DRESS CODE ADVISORY */}
              <div className="p-6 rounded-2xl bg-gold/10 border border-gold/30 flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-gold/20 text-maroon flex items-center justify-center shrink-0">
                  ✦
                </div>
                <div className="space-y-1 text-xs sm:text-sm">
                  <h4 className="font-cinzel font-bold text-maroon">Traditional Dress Encouraged</h4>
                  <p className="text-ink/80 leading-relaxed">
                    Attendees are warmly encouraged to wear traditional Gujarati festive attire (Chaniya Choli, Kurta-Pajama, Kediya) to honor the cultural spirit of Navratri.
                  </p>
                </div>
              </div>
            </div>

            {/* ACTION BANNER */}
            <div className="spirit-festive-bg rounded-3xl p-8 sm:p-10 text-cream-light border-2 border-gold/40 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
              <div className="space-y-2">
                <h3 className="font-cinzel font-bold text-xl sm:text-2xl text-gold-light">Have you checked your pass status?</h3>
                <p className="text-xs sm:text-sm text-cream/80 max-w-lg">
                  Takes less than a minute. Verify your official entry pass status before arriving at the venue.
                </p>
              </div>
              <Link
                href="/my-tickets"
                className="px-6 py-3 rounded-xl text-xs font-bold bg-gold text-maroon-dark hover:bg-gold-light transition-all shadow-md shrink-0 flex items-center gap-2"
              >
                <span>CHECK TICKET STATUS</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

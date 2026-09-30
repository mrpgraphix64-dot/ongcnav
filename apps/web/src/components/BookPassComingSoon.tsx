import React from 'react';
import Link from 'next/link';
import { Sparkles, ArrowLeft, Ticket, Calendar, Music, ShieldCheck } from 'lucide-react';

export default function BookPassComingSoon() {
  return (
    <section
      data-testid="bookpass-coming-soon"
      className="py-12 sm:py-16 md:py-20 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto flex flex-col items-center justify-center text-center"
    >
      {/* Decorative Gold Rangoli / Border Card */}
      <div className="w-full bg-white/90 backdrop-blur-md rounded-3xl border border-gold/30 shadow-xl p-8 sm:p-12 relative overflow-hidden">
        {/* Subtle background ambient glow */}
        <div className="absolute -top-24 -left-24 w-64 h-64 rounded-full bg-saffron/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-64 h-64 rounded-full bg-gold/15 blur-3xl pointer-events-none" />

        {/* Brand Logo & Wordmark */}
        <div className="flex flex-col items-center justify-center mb-6">
          <div className="relative mb-3">
            <img
              src="/images/logo-web.png"
              alt="ONGC Navratri 2026"
              className="h-16 sm:h-20 w-auto object-contain mx-auto"
            />
          </div>
          <span className="font-cinzel font-bold text-base sm:text-lg text-maroon tracking-wider">
            ONGC NAVRATRI 2026
          </span>
          <span className="text-[11px] font-semibold text-gold-dark tracking-widest uppercase mt-0.5">
            Official Entry &amp; E-Pass Portal
          </span>
        </div>

        {/* Event Theme Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gold/15 border border-gold/40 text-maroon text-xs sm:text-sm font-bold mb-6">
          <Sparkles className="w-3.5 h-3.5 text-gold-dark shrink-0" />
          <span>Stay Tuned • Garba • Music • Celebration</span>
          <Sparkles className="w-3.5 h-3.5 text-gold-dark shrink-0" />
        </div>

        {/* Main Heading */}
        <h1 className="font-cinzel font-black text-2xl sm:text-3xl md:text-4xl text-maroon tracking-wide uppercase mb-4">
          Tickets Are Coming Soon
        </h1>

        <div className="h-0.5 w-20 bg-gradient-to-r from-transparent via-gold to-transparent mx-auto mb-6" />

        {/* Customer-Facing Narrative */}
        <div className="max-w-xl mx-auto space-y-3 text-stone-700 text-sm sm:text-base leading-relaxed">
          <p className="font-medium text-stone-800">
            We&apos;re getting everything ready for an unforgettable Navratri experience.
          </p>
          <p className="text-stone-600">
            ONGC Navratri 2026 is coming soon — stay tuned for ticket updates and booking announcements.
          </p>
          <p className="text-xs sm:text-sm text-gold-dark font-semibold italic">
            Tickets will be available soon.
          </p>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-xl mx-auto my-8 text-left">
          <div className="p-3.5 rounded-2xl bg-cream/80 border border-gold/25 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-maroon/10 text-maroon flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-maroon">9 Festive Nights</div>
              <div className="text-[11px] text-stone-500">11–19 October 2026</div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-cream/80 border border-gold/25 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gold/20 text-gold-dark flex items-center justify-center shrink-0">
              <Music className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-maroon">Garba &amp; Music</div>
              <div className="text-[11px] text-stone-500">Traditional Orchestra</div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-cream/80 border border-gold/25 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-maroon">Secure Access</div>
              <div className="text-[11px] text-stone-500">Fast Turnstile Check-in</div>
            </div>
          </div>
        </div>

        {/* Navigation & Action Links */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 max-w-md mx-auto">
          <Link
            href="/"
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-maroon hover:bg-maroon-dark text-white font-bold text-xs sm:text-sm transition-all shadow-md flex items-center justify-center gap-2 group cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-gold transition-transform group-hover:-translate-x-1" />
            <span>Return to Festival Home</span>
          </Link>

          <Link
            href="/my-tickets"
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-cream-soft hover:bg-gold/20 text-maroon border border-gold/30 font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Ticket className="w-4 h-4 text-gold-dark" />
            <span>View Existing Passes</span>
          </Link>
        </div>
      </div>
    </section>
  );
}

import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import PublicHeader from '@/components/PublicHeader';
import PublicFooter from '@/components/PublicFooter';
import PageHero from '@/components/PageHero';
import { Sparkles, ArrowRight, Users, Flame, Music, ShieldCheck, HeartHandshake, Ticket } from 'lucide-react';

export const metadata: Metadata = {
  title: 'About ONGC Navratri 2026 | Ahmedabad',
  description: 'Learn about ONGC Navratri 2026 — a grand celebration of culture, music, devotion, and community at ONGC Ground, Ahmedabad.',
};

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col bg-cream text-ink">
      <PublicHeader />

      <main className="flex-1">
        {/* PAGE HERO */}
        <PageHero
          badge="ABOUT"
          title="ABOUT ONGC NAVRATRI"
          subtitle="A grand celebration of culture, music, devotion and community."
          breadcrumb="About"
        />

        {/* MAIN ABOUT CONTENT */}
        <div className="py-16 sm:py-24 bg-cream relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-20">

            {/* INTRO STORY BLOCK */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              <div className="lg:col-span-7 space-y-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-maroon-soft text-maroon text-xs font-bold uppercase tracking-wider border border-maroon/20">
                  <Sparkles className="w-3.5 h-3.5 text-gold" />
                  <span>A Legacy of Festive Joy</span>
                </div>
                
                <h2 className="font-cinzel font-extrabold text-2xl sm:text-3xl lg:text-4xl text-maroon leading-tight">
                  Honouring Sacred Traditions, <br />Uniting Generations
                </h2>

                <p className="text-sm sm:text-base text-ink/80 leading-relaxed">
                  ONGC Navratri is celebrated as one of Ahmedabad’s most distinguished and culturally authentic festive gatherings. Organized under the stewardship of the ONGC Employee Welfare Committee (EWC), the event provides an immaculate, secure, and vibrant environment where traditions are preserved with reverence and celebrated with uninhibited joy.
                </p>

                <p className="text-sm sm:text-base text-ink/80 leading-relaxed">
                  Across nine auspicious nights, the expansive ONGC Ground transforms into an ocean of swirling festive colors, rhythmic clapping, and devotion. From traditional Gujarati folk tunes to the divine evening Aarti, every moment echoes the spirit of cultural pride and unity.
                </p>

                <div className="pt-2 flex flex-wrap gap-4">
                  <Link
                    href="/bookpass"
                    aria-label="Book your pass"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-bold bg-gold text-maroon-dark shadow-md hover:bg-gold-light transition-all border border-gold/40"
                  >
                    <Ticket className="w-4 h-4 text-maroon-dark" />
                    <span>BOOK YOUR PASS</span>
                  </Link>
                  <Link
                    href="/event"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-bold bg-maroon text-white shadow-md hover:bg-maroon-dark transition-all border border-gold/40"
                  >
                    <span>Explore Event Features</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>

              {/* HIGHLIGHT STAT CARD */}
              <div className="lg:col-span-5">
                <div className="spirit-festive-bg p-8 sm:p-10 rounded-3xl text-cream-light border-2 border-gold/50 shadow-2xl relative overflow-hidden text-center space-y-6">
                  <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-gold/15 rounded-full blur-2xl pointer-events-none" />
                  
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-white/10 border border-gold/40 flex items-center justify-center text-gold shadow-xs">
                    <Users className="w-7 h-7" />
                  </div>

                  <div>
                    <div className="font-cinzel font-extrabold text-4xl sm:text-5xl text-gold-light tracking-wide">2 LAKH+</div>
                    <div className="text-xs uppercase font-bold tracking-widest text-cream/70 mt-1">Expected Community Footfall</div>
                  </div>

                  <p className="text-xs text-cream/80 leading-relaxed">
                    Welcoming employees, families, guests, and patrons for 9 unforgettable nights of dance, divine fellowship, and cultural pride.
                  </p>

                  <div className="grid grid-cols-2 gap-3 pt-2 text-left">
                    <div className="p-3 rounded-xl bg-white/5 border border-gold/20">
                      <div className="text-lg font-bold font-outfit text-gold">9 Nights</div>
                      <div className="text-[11px] text-cream/70">Non-Stop Garba</div>
                    </div>
                    <div className="p-3 rounded-xl bg-white/5 border border-gold/20">
                      <div className="text-lg font-bold font-outfit text-gold">100% Safe</div>
                      <div className="text-[11px] text-cream/70">QR Pass Security</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 4 CORE PILLARS OF CELEBRATION */}
            <div className="space-y-10">
              <div className="text-center max-w-2xl mx-auto space-y-3">
                <div className="text-xs font-bold text-maroon uppercase tracking-widest">What Makes Us Special</div>
                <h3 className="font-cinzel font-extrabold text-2xl sm:text-3xl text-ink">The Pillars of ONGC Navratri</h3>
                <div className="w-16 h-0.5 bg-gold mx-auto" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Pillar 1 */}
                <div className="bg-white p-7 rounded-2xl border border-stone-200/80 shadow-xs hover:shadow-md transition-all space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-maroon-soft text-maroon flex items-center justify-center border border-maroon/20">
                    <Flame className="w-6 h-6" />
                  </div>
                  <h4 className="font-cinzel font-bold text-base text-maroon">Authentic Tradition</h4>
                  <p className="text-xs text-ink/70 leading-relaxed">
                    True folk Raas Garba steps and sacred prayers honoring the Goddess, retaining pure cultural roots without commercial dilution.
                  </p>
                </div>

                {/* Pillar 2 */}
                <div className="bg-white p-7 rounded-2xl border border-stone-200/80 shadow-xs hover:shadow-md transition-all space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-gold-soft text-amber-900 flex items-center justify-center border border-gold/40">
                    <Music className="w-6 h-6" />
                  </div>
                  <h4 className="font-cinzel font-bold text-base text-maroon">Live Folk Rhythms</h4>
                  <p className="text-xs text-ink/70 leading-relaxed">
                    Renowned traditional vocalists, live dholaks, acoustics, and percussionists that breathe soul into every Garba circle.
                  </p>
                </div>

                {/* Pillar 3 */}
                <div className="bg-white p-7 rounded-2xl border border-stone-200/80 shadow-xs hover:shadow-md transition-all space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center border border-emerald-200">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <h4 className="font-cinzel font-bold text-base text-maroon">Secure & Family-First</h4>
                  <p className="text-xs text-ink/70 leading-relaxed">
                    Gated perimeter, contactless QR code check-in, dedicated volunteer desks, and full CCTV surveillance ensuring safety for all.
                  </p>
                </div>

                {/* Pillar 4 */}
                <div className="bg-white p-7 rounded-2xl border border-stone-200/80 shadow-xs hover:shadow-md transition-all space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-800 flex items-center justify-center border border-purple-200">
                    <HeartHandshake className="w-6 h-6" />
                  </div>
                  <h4 className="font-cinzel font-bold text-base text-maroon">Community Harmony</h4>
                  <p className="text-xs text-ink/70 leading-relaxed">
                    A festive meeting ground where ONGC colleagues, families, elders, and young children dance together as one united family.
                  </p>
                </div>
              </div>
            </div>

            {/* COMMUNITY & HERITAGE SECTION */}
            <div className="bg-cream-soft rounded-3xl p-8 sm:p-12 border border-gold/30 space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <span className="text-xs font-bold text-gold-muted uppercase tracking-widest">ONGC Welfare & Cultural Commitment</span>
                  <h3 className="font-cinzel font-extrabold text-2xl sm:text-3xl text-maroon">Empowering Unity Through Festive Spirit</h3>
                  <p className="text-sm text-ink/80 leading-relaxed">
                    As India&apos;s leading energy enterprise, ONGC believes our true energy stems from our people and the rich cultural fabric of our nation. ONGC Navratri is our heartfelt tribute to Gujarat&apos;s timeless festive heritage and our promise to foster bonding and camaraderie beyond office walls.
                  </p>
                  <p className="text-sm text-ink/80 leading-relaxed">
                    We extend our warm invitation to all ONGCians, staff members, and their loved ones to grace the grounds and create everlasting memories.
                  </p>
                </div>

                <div className="bg-white p-6 sm:p-8 rounded-2xl border border-stone-200 shadow-sm space-y-4 text-center">
                  <div className="w-12 h-12 mx-auto rounded-full bg-gold/20 text-maroon flex items-center justify-center">
                    <Ticket className="w-6 h-6" />
                  </div>
                  <h4 className="font-cinzel font-bold text-lg text-ink">Join The Celebration</h4>
                  <p className="text-xs text-ink-soft max-w-sm mx-auto">
                    Ensure a seamless entry for you and your family members by verifying your official digital pass in advance.
                  </p>
                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                    <Link
                      href="/bookpass"
                      aria-label="Book your pass"
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-bold bg-gold text-maroon-dark hover:bg-gold-light transition-colors shadow-md border border-gold/40"
                    >
                      <Ticket className="w-4 h-4 text-maroon-dark" />
                      <span>BOOK YOUR PASS</span>
                    </Link>
                    <Link
                      href="/my-tickets"
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-bold bg-maroon text-white hover:bg-maroon-dark transition-colors shadow-md border border-gold/40"
                    >
                      <span>Check Ticket Status</span>
                    </Link>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

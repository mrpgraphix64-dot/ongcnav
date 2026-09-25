import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import PublicHeader from '@/components/PublicHeader';
import PublicFooter from '@/components/PublicFooter';
import PageHero from '@/components/PageHero';
import {
  CircleDot,
  Music2,
  Flame,
  UsersRound,
  Coffee,
  Sparkles,
  Sparkle,
  ScanLine,
  Shield,
  Droplet,
  Cross,
  Car,
  HelpCircle,
  Search,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'The Event & Experiences | ONGC Navratri 2026',
  description: 'Explore the highlights of ONGC Navratri 2026 — Garba circles, live folk music, cultural attire, festive food stalls, and venue experiences.',
};

export default function EventPage() {
  return (
    <div className="min-h-screen flex flex-col bg-cream text-ink">
      <PublicHeader />

      <main className="flex-1">
        {/* PAGE HERO */}
        <PageHero
          badge="EVENT"
          title="THE EVENT"
          subtitle="Nine nights of celebration, rhythm, devotion and togetherness."
          breadcrumb="The Event"
        />

        {/* MAIN EVENT CONTENT */}
        <div className="py-16 sm:py-24 bg-cream relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-20">

            {/* EVENT OVERVIEW SECTION */}
            <div className="text-center max-w-3xl mx-auto space-y-4">
              <span className="text-xs font-bold text-maroon uppercase tracking-widest">Grandeur in Motion</span>
              <h2 className="font-cinzel font-extrabold text-3xl sm:text-4xl text-ink">An Unrivaled Festive Spectacle</h2>
              <div className="w-20 h-0.5 bg-gold mx-auto" />
              <p className="text-sm sm:text-base text-ink/80 leading-relaxed pt-2">
                ONGC Navratri brings together the timeless splendor of Gujarati heritage with world-class venue hospitality. Every evening unfolds an immersive journey of foot-tapping rhythms, ceremonial devotion, and warm community bonding.
              </p>
            </div>

            {/* 6 SPOTLIGHT FEATURES */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              
              {/* FEATURE 1: GARBA */}
              <div className="bg-white rounded-3xl p-8 border border-stone-200/90 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-maroon-soft text-maroon flex items-center justify-center border border-maroon/20 shadow-xs">
                    <CircleDot className="w-7 h-7" />
                  </div>
                  <h3 className="font-cinzel font-bold text-xl text-maroon">Garba Raas Circles</h3>
                  <p className="text-xs sm:text-sm text-ink/75 leading-relaxed">
                    Experience the energy of concentric Garba rings swirling in unison. From traditional two-clap and three-clap movements to intricate Dandiya steps, revel in rhythmic harmony that continues through the midnight hours.
                  </p>
                </div>
                <div className="pt-4 border-t border-stone-100 flex items-center justify-between text-xs font-semibold text-gold-dark">
                  <span>Concentric Circles &bull; Traditional Raas</span>
                  <Sparkle className="w-4 h-4 text-gold" />
                </div>
              </div>

              {/* FEATURE 2: MUSIC */}
              <div className="bg-white rounded-3xl p-8 border border-stone-200/90 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-gold-soft text-amber-900 flex items-center justify-center border border-gold/40 shadow-xs">
                    <Music2 className="w-7 h-7" />
                  </div>
                  <h3 className="font-cinzel font-bold text-xl text-maroon">Live Folk Orchestra</h3>
                  <p className="text-xs sm:text-sm text-ink/75 leading-relaxed">
                    Resonant beats of authentic Gujarati Dhols, harmonium melodies, dholaks, and shehnais performed live by distinguished cultural vocalists and acoustic musicians, keeping the spirit soaring all night.
                  </p>
                </div>
                <div className="pt-4 border-t border-stone-100 flex items-center justify-between text-xs font-semibold text-gold-dark">
                  <span>Acoustic Dholaks &bull; Folk Singers</span>
                  <Sparkle className="w-4 h-4 text-gold" />
                </div>
              </div>

              {/* FEATURE 3: CULTURE */}
              <div className="bg-white rounded-3xl p-8 border border-stone-200/90 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-red-50 text-maroon flex items-center justify-center border border-red-200 shadow-xs">
                    <Flame className="w-7 h-7" />
                  </div>
                  <h3 className="font-cinzel font-bold text-xl text-maroon">Culture & Sacred Aarti</h3>
                  <p className="text-xs sm:text-sm text-ink/75 leading-relaxed">
                    The evening commences with solemn Aarti prayers honoring Goddess Ambe, adorned with brass lamps and traditional incense. Admire the kaleidoscope of hand-embroidered Chaniya Cholis and Kediyus.
                  </p>
                </div>
                <div className="pt-4 border-t border-stone-100 flex items-center justify-between text-xs font-semibold text-gold-dark">
                  <span>Divine Aarti &bull; Traditional Attire</span>
                  <Sparkle className="w-4 h-4 text-gold" />
                </div>
              </div>

              {/* FEATURE 4: COMMUNITY */}
              <div className="bg-white rounded-3xl p-8 border border-stone-200/90 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-800 flex items-center justify-center border border-emerald-200 shadow-xs">
                    <UsersRound className="w-7 h-7" />
                  </div>
                  <h3 className="font-cinzel font-bold text-xl text-maroon">One United Community</h3>
                  <p className="text-xs sm:text-sm text-ink/75 leading-relaxed">
                    A cherished annual reunion uniting colleagues, families, seniors, and children. Dedicated family enclosures and comfortable seating guarantee an enriching experience for all age groups.
                  </p>
                </div>
                <div className="pt-4 border-t border-stone-100 flex items-center justify-between text-xs font-semibold text-gold-dark">
                  <span>Family Seating &bull; Safe Atmosphere</span>
                  <Sparkle className="w-4 h-4 text-gold" />
                </div>
              </div>

              {/* FEATURE 5: FOOD & REFRESHMENTS */}
              <div className="bg-white rounded-3xl p-8 border border-stone-200/90 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-800 flex items-center justify-center border border-amber-200 shadow-xs">
                    <Coffee className="w-7 h-7" />
                  </div>
                  <h3 className="font-cinzel font-bold text-xl text-maroon">Culinary Pavilions</h3>
                  <p className="text-xs sm:text-sm text-ink/75 leading-relaxed">
                    Savor authentic Gujarati festive savories, fresh Fafda-Jalebi, fasting specials, herbal beverages, and healthy refreshments curated by vetted culinary partners in sanitized food zones.
                  </p>
                </div>
                <div className="pt-4 border-t border-stone-100 flex items-center justify-between text-xs font-semibold text-gold-dark">
                  <span>Hygienic Stalls &bull; Pure Vegetarian</span>
                  <Sparkle className="w-4 h-4 text-gold" />
                </div>
              </div>

              {/* FEATURE 6: VENUE EXPERIENCE */}
              <div className="bg-white rounded-3xl p-8 border border-stone-200/90 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-800 flex items-center justify-center border border-blue-200 shadow-xs">
                    <Sparkles className="w-7 h-7" />
                  </div>
                  <h3 className="font-cinzel font-bold text-xl text-maroon">Royal Stage & Lighting</h3>
                  <p className="text-xs sm:text-sm text-ink/75 leading-relaxed">
                    Illuminated pavilions, high-grade acoustic line arrays, warm amber floodlighting, and soft ambient stage decorations framing the festive dance floor with elegance.
                  </p>
                </div>
                <div className="pt-4 border-t border-stone-100 flex items-center justify-between text-xs font-semibold text-gold-dark">
                  <span>Acoustic Audio &bull; Royal Lighting</span>
                  <Sparkle className="w-4 h-4 text-gold" />
                </div>
              </div>

            </div>

            {/* VENUE AMENITIES & FACILITIES GRID */}
            <div className="bg-cream-soft rounded-3xl p-8 sm:p-12 border border-gold/30 space-y-8">
              <div className="max-w-2xl space-y-3">
                <span className="text-xs font-bold text-gold-muted uppercase tracking-widest">Attendee Convenience</span>
                <h3 className="font-cinzel font-extrabold text-2xl sm:text-3xl text-maroon">Venue Amenities & Facilities</h3>
                <p className="text-xs sm:text-sm text-ink/70">Designed to ensure every attendee enjoys the festivities with complete peace of mind.</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-center">
                <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs space-y-2">
                  <ScanLine className="w-6 h-6 text-maroon mx-auto" />
                  <div className="font-semibold text-xs text-ink">QR Entry Gates</div>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs space-y-2">
                  <Shield className="w-6 h-6 text-maroon mx-auto" />
                  <div className="font-semibold text-xs text-ink">24/7 Security</div>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs space-y-2">
                  <Droplet className="w-6 h-6 text-maroon mx-auto" />
                  <div className="font-semibold text-xs text-ink">Purified Water</div>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs space-y-2">
                  <Cross className="w-6 h-6 text-maroon mx-auto" />
                  <div className="font-semibold text-xs text-ink">Medical First Aid</div>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs space-y-2">
                  <Car className="w-6 h-6 text-maroon mx-auto" />
                  <div className="font-semibold text-xs text-ink">Designated Parking</div>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs space-y-2">
                  <HelpCircle className="w-6 h-6 text-maroon mx-auto" />
                  <div className="font-semibold text-xs text-ink">Support Desks</div>
                </div>
              </div>
            </div>

            {/* IMPORTANT GUIDELINES BANNER */}
            <div className="spirit-festive-bg rounded-3xl p-8 sm:p-12 text-cream-light border-2 border-gold/40 shadow-xl flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="space-y-3 max-w-xl text-center md:text-left">
                <span className="text-xs font-bold text-gold uppercase tracking-widest">Entry Guidelines</span>
                <h3 className="font-cinzel font-bold text-2xl sm:text-3xl text-gold-light">Ready to join the Garba circles?</h3>
                <p className="text-xs sm:text-sm text-cream/80 leading-relaxed">
                  Entry to the ONGC Ground is strictly governed by authorized digital passes. Check your ticket status or review entry guidelines before you arrive.
                </p>
              </div>
              <div className="shrink-0 flex flex-col sm:flex-row gap-3.5">
                <Link
                  href="/my-tickets"
                  className="px-7 py-3.5 rounded-xl text-xs font-bold bg-gold text-maroon-dark hover:bg-gold-light transition-all shadow-md flex items-center justify-center gap-2"
                >
                  <Search className="w-4 h-4" />
                  <span>CHECK TICKET STATUS</span>
                </Link>
                <Link
                  href="/information"
                  className="px-5 py-3.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-cream border border-gold/40 transition-all text-center"
                >
                  Before You Arrive
                </Link>
              </div>
            </div>

          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

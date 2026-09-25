import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import PublicHeader from '@/components/PublicHeader';
import PublicFooter from '@/components/PublicFooter';
import PageHero from '@/components/PageHero';
import { Clock, Calendar, Search } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Event Schedule & Timings | ONGC Navratri 2026',
  description: 'Official event schedule and daily programme timings for ONGC Navratri 2026 at ONGC Ground, Ahmedabad.',
};

const dailySchedule = [
  {
    time_badge_top: '12:00',
    time_badge_bottom: 'PM',
    time: '12:00 PM — 4:00 PM',
    title: 'GARBA MANDLI GARBA',
    desc: 'Traditional Garba celebration continues through the afternoon.',
    tag: 'DAILY PROGRAMME',
  },
  {
    time_badge_top: '07:00',
    time_badge_bottom: 'PM',
    time: '07:00 PM — 08:00 PM',
    title: 'DURGA MAHA AARTI & CEREMONY',
    desc: 'Sacred evening lamp lighting and prayers ushering in the night of celebration.',
    tag: 'EVENING CEREMONY',
  },
  {
    time_badge_top: '08:00',
    time_badge_bottom: 'PM',
    time: '08:00 PM — 11:30 PM',
    title: 'MAHA RAAS GARBA CELEBRATION',
    desc: 'Grand Raas Garba circles featuring live traditional orchestra and folk artists.',
    tag: 'MAIN CELEBRATION',
  },
];

const nineNights = [
  { day: 'Night 1', date: '11 OCT 2026', title: 'Prarambh & Garba Raas', desc: 'Grand opening night with traditional Aarti and energetic Garba.' },
  { day: 'Night 2', date: '12 OCT 2026', title: 'Dandiya Fusion Night', desc: 'Rhythmic Dandiya performance with live acoustic orchestra.' },
  { day: 'Night 3', date: '13 OCT 2026', title: 'Traditional Raas Garba', desc: 'Authentic Folk Garba rhythms celebrating Gujarati heritage.' },
  { day: 'Night 4', date: '14 OCT 2026', title: 'Cultural Symphony', desc: 'Special musical ensemble featuring classical instrumentalists.' },
  { day: 'Night 5', date: '15 OCT 2026', title: 'Maha Garba Celebration', desc: 'Mid-festive grand Garba circle with high-energy rhythms.' },
  { day: 'Night 6', date: '16 OCT 2026', title: 'Royal Heritage Night', desc: 'Traditional attire showcase & ethnic dance performances.' },
  { day: 'Night 7', date: '17 OCT 2026', title: 'Rhythm & Beats Night', desc: 'Vibrant percussion beats and non-stop Garba circles.' },
  { day: 'Night 8', date: '18 OCT 2026', title: 'Durgashtami Special', desc: 'Auspicious Ashtami Mahapooja followed by festive Garba.' },
  { day: 'Night 9', date: '19 OCT 2026', title: 'Maha Aarti & Finale', desc: 'Grand concluding night with 1000-lamp Maha Aarti & celebration.' },
];

export default function SchedulePage() {
  return (
    <div className="min-h-screen flex flex-col bg-cream text-ink">
      <PublicHeader />

      <main className="flex-1">
        {/* PAGE HERO */}
        <PageHero
          badge="SCHEDULE"
          title="EVENT SCHEDULE"
          subtitle="Plan your celebration with our daily programmes and 9-night calendar."
          breadcrumb="Schedule"
        />

        {/* MAIN SCHEDULE CONTENT */}
        <div className="py-16 sm:py-24 bg-cream relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">

            {/* DAILY PROGRAMME HIGHLIGHT (FEATURED TIMELINE) */}
            <div className="space-y-8">
              <div className="text-center max-w-2xl mx-auto space-y-3">
                <span className="text-xs font-bold text-maroon uppercase tracking-widest">Daily Schedule</span>
                <h2 className="font-cinzel font-extrabold text-2xl sm:text-3xl lg:text-4xl text-ink">Daily Programme Timings</h2>
                <div className="w-16 h-0.5 bg-gold mx-auto" />
                <p className="text-xs sm:text-sm text-ink/70">Regular schedule observed across all festive days during ONGC Navratri 2026.</p>
              </div>

              {/* TIMELINE CARDS */}
              <div className="max-w-3xl mx-auto space-y-4">
                {dailySchedule.map((item, index) => (
                  <div
                    key={index}
                    className="bg-white rounded-2xl p-6 sm:p-7 border border-stone-200/90 shadow-xs hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-7 relative overflow-hidden group"
                  >
                    {/* Time Badge */}
                    <div className="w-24 h-24 rounded-2xl bg-maroon-soft text-maroon border border-maroon/20 flex flex-col items-center justify-center shrink-0 group-hover:bg-maroon group-hover:text-white transition-colors duration-300">
                      <span className="font-cinzel font-bold text-2xl leading-none">{item.time_badge_top}</span>
                      <span className="text-[11px] font-extrabold tracking-wider uppercase mt-0.5">{item.time_badge_bottom}</span>
                    </div>

                    {/* Details */}
                    <div className="flex-1 space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider uppercase bg-gold/20 text-amber-900 border border-gold/40">
                          <Clock className="w-3 h-3 text-gold" />
                          {item.tag}
                        </span>
                        <span className="text-xs font-semibold text-ink-soft">{item.time}</span>
                      </div>
                      
                      <h3 className="font-cinzel font-bold text-lg sm:text-xl text-maroon group-hover:text-gold-dark transition-colors">
                        {item.title}
                      </h3>

                      <p className="text-xs sm:text-sm text-ink/75 leading-relaxed">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 9-NIGHT CELEBRATION CALENDAR */}
            <div className="space-y-8 pt-8 border-t border-stone-200/80">
              <div className="text-center max-w-2xl mx-auto space-y-3">
                <span className="text-xs font-bold text-gold-muted uppercase tracking-widest">9 Auspicious Nights</span>
                <h2 className="font-cinzel font-extrabold text-2xl sm:text-3xl text-ink">Nine Nights of Celebration</h2>
                <div className="w-16 h-0.5 bg-gold mx-auto" />
                <p className="text-xs sm:text-sm text-ink/70">From Prarambh to the Grand Maha Aarti Finale on Durgashtami.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {nineNights.map((night, idx) => (
                  <div
                    key={idx}
                    className="bg-white rounded-2xl p-6 border border-stone-200 shadow-xs hover:border-gold/60 hover:shadow-md transition-all space-y-3 flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold font-mono uppercase bg-maroon text-white">
                          {night.day}
                        </span>
                        <span className="text-xs font-semibold text-gold-muted flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {night.date}
                        </span>
                      </div>
                      <h3 className="font-cinzel font-bold text-base text-ink pt-1">{night.title}</h3>
                      <p className="text-xs text-ink/70 leading-relaxed">{night.desc}</p>
                    </div>

                    <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-[11px] text-ink-soft">
                      <span>ONGC Ground &bull; 7:00 PM</span>
                      <span className="text-emerald-700 font-semibold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Confirmed
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* TICKET LOOKUP CTA BOX */}
            <div className="spirit-festive-bg rounded-3xl p-8 sm:p-10 text-cream-light border-2 border-gold/40 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
              <div className="space-y-2">
                <h3 className="font-cinzel font-bold text-xl sm:text-2xl text-gold-light">Plan your attendance with valid passes</h3>
                <p className="text-xs sm:text-sm text-cream/80 max-w-lg">
                  Check your digital ticket pass status in advance to ensure rapid, hassle-free entry through the express gates.
                </p>
              </div>
              <Link
                href="/my-tickets"
                className="px-6 py-3 rounded-xl text-xs font-bold bg-gold text-maroon-dark hover:bg-gold-light transition-all shadow-md shrink-0 flex items-center gap-2"
              >
                <Search className="w-4 h-4" />
                <span>CHECK TICKET STATUS</span>
              </Link>
            </div>

          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

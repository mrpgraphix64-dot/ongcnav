import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import PublicHeader from '@/components/PublicHeader';
import PublicFooter from '@/components/PublicFooter';
import PageHero from '@/components/PageHero';
import { MapPin, Navigation, Headphones, ShieldCheck, Clock, CheckCircle } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Get in Touch & Venue | ONGC Navratri 2026',
  description: 'Contact the ONGC Navratri 2026 organizing team. Venue details, support desk hours, and event assistance at Malaviya Cricket Ground ONGC, Ahmedabad.',
};

export default function ContactPage() {
  return (
    <div className="min-h-screen flex flex-col bg-cream text-ink">
      <PublicHeader />

      <main className="flex-1">
        {/* PAGE HERO */}
        <PageHero
          badge="CONTACT"
          title="GET IN TOUCH"
          subtitle="We are here to assist you with passes, entry directions, and event support."
          breadcrumb="Contact"
        />

        {/* MAIN CONTACT CONTENT */}
        <div className="py-16 sm:py-24 bg-cream relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">

            {/* CONTACT CARDS GRID */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              
              {/* VENUE LOCATION CARD */}
              <div className="bg-white rounded-3xl p-8 border border-stone-200 shadow-sm space-y-5 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-maroon-soft text-maroon flex items-center justify-center border border-maroon/20 shadow-xs">
                    <MapPin className="w-7 h-7" />
                  </div>
                  <h3 className="font-cinzel font-bold text-xl text-maroon">Celebration Venue</h3>
                  <div className="text-xs sm:text-sm text-ink/80 space-y-1 leading-relaxed">
                    <p className="font-semibold text-ink">Malaviya Cricket Ground ONGC</p>
                    <p>4H3Q+7F8, Mahavirnagar, ONGC Colony,</p>
                    <p>Chandkheda, Ahmedabad, Gujarat 382424</p>
                  </div>
                </div>
                <div className="pt-4 border-t border-stone-100 text-xs text-gold-dark font-medium flex items-center gap-1.5">
                  <Navigation className="w-3.5 h-3.5 text-gold" />
                  <span>ONGC Colony, Chandkheda, Ahmedabad</span>
                </div>
              </div>

              {/* SUPPORT DESK CARD */}
              <div className="bg-white rounded-3xl p-8 border border-stone-200 shadow-sm space-y-5 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-gold-soft text-amber-900 flex items-center justify-center border border-gold/40 shadow-xs">
                    <Headphones className="w-7 h-7" />
                  </div>
                  <h3 className="font-cinzel font-bold text-xl text-maroon">Organizing Help Desk</h3>
                  <div className="text-xs sm:text-sm text-ink/80 space-y-2 leading-relaxed">
                    <div>
                      <span className="font-semibold text-ink block sm:inline">Contact Numbers: </span>
                      <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 font-semibold text-maroon">
                        <a href="tel:9898085701" className="hover:underline">9898085701</a>
                        <span className="text-stone-300">|</span>
                        <a href="tel:8000088813" className="hover:underline">8000088813</a>
                        <span className="text-stone-300">|</span>
                        <a href="tel:8980004518" className="hover:underline">8980004518</a>
                      </span>
                    </div>
                    <p><strong className="text-ink">Email:</strong> <a href="mailto:ongcnavratri@gmail.com" className="text-maroon font-semibold hover:underline">ongcnavratri@gmail.com</a></p>
                    <p><strong className="text-ink">On-Ground:</strong> Help booths at Main Gate &amp; Stage Side</p>
                  </div>
                </div>
                <div className="pt-4 border-t border-stone-100 text-xs text-gold-dark font-medium flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-gold" />
                  <span>Dedicated Volunteer Teams</span>
                </div>
              </div>

              {/* OPERATING HOURS CARD */}
              <div className="bg-white rounded-3xl p-8 border border-stone-200 shadow-sm space-y-5 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-800 flex items-center justify-center border border-emerald-200 shadow-xs">
                    <Clock className="w-7 h-7" />
                  </div>
                  <h3 className="font-cinzel font-bold text-xl text-maroon">Event &amp; Support Hours</h3>
                  <div className="text-xs sm:text-sm text-ink/80 space-y-1 leading-relaxed">
                    <p><strong className="text-ink">Festive Dates:</strong> 11 October – 19 October 2026</p>
                    <p><strong className="text-ink">General Garba:</strong> 08:00 PM – 12:00 AM</p>
                    <p><strong className="text-ink">Mandli Garba:</strong> 12:00 AM – 04:00 AM</p>
                  </div>
                </div>
                <div className="pt-4 border-t border-stone-100 text-xs text-gold-dark font-medium flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Gates open 60 mins prior</span>
                </div>
              </div>

            </div>

            {/* VENUE DIRECTIONS & MAP PLACEHOLDER */}
            <div className="bg-white rounded-3xl p-8 sm:p-10 border border-stone-200/90 shadow-sm space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div className="space-y-2">
                  <span className="text-xs font-bold text-gold-muted uppercase tracking-widest">Venue Directions</span>
                  <h3 className="font-cinzel font-bold text-2xl text-maroon">Reaching Malaviya Cricket Ground ONGC</h3>
                  <p className="text-xs sm:text-sm text-ink/75 leading-relaxed max-w-2xl">
                    The venue is situated at 4H3Q+7F8, Mahavirnagar, ONGC Colony, Chandkheda, Ahmedabad, Gujarat 382424. Follow the official ONGC Navratri directional boards positioned at key junctions and approach roads.
                  </p>
                </div>
                <a
                  href="https://www.google.com/maps/search/?api=1&query=4H3Q%2B7F8+Mahavirnagar+ONGC+Colony+Chandkheda+Ahmedabad+Gujarat+382424"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-maroon text-white hover:bg-maroon-dark transition-all shadow-xs shrink-0 self-start sm:self-auto"
                >
                  <Navigation className="w-4 h-4 text-gold" />
                  <span>View on Google Maps</span>
                </a>
              </div>

              {/* Google Maps Direction Embed Frame */}
              <div className="rounded-2xl overflow-hidden border border-stone-200 shadow-xs aspect-21/9 min-h-[300px] bg-stone-100 flex items-center justify-center relative">
                <iframe
                  title="Malaviya Cricket Ground ONGC Map"
                  className="w-full h-full border-0 min-h-[350px]"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  src="https://maps.google.com/maps?q=4H3Q%2B7F8,+Mahavirnagar,+ONGC+Colony,+Chandkheda,+Ahmedabad,+Gujarat+382424&t=&z=16&ie=UTF8&iwloc=&output=embed"
                />
              </div>
            </div>

            {/* QUICK LINKS SECTION */}
            <div className="spirit-festive-bg rounded-3xl p-8 sm:p-10 text-cream-light border-2 border-gold/40 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
              <div className="space-y-2">
                <h3 className="font-cinzel font-bold text-xl sm:text-2xl text-gold-light">Need to find your entry pass?</h3>
                <p className="text-xs sm:text-sm text-cream/80 max-w-lg">
                  You can quickly check your ticket status or re-download your QR pass using your CPF number or Ticket ID.
                </p>
              </div>
              <Link
                href="/my-tickets"
                className="px-6 py-3 rounded-xl text-xs font-bold bg-gold text-maroon-dark hover:bg-gold-light transition-all shadow-md shrink-0"
              >
                CHECK YOUR PASS
              </Link>
            </div>

          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

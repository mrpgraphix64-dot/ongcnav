import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import PublicHeader from '@/components/PublicHeader';
import PublicFooter from '@/components/PublicFooter';
import PageHero from '@/components/PageHero';
import { MapPin, Navigation, Headphones, ShieldCheck, Clock, CheckCircle } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Get in Touch & Venue | ONGC Navratri 2026',
  description: 'Contact the ONGC Navratri 2026 organizing team. Venue details, support desk hours, and event assistance at ONGC Ground, Ahmedabad.',
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
                    <p className="font-semibold text-ink">ONGC Ground</p>
                    <p>Chandkheda, Opposite Sabarmati Jail Area,</p>
                    <p>Ahmedabad, Gujarat 380005</p>
                  </div>
                </div>
                <div className="pt-4 border-t border-stone-100 text-xs text-gold-dark font-medium flex items-center gap-1.5">
                  <Navigation className="w-3.5 h-3.5 text-gold" />
                  <span>Central Ahmedabad Location</span>
                </div>
              </div>

              {/* SUPPORT DESK CARD */}
              <div className="bg-white rounded-3xl p-8 border border-stone-200 shadow-sm space-y-5 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-gold-soft text-amber-900 flex items-center justify-center border border-gold/40 shadow-xs">
                    <Headphones className="w-7 h-7" />
                  </div>
                  <h3 className="font-cinzel font-bold text-xl text-maroon">Organizing Help Desk</h3>
                  <div className="text-xs sm:text-sm text-ink/80 space-y-1 leading-relaxed">
                    <p><strong className="text-ink">Email:</strong> support@ongcnavratri.com</p>
                    <p><strong className="text-ink">Committee:</strong> EWC Ahmedabad Support Desk</p>
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
                    <p><strong className="text-ink">Daily Afternoon Garba:</strong> 12:00 PM – 04:00 PM</p>
                    <p><strong className="text-ink">Evening Sessions:</strong> 07:00 PM – 11:30 PM</p>
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
              <div className="space-y-2">
                <span className="text-xs font-bold text-gold-muted uppercase tracking-widest">Venue Directions</span>
                <h3 className="font-cinzel font-bold text-2xl text-maroon">Reaching ONGC Ground, Ahmedabad</h3>
                <p className="text-xs sm:text-sm text-ink/75 leading-relaxed max-w-2xl">
                  The venue is conveniently accessible via major arterial roads in Ahmedabad. Follow the official ONGC Navratri directional boards positioned at key junctions near Chandkheda and Visat Circle.
                </p>
              </div>

              {/* Google Maps Direction Embed Frame */}
              <div className="rounded-2xl overflow-hidden border border-stone-200 shadow-xs aspect-21/9 min-h-[300px] bg-stone-100 flex items-center justify-center relative">
                <iframe
                  title="ONGC Ground Ahmedabad Map"
                  className="w-full h-full border-0 min-h-[350px]"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d14678.966956277685!2d72.58550186977539!3d23.106584200000003!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x395e83c27e80adcf%3A0xe44726bf60196884!2sONGC%20Colony%2C%20Chandkheda%2C%20Ahmedabad%2C%20Gujarat!5e0!3m2!1sen!2sin!4v1695000000000!5m2!1sen!2sin"
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

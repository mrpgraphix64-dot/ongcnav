import React from 'react';
import Link from 'next/link';
import {
  QrCode,
  Calendar,
  Clock,
  MapPin,
  Ticket,
  HelpCircle,
  Mail,
  Search,
  Lock,
} from 'lucide-react';

export default function PublicFooter() {
  return (
    <footer className="bg-maroon-deep text-cream border-t border-gold/30 pt-16 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b border-cream/10">
          
          {/* BRAND & MISSION */}
          <div className="lg:col-span-2 space-y-4">
            <Link href="/" className="flex items-center gap-3">
              <img 
                src="/images/logo-web.png" 
                alt="ONGC Navratri Logo" 
                className="h-10 w-auto" 
              />
              <span className="font-cinzel font-bold text-lg text-white tracking-wide">
                ONGC NAVRATRI 2026
              </span>
            </Link>
            <p className="text-xs text-cream/70 leading-relaxed max-w-sm">
              The official grand Navratri celebration by ONGC. Nine nights of authentic Garba, vibrant music, cultural devotion, and community spirit at ONGC Ground, Ahmedabad.
            </p>
            <div className="pt-2">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-gold text-maroon-dark hover:bg-gold-light transition-colors shadow-xs"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>GET YOUR QR PASS</span>
              </Link>
            </div>
          </div>

          {/* QUICK NAVIGATION */}
          <div>
            <h4 className="font-cinzel font-bold text-sm text-gold uppercase tracking-wider mb-4">
              Navigation
            </h4>
            <ul className="space-y-2.5 text-xs text-cream/75">
              <li><Link href="/" className="hover:text-gold transition-colors">Home</Link></li>
              <li><Link href="/about" className="hover:text-gold transition-colors">About Celebration</Link></li>
              <li><Link href="/event" className="hover:text-gold transition-colors">The Event & Features</Link></li>
              <li><Link href="/schedule" className="hover:text-gold transition-colors">Event Schedule</Link></li>
              <li><Link href="/gallery" className="hover:text-gold transition-colors">Photo Gallery</Link></li>
              <li><Link href="/information" className="hover:text-gold transition-colors">Before You Arrive</Link></li>
            </ul>
          </div>

          {/* EVENT INFO */}
          <div>
            <h4 className="font-cinzel font-bold text-sm text-gold uppercase tracking-wider mb-4">
              Event Details
            </h4>
            <ul className="space-y-3 text-xs text-cream/70">
              <li className="flex items-start gap-2.5">
                <Calendar className="w-3.5 h-3.5 text-gold shrink-0 mt-0.5" />
                <span>11–19 October 2026<br /><span className="text-gold-light text-[11px]">7:00 PM onwards</span></span>
              </li>
              <li className="flex items-start gap-2.5">
                <Clock className="w-3.5 h-3.5 text-gold shrink-0 mt-0.5" />
                <span>Daily Garba Mandli<br /><span className="text-gold-light text-[11px]">12:00 PM – 4:00 PM</span></span>
              </li>
              <li className="flex items-start gap-2.5">
                <MapPin className="w-3.5 h-3.5 text-gold shrink-0 mt-0.5" />
                <span>ONGC Ground, Chandkheda,<br />Ahmedabad, Gujarat</span>
              </li>
            </ul>
          </div>

          {/* SUPPORT & PASSES */}
          <div>
            <h4 className="font-cinzel font-bold text-sm text-gold uppercase tracking-wider mb-4">
              Passes & Help
            </h4>
            <ul className="space-y-2.5 text-xs text-cream/70">
              <li>
                <Link href="/my-tickets" className="hover:text-gold transition-colors flex items-center gap-1.5">
                  <Ticket className="w-3.5 h-3.5 text-gold" /> Check Ticket Pass
                </Link>
              </li>
              <li>
                <Link href="/faq" className="hover:text-gold transition-colors flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-gold" /> FAQs & Guidance
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-gold transition-colors flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-gold" /> Event Support Desk
                </Link>
              </li>
              <li className="pt-2">
                <Link
                  href="/my-tickets"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-gold text-xs font-semibold hover:bg-white/20 transition-colors border border-gold/30"
                >
                  <Search className="w-3.5 h-3.5" /> Lookup Ticket Pass
                </Link>
              </li>
            </ul>
          </div>

        </div>

        {/* COPYRIGHT & DISCREET ADMIN */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-cream/50">
          <p>&copy; 2026 ONGC Navratri. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link href="/information" className="hover:text-gold/80 transition-colors">Event Guidelines</Link>
            <Link href="/faq" className="hover:text-gold/80 transition-colors">Help</Link>
            <Link href="/login" className="hover:text-gold/80 transition-colors opacity-60 hover:opacity-100 flex items-center gap-1 text-[11px]">
              <Lock className="w-3 h-3" /> Admin
            </Link>
          </div>
        </div>

      </div>
    </footer>
  );
}

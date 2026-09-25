'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, Ticket } from 'lucide-react';

export default function PublicHeader() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { label: 'Home', href: '/' },
    { label: 'About', href: '/about' },
    { label: 'Event', href: '/event' },
    { label: 'Schedule', href: '/schedule' },
    { label: 'Gallery', href: '/gallery' },
    { label: 'FAQ', href: '/faq' },
    { label: 'Contact', href: '/contact' },
  ];

  return (
    <header className="sticky top-0 z-50 bg-cream-light/95 backdrop-blur-md border-b border-gold/30 shadow-xs transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* gap-2 guarantees a minimum gutter between the logo block and the
            mobile controls even at the narrowest widths, where both sides
            are otherwise close to their natural size. */}
        <div className="flex items-center justify-between gap-2 h-20">

          {/* BRAND LOGO */}
          <Link href="/" className="flex items-center gap-2 sm:gap-3.5 group min-w-0">
            <img
              src="/images/logo-web.png"
              alt="ONGC Navratri Logo"
              className="h-9 sm:h-12 w-auto object-contain shrink-0 transition-transform group-hover:scale-105 duration-300"
            />
            <div className="flex flex-col min-w-0">
              <span className="font-cinzel font-bold text-sm sm:text-xl text-maroon leading-tight tracking-wide truncate">
                NAVRATRI
              </span>
              <span className="text-[10px] sm:text-[11px] font-semibold text-gold-muted tracking-widest uppercase">
                2026
              </span>
            </div>
          </Link>

          {/* DESKTOP NAVIGATION */}
          {/* gap-4 at the lg boundary keeps the full row (logo + 7 links +
              2 action buttons) from squeezing the logo wordmark into a
              truncated ellipsis at exactly 1024px; it opens back up to a
              roomier gap-7 once xl gives everything more breathing space. */}
          <nav className="hidden lg:flex items-center gap-3 xl:gap-7">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-sm font-semibold transition-colors py-1 relative ${
                    isActive ? 'text-maroon font-bold' : 'text-ink/80 hover:text-maroon'
                  }`}
                >
                  {link.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gold rounded-full" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* DESKTOP ACTIONS */}
          <div className="hidden lg:flex items-center gap-2 xl:gap-3">
            <Link
              href="/my-tickets"
              className={`px-3 xl:px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 border ${
                pathname === '/my-tickets'
                  ? 'bg-maroon-soft text-maroon border-maroon'
                  : 'text-maroon border-maroon/30 hover:bg-maroon-soft'
              }`}
            >
              Check Ticket
            </Link>
            <Link
              href="/bookpass"
              aria-label="Book your pass"
              data-testid="book-pass-button"
              className="px-4 xl:px-5 py-2.5 rounded-xl text-xs font-bold bg-maroon text-white shadow-md hover:bg-maroon-dark hover:shadow-lg transition-all duration-200 border border-gold/40 flex items-center gap-2"
            >
              <Ticket className="w-4 h-4 text-gold-light" />
              <span>BOOK YOUR PASS</span>
            </Link>
          </div>

          {/* MOBILE HEADER CONTROLS */}
          <div className="lg:hidden flex items-center gap-1.5 sm:gap-2 shrink-0">
            <Link
              href="/bookpass"
              aria-label="Book your pass"
              data-testid="book-pass-mobile-button"
              className="px-2.5 sm:px-3 py-2 rounded-lg text-xs font-bold bg-maroon text-white shadow-sm flex items-center gap-1 sm:gap-1.5"
            >
              <Ticket className="w-4 h-4 text-gold-light" />
              <span className="hidden min-[380px]:inline">BOOK PASS</span>
            </Link>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              type="button"
              className="p-2 rounded-xl text-maroon hover:bg-maroon-soft transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-maroon focus-visible:ring-offset-1"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* MOBILE MENU DRAWER */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-cream-light border-b border-gold/30 shadow-xl px-4 pt-3 pb-6 space-y-3">
          <nav className="flex flex-col space-y-1.5">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-3 py-2.5 rounded-lg text-base font-semibold ${
                    isActive
                      ? 'bg-maroon-soft text-maroon font-bold'
                      : 'text-ink hover:bg-cream-soft'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
            <Link
              href="/information"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2.5 rounded-lg text-base font-semibold text-ink/80 hover:bg-cream-soft"
            >
              Before You Arrive
            </Link>
          </nav>
          <div className="pt-3 border-t border-stone-200 flex flex-col gap-2.5">
            <Link
              href="/bookpass"
              aria-label="Book your pass"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center py-3 rounded-xl text-sm font-bold bg-maroon text-white shadow-md flex items-center justify-center gap-2 border border-gold/40"
            >
              <Ticket className="w-4 h-4 text-gold-light" />
              <span>BOOK YOUR PASS</span>
            </Link>
            <Link
              href="/my-tickets"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center py-2.5 rounded-xl text-sm font-semibold text-maroon border border-maroon/30 hover:bg-maroon-soft"
            >
              Check Ticket Status
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

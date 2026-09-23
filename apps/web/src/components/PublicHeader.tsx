'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { QrCode, Menu, X } from 'lucide-react';

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
        <div className="flex items-center justify-between h-20">
          
          {/* BRAND LOGO */}
          <Link href="/" className="flex items-center gap-2 sm:gap-3.5 group shrink-0">
            <img 
              src="/images/logo-web.png" 
              alt="ONGC Navratri Logo" 
              className="h-9 sm:h-12 w-auto object-contain transition-transform group-hover:scale-105 duration-300"
            />
            <div className="flex flex-col">
              <span className="font-cinzel font-bold text-base sm:text-xl text-maroon leading-tight tracking-wide">
                NAVRATRI
              </span>
              <span className="text-[10px] sm:text-[11px] font-semibold text-gold-muted tracking-widest uppercase">
                2026
              </span>
            </div>
          </Link>

          {/* DESKTOP NAVIGATION */}
          <nav className="hidden lg:flex items-center gap-6 xl:gap-7">
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
          <div className="hidden lg:flex items-center gap-3">
            <Link
              href="/my-tickets"
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 border ${
                pathname === '/my-tickets'
                  ? 'bg-maroon-soft text-maroon border-maroon'
                  : 'text-maroon border-maroon/30 hover:bg-maroon-soft'
              }`}
            >
              Check Ticket
            </Link>
            <Link
              href="/register"
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-maroon text-white shadow-md hover:bg-maroon-dark hover:shadow-lg transition-all duration-200 border border-gold/40 flex items-center gap-2"
            >
              <QrCode className="w-4 h-4 text-gold-light" />
              <span>GET YOUR QR PASS</span>
            </Link>
          </div>

          {/* MOBILE HEADER CONTROLS */}
          <div className="lg:hidden flex items-center gap-1.5 sm:gap-2 shrink-0">
            <Link
              href="/register"
              className="px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold bg-maroon text-white shadow-sm flex items-center gap-1 sm:gap-1.5"
            >
              <QrCode className="w-3.5 h-3.5 text-gold-light" />
              <span>QR Pass</span>
            </Link>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              type="button"
              className="p-1.5 sm:p-2 rounded-xl text-maroon hover:bg-maroon-soft transition-colors focus:outline-none"
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
              href="/register"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center py-3 rounded-xl text-sm font-bold bg-maroon text-white shadow-md flex items-center justify-center gap-2 border border-gold/40"
            >
              <QrCode className="w-4 h-4 text-gold-light" />
              <span>GET YOUR QR PASS</span>
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

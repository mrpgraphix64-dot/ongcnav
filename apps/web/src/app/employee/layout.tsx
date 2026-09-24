import type { Metadata } from 'next';
import React from 'react';
import Link from 'next/link';
import { ShieldCheck, Search } from 'lucide-react';

export const metadata: Metadata = {
  title: 'ONGC Employee Registration | ONGC Navratri 2026',
  description: 'Private registration portal for ONGC employees, retired personnel, and tenure contract staff.',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

/**
 * ARCHITECTURAL NOTICE:
 * A hidden or unlinked URL is NOT real access control.
 * This dedicated employee layout provides isolation from public site navigation
 * and establishes the entry boundary where real employee authentication
 * (e.g. ONGC SSO, OTP verification, employee LDAP, or secure invite tokens)
 * can be plugged in seamlessly without affecting the public site.
 */
export default function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-cream text-ink">
      {/* DEDICATED EMPLOYEE HEADER — strictly isolated from public navigation */}
      <header className="sticky top-0 z-50 bg-cream-light/95 backdrop-blur-md border-b border-gold/40 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* BRAND / PORTAL IDENTITY */}
            <div className="flex items-center gap-3 sm:gap-4">
              <img
                src="/images/logo-web.png"
                alt="ONGC Logo"
                className="h-10 sm:h-12 w-auto object-contain shrink-0"
              />
              <div className="h-8 w-px bg-gold/50 hidden sm:block" />
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-cinzel font-bold text-base sm:text-lg text-maroon leading-tight tracking-wide">
                    ONGC NAVRATRI 2026
                  </span>
                  <span className="text-[10px] font-bold text-maroon-dark bg-maroon-soft px-2 py-0.5 rounded-full uppercase tracking-wider hidden sm:inline-flex items-center gap-1 border border-maroon/20">
                    <ShieldCheck className="w-3 h-3" />
                    Employee Portal
                  </span>
                </div>
                <span className="text-[11px] font-medium text-ink-soft">
                  Official Personnel &amp; Family Pass Issuance
                </span>
              </div>
            </div>

            {/* ACTION: PASS LOOKUP */}
            <div className="flex items-center gap-2">
              <Link
                href="/my-tickets"
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-maroon border border-maroon/30 hover:bg-maroon-soft transition-colors flex items-center gap-1.5"
              >
                <Search className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Find Existing</span> Pass
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* ACCESS CONTROL ARCHITECTURE BOUNDARY HOOK */}
      <div className="bg-amber-500/10 border-b border-amber-600/20 py-1.5 px-4 text-center">
        <p className="text-[11px] font-medium text-amber-900 flex items-center justify-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-amber-600 animate-pulse" />
          <span>Restricted Portal: Intended exclusively for ONGC Employees, Retired Personnel, and Tenure Staff.</span>
        </p>
      </div>

      {/* MAIN EMPLOYEE FLOW VIEWPORT */}
      <div className="flex-1 flex flex-col">{children}</div>

      {/* DEDICATED EMPLOYEE FOOTER — no public links */}
      <footer className="mt-auto border-t border-gold/30 bg-cream-light py-6 text-center text-xs text-ink-soft">
        <div className="max-w-5xl mx-auto px-4 space-y-1.5">
          <p className="font-semibold text-ink">
            Oil and Natural Gas Corporation Limited (ONGC) &bull; Western Onshore Basin
          </p>
          <p className="text-[11px] text-ink-soft">
            EWC Navratri Coordination Committee &bull; Official Employee Registration Desk
          </p>
          <p className="text-[10px] text-stone-400 pt-1">
            This private portal is not indexed and is designated solely for authorized personnel registration.
          </p>
        </div>
      </footer>
    </div>
  );
}

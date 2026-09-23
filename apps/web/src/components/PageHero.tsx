import React from 'react';
import Link from 'next/link';

interface PageHeroProps {
  badge?: string;
  title: string;
  subtitle?: string;
  breadcrumb?: string;
}

export default function PageHero({
  badge,
  title,
  subtitle,
  breadcrumb,
}: PageHeroProps) {
  return (
    <section className="relative spirit-festive-bg text-cream-light py-16 sm:py-20 lg:py-24 border-b border-gold/30 overflow-hidden">
      {/* Subtle Background Elements */}
      <div className="absolute inset-0 rangoli-pattern pointer-events-none opacity-10" />
      <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-gold/15 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-saffron/15 blur-3xl pointer-events-none" />

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 text-center space-y-4">
        
        {/* BADGE / SECTION TAG */}
        {badge && (
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-gold/15 border border-gold/40 text-gold-light text-xs font-bold uppercase tracking-widest shadow-xs">
            <span>✦</span>
            <span>{badge}</span>
            <span>✦</span>
          </div>
        )}

        {/* MAIN TITLE */}
        <h1 className="font-cinzel font-extrabold text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-transparent bg-clip-text bg-gradient-to-r from-gold-light via-white to-gold tracking-wide leading-tight">
          {title}
        </h1>

        {/* DECORATIVE GOLD DIVIDER */}
        <div className="flex items-center justify-center gap-3 pt-1">
          <span className="w-12 h-px bg-gradient-to-r from-transparent to-gold" />
          <span className="text-gold text-xs">❖</span>
          <span className="w-12 h-px bg-gradient-to-l from-transparent to-gold" />
        </div>

        {/* SUBTITLE */}
        {subtitle && (
          <p className="font-outfit font-normal text-cream/80 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed pt-1">
            {subtitle}
          </p>
        )}

        {/* BREADCRUMB */}
        <div className="pt-4 flex items-center justify-center gap-2 text-xs text-gold/70">
          <Link href="/" className="hover:text-gold transition-colors">Home</Link>
          <span>/</span>
          <span className="text-cream font-medium">{breadcrumb || badge || title}</span>
        </div>

      </div>
    </section>
  );
}

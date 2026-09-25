import React from 'react';
import Link from 'next/link';
import {
  Sparkles,
  Ticket,
  ArrowRight,
  Crown,
  Radio,
  Users,
  Music2,
  Sun,
  Utensils,
  Clock,
  Calendar,
  Flame,
  ChevronRight,
  Search,
} from 'lucide-react';
import PublicHeader from '@/components/PublicHeader';
import PublicFooter from '@/components/PublicFooter';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col justify-between bg-cream text-ink selection:bg-maroon selection:text-white">
      <PublicHeader />

      <main className="flex-grow">
        {/* ======================================================== */}
        {/* 1. HERO SECTION                                          */}
        {/* ======================================================== */}
        <section
          id="home"
          className="relative text-white overflow-hidden py-16 sm:py-24 lg:py-32 min-h-[540px] sm:min-h-[640px] lg:min-h-[740px] flex items-center justify-center bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage:
              "linear-gradient(to bottom, rgba(61, 7, 20, 0.45), rgba(90, 15, 33, 0.65)), url('/images/bg.png')",
          }}
        >
          <div className="absolute inset-0 rangoli-pattern pointer-events-none" />

          {/* Decorative Glow Orbs */}
          <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-saffron/20 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-gold/20 blur-3xl pointer-events-none" />

          {/* ENTRANCE LIGHT TRAILS (DECORATIVE) */}
          <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
            <svg
              className="absolute bottom-0 left-0 w-1/2 h-64 animate-golden-trail-boy opacity-0"
              viewBox="0 0 500 200"
              fill="none"
            >
              <path
                d="M-50,180 Q150,120 300,190"
                stroke="url(#goldGradient1)"
                strokeWidth="4"
                strokeLinecap="round"
                filter="blur(2px)"
              />
              <defs>
                <linearGradient id="goldGradient1" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#F3E5AB" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
            <svg
              className="absolute bottom-0 right-0 w-1/2 h-64 animate-golden-trail-girl opacity-0"
              viewBox="0 0 500 200"
              fill="none"
            >
              <path
                d="M550,180 Q350,120 200,190"
                stroke="url(#goldGradient2)"
                strokeWidth="4"
                strokeLinecap="round"
                filter="blur(2px)"
              />
              <defs>
                <linearGradient id="goldGradient2" x1="100%" y1="0%" x2="0%" y2="0%">
                  <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#F3E5AB" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          {/* GOLDEN FLOATING SPARKLE PARTICLES */}
          <div className="absolute inset-0 pointer-events-none z-15 overflow-hidden">
            <div className="absolute left-6 sm:left-24 bottom-24 w-2 h-2 rounded-full bg-gold-light golden-particle-1 shadow-[0_0_8px_#D4AF37]" />
            <div className="absolute left-16 sm:left-40 bottom-40 w-1.5 h-1.5 rounded-full bg-gold golden-particle-2 shadow-[0_0_6px_#D4AF37]" />
            <div className="absolute right-6 sm:right-24 bottom-24 w-2 h-2 rounded-full bg-gold-light golden-particle-3 shadow-[0_0_8px_#D4AF37]" />
            <div className="absolute right-16 sm:right-40 bottom-40 w-1.5 h-1.5 rounded-full bg-gold golden-particle-4 shadow-[0_0_6px_#D4AF37]" />
          </div>

          {/* BOY GARBA DANCER (LEFT SIDE) */}
          <div className="absolute left-0 bottom-0 z-20 pointer-events-none opacity-0 animate-dancer-boy flex items-end justify-start">
            <img
              src="/images/left.png"
              alt="ONGC Navratri Garba Dancer Boy"
              className="w-[125px] xs:w-[150px] sm:w-[230px] md:w-[310px] lg:w-[390px] xl:w-[450px] h-auto object-contain max-h-[48vh] sm:max-h-[62vh] lg:max-h-[75vh] select-none"
              loading="eager"
            />
          </div>

          {/* GIRL GARBA DANCER (RIGHT SIDE) */}
          <div className="absolute right-0 bottom-0 z-20 pointer-events-none opacity-0 animate-dancer-girl flex items-end justify-end">
            <img
              src="/images/right.png"
              alt="ONGC Navratri Garba Dancer Girl"
              className="w-[125px] xs:w-[150px] sm:w-[230px] md:w-[310px] lg:w-[390px] xl:w-[450px] h-auto object-contain max-h-[48vh] sm:max-h-[62vh] lg:max-h-[75vh] select-none"
              loading="eager"
            />
          </div>

          {/* CENTER HERO CONTENT CONTAINER */}
          <div className="relative z-30 pointer-events-auto max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            {/* OFFICIAL LOGO SHOWCASE */}
            <div className="mb-6 sm:mb-8 flex justify-center">
              <div className="relative p-2 sm:p-3 bg-white/95 backdrop-blur-md rounded-3xl border-2 border-gold/60 shadow-2xl">
                <img
                  src="/images/logo-web.png"
                  alt="ONGC Logo"
                  className="h-20 sm:h-28 lg:h-32 max-w-[280px] sm:max-w-[440px] w-auto object-contain p-2"
                />
              </div>
            </div>

            {/* EVENT TITLE & TAGLINE */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gold/20 border border-gold/40 text-gold-light text-xs sm:text-sm font-semibold mb-5 backdrop-blur-sm">
              <Sparkles className="w-4 h-4 text-gold" />
              <span>9 NIGHTS OF CELEBRATION</span>
            </div>

            <h1 className="font-cinzel font-extrabold text-3xl sm:text-6xl lg:text-7xl text-white tracking-wide sm:tracking-wider mb-3 drop-shadow-lg">
              ONGC NAVRATRI
            </h1>

            <p className="font-outfit font-bold text-xl sm:text-3xl lg:text-4xl text-gold-light tracking-wide mb-5">
              Celebrate. Dance. Connect.
            </p>

            <p className="max-w-2xl mx-auto text-xs sm:text-base lg:text-lg text-cream/90 font-light leading-relaxed mb-8 px-2 sm:px-0">
              Experience the spirit of Navratri with nine nights of music, Garba, sacred tradition, and community joy at Gujarat&apos;s premier festive venue.
            </p>

            {/* EVENT BADGE */}
            <div className="inline-flex flex-wrap items-center justify-center gap-3 sm:gap-8 px-4 sm:px-6 py-2.5 sm:py-3.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-xs sm:text-sm font-semibold text-white mb-8 shadow-lg max-w-full">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gold shrink-0" />
                <span className="text-[11px] sm:text-sm">11 OCT &mdash; 19 OCT 2026</span>
              </div>
              <div className="hidden sm:block text-gold/60">&bull;</div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gold shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <span className="text-[11px] sm:text-sm">ONGC Ground, Ahmedabad</span>
              </div>
            </div>

            {/* HERO CTAS */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/bookpass"
                aria-label="Buy your pass"
                className="w-full sm:w-auto px-8 py-4 rounded-2xl text-sm sm:text-base font-bold bg-gold text-maroon-deep shadow-xl hover:bg-gold-light hover:scale-105 transition-all duration-300 border border-white/40 flex items-center justify-center gap-2.5"
              >
                <Ticket className="w-5 h-5 text-maroon-deep" />
                <span>BUY YOUR PASS</span>
              </Link>
              <Link
                href="/my-tickets"
                className="w-full sm:w-auto px-8 py-4 rounded-2xl text-sm sm:text-base font-bold bg-white/10 text-white hover:bg-white/20 transition-all duration-300 border border-white/30 backdrop-blur-md flex items-center justify-center gap-2"
              >
                <span>CHECK TICKET STATUS</span>
              </Link>
            </div>
          </div>
        </section>

        {/* ======================================================== */}
        {/* 2. SPONSORS SECTION (LUXURY FESTIVE STAGE SHOWCASE)     */}
        {/* ======================================================== */}
        <section
          id="sponsors"
          className="py-20 sm:py-28 lg:py-32 bg-cream sponsor-stage-bg border-b border-stone-200/80 relative overflow-hidden"
        >
          {/* Corner Draped Curtains (Left & Right) */}
          <div
            className="absolute -top-2 -left-2 sm:top-0 sm:left-0 w-36 sm:w-52 lg:w-72 h-36 sm:h-52 lg:h-72 pointer-events-none z-10 opacity-80 select-none"
            aria-hidden="true"
          >
            <svg viewBox="0 0 200 200" fill="none" className="w-full h-full">
              <path d="M0,0 L200,0 C170,42 142,88 106,128 C74,162 36,186 0,196 Z" fill="url(#curtainGradLeft)" />
              <path d="M0,0 L160,0 C134,36 112,76 82,112 C56,142 26,166 0,176 Z" fill="rgba(61, 7, 20, 0.45)" />
              <path d="M0,0 L115,0 C98,30 78,66 54,96 C34,122 16,146 0,156 Z" fill="rgba(61, 7, 20, 0.35)" />
              <path d="M200,0 C170,42 142,88 106,128 C74,162 36,186 0,196" stroke="#D4AF37" strokeWidth="3.5" strokeLinecap="round" />
              <path d="M200,0 C170,42 142,88 106,128 C74,162 36,186 0,196" stroke="#F3E5AB" strokeWidth="1.2" strokeDasharray="3 3" />
              <circle cx="106" cy="128" r="4.5" fill="#D4AF37" stroke="#F3E5AB" strokeWidth="1" />
              <path d="M106,132 L103,158 L109,158 Z" fill="#D4AF37" />
              <defs>
                <linearGradient id="curtainGradLeft" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#5A0F21" />
                  <stop offset="65%" stopColor="#7A1930" />
                  <stop offset="100%" stopColor="#3D0714" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          <div
            className="absolute -top-2 -right-2 sm:top-0 sm:right-0 w-36 sm:w-52 lg:w-72 h-36 sm:h-52 lg:h-72 pointer-events-none z-10 opacity-80 select-none"
            aria-hidden="true"
          >
            <svg viewBox="0 0 200 200" fill="none" className="w-full h-full">
              <path d="M200,0 L0,0 C30,42 58,88 94,128 C126,162 164,186 200,196 Z" fill="url(#curtainGradRight)" />
              <path d="M200,0 L40,0 C66,36 88,76 118,112 C144,142 174,166 200,176 Z" fill="rgba(61, 7, 20, 0.45)" />
              <path d="M200,0 L85,0 C102,30 122,66 146,96 C166,122 184,146 200,156 Z" fill="rgba(61, 7, 20, 0.35)" />
              <path d="M0,0 C30,42 58,88 94,128 C126,162 164,186 200,196" stroke="#D4AF37" strokeWidth="3.5" strokeLinecap="round" />
              <path d="M0,0 C30,42 58,88 94,128 C126,162 164,186 200,196" stroke="#F3E5AB" strokeWidth="1.2" strokeDasharray="3 3" />
              <circle cx="94" cy="128" r="4.5" fill="#D4AF37" stroke="#F3E5AB" strokeWidth="1" />
              <path d="M94,132 L91,158 L97,158 Z" fill="#D4AF37" />
              <defs>
                <linearGradient id="curtainGradRight" x1="100%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#5A0F21" />
                  <stop offset="65%" stopColor="#7A1930" />
                  <stop offset="100%" stopColor="#3D0714" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          {/* Hanging Diyas with Golden Chains */}
          <div
            className="hidden md:block absolute top-0 left-8 lg:left-14 w-12 lg:w-16 h-64 lg:h-80 pointer-events-none z-10"
            aria-hidden="true"
          >
            <svg viewBox="0 0 60 300" fill="none" className="w-full h-full overflow-visible">
              <line x1="30" y1="0" x2="30" y2="170" stroke="#D4AF37" strokeWidth="2" strokeDasharray="4 3" />
              <path d="M22,170 C22,162 38,162 38,170 L30,170 Z" fill="#C5A059" stroke="#9A7B1C" strokeWidth="1" />
              <circle cx="30" cy="172" r="2.5" fill="#D4AF37" />
              <path d="M12,192 C12,208 48,208 48,192 C48,186 12,186 12,192 Z" fill="#8B4513" stroke="#D4AF37" strokeWidth="1.5" />
              <path d="M16,192 C18,198 42,198 44,192 Z" fill="#5A2E0D" />
              <ellipse cx="30" cy="188" rx="8" ry="3" fill="#D4AF37" opacity="0.6" />
              <g className="diya-flame-anim">
                <circle cx="30" cy="178" r="14" fill="rgba(245, 158, 11, 0.25)" filter="blur(4px)" />
                <path d="M30,165 C34,174 36,180 34,185 C32,188 28,188 26,185 C24,180 26,174 30,165 Z" fill="#F59E0B" />
                <path d="M30,170 C32,176 33,180 32,184 C31,186 29,186 28,184 C27,180 28,176 30,170 Z" fill="#FEF08A" />
              </g>
            </svg>
          </div>

          <div
            className="hidden md:block absolute top-0 right-8 lg:right-14 w-12 lg:w-16 h-64 lg:h-80 pointer-events-none z-10"
            aria-hidden="true"
          >
            <svg viewBox="0 0 60 300" fill="none" className="w-full h-full overflow-visible">
              <line x1="30" y1="0" x2="30" y2="170" stroke="#D4AF37" strokeWidth="2" strokeDasharray="4 3" />
              <path d="M22,170 C22,162 38,162 38,170 L30,170 Z" fill="#C5A059" stroke="#9A7B1C" strokeWidth="1" />
              <circle cx="30" cy="172" r="2.5" fill="#D4AF37" />
              <path d="M12,192 C12,208 48,208 48,192 C48,186 12,186 12,192 Z" fill="#8B4513" stroke="#D4AF37" strokeWidth="1.5" />
              <path d="M16,192 C18,198 42,198 44,192 Z" fill="#5A2E0D" />
              <ellipse cx="30" cy="188" rx="8" ry="3" fill="#D4AF37" opacity="0.6" />
              <g className="diya-flame-anim">
                <circle cx="30" cy="178" r="14" fill="rgba(245, 158, 11, 0.25)" filter="blur(4px)" />
                <path d="M30,165 C34,174 36,180 34,185 C32,188 28,188 26,185 C24,180 26,174 30,165 Z" fill="#F59E0B" />
                <path d="M30,170 C32,176 33,180 32,184 C31,186 29,186 28,184 C27,180 28,176 30,170 Z" fill="#FEF08A" />
              </g>
            </svg>
          </div>

          {/* Mandala Watermark Pattern */}
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] sm:w-[850px] lg:w-[1050px] h-[650px] sm:h-[850px] lg:h-[1050px] pointer-events-none opacity-[0.04] select-none"
            aria-hidden="true"
          >
            <svg viewBox="0 0 600 600" fill="none" stroke="#7A1930" strokeWidth="1.5" className="w-full h-full">
              <circle cx="300" cy="300" r="280" />
              <circle cx="300" cy="300" r="255" strokeDasharray="4 6" />
              <circle cx="300" cy="300" r="225" />
              <circle cx="300" cy="300" r="185" strokeDasharray="3 4" />
              <circle cx="300" cy="300" r="145" />
              <circle cx="300" cy="300" r="95" />
              <circle cx="300" cy="300" r="45" />
            </svg>
          </div>

          {/* STAGE DECORATION: LEFT (2ndsecleft.png) */}
          <div
            className="absolute left-1 sm:left-2 md:left-3 lg:left-4 xl:left-6 2xl:left-10 bottom-10 sm:bottom-14 md:bottom-18 lg:bottom-24 xl:bottom-28 w-28 sm:w-36 md:w-44 lg:w-52 xl:w-56 2xl:w-64 pointer-events-none z-10 select-none opacity-60 sm:opacity-85 md:opacity-100"
            aria-hidden="true"
          >
            <div className="sponsor-decor-left-idle relative w-full">
              <div className="absolute inset-x-3 inset-y-6 bg-gradient-to-t from-gold/30 via-gold/45 to-gold/20 rounded-full blur-2xl decor-glow-pulse pointer-events-none -z-10" />
              <div
                className="absolute w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-gradient-to-r from-amber-100/90 via-amber-400/60 to-transparent blur-xs decor-diya-glow pointer-events-none"
                style={{ left: '53%', top: '74%' }}
              />
              <img
                src="/images/2ndsecleft.png"
                alt="Stage Left Ornament"
                className="w-full h-auto object-contain filter drop-shadow-[0_12px_24px_rgba(122,25,48,0.12)] drop-shadow-[0_4px_12px_rgba(212,175,55,0.25)]"
                loading="lazy"
              />
            </div>
          </div>

          {/* STAGE DECORATION: RIGHT (2ndsecright.png) */}
          <div
            className="absolute right-1 sm:right-2 md:right-3 lg:right-4 xl:right-6 2xl:right-10 bottom-10 sm:bottom-14 md:bottom-18 lg:bottom-24 xl:bottom-28 w-28 sm:w-36 md:w-44 lg:w-52 xl:w-56 2xl:w-64 pointer-events-none z-10 select-none opacity-60 sm:opacity-85 md:opacity-100"
            aria-hidden="true"
          >
            <div className="sponsor-decor-right-idle relative w-full">
              <div className="absolute inset-x-3 inset-y-6 bg-gradient-to-t from-gold/30 via-gold/45 to-gold/20 rounded-full blur-2xl decor-glow-pulse pointer-events-none -z-10" />
              <div
                className="absolute w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-gradient-to-r from-amber-100/90 via-amber-400/60 to-transparent blur-xs decor-diya-glow pointer-events-none"
                style={{ left: '47%', top: '74%' }}
              />
              <img
                src="/images/2ndsecright.png"
                alt="Stage Right Ornament"
                className="w-full h-auto object-contain filter drop-shadow-[0_12px_24px_rgba(122,25,48,0.12)] drop-shadow-[0_4px_12px_rgba(212,175,55,0.25)]"
                loading="lazy"
              />
            </div>
          </div>

          <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* SECTION HEADER */}
            <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
              <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-maroon-soft border border-gold/50 text-maroon text-[11px] sm:text-xs font-bold tracking-[0.2em] uppercase mb-4 shadow-xs">
                <Sparkles className="w-3.5 h-3.5 text-gold-dark" />
                <span>PROUD PARTNERS</span>
              </div>

              <h2 className="font-cinzel font-bold text-3xl sm:text-5xl lg:text-6xl text-maroon tracking-wider mb-4">
                OUR SPONSORS
              </h2>

              <p className="font-outfit text-ink-soft text-base sm:text-lg lg:text-xl font-normal max-w-xl mx-auto mb-5">
                Together, making the celebration bigger.
              </p>

              {/* Thin Gold Ornamental Divider */}
              <div className="flex items-center justify-center gap-3 max-w-xs sm:max-w-sm mx-auto" aria-hidden="true">
                <span className="h-px bg-gradient-to-r from-transparent via-gold to-gold/50 flex-1" />
                <span className="w-1.5 h-1.5 rotate-45 bg-gold/70" />
                <span className="inline-flex items-center justify-center p-0.5">
                  <svg className="w-5 h-5 text-gold" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2L14.8 9.2L22 12L14.8 14.8L12 22L9.2 14.8L2 12L9.2 9.2L12 2Z" />
                  </svg>
                </span>
                <span className="w-1.5 h-1.5 rotate-45 bg-gold/70" />
                <span className="h-px bg-gradient-to-l from-transparent via-gold to-gold/50 flex-1" />
              </div>
            </div>

            {/* SPONSOR CARDS */}
            <div className="flex flex-col lg:flex-row items-center lg:items-end justify-center gap-10 lg:gap-12 max-w-6xl mx-auto">
              
              {/* TITLE SPONSOR CARD */}
              <div className="w-full lg:w-[58%] max-w-2xl flex flex-col items-center">
                <div className="w-full bg-gradient-to-b from-[#FFFDF9] via-white to-[#FAF6EE] rounded-3xl p-6 sm:p-9 lg:p-10 gold-stage-border relative transition-all duration-300">
                  <div className="absolute top-3.5 left-3.5 w-5 h-5 border-t-2 border-l-2 border-gold/70 rounded-tl-lg pointer-events-none" />
                  <div className="absolute top-3.5 right-3.5 w-5 h-5 border-t-2 border-r-2 border-gold/70 rounded-tr-lg pointer-events-none" />
                  <div className="absolute bottom-3.5 left-3.5 w-5 h-5 border-b-2 border-l-2 border-gold/70 rounded-bl-lg pointer-events-none" />
                  <div className="absolute bottom-3.5 right-3.5 w-5 h-5 border-b-2 border-r-2 border-gold/70 rounded-br-lg pointer-events-none" />
                  <div className="absolute inset-2.5 sm:inset-3 rounded-[22px] border border-gold/25 pointer-events-none" />

                  {/* Top Pill Banner */}
                  <div className="relative z-10 text-center mb-8">
                    <div className="inline-flex items-center gap-2 px-5 sm:px-6 py-2 rounded-full bg-gradient-to-r from-maroon-deep via-maroon to-maroon-deep text-white border border-gold/60 shadow-md">
                      <Crown className="w-4 h-4 text-gold-light" />
                      <span className="font-cinzel font-bold text-xs sm:text-sm tracking-[0.18em] uppercase text-white">
                        TITLE SPONSOR
                      </span>
                    </div>
                  </div>

                  {/* Logos Container */}
                  <div className="relative z-10 flex flex-col items-center justify-center gap-5 sm:gap-6 py-2">
                    {/* ZAIRA DIAMOND */}
                    <div className="w-full flex items-center justify-center px-4 sm:px-8">
                      <img
                        src="/images/sponsors/Zaira_Logo_With_Tagline_v17.jpg"
                        alt="Zaira Diamond"
                        className="max-h-24 sm:max-h-28 lg:max-h-32 max-w-full w-auto object-contain transition-transform duration-300 hover:scale-[1.02]"
                        loading="lazy"
                      />
                    </div>

                    {/* Gold Divider */}
                    <div className="w-4/5 sm:w-3/5 flex items-center justify-center gap-3 my-1">
                      <span className="h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent flex-1" />
                      <span className="text-gold text-xs leading-none font-serif">◆</span>
                      <span className="h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent flex-1" />
                    </div>

                    {/* OM SANCTUARY PALACE */}
                    <div className="w-full flex items-center justify-center px-4 sm:px-8">
                      <img
                        src="/images/sponsors/Om_Resort_Palace_Logowhitebg.jpg"
                        alt="Om Sanctuary Palace"
                        className="max-h-20 sm:max-h-24 lg:max-h-26 max-w-full w-auto object-contain transition-transform duration-300 hover:scale-[1.02]"
                        loading="lazy"
                      />
                    </div>
                  </div>
                </div>

                {/* Stage Base Podium */}
                <div className="w-full flex flex-col items-center pointer-events-none select-none">
                  <div className="w-[94%] h-2.5 sm:h-3 rounded-t-md bg-gradient-to-r from-gold/40 via-gold to-gold/40 border-t border-gold-light/60 shadow-xs" />
                  <div className="w-[102%] -mx-[1%] h-4 sm:h-5 rounded-b-xl bg-gradient-to-r from-maroon-deep via-maroon to-maroon-deep border-t border-gold/50 shadow-lg flex items-center justify-center">
                    <div className="w-24 h-0.5 bg-gradient-to-r from-transparent via-gold/60 to-transparent" />
                  </div>
                </div>
              </div>

              {/* MEDIA SPONSOR CARD */}
              <div className="w-full lg:w-[38%] max-w-md flex flex-col items-center">
                <div className="w-full bg-gradient-to-b from-[#FFFDF9] via-white to-[#FAF6EE] rounded-3xl p-6 sm:p-9 lg:p-10 border-2 border-gold/45 shadow-[0_8px_25px_rgba(122,25,48,0.06)] relative transition-all duration-300">
                  <div className="absolute top-3.5 left-3.5 w-4 h-4 border-t-2 border-l-2 border-gold/60 rounded-tl-lg pointer-events-none" />
                  <div className="absolute top-3.5 right-3.5 w-4 h-4 border-t-2 border-r-2 border-gold/60 rounded-tr-lg pointer-events-none" />
                  <div className="absolute bottom-3.5 left-3.5 w-4 h-4 border-b-2 border-l-2 border-gold/60 rounded-bl-lg pointer-events-none" />
                  <div className="absolute bottom-3.5 right-3.5 w-4 h-4 border-b-2 border-r-2 border-gold/60 rounded-br-lg pointer-events-none" />
                  <div className="absolute inset-2.5 sm:inset-3 rounded-[22px] border border-gold/20 pointer-events-none" />

                  {/* Top Pill Banner */}
                  <div className="relative z-10 text-center mb-8">
                    <div className="inline-flex items-center gap-2 px-4 sm:px-5 py-2 rounded-full bg-gradient-to-r from-maroon-deep via-maroon to-maroon-deep text-white border border-gold/50 shadow-md">
                      <Radio className="w-4 h-4 text-gold-light" />
                      <span className="font-cinzel font-bold text-xs sm:text-sm tracking-[0.18em] uppercase text-white">
                        MEDIA SPONSOR
                      </span>
                    </div>
                  </div>

                  {/* Media Sponsor Logo */}
                  <div className="relative z-10 flex items-center justify-center py-6 sm:py-8 px-4">
                    <img
                      src="/images/sponsors/Lalkaar_News.png"
                      alt="Lalkaar News"
                      className="max-h-24 sm:max-h-28 lg:max-h-32 max-w-full w-auto object-contain transition-transform duration-300 hover:scale-[1.02]"
                      loading="lazy"
                    />
                  </div>
                </div>

                {/* Stage Base Podium */}
                <div className="w-full flex flex-col items-center pointer-events-none select-none">
                  <div className="w-[92%] h-2.5 sm:h-3 rounded-t-md bg-gradient-to-r from-gold/30 via-gold/80 to-gold/30 border-t border-gold-light/50 shadow-xs" />
                  <div className="w-[102%] -mx-[1%] h-4 sm:h-5 rounded-b-xl bg-gradient-to-r from-maroon-deep via-maroon to-maroon-deep border-t border-gold/40 shadow-lg flex items-center justify-center">
                    <div className="w-16 h-0.5 bg-gradient-to-r from-transparent via-gold/50 to-transparent" />
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ======================================================== */}
        {/* 3. THE SPIRIT OF NAVRATRI                                */}
        {/* ======================================================== */}
        <section id="about" className="relative py-20 sm:py-28 spirit-festive-bg text-cream-light overflow-hidden border-b border-gold/30">
          {/* Transition Bar */}
          <div className="absolute top-0 left-0 right-0 overflow-hidden flex items-center justify-center select-none pointer-events-none z-20">
            <div className="w-full h-px bg-gradient-to-r from-transparent via-gold to-transparent opacity-80" />
            <div className="absolute flex items-center gap-2 bg-[#4A101B] px-5 py-1 border border-gold/50 rounded-full shadow-md">
              <span className="w-1.5 h-1.5 rotate-45 bg-gold/70" />
              <span className="w-2.5 h-2.5 rotate-45 bg-gold-light border border-gold shadow-xs" />
              <span className="w-1.5 h-1.5 rotate-45 bg-gold/70" />
            </div>
          </div>

          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* SECTION HEADER */}
            <div className="text-center max-w-3xl mx-auto mb-8 sm:mb-10">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gold/15 border border-gold/30 text-gold-light mb-4 shadow-sm">
                <Sparkles className="w-3.5 h-3.5 text-gold" />
                <span className="text-xs font-bold tracking-[0.22em] text-gold uppercase">THE ESSENCE OF FESTIVITY</span>
                <Sparkles className="w-3.5 h-3.5 text-gold" />
              </div>
              <h2 className="font-cinzel font-bold text-3xl sm:text-5xl text-cream-light tracking-wide mt-1 mb-4">
                THE SPIRIT OF NAVRATRI
              </h2>
              <div className="flex items-center justify-center gap-3 my-4">
                <div className="h-0.5 w-14 sm:w-20 bg-gradient-to-r from-transparent via-gold to-gold" />
                <div className="w-2.5 h-2.5 rotate-45 bg-gold border border-gold-light shadow-xs" />
                <div className="h-0.5 w-14 sm:w-20 bg-gradient-to-l from-transparent via-gold to-gold" />
              </div>
              <p className="text-cream/90 text-sm sm:text-base leading-relaxed font-light">
                Immerse yourself in nine sacred nights filled with traditional Garba rhythms, divine devotion, vibrant attire, and grand community togetherness.
              </p>
            </div>

            {/* 2 LAKH+ FOOTFALL STATISTIC HIGHLIGHT BADGE */}
            <div className="flex justify-center mb-14 sm:mb-16">
              <div className="relative inline-flex flex-col sm:flex-row items-center gap-4 sm:gap-6 px-6 sm:px-9 py-4 rounded-2xl bg-gradient-to-r from-[#3D0714]/90 via-[#561522] to-[#3D0714]/90 border border-gold/45 shadow-xl backdrop-blur-md">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-gold/15 border border-gold/40 flex items-center justify-center text-gold shadow-inner shrink-0">
                    <Users className="w-6 h-6 text-gold-light" />
                  </div>
                  <div className="text-left">
                    <div className="font-cinzel font-extrabold text-3xl sm:text-4xl text-transparent bg-clip-text bg-gradient-to-r from-gold-light via-gold to-gold-light leading-none tracking-tight">
                      2 LAKH+
                    </div>
                    <div className="font-outfit text-xs sm:text-sm font-semibold tracking-[0.22em] text-cream/90 uppercase mt-1">
                      FOOTFALL CELEBRATION
                    </div>
                  </div>
                </div>

                <div className="hidden sm:block w-px h-10 bg-gold/30" />

                <div className="text-center sm:text-left max-w-xs">
                  <span className="text-xs text-cream/80 leading-relaxed block">
                    Gujarat's premier corporate & family Garba gathering uniting thousands each night
                  </span>
                </div>
              </div>
            </div>

            {/* 5 FEATURE CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
              {/* CARD 1: GARBA */}
              <div className="spirit-card-lift group bg-[#FFFDF9] rounded-2xl p-6 border border-gold/40 shadow-lg text-center flex flex-col items-center justify-between">
                <div className="w-full flex flex-col items-center">
                  <div className="w-14 h-14 rounded-2xl bg-maroon-soft text-maroon flex items-center justify-center mb-5 border border-maroon/20 group-hover:bg-maroon group-hover:text-gold-light transition-all duration-300 shadow-sm">
                    <Sparkles className="w-7 h-7" />
                  </div>
                  <h3 className="font-outfit font-bold text-xl text-maroon mb-2 tracking-wide">GARBA</h3>
                  <p className="text-xs text-ink-soft leading-relaxed">
                    Traditional Garba nights with energetic concentric circles & authentic Raas.
                  </p>
                </div>
                <div className="w-8 h-0.5 bg-gradient-to-r from-transparent via-gold/60 to-transparent mt-5" />
              </div>

              {/* CARD 2: MUSIC */}
              <div className="spirit-card-lift group bg-[#FFFDF9] rounded-2xl p-6 border border-gold/40 shadow-lg text-center flex flex-col items-center justify-between">
                <div className="w-full flex flex-col items-center">
                  <div className="w-14 h-14 rounded-2xl bg-maroon-soft text-maroon flex items-center justify-center mb-5 border border-maroon/20 group-hover:bg-maroon group-hover:text-gold-light transition-all duration-300 shadow-sm">
                    <Music2 className="w-7 h-7" />
                  </div>
                  <h3 className="font-outfit font-bold text-xl text-maroon mb-2 tracking-wide">MUSIC</h3>
                  <p className="text-xs text-ink-soft leading-relaxed">
                    Live folk singers and traditional orchestra playing rhythmic Gujarati melodies.
                  </p>
                </div>
                <div className="w-8 h-0.5 bg-gradient-to-r from-transparent via-gold/60 to-transparent mt-5" />
              </div>

              {/* CARD 3: CULTURE */}
              <div className="spirit-card-lift group bg-[#FFFDF9] rounded-2xl p-6 border border-gold/40 shadow-lg text-center flex flex-col items-center justify-between">
                <div className="w-full flex flex-col items-center">
                  <div className="w-14 h-14 rounded-2xl bg-maroon-soft text-maroon flex items-center justify-center mb-5 border border-maroon/20 group-hover:bg-maroon group-hover:text-gold-light transition-all duration-300 shadow-sm">
                    <Sun className="w-7 h-7" />
                  </div>
                  <h3 className="font-outfit font-bold text-xl text-maroon mb-2 tracking-wide">CULTURE</h3>
                  <p className="text-xs text-ink-soft leading-relaxed">
                    Celebrating Gujarat's rich heritage, chaniya choli attire, and ethnic traditions.
                  </p>
                </div>
                <div className="w-8 h-0.5 bg-gradient-to-r from-transparent via-gold/60 to-transparent mt-5" />
              </div>

              {/* CARD 4: COMMUNITY */}
              <div className="spirit-card-lift group bg-[#FFFDF9] rounded-2xl p-6 border border-gold/40 shadow-lg text-center flex flex-col items-center justify-between">
                <div className="w-full flex flex-col items-center">
                  <div className="w-14 h-14 rounded-2xl bg-maroon-soft text-maroon flex items-center justify-center mb-5 border border-maroon/20 group-hover:bg-maroon group-hover:text-gold-light transition-all duration-300 shadow-sm">
                    <Users className="w-7 h-7" />
                  </div>
                  <h3 className="font-outfit font-bold text-xl text-maroon mb-2 tracking-wide">COMMUNITY</h3>
                  <p className="text-xs text-ink-soft leading-relaxed">
                    A grand festive gathering bringing families, friends, and ONGC fraternity together.
                  </p>
                </div>
                <div className="w-8 h-0.5 bg-gradient-to-r from-transparent via-gold/60 to-transparent mt-5" />
              </div>

              {/* CARD 5: FOOD */}
              <div className="spirit-card-lift group bg-[#FFFDF9] rounded-2xl p-6 border border-gold/40 shadow-lg text-center flex flex-col items-center justify-between sm:col-span-2 lg:col-span-1 max-w-sm sm:max-w-none mx-auto sm:mx-0">
                <div className="w-full flex flex-col items-center">
                  <div className="w-14 h-14 rounded-2xl bg-maroon-soft text-maroon flex items-center justify-center mb-5 border border-maroon/20 group-hover:bg-maroon group-hover:text-gold-light transition-all duration-300 shadow-sm">
                    <Utensils className="w-7 h-7" />
                  </div>
                  <h3 className="font-outfit font-bold text-xl text-maroon mb-2 tracking-wide">FOOD</h3>
                  <p className="text-xs text-ink-soft leading-relaxed">
                    Traditional festive flavours, Gujarati delicacies, and refreshing food stalls.
                  </p>
                </div>
                <div className="w-8 h-0.5 bg-gradient-to-r from-transparent via-gold/60 to-transparent mt-5" />
              </div>
            </div>

            {/* DISCOVER THE EVENT CTA */}
            <div className="mt-14 sm:mt-16 text-center">
              <Link
                href="/event"
                className="inline-flex items-center gap-3 px-8 py-3.5 rounded-2xl text-xs sm:text-sm font-bold bg-gold text-maroon-dark hover:bg-gold-light transition-all duration-300 shadow-xl border border-white/30 group"
              >
                <span>DISCOVER THE EVENT</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
        </section>

        {/* ======================================================== */}
        {/* 4. SCHEDULE PREVIEW SECTION                              */}
        {/* ======================================================== */}
        <section
          id="schedule-preview"
          className="py-16 sm:py-24 bg-cream border-b border-stone-200/80 relative overflow-hidden"
        >
          <div className="absolute inset-0 rangoli-pattern pointer-events-none opacity-[0.03]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-gold/5 rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-8 sm:space-y-10">
            {/* SECTION HEADER */}
            <div className="text-center space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold/15 border border-gold/40 text-gold-dark text-xs font-bold uppercase tracking-widest">
                <Clock className="w-3.5 h-3.5" />
                <span>DAILY PROGRAMME</span>
              </div>
              <h2 className="font-cinzel font-extrabold text-2xl sm:text-3xl lg:text-4xl text-maroon">
                Schedule Preview
              </h2>
              <div className="w-16 h-0.5 bg-gold mx-auto" />
            </div>

            {/* 1. TODAY'S HIGHLIGHT CARD */}
            <div className="bg-white rounded-3xl p-7 sm:p-9 border border-stone-200/90 shadow-md flex flex-col sm:flex-row items-center justify-between gap-6 sm:gap-8 relative overflow-hidden group hover:shadow-lg transition-shadow duration-300">
              <div className="absolute top-0 right-0 w-28 h-28 bg-gradient-to-bl from-gold/15 via-transparent to-transparent pointer-events-none rounded-tr-3xl" />

              <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-5 sm:gap-6">
                <div className="w-20 h-20 rounded-2xl bg-maroon-soft text-maroon border border-maroon/20 flex flex-col items-center justify-center shrink-0 group-hover:bg-maroon group-hover:text-white transition-colors duration-300 shadow-xs">
                  <span className="font-cinzel font-bold text-2xl leading-none">12:00</span>
                  <span className="text-[10px] font-extrabold tracking-wider uppercase mt-0.5">PM</span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      ✦ TODAY'S HIGHLIGHT
                    </span>
                    <span className="text-[11px] font-medium text-ink-muted">Afternoon Session</span>
                  </div>
                  <div className="text-xs font-semibold text-ink-soft">12:00 PM — 4:00 PM</div>
                  <h3 className="font-cinzel font-bold text-xl sm:text-2xl text-maroon">GARBA MANDLI GARBA</h3>
                  <p className="text-xs sm:text-sm text-ink/75 leading-relaxed max-w-md">
                    Traditional Garba celebration continues through the afternoon with folk rhythms and devotion.
                  </p>
                </div>
              </div>

              <div className="shrink-0 flex sm:flex-col items-center sm:items-end gap-2 text-right">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gold-dark bg-gold/10 px-3 py-1.5 rounded-xl border border-gold/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Concludes at 4:00 PM
                </span>
              </div>
            </div>

            {/* 2. TIMELINE BRIDGE */}
            <div className="relative py-2 sm:py-4 px-2 sm:px-4">
              <div className="hidden md:block relative">
                <div className="flex items-center justify-between relative">
                  {/* 12 PM Left Marker */}
                  <div className="flex items-center gap-2 z-10 shrink-0">
                    <div className="w-3.5 h-3.5 rounded-full bg-maroon border-2 border-gold shadow-xs" />
                    <span className="font-mono text-xs font-bold text-maroon-dark tracking-wider">12:00 PM</span>
                  </div>

                  {/* Left Segment */}
                  <div className="flex-1 mx-4 relative h-1.5 bg-stone-200/90 rounded-full overflow-visible">
                    <div className="absolute inset-0 bg-gradient-to-r from-maroon via-gold to-amber-400 rounded-full" />
                  </div>

                  {/* Central Handover Node */}
                  <div className="relative z-20 flex flex-col items-center shrink-0">
                    <div className="relative flex items-center justify-center">
                      <div className="absolute -inset-3 rounded-full bg-gold/35 blur-md pointer-events-none" />
                      <div className="relative z-10 w-8 h-8 rounded-full bg-gradient-to-tr from-maroon via-gold to-amber-200 border-2 border-white shadow-md flex items-center justify-center text-white">
                        <div className="w-2.5 h-2.5 rounded-full bg-white animate-ping opacity-80" />
                      </div>
                    </div>
                    <div className="mt-2.5 flex flex-col items-center whitespace-nowrap">
                      <span className="font-mono text-xs font-extrabold text-maroon bg-white/95 px-2.5 py-0.5 rounded-md border border-gold/50 shadow-2xs">
                        4:00 PM
                      </span>
                    </div>
                  </div>

                  {/* Right Segment */}
                  <div className="flex-1 mx-4 relative h-1.5 bg-stone-200/90 rounded-full overflow-visible">
                    <div className="absolute inset-0 bg-gradient-to-r from-amber-400 via-gold to-maroon rounded-full" />
                  </div>

                  {/* Right Marker */}
                  <div className="flex items-center gap-2 z-10 shrink-0">
                    <span className="font-mono text-xs font-bold text-maroon-dark tracking-wider">7:00 PM</span>
                    <div className="w-3.5 h-3.5 rounded-full bg-gold border-2 border-white shadow-xs" />
                  </div>
                </div>

                <div className="text-center mt-5">
                  <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-gold/15 via-amber-100/80 to-gold/15 border border-gold/50 shadow-2xs">
                    <Sparkles className="w-3.5 h-3.5 text-gold-dark animate-pulse" />
                    <span className="font-cinzel font-bold text-xs tracking-wider text-maroon uppercase">
                      The Celebration Continues
                    </span>
                    <Sparkles className="w-3.5 h-3.5 text-gold-dark animate-pulse" />
                  </div>
                </div>
              </div>

              {/* Mobile Timeline */}
              <div className="md:hidden relative py-2 flex flex-col items-center">
                <div className="w-0.5 h-6 bg-gradient-to-b from-maroon via-gold to-amber-400 rounded-full" />
                <div className="relative flex flex-col items-center my-1">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-maroon via-gold to-amber-200 border-2 border-white shadow-md flex items-center justify-center text-white">
                    <span className="w-2 h-2 rounded-full bg-white animate-ping opacity-80" />
                  </div>
                  <div className="mt-2 text-center">
                    <div className="font-mono text-xs font-extrabold text-maroon bg-white px-2.5 py-0.5 rounded border border-gold/40 shadow-2xs">
                      4:00 PM
                    </div>
                    <div className="mt-1 font-cinzel font-bold text-[11px] text-maroon uppercase tracking-wider">
                      The Celebration Continues
                    </div>
                  </div>
                </div>
                <div className="w-0.5 h-6 bg-gradient-to-b from-amber-400 via-gold to-maroon rounded-full" />
              </div>
            </div>

            {/* 3. NEXT PROGRAMME CARD */}
            <div className="bg-white/90 backdrop-blur-xs rounded-2xl p-5 sm:p-6 border border-gold/40 hover:border-gold shadow-sm hover:shadow-md transition-all duration-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6 group">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gold/15 border border-gold/30 text-maroon flex items-center justify-center shrink-0 group-hover:bg-gold group-hover:text-maroon-dark transition-colors duration-300 shadow-2xs">
                  <Flame className="w-6 h-6 text-gold-dark group-hover:text-maroon-dark transition-colors" />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-maroon bg-maroon-soft border border-maroon/20 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      ✦ UP NEXT &bull; EVENING CEREMONY
                    </span>
                    <span className="text-xs font-mono font-bold text-ink-soft">
                      7:00 PM onwards
                    </span>
                  </div>

                  <h4 className="font-cinzel font-bold text-base sm:text-lg text-maroon">
                    Maha Aarti & Grand Raas Garba
                  </h4>

                  <p className="text-xs sm:text-sm text-ink/70 leading-relaxed max-w-xl">
                    Divine Aarti followed by 9 nights of vibrant Raas Garba, traditional folk orchestra, and cultural celebration.
                  </p>
                </div>
              </div>

              <div className="shrink-0 w-full sm:w-auto pt-2 sm:pt-0 flex items-center justify-end">
                <Link
                  href="/schedule"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-maroon bg-cream-soft hover:bg-gold-light/40 border border-gold/40 transition-all duration-200"
                >
                  <span>Programme Details</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* 4. VIEW FULL SCHEDULE CTA */}
            <div className="text-center pt-2">
              <Link
                href="/schedule"
                className="group inline-flex items-center gap-3 px-8 py-3.5 rounded-xl text-xs sm:text-sm font-bold text-maroon bg-white hover:bg-gold-light/30 border border-gold/60 hover:border-gold transition-all duration-300 shadow-sm hover:shadow-md"
              >
                <Calendar className="w-4 h-4 text-gold-dark" />
                <span>VIEW FULL SCHEDULE</span>
                <ArrowRight className="w-4 h-4 text-maroon transition-transform duration-300 group-hover:translate-x-1.5" />
              </Link>
            </div>
          </div>
        </section>

        {/* ======================================================== */}
        {/* 5. FINAL QR PASS REGISTRATION CTA                        */}
        {/* ======================================================== */}
        <section className="py-16 sm:py-24 spirit-festive-bg text-cream-light relative overflow-hidden">
          <div className="absolute inset-0 rangoli-pattern pointer-events-none opacity-10" />
          <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-gold/15 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-saffron/15 blur-3xl pointer-events-none" />

          <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-gold/20 border border-gold/40 text-gold-light text-xs font-bold uppercase tracking-widest shadow-xs">
              <Ticket className="w-3.5 h-3.5" />
              <span>COMMERCIAL PASSES OPEN</span>
            </div>

            <h2 className="font-cinzel font-extrabold text-3xl sm:text-5xl text-gold-light tracking-wide">
              Buy Your Digital Entry Pass
            </h2>

            <p className="text-sm sm:text-base text-cream/80 max-w-2xl mx-auto leading-relaxed font-light">
              Secure your Daily or Season pass for ONGC Navratri 2026. Instant digital delivery with fast-track entry at the venue.
            </p>

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/bookpass"
                aria-label="Buy your pass"
                className="w-full sm:w-auto px-9 py-4 rounded-2xl text-sm font-bold bg-gold text-maroon-dark hover:bg-gold-light transition-all duration-300 shadow-xl border border-white/40 flex items-center justify-center gap-2.5"
              >
                <Ticket className="w-4 h-4 text-maroon-dark" />
                <span>BUY YOUR PASS</span>
              </Link>
              <Link
                href="/my-tickets"
                className="w-full sm:w-auto px-7 py-4 rounded-2xl text-sm font-semibold bg-white/10 hover:bg-white/20 text-cream border border-gold/40 transition-all flex items-center justify-center gap-2"
              >
                <Search className="w-4 h-4" />
                <span>Check Ticket Status</span>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}

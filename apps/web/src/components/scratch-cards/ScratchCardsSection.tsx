'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  Ticket,
  ArrowRight,
  Gift,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import {
  ScratchCardItem,
  SponsorVoucherConfig,
  getDefaultScratchCards,
} from '@/types/shared-types';
import ScratchCard from './ScratchCard';
import {
  loadRevealedCardIds,
  saveRevealedCardId,
  filterVisibleScratchCards,
} from './scratch-card-utils';

interface ScratchCardsSectionProps {
  referenceNumber: string;
  sponsorConfig?: SponsorVoucherConfig | null;
  customCards?: ScratchCardItem[];
  passLookupUrl?: string;
}

export default function ScratchCardsSection({
  referenceNumber,
  sponsorConfig,
  customCards,
  passLookupUrl = '/employee/my-tickets',
}: ScratchCardsSectionProps) {
  // Get cards list (handles sponsor-disabled state automatically)
  const initialCards = customCards ?? getDefaultScratchCards(sponsorConfig);
  const activeCards = filterVisibleScratchCards(initialCards);

  const [revealedIds, setRevealedIds] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);

  // Load revealed state on mount for this specific reference number
  useEffect(() => {
    setMounted(true);
    const saved = loadRevealedCardIds(referenceNumber);
    setRevealedIds(saved);
  }, [referenceNumber]);

  const handleRevealCard = (cardId: string) => {
    const updated = saveRevealedCardId(referenceNumber, cardId);
    setRevealedIds([...updated]);
  };

  const allRevealed =
    activeCards.length > 0 &&
    activeCards.every((card) => revealedIds.includes(card.id));

  const cleanReference = referenceNumber ? referenceNumber.trim() : 'ONGC-2026';

  return (
    <section
      aria-label="Festive Scratch and Reveal Surprises"
      className="w-full mt-10 space-y-8"
    >
      {/* ------------------------------------------------------------- */}
      {/* FESTIVE HEADER SECTION                                        */}
      {/* ------------------------------------------------------------- */}
      <div className="text-center space-y-3 p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-[#FFFDF9] via-[#FAF5EB] to-[#F5EBD7] border-2 border-gold/50 shadow-lg relative overflow-hidden">
        {/* Subtle decorative background flourishes */}
        <div className="absolute -top-12 -left-12 w-32 h-32 rounded-full bg-gold/10 blur-xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 w-32 h-32 rounded-full bg-maroon/10 blur-xl pointer-events-none" />

        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-maroon text-gold-light text-xs font-bold uppercase tracking-widest shadow-2xs">
          <Sparkles className="w-3.5 h-3.5 text-gold-light" />
          <span>ONGC NAVRATRI 2026</span>
          <Sparkles className="w-3.5 h-3.5 text-gold-light" />
        </div>

        <h2 className="font-cinzel font-extrabold text-2xl sm:text-3xl text-maroon uppercase tracking-wide">
          Your Registration is Complete! 🎉
        </h2>

        <p className="text-sm sm:text-base text-ink-soft max-w-md mx-auto leading-relaxed">
          Here&apos;s a little Navratri surprise for you.
        </p>

        {/* Reference Number Callout (No sensitive data) */}
        <div className="inline-block mt-2 px-4 py-2 rounded-2xl bg-white border border-gold/60 shadow-xs">
          <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">
            Official Pass Reference No.
          </span>
          <span className="font-mono text-lg sm:text-xl font-black text-maroon tracking-wider">
            {cleanReference}
          </span>
        </div>

        <div className="pt-2 text-xs font-semibold text-stone-600 flex items-center justify-center gap-1.5">
          <Gift className="w-4 h-4 text-maroon" />
          <span>YOUR NAVRATRI SURPRISES &bull; Scratch all 3 cards to reveal your surprises.</span>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 pt-1">
          {activeCards.map((card, idx) => {
            const isRev = revealedIds.includes(card.id);
            return (
              <span
                key={card.id}
                className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border transition-all ${
                  isRev
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                    : 'bg-white/80 border-stone-200 text-stone-500'
                }`}
              >
                {isRev ? (
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                )}
                <span>Card {idx + 1}</span>
              </span>
            );
          })}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3 CARDS RESPONSIVE GRID                                       */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-6 items-stretch">
        {activeCards.map((card, idx) => (
          <ScratchCard
            key={card.id}
            card={card}
            cardIndex={idx}
            isRevealed={mounted && revealedIds.includes(card.id)}
            onReveal={handleRevealCard}
          />
        ))}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* ALL REVEALED CELEBRATION & CTA                                */}
      {/* ------------------------------------------------------------- */}
      {allRevealed && (
        <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 text-white border-2 border-emerald-400/50 shadow-2xl text-center space-y-4 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-700/60 border border-emerald-400/40 text-emerald-100 text-xs font-bold tracking-wider uppercase">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Celebration Ready</span>
          </div>

          <h3 className="font-cinzel font-extrabold text-xl sm:text-2xl text-amber-200 uppercase tracking-wide">
            ✨ All your surprises are revealed!
          </h3>

          <p className="text-xs sm:text-sm text-emerald-100/90 max-w-lg mx-auto leading-relaxed">
            Thank you for registering for ONGC Navratri 2026. Keep your reference number safe and access your passes anytime using the pass lookup portal.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href={passLookupUrl}
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-amber-400 via-gold to-amber-500 hover:from-amber-300 hover:to-amber-400 text-maroon-deep font-extrabold text-sm transition-all shadow-lg inline-flex items-center justify-center gap-2 border border-amber-200 cursor-pointer"
            >
              <Ticket className="w-4 h-4 text-maroon" />
              <span>VIEW MY E-PASS</span>
              <ArrowRight className="w-4 h-4 text-maroon" />
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}

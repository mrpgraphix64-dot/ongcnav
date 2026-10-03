'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import {
  Sparkles,
  CheckCircle2,
  Gift,
  Flame,
  Music,
  MapPin,
  Phone,
  Info,
  ExternalLink,
} from 'lucide-react';
import { ScratchCardItem } from '@/types/shared-types';
import {
  drawFestiveScratchSurface,
  isRevealThresholdReached,
  DEFAULT_REVEAL_THRESHOLD,
} from './scratch-card-utils';

interface ScratchCardProps {
  card: ScratchCardItem;
  isRevealed: boolean;
  onReveal: (cardId: string) => void;
  cardIndex: number;
}

export default function ScratchCard({
  card,
  isRevealed,
  onReveal,
  cardIndex,
}: ScratchCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isScratching, setIsScratching] = useState(false);
  const [revealedLocal, setRevealedLocal] = useState(isRevealed);
  const [scratchPercent, setScratchPercent] = useState(isRevealed ? 100 : 0);
  const [canvasReady, setCanvasReady] = useState(false);
  const [showVoucherModal, setShowVoucherModal] = useState(false);

  // Sync external prop if already revealed (e.g. loaded from storage)
  useEffect(() => {
    if (isRevealed && !revealedLocal) {
      setRevealedLocal(true);
      setScratchPercent(100);
    }
  }, [isRevealed, revealedLocal]);

  // Complete the reveal
  const completeReveal = useCallback(() => {
    if (revealedLocal) return;
    setRevealedLocal(true);
    setScratchPercent(100);
    onReveal(card.id);
  }, [revealedLocal, onReveal, card.id]);

  // Initialize Canvas Surface
  useEffect(() => {
    if (revealedLocal) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const width = container.clientWidth || 300;
    const height = container.clientHeight || 420;

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
      drawFestiveScratchSurface(canvas, card.badgeLabel || 'NAVRATRI 2026');
      setCanvasReady(true);
    }
  }, [revealedLocal, card.badgeLabel]);

  // Handle scratch sampling threshold check
  const checkScratchThreshold = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || revealedLocal) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const w = canvas.width;
    const h = canvas.height;

    // Fast grid sampling (20x20 = 400 sample points) to prevent UI lag on mobile
    const sampleRows = 20;
    const sampleCols = 20;
    let clearedCount = 0;
    const totalSamples = sampleRows * sampleCols;

    try {
      const imgData = ctx.getImageData(0, 0, w, h);
      const data = imgData.data;

      const stepX = Math.floor(w / sampleCols);
      const stepY = Math.floor(h / sampleRows);

      for (let r = 0; r < sampleRows; r++) {
        for (let c = 0; c < sampleCols; c++) {
          const px = c * stepX + Math.floor(stepX / 2);
          const py = r * stepY + Math.floor(stepY / 2);
          const index = (py * w + px) * 4 + 3; // Alpha channel
          if (data[index] < 128) {
            clearedCount++;
          }
        }
      }

      const ratio = clearedCount / totalSamples;
      const pct = Math.min(100, Math.round(ratio * 100));
      setScratchPercent(pct);

      if (isRevealThresholdReached(ratio, DEFAULT_REVEAL_THRESHOLD)) {
        completeReveal();
      }
    } catch {
      // If getImageData errors (e.g. cross-origin issues in some browsers), fallback
    }
  }, [revealedLocal, completeReveal]);

  // Pointer interaction
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const strokeCounterRef = useRef(0);

  const scratchAtPoint = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const x = (clientX - rect.left) * dpr;
    const y = (clientY - rect.top) * dpr;

    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = 38 * dpr; // Smooth finger width
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    if (lastPosRef.current) {
      ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
      ctx.lineTo(x, y);
    } else {
      ctx.arc(x, y, 19 * dpr, 0, Math.PI * 2);
    }
    ctx.stroke();
    ctx.restore();

    lastPosRef.current = { x, y };

    strokeCounterRef.current++;
    // Sample every 12 strokes for maximum performance & responsiveness
    if (strokeCounterRef.current % 12 === 0) {
      checkScratchThreshold();
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (revealedLocal) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    setIsScratching(true);
    lastPosRef.current = null;
    scratchAtPoint(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isScratching || revealedLocal) return;
    scratchAtPoint(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isScratching) return;
    setIsScratching(false);
    lastPosRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    checkScratchThreshold();
  };

  const isSponsorCard = card.category === 'sponsor';
  const voucher = card.sponsorConfig;

  return (
    <div
      ref={containerRef}
      className={`relative w-full rounded-3xl overflow-hidden border-2 transition-all duration-300 flex flex-col justify-between ${
        revealedLocal
          ? 'bg-gradient-to-b from-[#FFFDF9] via-[#FAF5EB] to-[#F7EFE1] border-[#D4AF37] shadow-xl scale-[1.01]'
          : 'bg-[#FFFDF9] border-[#D4AF37]/50 shadow-md hover:shadow-lg'
      }`}
      style={{ minHeight: '430px' }}
    >
      {/* ------------------------------------------------------------- */}
      {/* CARD UNDERNEATH / REVEALED CONTENT                            */}
      {/* ------------------------------------------------------------- */}
      <div className="relative p-5 sm:p-6 flex flex-col h-full justify-between z-0">
        <div>
          {/* Top festive header & badge */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-[10px] sm:text-xs font-bold font-mono tracking-widest uppercase text-maroon bg-maroon-soft px-2.5 py-1 rounded-full border border-maroon/20">
              {card.badgeLabel || 'FESTIVE SURPRISE'}
            </span>

            {revealedLocal ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-full shadow-2xs animate-fade-in">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>REVEALED</span>
              </span>
            ) : (
              <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                CARD #{cardIndex + 1}
              </span>
            )}
          </div>

          {/* Card Icon & Title Header */}
          <div className="text-center my-3">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-gold/30 via-cream-light to-gold/20 border border-gold/50 flex items-center justify-center shadow-inner mb-2">
              {card.category === 'welcome' ? (
                <Flame className="w-6 h-6 text-maroon" />
              ) : card.category === 'sponsor' ? (
                <Gift className="w-6 h-6 text-amber-600" />
              ) : (
                <Music className="w-6 h-6 text-maroon" />
              )}
            </div>

            <h3 className="font-cinzel font-extrabold text-base sm:text-lg text-ink uppercase tracking-wide">
              {card.title}
            </h3>
            <p className="text-xs text-stone-500 font-medium mt-0.5">
              {card.subtitle}
            </p>
          </div>

          {/* Central Highlight / Offer Box */}
          {isSponsorCard && voucher ? (
            /* MAHAVIR JEWELLERS SPONSOR VOUCHER BOX */
            <div className="mt-3 p-4 rounded-2xl bg-gradient-to-br from-[#0c1836] via-[#102450] to-[#071126] text-white border-2 border-gold/60 shadow-lg text-center space-y-2.5">
              <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold tracking-widest text-amber-300 uppercase">
                <Sparkles className="w-3 h-3 text-amber-300" />
                <span>{voucher.sponsorName}</span>
                <Sparkles className="w-3 h-3 text-amber-300" />
              </div>

              <div>
                <div className="text-2xl sm:text-3xl font-black font-cinzel text-amber-300 tracking-tight leading-none drop-shadow">
                  {card.revealHeadline || voucher.offerHeadline}
                </div>
                <div className="text-[11px] font-bold tracking-wider uppercase text-amber-100/90 mt-1">
                  {card.revealSubheadline || voucher.offerSubtext}
                </div>
              </div>

              <div className="inline-block px-3 py-1 rounded-full bg-amber-400/20 border border-amber-300/40 text-[10px] font-bold text-amber-200">
                {card.validityNote || voucher.validityNote}
              </div>

              {/* Voucher Image preview */}
              {voucher.voucherImagePath && (
                <div className="pt-2 border-t border-white/10">
                  <div
                    onClick={() => setShowVoucherModal(true)}
                    className="relative w-full h-24 rounded-xl overflow-hidden border border-gold/40 cursor-pointer group shadow-sm bg-black/40"
                  >
                    <Image
                      src={voucher.voucherImagePath}
                      alt="Mahavir Jewellers Gift Voucher"
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors flex items-center justify-center">
                      <span className="text-[10px] font-bold bg-black/70 text-amber-200 px-2.5 py-1 rounded-full border border-gold/40 flex items-center gap-1">
                        <ExternalLink className="w-2.5 h-2.5" />
                        <span>Tap to view voucher</span>
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Store location & contact */}
              <div className="text-[10px] text-amber-100/80 pt-1 space-y-1 text-left bg-black/20 p-2.5 rounded-xl border border-white/5">
                <div className="flex items-start gap-1.5">
                  <MapPin className="w-3 h-3 text-amber-300 shrink-0 mt-0.5" />
                  <span className="line-clamp-2">{voucher.address}</span>
                </div>
                {voucher.phone && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3 h-3 text-amber-300 shrink-0" />
                    <span className="font-mono">{voucher.phone}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* FESTIVE SURPRISE / GARBA NIGHT BOX */
            <div className="mt-3 p-4 rounded-2xl bg-white border border-gold/40 shadow-sm text-center space-y-2">
              <span className="inline-block text-[10px] font-black uppercase tracking-wider text-maroon bg-maroon-soft px-2.5 py-0.5 rounded-full border border-maroon/20">
                {card.revealHeadline}
              </span>
              <div className="font-outfit font-extrabold text-sm text-ink leading-snug">
                {card.revealSubheadline}
              </div>
              <p className="text-xs text-stone-600 leading-relaxed">
                {card.revealBody}
              </p>
              {card.highlightText && (
                <div className="pt-2 border-t border-stone-100 text-[11px] font-bold text-maroon-dark">
                  ✨ {card.highlightText}
                </div>
              )}
              {card.validityNote && (
                <div className="text-[10px] text-stone-500 font-mono">
                  {card.validityNote}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Card Footer Status / Actions */}
        <div className="pt-4 mt-3 border-t border-gold/20 flex flex-col items-center gap-2">
          {revealedLocal ? (
            <div className="w-full text-center py-2 px-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center justify-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Surprise Unlocked!</span>
            </div>
          ) : (
            /* Accessibility / Keyboard Reveal Fallback button */
            <button
              type="button"
              onClick={completeReveal}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-gold/20 via-gold/30 to-gold/20 hover:from-gold/40 hover:to-gold/40 border border-gold/60 text-maroon-deep font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-maroon"
              aria-label={`Reveal surprise: ${card.title}`}
            >
              <Sparkles className="w-3.5 h-3.5 text-maroon" />
              <span>Reveal Surprise</span>
            </button>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* SCRATCH OVERLAY CANVAS (INTERACTIVE LAYER)                     */}
      {/* ------------------------------------------------------------- */}
      {!revealedLocal && (
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="absolute inset-0 w-full h-full z-10 rounded-3xl cursor-pointer select-none transition-opacity duration-500"
          style={{
            touchAction: 'none', // Prevents touch from scrolling mobile screen during scratching!
            opacity: canvasReady ? 1 : 0.99,
          }}
          aria-hidden="true"
        />
      )}

      {/* ------------------------------------------------------------- */}
      {/* VOUCHER FULL IMAGE MODAL                                      */}
      {/* ------------------------------------------------------------- */}
      {showVoucherModal && voucher?.voucherImagePath && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowVoucherModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border-2 border-gold"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative w-full aspect-[2.4/1] bg-black">
              <Image
                src={voucher.voucherImagePath}
                alt="Mahavir Jewellers Sponsor Voucher"
                fill
                className="object-contain"
              />
            </div>
            <div className="p-4 bg-cream-light text-center space-y-2">
              <h4 className="font-cinzel font-bold text-sm text-maroon uppercase">
                {voucher.sponsorName} &bull; {voucher.offerHeadline}
              </h4>
              <p className="text-xs text-stone-600">
                {voucher.instructionText}
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowVoucherModal(false)}
                  className="px-5 py-2 rounded-xl bg-maroon text-white text-xs font-bold hover:bg-maroon-dark transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

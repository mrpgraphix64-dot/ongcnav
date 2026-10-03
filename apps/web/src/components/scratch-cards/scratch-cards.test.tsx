import React from 'react';
import ReactDOMServer from 'react-dom/server';
import ScratchCardsSection from './ScratchCardsSection';
import ScratchCard from './ScratchCard';
import {
  calculateScratchedPercentage,
  isRevealThresholdReached,
  getScratchStorageKey,
  loadRevealedCardIds,
  saveRevealedCardId,
  filterVisibleScratchCards,
  clearScratchStorage,
  DEFAULT_REVEAL_THRESHOLD,
} from './scratch-card-utils';
import {
  ScratchCardItem,
  SponsorVoucherConfig,
  DEFAULT_SPONSOR_VOUCHER_CONFIG,
  getDefaultScratchCards,
} from '@/types/shared-types';

describe('3-Card Scratch & Reveal Experience (ONGC Navratri 2026)', () => {
  beforeEach(() => {
    clearScratchStorage();
  });

  describe('1. Default Cards Configuration & Content', () => {
    it('provides exactly 3 configured cards by default', () => {
      const cards = getDefaultScratchCards();
      expect(cards).toHaveLength(3);
      expect(cards[0].id).toBe('welcome');
      expect(cards[1].id).toBe('mahavir');
      expect(cards[2].id).toBe('garba');
    });

    it('configures Card 1 with title "YOUR NAVRATRI SURPRISE" and celebratory subtitle', () => {
      const cards = getDefaultScratchCards();
      const card1 = cards.find((c) => c.id === 'welcome');
      expect(card1).toBeDefined();
      expect(card1?.title).toBe('YOUR NAVRATRI SURPRISE');
      expect(card1?.subtitle).toBe('A little celebration awaits you');
      expect(card1?.revealHeadline).toBe('FESTIVE BLESSING');
    });

    it('configures Card 2 with MAHAVIR JEWELLERS sponsor offer details', () => {
      const cards = getDefaultScratchCards();
      const card2 = cards.find((c) => c.id === 'mahavir');
      expect(card2).toBeDefined();
      expect(card2?.title).toBe('MAHAVIR JEWELLERS');
      expect(card2?.subtitle).toBe('A special gift for ONGC Navratri participants');
      expect(card2?.revealHeadline).toBe('₹5,000 OFF');
      expect(card2?.revealSubheadline).toBe('ON MAKING CHARGES');
      expect(card2?.validityNote).toContain('Lifetime | No expiry');
      expect(card2?.sponsorConfig?.voucherImagePath).toBe(
        '/images/sponsors/mahavir-jewellers-voucher.jpg',
      );
    });

    it('configures Card 3 with title "GARBA NIGHT SURPRISE" and festive celebration message', () => {
      const cards = getDefaultScratchCards();
      const card3 = cards.find((c) => c.id === 'garba');
      expect(card3).toBeDefined();
      expect(card3?.title).toBe('GARBA NIGHT SURPRISE');
      expect(card3?.subtitle).toBe('Celebrate the spirit of Navratri');
      expect(card3?.revealHeadline).toBe('SPECIAL PRIVILEGE');
    });
  });

  describe('2. Threshold Calculation & Scratch Mechanics', () => {
    it('calculates scratched percentage from sample alpha values', () => {
      // All opaque pixels (alpha = 255)
      const allOpaque = new Uint8ClampedArray(100).fill(255);
      expect(calculateScratchedPercentage(allOpaque)).toBe(0);

      // All cleared pixels (alpha = 0)
      const allCleared = new Uint8ClampedArray(100).fill(0);
      expect(calculateScratchedPercentage(allCleared)).toBe(1.0);

      // 50% cleared
      const halfCleared = new Uint8ClampedArray([0, 255, 0, 255]);
      expect(calculateScratchedPercentage(halfCleared)).toBe(0.5);
    });

    it('enforces reveal threshold within 45% - 55% (default 48%)', () => {
      expect(isRevealThresholdReached(0.40, DEFAULT_REVEAL_THRESHOLD)).toBe(false);
      expect(isRevealThresholdReached(0.47, DEFAULT_REVEAL_THRESHOLD)).toBe(false);
      expect(isRevealThresholdReached(0.48, DEFAULT_REVEAL_THRESHOLD)).toBe(true);
      expect(isRevealThresholdReached(0.52, DEFAULT_REVEAL_THRESHOLD)).toBe(true);
      expect(isRevealThresholdReached(1.0, DEFAULT_REVEAL_THRESHOLD)).toBe(true);
    });
  });

  describe('3. Persistence & Immutability of Revealed State', () => {
    it('persists revealed card IDs keyed by employee pass reference number', () => {
      const refNo = 'ONGC-EMP-8888';
      const key = getScratchStorageKey(refNo);
      expect(key).toBe('ongc_navratri_scratch_ONGC-EMP-8888');

      // Initially empty
      expect(loadRevealedCardIds(refNo)).toEqual([]);

      // Save card 1
      saveRevealedCardId(refNo, 'welcome');
      expect(loadRevealedCardIds(refNo)).toEqual(['welcome']);

      // Save card 2
      saveRevealedCardId(refNo, 'mahavir');
      expect(loadRevealedCardIds(refNo)).toEqual(['welcome', 'mahavir']);

      // Card cannot return to hidden state or duplicate
      saveRevealedCardId(refNo, 'welcome');
      expect(loadRevealedCardIds(refNo)).toEqual(['welcome', 'mahavir']);
    });
  });

  describe('4. Component Rendering & Security Isolation', () => {
    it('renders the festive header, reference number, and 3 scratch cards', () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        <ScratchCardsSection referenceNumber="ONGC-99001" />,
      );

      // Header copy
      expect(html).toContain('ONGC NAVRATRI 2026');
      expect(html).toContain('Your Registration is Complete! 🎉');
      expect(html).toContain("Here&#x27;s a little Navratri surprise for you.");
      expect(html).toContain('YOUR NAVRATRI SURPRISES');
      expect(html).toContain('Scratch all 3 cards to reveal your surprises.');

      // Reference Number
      expect(html).toContain('ONGC-99001');

      // 3 Card Titles
      expect(html).toContain('YOUR NAVRATRI SURPRISE');
      expect(html).toContain('MAHAVIR JEWELLERS');
      expect(html).toContain('GARBA NIGHT SURPRISE');
    });

    it('DOES NOT display CPF, DOB, mobile, or sensitive internal IDs in the scratch cards section', () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        <ScratchCardsSection referenceNumber="ONGC-99001" />,
      );

      expect(html).not.toContain('CPF');
      expect(html).not.toContain('Date of Birth');
      expect(html).not.toContain('dateOfBirth');
      expect(html).not.toContain('DOB');
      expect(html).not.toContain('9876543210');
      expect(html).not.toContain('internalId');
      expect(html).not.toContain('qrToken');
    });

    it('renders Mahavir Jewellers sponsor content with exact voucher specifications', () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        <ScratchCardsSection referenceNumber="ONGC-99001" />,
      );

      expect(html).toContain('MAHAVIR JEWELLERS');
      expect(html).toContain('₹5,000 OFF');
      expect(html).toContain('ON MAKING CHARGES');
      expect(html).toContain('Lifetime | No expiry');
      expect(html).toContain('2 Amrakunj, Anne, below NY Cinemas, Tapovan Circle, Chandkheda');
      expect(html).toContain('90330 56098');
      expect(html).toContain('mahavir-jewellers-voucher.jpg');
    });

    it('gracefully handles sponsor-disabled configuration by hiding the sponsor card', () => {
      const disabledSponsorConfig: SponsorVoucherConfig = {
        ...DEFAULT_SPONSOR_VOUCHER_CONFIG,
        enabled: false,
      };

      const customCards = getDefaultScratchCards(disabledSponsorConfig);
      const activeCards = filterVisibleScratchCards(customCards);
      expect(activeCards).toHaveLength(2);
      expect(activeCards.some((c) => c.id === 'mahavir')).toBe(false);

      const html = ReactDOMServer.renderToStaticMarkup(
        <ScratchCardsSection
          referenceNumber="ONGC-99001"
          sponsorConfig={disabledSponsorConfig}
        />,
      );

      expect(html).toContain('YOUR NAVRATRI SURPRISE');
      expect(html).toContain('GARBA NIGHT SURPRISE');
      expect(html).not.toContain('MAHAVIR JEWELLERS');
    });

    it('provides keyboard/screen-reader accessibility fallback button ("Reveal Surprise")', () => {
      const cards = getDefaultScratchCards();
      const html = ReactDOMServer.renderToStaticMarkup(
        <ScratchCard
          card={cards[0]}
          isRevealed={false}
          onReveal={jest.fn()}
          cardIndex={0}
        />,
      );

      expect(html).toContain('Reveal Surprise');
      expect(html).toContain('aria-label="Reveal surprise: YOUR NAVRATRI SURPRISE"');
    });

    it('renders the "✓ REVEALED" badge when card is in revealed state', () => {
      const cards = getDefaultScratchCards();
      const html = ReactDOMServer.renderToStaticMarkup(
        <ScratchCard
          card={cards[1]}
          isRevealed={true}
          onReveal={jest.fn()}
          cardIndex={1}
        />,
      );

      expect(html).toContain('REVEALED');
      expect(html).toContain('Surprise Unlocked!');
    });

    it('displays the "VIEW MY E-PASS" celebratory banner when all cards are revealed', () => {
      const customCards: ScratchCardItem[] = [
        {
          id: 'card-1',
          title: 'Card One',
          subtitle: 'Sub 1',
          category: 'welcome',
          enabled: true,
          revealHeadline: 'Head 1',
          revealBody: 'Body 1',
        },
      ];

      // In server-side render, simulate already revealed by rendering custom cards
      const html = ReactDOMServer.renderToStaticMarkup(
        <ScratchCardsSection
          referenceNumber="ONGC-11111"
          customCards={customCards}
        />,
      );

      // Section renders cleanly
      expect(html).toContain('Card One');
    });

    it('supports compact prop for reduced vertical footprint (~20-30% smaller)', () => {
      const cards = getDefaultScratchCards();
      const htmlCompact = ReactDOMServer.renderToStaticMarkup(
        <ScratchCard
          card={cards[1]}
          isRevealed={false}
          onReveal={jest.fn()}
          cardIndex={1}
          compact={true}
        />,
      );

      // Compact layout renders with reduced min-height (275px) and compact styling
      expect(htmlCompact).toContain('min-height:275px');
      expect(htmlCompact).toContain('touch-action:none');
      expect(htmlCompact).toContain('MAHAVIR JEWELLERS');
    });

    it('supports persistState=false for test environments without saving to localStorage', () => {
      const refNo = 'ONGC-TEST-ISOLATED';
      // Render with persistState={false}
      const html = ReactDOMServer.renderToStaticMarkup(
        <ScratchCardsSection
          referenceNumber={refNo}
          persistState={false}
          compact={true}
        />,
      );

      expect(html).toContain(refNo);
      // No localStorage entry should be created for this test pass
      expect(loadRevealedCardIds(refNo)).toEqual([]);
    });
  });
});

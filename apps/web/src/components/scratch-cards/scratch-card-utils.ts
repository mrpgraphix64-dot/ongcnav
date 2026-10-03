import { ScratchCardItem } from '@/types/shared-types';

/**
 * Scratch Card interaction & storage utilities for ONGC Navratri 2026.
 */

export const DEFAULT_REVEAL_THRESHOLD = 0.48; // 48% (within the 45% - 55% specified range)

/**
 * Calculate the percentage of cleared/transparent pixels from sampled alpha values.
 * @param alphaValues Array of alpha channel values (0-255).
 * @returns A ratio between 0.0 and 1.0 representing scratched/revealed area.
 */
export function calculateScratchedPercentage(alphaValues: number[] | Uint8Array | Uint8ClampedArray): number {
  if (!alphaValues || alphaValues.length === 0) {
    return 0;
  }

  let clearedCount = 0;
  for (let i = 0; i < alphaValues.length; i++) {
    // Treat pixels with alpha < 128 as cleared
    if (alphaValues[i] < 128) {
      clearedCount++;
    }
  }

  return clearedCount / alphaValues.length;
}

/**
 * Checks if the scratched area has reached the auto-reveal threshold.
 */
export function isRevealThresholdReached(
  ratio: number,
  threshold: number = DEFAULT_REVEAL_THRESHOLD,
): boolean {
  return ratio >= threshold;
}

/**
 * Generates a storage key for saving revealed states tied to an employee pass reference number.
 */
export function getScratchStorageKey(referenceNumber?: string | null): string {
  const cleanRef = (referenceNumber || 'DEMO').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  return `ongc_navratri_scratch_${cleanRef || 'DEFAULT'}`;
}

// In-memory fallback for environments without localStorage (SSR, Node tests, privacy mode)
const memoryStorage = new Map<string, string>();

/**
 * Safely loads the list of revealed card IDs from browser storage or memory fallback.
 */
export function loadRevealedCardIds(referenceNumber?: string | null): string[] {
  const key = getScratchStorageKey(referenceNumber);

  try {
    let item: string | null = null;
    if (typeof window !== 'undefined' && window.localStorage) {
      item = window.localStorage.getItem(key) || window.sessionStorage?.getItem(key);
    } else {
      item = memoryStorage.get(key) || null;
    }
    if (!item) return [];

    const parsed = JSON.parse(item);
    if (Array.isArray(parsed)) {
      return parsed.filter((id) => typeof id === 'string');
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Safely saves a newly revealed card ID to browser storage or memory fallback.
 */
export function saveRevealedCardId(
  referenceNumber: string | null | undefined,
  cardId: string,
): string[] {
  const key = getScratchStorageKey(referenceNumber);

  try {
    const current = loadRevealedCardIds(referenceNumber);
    if (!current.includes(cardId)) {
      current.push(cardId);
    }
    const serialized = JSON.stringify(current);

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(key, serialized);
      } catch {
        window.sessionStorage?.setItem(key, serialized);
      }
    } else {
      memoryStorage.set(key, serialized);
    }
    return current;
  } catch {
    return [cardId];
  }
}

/**
 * Clears memory storage (useful in tests).
 */
export function clearScratchStorage(): void {
  memoryStorage.clear();
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.clear();
      window.sessionStorage.clear();
    } catch {
      // ignore
    }
  }
}

/**
 * Filters cards to only those that are active/enabled.
 */
export function filterVisibleScratchCards(cards: ScratchCardItem[]): ScratchCardItem[] {
  return (cards || []).filter((c) => c && c.enabled !== false);
}

/**
 * Draws the aesthetic festive gold/cream scratch surface onto the canvas.
 */
export function drawFestiveScratchSurface(
  canvas: HTMLCanvasElement,
  cardBadge: string = 'NAVRATRI 2026',
  cssWidth?: number,
  cssHeight?: number,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = cssWidth ?? canvas.width;
  const height = cssHeight ?? canvas.height;

  // 1. Base metallic gold gradient
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, '#D4AF37'); // Classic gold
  grad.addColorStop(0.25, '#FAF0C8'); // Pale gold shimmer
  grad.addColorStop(0.5, '#C59B27'); // Deep antique gold
  grad.addColorStop(0.75, '#F5DE88'); // Soft warm gold
  grad.addColorStop(1, '#A07818'); // Burnished gold base

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // 2. Subtle festive geometric texture / rangoli lines
  ctx.save();
  ctx.strokeStyle = 'rgba(128, 0, 32, 0.08)'; // Subtle maroon tint
  ctx.lineWidth = 1.5;

  const step = 28;
  for (let x = -height; x < width + height; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + height, height);
    ctx.stroke();
  }

  for (let x = width + height; x > -height; x -= step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x - height, height);
    ctx.stroke();
  }
  ctx.restore();

  // 3. Elegant double gold border
  ctx.save();
  ctx.strokeStyle = '#8B6508'; // Muted dark gold
  ctx.lineWidth = 3;
  ctx.strokeRect(10, 10, width - 20, height - 20);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(15, 15, width - 30, height - 30);
  ctx.restore();

  // 4. Subtle center mandala / rangoli circle
  const centerX = width / 2;
  const centerY = height / 2 - (height > 360 ? 15 : 6);
  const radius = Math.min(width, height) * (height > 360 ? 0.32 : 0.28);

  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(centerX, centerY, radius * 0.75, 0, Math.PI * 2);
  ctx.stroke();

  // 8-spoke mandala rays
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4;
    const x1 = centerX + Math.cos(angle) * (radius * 0.4);
    const y1 = centerY + Math.sin(angle) * (radius * 0.4);
    const x2 = centerX + Math.cos(angle) * radius;
    const y2 = centerY + Math.sin(angle) * radius;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  ctx.restore();

  // 5. Center Badge Card (Adaptive height for compact card)
  const isCompact = height <= 360;
  const badgeW = Math.min(width - 40, isCompact ? 190 : 220);
  const badgeH = isCompact ? 86 : 110;
  const badgeX = (width - badgeW) / 2;
  const badgeY = centerY - badgeH / 2 + (isCompact ? 0 : 5);

  ctx.save();
  ctx.fillStyle = '#FFFDF7'; // Warm ivory pill
  ctx.shadowColor = 'rgba(60, 20, 10, 0.2)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 4;

  // Draw rounded rect
  const r = 14;
  ctx.beginPath();
  ctx.moveTo(badgeX + r, badgeY);
  ctx.lineTo(badgeX + badgeW - r, badgeY);
  ctx.quadraticCurveTo(badgeX + badgeW, badgeY, badgeX + badgeW, badgeY + r);
  ctx.lineTo(badgeX + badgeW, badgeY + badgeH - r);
  ctx.quadraticCurveTo(badgeX + badgeW, badgeY + badgeH, badgeX + badgeW - r, badgeY + badgeH);
  ctx.lineTo(badgeX + r, badgeY + badgeH);
  ctx.quadraticCurveTo(badgeX, badgeY + badgeH, badgeX, badgeY + badgeH - r);
  ctx.lineTo(badgeX, badgeY + r);
  ctx.quadraticCurveTo(badgeX, badgeY, badgeX + r, badgeY);
  ctx.closePath();
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = '#D4AF37';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Badge typography
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Festive Tag
  ctx.font = 'bold 9px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#800020'; // Deep Maroon
  ctx.letterSpacing = '1px';
  ctx.fillText(cardBadge.toUpperCase(), centerX, badgeY + (isCompact ? 16 : 22));

  // Main Callout: "SCRATCH TO REVEAL"
  ctx.font = isCompact ? '900 13px Georgia, serif' : '900 15px Georgia, serif';
  ctx.fillStyle = '#5B0612';
  ctx.fillText('SCRATCH TO REVEAL', centerX, badgeY + (isCompact ? 38 : 48));

  // Decorative divider in badge
  ctx.strokeStyle = '#E5C158';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(centerX - 30, badgeY + (isCompact ? 50 : 63));
  ctx.lineTo(centerX + 30, badgeY + (isCompact ? 50 : 63));
  ctx.stroke();

  // Subtitle / gesture prompt
  ctx.font = '500 9px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#785A28';
  ctx.fillText('Rub with finger or mouse', centerX, badgeY + (isCompact ? 64 : 80));
  if (!isCompact) {
    ctx.fillText('✨', centerX, badgeY + 95);
  }
  ctx.restore();

  // 6. Bottom subtle indicator
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = '600 10px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#614810';
  ctx.fillText('TOUCH & SCRATCH', centerX, height - (isCompact ? 18 : 26));
  ctx.restore();
}

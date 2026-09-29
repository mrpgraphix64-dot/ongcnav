// Meta Pixel (Facebook Pixel) — thin, typed wrapper around the global `fbq`
// loaded by the base snippet in app/layout.tsx. Kept in one place so no
// other file needs to touch `window.fbq` directly or duplicate the
// dedup-guard logic for the Purchase event.

export const META_PIXEL_ID = '927960190040248';

type FbqEventParams = Record<string, string | number | boolean | undefined>;

type Fbq = {
  (command: 'init', pixelId: string): void;
  (command: 'track', eventName: string, params?: FbqEventParams): void;
  (command: 'trackCustom', eventName: string, params?: FbqEventParams): void;
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[];
  loaded?: boolean;
  version?: string;
};

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

// Orders whose Purchase event has already been sent this page session.
// Module-level (not component state) so it survives remounts of whatever
// component fires it, but is naturally reset on a full page reload —
// exactly the "one verified order -> one browser event" scope needed here.
const firedPurchaseOrderNumbers = new Set<string>();

/**
 * Fire a Meta Pixel Purchase event exactly once per orderNumber.
 * Safe to call multiple times (e.g. if a success handler re-runs on
 * re-render) — every call after the first for the same orderNumber is a
 * no-op.
 */
export function trackPurchaseOnce(orderNumber: string, amountInr: number, currency = 'INR'): void {
  if (!orderNumber || typeof window === 'undefined' || !window.fbq) return;
  if (firedPurchaseOrderNumbers.has(orderNumber)) return;

  firedPurchaseOrderNumbers.add(orderNumber);
  window.fbq('track', 'Purchase', {
    value: amountInr,
    currency,
  });
}

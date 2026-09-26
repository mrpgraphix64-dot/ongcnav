/**
 * Safe order resolution and Razorpay checkout options helpers for /bookpass.
 */

export interface OrderCustomer {
  name?: string;
  email?: string;
  mobile?: string;
}

export interface OrderPayloadLike {
  orderNumber?: string;
  amountPaise?: number;
  amountInr?: number;
  currency?: string;
  quantity?: number;
  ticketType?: string;
  selectedDates?: string[];
  orderStatus?: string;
  paymentStatus?: string;
  razorpayOrderId?: string;
  razorpayKeyId?: string;
  isTestPayment?: boolean;
  testPaymentReference?: string;
  customer?: OrderCustomer;
}

export interface CreateOrderResponseLike {
  success?: boolean;
  isTestPayment?: boolean;
  message?: string;
  order?: OrderPayloadLike;
  passes?: any[];
}

/**
 * Checks whether an order response represents a completed staging test payment order.
 * Safe against missing/undefined properties, non-array passes, or legacy payloads.
 */
export function isStagingTestOrder(
  res?: CreateOrderResponseLike | null,
  orderData?: OrderPayloadLike | null,
): boolean {
  return Boolean(
    (res?.isTestPayment || orderData?.isTestPayment) &&
      Array.isArray(res?.passes) &&
      res.passes.length > 0,
  );
}

/**
 * Safely resolves the Razorpay order ID to pass to Razorpay Standard Checkout:
 * - If undefined, null, or not a string: returns undefined (NEVER throws startsWith TypeError)
 * - If starts with 'order_mock_': returns undefined (mock test ID omitted for Razorpay Standard Checkout)
 * - Otherwise returns the real string order ID (e.g. 'order_DBJOWzybf0sJbb')
 */
export function resolveRazorpayOrderId(rawOrderId: unknown): string | undefined {
  if (typeof rawOrderId !== 'string') {
    return undefined;
  }
  if (rawOrderId.startsWith('order_mock_')) {
    return undefined;
  }
  return rawOrderId.trim() || undefined;
}

/**
 * Replaces the current selected booking date with the newly chosen date.
 * Single date selection rule: Tapping another date REPLACES the previous date (no multi-select).
 */
export function selectSingleBookingDate(_currentDate: string, newDate: string): string {
  return newDate;
}

/**
 * Resolves the dates array to send to the backend for an order:
 * - For Season Pass: automatically covers all event dates.
 * - For Daily / Mandli / Any Day Pass: exactly ONE date in the array ([selectedDate]).
 */
export function resolveOrderSelectedDates(
  ticketType: string,
  selectedDate: string,
  allEventDates: string[],
): string[] {
  if (ticketType === 'COMMERCIAL_SEASON') {
    return [...allEventDates];
  }
  return [selectedDate];
}

const INDIAN_MOBILE_REGEX = /^[6-9][0-9]{9}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates customer details for commercial pass checkout:
 * - Full Name (at least 2 chars)
 * - Indian Mobile (10 digits starting with 6, 7, 8, 9)
 * - Email address (mandatory, valid email format)
 */
export function validateCustomerDetails(
  name: string,
  phone: string,
  email: string,
): { isValid: boolean; error?: string } {
  if (!name.trim() || name.trim().length < 2) {
    return { isValid: false, error: 'Please enter your full name (at least 2 characters).' };
  }
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  if (!INDIAN_MOBILE_REGEX.test(cleanPhone)) {
    return {
      isValid: false,
      error: 'Please enter a valid 10-digit Indian mobile number (starting with 6, 7, 8, or 9).',
    };
  }
  if (!email.trim()) {
    return {
      isValid: false,
      error: 'Email address is required because your digital QR pass will be sent here.',
    };
  }
  if (!EMAIL_REGEX.test(email.trim())) {
    return { isValid: false, error: 'Please enter a valid email address.' };
  }
  return { isValid: true };
}

/**
 * Calculates commercial order pricing totals.
 */
export function calculateCommercialTotals(
  unitPrice: number,
  originalUnitPrice: number,
  quantity: number,
) {
  const qty = Math.max(1, Math.min(10, Math.floor(quantity)));
  const total = unitPrice * qty;
  const originalTotal = originalUnitPrice * qty;
  const savings = Math.max(0, originalTotal - total);
  return {
    quantity: qty,
    unitPrice,
    originalUnitPrice,
    total,
    originalTotal,
    savings,
  };
}

/**
 * Validates mandatory agreement to ticket terms & conditions.
 */
export function validateBookingTerms(termsAccepted: boolean): { isValid: boolean; error?: string } {
  if (!termsAccepted) {
    return {
      isValid: false,
      error: 'Please accept the ticket terms & conditions to continue.',
    };
  }
  return { isValid: true };
}

/**
 * Returns the authoritative event timing for each pass type.
 */
export function getPassTiming(ticketType: string): string {
  if (ticketType === 'COMMERCIAL_MANDLI') {
    return '12:00 AM – 4:00 AM';
  }
  return '8:00 PM – 4:00 AM';
}

/**
 * Returns the human-readable label for a pass type.
 */
export function getPassTypeLabel(ticketType: string): string {
  switch (ticketType) {
    case 'COMMERCIAL_SEASON':
      return 'Season Pass (All 9 Nights)';
    case 'COMMERCIAL_MANDLI':
      return 'Mandli Pass';
    case 'COMMERCIAL_ANY_DAY':
      return 'Any Day Pass';
    case 'COMMERCIAL_DAILY':
    default:
      return 'Daily Entry Pass';
  }
}

/**
 * Formats confirmed dates for display on digital passes and booking summaries.
 */
export function formatConfirmedDates(dates: string[] | undefined, ticketType: string): string {
  if (ticketType === 'COMMERCIAL_SEASON') {
    return '11–19 October 2026 (All 9 Nights)';
  }
  if (!dates || dates.length === 0) {
    return '11–19 October 2026';
  }
  return dates
    .map((d) => {
      const dt = new Date(d + 'T00:00:00');
      return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    })
    .join(', ');
}

/**
 * Escapes characters for safe inclusion in SVG / XML elements and attributes.
 * Predefined XML entities: &amp;, &lt;, &gt;, &quot;, &apos;
 */
export function escapeXml(unsafe: string): string {
  return (unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export interface GeneratePassSvgOptions {
  ticketNumber: string;
  name?: string;
  passTypeLabel: string;
  formattedDates: string;
  qrSvg: string;
}

/**
 * Generates a self-contained, high-resolution downloadable SVG digital pass card.
 *
 * Security & Functional Guarantees:
 * 1. Contains NO raw QR token as visible text (QR token is encoded strictly in matrix paths).
 * 2. Contains NO database or internal IDs (no internal PKs, no user/order UUIDs).
 * 3. Contains NO Razorpay or payment IDs (no order_id, payment_id, signatures).
 * 4. Contains only intended ticket info: ONGC Navratri 2026, pass type, attendee name, ticket number, event date, QR.
 * 5. QR code preserves original viewBox, crispEdges, and quiet zone padding for instant scanning.
 * 6. Completely self-contained: zero external network dependencies, fonts, or external images.
 */
export function generateDownloadablePassSvg(options: GeneratePassSvgOptions): string {
  const { ticketNumber, name, passTypeLabel, formattedDates, qrSvg } = options;

  const escapedName = escapeXml(name?.trim() || 'Pass Holder');
  const escapedTicketNumber = escapeXml(ticketNumber?.trim() || 'PASS-ENTRY');
  const escapedPassType = escapeXml(passTypeLabel || 'Entry Pass');
  const escapedDates = escapeXml(formattedDates || '11–19 October 2026');

  // Extract viewBox and inner paths from the qrSvg
  const viewBoxMatch = qrSvg.match(/viewBox="([^"]+)"/i);
  const viewBox = viewBoxMatch ? viewBoxMatch[1] : '0 0 33 33';
  const innerPaths = qrSvg
    .replace(/<\?xml[^>]*\?>/gi, '')
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/<svg[^>]*>/i, '')
    .replace(/<\/svg>/i, '')
    .trim();

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 440 660" width="440" height="660">
  <rect width="440" height="660" rx="24" fill="#FFFFFF" stroke="#D4AF37" stroke-width="2"/>
  <rect x="0" y="0" width="440" height="12" rx="6" fill="#781014"/>
  <text x="220" y="44" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="900" fill="#781014" text-anchor="middle" letter-spacing="2">ONGC NAVRATRI 2026</text>
  <text x="220" y="66" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700" fill="#85581A" text-anchor="middle" letter-spacing="1.5">OFFICIAL ENTRY PASS</text>
  <rect x="70" y="80" width="300" height="28" rx="14" fill="#FBF3DB" stroke="#D4AF37" stroke-width="1"/>
  <text x="220" y="99" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="700" fill="#781014" text-anchor="middle">${escapedPassType}</text>
  <text x="220" y="136" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="10" font-weight="700" fill="#71717A" text-anchor="middle" letter-spacing="1">PASS HOLDER</text>
  <text x="220" y="162" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="800" fill="#18181B" text-anchor="middle">${escapedName}</text>
  <rect x="70" y="180" width="300" height="300" rx="16" fill="#FFFFFF" stroke="#E4E4E7" stroke-width="1.5"/>
  <svg x="90" y="200" width="260" height="260" viewBox="${viewBox}" shape-rendering="crispEdges">
    ${innerPaths}
  </svg>
  <text x="220" y="504" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="11" font-weight="700" fill="#781014" text-anchor="middle" letter-spacing="2">SCAN AT ENTRY</text>
  <rect x="30" y="525" width="380" height="95" rx="14" fill="#FDFBF7" stroke="#E4E4E7" stroke-width="1"/>
  <text x="50" y="550" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="9" font-weight="700" fill="#71717A" letter-spacing="1">TICKET ID</text>
  <text x="50" y="572" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="13" font-weight="700" fill="#781014">${escapedTicketNumber}</text>
  <text x="240" y="550" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="9" font-weight="700" fill="#71717A" letter-spacing="1">EVENT DATE</text>
  <text x="240" y="572" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="600" fill="#18181B">${escapedDates}</text>
  <text x="220" y="605" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="9" font-weight="600" fill="#71717A" text-anchor="middle">Venue: ONGC Navratri Grounds, Ahmedabad &#8226; Valid with Govt ID</text>
</svg>`;
}

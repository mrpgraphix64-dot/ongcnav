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

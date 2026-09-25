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

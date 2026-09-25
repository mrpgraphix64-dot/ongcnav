/**
 * Utilities and validation helpers for attendee ticket & commercial order lookup (/my-tickets)
 */

export function validateCpfLookup(cpf: string): {
  isValid: boolean;
  cleanCpf: string;
  error?: string;
} {
  const cleanCpf = (cpf || '').trim().toUpperCase();
  if (!cleanCpf) {
    return {
      isValid: false,
      cleanCpf: '',
      error: 'Please enter your ONGC CPF number or Ticket ID',
    };
  }
  return { isValid: true, cleanCpf };
}

export function normalizeIndianMobile(mobile: string): string {
  if (!mobile) return '';
  const digits = mobile.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }
  return digits;
}

export function validateCommercialLookup(
  orderNumber: string,
  mobile: string,
): {
  isValid: boolean;
  cleanOrderNumber: string;
  cleanMobile: string;
  error?: string;
} {
  const cleanOrderNumber = (orderNumber || '').trim().toUpperCase();
  if (!cleanOrderNumber) {
    return {
      isValid: false,
      cleanOrderNumber: '',
      cleanMobile: '',
      error: 'Please enter your Commercial Order number (e.g. ORD-COMM-...)',
    };
  }

  const cleanMobile = normalizeIndianMobile(mobile);
  if (!cleanMobile) {
    return {
      isValid: false,
      cleanOrderNumber,
      cleanMobile: '',
      error: 'Please enter your 10-digit mobile number',
    };
  }

  if (!/^[6-9]\d{9}$/.test(cleanMobile)) {
    return {
      isValid: false,
      cleanOrderNumber,
      cleanMobile,
      error: 'Please enter a valid 10-digit Indian mobile number (starting with 6, 7, 8, or 9)',
    };
  }

  return {
    isValid: true,
    cleanOrderNumber,
    cleanMobile,
  };
}

export function buildCommercialOrderUrl(orderNumber: string, mobile: string): string {
  const cleanOrder = (orderNumber || '').trim().toUpperCase();
  const cleanMob = normalizeIndianMobile(mobile);
  return `/commercial/orders/${encodeURIComponent(cleanOrder)}?mobile=${encodeURIComponent(cleanMob)}`;
}

export function formatPassDates(dates?: string[] | null, ticketType?: string): string {
  if (ticketType === 'SEASON') {
    return '11–19 October 2026 (All 9 Days)';
  }
  if (!dates || dates.length === 0) {
    return '11–19 October 2026';
  }
  if (dates.length >= 9) {
    return 'All 9 Days (11–19 Oct 2026)';
  }

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const formatted = dates.map((d) => {
    const parts = d.split('-');
    if (parts.length === 3) {
      const day = parseInt(parts[2], 10);
      const mIdx = parseInt(parts[1], 10) - 1;
      return `${day} ${monthNames[mIdx] || parts[1]}`;
    }
    return d;
  });
  return formatted.join(', ');
}

export interface OrderStatusBadge {
  label: string;
  badgeClass: string;
  isPaid: boolean;
  isPending: boolean;
  isFailed: boolean;
  isTest?: boolean;
}

export function getOrderStatusBadge(
  orderStatus?: string,
  paymentStatus?: string,
  isTestPayment?: boolean,
): OrderStatusBadge {
  const status = (orderStatus || '').toUpperCase();
  const payStatus = (paymentStatus || '').toUpperCase();

  if (isTestPayment || payStatus === 'TEST_PAID') {
    return {
      label: 'STAGING TEST PAYMENT',
      badgeClass: 'bg-amber-100 text-amber-900 border-amber-300 font-bold',
      isPaid: true,
      isPending: false,
      isFailed: false,
      isTest: true,
    };
  }

  if (status === 'PAID' || payStatus === 'CAPTURED') {
    return {
      label: 'PAID & CONFIRMED',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      isPaid: true,
      isPending: false,
      isFailed: false,
    };
  }

  if (status === 'PENDING' || payStatus === 'CREATED') {
    return {
      label: 'PAYMENT PENDING',
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
      isPaid: false,
      isPending: true,
      isFailed: false,
    };
  }

  if (status === 'FAILED' || payStatus === 'FAILED') {
    return {
      label: 'PAYMENT FAILED',
      badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
      isPaid: false,
      isPending: false,
      isFailed: true,
    };
  }

  if (status === 'CANCELLED') {
    return {
      label: 'CANCELLED',
      badgeClass: 'bg-stone-100 text-stone-700 border-stone-300',
      isPaid: false,
      isPending: false,
      isFailed: true,
    };
  }

  return {
    label: status || 'UNKNOWN',
    badgeClass: 'bg-stone-100 text-stone-700 border-stone-300',
    isPaid: false,
    isPending: false,
    isFailed: false,
  };
}

export function validateEmailRecoveryRequest(
  orderNumber: string,
  mobile: string,
): { isValid: boolean; cleanOrderNumber: string; cleanMobile: string; error?: string } {
  return validateCommercialLookup(orderNumber, mobile);
}

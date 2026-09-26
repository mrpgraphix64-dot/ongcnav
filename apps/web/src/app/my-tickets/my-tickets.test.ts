/// <reference types="jest" />
import {
  validateCpfLookup,
  normalizeIndianMobile,
  validateCommercialLookup,
  buildCommercialOrderUrl,
  formatPassDates,
  getOrderStatusBadge,
  validateEmailRecoveryRequest,
} from './my-tickets-utils';

describe('My-Tickets: CPF Lookup Validation (validateCpfLookup)', () => {
  it('accepts valid ONGC CPF number and ticket references', () => {
    const res1 = validateCpfLookup('123456');
    expect(res1.isValid).toBe(true);
    expect(res1.cleanCpf).toBe('123456');

    const res2 = validateCpfLookup('NR2026-000001');
    expect(res2.isValid).toBe(true);
    expect(res2.cleanCpf).toBe('NR2026-000001');
  });

  it('trims leading/trailing whitespace and normalizes to uppercase', () => {
    const res = validateCpfLookup('  nr2026-000042  ');
    expect(res.isValid).toBe(true);
    expect(res.cleanCpf).toBe('NR2026-000042');
  });

  it('rejects empty or whitespace-only inputs with an informative error', () => {
    const res1 = validateCpfLookup('');
    expect(res1.isValid).toBe(false);
    expect(res1.error).toContain('Please enter your ONGC CPF number');

    const res2 = validateCpfLookup('    ');
    expect(res2.isValid).toBe(false);
  });
});

describe('My-Tickets: Indian Mobile Normalization (normalizeIndianMobile)', () => {
  it('preserves clean 10-digit mobile numbers', () => {
    expect(normalizeIndianMobile('9876543210')).toBe('9876543210');
  });

  it('strips non-digit formatting characters like spaces and dashes', () => {
    expect(normalizeIndianMobile('98765 43210')).toBe('9876543210');
    expect(normalizeIndianMobile('98765-43210')).toBe('9876543210');
  });

  it('strips international +91 prefix when 12 digits provided', () => {
    expect(normalizeIndianMobile('+91 9876543210')).toBe('9876543210');
    expect(normalizeIndianMobile('919876543210')).toBe('9876543210');
  });

  it('strips leading trunk zero when 11 digits provided', () => {
    expect(normalizeIndianMobile('09876543210')).toBe('9876543210');
  });
});

describe('My-Tickets: Commercial Order Lookup Validation (validateCommercialLookup)', () => {
  it('accepts valid commercial order number and Indian mobile', () => {
    const res = validateCommercialLookup('ord-comm-20261011-xyz123', '9876543210');
    expect(res.isValid).toBe(true);
    expect(res.cleanOrderNumber).toBe('ORD-COMM-20261011-XYZ123');
    expect(res.cleanMobile).toBe('9876543210');
    expect(res.error).toBeUndefined();
  });

  it('accepts mobile numbers starting with 6, 7, 8, 9', () => {
    expect(validateCommercialLookup('ORD-1', '6123456789').isValid).toBe(true);
    expect(validateCommercialLookup('ORD-1', '7123456789').isValid).toBe(true);
    expect(validateCommercialLookup('ORD-1', '8123456789').isValid).toBe(true);
    expect(validateCommercialLookup('ORD-1', '9123456789').isValid).toBe(true);
  });

  it('rejects missing or empty order number', () => {
    const res = validateCommercialLookup('   ', '9876543210');
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('E-Pass Order Number');
  });

  it('rejects empty or missing mobile number', () => {
    const res = validateCommercialLookup('ORD-COMM-1', '');
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('mobile number');
  });

  it('rejects invalid mobile numbers (starts with 0-5 or wrong length)', () => {
    const res1 = validateCommercialLookup('ORD-COMM-1', '5123456789');
    expect(res1.isValid).toBe(false);
    expect(res1.error).toContain('valid 10-digit Indian mobile');

    const res2 = validateCommercialLookup('ORD-COMM-1', '98765');
    expect(res2.isValid).toBe(false);

    const res3 = validateCommercialLookup('ORD-COMM-1', '987654321000');
    expect(res3.isValid).toBe(false);
  });
});

describe('My-Tickets: Commercial URL Builder (buildCommercialOrderUrl)', () => {
  it('builds encoded URL for commercial order endpoint', () => {
    const url = buildCommercialOrderUrl('ord-comm-20261011-abc', '+91 98765 43210');
    expect(url).toBe('/commercial/orders/ORD-COMM-20261011-ABC?mobile=9876543210');
  });

  it('properly encodes special characters in order number', () => {
    const url = buildCommercialOrderUrl('ORD/TEST#1', '9876543210');
    expect(url).toBe('/commercial/orders/ORD%2FTEST%231?mobile=9876543210');
  });
});

describe('My-Tickets: Pass Dates Formatter (formatPassDates)', () => {
  it('formats season pass as All 9 Days', () => {
    expect(formatPassDates(['2026-10-11'], 'SEASON')).toContain('All 9 Days');
  });

  it('formats single daily pass date', () => {
    expect(formatPassDates(['2026-10-11'])).toBe('11 Oct');
  });

  it('formats multiple dates into comma-separated list', () => {
    expect(formatPassDates(['2026-10-11', '2026-10-13'])).toBe('11 Oct, 13 Oct');
  });

  it('falls back to default event dates if empty or null', () => {
    expect(formatPassDates(null)).toBe('11–19 October 2026');
    expect(formatPassDates([])).toBe('11–19 October 2026');
  });
});

describe('My-Tickets: Order Status Badge Classifier (getOrderStatusBadge)', () => {
  it('classifies PAID order as paid and confirmed', () => {
    const badge = getOrderStatusBadge('PAID', 'CAPTURED');
    expect(badge.isPaid).toBe(true);
    expect(badge.label).toBe('PAID & CONFIRMED');
    expect(badge.badgeClass).toContain('emerald');
  });

  it('classifies PENDING order as payment pending', () => {
    const badge = getOrderStatusBadge('PENDING', 'CREATED');
    expect(badge.isPending).toBe(true);
    expect(badge.label).toBe('PAYMENT PENDING');
    expect(badge.badgeClass).toContain('amber');
  });

  it('classifies staging test payment orders with STAGING TEST PAYMENT label and badge', () => {
    const testBadge = getOrderStatusBadge('PAID', 'AUTHORIZED', true);
    expect(testBadge.isPaid).toBe(true);
    expect(testBadge.isTest).toBe(true);
    expect(testBadge.label).toBe('STAGING TEST PAYMENT');
    expect(testBadge.badgeClass).toContain('amber');

    const testBadgeViaStatus = getOrderStatusBadge('PAID', 'TEST_PAID');
    expect(testBadgeViaStatus.isPaid).toBe(true);
    expect(testBadgeViaStatus.isTest).toBe(true);
    expect(testBadgeViaStatus.label).toBe('STAGING TEST PAYMENT');
  });

  it('classifies FAILED or CANCELLED orders as failed', () => {
    const failedBadge = getOrderStatusBadge('FAILED', 'FAILED');
    expect(failedBadge.isFailed).toBe(true);
    expect(failedBadge.label).toBe('PAYMENT FAILED');
    expect(failedBadge.badgeClass).toContain('rose');

    const cancelledBadge = getOrderStatusBadge('CANCELLED');
    expect(cancelledBadge.isFailed).toBe(true);
    expect(cancelledBadge.label).toBe('CANCELLED');
  });
});

describe('My-Tickets: Email Ticket Recovery Validation (validateEmailRecoveryRequest)', () => {
  it('validates and normalizes valid order number and 10-digit mobile', () => {
    const res = validateEmailRecoveryRequest('ord-comm-20261011-xyz', '+91 98765 43210');
    expect(res.isValid).toBe(true);
    expect(res.cleanOrderNumber).toBe('ORD-COMM-20261011-XYZ');
    expect(res.cleanMobile).toBe('9876543210');
  });

  it('rejects recovery when mobile number is missing or invalid', () => {
    const res = validateEmailRecoveryRequest('ORD-COMM-1', '12345');
    expect(res.isValid).toBe(false);
    expect(res.error).toBeDefined();
  });
});

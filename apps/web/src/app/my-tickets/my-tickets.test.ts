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
  it('accepts valid commercial order number and registered email', () => {
    const res = validateCommercialLookup('ord-comm-20261011-xyz123', 'test@example.com');
    expect(res.isValid).toBe(true);
    expect(res.cleanOrderNumber).toBe('ORD-COMM-20261011-XYZ123');
    expect(res.cleanEmail).toBe('test@example.com');
    expect(res.error).toBeUndefined();
  });

  it('normalizes email and order number (trims and lowercases email, uppercases order)', () => {
    const res = validateCommercialLookup('  ord-comm-123  ', '  USER@Test.COM  ');
    expect(res.isValid).toBe(true);
    expect(res.cleanOrderNumber).toBe('ORD-COMM-123');
    expect(res.cleanEmail).toBe('user@test.com');
  });

  it('rejects missing or empty order number', () => {
    const res = validateCommercialLookup('   ', 'test@example.com');
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('E-Pass Order Number');
  });

  it('rejects empty or missing email', () => {
    const res = validateCommercialLookup('ORD-COMM-1', '');
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('email address');
  });

  it('rejects invalid email formats', () => {
    const res1 = validateCommercialLookup('ORD-COMM-1', 'not-an-email');
    expect(res1.isValid).toBe(false);
    expect(res1.error).toContain('valid registered email address');

    const res2 = validateCommercialLookup('ORD-COMM-1', '@missingusername.com');
    expect(res2.isValid).toBe(false);

    const res3 = validateCommercialLookup('ORD-COMM-1', 'user@domain');
    expect(res3.isValid).toBe(false);
  });

  it('supports legacy 10-digit Indian mobile fallback gracefully', () => {
    const res = validateCommercialLookup('ORD-1', '9876543210');
    expect(res.isValid).toBe(true);
    expect(res.cleanMobile).toBe('9876543210');
  });
});

describe('My-Tickets: Commercial URL Builder (buildCommercialOrderUrl)', () => {
  it('builds encoded URL for commercial order endpoint with email query param', () => {
    const url = buildCommercialOrderUrl('ord-comm-20261011-abc', 'test@example.com');
    expect(url).toBe('/commercial/orders/ORD-COMM-20261011-ABC?email=test%40example.com');
  });

  it('properly encodes special characters in order number and email', () => {
    const url = buildCommercialOrderUrl('ORD/TEST#1', 'user+tag@domain.com');
    expect(url).toBe('/commercial/orders/ORD%2FTEST%231?email=user%2Btag%40domain.com');
  });

  it('builds mobile query URL when legacy mobile is passed', () => {
    const url = buildCommercialOrderUrl('ORD-1', '+91 98765 43210');
    expect(url).toBe('/commercial/orders/ORD-1?mobile=9876543210');
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
  it('validates and normalizes valid order number and 10-digit mobile or email', () => {
    const res = validateEmailRecoveryRequest('ord-comm-20261011-xyz', '+91 98765 43210');
    expect(res.isValid).toBe(true);
    expect(res.cleanOrderNumber).toBe('ORD-COMM-20261011-XYZ');
    expect(res.cleanMobile).toBe('9876543210');

    const resEmail = validateEmailRecoveryRequest('ord-comm-20261011-xyz', 'test@example.com');
    expect(resEmail.isValid).toBe(true);
    expect(resEmail.cleanEmail).toBe('test@example.com');
  });

  it('rejects recovery when mobile/email is missing or invalid', () => {
    const res = validateEmailRecoveryRequest('ORD-COMM-1', '12345');
    expect(res.isValid).toBe(false);
    expect(res.error).toBeDefined();
  });
});

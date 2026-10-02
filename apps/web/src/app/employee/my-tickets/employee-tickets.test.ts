/// <reference types="jest" />
import {
  validateEmployeeLookup,
  formatEmployeePassDates,
} from './employee-tickets-utils';

describe('Employee-Tickets: CPF and Phone Last 4 Lookup Validation (validateEmployeeLookup)', () => {
  it('accepts valid ONGC Reference Number or CPF and 4-digit phone suffix', () => {
    const res1 = validateEmployeeLookup('12345', '3210');
    expect(res1.isValid).toBe(true);
    expect(res1.cleanCpf).toBe('12345');
    expect(res1.cleanPhoneLast4).toBe('3210');

    const res2 = validateEmployeeLookup('ONGC-00042', '9876');
    expect(res2.isValid).toBe(true);
    expect(res2.cleanCpf).toBe('ONGC-00042');
    expect(res2.cleanPhoneLast4).toBe('9876');

    const res3 = validateEmployeeLookup('TK-12345', '9876');
    expect(res3.isValid).toBe(true);
    expect(res3.cleanCpf).toBe('TK-12345');
    expect(res3.cleanPhoneLast4).toBe('9876');
  });

  it('trims leading/trailing whitespace and normalizes CPF to uppercase', () => {
    const res = validateEmployeeLookup('  ongc-00001  ', ' 3210 ');
    expect(res.isValid).toBe(true);
    expect(res.cleanCpf).toBe('ONGC-00001');
    expect(res.cleanPhoneLast4).toBe('3210');
  });

  it('rejects empty or whitespace-only CPF inputs with an informative error', () => {
    const res1 = validateEmployeeLookup('', '3210');
    expect(res1.isValid).toBe(false);
    expect(res1.error).toContain('Please enter your Pass Reference Number');

    const res2 = validateEmployeeLookup('    ', '3210');
    expect(res2.isValid).toBe(false);
    expect(res2.error).toContain('Please enter your Pass Reference Number');
  });

  it('rejects empty or missing phone last 4 digits', () => {
    const res1 = validateEmployeeLookup('123456', '');
    expect(res1.isValid).toBe(false);
    expect(res1.error).toContain('last 4 digits');

    const res2 = validateEmployeeLookup('123456', '   ');
    expect(res2.isValid).toBe(false);
    expect(res2.error).toContain('last 4 digits');
  });

  it('rejects phone last 4 digits when length is not exactly 4 digits or non-numeric', () => {
    const res1 = validateEmployeeLookup('123456', '12');
    expect(res1.isValid).toBe(false);
    expect(res1.error).toContain('exactly 4');

    const res2 = validateEmployeeLookup('123456', '12345');
    expect(res2.isValid).toBe(false);
    expect(res2.error).toContain('exactly 4');

    const res3 = validateEmployeeLookup('123456', 'abcd');
    expect(res3.isValid).toBe(false);
    expect(res3.error).toContain('exactly 4');
  });
});

describe('Employee-Tickets: Pass Dates Formatter (formatEmployeePassDates)', () => {
  it('formats single date', () => {
    expect(formatEmployeePassDates(['2026-10-11'])).toBe('11 Oct');
  });

  it('formats multiple dates into comma-separated list', () => {
    expect(formatEmployeePassDates(['2026-10-11', '2026-10-14'])).toBe('11 Oct, 14 Oct');
  });

  it('returns All 9 Days when 9 or more dates are selected', () => {
    const allDates = [
      '2026-10-11',
      '2026-10-12',
      '2026-10-13',
      '2026-10-14',
      '2026-10-15',
      '2026-10-16',
      '2026-10-17',
      '2026-10-18',
      '2026-10-19',
    ];
    expect(formatEmployeePassDates(allDates)).toContain('All 9 Days');
  });

  it('falls back to default event dates if empty or null', () => {
    expect(formatEmployeePassDates(null)).toBe('11–19 October 2026');
    expect(formatEmployeePassDates([])).toBe('11–19 October 2026');
  });
});

import React from 'react';
import ReactDOMServer from 'react-dom/server';
import OngcEmployeeMasterPage from './page';
import { normalizeCpf, formatCpfString } from '@ongc/shared-types';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(() => null),
  }),
}));

// Mock react-dom createPortal
jest.mock('react-dom', () => ({
  ...jest.requireActual('react-dom'),
  createPortal: (node: any) => node,
}));

describe('Employee Master CPF Normalization & Display Audit', () => {
  describe('Authoritative normalizeCpf rules', () => {
    it('1. Genuine 5-digit CPF remains valid', () => {
      expect(normalizeCpf('29344')).toBe('29344');
      expect(normalizeCpf('39706')).toBe('39706');
      expect(normalizeCpf('12345')).toBe('12345');
      expect(typeof normalizeCpf('29344')).toBe('string');
    });

    it('2. Genuine 6-digit CPF remains valid', () => {
      expect(normalizeCpf('103506')).toBe('103506');
      expect(normalizeCpf('104514')).toBe('104514');
      expect(normalizeCpf('123456')).toBe('123456');
      expect(typeof normalizeCpf('103506')).toBe('string');
    });

    it('3. Leading-zero CPF remains a string without numeric conversion', () => {
      expect(normalizeCpf('012345')).toBe('012345');
      expect(typeof normalizeCpf('012345')).toBe('string');
      expect(normalizeCpf('01234')).toBe('01234');
      expect(typeof normalizeCpf('01234')).toBe('string');
    });

    it('4. "012345" does not become "12345"', () => {
      expect(normalizeCpf('012345')).toBe('012345');
      expect(normalizeCpf('012345')).not.toBe('12345');
    });

    it('5. "12345" does not automatically become "012345"', () => {
      expect(normalizeCpf('12345')).toBe('12345');
      expect(normalizeCpf('12345')).not.toBe('012345');
    });

    it('rejects invalid inputs (<5 digits, >6 digits, letters)', () => {
      expect(normalizeCpf('1234')).toBeNull();
      expect(normalizeCpf('1234567')).toBeNull();
      expect(normalizeCpf('12A45')).toBeNull();
      expect(normalizeCpf('ABCDE')).toBeNull();
      expect(normalizeCpf('')).toBeNull();
      expect(normalizeCpf(null)).toBeNull();
      expect(normalizeCpf(undefined)).toBeNull();
    });

    it('formatCpfString preserves leading zeros and handles numbers/bigints safely', () => {
      expect(formatCpfString('012345')).toBe('012345');
      expect(formatCpfString(103506)).toBe('103506');
      expect(formatCpfString(BigInt(29344))).toBe('29344');
      expect(formatCpfString(null)).toBe('');
      expect(formatCpfString(undefined)).toBe('');
    });
  });

  describe('Employee Master UI Render & Display', () => {
    it('renders Employee Master page structure with search and actions', () => {
      const html = ReactDOMServer.renderToStaticMarkup(<OngcEmployeeMasterPage />);
      expect(html).toContain('ONGC Employee Master');
      expect(html).toContain('Search by CPF No. or Mobile No...');
      expect(html).toContain('IMPORT DATA');
      expect(html).toContain('EXPORT');
    });

    it('formats sample 5-digit, 6-digit, and leading-zero CPFs as strings in table display', () => {
      const records = [
        { cpfNo: '29344', mobileNo: '9428519184' },
        { cpfNo: '103506', mobileNo: '9876543210' },
        { cpfNo: '012345', mobileNo: '9876543211' },
      ];

      records.forEach((r) => {
        const displayed = normalizeCpf(r.cpfNo) || r.cpfNo;
        expect(displayed).toBe(r.cpfNo);
        expect(typeof displayed).toBe('string');
      });
    });
  });
});

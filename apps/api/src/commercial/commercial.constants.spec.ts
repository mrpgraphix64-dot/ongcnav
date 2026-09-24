import {
  COMMERCIAL_EVENT_DATES,
  COMMERCIAL_TICKET_TYPES,
  calculateServerPricePaise,
  generateOrderNumber,
} from './commercial.constants';

describe('Commercial Constants & Server-Authoritative Price Calculation', () => {
  it('defines 9 official ONGC Navratri event dates', () => {
    expect(COMMERCIAL_EVENT_DATES).toHaveLength(9);
    expect(COMMERCIAL_EVENT_DATES[0]).toBe('2026-10-11');
    expect(COMMERCIAL_EVENT_DATES[8]).toBe('2026-10-19');
  });

  describe('calculateServerPricePaise', () => {
    it('correctly calculates price for single day pass (₹500 / night)', () => {
      const res = calculateServerPricePaise('COMMERCIAL_DAILY', ['2026-10-11'], 1);
      expect(res.unitPricePaise).toBe(50000); // ₹500.00
      expect(res.totalAmountPaise).toBe(50000);
      expect(res.validDates).toEqual(['2026-10-11']);
    });

    it('correctly multiplies price for multiple selected nights and quantity', () => {
      // 2 nights * ₹500 = ₹1,000 unit price * 3 passes = ₹3,000 total
      const res = calculateServerPricePaise(
        'COMMERCIAL_DAILY',
        ['2026-10-11', '2026-10-12'],
        3,
      );
      expect(res.unitPricePaise).toBe(100000); // ₹1,000.00
      expect(res.totalAmountPaise).toBe(300000); // ₹3,000.00
      expect(res.validDates).toHaveLength(2);
    });

    it('calculates fixed price for season pass (₹3,500) covering all 9 nights', () => {
      const res = calculateServerPricePaise('COMMERCIAL_SEASON', ['2026-10-11'], 2);
      expect(res.unitPricePaise).toBe(350000); // ₹3,500.00
      expect(res.totalAmountPaise).toBe(700000); // ₹7,000.00
      expect(res.validDates).toEqual(COMMERCIAL_EVENT_DATES);
    });

    it('filters out invalid dates and rejects when no valid event dates remain', () => {
      expect(() => {
        calculateServerPricePaise('COMMERCIAL_DAILY', ['2026-12-25', 'invalid-date'], 1);
      }).toThrow('At least one valid event date must be selected.');
    });

    it('bounds quantity between 1 and 10', () => {
      const minRes = calculateServerPricePaise('COMMERCIAL_DAILY', ['2026-10-11'], -5);
      expect(minRes.totalAmountPaise).toBe(50000); // clamped to 1

      const maxRes = calculateServerPricePaise('COMMERCIAL_DAILY', ['2026-10-11'], 99);
      expect(maxRes.totalAmountPaise).toBe(500000); // clamped to 10
    });
  });

  describe('generateOrderNumber', () => {
    it('generates unique, safe order references starting with ORD-COMM-', () => {
      const order1 = generateOrderNumber();
      const order2 = generateOrderNumber();
      expect(order1).toMatch(/^ORD-COMM-[0-9]{8}-[A-F0-9]{6}$/);
      expect(order2).toMatch(/^ORD-COMM-[0-9]{8}-[A-F0-9]{6}$/);
      expect(order1).not.toBe(order2);
    });
  });
});

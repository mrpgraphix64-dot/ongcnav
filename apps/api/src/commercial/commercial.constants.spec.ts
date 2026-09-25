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
    it('correctly calculates Early Bird price for single day pass (₹249 / 24,900 paise, original ₹499)', () => {
      const res = calculateServerPricePaise('COMMERCIAL_DAILY', ['2026-10-11'], 1);
      expect(res.unitPricePaise).toBe(24900); // ₹249.00 Early Bird
      expect(res.originalPricePaise).toBe(49900); // ₹499.00 Original
      expect(res.totalAmountPaise).toBe(24900);
      expect(res.totalOriginalAmountPaise).toBe(49900);
      expect(res.validDates).toEqual(['2026-10-11']);
    });

    it('correctly multiplies price for multiple selected nights and quantity', () => {
      // 2 nights * ₹249 = ₹498 (49,800 paise) unit price * 3 passes = ₹1,494 (149,400 paise) total
      const res = calculateServerPricePaise(
        'COMMERCIAL_DAILY',
        ['2026-10-11', '2026-10-12'],
        3,
      );
      expect(res.unitPricePaise).toBe(49800); // ₹498.00
      expect(res.originalPricePaise).toBe(99800); // ₹998.00 (499 * 2)
      expect(res.totalAmountPaise).toBe(149400); // ₹1,494.00
      expect(res.totalOriginalAmountPaise).toBe(299400);
      expect(res.validDates).toHaveLength(2);
    });

    it('correctly calculates price for Mandli Pass (₹149 / 14,900 paise, original ₹299)', () => {
      const res = calculateServerPricePaise('COMMERCIAL_MANDLI', ['2026-10-11'], 1);
      expect(res.unitPricePaise).toBe(14900); // ₹149.00
      expect(res.originalPricePaise).toBe(29900); // ₹299.00
      expect(res.totalAmountPaise).toBe(14900);
      expect(res.totalOriginalAmountPaise).toBe(29900);
      expect(res.validDates).toEqual(['2026-10-11']);
    });

    it('correctly calculates price for Any Day Pass (₹279 / 27,900 paise, original ₹499)', () => {
      const res = calculateServerPricePaise('COMMERCIAL_ANY_DAY', ['2026-10-14'], 2);
      expect(res.unitPricePaise).toBe(27900); // ₹279.00
      expect(res.originalPricePaise).toBe(49900); // ₹499.00
      expect(res.totalAmountPaise).toBe(55800); // ₹558.00 for 2 passes
      expect(res.totalOriginalAmountPaise).toBe(99800);
      expect(res.validDates).toEqual(['2026-10-14']);
    });

    it('calculates fixed Early Bird price for season pass (₹1,750 / 175,000 paise, original ₹3,500) covering all 9 nights', () => {
      const res = calculateServerPricePaise('COMMERCIAL_SEASON', ['2026-10-11'], 2);
      expect(res.unitPricePaise).toBe(175000); // ₹1,750.00
      expect(res.originalPricePaise).toBe(350000); // ₹3,500.00
      expect(res.totalAmountPaise).toBe(350000); // ₹3,500.00 for 2 passes
      expect(res.totalOriginalAmountPaise).toBe(700000); // ₹7,000.00 original
      expect(res.validDates).toEqual(COMMERCIAL_EVENT_DATES);
    });

    it('filters out invalid dates and rejects when no valid event dates remain', () => {
      expect(() => {
        calculateServerPricePaise('COMMERCIAL_DAILY', ['2026-12-25', 'invalid-date'], 1);
      }).toThrow('At least one valid event date must be selected.');
    });

    it('bounds quantity between 1 and 10', () => {
      const minRes = calculateServerPricePaise('COMMERCIAL_DAILY', ['2026-10-11'], -5);
      expect(minRes.totalAmountPaise).toBe(24900); // clamped to 1

      const maxRes = calculateServerPricePaise('COMMERCIAL_DAILY', ['2026-10-11'], 99);
      expect(maxRes.totalAmountPaise).toBe(249000); // clamped to 10
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

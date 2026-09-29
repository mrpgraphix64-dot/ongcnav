import { CANONICAL_AGENT_PASS_TYPES, PASS_TYPES } from './agent-pricing.constants';

describe('Commercial Agent Portal Pricing Consistency', () => {
  it('defines canonical pricing for all commercial pass types', () => {
    const daily = PASS_TYPES.find((p) => p.code === 'COMMERCIAL_DAILY');
    const season = PASS_TYPES.find((p) => p.code === 'COMMERCIAL_SEASON');
    const mandli = PASS_TYPES.find((p) => p.code === 'COMMERCIAL_MANDLI');
    const anyDay = PASS_TYPES.find((p) => p.code === 'COMMERCIAL_ANY_DAY');

    expect(daily).toBeDefined();
    expect(daily?.priceInr).toBe(249);

    expect(season).toBeDefined();
    expect(season?.priceInr).toBe(1750);

    expect(mandli).toBeDefined();
    expect(mandli?.priceInr).toBe(149);

    expect(anyDay).toBeDefined();
    expect(anyDay?.priceInr).toBe(279);
  });

  it('does NOT contain obsolete hardcoded prices (499, 2999, 3999, 599)', () => {
    const prices = PASS_TYPES.map((p) => p.priceInr);
    expect(prices).not.toContain(499);
    expect(prices).not.toContain(2999);
    expect(prices).not.toContain(3999);
    expect(prices).not.toContain(599);
  });

  it('CANONICAL_AGENT_PASS_TYPES matches PASS_TYPES export', () => {
    expect(CANONICAL_AGENT_PASS_TYPES).toBe(PASS_TYPES);
    expect(PASS_TYPES).toHaveLength(4);
  });

  it('correctly calculates total booking price from canonical prices', () => {
    const dailyPrice = PASS_TYPES.find((p) => p.code === 'COMMERCIAL_DAILY')!.priceInr;
    expect(dailyPrice * 2).toBe(498);

    const mandliPrice = PASS_TYPES.find((p) => p.code === 'COMMERCIAL_MANDLI')!.priceInr;
    expect(mandliPrice * 10).toBe(1490);

    const seasonPrice = PASS_TYPES.find((p) => p.code === 'COMMERCIAL_SEASON')!.priceInr;
    expect(seasonPrice * 1).toBe(1750);

    const anyDayPrice = PASS_TYPES.find((p) => p.code === 'COMMERCIAL_ANY_DAY')!.priceInr;
    expect(anyDayPrice * 3).toBe(837);
  });
});

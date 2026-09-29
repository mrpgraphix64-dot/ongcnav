export interface AgentPassType {
  code: string;
  name: string;
  priceInr: number;
  description: string;
  isSeason: boolean;
}

export const CANONICAL_AGENT_PASS_TYPES: AgentPassType[] = [
  {
    code: 'COMMERCIAL_DAILY',
    name: 'Daily Pass',
    priceInr: 249,
    description: 'Single day entry for one person',
    isSeason: false,
  },
  {
    code: 'COMMERCIAL_SEASON',
    name: 'Season Pass',
    priceInr: 1750,
    description: 'All 9 nights entry for one person',
    isSeason: true,
  },
  {
    code: 'COMMERCIAL_MANDLI',
    name: 'Mandli Pass',
    priceInr: 149,
    description: 'Group entry pass for Garba groups',
    isSeason: false,
  },
  {
    code: 'COMMERCIAL_ANY_DAY',
    name: 'Any Day Pass',
    priceInr: 279,
    description: 'Flexible single day entry',
    isSeason: false,
  },
];

export const PASS_TYPES = CANONICAL_AGENT_PASS_TYPES;

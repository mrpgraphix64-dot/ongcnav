import * as crypto from 'crypto';

export const COMMERCIAL_EVENT_DATES = [
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

export interface CommercialTicketTypeConfig {
  code: string;
  name: string;
  description: string;
  unitPricePaise: number; // in paise (e.g. 50000 = ₹500.00)
  isSeasonPass: boolean;
}

export const COMMERCIAL_TICKET_TYPES: Record<string, CommercialTicketTypeConfig> = {
  COMMERCIAL_DAILY: {
    code: 'COMMERCIAL_DAILY',
    name: 'Single Night Entry Pass',
    description: 'Valid for selected night(s) at ONGC Navratri 2026',
    unitPricePaise: 50000, // ₹500 per night
    isSeasonPass: false,
  },
  COMMERCIAL_SEASON: {
    code: 'COMMERCIAL_SEASON',
    name: 'All 9 Nights Season Pass',
    description: 'Full festival pass covering all 9 nights of Garba',
    unitPricePaise: 350000, // ₹3,500 for all 9 nights (discounted)
    isSeasonPass: true,
  },
};

/**
 * Server-authoritative price calculation.
 * NEVER trusts amount, unit price, or calculations from the browser.
 */
export function calculateServerPricePaise(
  ticketTypeCode: string,
  selectedDates: string[],
  quantity: number,
): { unitPricePaise: number; totalAmountPaise: number; validDates: string[] } {
  const config = COMMERCIAL_TICKET_TYPES[ticketTypeCode] || COMMERCIAL_TICKET_TYPES.COMMERCIAL_DAILY;
  const qty = Math.max(1, Math.min(10, Math.floor(quantity)));

  let validDates: string[];
  let unitPricePaise: number;

  if (config.isSeasonPass) {
    validDates = [...COMMERCIAL_EVENT_DATES];
    unitPricePaise = config.unitPricePaise;
  } else {
    // Filter to only officially allowed ONGC Navratri event dates
    validDates = selectedDates.filter((d) => COMMERCIAL_EVENT_DATES.includes(d));
    if (validDates.length === 0) {
      throw new Error('At least one valid event date must be selected.');
    }
    // Price per pass = base price * number of selected nights
    unitPricePaise = config.unitPricePaise * validDates.length;
  }

  const totalAmountPaise = unitPricePaise * qty;
  return { unitPricePaise, totalAmountPaise, validDates };
}

export function generateOrderNumber(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `ORD-COMM-${dateStr}-${rand}`;
}

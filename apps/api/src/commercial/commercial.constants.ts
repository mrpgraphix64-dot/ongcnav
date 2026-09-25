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
  timing: string;
  description: string;
  originalPricePaise: number; // in paise (e.g. 49900 = ₹499.00)
  unitPricePaise: number; // in paise (e.g. 24900 = ₹249.00)
  discountPercent: number;
  discountLabel: string;
  offerLabel: string;
  subtitle: string;
  isSeasonPass: boolean;
}

export const COMMERCIAL_TICKET_TYPES: Record<string, CommercialTicketTypeConfig> = {
  COMMERCIAL_DAILY: {
    code: 'COMMERCIAL_DAILY',
    name: 'Daily Entry Pass',
    timing: '8:00 PM – 4:00 AM',
    description: 'Valid for selected night(s) at ONGC Navratri 2026',
    originalPricePaise: 49900, // ₹499 per night
    unitPricePaise: 24900, // ₹249 per night (Early Bird 50% OFF)
    discountPercent: 50,
    discountLabel: '50% OFF',
    offerLabel: 'EARLY BIRD OFFER',
    subtitle: 'Regular Garba Entry • 8:00 PM – 4:00 AM',
    isSeasonPass: false,
  },
  COMMERCIAL_ANY_DAY: {
    code: 'COMMERCIAL_ANY_DAY',
    name: 'Any Day Pass',
    timing: '8:00 PM – 4:00 AM',
    description: 'Flexible single-night entry pass valid for any chosen event night',
    originalPricePaise: 49900, // ₹499 per night
    unitPricePaise: 27900, // ₹279 per night
    discountPercent: 44,
    discountLabel: '44% OFF',
    offerLabel: 'FLEXIBLE ENTRY',
    subtitle: 'Flexible Single-Night Entry • 8:00 PM – 4:00 AM',
    isSeasonPass: false,
  },
  COMMERCIAL_MANDLI: {
    code: 'COMMERCIAL_MANDLI',
    name: 'Mandli Pass',
    timing: '12:00 AM – 4:00 AM',
    description: 'Special post-midnight entry for late-night Mandli Garba',
    originalPricePaise: 29900, // ₹299 per night
    unitPricePaise: 14900, // ₹149 per night
    discountPercent: 50,
    discountLabel: '50% OFF',
    offerLabel: 'MIDNIGHT SPECIAL',
    subtitle: 'Post-Midnight Entry • 12:00 AM – 4:00 AM',
    isSeasonPass: false,
  },
  COMMERCIAL_SEASON: {
    code: 'COMMERCIAL_SEASON',
    name: 'Season Pass',
    timing: '8:00 PM – 4:00 AM',
    description: 'Full festival pass covering all 9 nights of Garba',
    originalPricePaise: 350000, // ₹3,500 for all 9 nights
    unitPricePaise: 175000, // ₹1,750 for all 9 nights (Early Bird 50% OFF)
    discountPercent: 50,
    discountLabel: '50% OFF',
    offerLabel: 'EARLY BIRD OFFER',
    subtitle: 'All 9 Nights Access • 8:00 PM – 4:00 AM',
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
): {
  unitPricePaise: number;
  originalPricePaise: number;
  totalAmountPaise: number;
  totalOriginalAmountPaise: number;
  validDates: string[];
} {
  const config = COMMERCIAL_TICKET_TYPES[ticketTypeCode] || COMMERCIAL_TICKET_TYPES.COMMERCIAL_DAILY;
  const qty = Math.max(1, Math.min(10, Math.floor(quantity)));

  let validDates: string[];
  let unitPricePaise: number;
  let originalPricePaise: number;

  if (config.isSeasonPass) {
    validDates = [...COMMERCIAL_EVENT_DATES];
    unitPricePaise = config.unitPricePaise;
    originalPricePaise = config.originalPricePaise;
  } else {
    // Filter to only officially allowed ONGC Navratri event dates
    validDates = selectedDates.filter((d) => COMMERCIAL_EVENT_DATES.includes(d));
    if (validDates.length === 0) {
      throw new Error('At least one valid event date must be selected.');
    }
    // Price per pass = base price * number of selected nights
    unitPricePaise = config.unitPricePaise * validDates.length;
    originalPricePaise = config.originalPricePaise * validDates.length;
  }

  const totalAmountPaise = unitPricePaise * qty;
  const totalOriginalAmountPaise = originalPricePaise * qty;
  return {
    unitPricePaise,
    originalPricePaise,
    totalAmountPaise,
    totalOriginalAmountPaise,
    validDates,
  };
}

export function generateOrderNumber(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `ORD-COMM-${dateStr}-${rand}`;
}

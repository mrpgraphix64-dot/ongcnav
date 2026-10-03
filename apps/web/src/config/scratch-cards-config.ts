import {
  ScratchCardItem,
  SponsorVoucherConfig,
  DEFAULT_SPONSOR_VOUCHER_CONFIG,
  getDefaultScratchCards as sharedGetDefaultScratchCards,
} from '@/types/shared-types';

/**
 * Frontend Configuration for the 3-Card Scratch & Reveal Experience.
 *
 * This configuration can be easily wired up to Admin Settings in the future.
 */
export function getScratchCardsConfig(
  sponsorVoucher?: SponsorVoucherConfig | null,
): ScratchCardItem[] {
  return sharedGetDefaultScratchCards(sponsorVoucher ?? DEFAULT_SPONSOR_VOUCHER_CONFIG);
}

export { DEFAULT_SPONSOR_VOUCHER_CONFIG };

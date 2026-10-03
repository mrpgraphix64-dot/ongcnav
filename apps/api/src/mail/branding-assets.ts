/**
 * Public branding image paths for email templates.
 * These are served directly over HTTPS from the public web server,
 * preventing email clients (such as Gmail) from treating inline CID images as downloadable attachment chips.
 */

export const EMAIL_BRANDING_PATHS = {
  ongcLogo: '/images/logo-web.png',
  festivalLogo: '/images/ongc-navratri-2026-logo.png',
  festivalEmblem: '/images/ongc-navratri-2026-festival-emblem.png',
  legacyOngcLogo: '/images/logo-web.png',
  zairaDiamondLogo: '/images/sponsors/zaira-diamond-logo.png',
  omSanctuaryLogo: '/images/sponsors/om-sanctuary-palace-logo.png',
  lalkaarLogo: '/images/sponsors/lalkaar-news-logo.png',
  digantArtLogo: '/images/digant-art-logo.png',
  mahavirJewellersVoucher: '/images/sponsors/mahavir-jewellers-voucher.jpg',
} as const;

export interface EmailBrandingUrls {
  ongcLogoUrl: string;
  festivalLogoUrl: string;
  festivalEmblemUrl: string;
  zairaDiamondLogoUrl: string;
  omSanctuaryLogoUrl: string;
  lalkaarLogoUrl: string;
  digantArtLogoUrl: string;
  mahavirJewellersVoucherUrl: string;
}

export function getEmailBrandingUrls(baseUrl: string): EmailBrandingUrls {
  const cleanBase = (baseUrl || 'https://ongcnavratri.reworkzone.in').replace(/\/+$/, '');
  return {
    ongcLogoUrl: `${cleanBase}${EMAIL_BRANDING_PATHS.ongcLogo}`,
    festivalLogoUrl: `${cleanBase}${EMAIL_BRANDING_PATHS.festivalLogo}`,
    festivalEmblemUrl: `${cleanBase}${EMAIL_BRANDING_PATHS.festivalEmblem}`,
    zairaDiamondLogoUrl: `${cleanBase}${EMAIL_BRANDING_PATHS.zairaDiamondLogo}`,
    omSanctuaryLogoUrl: `${cleanBase}${EMAIL_BRANDING_PATHS.omSanctuaryLogo}`,
    lalkaarLogoUrl: `${cleanBase}${EMAIL_BRANDING_PATHS.lalkaarLogo}`,
    digantArtLogoUrl: `${cleanBase}${EMAIL_BRANDING_PATHS.digantArtLogo}`,
    mahavirJewellersVoucherUrl: `${cleanBase}${EMAIL_BRANDING_PATHS.mahavirJewellersVoucher}`,
  };
}

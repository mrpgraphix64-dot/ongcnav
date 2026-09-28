/**
 * Public branding image paths for email templates.
 * These are served directly over HTTPS from the public web server,
 * preventing email clients (such as Gmail) from treating inline CID images as downloadable attachment chips.
 */

export const EMAIL_BRANDING_PATHS = {
  ongcLogo: '/images/logo-web.png',
  zairaDiamondLogo: '/images/sponsors/zaira-diamond-logo.png',
  omSanctuaryLogo: '/images/sponsors/om-sanctuary-palace-logo.png',
  lalkaarLogo: '/images/sponsors/lalkaar-news-logo.png',
  digantArtLogo: '/images/digant-art-logo.png',
} as const;

export interface EmailBrandingUrls {
  ongcLogoUrl: string;
  zairaDiamondLogoUrl: string;
  omSanctuaryLogoUrl: string;
  lalkaarLogoUrl: string;
  digantArtLogoUrl: string;
}

export function getEmailBrandingUrls(baseUrl: string): EmailBrandingUrls {
  const cleanBase = (baseUrl || 'https://ongcnavratri.reworkzone.in').replace(/\/+$/, '');
  return {
    ongcLogoUrl: `${cleanBase}${EMAIL_BRANDING_PATHS.ongcLogo}`,
    zairaDiamondLogoUrl: `${cleanBase}${EMAIL_BRANDING_PATHS.zairaDiamondLogo}`,
    omSanctuaryLogoUrl: `${cleanBase}${EMAIL_BRANDING_PATHS.omSanctuaryLogo}`,
    lalkaarLogoUrl: `${cleanBase}${EMAIL_BRANDING_PATHS.lalkaarLogo}`,
    digantArtLogoUrl: `${cleanBase}${EMAIL_BRANDING_PATHS.digantArtLogo}`,
  };
}

/**
 * Staging Test Payment Security Utility.
 *
 * Requirements:
 * 1. STRICT FAILSAFE: If NODE_ENV === 'production', test payment mode is NEVER allowed,
 *    regardless of any COMMERCIAL_TEST_PAYMENT setting.
 * 2. Only active when NODE_ENV !== 'production' AND COMMERCIAL_TEST_PAYMENT === 'true'.
 * 3. Never allow any client request payload or query parameter to override or activate this mode.
 */

export function isCommercialTestPaymentEnabled(
  nodeEnv?: string,
  commercialTestPaymentEnv?: string,
): boolean {
  const env = (nodeEnv || process.env.NODE_ENV || 'development').toLowerCase().trim();
  if (env === 'production') {
    return false;
  }
  const flag = (commercialTestPaymentEnv ?? process.env.COMMERCIAL_TEST_PAYMENT ?? 'false')
    .toLowerCase()
    .trim();
  return flag === 'true';
}

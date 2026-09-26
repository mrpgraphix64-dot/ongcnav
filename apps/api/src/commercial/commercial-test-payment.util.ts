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

/**
 * Safe staging test data delete mode determination.
 * STRICT FAILSAFE: Automatically disabled and rejected if NODE_ENV=production, missing, or unknown.
 * Only allowed when NODE_ENV is explicitly one of ['staging', 'development', 'test', 'local']
 * AND ADMIN_TEST_DATA_DELETE_ENABLED is 'true'.
 */
export function isAdminTestDataDeleteEnabled(
  nodeEnv?: string,
  testDeleteEnv?: string,
): boolean {
  const rawEnv = arguments.length > 0 ? (nodeEnv || '') : (process.env.NODE_ENV || '');
  const env = rawEnv.toLowerCase().trim();
  const allowedEnvs = ['staging', 'development', 'test', 'local'];
  if (!env || env === 'production' || !allowedEnvs.includes(env)) {
    return false;
  }
  const rawFlag = arguments.length > 1 ? (testDeleteEnv || '') : (process.env.ADMIN_TEST_DATA_DELETE_ENABLED || 'false');
  const flag = rawFlag.toLowerCase().trim();
  return flag === 'true';
}

/**
 * Checks whether an order is an explicitly identifiable test/staging order.
 * Identifiable markers:
 * 1. metadata.isTestPayment === true
 * 2. metadata.testMode === 'STAGING_TEST_PAYMENT'
 * 3. razorpayOrderId starts with 'TEST_ORD_'
 * 4. razorpayPaymentId starts with 'TEST_PAY_'
 */
export function isStagingTestOrder(order: any): boolean {
  if (!order) return false;
  let meta: any = order.metadata;
  if (typeof meta === 'string') {
    try {
      meta = JSON.parse(meta);
    } catch {
      meta = {};
    }
  } else if (!meta || typeof meta !== 'object') {
    meta = {};
  }

  if (meta.isTestPayment === true || meta.testMode === 'STAGING_TEST_PAYMENT') {
    return true;
  }

  if (typeof order.razorpayOrderId === 'string' && order.razorpayOrderId.startsWith('TEST_ORD_')) {
    return true;
  }

  if (typeof order.razorpayPaymentId === 'string' && order.razorpayPaymentId.startsWith('TEST_PAY_')) {
    return true;
  }

  return false;
}

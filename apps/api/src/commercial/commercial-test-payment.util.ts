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
 * Developer Test Purchase Feature Flag.
 * Controlled development/testing bypass strictly restricted to authenticated Super Admins.
 *
 * STRICT PRODUCTION GUARD:
 * - NODE_ENV=production -> ALWAYS disabled, regardless of ALLOW_DEVELOPER_TEST_PURCHASE
 * - development/staging/test/local + ALLOW_DEVELOPER_TEST_PURCHASE=true -> available
 * - missing or false flag -> disabled
 */
export function isDeveloperTestPurchaseEnabled(
  nodeEnv?: string,
  allowDevTestEnv?: string,
): boolean {
  const env = (nodeEnv !== undefined ? nodeEnv : (process.env.NODE_ENV || 'development')).toLowerCase().trim();
  if (env === 'production') {
    return false;
  }
  const rawFlag = (allowDevTestEnv !== undefined ? allowDevTestEnv : (process.env.ALLOW_DEVELOPER_TEST_PURCHASE || 'false'))
    .toLowerCase()
    .trim();
  return rawFlag === 'true';
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
 * Identifies explicitly synthetic staging test accounts.
 * Safe predicate: only accounts in explicit synthetic testing domains (.staging.test, .synthetic.test)
 * are recognized as test creators. Real domains (e.g. ongc.co.in, gmail.com) are NEVER synthetic test accounts.
 */
export function isSyntheticStagingTestAccount(
  emailOrUser?: string | { email?: string | null } | null,
): boolean {
  if (!emailOrUser) return false;
  const email = (
    typeof emailOrUser === 'string' ? emailOrUser : emailOrUser.email || ''
  )
    .toLowerCase()
    .trim();
  if (!email) return false;
  return (
    email.endsWith('@staging.test') ||
    email.endsWith('.staging.test') ||
    email.endsWith('@synthetic.test') ||
    email.endsWith('.synthetic.test')
  );
}

/**
 * Checks whether an order is an explicitly identifiable test/staging order.
 *
 * Safeguards:
 * - Real Razorpay payment identifiers (starts with 'pay_' and not 'TEST_PAY_') are NEVER test orders.
 *
 * Identifiable markers:
 * 1. metadata.isTestPayment === true
 * 2. metadata.testMode === 'STAGING_TEST_PAYMENT'
 * 3. razorpayOrderId starts with 'TEST_ORD_'
 * 4. razorpayPaymentId starts with 'TEST_PAY_'
 * 5. Historical Agent Offline orders whose creator/agent is an explicitly synthetic staging test account
 */
export function isStagingTestOrder(order: any, agentUser?: any): boolean {
  if (!order) return false;

  // STRICT FINANCIAL SAFEGUARD: Real Razorpay payment IDs or real Razorpay order IDs are NEVER test data
  if (
    typeof order.razorpayPaymentId === 'string' &&
    order.razorpayPaymentId.startsWith('pay_') &&
    !order.razorpayPaymentId.startsWith('TEST_PAY_')
  ) {
    return false;
  }

  if (
    typeof order.razorpayOrderId === 'string' &&
    order.razorpayOrderId.startsWith('order_') &&
    !order.razorpayOrderId.startsWith('TEST_ORD_')
  ) {
    return false;
  }

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

  // 1. Definitive online test payment markers
  if (
    meta.isTestPayment === true ||
    meta.testMode === 'STAGING_TEST_PAYMENT' ||
    meta.isDeveloperTest === true ||
    meta.testMode === 'DEVELOPER_TEST_PURCHASE'
  ) {
    return true;
  }

  if (typeof order.razorpayOrderId === 'string' && order.razorpayOrderId.startsWith('TEST_ORD_')) {
    return true;
  }

  if (typeof order.razorpayPaymentId === 'string' && order.razorpayPaymentId.startsWith('TEST_PAY_')) {
    return true;
  }

  // 2. Historical Agent Offline test orders with authoritative synthetic agent evidence
  const isAgentOrder =
    order.source === 'AGENT' ||
    order.paymentMode === 'OFFLINE' ||
    order.agentId != null;

  if (isAgentOrder) {
    const candidateAgent =
      agentUser || order.agent || meta.bookedByAgentEmail;
    if (isSyntheticStagingTestAccount(candidateAgent)) {
      return true;
    }
  }

  return false;
}

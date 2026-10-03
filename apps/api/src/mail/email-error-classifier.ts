import { EmailDeliveryErrorType } from '@ongc/shared-types';

export interface ClassifiedEmailError {
  errorType: EmailDeliveryErrorType;
  userFriendlyReason: string;
  isRetryable: boolean;
}

/**
 * Classifies email errors into standardized operational error categories
 * and determines whether the recipient should be automatically or manually retryable.
 */
export function classifyEmailError(errorMessage?: string, statusCode?: number): ClassifiedEmailError {
  const msg = (errorMessage || '').toLowerCase();

  // 1. Invalid or missing email address
  if (
    msg.includes('no recipient email') ||
    msg.includes('invalid email') ||
    msg.includes('malformed') ||
    msg.includes('syntax error') ||
    msg.includes('recipient address rejected')
  ) {
    return {
      errorType: EmailDeliveryErrorType.INVALID_EMAIL,
      userFriendlyReason: 'Invalid or missing recipient email address',
      isRetryable: false,
    };
  }

  // 2. Authentication errors (credentials misconfigured)
  if (
    statusCode === 401 ||
    statusCode === 403 ||
    msg.includes('unauthorized') ||
    msg.includes('authentication failed') ||
    msg.includes('invalid api key') ||
    msg.includes('auth error')
  ) {
    return {
      errorType: EmailDeliveryErrorType.SMTP_AUTH_ERROR,
      userFriendlyReason: 'Email provider authentication failed (check API credentials)',
      isRetryable: true,
    };
  }

  // 3. Timeouts
  if (
    msg.includes('timed out') ||
    msg.includes('timeout') ||
    msg.includes('abort') ||
    msg.includes('etimedout')
  ) {
    return {
      errorType: EmailDeliveryErrorType.SMTP_TIMEOUT,
      userFriendlyReason: 'Connection timed out while sending to email provider',
      isRetryable: true,
    };
  }

  // 4. Rate limits
  if (
    statusCode === 429 ||
    msg.includes('rate limit') ||
    msg.includes('too many requests') ||
    msg.includes('quota exceeded')
  ) {
    return {
      errorType: EmailDeliveryErrorType.PROVIDER_RATE_LIMIT,
      userFriendlyReason: 'Email provider rate limit reached (retry with throttling)',
      isRetryable: true,
    };
  }

  // 5. Connection / Network errors
  if (
    msg.includes('econnrefused') ||
    msg.includes('econnreset') ||
    msg.includes('enotfound') ||
    msg.includes('network error') ||
    msg.includes('socket')
  ) {
    return {
      errorType: EmailDeliveryErrorType.SMTP_CONNECTION_ERROR,
      userFriendlyReason: 'Network connection error reaching email gateway',
      isRetryable: true,
    };
  }

  // 6. Mailbox full
  if (msg.includes('mailbox full') || msg.includes('quota') || msg.includes('insufficient storage')) {
    return {
      errorType: EmailDeliveryErrorType.MAILBOX_FULL,
      userFriendlyReason: 'Recipient mailbox is full or over quota',
      isRetryable: true,
    };
  }

  // 7. Recipient not found
  if (msg.includes('user not found') || msg.includes('recipient not found') || msg.includes('no such user')) {
    return {
      errorType: EmailDeliveryErrorType.RECIPIENT_NOT_FOUND,
      userFriendlyReason: 'Recipient mailbox was not found at target destination',
      isRetryable: false,
    };
  }

  // 8. Domain errors
  if (msg.includes('dns') || msg.includes('mx record') || msg.includes('domain not found')) {
    return {
      errorType: EmailDeliveryErrorType.DOMAIN_ERROR,
      userFriendlyReason: 'Recipient domain DNS or MX lookup failed',
      isRetryable: false,
    };
  }

  // 9. Provider rejected
  if (msg.includes('rejected') || msg.includes('blocked') || msg.includes('spam')) {
    return {
      errorType: EmailDeliveryErrorType.PROVIDER_REJECTED,
      userFriendlyReason: 'Message rejected by email gateway or spam filter',
      isRetryable: false,
    };
  }

  // 10. Bounced
  if (msg.includes('bounced') || msg.includes('bounce')) {
    return {
      errorType: EmailDeliveryErrorType.BOUNCED,
      userFriendlyReason: 'Delivery bounced back from receiving mail server',
      isRetryable: false,
    };
  }

  // 11. 5xx Server errors
  if (statusCode && statusCode >= 500 && statusCode < 600) {
    return {
      errorType: EmailDeliveryErrorType.TEMPORARY_PROVIDER_ERROR,
      userFriendlyReason: `Temporary email provider server error (${statusCode})`,
      isRetryable: true,
    };
  }

  return {
    errorType: EmailDeliveryErrorType.UNKNOWN_ERROR,
    userFriendlyReason: errorMessage || 'Unknown delivery failure',
    isRetryable: true,
  };
}

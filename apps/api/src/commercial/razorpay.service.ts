import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface RazorpayOrderResult {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
}

@Injectable()
export class RazorpayService {
  private readonly logger = new Logger(RazorpayService.name);
  private readonly keyId: string;
  private readonly keySecret: string;
  private readonly webhookSecret: string;
  private readonly isConfigured: boolean;

  constructor(private readonly configService: ConfigService) {
    this.keyId = this.configService.get<string>('RAZORPAY_KEY_ID') || '';
    this.keySecret = this.configService.get<string>('RAZORPAY_KEY_SECRET') || '';
    this.webhookSecret = this.configService.get<string>('RAZORPAY_WEBHOOK_SECRET') || '';
    this.isConfigured = !!(this.keyId && this.keySecret);

    if (this.isConfigured) {
      this.logger.log('Razorpay payment gateway initialized with configured credentials.');
    } else {
      this.logger.warn('Razorpay credentials not fully configured. Operating in test/mock sandbox mode.');
    }
  }

  getPublicKeyId(): string {
    return this.keyId || 'rzp_test_placeholder';
  }

  isLiveGatewayConfigured(): boolean {
    return this.isConfigured;
  }

  /**
   * Mock payment is strictly forbidden in production.
   * In non-production, it requires explicit ENABLE_MOCK_PAYMENTS=true or NODE_ENV=test.
   */
  isMockPaymentAllowed(): boolean {
    const nodeEnv = (
      this.configService.get<string>('NODE_ENV') ||
      process.env.NODE_ENV ||
      'development'
    ).toLowerCase();

    if (nodeEnv === 'production') {
      return false; // NEVER allowed in production
    }

    if (nodeEnv === 'test') {
      return true; // allowed in automated test suites
    }

    const enableMock =
      this.configService.get<string>('ENABLE_MOCK_PAYMENTS') ||
      process.env.ENABLE_MOCK_PAYMENTS;
    return enableMock === 'true';
  }

  /**
   * Creates a Razorpay order. If keys are not set, checks whether mock mode is permitted.
   */
  async createRazorpayOrder(
    amountPaise: number,
    receipt: string,
    notes?: Record<string, string>,
  ): Promise<RazorpayOrderResult> {
    if (this.isConfigured) {
      try {
        const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
        const response = await fetch('https://api.razorpay.com/v1/orders', {
          method: 'POST',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount: amountPaise,
            currency: 'INR',
            receipt,
            notes: notes || {},
          }),
        });

        if (!response.ok) {
          const errBody = await response.text();
          this.logger.error(`Razorpay API error: ${response.status} - ${errBody}`);
          throw new Error(`Razorpay order creation failed: HTTP ${response.status}`);
        }

        const data = (await response.json()) as any;
        return {
          id: data.id,
          amount: data.amount,
          currency: data.currency,
          receipt: data.receipt || receipt,
        };
      } catch (err: any) {
        this.logger.error(`Failed to create real Razorpay order: ${err.message}`);
        throw err;
      }
    }

    if (!this.isMockPaymentAllowed()) {
      const nodeEnv = (
        this.configService.get<string>('NODE_ENV') ||
        process.env.NODE_ENV ||
        'development'
      ).toLowerCase();
      const msg =
        nodeEnv === 'production'
          ? 'Razorpay credentials are not configured on the production server.'
          : 'Razorpay credentials are not configured and mock payment mode is disabled.';
      this.logger.error(msg);
      throw new Error(msg);
    }

    // Sandbox / Test fallback: Generate mock order ID
    const mockId = `order_mock_${crypto.randomBytes(8).toString('hex')}`;
    this.logger.log(`Created mock Razorpay order [${mockId}] for receipt [${receipt}] (amount: ${amountPaise} paise)`);
    return {
      id: mockId,
      amount: amountPaise,
      currency: 'INR',
      receipt,
    };
  }

  /**
   * Verifies the standard Razorpay checkout signature using HMAC-SHA256:
   * expected_signature = hmac_sha256(razorpay_order_id + "|" + razorpay_payment_id, secret)
   */
  verifyPaymentSignature(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string,
  ): boolean {
    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return false;
    }

    const payload = `${razorpayOrderId}|${razorpayPaymentId}`;

    if (this.keySecret) {
      try {
        const expectedSignature = crypto
          .createHmac('sha256', this.keySecret)
          .update(payload)
          .digest('hex');

        const expectedBuf = Buffer.from(expectedSignature);
        const actualBuf = Buffer.from(razorpaySignature);

        if (expectedBuf.length !== actualBuf.length) {
          return false;
        }

        return crypto.timingSafeEqual(expectedBuf, actualBuf);
      } catch (err: any) {
        this.logger.error(`Signature verification error: ${err.message}`);
        return false;
      }
    }

    if (!this.isMockPaymentAllowed()) {
      return false;
    }

    // Test mode fallback: if secret is not set, allow mock signatures for test order IDs only when mock mode is enabled
    if (razorpayOrderId.startsWith('order_mock_')) {
      const mockExpected = crypto
        .createHmac('sha256', 'mock_secret_fallback')
        .update(payload)
        .digest('hex');
      return razorpaySignature === mockExpected || razorpaySignature === 'valid_mock_signature';
    }

    return false;
  }

  /**
   * Verifies the Razorpay webhook signature against the raw request body:
   * expected_signature = hmac_sha256(raw_body, webhook_secret)
   */
  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    if (!rawBody || !signature) {
      return false;
    }

    const secret = this.webhookSecret || this.keySecret;
    if (!secret) {
      this.logger.warn('No webhook secret configured. Webhook rejected.');
      return false;
    }

    try {
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(rawBody)
        .digest('hex');

      const expectedBuf = Buffer.from(expectedSignature);
      const actualBuf = Buffer.from(signature);

      if (expectedBuf.length !== actualBuf.length) {
        return false;
      }

      return crypto.timingSafeEqual(expectedBuf, actualBuf);
    } catch (err: any) {
      this.logger.error(`Webhook signature verification error: ${err.message}`);
      return false;
    }
  }
}

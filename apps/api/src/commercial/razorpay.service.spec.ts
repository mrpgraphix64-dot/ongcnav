import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RazorpayService } from './razorpay.service';
import * as crypto from 'crypto';

describe('RazorpayService', () => {
  let service: RazorpayService;
  const mockKeySecret = 'test_secret_1234567890abcdef';
  const mockWebhookSecret = 'test_webhook_secret_987654321';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RazorpayService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key === 'RAZORPAY_KEY_ID') return 'rzp_test_key123';
              if (key === 'RAZORPAY_KEY_SECRET') return mockKeySecret;
              if (key === 'RAZORPAY_WEBHOOK_SECRET') return mockWebhookSecret;
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<RazorpayService>(RazorpayService);
  });

  it('exposes public key ID safely', () => {
    expect(service.getPublicKeyId()).toBe('rzp_test_key123');
  });

  describe('verifyPaymentSignature', () => {
    it('accepts a cryptographically valid HMAC-SHA256 signature', () => {
      const orderId = 'order_ABC123';
      const paymentId = 'pay_XYZ789';
      const payload = `${orderId}|${paymentId}`;
      const validSignature = crypto
        .createHmac('sha256', mockKeySecret)
        .update(payload)
        .digest('hex');

      const isValid = service.verifyPaymentSignature(orderId, paymentId, validSignature);
      expect(isValid).toBe(true);
    });

    it('rejects a forged or altered payment signature', () => {
      const orderId = 'order_ABC123';
      const paymentId = 'pay_XYZ789';
      const invalidSignature = 'invalid_signature_hex_value';

      const isValid = service.verifyPaymentSignature(orderId, paymentId, invalidSignature);
      expect(isValid).toBe(false);
    });

    it('rejects verification if any argument is missing', () => {
      expect(service.verifyPaymentSignature('', 'pay_1', 'sig')).toBe(false);
      expect(service.verifyPaymentSignature('ord_1', '', 'sig')).toBe(false);
      expect(service.verifyPaymentSignature('ord_1', 'pay_1', '')).toBe(false);
    });
  });

  describe('verifyWebhookSignature', () => {
    it('accepts a valid webhook HMAC-SHA256 signature', () => {
      const rawBody = JSON.stringify({ event: 'payment.captured', id: 'evt_123' });
      const validSignature = crypto
        .createHmac('sha256', mockWebhookSecret)
        .update(rawBody)
        .digest('hex');

      const isValid = service.verifyWebhookSignature(rawBody, validSignature);
      expect(isValid).toBe(true);
    });

    it('rejects an invalid webhook signature', () => {
      const rawBody = JSON.stringify({ event: 'payment.captured' });
      const forgedSignature = 'forged_webhook_signature';

      const isValid = service.verifyWebhookSignature(rawBody, forgedSignature);
      expect(isValid).toBe(false);
    });

    it('rejects a re-serialized (JSON.stringify(JSON.parse(...))) body even though it is semantically identical, proving verification must use the ORIGINAL raw bytes', () => {
      // Razorpay's real webhook body typically has no extra whitespace, but the
      // signature is computed over the exact bytes sent. Simulate the retired
      // fallback (parse then JSON.stringify) with a body that is byte-different
      // after a parse/stringify round trip (extra whitespace after ':' and ',').
      const originalRawBody = '{"event": "payment.captured", "id": "evt_123"}';
      const reSerializedBody = JSON.stringify(JSON.parse(originalRawBody)); // '{"event":"payment.captured","id":"evt_123"}'
      expect(reSerializedBody).not.toBe(originalRawBody);

      const signatureOverOriginal = crypto
        .createHmac('sha256', mockWebhookSecret)
        .update(originalRawBody)
        .digest('hex');

      // The signature Razorpay actually sent (computed over the true raw body)
      // verifies correctly against the raw body...
      expect(service.verifyWebhookSignature(originalRawBody, signatureOverOriginal)).toBe(true);
      // ...but would incorrectly fail if verified against a re-serialized copy —
      // which is exactly why the webhook controller must never fall back to
      // JSON.stringify(req.body) instead of the captured raw request bytes.
      expect(service.verifyWebhookSignature(reSerializedBody, signatureOverOriginal)).toBe(false);
    });
  });

  describe('Mock payment mode environment gating', () => {
    it('strictly forbids mock payment in production environment', async () => {
      const prodModule = await Test.createTestingModule({
        providers: [
          RazorpayService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn().mockImplementation((key: string) => {
                if (key === 'NODE_ENV') return 'production';
                if (key === 'ENABLE_MOCK_PAYMENTS') return 'true'; // Even if someone sets this
                return null;
              }),
            },
          },
        ],
      }).compile();

      const prodService = prodModule.get<RazorpayService>(RazorpayService);
      expect(prodService.isMockPaymentAllowed()).toBe(false);
      await expect(
        prodService.createRazorpayOrder(50000, 'ORD-PROD-TEST'),
      ).rejects.toThrow('Razorpay credentials are not configured on the production server.');
      expect(
        prodService.verifyPaymentSignature('order_mock_123', 'pay_123', 'valid_mock_signature'),
      ).toBe(false);
    });

    it('allows mock payment in non-production only when ENABLE_MOCK_PAYMENTS is true', async () => {
      const devModule = await Test.createTestingModule({
        providers: [
          RazorpayService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn().mockImplementation((key: string) => {
                if (key === 'NODE_ENV') return 'development';
                if (key === 'ENABLE_MOCK_PAYMENTS') return 'false';
                return null;
              }),
            },
          },
        ],
      }).compile();

      const devService = devModule.get<RazorpayService>(RazorpayService);
      expect(devService.isMockPaymentAllowed()).toBe(false);
    });
  });
});

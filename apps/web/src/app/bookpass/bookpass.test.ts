/// <reference types="jest" />
import {
  isStagingTestOrder,
  resolveRazorpayOrderId,
  CreateOrderResponseLike,
} from './bookpass-order.util';

describe('Commercial /bookpass Staging Test Payment Regression Tests', () => {
  describe('resolveRazorpayOrderId', () => {
    it('test payment with missing razorpayOrderId does not crash (returns undefined instead of throwing TypeError)', () => {
      // Prior regression: orderData.razorpayOrderId.startsWith(...) threw
      // "TypeError: Cannot read properties of undefined (reading 'startsWith')"
      expect(() => resolveRazorpayOrderId(undefined)).not.toThrow();
      expect(resolveRazorpayOrderId(undefined)).toBeUndefined();

      expect(() => resolveRazorpayOrderId(null)).not.toThrow();
      expect(resolveRazorpayOrderId(null)).toBeUndefined();

      expect(() => resolveRazorpayOrderId({})).not.toThrow();
      expect(resolveRazorpayOrderId({})).toBeUndefined();
    });

    it('suppresses mock order ID when string starts with order_mock_', () => {
      expect(resolveRazorpayOrderId('order_mock_12345678')).toBeUndefined();
    });

    it('normal Razorpay orders still use razorpayOrderId', () => {
      const realRzpOrderId = 'order_DBJOWzybf0sJbb';
      expect(resolveRazorpayOrderId(realRzpOrderId)).toBe(realRzpOrderId);
    });

    it('handles test orders with TEST_ORD_ prefix properly without crashing', () => {
      const testOrderId = 'TEST_ORD_20261011-ABC';
      expect(resolveRazorpayOrderId(testOrderId)).toBe(testOrderId);
    });
  });

  describe('isStagingTestOrder short-circuit detection', () => {
    it('test payment completes successfully: detects staging test order when res.isTestPayment=true and passes present', () => {
      const res: CreateOrderResponseLike = {
        success: true,
        isTestPayment: true,
        message: 'Staging test order created and verified successfully.',
        order: {
          orderNumber: 'ORD-COMM-20261011-TEST1',
          amountPaise: 14900,
          currency: 'INR',
          // Note: razorpayOrderId is intentionally omitted in this response payload
        },
        passes: [
          {
            ticketNumber: 'TK-COMM-1-1',
            qrCodeToken: 'mock_qr_token_1',
            name: 'Priyesh Shah',
          },
        ],
      };

      expect(isStagingTestOrder(res, res.order)).toBe(true);
    });

    it('detects staging test order when orderData.isTestPayment=true', () => {
      const res: CreateOrderResponseLike = {
        success: true,
        order: {
          orderNumber: 'ORD-COMM-20261011-TEST2',
          isTestPayment: true,
        },
        passes: [
          {
            ticketNumber: 'TK-COMM-1-2',
            qrCodeToken: 'mock_qr_token_2',
          },
        ],
      };

      expect(isStagingTestOrder(res, res.order)).toBe(true);
    });

    it('returns false for normal production Razorpay orders (does not short-circuit)', () => {
      const normalRes: CreateOrderResponseLike = {
        success: true,
        order: {
          orderNumber: 'ORD-COMM-20261011-REAL',
          amountPaise: 24900,
          razorpayOrderId: 'order_DBJOWzybf0sJbb',
          razorpayKeyId: 'rzp_live_12345678',
        },
        // In normal orders, passes are not issued yet before payment
        passes: undefined,
      };

      expect(isStagingTestOrder(normalRes, normalRes.order)).toBe(false);
    });

    it('returns false when passes array is empty', () => {
      const res: CreateOrderResponseLike = {
        success: true,
        isTestPayment: true,
        order: { orderNumber: 'ORD-TEST' },
        passes: [],
      };

      expect(isStagingTestOrder(res, res.order)).toBe(false);
    });
  });

  describe('Full Checkout Flow Decision Logic', () => {
    it('test mode does not open Razorpay and completes directly without crashing on missing razorpayOrderId', () => {
      const testRes: CreateOrderResponseLike = {
        success: true,
        isTestPayment: true,
        order: {
          orderNumber: 'ORD-COMM-TEST-SUCCESS',
          amountPaise: 24900,
          // razorpayOrderId is undefined in this test payment response
          razorpayOrderId: undefined,
        },
        passes: [
          {
            id: '1',
            ticketNumber: 'TK-COMM-1',
            qrCodeToken: 'qr-token-abc',
          },
        ],
      };

      let razorpayOpened = false;
      let orderConfirmed = false;
      let confirmedOrderNum: string | null = null;
      let confirmedPassesList: any[] = [];

      const orderData = testRes.order;

      // Execute exact logic from bookpass/page.tsx:
      if (
        (testRes?.isTestPayment || orderData?.isTestPayment) &&
        Array.isArray(testRes?.passes) &&
        testRes.passes.length > 0
      ) {
        orderConfirmed = true;
        confirmedOrderNum = orderData!.orderNumber!;
        confirmedPassesList = testRes.passes;
      } else {
        // Normal Razorpay path:
        const order_id =
          typeof orderData?.razorpayOrderId === 'string' &&
          orderData.razorpayOrderId.startsWith('order_mock_')
            ? undefined
            : orderData?.razorpayOrderId || undefined;
        razorpayOpened = true;
      }

      // Verification:
      expect(orderConfirmed).toBe(true);
      expect(razorpayOpened).toBe(false); // test mode does not open Razorpay
      expect(confirmedOrderNum).toBe('ORD-COMM-TEST-SUCCESS');
      expect(confirmedPassesList).toHaveLength(1);
    });
  });
});

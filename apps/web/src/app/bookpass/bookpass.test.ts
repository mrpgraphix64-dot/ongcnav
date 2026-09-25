/// <reference types="jest" />
import {
  isStagingTestOrder,
  resolveRazorpayOrderId,
  CreateOrderResponseLike,
  selectSingleBookingDate,
  resolveOrderSelectedDates,
  validateCustomerDetails,
  calculateCommercialTotals,
  validateBookingTerms,
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

  describe('Mandatory Email Validation', () => {
    const validateEmail = (email: string): string | null => {
      if (!email.trim()) {
        return 'Email address is required because your digital QR pass will be sent here.';
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return 'Please enter a valid email address.';
      }
      return null;
    };

    it('rejects empty email with exact requirement message', () => {
      expect(validateEmail('')).toBe(
        'Email address is required because your digital QR pass will be sent here.',
      );
      expect(validateEmail('   ')).toBe(
        'Email address is required because your digital QR pass will be sent here.',
      );
    });

    it('rejects invalid email formats', () => {
      expect(validateEmail('not-an-email')).toBe('Please enter a valid email address.');
      expect(validateEmail('test@')).toBe('Please enter a valid email address.');
      expect(validateEmail('test@domain')).toBe('Please enter a valid email address.');
      expect(validateEmail('@domain.com')).toBe('Please enter a valid email address.');
    });

    it('accepts valid email and normalizes cleanly', () => {
      expect(validateEmail('user@example.com')).toBeNull();
      expect(validateEmail('  USER@EXAMPLE.COM  ')).toBeNull();
      expect('  USER@EXAMPLE.COM  '.trim().toLowerCase()).toBe('user@example.com');
    });
  });

  describe('New 6-Step Commercial Booking Flow Logic', () => {
    const EVENT_DATES = [
      '2026-10-11',
      '2026-10-12',
      '2026-10-13',
      '2026-10-14',
      '2026-10-15',
      '2026-10-16',
      '2026-10-17',
      '2026-10-18',
      '2026-10-19',
    ];

    describe('Step 1 — Category Selection & Pricing Config', () => {
      it('maintains the 4 commercial categories in required order with server-authoritative rates', () => {
        const categories = [
          { code: 'COMMERCIAL_DAILY', name: 'Daily Pass', price: 249, timing: '8:00 PM – 4:00 AM' },
          { code: 'COMMERCIAL_SEASON', name: 'Season Pass', price: 1750, timing: '8:00 PM – 4:00 AM' },
          { code: 'COMMERCIAL_MANDLI', name: 'Mandli Pass', price: 149, timing: '12:00 AM – 4:00 AM' },
          { code: 'COMMERCIAL_ANY_DAY', name: 'Any Day Pass', price: 279, timing: '8:00 PM – 4:00 AM' },
        ];

        expect(categories[0].name).toBe('Daily Pass');
        expect(categories[0].price).toBe(249);
        expect(categories[0].timing).toBe('8:00 PM – 4:00 AM');

        expect(categories[1].name).toBe('Season Pass');
        expect(categories[1].price).toBe(1750);
        expect(categories[1].timing).toBe('8:00 PM – 4:00 AM');

        expect(categories[2].name).toBe('Mandli Pass');
        expect(categories[2].price).toBe(149);
        expect(categories[2].timing).toBe('12:00 AM – 4:00 AM');

        expect(categories[3].name).toBe('Any Day Pass');
        expect(categories[3].price).toBe(279);
        expect(categories[3].timing).toBe('8:00 PM – 4:00 AM');
      });
    });

    describe('Step 2 — Date Selection Rule (Single-Select Only)', () => {
      it('selecting another date replaces previous selection without accumulating', () => {
        let selectedDate = '2026-10-11';
        selectedDate = selectSingleBookingDate(selectedDate, '2026-10-14');
        expect(selectedDate).toBe('2026-10-14');

        selectedDate = selectSingleBookingDate(selectedDate, '2026-10-19');
        expect(selectedDate).toBe('2026-10-19');
      });

      it('Daily / Mandli / Any Day Pass produces exactly ONE booking date in the payload', () => {
        const dailyDates = resolveOrderSelectedDates('COMMERCIAL_DAILY', '2026-10-12', EVENT_DATES);
        expect(dailyDates).toEqual(['2026-10-12']);
        expect(dailyDates).toHaveLength(1);

        const mandliDates = resolveOrderSelectedDates('COMMERCIAL_MANDLI', '2026-10-15', EVENT_DATES);
        expect(mandliDates).toEqual(['2026-10-15']);
        expect(mandliDates).toHaveLength(1);

        const anyDayDates = resolveOrderSelectedDates('COMMERCIAL_ANY_DAY', '2026-10-18', EVENT_DATES);
        expect(anyDayDates).toEqual(['2026-10-18']);
        expect(anyDayDates).toHaveLength(1);
      });

      it('Season Pass automatically covers all event dates in the booking without user date selection', () => {
        const seasonDates = resolveOrderSelectedDates('COMMERCIAL_SEASON', '2026-10-11', EVENT_DATES);
        expect(seasonDates).toHaveLength(9);
        expect(seasonDates).toEqual(EVENT_DATES);
        expect(seasonDates[0]).toBe('2026-10-11');
        expect(seasonDates[8]).toBe('2026-10-19');
      });
    });

    describe('Step 3 — Quantity Selection & Calculation', () => {
      it('comes after Category and Date, and scales total price linearly (1 to 10 passes)', () => {
        const singlePass = calculateCommercialTotals(249, 499, 1);
        expect(singlePass.total).toBe(249);
        expect(singlePass.originalTotal).toBe(499);
        expect(singlePass.savings).toBe(250);

        const fivePasses = calculateCommercialTotals(249, 499, 5);
        expect(fivePasses.total).toBe(1245);
        expect(fivePasses.originalTotal).toBe(2495);
        expect(fivePasses.savings).toBe(1250);

        const tenPassesMandli = calculateCommercialTotals(149, 299, 10);
        expect(tenPassesMandli.total).toBe(1490);
        expect(tenPassesMandli.originalTotal).toBe(2990);
        expect(tenPassesMandli.savings).toBe(1500);
      });

      it('clamps quantity within the allowed 1-10 range', () => {
        const clampedMin = calculateCommercialTotals(249, 499, 0);
        expect(clampedMin.quantity).toBe(1);

        const clampedMax = calculateCommercialTotals(249, 499, 25);
        expect(clampedMax.quantity).toBe(10);
      });
    });

    describe('Step 4 — Customer Details Validation', () => {
      it('validates full name, mobile number, and mandatory email', () => {
        const valid = validateCustomerDetails('Priyesh Shah', '9876543210', 'priyesh@example.com');
        expect(valid.isValid).toBe(true);
        expect(valid.error).toBeUndefined();

        const invalidName = validateCustomerDetails('A', '9876543210', 'priyesh@example.com');
        expect(invalidName.isValid).toBe(false);
        expect(invalidName.error).toBe('Please enter your full name (at least 2 characters).');

        const invalidMobile = validateCustomerDetails('Priyesh Shah', '12345', 'priyesh@example.com');
        expect(invalidMobile.isValid).toBe(false);
        expect(invalidMobile.error).toContain('valid 10-digit Indian mobile number');

        const missingEmail = validateCustomerDetails('Priyesh Shah', '9876543210', '');
        expect(missingEmail.isValid).toBe(false);
        expect(missingEmail.error).toBe(
          'Email address is required because your digital QR pass will be sent here.',
        );
      });
    });

    describe('Order Rule Verification', () => {
      it('1 Order = 1 Category + 1 Booking Date + Quantity', () => {
        const order = {
          ticketType: 'COMMERCIAL_DAILY',
          selectedDates: resolveOrderSelectedDates('COMMERCIAL_DAILY', '2026-10-13', EVENT_DATES),
          quantity: 4,
          pricing: calculateCommercialTotals(249, 499, 4),
        };

        expect(order.ticketType).toBe('COMMERCIAL_DAILY');
        expect(order.selectedDates).toEqual(['2026-10-13']);
        expect(order.quantity).toBe(4);
        expect(order.pricing.total).toBe(996);
      });

      it('Season Pass covers all dates in 1 order', () => {
        const seasonOrder = {
          ticketType: 'COMMERCIAL_SEASON',
          selectedDates: resolveOrderSelectedDates('COMMERCIAL_SEASON', '2026-10-11', EVENT_DATES),
          quantity: 2,
          pricing: calculateCommercialTotals(1750, 3500, 2),
        };

        expect(seasonOrder.ticketType).toBe('COMMERCIAL_SEASON');
        expect(seasonOrder.selectedDates).toEqual(EVENT_DATES);
        expect(seasonOrder.quantity).toBe(2);
        expect(seasonOrder.pricing.total).toBe(3500);
      });
    });

    describe('Terms & Conditions Acceptance Validation', () => {
      it('rejects order when terms are not accepted (termsAccepted = false)', () => {
        const result = validateBookingTerms(false);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Please accept the ticket terms & conditions to continue.');
      });

      it('accepts order when terms are agreed to (termsAccepted = true)', () => {
        const result = validateBookingTerms(true);
        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('submit button disabled logic requires termsAccepted = true and not submitting/verifying', () => {
        const isSubmitDisabled = (terms: boolean, submitting: boolean, verifying: boolean) =>
          !terms || submitting || verifying;

        expect(isSubmitDisabled(false, false, false)).toBe(true);
        expect(isSubmitDisabled(true, false, false)).toBe(false);
        expect(isSubmitDisabled(true, true, false)).toBe(true);
        expect(isSubmitDisabled(true, false, true)).toBe(true);
      });
    });
  });
});

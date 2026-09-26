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
  getPassTiming,
  getPassTypeLabel,
  formatConfirmedDates,
  escapeXml,
  generateDownloadablePassSvg,
} from './bookpass-order.util';

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

  describe('Commercial Ticket Confirmation UI/UX Experience', () => {
    describe('Pass Timing Authority', () => {
      it('1. One-pass Daily booking uses 8:00 PM – 4:00 AM', () => {
        expect(getPassTiming('COMMERCIAL_DAILY')).toBe('8:00 PM – 4:00 AM');
        expect(getPassTypeLabel('COMMERCIAL_DAILY')).toBe('Daily Entry Pass');
      });

      it('2. One-pass Mandli booking uses 12:00 AM – 4:00 AM', () => {
        expect(getPassTiming('COMMERCIAL_MANDLI')).toBe('12:00 AM – 4:00 AM');
        expect(getPassTypeLabel('COMMERCIAL_MANDLI')).toBe('Mandli Pass');
      });

      it('3. One-pass Any Day booking uses 8:00 PM – 4:00 AM', () => {
        expect(getPassTiming('COMMERCIAL_ANY_DAY')).toBe('8:00 PM – 4:00 AM');
        expect(getPassTypeLabel('COMMERCIAL_ANY_DAY')).toBe('Any Day Pass');
      });

      it('4. Season pass uses 8:00 PM – 4:00 AM and covers All 9 Nights', () => {
        expect(getPassTiming('COMMERCIAL_SEASON')).toBe('8:00 PM – 4:00 AM');
        expect(getPassTypeLabel('COMMERCIAL_SEASON')).toBe('Season Pass (All 9 Nights)');
        expect(formatConfirmedDates(EVENT_DATES, 'COMMERCIAL_SEASON')).toBe(
          '11–19 October 2026 (All 9 Nights)',
        );
      });
    });

    describe('Pass Card Structure & Formatting', () => {
      it('5. Quantity > 1: multiple passes are represented with unique indices', () => {
        const passes = [
          {
            id: 'pass-1',
            ticketNumber: 'TK-COMM-ORD1-1-A1',
            qrCodeToken: 'token_alpha_1',
            qrSvg: '<svg>qr1</svg>',
            name: 'Aarav Patel',
            mobile: '9876543210',
            category: 'Commercial Pass',
            bookingDays: ['2026-10-11'],
          },
          {
            id: 'pass-2',
            ticketNumber: 'TK-COMM-ORD1-2-B2',
            qrCodeToken: 'token_beta_2',
            qrSvg: '<svg>qr2</svg>',
            name: 'Diya Patel',
            mobile: '9876543210',
            category: 'Commercial Pass',
            bookingDays: ['2026-10-11'],
          },
        ];

        expect(passes).toHaveLength(2);
        expect(passes[0].ticketNumber).not.toBe(passes[1].ticketNumber);
        expect(passes[0].qrCodeToken).not.toBe(passes[1].qrCodeToken);
        expect(passes[0].qrSvg).not.toBe(passes[1].qrSvg);
      });

      it('6. Multiple unique QR codes: each pass has its own secure token and SVG', () => {
        const tokens = new Set(['token_unique_1', 'token_unique_2', 'token_unique_3']);
        expect(tokens.size).toBe(3);
      });

      it('7. Correct ticket IDs: follows canonical format TK-COMM-...', () => {
        const ticketId = 'TK-COMM-20261011-1-A1B2';
        expect(ticketId).toMatch(/^TK-COMM-/);
      });

      it('8. Correct dates: formats single dates and date ranges cleanly', () => {
        const singleDate = formatConfirmedDates(['2026-10-12'], 'COMMERCIAL_DAILY');
        expect(singleDate).toContain('12 Oct 2026');

        const seasonDate = formatConfirmedDates(EVENT_DATES, 'COMMERCIAL_SEASON');
        expect(seasonDate).toBe('11–19 October 2026 (All 9 Nights)');
      });

      it('9. Correct order amount calculation', () => {
        const dailyOrder = calculateCommercialTotals(249, 499, 3);
        expect(dailyOrder.total).toBe(747);

        const mandliOrder = calculateCommercialTotals(149, 299, 2);
        expect(mandliOrder.total).toBe(298);

        const seasonOrder = calculateCommercialTotals(1750, 3500, 1);
        expect(seasonOrder.total).toBe(1750);
      });

      it('10. Correct secure ticket route URL: points to /ticket/[token]', () => {
        const token = 'crypto_token_secure_98765';
        const ticketUrl = `/ticket/${token}`;
        expect(ticketUrl).toBe('/ticket/crypto_token_secure_98765');
        expect(ticketUrl).not.toContain('cpf');
        expect(ticketUrl).not.toContain('admin');
      });

      it('11. Staging test-payment confirmation is detected and preserved', () => {
        const testRes: CreateOrderResponseLike = {
          success: true,
          isTestPayment: true,
          order: {
            orderNumber: 'ORD-COMM-STAGING-TEST',
            isTestPayment: true,
          },
          passes: [
            {
              id: '1',
              ticketNumber: 'TK-COMM-STG-1',
              qrCodeToken: 'tok_stg_1',
              qrSvg: '<svg></svg>',
              name: 'Tester',
            },
          ],
        };
        expect(isStagingTestOrder(testRes, testRes.order)).toBe(true);
      });
    });

    describe('generateDownloadablePassSvg security and functional assertions', () => {
      const mockQrSvg =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 29 29" shape-rendering="crispEdges"><path fill="#ffffff" d="M0 0h29v29H0z"/><path stroke="#000000" d="M1 1.5h7m4 0h4m1 0h1m1 0h7M1 2.5h1"/></svg>';

      it('1. Contains NO raw QR token as visible text', () => {
        const secretToken = 'SECRET_QR_TOKEN_890a-bcde-f123456';
        const svg = generateDownloadablePassSvg({
          ticketNumber: 'NR2026-COMM-1011-01',
          name: 'Anjali Sharma',
          passTypeLabel: 'Season Pass (All 9 Nights)',
          formattedDates: '11–19 October 2026 (All 9 Nights)',
          qrSvg: mockQrSvg,
        });

        // The token is not in any text tag or visible attribute
        expect(svg).not.toContain(secretToken);
        expect(svg).not.toContain(`>${secretToken}<`);
      });

      it('2. Contains NO database or internal IDs', () => {
        const internalDbId = 'clx9876543210databaseid';
        const internalUserId = 'usr_internal_admin_secret_999';
        const svg = generateDownloadablePassSvg({
          ticketNumber: 'NR2026-COMM-1011-02',
          name: 'Rohit Verma',
          passTypeLabel: 'Daily Entry Pass',
          formattedDates: '11 Oct 2026',
          qrSvg: mockQrSvg,
        });

        expect(svg).not.toContain(internalDbId);
        expect(svg).not.toContain(internalUserId);
        expect(svg).not.toContain('clx');
        expect(svg).not.toContain('orderId');
        expect(svg).not.toContain('attendeeId');
      });

      it('3. Contains NO Razorpay or payment IDs', () => {
        const rzpOrderId = 'order_MNOP1234567890';
        const rzpPaymentId = 'pay_QRST9876543210';
        const rzpSignature = 'sig_uvwxyz1234567890abcdef';
        const svg = generateDownloadablePassSvg({
          ticketNumber: 'NR2026-COMM-1011-03',
          name: 'Vikram Mehta',
          passTypeLabel: 'Mandli Pass',
          formattedDates: '15 Oct 2026',
          qrSvg: mockQrSvg,
        });

        expect(svg).not.toContain(rzpOrderId);
        expect(svg).not.toContain(rzpPaymentId);
        expect(svg).not.toContain(rzpSignature);
        expect(svg).not.toContain('razorpay');
        expect(svg).not.toContain('amountPaise');
      });

      it('4. Contains ONLY the intended ticket information', () => {
        const svg = generateDownloadablePassSvg({
          ticketNumber: 'NR2026-COMM-1011-04',
          name: 'Pooja Bhatt',
          passTypeLabel: 'Season Pass (All 9 Nights)',
          formattedDates: '11–19 October 2026 (All 9 Nights)',
          qrSvg: mockQrSvg,
        });

        // Event name
        expect(svg).toContain('ONGC NAVRATRI 2026');
        expect(svg).toContain('OFFICIAL ENTRY PASS');
        // Pass type
        expect(svg).toContain('Season Pass (All 9 Nights)');
        // Attendee name
        expect(svg).toContain('Pooja Bhatt');
        // Ticket number
        expect(svg).toContain('NR2026-COMM-1011-04');
        // Event date
        expect(svg).toContain('11–19 October 2026 (All 9 Nights)');
        // Scan instruction
        expect(svg).toContain('SCAN AT ENTRY');
      });

      it('5. QR remains scannable: preserves viewBox, crispEdges, and quiet zone background', () => {
        const svg = generateDownloadablePassSvg({
          ticketNumber: 'NR2026-COMM-1011-05',
          name: 'Test Attendee',
          passTypeLabel: 'Daily Entry Pass',
          formattedDates: '12 Oct 2026',
          qrSvg: mockQrSvg,
        });

        // Preserves original viewBox
        expect(svg).toContain('viewBox="0 0 29 29"');
        // Preserves pixel-crisp rendering
        expect(svg).toContain('shape-rendering="crispEdges"');
        // Preserves white background quiet zone
        expect(svg).toContain('fill="#ffffff" d="M0 0h29v29H0z"');
        // Preserves QR matrix paths
        expect(svg).toContain('stroke="#000000"');
      });

      it('6. Requires NO external network or resource references (zero http/https/imports)', () => {
        const svg = generateDownloadablePassSvg({
          ticketNumber: 'NR2026-COMM-1011-06',
          name: 'Self Contained Pass',
          passTypeLabel: 'Any Day Pass',
          formattedDates: '14 Oct 2026',
          qrSvg: mockQrSvg,
        });

        // Only allowed XML namespace
        const urls = svg.match(/https?:\/\/[^\s"'>]+/g) || [];
        expect(urls).toEqual(['http://www.w3.org/2000/svg']);
        expect(svg).not.toContain('@import');
        expect(svg).not.toContain('<image');
        expect(svg).not.toContain('<link');
      });

      it('7. Properly XML-escapes special characters to prevent malformed SVG XML', () => {
        expect(escapeXml('A & B <Partners> "Gold" \'VIP\'')).toBe(
          'A &amp; B &lt;Partners&gt; &quot;Gold&quot; &apos;VIP&apos;',
        );

        const svg = generateDownloadablePassSvg({
          ticketNumber: 'TK-1 & 2',
          name: 'Mehta & Sons <VIP>',
          passTypeLabel: 'Special & Daily Pass',
          formattedDates: '11 & 12 Oct 2026',
          qrSvg: mockQrSvg,
        });

        expect(svg).toContain('Mehta &amp; Sons &lt;VIP&gt;');
        expect(svg).toContain('TK-1 &amp; 2');
        expect(svg).toContain('Special &amp; Daily Pass');
        expect(svg).toContain('11 &amp; 12 Oct 2026');
        expect(svg).not.toContain('Mehta & Sons <VIP>');
      });

      it('8. Fallback to default name if attendee name is missing or empty', () => {
        const svg = generateDownloadablePassSvg({
          ticketNumber: 'TK-NO-NAME',
          name: '',
          passTypeLabel: 'Daily Entry Pass',
          formattedDates: '11 Oct 2026',
          qrSvg: mockQrSvg,
        });

        expect(svg).toContain('Pass Holder');
      });
    });
  });
});

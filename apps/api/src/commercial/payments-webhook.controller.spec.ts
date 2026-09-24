import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PaymentsWebhookController } from './payments-webhook.controller';
import { CommercialService } from './commercial.service';

describe('PaymentsWebhookController', () => {
  let controller: PaymentsWebhookController;
  let commercialService: any;

  beforeEach(async () => {
    commercialService = {
      handleWebhook: jest.fn().mockResolvedValue({ success: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsWebhookController],
      providers: [{ provide: CommercialService, useValue: commercialService }],
    }).compile();

    controller = module.get<PaymentsWebhookController>(PaymentsWebhookController);
  });

  it('passes the ORIGINAL raw request bytes (req.rawBody) to signature verification, not a re-serialized JSON.stringify(req.body)', async () => {
    // Deliberately formatted with whitespace that JSON.stringify(JSON.parse(...))
    // would strip, so this proves the exact captured bytes are forwarded untouched.
    const rawBodyText = '{"event": "payment.captured",  "id": "evt_raw_1"}';
    const req = {
      rawBody: Buffer.from(rawBodyText, 'utf8'),
      body: { event: 'payment.captured', id: 'evt_raw_1' },
    } as any;

    await controller.handleWebhook('valid_signature', req);

    expect(commercialService.handleWebhook).toHaveBeenCalledWith(rawBodyText, 'valid_signature');
    // Explicitly confirm the forwarded body is not the re-serialized form.
    const forwardedBody = commercialService.handleWebhook.mock.calls[0][0];
    expect(forwardedBody).not.toBe(JSON.stringify(req.body));
  });

  it('rejects the request when the x-razorpay-signature header is missing', async () => {
    const req = { rawBody: Buffer.from('{}', 'utf8'), body: {} } as any;

    await expect(controller.handleWebhook(undefined as any, req)).rejects.toThrow(
      BadRequestException,
    );
    expect(commercialService.handleWebhook).not.toHaveBeenCalled();
  });

  it('rejects the request when req.rawBody was not captured, instead of falling back to JSON.stringify(req.body)', async () => {
    const req = { body: { event: 'payment.captured' } } as any; // no rawBody

    await expect(controller.handleWebhook('some_signature', req)).rejects.toThrow(
      BadRequestException,
    );
    expect(commercialService.handleWebhook).not.toHaveBeenCalled();
  });
});

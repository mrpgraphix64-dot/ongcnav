import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { EmailWebhookController } from './email-webhook.controller';
import { EmployeeQrDeliveryService } from '../registration/employee-qr-delivery.service';
import * as crypto from 'crypto';

describe('EmailWebhookController', () => {
  let controller: EmailWebhookController;
  let deliveryService: any;
  let configService: any;
  const mockSecret = 'super_secret_webhook_key_123';

  beforeEach(async () => {
    deliveryService = {
      processProviderWebhook: jest.fn().mockResolvedValue({ success: true, updated: true }),
    };

    configService = {
      get: jest.fn((key: string) => {
        if (key === 'EMAIL_WEBHOOK_SECRET') return mockSecret;
        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmailWebhookController],
      providers: [
        { provide: EmployeeQrDeliveryService, useValue: deliveryService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    controller = module.get<EmailWebhookController>(EmailWebhookController);
  });

  it('rejects unauthenticated requests when secret is configured', async () => {
    await expect(controller.handleDeliveryEvent({ event: 'delivered' })).rejects.toThrow(
      UnauthorizedException,
    );
    expect(deliveryService.processProviderWebhook).not.toHaveBeenCalled();
  });

  it('accepts authenticated requests with valid HMAC-SHA256 signature', async () => {
    const payload = { eventId: 'evt-1', messageId: 'msg-1', event: 'delivered' };
    const rawBody = JSON.stringify(payload);
    const signature = crypto.createHmac('sha256', mockSecret).update(rawBody).digest('hex');

    const res = await controller.handleDeliveryEvent(payload, signature);
    expect(res.success).toBe(true);
    expect(deliveryService.processProviderWebhook).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'evt-1',
        messageId: 'msg-1',
        event: 'delivered',
      }),
    );
  });

  it('accepts authenticated requests with Bearer token matching secret', async () => {
    const payload = { eventId: 'evt-2', messageId: 'msg-2', event: 'bounce', reason: 'Mailbox full' };
    const res = await controller.handleDeliveryEvent(payload, undefined, `Bearer ${mockSecret}`);
    expect(res.success).toBe(true);
    expect(deliveryService.processProviderWebhook).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'evt-2',
        messageId: 'msg-2',
        event: 'bounce',
        reason: 'Mailbox full',
      }),
    );
  });
});

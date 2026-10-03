import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { EmployeeQrDeliveryService } from '../registration/employee-qr-delivery.service';
import * as crypto from 'crypto';

@ApiTags('Email Webhooks')
@Controller('webhooks/email')
export class EmailWebhookController {
  private readonly logger = new Logger(EmailWebhookController.name);
  private readonly webhookSecret: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly employeeQrDeliveryService: EmployeeQrDeliveryService,
  ) {
    this.webhookSecret = (
      this.configService.get<string>('EMAIL_WEBHOOK_SECRET') ||
      this.configService.get<string>('HOSTINGER_WEBHOOK_SECRET') ||
      ''
    ).trim();
  }

  @Post('delivery-event')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive email delivery event notifications from email provider/gateway' })
  async handleDeliveryEvent(
    @Body() body: any,
    @Headers('x-webhook-signature') signature?: string,
    @Headers('authorization') authHeader?: string,
  ) {
    // 1. Signature or token verification if secret is configured
    if (this.webhookSecret) {
      let authorized = false;
      if (signature) {
        // HMAC-SHA256 signature verification
        const computed = crypto
          .createHmac('sha256', this.webhookSecret)
          .update(typeof body === 'string' ? body : JSON.stringify(body))
          .digest('hex');
        if (crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(computed))) {
          authorized = true;
        }
      } else if (authHeader) {
        const token = authHeader.replace(/^Bearer\s+/i, '').trim();
        if (token === this.webhookSecret) {
          authorized = true;
        }
      }

      if (!authorized) {
        this.logger.warn('Rejected unauthorized email delivery webhook event.');
        throw new UnauthorizedException('Invalid webhook signature or credentials.');
      }
    }

    if (!body) {
      throw new BadRequestException('Empty webhook payload received.');
    }

    // 2. Normalize payload event data
    const eventId =
      body.eventId ||
      body.id ||
      body.event_id ||
      body.messageId ||
      `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const messageId = body.messageId || body.message_id || body['x-message-id'];
    const event = body.event || body.type || body.status || 'unknown';
    const recipient = body.recipient || body.email || body.to;
    const reason = body.reason || body.error || body.description || body.response;
    const timestamp = body.timestamp || body.created_at || new Date().toISOString();

    return this.employeeQrDeliveryService.processProviderWebhook({
      eventId,
      messageId,
      event,
      recipient,
      reason,
      timestamp,
    });
  }
}

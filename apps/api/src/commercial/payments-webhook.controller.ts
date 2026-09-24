import {
  Controller,
  Post,
  Headers,
  Req,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { CommercialService } from './commercial.service';

@ApiTags('Payment Webhooks')
@Controller('payments/razorpay')
export class PaymentsWebhookController {
  constructor(private readonly commercialService: CommercialService) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Razorpay webhook endpoint for asynchronous payment event processing' })
  async handleWebhook(
    @Headers('x-razorpay-signature') signature: string,
    @Req() req: Request,
  ) {
    if (!signature) {
      throw new BadRequestException('Missing x-razorpay-signature header');
    }

    // HMAC-SHA256 signature verification MUST use the exact original request
    // bytes Razorpay signed — never a re-serialized JSON.stringify(req.body),
    // which is not guaranteed to be byte-identical (key order, number
    // formatting, whitespace) and would make verification unreliable.
    // req.rawBody is captured globally in main.ts via express.json()'s
    // verify() hook.
    const rawBodyBuffer: Buffer | undefined = (req as any).rawBody;
    if (!rawBodyBuffer) {
      throw new BadRequestException('Raw request body unavailable for signature verification');
    }

    return this.commercialService.handleWebhook(rawBodyBuffer.toString('utf8'), signature);
  }
}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { MailModule } from '../mail/mail.module';
import { CommercialController, CommercialAdminController } from './commercial.controller';
import {
  CommercialAgentController,
  CommercialAgentAdminController,
} from './commercial-agent.controller';
import { PaymentsWebhookController } from './payments-webhook.controller';
import { CommercialService } from './commercial.service';
import { CommercialAgentService } from './commercial-agent.service';
import { RazorpayService } from './razorpay.service';

@Module({
  imports: [ConfigModule, PrismaModule, RedisModule, MailModule],
  controllers: [
    CommercialController,
    CommercialAdminController,
    CommercialAgentController,
    CommercialAgentAdminController,
    PaymentsWebhookController,
  ],
  providers: [CommercialService, CommercialAgentService, RazorpayService],
  exports: [CommercialService, CommercialAgentService, RazorpayService],
})
export class CommercialModule {}

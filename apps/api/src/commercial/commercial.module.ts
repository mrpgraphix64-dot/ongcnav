import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { MailModule } from '../mail/mail.module';
import { CommercialController, CommercialAdminController } from './commercial.controller';
import { PaymentsWebhookController } from './payments-webhook.controller';
import { CommercialService } from './commercial.service';
import { RazorpayService } from './razorpay.service';

@Module({
  imports: [ConfigModule, PrismaModule, RedisModule, MailModule],
  controllers: [
    CommercialController,
    CommercialAdminController,
    PaymentsWebhookController,
  ],
  providers: [CommercialService, RazorpayService],
  exports: [CommercialService, RazorpayService],
})
export class CommercialModule {}

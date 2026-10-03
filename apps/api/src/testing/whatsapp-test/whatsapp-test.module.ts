import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../prisma/prisma.module';
import { WhatsAppModule } from '../../whatsapp/whatsapp.module';
import { WhatsAppTestController } from './whatsapp-test.controller';
import { WhatsAppTestPublicController } from './whatsapp-test-public.controller';
import { WhatsAppTestService } from './whatsapp-test.service';

@Module({
  imports: [ConfigModule, PrismaModule, WhatsAppModule],
  controllers: [WhatsAppTestController, WhatsAppTestPublicController],
  providers: [WhatsAppTestService],
  exports: [WhatsAppTestService],
})
export class WhatsAppTestModule {}

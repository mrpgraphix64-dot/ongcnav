import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MailModule } from '../mail/mail.module';
import { SettingsModule } from '../settings/settings.module';
import { SuperAdminTestingService } from './super-admin-testing.service';
import { SuperAdminTestingController } from './super-admin-testing.controller';

@Module({
  imports: [PrismaModule, MailModule, SettingsModule],
  controllers: [SuperAdminTestingController],
  providers: [SuperAdminTestingService],
  exports: [SuperAdminTestingService],
})
export class SuperAdminTestingModule {}

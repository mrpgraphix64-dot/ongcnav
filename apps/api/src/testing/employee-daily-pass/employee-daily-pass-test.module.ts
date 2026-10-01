import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { MailModule } from '../../mail/mail.module';
import { RegistrationModule } from '../../registration/registration.module';
import { CheckinModule } from '../../checkin/checkin.module';
import { EmployeeDailyPassTestController } from './employee-daily-pass-test.controller';
import { EmployeeDailyPassTestService } from './employee-daily-pass-test.service';

@Module({
  imports: [PrismaModule, MailModule, RegistrationModule, CheckinModule],
  controllers: [EmployeeDailyPassTestController],
  providers: [EmployeeDailyPassTestService],
  exports: [EmployeeDailyPassTestService],
})
export class EmployeeDailyPassTestModule {}

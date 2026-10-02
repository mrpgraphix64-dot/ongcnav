import { Module } from '@nestjs/common';
import { RegistrationService } from './registration.service';
import { RegistrationController } from './registration.controller';
import { AttendeesService } from './attendees.service';
import { AttendeesController } from './attendees.controller';
import { BulkUploadController } from './bulk-upload.controller';
import { EmployeesService } from './employees.service';
import { EmployeesController } from './employees.controller';
import { DailyPassPdfService } from './daily-pass-pdf.service';
import { EmployeeDispatchSchedulerService } from './employee-dispatch-scheduler.service';

import { MailModule } from '../mail/mail.module';

@Module({
  imports: [MailModule],
  providers: [
    RegistrationService,
    AttendeesService,
    EmployeesService,
    DailyPassPdfService,
    EmployeeDispatchSchedulerService,
  ],
  controllers: [
    RegistrationController,
    AttendeesController,
    BulkUploadController,
    EmployeesController,
  ],
  exports: [
    RegistrationService,
    AttendeesService,
    EmployeesService,
    DailyPassPdfService,
    EmployeeDispatchSchedulerService,
  ],
})
export class RegistrationModule {}

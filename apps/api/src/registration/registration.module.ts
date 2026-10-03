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
import { EmployeeMasterService } from './employee-master.service';
import { EmployeeMasterController } from './employee-master.controller';

import { MailModule } from '../mail/mail.module';

import { EmployeeQrDeliveryService } from './employee-qr-delivery.service';
import { EmailWebhookController } from '../mail/email-webhook.controller';

@Module({
  imports: [MailModule],
  providers: [
    RegistrationService,
    AttendeesService,
    EmployeesService,
    EmployeeQrDeliveryService,
    DailyPassPdfService,
    EmployeeDispatchSchedulerService,
    EmployeeMasterService,
  ],
  controllers: [
    EmployeeMasterController,
    RegistrationController,
    AttendeesController,
    BulkUploadController,
    EmployeesController,
    EmailWebhookController,
  ],
  exports: [
    RegistrationService,
    AttendeesService,
    EmployeesService,
    EmployeeQrDeliveryService,
    DailyPassPdfService,
    EmployeeDispatchSchedulerService,
    EmployeeMasterService,
  ],
})
export class RegistrationModule {}

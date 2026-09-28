import { Module } from '@nestjs/common';
import { RegistrationService } from './registration.service';
import { RegistrationController } from './registration.controller';
import { AttendeesService } from './attendees.service';
import { AttendeesController } from './attendees.controller';
import { BulkUploadController } from './bulk-upload.controller';
import { EmployeesService } from './employees.service';
import { EmployeesController } from './employees.controller';

@Module({
  providers: [RegistrationService, AttendeesService, EmployeesService],
  controllers: [
    RegistrationController,
    AttendeesController,
    BulkUploadController,
    EmployeesController,
  ],
  exports: [RegistrationService, AttendeesService, EmployeesService],
})
export class RegistrationModule {}

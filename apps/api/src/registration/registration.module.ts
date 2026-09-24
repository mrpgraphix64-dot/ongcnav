import { Module } from '@nestjs/common';
import { RegistrationService } from './registration.service';
import { RegistrationController } from './registration.controller';
import { AttendeesService } from './attendees.service';
import { AttendeesController } from './attendees.controller';
import { BulkUploadController } from './bulk-upload.controller';

@Module({
  providers: [RegistrationService, AttendeesService],
  controllers: [RegistrationController, AttendeesController, BulkUploadController],
  exports: [RegistrationService, AttendeesService],
})
export class RegistrationModule {}

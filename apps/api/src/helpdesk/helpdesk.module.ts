import { Module } from '@nestjs/common';
import { HelpDeskService } from './helpdesk.service';
import { HelpDeskController } from './helpdesk.controller';

import { CheckinCorrectionController } from './checkin-correction.controller';

@Module({
  providers: [HelpDeskService],
  controllers: [HelpDeskController, CheckinCorrectionController],
  exports: [HelpDeskService],
})
export class HelpDeskModule {}

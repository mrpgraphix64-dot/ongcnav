import { Module } from '@nestjs/common';
import { CheckinService } from './checkin.service';
import { ScannerController } from './scanner.controller';

@Module({
  providers: [CheckinService],
  controllers: [ScannerController],
  exports: [CheckinService],
})
export class CheckinModule {}

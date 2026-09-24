import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { DailyClosingService } from './daily-closing.service';
import { ReportsController } from './reports.controller';
import { DailyClosingController } from './daily-closing.controller';

@Module({
  providers: [ReportsService, DailyClosingService],
  controllers: [ReportsController, DailyClosingController],
  exports: [ReportsService, DailyClosingService],
})
export class ReportsModule {}

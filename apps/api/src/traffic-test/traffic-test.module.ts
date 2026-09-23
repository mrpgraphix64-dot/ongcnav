import { Module } from '@nestjs/common';
import { TrafficTestService } from './traffic-test.service';
import { TrafficTestController } from './traffic-test.controller';
import { CheckinModule } from '../checkin/checkin.module';

@Module({
  imports: [CheckinModule],
  providers: [TrafficTestService],
  controllers: [TrafficTestController],
  exports: [TrafficTestService],
})
export class TrafficTestModule {}

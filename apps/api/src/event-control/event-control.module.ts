import { Global, Module } from '@nestjs/common';
import { EventControlController } from './event-control.controller';
import { EventControlService } from './event-control.service';

@Global()
@Module({
  controllers: [EventControlController],
  providers: [EventControlService],
  exports: [EventControlService],
})
export class EventControlModule {}

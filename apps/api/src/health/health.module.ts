import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

// No service needed — PrismaService and RedisService are both @Global()
// modules already, so the controller can inject them directly.
@Module({
  controllers: [HealthController],
})
export class HealthModule {}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { EventControlModule } from './event-control/event-control.module';
import { GatesModule } from './gates/gates.module';
import { StaffModule } from './staff/staff.module';
import { RegistrationModule } from './registration/registration.module';
import { CheckinModule } from './checkin/checkin.module';
import { HelpDeskModule } from './helpdesk/helpdesk.module';
import { IncidentsModule } from './incidents/incidents.module';
import { ReportsModule } from './reports/reports.module';
import { TrafficTestModule } from './traffic-test/traffic-test.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    PrismaModule,
    RedisModule,
    HealthModule,
    AuthModule,
    EventControlModule,
    GatesModule,
    StaffModule,
    RegistrationModule,
    CheckinModule,
    HelpDeskModule,
    IncidentsModule,
    ReportsModule,
    TrafficTestModule,
  ],
})
export class AppModule {}

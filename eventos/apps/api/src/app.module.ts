import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { AdminMutationGuard } from './security/admin-mutation.guard';
import { PublicThrottlerGuard } from './security/public-throttler.guard';
import { AuditModule } from './audit/audit.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { DrawsModule } from './draws/draws.module';
import { EventsModule } from './events/events.module';
import { FraudRulesModule } from './fraud-rules/fraud-rules.module';
import { HealthModule } from './health/health.module';
import { ParticipantsModule } from './participants/participants.module';
import { PrismaModule } from './prisma/prisma.module';
import { PrizeQueueModule } from './prize-queue/prize-queue.module';
import { PrizesModule } from './prizes/prizes.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { AdminUsersModule } from './admin-users/admin-users.module';
import { MeetingsModule } from './meetings/meetings.module';
import { VipCodesModule } from './vip-codes/vip-codes.module';
import { LiveModule } from './live/live.module';
import { CrmModule } from './crm/crm.module';
import { InvictusSeedService } from './seed/invictus-seed.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 500 }]),
    PrismaModule,
    HealthModule,
    AuditModule,
    EventsModule,
    FraudRulesModule,
    PrizesModule,
    PrizeQueueModule,
    DrawsModule,
    ParticipantsModule,
    DashboardModule,
    WhatsappModule,
    AdminUsersModule,
    MeetingsModule,
    VipCodesModule,
    LiveModule,
    CrmModule,
  ],

  controllers: [AppController],

  providers: [
    AppService,
    InvictusSeedService,

    {
      provide: APP_GUARD,
      useClass: AdminMutationGuard,
    },

    {
      provide: APP_GUARD,
      useClass: PublicThrottlerGuard,
    },
  ],
})
export class AppModule {}

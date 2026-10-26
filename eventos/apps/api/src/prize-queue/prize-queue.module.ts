import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';

import { PrizeQueueController } from './prize-queue.controller';
import { PrizeQueueService } from './prize-queue.service';

@Module({
  imports: [AuditModule],

  controllers: [PrizeQueueController],

  providers: [PrizeQueueService],

  exports: [PrizeQueueService],
})
export class PrizeQueueModule {}

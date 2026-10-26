import { Module } from '@nestjs/common';

import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { EventReportService } from './event-report.service';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [WhatsappModule],

  controllers: [DashboardController],

  providers: [DashboardService, EventReportService],

  exports: [DashboardService],
})
export class DashboardModule {}

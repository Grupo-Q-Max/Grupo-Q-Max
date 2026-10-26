import { Module } from '@nestjs/common';

import { DrawsController } from './draws.controller';
import { DrawsService } from './draws.service';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { StockAlertsModule } from '../stock-alerts/stock-alerts.module';

@Module({
  imports: [WhatsappModule, StockAlertsModule],
  controllers: [DrawsController],

  providers: [DrawsService],

  exports: [DrawsService],
})
export class DrawsModule {}

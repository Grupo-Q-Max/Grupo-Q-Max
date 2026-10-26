import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { StockAlertsModule } from '../stock-alerts/stock-alerts.module';

import { PrizesController } from './prizes.controller';
import { PrizesService } from './prizes.service';

@Module({
  imports: [AuditModule, StockAlertsModule],

  controllers: [PrizesController],

  providers: [PrizesService],

  exports: [PrizesService],
})
export class PrizesModule {}

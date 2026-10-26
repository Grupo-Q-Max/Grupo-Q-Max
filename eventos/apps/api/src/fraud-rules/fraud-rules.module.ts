import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';

import { FraudRulesController } from './fraud-rules.controller';
import { FraudRulesService } from './fraud-rules.service';

@Module({
  imports: [AuditModule],
  controllers: [FraudRulesController],
  providers: [FraudRulesService],
  exports: [FraudRulesService],
})
export class FraudRulesModule {}

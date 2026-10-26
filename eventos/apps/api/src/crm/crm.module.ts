import { Module } from '@nestjs/common';
import { CrmRetryJob } from './crm-retry.job';
import { CrmService } from './crm.service';

@Module({
  providers: [CrmService, CrmRetryJob],
})
export class CrmModule {}

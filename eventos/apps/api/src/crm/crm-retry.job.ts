import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CrmService } from './crm.service';

// Separado do serviço: @nestjs/schedule é ESM e não carrega nos specs do Jest.
@Injectable()
export class CrmRetryJob {
  constructor(private readonly crm: CrmService) {}

  @Cron('0 */5 * * * *')
  run() {
    return this.crm.retryPending();
  }
}

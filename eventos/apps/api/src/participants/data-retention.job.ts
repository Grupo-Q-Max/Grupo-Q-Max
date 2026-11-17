import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataRetentionService } from './data-retention.service';

// Separado do serviço: @nestjs/schedule é ESM e não carrega nos specs do Jest.
@Injectable()
export class DataRetentionJob {
  constructor(private readonly retention: DataRetentionService) {}

  @Cron('0 30 3 * * *', { timeZone: 'America/Sao_Paulo' })
  run() {
    // Servidor local não roda jobs de produção.
    if (process.env.DISABLE_BACKGROUND_JOBS === 'true') return;
    return this.retention.anonymizeExpired();
  }
}

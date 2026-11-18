import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const RETENTION_MONTHS = 12;
export const ANON_NAME = 'Participante anonimizado';
const BATCH = 200;

export function retentionCutoff(now: Date): Date {
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - RETENTION_MONTHS);
  return cutoff;
}

// LGPD: 12 meses após o fim do evento, apaga os dados pessoais de quem não
// tem opt-in de marketing ativo. Mantém as linhas (contagens e relatórios).
@Injectable()
export class DataRetentionService {
  private readonly logger = new Logger(DataRetentionService.name);

  constructor(private readonly prisma: PrismaService) {}

  async anonymizeExpired(now = new Date()): Promise<number> {
    const cutoff = retentionCutoff(now);

    const expired = await this.prisma.participants.findMany({
      where: {
        marketing_consent: false,
        NOT: { cpf_hash: { startsWith: 'anon:' } },
        created_at: { lt: cutoff },
        // Nenhuma participação em evento que terminou (ou, sem data de fim,
        // aconteceu) depois do corte.
        participations: {
          none: {
            OR: [
              { events: { ends_at: { gte: cutoff } } },
              { events: { ends_at: null }, created_at: { gte: cutoff } },
            ],
          },
        },
      },
      select: { id: true, participations: { select: { id: true } } },
      take: BATCH,
    });

    for (const person of expired) {
      const participationIds = person.participations.map((p) => p.id);

      await this.prisma.$transaction([
        this.prisma.participants.update({
          where: { id: person.id },
          data: {
            full_name: ANON_NAME,
            cpf_encrypted: '',
            cpf_hash: `anon:${person.id}`,
            cpf_last_digits: '0000',
            phone: '',
            phone_normalized: '',
            email: null,
            email_normalized: null,
            cro_number: null,
            cro_state: null,
          },
        }),
        this.prisma.participations.updateMany({
          where: { participant_id: person.id },
          data: { ip_address: null, user_agent: null, device_id: null },
        }),
        this.prisma.fraud_checks.updateMany({
          where: { participation_id: { in: participationIds } },
          data: {
            ip_address: null,
            device_id: null,
            identifier_hash: null,
            identifier_masked: null,
          },
        }),
        this.prisma.message_queue.updateMany({
          where: { participant_id: person.id },
          data: { phone: '', message: '' },
        }),
        this.prisma.audit_logs.updateMany({
          where: {
            OR: [
              { entity_type: 'PARTICIPANT', entity_id: String(person.id) },
              {
                entity_type: 'PARTICIPATION',
                entity_id: { in: participationIds.map(String) },
              },
            ],
          },
          data: {
            description: null,
            before_data: null,
            after_data: null,
            ip_address: null,
            user_agent: null,
          },
        }),
      ]);
    }

    if (expired.length) {
      this.logger.log(`Retenção LGPD: ${expired.length} participante(s) anonimizado(s).`);
    }
    return expired.length;
  }
}

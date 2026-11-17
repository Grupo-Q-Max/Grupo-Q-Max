import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Subscription } from 'rxjs';
import { leadEvents } from '../common/domain-events';
import { PrismaService } from '../prisma/prisma.service';
import { crmPayload } from './crm-payload';

const INCLUDE = {
  events: { select: { id: true, name: true, slug: true, crm_webhook_url: true } },
  participants: true,
  draws: { include: { prizes: { select: { name: true } } } },
} as const;

@Injectable()
export class CrmService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CrmService.name);
  private subscription?: Subscription;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.subscription = leadEvents.subscribe(({ participationId, type }) => void this.send(participationId, type));
  }

  onModuleDestroy() {
    this.subscription?.unsubscribe();
  }

  // Envia o lead ao webhook do evento. Só com consentimento de marketing (LGPD)
  // e nunca participação bloqueada pelo antifraude. Devolve se entregou.
  async send(participationId: number, type: 'lead' | 'prize'): Promise<boolean> {
    try {
      const p = await this.prisma.participations.findUnique({ where: { id: participationId }, include: INCLUDE });
      const url =
        p?.events.crm_webhook_url ||
        process.env.CRM_WEBHOOK_URL ||
        'https://grupoqmax.com.br/api/crm/lead-webhook';

      if (!p || !url || !p.participants.marketing_consent || p.status === 'BLOCKED') return false;

      const { crm_webhook_url: _url, ...event } = p.events;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(crmPayload({ ...p, events: event }, type)),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      await this.prisma.participations.update({ where: { id: participationId }, data: { crm_sent_at: new Date() } });
      return true;
    } catch (err) {
      this.logger.warn(`Webhook CRM falhou para participação ${participationId}: ${String(err)}`);
      return false;
    }
  }

  // Reenvio do que falhou (CRM fora do ar). Só últimas 24h: configurar o webhook
  // no meio do evento não dispara o histórico inteiro de uma vez.
  async retryPending() {
    const pending = await this.prisma.participations.findMany({
      where: {
        crm_sent_at: null,
        status: { not: 'BLOCKED' },
        created_at: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        participants: { marketing_consent: true },
      },
      select: { id: true, draws: { select: { id: true } } },
      orderBy: { id: 'asc' },
      take: 50,
    });
    for (const p of pending) {
      await this.send(p.id, p.draws ? 'prize' : 'lead');
    }
  }
}

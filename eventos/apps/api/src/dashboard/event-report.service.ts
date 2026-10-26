import { Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Subscription } from 'rxjs';
import { eventClosedEvents } from '../common/domain-events';
import { publicUrl } from '../common/public-url';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { EventReport, perHour, reportSummary } from './event-report';

@Injectable()
export class EventReportService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventReportService.name);
  private subscription?: Subscription;

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsappService,
  ) {}

  onModuleInit() {
    this.subscription = eventClosedEvents.subscribe((eventId) => void this.sendSummary(eventId));
  }

  onModuleDestroy() {
    this.subscription?.unsubscribe();
  }

  // ponytail: lê as datas e agrupa em memória (fuso de Brasília sem SQL por banco);
  // trocar por GROUP BY se um evento passar de dezenas de milhares de giros.
  async getReport(eventId: number): Promise<EventReport> {
    const event = await this.prisma.events.findUnique({
      where: { id: eventId },
      select: { id: true, name: true, status: true },
    });
    if (!event) throw new NotFoundException('Evento não encontrado.');

    const byEvent = { participations: { event_id: eventId } };
    const [registered, validated, blocked, participations, draws, prizeTotals] = await Promise.all([
      this.prisma.participations.count({ where: { event_id: eventId } }),
      this.prisma.participations.count({ where: { event_id: eventId, whatsapp_validated: true } }),
      this.prisma.participations.count({ where: { event_id: eventId, status: 'BLOCKED' } }),
      this.prisma.participations.findMany({ where: { event_id: eventId }, select: { created_at: true } }),
      this.prisma.draws.findMany({ where: byEvent, select: { drawn_at: true, claimed_at: true } }),
      this.prisma.draws.groupBy({ by: ['prize_id'], where: byEvent, _count: { _all: true } }),
    ]);

    const prizes = await this.prisma.prizes.findMany({
      where: { id: { in: prizeTotals.map((p) => p.prize_id) } },
      select: { id: true, name: true },
    });
    const prizeName = new Map(prizes.map((p) => [p.id, p.name]));

    return {
      event,
      funnel: {
        registered,
        validated,
        spun: draws.length,
        claimed: draws.filter((d) => d.claimed_at).length,
        blocked,
      },
      perHour: perHour(
        participations.map((p) => p.created_at),
        draws.map((d) => d.drawn_at),
      ),
      topPrizes: prizeTotals
        .map((p) => ({ name: prizeName.get(p.prize_id) ?? `#${p.prize_id}`, total: p._count._all }))
        .sort((a, b) => b.total - a.total),
    };
  }

  // Resumo no WhatsApp da equipe quando o evento é encerrado (status CLOSED).
  private async sendSummary(eventId: number) {
    try {
      const event = await this.prisma.events.findUnique({ where: { id: eventId }, select: { alert_phone: true } });
      if (!event?.alert_phone) return;
      const report = await this.getReport(eventId);
      const text = reportSummary(report, publicUrl(`/admin/relatorios?event=${eventId}`));
      await this.whatsapp.sendMessage(event.alert_phone, text);
    } catch (err) {
      this.logger.warn(`Falha ao enviar resumo do evento ${eventId}: ${String(err)}`);
    }
  }
}

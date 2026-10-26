import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';

// Limite em unidades: % do estoque inicial configurado no evento (mínimo 1).
export function stockAlertLimit(initialStock: number, percent: number) {
  return Math.max(1, Math.ceil((initialStock * percent) / 100));
}

// Dispara só ao cruzar para baixo (não repete a cada giro abaixo do limite).
export function crossedStockAlert(before: number, after: number, limit: number) {
  if (after >= before) return null;
  if (after === 0) return 'esgotado' as const;
  if (before > limit && after <= limit) return 'baixo' as const;
  return null;
}

@Injectable()
export class StockAlertsService {
  private readonly logger = new Logger(StockAlertsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsappService,
  ) {}

  // Chamado depois que o estoque mudou (giro ou ajuste manual). Nunca lança:
  // alerta é aviso, não pode derrubar o giro.
  async check(prizeId: number, before: number, after: number) {
    try {
      const prize = await this.prisma.prizes.findUnique({
        where: { id: prizeId },
        include: { events: true },
      });
      if (!prize) return;

      const limit = stockAlertLimit(prize.initial_stock, prize.events.stock_alert_percent);
      const kind = crossedStockAlert(before, after, limit);
      if (!kind) return;

      const message =
        kind === 'esgotado'
          ? `🚨 *Estoque esgotado:* ${prize.name} acabou no evento ${prize.events.name}. Reponha em Prêmios e estoque.`
          : `⚠️ *Estoque baixo:* ${prize.name} tem ${after} de ${prize.initial_stock} no evento ${prize.events.name} (alerta em ${prize.events.stock_alert_percent}%).`;

      await this.prisma.audit_logs.create({
        data: {
          event_id: prize.event_id,
          actor_type: 'SYSTEM',
          action: 'STOCK_ALERT',
          entity_type: 'PRIZE',
          entity_id: String(prize.id),
          metadata: JSON.stringify({ kind, before, after, limit }),
        },
      });

      // Direto (sem fila): a fila só envia em horário comercial.
      if (prize.events.alert_phone) {
        await this.whatsapp.sendMessage(prize.events.alert_phone, message);
      }
    } catch (err) {
      this.logger.warn(`Falha no alerta de estoque do prêmio ${prizeId}: ${String(err)}`);
    }
  }
}

import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InvictusSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(InvictusSeedService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap() {
    try {
      await this.seedInvictusPrizes();
    } catch (err: any) {
      this.logger.error(`Erro ao sincronizar prêmios do Invictus: ${err?.message}`, err?.stack);
    }
  }

  async seedInvictusPrizes() {
    let event = await this.prisma.events.findFirst({
      where: { slug: 'invictus' },
    });

    if (!event) {
      event = await this.prisma.events.create({
        data: {
          name: 'Finora Experience - Invictus',
          slug: 'invictus',
          status: 'ACTIVE',
          participation_enabled: true,
          accent_color: '#E5484D',
          accent_ink_color: '#B4232A',
          experience: 'ROLETA',
        },
      });
      this.logger.log(`Evento Invictus criado com ID ${event.id}`);
    }

    // Prêmios Normais (is_vip = false)
    // Caderno: 183 | Copo: 203 | Garrafa: 62 | Espelho: 189 | Chaveiro: 194 | Pins: 314
    // Total: 1145
    const normalPrizes = [
      { name: 'Caderno', stock: 183, prob: 15.9825, description: 'Caderno oficial Finora Experience' },
      { name: 'Copo', stock: 203, prob: 17.7293, description: 'Copo exclusivo Finora' },
      { name: 'Garrafa', stock: 62, prob: 5.4148, description: 'Garrafa térmica Finora' },
      { name: 'Espelho', stock: 189, prob: 16.5066, description: 'Espelho de bolso Finora' },
      { name: 'Chaveiro', stock: 194, prob: 16.9432, description: 'Chaveiro metálico Finora' },
      { name: 'Pins', stock: 314, prob: 27.4236, description: 'Pin colecionável Finora' },
    ];

    // Prêmios VIP (is_vip = true)
    // 50% de desconto com estoque 0 e prob 0 (aparece na roleta visualmente, mas nunca é sorteado)
    // Os outros 4 prêmios dividem igualmente os 100% de probabilidade (25% cada)
    const vipPrizes = [
      { name: 'Certificado', stock: 100, prob: 25.0000, description: 'Certificado oficial de mentorado' },
      { name: '50% de desconto no 1 honorário', stock: 0, prob: 0.0000, description: '50% de desconto no primeiro honorário Finora' },
      { name: '100% do primeiro honorário', stock: 20, prob: 25.0000, description: '100% de isenção no primeiro honorário Finora' },
      { name: 'Diagnóstico', stock: 100, prob: 25.0000, description: 'Diagnóstico tributário e contábil completo' },
      { name: 'Mentoria CEO - 2horas', stock: 10, prob: 25.0000, description: '2 horas de mentoria executiva direto com o CEO' },
    ];

    const currentPrizes = await this.prisma.prizes.findMany({
      where: { event_id: event.id },
    });

    for (const p of normalPrizes) {
      const match = currentPrizes.find(
        (cp) => cp.name.trim().toLowerCase() === p.name.trim().toLowerCase() && !cp.is_vip,
      );
      if (match) {
        await this.prisma.prizes.update({
          where: { id: match.id },
          data: {
            name: p.name,
            description: p.description,
            initial_stock: p.stock,
            available_stock: p.stock,
            probability: p.prob,
            is_vip: false,
            active: true,
          },
        });
      } else {
        await this.prisma.prizes.create({
          data: {
            event_id: event.id,
            name: p.name,
            description: p.description,
            initial_stock: p.stock,
            available_stock: p.stock,
            probability: p.prob,
            is_vip: false,
            active: true,
          },
        });
      }
    }

    for (const p of vipPrizes) {
      const match = currentPrizes.find(
        (cp) => cp.name.trim().toLowerCase() === p.name.trim().toLowerCase() && cp.is_vip,
      );
      if (match) {
        await this.prisma.prizes.update({
          where: { id: match.id },
          data: {
            name: p.name,
            description: p.description,
            initial_stock: p.stock,
            available_stock: p.stock,
            probability: p.prob,
            is_vip: true,
            active: true,
          },
        });
      } else {
        await this.prisma.prizes.create({
          data: {
            event_id: event.id,
            name: p.name,
            description: p.description,
            initial_stock: p.stock,
            available_stock: p.stock,
            probability: p.prob,
            is_vip: true,
            active: true,
          },
        });
      }
    }

    // Desativar prêmios que não estão em nenhuma das listas
    const validNames = [...normalPrizes, ...vipPrizes].map((p) => p.name.toLowerCase());
    for (const cp of currentPrizes) {
      if (!validNames.includes(cp.name.trim().toLowerCase())) {
        await this.prisma.prizes.update({
          where: { id: cp.id },
          data: { active: false },
        });
      }
    }

    // Garante que todo prêmio com "50%" tenha estoque 0 e probabilidade 0, mantendo active: true para visualização na roleta
    await this.prisma.prizes.updateMany({
      where: {
        name: { contains: '50%' },
      },
      data: {
        available_stock: 0,
        initial_stock: 0,
        probability: 0,
        active: true,
      },
    });

    // Limpa a fila: cancela qualquer prêmio de 50% que esteja aguardando entrega na fila
    const cancelledQueue = await this.prisma.prize_queue.updateMany({
      where: {
        prizes: {
          name: { contains: '50%' },
        },
        status: 'WAITING',
      },
      data: {
        status: 'CANCELLED',
      },
    });

    if (cancelledQueue.count > 0) {
      this.logger.log(`Cancelados ${cancelledQueue.count} itens da fila para o prêmio de 50% de desconto.`);
    }

    this.logger.log(`Prêmios do evento Invictus sincronizados com sucesso.`);
  }
}


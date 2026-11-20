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
    // Caderno: 183 | Copo: 203 | Garrafa: 62 | Espelho: 189 | Chaveiro: 194
    // Total: 831 (Pin removido a pedido)
    const normalPrizes = [
      { name: 'Caderno', stock: 183, prob: 22.0217, description: 'Caderno oficial Finora Experience' },
      { name: 'Copo', stock: 203, prob: 24.4284, description: 'Copo exclusivo Finora' },
      { name: 'Garrafa', stock: 62, prob: 7.4609, description: 'Garrafa térmica Finora' },
      { name: 'Espelho', stock: 189, prob: 22.7437, description: 'Espelho de bolso Finora' },
      { name: 'Chaveiro', stock: 194, prob: 23.3453, description: 'Chaveiro metálico Finora' },
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
        (cp) =>
          !cp.is_vip &&
          (cp.name.trim().toLowerCase() === p.name.trim().toLowerCase() ||
            (p.name === 'Garrafa' && cp.name.toLowerCase().includes('garrafa')) ||
            (p.name === 'Copo' && cp.name.toLowerCase().includes('copo'))),
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

    // Limpa a fila: remove qualquer item associado a "Pin" ou itens órfãos/removidos
    await this.prisma.prize_queue.deleteMany({
      where: {
        OR: [
          { prize_id: 20 },
          { prize_id: 10 },
          { prizes: { name: { contains: 'Pin' } } },
          { prizes: { name: { contains: 'pin' } } },
        ],
      },
    });

    // Desativa qualquer prêmio de Pin que ainda possa existir
    await this.prisma.prizes.updateMany({
      where: {
        name: { contains: 'Pin' },
      },
      data: {
        active: false,
        available_stock: 0,
        initial_stock: 0,
        probability: 0,
      },
    });

    // Garante que qualquer participante cadastrado que ainda não girou a roleta esteja com status APPROVED para aparecer na lista
    await this.prisma.participations.updateMany({
      where: {
        draws: null,
        status: { notIn: ['APPROVED'] },
      },
      data: {
        status: 'APPROVED',
      },
    });

    // Renomeia "Garrafa Inox" / "Garrafa Térmica" para "Garrafa" e "Copo Exclusivo" para "Copo" em todos os prêmios normais
    const allNormalPrizes = await this.prisma.prizes.findMany({
      where: { is_vip: false },
    });
    for (const p of allNormalPrizes) {
      const lower = p.name.toLowerCase().trim();
      let targetName: string | null = null;
      if (lower.includes('garrafa') && p.name !== 'Garrafa') {
        targetName = 'Garrafa';
      } else if (lower.includes('copo') && p.name !== 'Copo') {
        targetName = 'Copo';
      }

      if (targetName) {
        await this.prisma.prizes.update({
          where: { id: p.id },
          data: { name: targetName },
        });
        this.logger.log(`Prêmio ID ${p.id} renomeado de "${p.name}" para "${targetName}".`);
      }
    }

    this.logger.log(`Prêmios do evento Invictus sincronizados com sucesso.`);
  }
}


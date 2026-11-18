import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

import { AddPrizeQueueDto } from './dto/add-prize-queue.dto';
import { ReorderPrizeQueueDto } from './dto/reorder-prize-queue.dto';
import { SetNextPrizeDto } from './dto/set-next-prize.dto';

type RequestContext = {
  adminUserId?: number | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

@Injectable()
export class PrizeQueueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private async ensureEvent(eventId: number) {
    const event = await this.prisma.events.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('Evento não encontrado.');
    }

    return event;
  }

  private async ensurePrize(eventId: number, prizeId: number) {
    const prize = await this.prisma.prizes.findFirst({
      where: {
        id: prizeId,
        event_id: eventId,
      },
    });

    if (!prize) {
      throw new NotFoundException('Prêmio não encontrado neste evento.');
    }

    if (!prize.active || prize.available_stock <= 0) {
      throw new BadRequestException('Prêmio inativo ou sem estoque.');
    }

    return prize;
  }

  private async normalizePositions(eventId: number) {
    const items = await this.prisma.prize_queue.findMany({
      where: {
        event_id: eventId,
        status: 'WAITING',
      },

      orderBy: [{ position: 'asc' }, { id: 'asc' }],
    });

    await this.prisma.$transaction(
      items.map((item, index) =>
        this.prisma.prize_queue.update({
          where: { id: item.id },
          data: {
            position: index + 1,
          },
        }),
      ),
    );
  }

  async findByEvent(eventId: number) {
    await this.ensureEvent(eventId);

    let items = await this.prisma.prize_queue.findMany({
      where: {
        event_id: eventId,
        status: 'WAITING',
      },

      orderBy: [{ position: 'asc' }, { id: 'asc' }],

      include: {
        prizes: true,
      },
    });

    // Se a fila estiver vazia no banco, auto-popula com sequência de 12 itens
    if (items.length === 0) {
      const activePrizes = await this.prisma.prizes.findMany({
        where: {
          event_id: eventId,
          active: true,
          available_stock: { gt: 0 },
        },
        orderBy: { id: 'asc' },
      });

      if (activePrizes.length > 0) {
        const autoData = Array.from({ length: 12 }).map((_, idx) => ({
          event_id: eventId,
          prize_id: activePrizes[idx % activePrizes.length].id,
          position: idx + 1,
          status: 'WAITING' as const,
        }));

        await this.prisma.prize_queue.createMany({
          data: autoData,
        });

        items = await this.prisma.prize_queue.findMany({
          where: {
            event_id: eventId,
            status: 'WAITING',
          },
          orderBy: [{ position: 'asc' }, { id: 'asc' }],
          include: {
            prizes: true,
          },
        });
      }
    }

    return items;
  }

  async getNext(eventId: number) {
    await this.ensureEvent(eventId);

    const items = await this.findByEvent(eventId);
    const next = items.length > 0 ? items[0] : null;

    return {
      eventId,
      hasNext: !!next,
      next,
    };
  }

  async add(dto: AddPrizeQueueDto, context?: RequestContext) {
    await this.ensureEvent(dto.eventId);

    const prize = await this.ensurePrize(dto.eventId, dto.prizeId);

    const last = await this.prisma.prize_queue.findFirst({
      where: {
        event_id: dto.eventId,
        status: 'WAITING',
      },

      orderBy: {
        position: 'desc',
      },
    });

    const requestedPosition = dto.position ?? (last?.position ?? 0) + 1;

    await this.prisma.prize_queue.updateMany({
      where: {
        event_id: dto.eventId,
        status: 'WAITING',
        position: {
          gte: requestedPosition,
        },
      },

      data: {
        position: {
          increment: 1,
        },
      },
    });

    const item = await this.prisma.prize_queue.create({
      data: {
        event_id: dto.eventId,
        prize_id: dto.prizeId,

        position: requestedPosition,

        status: 'WAITING',

        reason: dto.reason ?? 'Prêmio adicionado à fila.',
      },

      include: {
        prizes: true,
      },
    });

    await this.normalizePositions(dto.eventId);

    await this.auditService.log({
      adminUserId: context?.adminUserId ?? null,
      eventId: dto.eventId,

      actorType: 'ADMIN',
      action: 'PRIZE_QUEUE_ADDED',

      entityType: 'PRIZE_QUEUE',
      entityId: item.id,

      description: `${prize.name} adicionado à fila de prêmios.`,

      afterData: {
        queueId: item.id,
        prizeId: prize.id,
        prizeName: prize.name,
        position: requestedPosition,
      },

      metadata: {
        reason: dto.reason ?? null,
      },

      ipAddress: context?.ipAddress ?? null,
      userAgent: context?.userAgent ?? null,
    });

    return this.findByEvent(dto.eventId);
  }

  async setNext(
    eventId: number,
    dto: SetNextPrizeDto,
    context?: RequestContext,
  ) {
    await this.ensureEvent(eventId);

    const prize = await this.ensurePrize(eventId, dto.prizeId);

    const currentQueue = await this.prisma.prize_queue.findMany({
      where: {
        event_id: eventId,
        status: 'WAITING',
      },

      orderBy: [{ position: 'asc' }, { id: 'asc' }],

      include: {
        prizes: true,
      },
    });

    const beforeNext = currentQueue[0] ?? null;

    const existingTarget = currentQueue.find(
      (item) => item.prize_id === dto.prizeId,
    );

    await this.prisma.$transaction(async (tx) => {
      if (existingTarget) {
        await tx.prize_queue.updateMany({
          where: {
            event_id: eventId,
            status: 'WAITING',
            id: {
              not: existingTarget.id,
            },
            position: {
              lt: existingTarget.position,
            },
          },

          data: {
            position: {
              increment: 1,
            },
          },
        });

        await tx.prize_queue.update({
          where: {
            id: existingTarget.id,
          },

          data: {
            position: 1,
            reason: dto.reason ?? 'Definido manualmente como próximo prêmio.',
          },
        });
      } else {
        await tx.prize_queue.updateMany({
          where: {
            event_id: eventId,
            status: 'WAITING',
          },

          data: {
            position: {
              increment: 1,
            },
          },
        });

        await tx.prize_queue.create({
          data: {
            event_id: eventId,
            prize_id: dto.prizeId,

            position: 1,

            status: 'WAITING',

            reason: dto.reason ?? 'Definido manualmente como próximo prêmio.',
          },
        });
      }
    });

    await this.normalizePositions(eventId);

    const afterNext = await this.prisma.prize_queue.findFirst({
      where: {
        event_id: eventId,
        status: 'WAITING',
      },

      orderBy: [{ position: 'asc' }, { id: 'asc' }],

      include: {
        prizes: true,
      },
    });

    await this.auditService.log({
      adminUserId: context?.adminUserId ?? null,
      eventId,

      actorType: 'ADMIN',
      action: 'NEXT_PRIZE_CHANGED',

      entityType: 'PRIZE_QUEUE',
      entityId: afterNext?.id ?? null,

      description: `Próximo prêmio alterado para ${prize.name}.`,

      beforeData: beforeNext
        ? {
            queueId: beforeNext.id,
            prizeId: beforeNext.prize_id,
            prizeName: beforeNext.prizes.name,
            position: beforeNext.position,
          }
        : null,

      afterData: afterNext
        ? {
            queueId: afterNext.id,
            prizeId: afterNext.prize_id,
            prizeName: afterNext.prizes.name,
            position: afterNext.position,
          }
        : null,

      metadata: {
        reason: dto.reason ?? null,
      },

      ipAddress: context?.ipAddress ?? null,
      userAgent: context?.userAgent ?? null,
    });

    return this.findByEvent(eventId);
  }

  async remove(id: number, context?: RequestContext) {
    const item = await this.prisma.prize_queue.findUnique({
      where: {
        id,
      },

      include: {
        prizes: true,
      },
    });

    if (!item) {
      throw new NotFoundException('Item da fila não encontrado.');
    }

    if (item.status !== 'WAITING') {
      throw new BadRequestException(
        'Somente itens aguardando podem ser removidos.',
      );
    }

    const updated = await this.prisma.prize_queue.update({
      where: {
        id,
      },

      data: {
        status: 'CANCELLED',
        reason: 'Removido manualmente da fila.',
      },
    });

    await this.normalizePositions(item.event_id);

    await this.auditService.log({
      adminUserId: context?.adminUserId ?? null,
      eventId: item.event_id,

      actorType: 'ADMIN',
      action: 'PRIZE_QUEUE_REMOVED',

      entityType: 'PRIZE_QUEUE',
      entityId: item.id,

      description: `${item.prizes.name} removido da fila.`,

      beforeData: {
        status: item.status,
        position: item.position,
      },

      afterData: {
        status: updated.status,
      },

      ipAddress: context?.ipAddress ?? null,
      userAgent: context?.userAgent ?? null,
    });

    return this.findByEvent(item.event_id);
  }

  async reorder(
    eventId: number,
    dto: ReorderPrizeQueueDto,
    context?: RequestContext,
  ) {
    const current = await this.findByEvent(eventId);

    let targetItems = current;
    if (dto.isVip !== undefined) {
      targetItems = current.filter((item) => item.prizes.is_vip === dto.isVip);
    } else {
      // Auto-detecta se a lista enviada corresponde inteiramente a um subconjunto VIP ou Normal
      const isAllVip = current
        .filter((item) => item.prizes.is_vip)
        .map((item) => item.id);
      const isAllNormal = current
        .filter((item) => !item.prizes.is_vip)
        .map((item) => item.id);

      if (
        dto.queueIds.length === isAllVip.length &&
        isAllVip.every((id) => dto.queueIds.includes(id))
      ) {
        targetItems = current.filter((item) => item.prizes.is_vip);
      } else if (
        dto.queueIds.length === isAllNormal.length &&
        isAllNormal.every((id) => dto.queueIds.includes(id))
      ) {
        targetItems = current.filter((item) => !item.prizes.is_vip);
      }
    }

    const targetIds = targetItems.map((item) => item.id);

    if (
      dto.queueIds.length !== targetIds.length ||
      !targetIds.every((id) => dto.queueIds.includes(id))
    ) {
      throw new BadRequestException(
        'A nova ordem precisa conter exatamente todos os itens da fila correspondente.',
      );
    }

    const before = targetItems.map((item) => ({
      queueId: item.id,
      prizeId: item.prize_id,
      prizeName: item.prizes.name,
      position: item.position,
    }));

    // Mantém as posições relativas do pool intactas sem alterar o outro pool
    const availablePositions = targetItems
      .map((item) => item.position)
      .sort((a, b) => a - b);

    await this.prisma.$transaction(
      dto.queueIds.map((queueId, index) =>
        this.prisma.prize_queue.update({
          where: {
            id: queueId,
          },
          data: {
            position: availablePositions[index],
          },
        }),
      ),
    );

    const after = await this.findByEvent(eventId);

    await this.auditService.log({
      adminUserId: context?.adminUserId ?? null,
      eventId,
      actorType: 'ADMIN',
      action: 'PRIZE_QUEUE_REORDERED',
      entityType: 'PRIZE_QUEUE',
      description: 'Fila de prêmios reordenada.',
      beforeData: before,
      afterData: after
        .filter((item) => dto.queueIds.includes(item.id))
        .map((item) => ({
          queueId: item.id,
          prizeId: item.prize_id,
          prizeName: item.prizes.name,
          position: item.position,
        })),
      ipAddress: context?.ipAddress ?? null,
      userAgent: context?.userAgent ?? null,
    });

    return after;
  }

  async generateAutoQueue(
    eventId: number,
    count = 50,
    isVip?: boolean,
    clearExisting = false,
    context?: RequestContext,
  ) {
    const event = await this.ensureEvent(eventId);

    // Se solicitado para limpar previamente os itens deste pool
    if (clearExisting) {
      if (isVip !== undefined) {
        const itemsToDelete = await this.prisma.prize_queue.findMany({
          where: {
            event_id: eventId,
            status: 'WAITING',
            prizes: { is_vip: isVip },
          },
          select: { id: true },
        });
        if (itemsToDelete.length > 0) {
          await this.prisma.prize_queue.deleteMany({
            where: { id: { in: itemsToDelete.map((i) => i.id) } },
          });
        }
      } else {
        await this.prisma.prize_queue.deleteMany({
          where: {
            event_id: eventId,
            status: 'WAITING',
          },
        });
      }
      await this.normalizePositions(eventId);
    }

    const prizeWhere: any = {
      event_id: event.id,
      active: true,
      available_stock: { gt: 0 },
    };
    if (isVip !== undefined) {
      prizeWhere.is_vip = isVip;
    }

    const activePrizes = await this.prisma.prizes.findMany({
      where: prizeWhere,
      orderBy: { id: 'asc' },
    });

    if (activePrizes.length === 0) {
      throw new BadRequestException(
        isVip !== undefined
          ? `Nenhum prêmio ${isVip ? 'VIP' : 'Normal'} ativo com estoque disponível para criar fila.`
          : 'Nenhum prêmio ativo com estoque disponível para criar fila.',
      );
    }

    // Pega as probabilidades configuradas no banco
    const weights = activePrizes.map((p) => Math.max(0, Number(p.probability) || 0));
    const totalWeight = weights.reduce((acc, w) => acc + w, 0);

    // Monta a distribuição proporcional exata às porcentagens
    const allocations: { prize: typeof activePrizes[0]; count: number }[] = [];
    let allocatedTotal = 0;

    for (let i = 0; i < activePrizes.length; i++) {
      const p = activePrizes[i];
      let prizeTarget = 0;
      if (totalWeight > 0) {
        prizeTarget = Math.round(count * (weights[i] / totalWeight));
      } else {
        prizeTarget = Math.round(count / activePrizes.length);
      }
      // Se tiver peso > 0 e a contagem for razoável, garante ao menos 1 item
      if (prizeTarget === 0 && (weights[i] > 0 || count >= activePrizes.length)) {
        prizeTarget = 1;
      }
      // Respeita o estoque disponível
      prizeTarget = Math.min(prizeTarget, p.available_stock);
      allocations.push({ prize: p, count: prizeTarget });
      allocatedTotal += prizeTarget;
    }

    // Se faltou preencher até o count requisitado, adiciona aos prêmios com estoque restante
    if (allocatedTotal < count) {
      const sortedByWeight = [...allocations].sort(
        (a, b) => Number(b.prize.probability) - Number(a.prize.probability),
      );
      for (const item of sortedByWeight) {
        const canAdd = Math.min(
          count - allocatedTotal,
          item.prize.available_stock - item.count,
        );
        if (canAdd > 0) {
          item.count += canAdd;
          allocatedTotal += canAdd;
        }
        if (allocatedTotal >= count) break;
      }
    }

    // Constrói a lista de IDs de prêmios
    const prizeIdPool: number[] = [];
    for (const item of allocations) {
      for (let c = 0; c < item.count; c++) {
        prizeIdPool.push(item.prize.id);
      }
    }

    if (prizeIdPool.length === 0) {
      throw new BadRequestException(
        'Estoque insuficiente para alocar itens na fila.',
      );
    }

    // Embaralha suavemente (Fisher-Yates) para dispersar proporcionalmente na sequência
    for (let i = prizeIdPool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [prizeIdPool[i], prizeIdPool[j]] = [prizeIdPool[j], prizeIdPool[i]];
    }

    // Pega a maior posição atual para acrescentar após os itens existentes
    const currentQueue = await this.prisma.prize_queue.findMany({
      where: {
        event_id: eventId,
        status: 'WAITING',
      },
      orderBy: { position: 'desc' },
      take: 1,
    });
    let startPosition = currentQueue.length > 0 ? currentQueue[0].position : 0;

    const newItemsData = prizeIdPool.map((prizeId) => {
      startPosition += 1;
      return {
        event_id: eventId,
        prize_id: prizeId,
        position: startPosition,
        status: 'WAITING' as const,
      };
    });

    await this.prisma.prize_queue.createMany({
      data: newItemsData,
    });

    await this.normalizePositions(eventId);

    const poolLabel =
      isVip === true ? 'VIP' : isVip === false ? 'Normal' : 'Geral';
    await this.auditService.log({
      adminUserId: context?.adminUserId ?? null,
      eventId,
      actorType: 'ADMIN',
      action: 'PRIZE_QUEUE_AUTO_GENERATED',
      entityType: 'PRIZE_QUEUE',
      description: `Fila de prêmios (${poolLabel}) preenchida com ${newItemsData.length} itens baseados nas porcentagens configuradas.`,
      ipAddress: context?.ipAddress ?? null,
      userAgent: context?.userAgent ?? null,
    });

    return this.findByEvent(eventId);
  }

  async clearQueue(
    eventId: number,
    isVip?: boolean,
    context?: RequestContext,
  ) {
    await this.ensureEvent(eventId);

    if (isVip !== undefined) {
      const itemsToDelete = await this.prisma.prize_queue.findMany({
        where: {
          event_id: eventId,
          status: 'WAITING',
          prizes: { is_vip: isVip },
        },
        select: { id: true },
      });
      if (itemsToDelete.length > 0) {
        await this.prisma.prize_queue.deleteMany({
          where: { id: { in: itemsToDelete.map((i) => i.id) } },
        });
      }
    } else {
      await this.prisma.prize_queue.deleteMany({
        where: {
          event_id: eventId,
          status: 'WAITING',
        },
      });
    }

    await this.normalizePositions(eventId);

    const poolLabel =
      isVip === true ? 'VIP' : isVip === false ? 'Normal' : 'Geral';
    await this.auditService.log({
      adminUserId: context?.adminUserId ?? null,
      eventId,
      actorType: 'ADMIN',
      action: 'PRIZE_QUEUE_CLEARED',
      entityType: 'PRIZE_QUEUE',
      description: `Fila de prêmios (${poolLabel}) esvaziada.`,
      ipAddress: context?.ipAddress ?? null,
      userAgent: context?.userAgent ?? null,
    });

    return this.findByEvent(eventId);
  }

  async history(eventId: number) {
    await this.ensureEvent(eventId);

    return this.prisma.prize_queue.findMany({
      where: {
        event_id: eventId,
      },

      orderBy: {
        created_at: 'desc',
      },

      include: {
        prizes: true,
      },

      take: 500,
    });
  }
}

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

    const currentIds = current.map((item) => item.id);

    if (
      dto.queueIds.length !== currentIds.length ||
      !currentIds.every((id) => dto.queueIds.includes(id))
    ) {
      throw new BadRequestException(
        'A nova ordem precisa conter exatamente todos os itens atuais da fila.',
      );
    }

    const before = current.map((item) => ({
      queueId: item.id,
      prizeId: item.prize_id,
      prizeName: item.prizes.name,
      position: item.position,
    }));

    await this.prisma.$transaction(
      dto.queueIds.map((queueId, index) =>
        this.prisma.prize_queue.update({
          where: {
            id: queueId,
          },

          data: {
            position: index + 1,
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

      afterData: after.map((item) => ({
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
    count = 12,
    context?: RequestContext,
  ) {
    const event = await this.ensureEvent(eventId);

    const activePrizes = await this.prisma.prizes.findMany({
      where: {
        event_id: event.id,
        active: true,
        available_stock: { gt: 0 },
      },
      orderBy: { id: 'asc' },
    });

    if (activePrizes.length === 0) {
      throw new BadRequestException(
        'Nenhum prêmio ativo com estoque disponível para criar fila.',
      );
    }

    // Pega a maior posição atual
    const currentQueue = await this.findByEvent(eventId);
    let startPosition = currentQueue.length;

    // Gera lista ponderada de prêmios
    const newItemsData: {
      event_id: number;
      prize_id: number;
      position: number;
      status: 'WAITING';
    }[] = [];

    // Distribui os prêmios proporcionalmente
    for (let i = 0; i < count; i++) {
      const prize = activePrizes[i % activePrizes.length];
      startPosition++;
      newItemsData.push({
        event_id: eventId,
        prize_id: prize.id,
        position: startPosition,
        status: 'WAITING',
      });
    }

    await this.prisma.prize_queue.createMany({
      data: newItemsData,
    });

    await this.auditService.log({
      adminUserId: context?.adminUserId ?? null,
      eventId,
      actorType: 'ADMIN',
      action: 'PRIZE_QUEUE_AUTO_GENERATED',
      entityType: 'PRIZE_QUEUE',
      description: `Fila de prêmios preenchida automaticamente com ${count} itens.`,
      ipAddress: context?.ipAddress ?? null,
      userAgent: context?.userAgent ?? null,
    });

    return this.findByEvent(eventId);
  }

  async clearQueue(eventId: number, context?: RequestContext) {
    await this.ensureEvent(eventId);

    await this.prisma.prize_queue.deleteMany({
      where: {
        event_id: eventId,
        status: 'WAITING',
      },
    });

    await this.auditService.log({
      adminUserId: context?.adminUserId ?? null,
      eventId,
      actorType: 'ADMIN',
      action: 'PRIZE_QUEUE_CLEARED',
      entityType: 'PRIZE_QUEUE',
      description: 'Fila de prêmios esvaziada.',
      ipAddress: context?.ipAddress ?? null,
      userAgent: context?.userAgent ?? null,
    });

    return [];
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

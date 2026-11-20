import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { StockAlertsService } from '../stock-alerts/stock-alerts.service';
import { PrismaService } from '../prisma/prisma.service';

import { CreatePrizeDto } from './dto/create-prize.dto';
import { UpdatePrizeDto } from './dto/update-prize.dto';
import {
  StockOperationDto,
  UpdatePrizeStockDto,
} from './dto/update-prize-stock.dto';

@Injectable()
export class PrizesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly stockAlerts: StockAlertsService,
  ) {}

  async create(
    dto: CreatePrizeDto,
    context?: {
      adminUserId?: number | null;
      ipAddress?: string | null;
      userAgent?: string | null;
    },
  ) {
    const event = await this.prisma.events.findUnique({
      where: {
        id: dto.eventId,
      },
    });

    if (!event) {
      throw new NotFoundException('Evento não encontrado.');
    }

    return this.prisma.$transaction(async (tx) => {
      const prize = await tx.prizes.create({
        data: {
          event_id: dto.eventId,
          name: dto.name,
          description: dto.description ?? null,
          image_url: dto.imageUrl ?? null,

          initial_stock: dto.initialStock,
          available_stock: dto.initialStock,

          probability: dto.probability,
          active: dto.active ?? true,
          is_vip: dto.isVip ?? false,
        },
      });

      await tx.prize_stock_movements.create({
        data: {
          event_id: prize.event_id,
          prize_id: prize.id,

          type: 'INITIAL',

          quantity: dto.initialStock,

          stock_before: 0,
          stock_after: dto.initialStock,

          reason: 'Estoque inicial do prêmio.',
        },
      });

      await tx.audit_logs.create({
        data: {
          event_id: prize.event_id,

          actor_type: 'ADMIN',
          action: 'PRIZE_CREATED',

          entity_type: 'PRIZE',
          entity_id: String(prize.id),

          description: `Prêmio ${prize.name} criado.`,

          before_data: null,

          after_data: JSON.stringify({
            name: prize.name,
            initialStock: prize.initial_stock,
            availableStock: prize.available_stock,
            probability: prize.probability.toString(),
            active: prize.active,
          }),

          metadata: JSON.stringify({
            prizeId: prize.id,
          }),

          ip_address: context?.ipAddress ?? null,
          user_agent: context?.userAgent ?? null,
        },
      });

      return prize;
    });
  }

  async findByEvent(eventId: number) {
    const event = await this.prisma.events.findUnique({
      where: {
        id: eventId,
      },
    });

    if (!event) {
      throw new NotFoundException('Evento não encontrado.');
    }

    const prizes = await this.prisma.prizes.findMany({
      where: {
        event_id: eventId,
      },

      orderBy: [
        {
          active: 'desc',
        },
        {
          name: 'asc',
        },
      ],

      include: {
        _count: {
          select: {
            draws: true,
            prize_queue: true,
            prize_stock_movements: true,
          },
        },
      },
    });

    const seenKeys = new Set<string>();
    const deduplicated: typeof prizes = [];
    for (const p of prizes) {
      const normName = (p.name || '').trim().toLowerCase();
      const key = `${p.is_vip ? 'vip' : 'normal'}:${normName}`;
      if (seenKeys.has(key)) {
        if (p.active) {
          this.prisma.prizes
            .update({
              where: { id: p.id },
              data: { active: false, available_stock: 0, probability: 0 },
            })
            .catch(() => {});
        }
        continue;
      }
      seenKeys.add(key);
      deduplicated.push(p);
    }

    return deduplicated;
  }

  async findOne(id: number) {
    const prize = await this.prisma.prizes.findUnique({
      where: {
        id,
      },

      include: {
        prize_stock_movements: {
          orderBy: {
            created_at: 'desc',
          },

          take: 100,
        },

        _count: {
          select: {
            draws: true,
            prize_queue: true,
          },
        },
      },
    });

    if (!prize) {
      throw new NotFoundException('Prêmio não encontrado.');
    }

    return prize;
  }

  async update(
    id: number,
    dto: UpdatePrizeDto,
    context?: {
      adminUserId?: number | null;
      ipAddress?: string | null;
      userAgent?: string | null;
    },
  ) {
    const current = await this.findOne(id);

    const newStock =
      dto.availableStock !== undefined ? dto.availableStock : dto.available_stock;

    const before = {
      name: current.name,
      description: current.description,
      imageUrl: current.image_url,
      probability: current.probability.toString(),
      active: current.active,
      isVip: current.is_vip,
      availableStock: current.available_stock,
    };

    const updateData: any = {
      name: dto.name,
      description: dto.description,
      image_url: dto.imageUrl,
      probability: dto.probability,
      active: dto.active,
      is_vip: dto.isVip,
    };

    if (newStock !== undefined && Number.isFinite(newStock) && newStock >= 0) {
      const parsedStock = Math.floor(newStock);
      updateData.available_stock = parsedStock;
      if (parsedStock > current.initial_stock) {
        updateData.initial_stock = parsedStock;
      }
    }

    const updated = await this.prisma.prizes.update({
      where: {
        id,
      },
      data: updateData,
    });

    if (
      newStock !== undefined &&
      Number.isFinite(newStock) &&
      Math.floor(newStock) !== current.available_stock
    ) {
      const parsedStock = Math.floor(newStock);
      await this.prisma.prize_stock_movements.create({
        data: {
          event_id: current.event_id,
          prize_id: current.id,
          type: parsedStock > current.available_stock ? 'MANUAL_ADD' : 'MANUAL_REMOVE',
          quantity: Math.abs(parsedStock - current.available_stock),
          stock_before: current.available_stock,
          stock_after: parsedStock,
          reason: 'Ajuste direto na edição do prêmio.',
          admin_user_id: context?.adminUserId ?? null,
        },
      });
    }

    const after = {
      name: updated.name,
      description: updated.description,
      imageUrl: updated.image_url,
      probability: updated.probability.toString(),
      active: updated.active,
      isVip: updated.is_vip,
      availableStock: updated.available_stock,
    };

    await this.auditService.log({
      adminUserId: context?.adminUserId ?? null,
      eventId: updated.event_id,

      actorType: 'ADMIN',
      action: 'PRIZE_UPDATED',

      entityType: 'PRIZE',
      entityId: updated.id,

      description: `Prêmio ${updated.name} alterado.`,

      beforeData: before,
      afterData: after,

      metadata: {
        prizeId: updated.id,
      },

      ipAddress: context?.ipAddress ?? null,
      userAgent: context?.userAgent ?? null,
    });

    return updated;
  }

  async updateStock(
    id: number,
    dto: UpdatePrizeStockDto,
    context?: {
      adminUserId?: number | null;
      ipAddress?: string | null;
      userAgent?: string | null;
    },
  ) {
    const reason = dto.reason ?? 'Ajuste manual de estoque.';

    const result = await this.prisma.$transaction(async (tx) => {
      const current = await tx.prizes.findUnique({
        where: {
          id,
        },
      });

      if (!current) {
        throw new NotFoundException('Prêmio não encontrado.');
      }

      const stockBefore = current.available_stock;
      const { stockAfter, movementType } = computeStockChange(
        stockBefore,
        dto.operation,
        Number(dto.quantity),
      );

      // Grava só se o estoque não mudou desde a leitura (giro concorrente).
      const write = await tx.prizes.updateMany({
        where: {
          id,
          available_stock: stockBefore,
        },

        data: {
          available_stock: stockAfter,
        },
      });

      if (write.count !== 1) {
        throw new ConflictException(
          'O estoque mudou durante o ajuste (houve um giro). Recarregue e tente de novo.',
        );
      }

      await tx.prize_stock_movements.create({
        data: {
          event_id: current.event_id,
          prize_id: current.id,

          type: movementType,

          quantity: Math.abs(stockAfter - stockBefore),

          stock_before: stockBefore,
          stock_after: stockAfter,

          reason,
          admin_user_id: context?.adminUserId ?? null,
        },
      });

      return { prize: { ...current, available_stock: stockAfter }, stockBefore, stockAfter };
    });

    await this.auditService.log({
      adminUserId: context?.adminUserId ?? null,
      eventId: result.prize.event_id,

      actorType: 'ADMIN',
      action: 'PRIZE_STOCK_UPDATED',

      entityType: 'PRIZE',
      entityId: result.prize.id,

      description: `Estoque do prêmio ${result.prize.name} alterado de ${result.stockBefore} para ${result.stockAfter}.`,

      beforeData: { availableStock: result.stockBefore },
      afterData: { availableStock: result.stockAfter },

      metadata: {
        operation: dto.operation,
        quantity: dto.quantity,
        movementQuantity: result.stockAfter - result.stockBefore,
        reason,
      },

      ipAddress: context?.ipAddress ?? null,
      userAgent: context?.userAgent ?? null,
    });

    void this.stockAlerts.check(id, result.stockBefore, result.stockAfter);

    return result.prize;
  }

  async stockHistory(id: number) {
    await this.findOne(id);

    return this.prisma.prize_stock_movements.findMany({
      where: {
        prize_id: id,
      },

      orderBy: {
        created_at: 'desc',
      },

      take: 500,
    });
  }

  async probabilitySummary(eventId: number) {
    const prizes = await this.prisma.prizes.findMany({
      where: {
        event_id: eventId,
        active: true,
      },

      select: {
        id: true,
        name: true,
        probability: true,
        available_stock: true,
      },
    });

    const totalProbability = prizes.reduce(
      (total, prize) => total + Number(prize.probability),
      0,
    );

    return {
      eventId,
      totalProbability,
      valid: Math.abs(totalProbability - 100) < 0.0001,

      prizes: prizes.map((prize) => ({
        id: prize.id,
        name: prize.name,
        probability: Number(prize.probability),

        availableStock: prize.available_stock,
      })),
    };
  }
}

export function computeStockChange(
  stockBefore: number,
  operation: StockOperationDto,
  quantity: number,
): {
  stockAfter: number;
  movementType: 'MANUAL_ADD' | 'MANUAL_REMOVE' | 'ADJUSTMENT';
} {
  switch (operation) {
    case StockOperationDto.ADD:
      return { stockAfter: stockBefore + quantity, movementType: 'MANUAL_ADD' };

    case StockOperationDto.REMOVE:
      if (quantity > stockBefore) {
        throw new BadRequestException('O estoque não pode ficar negativo.');
      }
      return { stockAfter: stockBefore - quantity, movementType: 'MANUAL_REMOVE' };

    case StockOperationDto.SET:
      return { stockAfter: quantity, movementType: 'ADJUSTMENT' };

    default:
      throw new BadRequestException('Operação de estoque inválida.');
  }
}

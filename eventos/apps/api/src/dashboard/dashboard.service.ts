import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { stockAlertLimit } from '../stock-alerts/stock-alerts.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Versão pública para o telão: só contagens e últimos ganhadores com nome
   * abreviado (primeiro nome + inicial). Sem CPF, CRO, IP ou estoque.
   */
  async getPublicEventDashboard(eventId: number) {
    const dashboard = await this.getEventDashboard(eventId);

    return {
      event: {
        id: dashboard.event.id,
        name: dashboard.event.name,
      },
      summary: {
        totalParticipations: dashboard.summary.totalParticipations,
        approved: dashboard.summary.approved,
        drawsCount: dashboard.summary.deliveredPrizes,
        deliveredPrizes: dashboard.summary.deliveredPrizes,
        normalDrawsCount: dashboard.summary.normalDrawsCount,
        vipDrawsCount: dashboard.summary.vipDrawsCount,
      },
      latestWinners: dashboard.latestWinners.map((winner) => ({
        drawId: winner.drawId,
        drawnAt: winner.drawnAt,
        prize: {
          id: winner.prize.id,
          name: winner.prize.name,
          imageUrl: winner.prize.imageUrl,
          isVip: winner.prize.isVip,
        },
        participant: {
          name: abbreviateName(winner.participant.name),
          clinicName: winner.participant.clinicName,
        },
      })),
    };
  }

  async getEventDashboard(eventId: number) {
    const event = await this.prisma.events.findUnique({
      where: {
        id: eventId,
      },
    });

    if (!event) {
      throw new NotFoundException('Evento não encontrado.');
    }

    const [
      uniqueParticipants,
      totalParticipations,
      approvedParticipations,
      blockedParticipations,
      reviewParticipations,
      completedParticipations,
      alertChecks,
      totalPrizes,
      activePrizes,
      prizes,
      deliveredPrizes,
      nextQueue,
      waitingQueue,
      latestDraws,
      latestParticipations,
      latestBlocked,
      latestAudit,
    ] = await Promise.all([
      this.prisma.participations
        .groupBy({
          by: ['participant_id'],
          where: {
            event_id: eventId,
          },
        })
        .then((groups) => groups.length),

      this.prisma.participations.count({
        where: {
          event_id: eventId,
        },
      }),

      this.prisma.participations.count({
        where: {
          event_id: eventId,
          status: { in: ['APPROVED', 'COMPLETED'] },
        },
      }),

      this.prisma.participations.count({
        where: {
          event_id: eventId,
          status: 'BLOCKED',
        },
      }),

      this.prisma.participations.count({
        where: {
          event_id: eventId,
          status: 'REVIEW',
        },
      }),

      this.prisma.participations.count({
        where: {
          event_id: eventId,
          status: 'COMPLETED',
        },
      }),

      this.prisma.fraud_checks.count({
        where: {
          event_id: eventId,
          decision: 'ALERT',
        },
      }),

      this.prisma.prizes.count({
        where: {
          event_id: eventId,
        },
      }),

      this.prisma.prizes.count({
        where: {
          event_id: eventId,
          active: true,
        },
      }),

      this.prisma.prizes.findMany({
        where: {
          event_id: eventId,
        },

        orderBy: {
          name: 'asc',
        },

        select: {
          id: true,
          name: true,
          initial_stock: true,
          available_stock: true,
          probability: true,
          active: true,
          is_vip: true,

          _count: {
            select: {
              draws: true,
            },
          },
        },
      }),

      this.prisma.draws.count({
        where: {
          participations: {
            event_id: eventId,
          },
        },
      }),

      this.prisma.prize_queue.findFirst({
        where: {
          event_id: eventId,
          status: 'WAITING',
        },

        orderBy: [
          {
            position: 'asc',
          },
          {
            id: 'asc',
          },
        ],

        include: {
          prizes: {
            select: {
              id: true,
              name: true,
              image_url: true,
              available_stock: true,
            },
          },
        },
      }),

      this.prisma.prize_queue.findMany({
        where: {
          event_id: eventId,
          status: 'WAITING',
        },

        orderBy: [
          {
            position: 'asc',
          },
          {
            id: 'asc',
          },
        ],

        include: {
          prizes: {
            select: {
              id: true,
              name: true,
              image_url: true,
              available_stock: true,
              probability: true,
            },
          },
        },

        take: 20,
      }),

      this.prisma.draws.findMany({
        where: {
          participations: {
            event_id: eventId,
          },
        },

        orderBy: {
          drawn_at: 'desc',
        },

        take: 30,

        select: {
          id: true,
          source: true,
          drawn_at: true,

          prizes: {
            select: {
              id: true,
              name: true,
              image_url: true,
              is_vip: true,
            },
          },

          participations: {
            select: {
              id: true,

              participants: {
                select: {
                  id: true,
                  full_name: true,
                  cpf_last_digits: true,
                  cro_number: true,
                  cro_state: true,
                  clinic_name: true,
                },
              },
            },
          },
        },
      }),

      this.prisma.participations.findMany({
        where: {
          event_id: eventId,
        },

        orderBy: {
          created_at: 'desc',
        },

        take: 10,

        select: {
          id: true,
          status: true,
          created_at: true,
          ip_address: true,

          participants: {
            select: {
              id: true,
              full_name: true,
              cpf_last_digits: true,
              phone: true,
              email: true,
              cro_number: true,
              cro_state: true,
              clinic_name: true,
            },
          },
        },
      }),

      this.prisma.participations.findMany({
        where: {
          event_id: eventId,
          status: 'BLOCKED',
        },

        orderBy: {
          created_at: 'desc',
        },

        take: 10,

        select: {
          id: true,
          status: true,
          created_at: true,
          ip_address: true,
          device_id: true,

          participants: {
            select: {
              id: true,
              full_name: true,
              cpf_last_digits: true,
              phone: true,
              email: true,
              cro_number: true,
              cro_state: true,
            },
          },

          fraud_checks: {
            where: {
              decision: 'BLOCKED',
            },

            select: {
              id: true,
              rule_type: true,
              previous_count: true,
              configured_limit: true,
              reason: true,
            },
          },
        },
      }),

      this.prisma.audit_logs.findMany({
        where: {
          event_id: eventId,
        },

        orderBy: {
          created_at: 'desc',
        },

        take: 20,

        select: {
          id: true,
          actor_type: true,
          action: true,
          entity_type: true,
          entity_id: true,
          description: true,
          created_at: true,
        },
      }),
    ]);

    const totalInitialStock = prizes.reduce(
      (total, prize) => total + prize.initial_stock,
      0,
    );

    const totalAvailableStock = prizes.reduce(
      (total, prize) => total + prize.available_stock,
      0,
    );

    const stockMovements = await this.prisma.prize_stock_movements.findMany({
      where: {
        event_id: eventId,
      },

      orderBy: {
        id: 'asc',
      },

      select: {
        prize_id: true,
        type: true,
        quantity: true,
        stock_after: true,
      },
    });

    // Estoque esperado = saldo da última movimentação registrada. Diferença do estoque
    // real indica alteração sem registro; um ajuste manual (SET) zera a divergência.
    const expectedStockByPrize = new Map<number, number>();
    for (const movement of stockMovements) {
      expectedStockByPrize.set(movement.prize_id, movement.stock_after);
    }

    const totalStockAdded = stockMovements
      .filter((movement) => movement.type === 'MANUAL_ADD')
      .reduce((total, movement) => total + Math.max(0, movement.quantity), 0);

    const totalStockRemoved = stockMovements
      .filter((movement) => movement.type === 'MANUAL_REMOVE')
      .reduce((total, movement) => total + Math.abs(movement.quantity), 0);

    const totalDrawnStock = stockMovements
      .filter((movement) => movement.type === 'DRAW')
      .reduce((total, movement) => total + Math.abs(movement.quantity), 0);

    const netManualAdjustment = totalStockAdded - totalStockRemoved;

    const [vipCodesTotal, vipCodesUsed] = await Promise.all([
      this.prisma.vip_codes.count({ where: { event_id: eventId } }),
      this.prisma.vip_codes.count({
        where: { event_id: eventId, participation_id: { not: null } },
      }),
    ]);

    const expectedCurrentStock = [...expectedStockByPrize.values()].reduce(
      (total, value) => total + value,
      0,
    );

    const activeProbability = prizes
      .filter((prize) => prize.active)
      .reduce((total, prize) => total + Number(prize.probability), 0);

    const distribution = prizes.map((prize) => {
      const delivered = prize._count.draws;

      const actualPercent =
        deliveredPrizes > 0
          ? Number(((delivered / deliveredPrizes) * 100).toFixed(2))
          : 0;

      const availableStock = prize.available_stock;
      // Mesmo limite do alerta no WhatsApp (% do estoque inicial do evento).
      const isLowStock =
        prize.active &&
        availableStock > 0 &&
        availableStock <= stockAlertLimit(prize.initial_stock, event.stock_alert_percent);
      const isOutOfStock = availableStock === 0;

      return {
        prizeId: prize.id,
        name: prize.name,

        configuredProbability: Number(prize.probability),

        delivered,

        actualPercent,

        initialStock: prize.initial_stock,

        availableStock,

        isLowStock,
        isOutOfStock,

        expectedStock: expectedStockByPrize.get(prize.id) ?? 0,
        stockDifference:
          availableStock - (expectedStockByPrize.get(prize.id) ?? 0),

        active: prize.active,
        isVip: prize.is_vip,
      };
    });

    const vipDrawsCount = prizes
      .filter((p) => p.is_vip)
      .reduce((acc, p) => acc + p._count.draws, 0);
    const normalDrawsCount = Math.max(0, deliveredPrizes - vipDrawsCount);

    return {
      event: {
        id: event.id,
        name: event.name,
        slug: event.slug,
        status: event.status,

        participationEnabled: event.participation_enabled,

        startsAt: event.starts_at,

        endsAt: event.ends_at,
      },

      summary: {
        uniqueParticipants,

        totalParticipations,

        approved: approvedParticipations,

        blocked: blockedParticipations,

        review: reviewParticipations,

        completed: completedParticipations,

        fraudAlerts: alertChecks,

        totalPrizes,
        activePrizes,

        deliveredPrizes,
        drawsCount: deliveredPrizes,
        normalDrawsCount,
        vipDrawsCount,

        totalInitialStock,

        totalAvailableStock,

        consumedStock: totalDrawnStock,

        stockAdded: totalStockAdded,

        stockRemoved: totalStockRemoved,

        netManualAdjustment,

        expectedCurrentStock,

        stockDifference: totalAvailableStock - expectedCurrentStock,

        vipCodesTotal,
        vipCodesUsed,

        activeProbability,

        probabilityValid: Math.abs(activeProbability - 100) < 0.0001,
      },

      nextPrize: nextQueue
        ? {
            queueId: nextQueue.id,

            position: nextQueue.position,

            prizeId: nextQueue.prize_id,

            name: nextQueue.prizes.name,

            imageUrl: nextQueue.prizes.image_url,

            availableStock: nextQueue.prizes.available_stock,
          }
        : null,

      queue: waitingQueue.map((item) => ({
        queueId: item.id,

        position: item.position,

        prizeId: item.prize_id,

        name: item.prizes.name,

        imageUrl: item.prizes.image_url,

        availableStock: item.prizes.available_stock,

        probability: Number(item.prizes.probability),
      })),

      distribution,

      latestWinners: latestDraws.map((draw) => ({
        drawId: draw.id,

        drawnAt: draw.drawn_at,

        source: draw.source,

        prize: {
          id: draw.prizes.id,

          name: draw.prizes.name,

          imageUrl: draw.prizes.image_url,
          isVip: Boolean(draw.prizes.is_vip),
        },

        participant: {
          id: draw.participations.participants.id,

          name: draw.participations.participants.full_name,

          cpfLastDigits: draw.participations.participants.cpf_last_digits,

          croNumber: draw.participations.participants.cro_number,

          croState: draw.participations.participants.cro_state,

          clinicName: draw.participations.participants.clinic_name,
        },
      })),

      latestParticipations: latestParticipations.map((item) => ({
        id: item.id,
        status: item.status,

        createdAt: item.created_at,

        ipAddress: item.ip_address,

        participant: {
          id: item.participants.id,

          name: item.participants.full_name,

          cpfLastDigits: item.participants.cpf_last_digits,

          phone: item.participants.phone,

          email: item.participants.email,

          croNumber: item.participants.cro_number,

          croState: item.participants.cro_state,

          clinicName: item.participants.clinic_name,
        },
      })),

      latestBlocked: latestBlocked.map((item) => ({
        id: item.id,
        status: item.status,

        createdAt: item.created_at,

        ipAddress: item.ip_address,

        deviceId: item.device_id,

        participant: {
          id: item.participants.id,

          name: item.participants.full_name,

          cpfLastDigits: item.participants.cpf_last_digits,

          phone: item.participants.phone,

          email: item.participants.email,

          croNumber: item.participants.cro_number,

          croState: item.participants.cro_state,
        },

        reasons: item.fraud_checks.map((check) => ({
          ruleType: check.rule_type,

          previousCount: check.previous_count,

          limit: check.configured_limit,

          reason: check.reason,
        })),
      })),

      recentActivity: latestAudit.map((log) => ({
        id: log.id.toString(),

        actorType: log.actor_type,

        action: log.action,

        entityType: log.entity_type,

        entityId: log.entity_id,

        description: log.description,

        createdAt: log.created_at,
      })),
    };
  }
}

function abbreviateName(name: string): string {
  const parts = (name || '').trim().split(/\s+/);
  if (parts.length <= 1) return parts[0] || '';
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomInt } from 'node:crypto';

import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { notifyLive } from '../live/live';
import { publicUrl } from '../common/public-url';
import { leadEvents } from '../common/domain-events';
import { StockAlertsService } from '../stock-alerts/stock-alerts.service';

type RequestContext = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type PacingRules = {
  minDrawInterval: number; // Ex: 50 (só pode sair a cada 50 giros)
  initialDrawDelay: number; // Ex: 30 (só pode começar a sair a partir do 30º giro)
};

export function extractPacingRules(description: string | null): PacingRules {
  if (!description) {
    return { minDrawInterval: 0, initialDrawDelay: 0 };
  }

  let minDrawInterval = 0;
  let initialDrawDelay = 0;

  const intervalMatch = description.match(
    /\[(?:INTERVALO|MIN_INTERVAL|COOLDOWN):\s*(\d+)\]/i,
  );
  if (intervalMatch && intervalMatch[1]) {
    minDrawInterval = parseInt(intervalMatch[1], 10);
  }

  const delayMatch = description.match(
    /\[(?:DELAY|INITIAL_DELAY|LIBERAR_APOS):\s*(\d+)\]/i,
  );
  if (delayMatch && delayMatch[1]) {
    initialDrawDelay = parseInt(delayMatch[1], 10);
  }

  return { minDrawInterval, initialDrawDelay };
}

@Injectable()
export class DrawsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappService: WhatsappService,
    private readonly stockAlerts: StockAlertsService,
  ) {}

  private chooseWeightedPrize<
    T extends {
      probability: unknown;
    },
  >(prizes: T[]): T {
    if (prizes.length === 0) {
      throw new BadRequestException('Nenhum prêmio disponível para sorteio.');
    }

    // Usar fator de escala para manter precisão de até 4 casas decimais
    const SCALE = 10000;

    const weighted = prizes
      .map((prize) => ({
        prize,
        weight: Math.round(Number(prize.probability) * SCALE),
      }))
      .filter((item) => item.weight > 0);

    if (weighted.length === 0) {
      throw new BadRequestException(
        'Nenhum prêmio possui probabilidade válida.',
      );
    }

    const totalWeight = weighted.reduce(
      (total, item) => total + item.weight,
      0,
    );

    // Geração criptograficamente segura de número aleatório
    let random = randomInt(0, totalWeight);

    for (const item of weighted) {
      if (random < item.weight) {
        return item.prize;
      }
      random -= item.weight;
    }

    return weighted[weighted.length - 1].prize;
  }

  /**
   * Seleciona e consome um prêmio de um pool específico (Normal ou VIP).
   */
  private async selectAndConsumePrize(
    tx: any,
    eventId: number,
    isVip: boolean,
  ) {
    // 1. Fila programada para o pool especificado
    const queue = await tx.prize_queue.findMany({
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
        prizes: true,
      },
    });

    const eligibleQueueItem = queue.find(
      (item: any) =>
        item.prizes.active &&
        item.prizes.available_stock > 0 &&
        item.prizes.is_vip === isVip,
    );

    let selectedPrize: any = null;
    let selectedQueueItem: any = null;
    let source: 'QUEUE' | 'AUTOMATIC' = 'AUTOMATIC';
    let probabilityUsed: number | null = null;

    if (eligibleQueueItem) {
      selectedQueueItem = eligibleQueueItem;
      selectedPrize = eligibleQueueItem.prizes;
      source = 'QUEUE';
    } else {
      // 2. Sorteio automático por peso no pool
      const availablePrizes = await tx.prizes.findMany({
        where: {
          event_id: eventId,
          active: true,
          is_vip: isVip,
          available_stock: {
            gt: 0,
          },
          probability: {
            gt: 0,
          },
        },
        orderBy: {
          id: 'asc',
        },
      });

      if (availablePrizes.length === 0) {
        throw new BadRequestException(
          `Não existem prêmios ativos com estoque no pool ${isVip ? 'VIP' : 'Normal'}.`,
        );
      }

      const totalEventDraws = await tx.draws.count({
        where: {
          participations: {
            event_id: eventId,
          },
        },
      });

      const eligibleByPacing: typeof availablePrizes = [];
      for (const prize of availablePrizes) {
        const rules = extractPacingRules(prize.description);
        if (rules.initialDrawDelay > 0 && totalEventDraws < rules.initialDrawDelay) {
          continue;
        }
        if (rules.minDrawInterval > 0) {
          const lastDrawOfPrize = await tx.draws.findFirst({
            where: {
              prize_id: prize.id,
              participations: {
                event_id: eventId,
              },
            },
            orderBy: {
              id: 'desc',
            },
          });

          if (lastDrawOfPrize) {
            const drawsSince = await tx.draws.count({
              where: {
                participations: {
                  event_id: eventId,
                },
                id: {
                  gt: lastDrawOfPrize.id,
                },
              },
            });

            if (drawsSince < rules.minDrawInterval) {
              continue;
            }
          }
        }
        eligibleByPacing.push(prize);
      }

      const candidatePrizes =
        eligibleByPacing.length > 0 ? eligibleByPacing : availablePrizes;

      selectedPrize = this.chooseWeightedPrize(candidatePrizes);
      probabilityUsed = Number(selectedPrize.probability);
      source = 'AUTOMATIC';
    }

    if (!selectedPrize) {
      throw new BadRequestException(
        `Não foi possível selecionar um prêmio no pool ${isVip ? 'VIP' : 'Normal'}.`,
      );
    }

    // 3. Decremento atômico de estoque
    const stockUpdate = await tx.prizes.updateMany({
      where: {
        id: selectedPrize.id,
        active: true,
        available_stock: {
          gt: 0,
        },
      },
      data: {
        available_stock: {
          decrement: 1,
        },
      },
    });

    if (stockUpdate.count !== 1) {
      throw new ConflictException(
        `O prêmio ${selectedPrize.name} ficou sem estoque durante o sorteio. Tente novamente.`,
      );
    }

    const updatedPrize = await tx.prizes.findUnique({
      where: {
        id: selectedPrize.id,
      },
    });

    if (!updatedPrize) {
      throw new NotFoundException('Prêmio não encontrado após atualização.');
    }

    const stockBefore = updatedPrize.available_stock + 1;

    // 4. Consumo de fila se aplicável
    if (selectedQueueItem) {
      const consumed = await tx.prize_queue.updateMany({
        where: {
          id: selectedQueueItem.id,
          status: 'WAITING',
        },
        data: {
          status: 'CONSUMED',
          consumed_at: new Date(),
        },
      });

      if (consumed.count !== 1) {
        throw new ConflictException(
          'O item da fila programada já foi usado em outro giro. Tente novamente.',
        );
      }

      const remainingQueue = await tx.prize_queue.findMany({
        where: {
          event_id: eventId,
          status: 'WAITING',
        },
        orderBy: [
          { position: 'asc' },
          { id: 'asc' },
        ],
      });

      for (let index = 0; index < remainingQueue.length; index++) {
        const item = remainingQueue[index];
        const expectedPosition = index + 1;
        if (item.position !== expectedPosition) {
          await tx.prize_queue.update({
            where: { id: item.id },
            data: { position: expectedPosition },
          });
        }
      }
    }

    const finalPrize = { ...selectedPrize, ...updatedPrize };

    return {
      prize: finalPrize,
      source,
      probabilityUsed,
      stockBefore,
      stockAfter: finalPrize.available_stock,
      consumedQueueId: selectedQueueItem?.id ?? null,
    };
  }

  async draw(participationId: number, context?: RequestContext) {
    let eventId: number | undefined;
    const result = await this.prisma.$transaction(
      async (tx) => {
        const participation = await tx.participations.findUnique({
          where: {
            id: participationId,
          },
          include: {
            events: true,
            participants: true,
            vip_codes: true,
            draws: {
              include: {
                prizes: true,
              },
            },
          },
        });

        if (!participation) {
          throw new NotFoundException('Participação não encontrada.');
        }

        eventId = participation.event_id;

        // Se já sorteou, retorna o prêmio existente (e o prêmio VIP complementar se houver)
        if (participation.draws) {
          const existingDraw = participation.draws;
          const vipPart = await tx.participations.findFirst({
            where: {
              event_id: participation.event_id,
              participant_id: participation.participant_id,
              id: { not: participation.id },
              draws: { isNot: null },
            },
            include: {
              draws: {
                include: {
                  prizes: true,
                },
              },
            },
          });

          const isDual = Boolean(vipPart?.draws);

          return {
            success: true,
            alreadyDrawn: true,
            vip: Boolean(participation.vip_codes) || isDual,
            isDualDraw: isDual,

            draw: {
              id: existingDraw.id,
              source: existingDraw.source,
              drawnAt: existingDraw.drawn_at,
            },

            vipDraw: vipPart?.draws
              ? {
                  id: vipPart.draws.id,
                  source: vipPart.draws.source,
                  drawnAt: vipPart.draws.drawn_at,
                }
              : null,

            participation: {
              id: participation.id,
              status: participation.status,
            },

            participant: {
              id: participation.participants.id,
              name: participation.participants.full_name,
            },

            prize: {
              id: existingDraw.prizes.id,
              name: existingDraw.prizes.name,
              description: existingDraw.prizes.description,
              imageUrl: existingDraw.prizes.image_url,
              probability: existingDraw.probability_used,
              stockRemaining: existingDraw.prizes.available_stock,
            },

            vipPrize: vipPart?.draws?.prizes
              ? {
                  id: vipPart.draws.prizes.id,
                  name: vipPart.draws.prizes.name,
                  description: vipPart.draws.prizes.description,
                  imageUrl: vipPart.draws.prizes.image_url,
                  probability: vipPart.draws.probability_used,
                  stockRemaining: vipPart.draws.prizes.available_stock,
                }
              : null,

            queue: {
              consumed: existingDraw.source === 'QUEUE',
              consumedQueueId: null,
              nextPrize: null,
            },
          };
        }

        if (
          participation.status === 'BLOCKED' ||
          participation.status === 'REVIEW'
        ) {
          throw new BadRequestException(
            `Participação não está liberada para sorteio. Status atual: ${participation.status}.`,
          );
        }

        if (participation.events.status !== 'ACTIVE') {
          throw new BadRequestException('O evento não está ativo.');
        }

        if (!participation.events.participation_enabled) {
          throw new BadRequestException(
            'As participações deste evento estão desabilitadas.',
          );
        }

        // =====================================================
        // REQUISITO VIP: CÓDIGO VIP OU REUNIÃO AGENDADA
        // =====================================================
        const hasMeeting = await tx.meetings.findFirst({
          where: {
            participant_id: participation.participant_id,
            event_id: participation.event_id,
            status: { in: ['SCHEDULED', 'COMPLETED'] },
          },
        });

        const isVipUser = Boolean(participation.vip_codes) || Boolean(hasMeeting);

        // =====================================================
        // 1. SORTEIO DO PRÊMIO NORMAL (ROLETA 1)
        // =====================================================
        const normalResult = await this.selectAndConsumePrize(
          tx,
          participation.event_id,
          false,
        );

        const draw = await tx.draws.create({
          data: {
            participation_id: participation.id,
            prize_id: normalResult.prize.id,
            source: normalResult.source,
            probability_used: normalResult.probabilityUsed,
            forced_by_admin_id: null,
          },
        });

        await tx.prize_stock_movements.create({
          data: {
            event_id: participation.event_id,
            prize_id: normalResult.prize.id,
            type: 'DRAW',
            quantity: -1,
            stock_before: normalResult.stockBefore,
            stock_after: normalResult.stockAfter,
            reason:
              normalResult.source === 'QUEUE'
                ? 'Prêmio entregue através da fila programada.'
                : 'Prêmio entregue através do sorteio automático.',
          },
        });

        // =====================================================
        // 2. SORTEIO DO PRÊMIO VIP (ROLETA 2) SE FOR VIP
        // =====================================================
        let vipResult: any = null;
        let vipDraw: any = null;

        if (isVipUser) {
          vipResult = await this.selectAndConsumePrize(
            tx,
            participation.event_id,
            true,
          );

          const vipParticipation = await tx.participations.create({
            data: {
              event_id: participation.event_id,
              participant_id: participation.participant_id,
              status: 'COMPLETED',
              completed_at: new Date(),
              device_id: participation.device_id,
              ip_address: participation.ip_address,
              user_agent: participation.user_agent,
            },
          });

          vipDraw = await tx.draws.create({
            data: {
              participation_id: vipParticipation.id,
              prize_id: vipResult.prize.id,
              source: vipResult.source,
              probability_used: vipResult.probabilityUsed,
              forced_by_admin_id: null,
            },
          });

          await tx.prize_stock_movements.create({
            data: {
              event_id: participation.event_id,
              prize_id: vipResult.prize.id,
              type: 'DRAW',
              quantity: -1,
              stock_before: vipResult.stockBefore,
              stock_after: vipResult.stockAfter,
              reason: 'Prêmio VIP entregue através do giro duplo liberado.',
            },
          });
        }

        // =====================================================
        // 3. FINALIZAR PARTICIPAÇÃO PRINCIPAL
        // =====================================================
        await tx.participations.update({
          where: {
            id: participation.id,
          },
          data: {
            status: 'COMPLETED',
            completed_at: new Date(),
          },
        });

        // =====================================================
        // 4. AUDITORIA
        // =====================================================
        await tx.audit_logs.create({
          data: {
            event_id: participation.event_id,
            actor_type: 'SYSTEM',
            action: 'DRAW_COMPLETED',
            entity_type: 'DRAW',
            entity_id: String(draw.id),
            description: isVipUser
              ? `Sorteio duplo VIP concluído. ${participation.participants.full_name} recebeu ${normalResult.prize.name} + ${vipResult.prize.name}.`
              : `Sorteio concluído. ${participation.participants.full_name} recebeu ${normalResult.prize.name}.`,
            before_data: null,
            after_data: JSON.stringify({
              drawId: draw.id,
              participationId: participation.id,
              participantId: participation.participant_id,
              participantName: participation.participants.full_name,
              prizeId: normalResult.prize.id,
              prizeName: normalResult.prize.name,
              vipDrawId: vipDraw?.id ?? null,
              vipPrizeId: vipResult?.prize?.id ?? null,
              vipPrizeName: vipResult?.prize?.name ?? null,
              isVipUser,
              source: normalResult.source,
            }),
            metadata: JSON.stringify({
              source: normalResult.source,
              deviceId: participation.device_id,
              participationIp: participation.ip_address,
            }),
            ip_address: context?.ipAddress ?? participation.ip_address ?? null,
            user_agent: context?.userAgent ?? participation.user_agent ?? null,
          },
        });

        return {
          success: true,
          vip: isVipUser,
          isDualDraw: isVipUser,

          draw: {
            id: draw.id,
            source: normalResult.source,
            drawnAt: draw.drawn_at,
          },

          vipDraw: vipDraw
            ? {
                id: vipDraw.id,
                source: vipResult.source,
                drawnAt: vipDraw.drawn_at,
              }
            : null,

          participation: {
            id: participation.id,
            status: 'COMPLETED',
          },

          participant: {
            id: participation.participants.id,
            name: participation.participants.full_name,
          },

          prize: {
            id: normalResult.prize.id,
            name: normalResult.prize.name,
            description: normalResult.prize.description,
            imageUrl: normalResult.prize.image_url,
            probability: normalResult.probabilityUsed,
            stockRemaining: normalResult.stockAfter,
          },

          vipPrize: vipResult
            ? {
                id: vipResult.prize.id,
                name: vipResult.prize.name,
                description: vipResult.prize.description,
                imageUrl: vipResult.prize.image_url,
                probability: vipResult.probabilityUsed,
                stockRemaining: vipResult.stockAfter,
              }
            : null,

          queue: {
            consumed: normalResult.source === 'QUEUE',
            consumedQueueId: normalResult.consumedQueueId,
            nextPrize: null,
          },
        };
      },
      {
        maxWait: 10000,
        timeout: 20000,
      },
    );

    if (result && result.success && result.prize && !result.alreadyDrawn) {
      this.sendAutomaticPrizeNotification(participationId).catch(() => {});
      notifyLive(eventId);
      leadEvents.next({ participationId, type: 'prize' });
      const remaining = result.prize.stockRemaining;
      void this.stockAlerts.check(result.prize.id, remaining + 1, remaining);
      if (result.vipPrize) {
        const vipRemaining = result.vipPrize.stockRemaining;
        void this.stockAlerts.check(result.vipPrize.id, vipRemaining + 1, vipRemaining);
      }
    }

    return result;
  }

  /**
   * Envia uma notificação automática via WhatsApp imediatamente após o sorteio/giro da roleta
   */
  private async sendAutomaticPrizeNotification(participationId: number) {
    try {
      const participation = await this.prisma.participations.findUnique({
        where: { id: participationId },
        include: {
          participants: true,
          events: true,
          draws: {
            include: {
              prizes: true,
            },
          },
        },
      });

      if (
        !participation ||
        !participation.participants?.phone ||
        !participation.draws?.prizes
      ) {
        return;
      }

      const participantName =
        participation.participants.full_name || 'Visitante';
      const phone = participation.participants.phone;
      const prizeName = participation.draws.prizes.name;
      const prizeDesc = participation.draws.prizes.description;
      const eventName = participation.events.name;
      const pinCode = `#${String(participation.id).padStart(4, '0')}`;
      const channelLink = participation.events.whatsapp_channel_link;

      const channelLinkMsg = channelLink
        ? `\n\n👉 *Entre no nosso Canal VIP:*\n${channelLink}`
        : '';

      // Mesmo link da validação: a página mostra o QR que o balcão lê.
      const pickupMsg = participation.whatsapp_token
        ? `\n\n📲 *Retirada no balcão:* mostre o QR Code deste link (PIN ${pinCode}):\n${publicUrl(`/v/${participation.whatsapp_token}`)}`
        : '';

      const prizeTemplate = participation.events.whatsapp_prize_message?.trim() || 
        `🎈 *UAAAU, {nome}! VOCÊ GANHOU!* 🥳🎉\n\n` +
        `Que alegria ter você conosco no estande da *Finora Experience* no evento *{evento}*! 💫✨\n\n` +
        `🎁 *SEU PRÊMIO EXCLUSIVO:*\n` +
        `🏆 *{premio}*\n\n` +
        `Aproveite muito o seu presente! Foi um prazer enorme receber você no nosso estande! 🎁🔥` +
        `\n\n✨ _Finora Experience • Transformando Eventos em Experiências_`;

      const message = prizeTemplate
        .replace(/\{nome\}|\[NOME\]/g, participantName)
        .replace(/\{evento\}|\[EVENTO\]/g, eventName)
        .replace(/\{premio\}|\[PREMIO\]/g, prizeName)
        .replace(/\{pin\}|\[PIN\]/g, pinCode) +
        pickupMsg +
        channelLinkMsg;

      if (process.env.ENABLE_DRAW_WHATSAPP === 'true') {
        await this.whatsappService.enqueueMessage(phone, message, { 
          eventId: participation.event_id, 
          participantId: participation.participant_id 
        });
      }
    } catch {
      // Notificação em segundo plano (silenciosa se houver falha de rede)
    }
  }

  // =========================================================
  // HISTÓRICO DO EVENTO
  // Dados sensíveis NÃO são retornados
  // =========================================================

  async findByEvent(eventId: number) {
    const event = await this.prisma.events.findUnique({
      where: {
        id: eventId,
      },
    });

    if (!event) {
      throw new NotFoundException('Evento não encontrado.');
    }

    return this.prisma.draws.findMany({
      where: {
        participations: {
          event_id: eventId,
        },
      },

      orderBy: {
        drawn_at: 'desc',
      },

      include: {
        prizes: {
          select: {
            id: true,
            name: true,
            description: true,
            image_url: true,
          },
        },

        participations: {
          select: {
            id: true,
            status: true,
            started_at: true,
            completed_at: true,

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

                city: true,
                state: true,
              },
            },
          },
        },
      },

      take: 500,
    });
  }

  // =========================================================
  // DETALHE DE UM SORTEIO
  // Dados sensíveis NÃO são retornados
  // =========================================================

  async findOne(id: number) {
    const draw = await this.prisma.draws.findUnique({
      where: {
        id,
      },

      include: {
        prizes: {
          select: {
            id: true,
            name: true,
            description: true,
            image_url: true,
            probability: true,
            active: true,
          },
        },

        participations: {
          select: {
            id: true,
            event_id: true,
            status: true,
            started_at: true,
            completed_at: true,

            events: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },

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

                city: true,
                state: true,
              },
            },
          },
        },
      },
    });

    if (!draw) {
      throw new NotFoundException('Sorteio não encontrado.');
    }

    return draw;
  }

  /**
   * Marca o prêmio de uma participação como ENTREGUE / RESGATADO pela equipe do estande
   */
  async claimPrize(
    participationId: number,
    adminUserId?: number | null,
    context?: RequestContext,
  ) {
    const participation = await this.prisma.participations.findUnique({
      where: { id: participationId },
      include: {
        draws: {
          include: {
            prizes: true,
          },
        },
        participants: true,
      },
    });

    if (!participation) {
      throw new NotFoundException('Participação não encontrada.');
    }

    if (!participation.draws) {
      throw new BadRequestException(
        'Esta participação ainda não realizou o sorteio.',
      );
    }

    // Busca todas as participações e sorteios deste participante neste evento (inclusive giro duplo VIP)
    const allParticipations = await this.prisma.participations.findMany({
      where: {
        event_id: participation.event_id,
        participant_id: participation.participant_id,
        draws: { isNot: null },
      },
      include: {
        draws: {
          include: {
            prizes: true,
          },
        },
      },
    });

    const allDraws = allParticipations
      .map((p) => p.draws)
      .filter((d): d is NonNullable<typeof d> => Boolean(d));

    const prizeNames = allDraws.length > 0
      ? allDraws.map((d) => d.prizes.name).join(' + ')
      : participation.draws.prizes.name;

    const unclaimedDrawIds = allDraws
      .filter((d) => !d.claimed_at)
      .map((d) => d.id);

    if (unclaimedDrawIds.length === 0) {
      return {
        success: true,
        alreadyClaimed: true,
        message: 'Prêmio já havia sido resgatado anteriormente.',
        completedAt: allDraws[0]?.claimed_at || participation.draws.claimed_at,
        participant: participation.participants.full_name,
        prize: prizeNames,
      };
    }

    const claimedAt = new Date();
    const updated = await this.prisma.draws.updateMany({
      where: { id: { in: unclaimedDrawIds } },
      data: { claimed_at: claimedAt },
    });

    if (updated.count > 0) {
      await this.prisma.audit_logs.create({
        data: {
          event_id: participation.event_id,
          admin_user_id: adminUserId ?? null,
          actor_type: adminUserId ? 'ADMIN' : 'SYSTEM',
          action: 'CLAIM_PRIZE',
          entity_type: 'participations',
          entity_id: String(participation.id),
          description: `Prêmio(s) "${prizeNames}" resgatado(s) por "${participation.participants.full_name}".`,
          metadata: JSON.stringify({
            participationId: participation.id,
            participantName: participation.participants.full_name,
            prizes: prizeNames,
            pin: String(participation.id).padStart(4, '0'),
          }),
          ip_address: context?.ipAddress ?? null,
          user_agent: context?.userAgent ?? null,
        },
      });
    }

    notifyLive(participation.event_id);

    return {
      success: true,
      alreadyClaimed: false,
      message: 'Prêmio marcado como ENTREGUE com sucesso!',
      completedAt: claimedAt,
      participant: participation.participants.full_name,
      prize: prizeNames,
    };
  }

  /**
   * Verifica os detalhes do prêmio de uma participação para a tela de Balcão Rápido
   */
  async verifyClaim(participationId: number) {
    const participation = await this.prisma.participations.findUnique({
      where: { id: participationId },
      include: {
        draws: {
          include: {
            prizes: true,
          },
        },
        participants: true,
        events: { select: { name: true } },
      },
    });

    if (!participation) {
      throw new NotFoundException(
        'Código de participação (PIN) não encontrado.',
      );
    }

    if (!participation.draws) {
      throw new BadRequestException(
        'Esta participação ainda não realizou o giro na roleta.',
      );
    }

    const hasMeeting = await this.prisma.meetings.findFirst({
      where: {
        participant_id: participation.participant_id,
        event_id: participation.event_id,
        status: { in: ['SCHEDULED', 'COMPLETED'] },
      },
    });

    const allParticipations = await this.prisma.participations.findMany({
      where: {
        event_id: participation.event_id,
        participant_id: participation.participant_id,
        draws: { isNot: null },
      },
      include: {
        draws: {
          include: {
            prizes: true,
          },
        },
      },
    });

    const allDraws = allParticipations
      .map((p) => p.draws)
      .filter((d): d is NonNullable<typeof d> => Boolean(d));

    const prizeNames = allDraws.length > 0
      ? allDraws.map((d) => d.prizes.name).join(' + ')
      : participation.draws.prizes.name;

    const baseView = this.claimView(participation, Boolean(hasMeeting));
    return {
      ...baseView,
      prizeName: prizeNames,
    };
  }

  // Lista de retiradas pendentes do evento: o balcão guarda localmente para
  // conferir e marcar entrega sem internet (sincroniza depois via claim).
  // ponytail: sem paginação, teto de 2000 por evento; paginar se algum evento passar disso.
  async pendingClaims(eventId: number) {
    const [participations, meetings] = await Promise.all([
      this.prisma.participations.findMany({
        where: { event_id: eventId, draws: { is: { claimed_at: null } } },
        include: {
          draws: { include: { prizes: true } },
          participants: true,
          events: { select: { name: true } },
        },
        orderBy: { id: 'desc' },
        take: 2000,
      }),
      this.prisma.meetings.findMany({
        where: { event_id: eventId, status: 'SCHEDULED' },
        select: { participant_id: true },
      }),
    ]);
    const withMeeting = new Set(meetings.map((m) => m.participant_id));

    return participations.map((p) => this.claimView(p, withMeeting.has(p.participant_id)));
  }

  private claimView(
    participation: Prisma.participationsGetPayload<{
      include: {
        draws: { include: { prizes: true } };
        participants: true;
        events: { select: { name: true } };
      };
    }>,
    hasMeeting: boolean,
  ) {
    const draw = participation.draws!;
    return {
      participationId: participation.id,
      eventId: participation.event_id,
      eventName: participation.events.name,
      participantId: participation.participant_id,
      pin: String(participation.id).padStart(4, '0'),
      participantName: participation.participants.full_name,
      cpfLastDigits: participation.participants.cpf_last_digits,
      clinicName: participation.participants.clinic_name || 'Não informada',
      cro: participation.participants.cro_number
        ? `${participation.participants.cro_number}/${participation.participants.cro_state || ''}`
        : null,
      city: participation.participants.city,
      state: participation.participants.state,
      prizeName: draw.prizes.name,
      prizeDescription: draw.prizes.description,
      status: participation.status,
      isDelivered: Boolean(draw.claimed_at),
      completedAt: draw.claimed_at,
      drawnAt: draw.drawn_at,
      hasMeeting,
    };
  }

  /**
   * Retorna os participantes únicos e válidos elegíveis para o Grande Sorteio Final do Evento,
   * garantindo proteção estrita antiduplicidade: ganhadores anteriores de GRAND_DRAW deste evento
   * e cadastros duplicados (mesmo ID ou mesmo telefone limpo) são excluídos da lista.
   */
  async getEligibleForGrandDraw(eventId: number) {
    // 1. Identificar quem já foi sorteado e premiado no Grande Sorteio deste evento
    const previousWinnersLogs = await this.prisma.audit_logs.findMany({
      where: {
        event_id: eventId,
        action: 'GRAND_DRAW_COMPLETED',
      },
      select: {
        entity_id: true,
      },
    });

    const alreadyWonIds = new Set<number>();
    for (const log of previousWinnersLogs) {
      if (log.entity_id) {
        const idNum = parseInt(log.entity_id, 10);
        if (!isNaN(idNum) && idNum > 0) {
          alreadyWonIds.add(idNum);
        }
      }
    }

    // 2. Buscar todas as participações do evento com status válido
    const participations = await this.prisma.participations.findMany({
      where: {
        event_id: eventId,
        status: {
          in: ['APPROVED', 'COMPLETED', 'PENDING'],
        },
      },
      include: {
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
            city: true,
            state: true,
          },
        },
      },
      orderBy: {
        id: 'asc',
      },
    });

    const uniqueMap = new Map<number, any>();
    const seenPhones = new Set<string>();

    for (const p of participations) {
      const part = p.participants;
      if (!part) continue;

      // REGRA ANTIDUPLICIDADE 1: Ganhadores anteriores do Grande Sorteio NÃO podem concorrer novamente
      if (alreadyWonIds.has(part.id)) {
        continue;
      }

      // REGRA ANTIDUPLICIDADE 2: Deduplicação por ID do participante
      if (uniqueMap.has(part.id)) {
        continue;
      }

      // REGRA ANTIDUPLICIDADE 3: Deduplicação por telefone sanitizado (evita mesma pessoa com 2 cupons)
      const cleanPhone = (part.phone || '').replace(/\D/g, '');
      if (cleanPhone.length >= 10) {
        if (seenPhones.has(cleanPhone)) {
          continue;
        }
        seenPhones.add(cleanPhone);
      }

      uniqueMap.set(part.id, {
        participationId: p.id,
        participantId: part.id,
        ticketCode: `#${String(part.id).padStart(4, '0')}`,
        fullName: part.full_name,
        cpfLastDigits: part.cpf_last_digits,
        phone: part.phone || null,
        email: part.email || null,
        cro: part.cro_number
          ? `${part.cro_number}/${part.cro_state || ''}`
          : null,
        clinicName: part.clinic_name || 'Clínica não informada',
        city: part.city,
        state: part.state,
        registeredAt: p.created_at,
      });
    }

    const eligible = Array.from(uniqueMap.values());

    return {
      eventId,
      totalEligible: eligible.length,
      alreadyWonCount: alreadyWonIds.size,
      participants: eligible,
    };
  }

  /**
   * Executa o Grande Sorteio Final do Evento para 1 ou N ganhadores via CSPRNG (crypto.randomInt)
   */
  async performGrandDraw(
    eventId: number,
    prizeName?: string,
    quantity: number = 1,
    description?: string,
    adminId?: number,
  ) {
    const { totalEligible, participants } =
      await this.getEligibleForGrandDraw(eventId);

    if (totalEligible === 0) {
      throw new BadRequestException(
        'Nenhum participante elegível para o sorteio final (ou todos os concorrentes já foram premiados).',
      );
    }

    const safeQty = Math.max(1, Math.min(Number(quantity) || 1, totalEligible));
    const grandPrize = prizeName?.trim() || 'Grande Prêmio de Encerramento';

    // Sorteia N ganhadores únicos sem repetição
    const availablePool = [...participants];
    const winners: any[] = [];

    for (let i = 0; i < safeQty; i++) {
      if (availablePool.length === 0) break;
      const index = randomInt(0, availablePool.length);
      const chosen = availablePool.splice(index, 1)[0];
      winners.push({
        ...chosen,
        position: i + 1,
      });
    }

    // Registra cada ganhador no audit_logs
    for (const w of winners) {
      await this.prisma.audit_logs.create({
        data: {
          event_id: eventId,
          actor_type: adminId ? 'ADMIN' : 'SYSTEM',
          action: 'GRAND_DRAW_COMPLETED',
          entity_type: 'PARTICIPANT',
          entity_id: String(w.participantId),
          description: `Grande Sorteio Final (${w.position}º Lugar): ${w.fullName} ganhou "${grandPrize}".`,
          metadata: JSON.stringify({
            prizeName: grandPrize,
            description: description || null,
            position: w.position,
            totalWinners: safeQty,
          }),
        },
      });
    }

    notifyLive(eventId);

    return {
      success: true,
      drawType: 'GRAND_EVENT_DRAW',
      prize: grandPrize,
      description: description || null,
      quantity: safeQty,
      drawnAt: new Date().toISOString(),
      winner: winners[0],
      winners,
      totalCompetitors: totalEligible,
    };
  }

  /**
   * Marca a entrega do Grande Prêmio para o participante vencedor
   */
  async claimGrandPrize(
    eventId: number,
    participantId: number,
    adminId?: number,
  ) {
    const participant = await this.prisma.participants.findUnique({
      where: { id: participantId },
    });

    if (!participant) {
      throw new NotFoundException('Participante não encontrado.');
    }

    const log = await this.prisma.audit_logs.create({
      data: {
        event_id: eventId,
        actor_type: adminId ? 'ADMIN' : 'OPERATOR',
        action: 'GRAND_DRAW_CLAIMED',
        entity_type: 'PARTICIPANT',
        entity_id: String(participantId),
        description: `Grande Prêmio entregue e resgatado pelo participante ${participant.full_name}.`,
        metadata: JSON.stringify({
          participantName: participant.full_name,
          claimedAt: new Date().toISOString(),
        }),
      },
    });

    return {
      success: true,
      message: `Grande Prêmio marcado como ENTREGUE para ${participant.full_name}!`,
      participant: participant.full_name,
      claimedAt: log.created_at,
    };
  }

  /**
   * Retorna o histórico de todos os Grandes Sorteios de Encerramento com status de resgate
   */
  async getGrandDrawHistory(eventId: number) {
    const [drawLogs, claimLogs] = await Promise.all([
      this.prisma.audit_logs.findMany({
        where: {
          event_id: eventId,
          action: 'GRAND_DRAW_COMPLETED',
        },
        orderBy: {
          created_at: 'desc',
        },
      }),
      this.prisma.audit_logs.findMany({
        where: {
          event_id: eventId,
          action: 'GRAND_DRAW_CLAIMED',
        },
      }),
    ]);

    const claimedParticipantIds = new Set(
      claimLogs.map((c) => c.entity_id).filter(Boolean),
    );

    return drawLogs.map((log) => {
      let meta: any = {};
      try {
        if (log.metadata) meta = JSON.parse(log.metadata);
      } catch {}

      const isClaimed = log.entity_id
        ? claimedParticipantIds.has(log.entity_id)
        : false;

      return {
        id: log.id,
        drawnAt: log.created_at,
        description: log.description,
        actorType: log.actor_type,
        participantId: log.entity_id ? Number(log.entity_id) : null,
        prizeName: meta.prizeName || 'Grande Prêmio',
        position: meta.position || 1,
        isDelivered: isClaimed,
      };
    });
  }
}

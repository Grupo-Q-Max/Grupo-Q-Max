import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { notifyLive } from '../live/live';
import { publicUrl } from '../common/public-url';
import { leadEvents } from '../common/domain-events';
import * as crypto from 'crypto';

import {
  encryptCpf,
  hashCpf,
  isValidCpf,
  normalizeCpf,
} from '../security/cpf-security';
import { normalizeVipCode } from '../vip-codes/vip-code';

import {
  normalizeEmail,
  normalizePhone,
  normalizeState,
} from '../security/normalizers';

import { RegisterParticipantDto } from './dto/register-participant.dto';

type RequestContext = {
  ipAddress?: string | null;
  userAgent?: string | null;
  origin?: string | null;
};

type FraudDecisionResult = {
  ruleId: number;
  type: 'CPF' | 'PHONE' | 'EMAIL' | 'DEVICE' | 'IP';

  enabled: boolean;

  previousCount: number;
  limit: number;

  ruleAction: 'BLOCK' | 'REVIEW' | 'ALLOW_WITH_ALERT';

  decision: 'ALLOWED' | 'BLOCKED' | 'REVIEW' | 'ALERT';

  reason: string;
};

import { FraudRulesService } from '../fraud-rules/fraud-rules.service';
import { MeetingsService } from '../meetings/meetings.service';

@Injectable()
export class ParticipantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappService: WhatsappService,
    private readonly fraudRulesService: FraudRulesService,
    private readonly meetingsService: MeetingsService,
  ) {}

  private getClientIp(context?: RequestContext): string | null {
    return context?.ipAddress ?? null;
  }

  private async countForRule(
    eventId: number,
    type: 'CPF' | 'PHONE' | 'EMAIL' | 'DEVICE' | 'IP',
    values: {
      participantId?: number | null;
      phone?: string | null;
      email?: string | null;
      deviceId?: string | null;
      ipAddress?: string | null;
    },
  ): Promise<number> {
    switch (type) {
      case 'CPF': {
        if (!values.participantId) {
          return 0;
        }

        return this.prisma.participations.count({
          where: {
            event_id: eventId,
            participant_id: values.participantId,
          },
        });
      }

      case 'PHONE': {
        if (!values.phone) {
          return 0;
        }

        return this.prisma.participations.count({
          where: {
            event_id: eventId,

            participants: {
              phone_normalized: values.phone,
            },
          },
        });
      }

      case 'EMAIL': {
        if (!values.email) {
          return 0;
        }

        return this.prisma.participations.count({
          where: {
            event_id: eventId,

            participants: {
              email_normalized: values.email,
            },
          },
        });
      }

      case 'DEVICE': {
        if (!values.deviceId) {
          return 0;
        }

        return this.prisma.participations.count({
          where: {
            event_id: eventId,
            device_id: values.deviceId,
          },
        });
      }

      case 'IP': {
        if (!values.ipAddress) {
          return 0;
        }

        return this.prisma.participations.count({
          where: {
            event_id: eventId,
            ip_address: values.ipAddress,
          },
        });
      }

      default:
        return 0;
    }
  }

  private resolveDecision(
    previousCount: number,
    limit: number,
    action: 'BLOCK' | 'REVIEW' | 'ALLOW_WITH_ALERT',
  ): {
    decision: 'ALLOWED' | 'BLOCKED' | 'REVIEW' | 'ALERT';

    reason: string;
  } {
    const nextCount = previousCount + 1;

    if (nextCount <= limit) {
      return {
        decision: 'ALLOWED',
        reason: `Dentro do limite configurado (${nextCount}/${limit}).`,
      };
    }

    if (action === 'BLOCK') {
      return {
        decision: 'BLOCKED',
        reason: `Limite excedido (${nextCount}/${limit}). Participação bloqueada.`,
      };
    }

    if (action === 'REVIEW') {
      return {
        decision: 'REVIEW',
        reason: `Limite excedido (${nextCount}/${limit}). Participação enviada para análise.`,
      };
    }

    return {
      decision: 'ALERT',
      reason: `Limite excedido (${nextCount}/${limit}). Participação permitida com alerta.`,
    };
  }

  private resolveParticipationStatus(
    checks: FraudDecisionResult[],
  ): 'APPROVED' | 'BLOCKED' | 'REVIEW' {
    if (checks.some((check) => check.decision === 'BLOCKED')) {
      return 'BLOCKED';
    }

    if (checks.some((check) => check.decision === 'REVIEW')) {
      return 'REVIEW';
    }

    return 'APPROVED';
  }

  async register(dto: RegisterParticipantDto, context?: RequestContext) {
    if (!dto.clientRequestId) return this.registerNew(dto, context);

    const replay = await this.findByClientRequest(dto.clientRequestId);
    if (replay) return replay;

    try {
      return await this.registerNew(dto, context);
    } catch (err) {
      // Corrida: o mesmo cadastro da fila offline chegou duas vezes ao mesmo tempo.
      if ((err as { code?: string })?.code === 'P2002') {
        const again = await this.findByClientRequest(dto.clientRequestId);
        if (again) return again;
      }
      throw err;
    }
  }

  // Reenvio de um cadastro já gravado: devolve o resultado sem criar outra
  // participação nem reenviar o WhatsApp.
  private async findByClientRequest(clientRequestId: string) {
    const participation = await this.prisma.participations.findUnique({
      where: { client_request_id: clientRequestId },
      include: { participants: true, vip_codes: { select: { id: true } } },
    });
    if (!participation) return null;

    return {
      success: participation.status === 'APPROVED',
      replayed: true,
      blockedReason: null,
      participant: {
        id: participation.participant_id,
        fullName: participation.participants.full_name,
      },
      participation: {
        id: participation.id,
        eventId: participation.event_id,
        status: participation.status,
        canDraw: participation.status === 'APPROVED',
        vip: Boolean(participation.vip_codes),
        whatsappToken: participation.whatsapp_token,
      },
    };
  }

  private async registerNew(dto: RegisterParticipantDto, context?: RequestContext) {
    const event = await this.prisma.events.findUnique({
      where: {
        id: dto.eventId,
      },
    });

    if (!event) {
      throw new NotFoundException('Evento não encontrado.');
    }

    if (event.status !== 'ACTIVE') {
      throw new BadRequestException(
        'O evento não está ativo para novos giros no momento.',
      );
    }

    if (!event.participation_enabled) {
      throw new BadRequestException(
        'As inscrições e giros deste evento estão temporariamente pausados pela organização.',
      );
    }

    const cpf = normalizeCpf(dto.cpf);

    if (!isValidCpf(cpf)) {
      throw new BadRequestException(
        'O CPF digitado é inválido. Por favor, confira os 11 dígitos.',
      );
    }

    const phone = normalizePhone(dto.phone);

    if (phone.length < 10 || phone.length > 11) {
      throw new BadRequestException(
        'Número de WhatsApp inválido. Digite o DDD e número com 10 ou 11 dígitos.',
      );
    }

    const cpfHash = hashCpf(cpf);

    // Fallback estável por pessoa sem expor o CPF (coluna email não é criptografada).
    const fallbackEmail = `${cpfHash.slice(0, 16)}@visitante.finora.com.br`;

    const email =
      (dto.email && dto.email.trim() && normalizeEmail(dto.email)) ||
      fallbackEmail;

    const croState = dto.croState ? normalizeState(dto.croState) : null;

    const state = dto.state ? normalizeState(dto.state) : null;

    const cpfEncrypted = encryptCpf(cpf);

    const cpfLastDigits = cpf.slice(-4);

    const ipAddress = this.getClientIp(context);

    const fraudRules = await this.prisma.fraud_rules.findMany({
      where: {
        event_id: dto.eventId,
        enabled: true,
      },

      orderBy: {
        id: 'asc',
      },
    });

    const existingParticipant = await this.prisma.participants.findUnique({
      where: {
        cpf_hash: cpfHash,
      },
    });

    if (existingParticipant) {
      const existingParticipation = await this.prisma.participations.findFirst({
        where: {
          event_id: dto.eventId,
          participant_id: existingParticipant.id,
        },
        include: {
          draws: { include: { prizes: true } },
          vip_codes: true,
        },
        orderBy: { id: 'desc' },
      });

      if (existingParticipation) {
        const isTestUser = await this.fraudRulesService.isWhitelisted(dto.eventId, {
          cpf: dto.cpf,
          phone,
          email,
          fullName: dto.fullName,
        });

        if (!isTestUser) {
          return {
            success: true,
            alreadyRegistered: true,
            blockedReason: 'Este CPF já possui cadastro neste evento.',
            participant: {
              id: existingParticipant.id,
              fullName: existingParticipant.full_name,
              cpfMasked: `***.***.***-${existingParticipant.cpf_last_digits}`,
              phone: maskPhone(existingParticipant.phone_normalized),
              email: maskEmail(existingParticipant.email_normalized || ''),
              croNumber: existingParticipant.cro_number,
              croState: existingParticipant.cro_state,
            },
            participation: {
              id: existingParticipation.id,
              eventId: existingParticipation.event_id,
              status: existingParticipation.status,
              canDraw: !existingParticipation.draws,
              vip: Boolean(existingParticipation.vip_codes),
              vipCode: existingParticipation.vip_codes?.code || null,
              hasDrawn: Boolean(existingParticipation.draws),
              drawnPrize: existingParticipation.draws?.prizes?.name || null,
            },
          };
        }
      }
    }

    const isTestUser = await this.fraudRulesService.isWhitelisted(dto.eventId, {
      cpf: dto.cpf,
      phone,
      email,
      fullName: dto.fullName,
    });

    const fraudResults: FraudDecisionResult[] = [];

    if (isTestUser) {
      fraudResults.push({
        ruleId: 0,
        type: 'IP',
        enabled: true,
        previousCount: 0,
        limit: 9999,
        ruleAction: 'ALLOW_WITH_ALERT',
        decision: 'ALLOWED',
        reason:
          'Usuário de Teste / Isenção Antifraude (Cadastros e Giros Ilimitados)',
      });
    } else {
      for (const rule of fraudRules) {
        const previousCount = await this.countForRule(dto.eventId, rule.type, {
          participantId: existingParticipant?.id ?? null,

          phone,
          email,

          deviceId: dto.deviceId,

          ipAddress,
        });

        const result = this.resolveDecision(
          previousCount,
          rule.max_allowed,
          rule.action,
        );

        fraudResults.push({
          ruleId: rule.id,
          type: rule.type,
          enabled: rule.enabled,
          previousCount,
          limit: rule.max_allowed,
          ruleAction: rule.action,
          decision: result.decision,
          reason: result.reason,
        });
      }
    }

    const whatsappToken = crypto.randomBytes(32).toString('hex');

    const participationStatus = this.resolveParticipationStatus(fraudResults);

    const result = await this.prisma.$transaction(
      async (tx) => {
        let participant = existingParticipant;

        if (!participant) {
          participant = await tx.participants.create({
            data: {
              full_name: dto.fullName.trim(),

              cpf_encrypted: cpfEncrypted,

              cpf_hash: cpfHash,

              cpf_last_digits: cpfLastDigits,

              phone: dto.phone.trim(),

              phone_normalized: phone,

              email: dto.email?.trim() || email,

              email_normalized: email,

              cro_number: dto.croNumber?.trim() || null,

              cro_state: croState,

              clinic_name: dto.clinicName?.trim() || 'Clínica não informada',

              city: dto.city?.trim() || null,

              state,

              chairs_count: dto.chairsCount ?? null,

              marketing_consent: dto.marketingConsent,

              privacy_consent: dto.privacyConsent,

              consented_at: new Date(),
            },
          });
        } else {
          participant = await tx.participants.update({
            where: {
              id: participant.id,
            },

            data: {
              full_name: dto.fullName.trim(),

              phone: dto.phone.trim(),

              phone_normalized: phone,

              email: dto.email?.trim() || participant.email || email,

              email_normalized: dto.email
                ? email
                : participant.email_normalized || email,

              cro_number:
                dto.croNumber?.trim() || participant.cro_number || null,

              cro_state: croState || participant.cro_state,

              clinic_name:
                dto.clinicName?.trim() ||
                participant.clinic_name ||
                'Clínica não informada',

              city: dto.city?.trim() || null,

              state,

              chairs_count: dto.chairsCount ?? null,

              marketing_consent: dto.marketingConsent,

              privacy_consent: dto.privacyConsent,

              consented_at: new Date(),
            },
          });
        }

        const eventParticipant = await tx.event_participants.findFirst({
          where: {
            event_id: dto.eventId,

            participant_id: participant.id,
          },
        });

        if (!eventParticipant) {
          await tx.event_participants.create({
            data: {
              event_id: dto.eventId,

              participant_id: participant.id,
            },
          });
        }

        const participation = await tx.participations.create({
          data: {
            event_id: dto.eventId,

            participant_id: participant.id,

            status: participationStatus,

            device_id: dto.deviceId,

            ip_address: ipAddress,

            user_agent: context?.userAgent ?? null,

            whatsapp_token: whatsappToken,
            whatsapp_validated: true,

            client_request_id: dto.clientRequestId ?? null,
          },
        });

        // Cartão VIP: resgate atômico (código livre do mesmo evento). Falha desfaz o cadastro.
        const vipCode = dto.vipCode ? normalizeVipCode(dto.vipCode) : '';
        const isVip = Boolean(vipCode) && participationStatus !== 'BLOCKED';

        if (isVip) {
          const redeemed = await tx.vip_codes.updateMany({
            where: {
              code: vipCode,
              event_id: dto.eventId,
              participation_id: null,
            },

            data: {
              participation_id: participation.id,
              redeemed_at: new Date(),
            },
          });

          if (redeemed.count !== 1) {
            throw new BadRequestException(
              'Código VIP inválido ou já utilizado. Confira o código do cartão.',
            );
          }
        }

        for (const check of fraudResults) {
          let identifierMasked: string | null = null;

          let identifierHash: string | null = null;

          switch (check.type) {
            case 'CPF':
              identifierHash = cpfHash;

              identifierMasked = `***.***.***-${cpfLastDigits}`;
              break;

            case 'PHONE':
              identifierHash = createSimpleIdentifierHash(phone);

              identifierMasked = maskPhone(phone);
              break;

            case 'EMAIL':
              identifierHash = createSimpleIdentifierHash(email);

              identifierMasked = maskEmail(email);
              break;

            case 'DEVICE':
              identifierHash = createSimpleIdentifierHash(dto.deviceId);

              identifierMasked = maskDevice(dto.deviceId);
              break;

            case 'IP':
              identifierHash = ipAddress
                ? createSimpleIdentifierHash(ipAddress)
                : null;

              identifierMasked = ipAddress;
              break;
          }

          await tx.fraud_checks.create({
            data: {
              event_id: dto.eventId,

              participation_id: participation.id,

              rule_type: check.type,

              identifier_hash: identifierHash,

              identifier_masked: identifierMasked,

              previous_count: check.previousCount,

              configured_limit: check.limit,

              decision: check.decision,

              reason: check.reason,

              ip_address: ipAddress,

              device_id: dto.deviceId,
            },
          });
        }

        await tx.audit_logs.create({
          data: {
            event_id: dto.eventId,

            actor_type: 'PARTICIPANT',

            action: 'PARTICIPANT_REGISTERED',

            entity_type: 'PARTICIPATION',

            entity_id: String(participation.id),

            description: `Participante ${participant.full_name} registrado com status ${participationStatus}.`,

            before_data: null,

            after_data: JSON.stringify({
              participantId: participant.id,

              participationId: participation.id,

              name: participant.full_name,

              cpfMasked: `***.***.***-${cpfLastDigits}`,

              phone: maskPhone(phone),

              email: maskEmail(email),

              cro: dto.croNumber ? `${dto.croNumber}/${croState ?? ''}` : null,

              status: participationStatus,
            }),

            metadata: JSON.stringify({
              fraudResults,
            }),

            ip_address: ipAddress,

            user_agent: context?.userAgent ?? null,
          },
        });

        let blockedReason: string | null = null;
        if (
          participationStatus === 'BLOCKED' ||
          participationStatus === 'REVIEW'
        ) {
          const blockedCheck = fraudResults.find(
            (f) => f.decision === 'BLOCKED' || f.decision === 'REVIEW',
          );
          if (blockedCheck) {
            switch (blockedCheck.type) {
              case 'CPF':
                blockedReason =
                  'Este CPF já realizou o giro da roleta neste evento.';
                break;
              case 'PHONE':
                blockedReason =
                  'Este número de WhatsApp já foi utilizado em uma participação neste evento.';
                break;
              case 'DEVICE':
                blockedReason =
                  'Este celular/dispositivo atingiu o limite máximo de giros permitidos.';
                break;
              case 'EMAIL':
                blockedReason =
                  'Este endereço de e-mail já participou deste evento.';
                break;
              case 'IP':
                blockedReason =
                  'Muitas participações registradas nesta rede. Procure nossa equipe no estande.';
                break;
              default:
                blockedReason =
                  blockedCheck.reason ||
                  'Participação pausada pelas regras de segurança do evento.';
            }
          } else {
            blockedReason =
              'Esta participação precisa de validação presencial com a equipe Finora.';
          }
        }

        return {
          success: participationStatus === 'APPROVED',
          blockedReason,

          participant: {
            id: participant.id,

            fullName: participant.full_name,

            cpfMasked: `***.***.***-${cpfLastDigits}`,

            phone: maskPhone(phone),

            email: maskEmail(email),

            croNumber: participant.cro_number,

            croState: participant.cro_state,
          },

          participation: {
            id: participation.id,

            eventId: participation.event_id,

            status: participation.status,

            canDraw: participation.status === 'APPROVED',

            vip: isVip,

            vipCode: isVip ? (dto.vipCode?.trim().toUpperCase() || null) : null,

            whatsappToken: whatsappToken,
          },

          fraud: {
            status: participationStatus,

            hasAlerts: fraudResults.some((item) => item.decision === 'ALERT'),

            checks: fraudResults.map((item) => ({
              type: item.type,

              decision: item.decision,

              previousCount: item.previousCount,

              limit: item.limit,

              reason: item.reason,
            })),
          },
        };
      },
      {
        maxWait: 10000,
        timeout: 20000,
      },
    );

    if (result.success) {
      const validationToken =
        result.participation.whatsappToken ||
        result.participation.id ||
        result.participant.id;
      const validationLink = publicUrl(`/v/${validationToken}`, context?.origin);
      // PIN = id da participação (o mesmo que o balcão busca e o QR carrega).
      const ticketCode = `#${String(result.participation.id).padStart(4, '0')}`;
      const OLD_DEFAULT_TEMPLATE = 'Olá! Confirme sua participação no evento [LINK_VALIDACAO] e junte-se a nós: [LINK_CANAL]';
      const isOldTemplate = event?.whatsapp_message?.trim() === OLD_DEFAULT_TEMPLATE;
      const rawTemplate =
        event?.whatsapp_message && event.whatsapp_message.trim() && !isOldTemplate
          ? event.whatsapp_message
          : `{Oieee|Oii|Oi|Olá|Fala} {nome}! {Tudo bem?|Tudo joia?|Como você tá?} {Aqui é da Finora!|Aqui é a equipe da Finora!|Passando pra confirmar que} seu cadastro {no estande da|para a} Finora {no evento |}foi {realizado|concluído} com sucesso! {🎉|🚀|✨|😁}\n\n` +
            `🎟️ *{SEU|O SEU} PIN EXCLUSIVO DE ACESSO:*\n` +
            `👉 *{pin}*\n\n` +
            `📲 *{PASSO OBRIGATÓRIO PARA ATIVAR|ÚLTIMO PASSO}:*\n` +
            `{Clique no link abaixo para validar seu WhatsApp|Acesse o link pra confirmar seu número} e ativar sua participação:\n` +
            `👉 {link_validacao}\n\n` +
            `🎰 *NO ESTANDE:*\n` +
            `{Apresente a tela confirmada para nossa equipe e|Mostre o link lá no estande pra} *GIRAR A ROLETA* {para|e} ganhar brindes exclusivos! {🎁|⚡|🤩}\n\n` +
            `🏆 *MEGA SORTEIO:*\n` +
            `Você já está concorrendo ao Grande Prêmio! {🌟|🥇|🏆}\n\n` +
            `{Um abraço!|Te esperamos lá!|Até mais!}`;

      const msg = rawTemplate
        .replace(/\[ID_PARTICIPANTE\]/gi, ticketCode)
        .replace(/\{id_participante\}/gi, ticketCode)
        .replace(/\[CUPOM\]/gi, ticketCode)
        .replace(/\{cupom\}/gi, ticketCode)
        .replace(/\[ID\]/gi, ticketCode)
        .replace(/\{id\}/gi, ticketCode)
        .replace(/\{pin\}/gi, ticketCode)
        .replace(/\[NOME\]/gi, result.participant.fullName)
        .replace(/\{nome\}/gi, result.participant.fullName)
        .replace(/\{evento\}/gi, event?.name || 'Finora Experience')
        .replace(/\[EVENTO\]/gi, event?.name || 'Finora Experience')
        .replace(/\[LINK_VALIDACAO\]/gi, validationLink)
        .replace(/\{link_validacao\}/gi, validationLink)
        .replace(/\[LINK_CANAL\]/gi, event?.whatsapp_channel_link || '')
        .replace(/\{link_canal\}/gi, event?.whatsapp_channel_link || '');

      // Disparo assíncrono (desativado quando DISABLE_WHATSAPP=true)
      if (process.env.DISABLE_WHATSAPP !== 'true') {
        setImmediate(() => {
          this.whatsappService
            .enqueueMessage(phone, msg, { eventId: event?.id, participantId: result.participant.id })
            .catch((err) => {
              console.error(
                `[WhatsApp Fila] Erro ao enfileirar mensagem para ${phone}:`,
                err,
              );
            });
        });
      }

      // NOVO: Auto-Agendamento Comercial Inteligente no final do cadastro
      try {
        const nextSlot = await this.meetingsService.getNextAvailableSlot(event.id, 5);
        if (nextSlot) {
          await this.meetingsService.bookMeeting(event.id, result.participant.id, nextSlot);
          (result as any).autoBookedSlot = nextSlot;
        }
      } catch (err) {
        console.error(`[Auto-Booking] Falha ao auto-agendar para participante ${result.participant.id}:`, err);
      }
    }

    notifyLive(dto.eventId);
    leadEvents.next({ participationId: result.participation.id, type: 'lead' });

    return result;
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

    return this.prisma.participations.findMany({
      where: {
        event_id: eventId,
      },

      orderBy: {
        created_at: 'desc',
      },

      select: {
        id: true,
        status: true,
        device_id: true,
        ip_address: true,
        whatsapp_validated: true,
        started_at: true,
        completed_at: true,
        created_at: true,

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
            chairs_count: true,
          },
        },

        draws: {
          select: {
            id: true,
            source: true,
            drawn_at: true,

            prizes: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },

        fraud_checks: {
          select: {
            id: true,
            rule_type: true,
            decision: true,
            previous_count: true,
            configured_limit: true,
            reason: true,
          },
        },

        vip_codes: {
          select: {
            id: true,
            code: true,
            redeemed_at: true,
          },
        },
      },

      take: 500,
    });
  }

  async findOne(id: number) {
    const participation = await this.prisma.participations.findUnique({
      where: {
        id,
      },

      select: {
        id: true,
        event_id: true,
        status: true,
        device_id: true,
        ip_address: true,
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
            chairs_count: true,
            marketing_consent: true,
            privacy_consent: true,
          },
        },

        fraud_checks: {
          orderBy: {
            id: 'asc',
          },

          select: {
            id: true,
            rule_type: true,
            identifier_masked: true,
            previous_count: true,
            configured_limit: true,
            decision: true,
            reason: true,
            created_at: true,
          },
        },

        draws: {
          select: {
            id: true,
            source: true,
            probability_used: true,
            drawn_at: true,

            prizes: {
              select: {
                id: true,
                name: true,
                description: true,
                image_url: true,
              },
            },
          },
        },
      },
    });

    if (!participation) {
      throw new NotFoundException('Participação não encontrada.');
    }

    const meeting = await this.prisma.meetings.findFirst({
      where: {
        event_id: participation.event_id,
        participant_id: participation.participants.id,
        status: 'SCHEDULED',
      },
    });

    return {
      ...participation,
      isVip: !!meeting,
    };
  }

  /**
   * Dados mínimos para a tela pública da roleta: sem contato, CPF ou IP.
   */
  async findPublic(id: number) {
    const participation = await this.prisma.participations.findUnique({
      where: { id },
      select: {
        id: true,
        event_id: true,
        status: true,
        participants: {
          select: {
            id: true,
            full_name: true,
            clinic_name: true,
            cro_number: true,
            cro_state: true,
            city: true,
            state: true,
          },
        },
        vip_codes: {
          select: {
            id: true,
            code: true,
          },
        },
        draws: {
          select: {
            id: true,
            source: true,
            drawn_at: true,
            prizes: {
              select: {
                id: true,
                name: true,
                description: true,
                image_url: true,
              },
            },
          },
        },
      },
    });

    if (!participation) {
      throw new NotFoundException('Participação não encontrada.');
    }

    const meeting = await this.prisma.meetings.findFirst({
      where: {
        event_id: participation.event_id,
        participant_id: participation.participants.id,
        status: 'SCHEDULED',
      },
      select: { id: true },
    });

    const isVip = Boolean(participation.vip_codes);

    return {
      id: participation.id,
      status: participation.status,
      isVip,
      hasScheduledMeeting: Boolean(meeting),
      vipCode: participation.vip_codes?.code || null,
      participant: {
        id: participation.participants.id,
        firstName: participation.participants.full_name.trim().split(/\s+/)[0],
        fullName: participation.participants.full_name.trim(),
        clinicName: participation.participants.clinic_name,
        croNumber: participation.participants.cro_number,
        croState: participation.participants.cro_state,
        city: participation.participants.city,
        state: participation.participants.state,
      },
      draw: participation.draws,
    };
  }

  async validateWhatsapp(token: string) {
    const cleanToken = (token || '').trim();
    const parsedId = Number.isNaN(Number(cleanToken)) ? undefined : Number(cleanToken);

    const participation = await this.prisma.participations.findFirst({
      where: {
        OR: [
          { whatsapp_token: cleanToken },
          { id: parsedId },
          { participant_id: parsedId },
        ],
      },
      orderBy: { id: 'desc' },
      include: {
        participants: true,
        events: true,
      },
    });

    if (!participation) {
      throw new NotFoundException('Link de confirmação inválido ou expirado.');
    }

    if (!participation.whatsapp_validated) {
      await this.prisma.participations.update({
        where: { id: participation.id },
        data: {
          whatsapp_validated: true,
          // Link público: não pode desbloquear participação barrada pelo antifraude.
          ...(participation.status === 'PENDING' ? { status: 'APPROVED' as const } : {}),
        },
      });
      notifyLive(participation.event_id);
    }

    return {
      success: true,
      participant: {
        id: participation.id,
        fullName: participation.participants.full_name,
        cpfLastDigits: participation.participants.cpf_last_digits,
        clinicName: participation.participants.clinic_name,
      },
      eventName: participation.events.name,
      event: {
        slug: participation.events.slug,
        name: participation.events.name,
        accentColor: participation.events.accent_color,
        accentInkColor: participation.events.accent_ink_color,
      },
      message: 'Participação validada com sucesso!',
    };
  }

  /**
   * Gera o conteúdo CSV formatado para Excel de todos os leads/participantes do evento
   */
  async exportCsv(eventId: number): Promise<string> {
    const event = await this.prisma.events.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('Evento não encontrado.');
    }

    const participations = await this.prisma.participations.findMany({
      where: { event_id: eventId },
      include: {
        participants: true,
        vip_codes: true,
        draws: {
          include: {
            prizes: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    const headers = [
      'ID Participação',
      'Nome Completo',
      'VIP / Mentorado',
      'Código VIP Utilizado',
      'WhatsApp / Telefone',
      'Link WhatsApp Direto',
      'E-mail',
      'Porte da Clínica (Cadeiras)',
      'CRO',
      'UF CRO',
      'Clínica / Empresa',
      'Status Participação',
      'Prêmio Conquistado',
      'Origem do Sorteio',
      'Data de Cadastro',
      'Data do Sorteio',
      'Aceitou Marketing',
    ];

    const escapeCsv = (val: unknown) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = participations.map((p) => {
      const part = p.participants;
      const draw = p.draws;
      const prize = draw?.prizes;
      const isVip = Boolean(p.vip_codes);
      const cleanPhone = (part.phone || '').replace(/\D/g, '');
      const waLink = cleanPhone ? `https://wa.me/55${cleanPhone.replace(/^55/, '')}` : '-';
      const chairsDesc =
        part.chairs_count === 6
          ? '6 ou mais (Grande Porte / VIP)'
          : part.chairs_count === 4
          ? '3 a 5 cadeiras (Médio Porte)'
          : part.chairs_count === 1
          ? '1 a 2 cadeiras (Pequeno Porte)'
          : '-';

      return [
        escapeCsv(p.id),
        escapeCsv(part.full_name),
        escapeCsv(isVip ? 'SIM (VIP / Mentorado)' : 'NÃO'),
        escapeCsv(p.vip_codes?.code || '-'),
        escapeCsv(part.phone),
        escapeCsv(waLink),
        escapeCsv(part.email),
        escapeCsv(chairsDesc),
        escapeCsv(part.cro_number || '-'),
        escapeCsv(part.cro_state || '-'),
        escapeCsv(part.clinic_name || '-'),
        escapeCsv(p.status),
        escapeCsv(prize?.name || 'Não sorteado'),
        escapeCsv(draw?.source || '-'),
        escapeCsv(
          p.created_at ? new Date(p.created_at).toLocaleString('pt-BR') : '-',
        ),
        escapeCsv(
          draw?.drawn_at
            ? new Date(draw.drawn_at).toLocaleString('pt-BR')
            : '-',
        ),
        escapeCsv(part.marketing_consent ? 'Sim' : 'Não'),
      ].join(';');
    });

    // Adiciona o byte order mark (BOM) UTF-8 para o Excel abrir com acentuação correta
    const bom = '\uFEFF';
    return bom + [headers.join(';'), ...rows].join('\r\n');
  }

  /**
   * Exporta os leads do evento em formato enriquecido compatível com RD Station, HubSpot e Salesforce
   */
  async exportCrmCsv(eventId: number): Promise<string> {
    const participations = await this.prisma.participations.findMany({
      where: {
        event_id: eventId,
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
      orderBy: {
        id: 'asc',
      },
    });

    const headers = [
      'Nome Completo',
      'Primeiro Nome',
      'Sobrenome',
      'VIP / Mentorado',
      'Código VIP',
      'Email',
      'WhatsApp / Celular',
      'Link WhatsApp Direto',
      'Porte da Clínica (Cadeiras)',
      'CRO / Registro',
      'Clínica / Consultório',
      'Cidade',
      'Estado (UF)',
      'Origem do Lead',
      'Tags CRM',
      'Brinde Ganho',
      'Status Entrega',
      'PIN Resgate',
      'Aceitou Marketing (Opt-in)',
      'Data e Hora do Cadastro',
    ];

    const escapeCsv = (val: unknown) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = participations.map((p) => {
      const part = p.participants;
      const draw = p.draws;
      const prize = draw?.prizes;
      const isVip = Boolean(p.vip_codes);
      const names = (part.full_name || '').trim().split(' ');
      const firstName = names[0] || '';
      const lastName = names.slice(1).join(' ') || '';
      const cleanPhone = (part.phone || '').replace(/\D/g, '');
      const waLink = cleanPhone ? `https://wa.me/55${cleanPhone.replace(/^55/, '')}` : '';

      const chairsTag =
        part.chairs_count && part.chairs_count >= 6
          ? 'clinica_grande_porte,lead_vip_ouro'
          : part.chairs_count && part.chairs_count >= 3
          ? 'clinica_medio_porte'
          : 'clinica_pequeno_porte';

      const vipTag = isVip ? 'vip_mentorado' : 'geral';

      const chairsDesc =
        part.chairs_count === 6
          ? '6 ou mais (Grande Porte / VIP)'
          : part.chairs_count === 4
          ? '3 a 5 cadeiras (Médio Porte)'
          : part.chairs_count === 1
          ? '1 a 2 cadeiras (Pequeno Porte)'
          : 'Não informado';

      const tags = [
        'lead_estande',
        `evento_${p.events.slug || 'finora'}`,
        vipTag,
        chairsTag,
        prize
          ? `ganhou_${prize.name.toLowerCase().replace(/\s+/g, '_')}`
          : 'sem_brinde',
        p.draws?.claimed_at ? 'brinde_entregue' : 'brinde_pendente',
      ].join(',');

      return [
        escapeCsv(part.full_name),
        escapeCsv(firstName),
        escapeCsv(lastName),
        escapeCsv(isVip ? 'SIM' : 'NÃO'),
        escapeCsv(p.vip_codes?.code || '-'),
        escapeCsv(part.email),
        escapeCsv(part.phone),
        escapeCsv(waLink),
        escapeCsv(chairsDesc),
        escapeCsv(
          part.cro_number ? `${part.cro_number}/${part.cro_state || ''}` : '',
        ),
        escapeCsv(part.clinic_name || ''),
        escapeCsv(part.city || ''),
        escapeCsv(part.state || ''),
        escapeCsv(`Finora Experience - ${p.events.name}`),
        escapeCsv(tags),
        escapeCsv(prize?.name || 'Não sorteado'),
        escapeCsv(p.draws?.claimed_at ? 'Entregue' : 'Pendente'),
        escapeCsv(`#${String(p.id).padStart(4, '0')}`),
        escapeCsv(part.marketing_consent ? 'SIM' : 'NÃO'),
        escapeCsv(p.created_at ? new Date(p.created_at).toISOString() : ''),
      ].join(';');
    });

    const bom = '\uFEFF';
    return bom + [headers.join(';'), ...rows].join('\r\n');
  }

  /**
   * Retorna os participantes que se cadastraram com sucesso e ainda não giraram a roleta
   */
  async findPendingDraws(eventId: number, search?: string) {
    const where: any = {
      event_id: eventId,
      status: { in: ['PENDING', 'APPROVED'] },
      draws: null,
    };

    if (search && search.trim()) {
      const term = search.trim();
      where.participants = {
        OR: [
          { full_name: { contains: term } },
          { phone_normalized: { contains: term.replace(/\D/g, '') } },
          { cpf_last_digits: { contains: term.replace(/\D/g, '') } },
        ],
      };
    }

    const participations = await this.prisma.participations.findMany({
      where,
      include: {
        participants: true,
        vip_codes: { select: { id: true } },
      },
      orderBy: { id: 'desc' },
      take: 30,
    });

    return participations.map((p) => ({
      participationId: p.id,
      vip: Boolean(p.vip_codes),
      participantId: p.participant_id,
      fullName: p.participants.full_name,
      cpfLastDigits: p.participants.cpf_last_digits,
      phone: maskPhone(p.participants.phone_normalized),
      clinicName: p.participants.clinic_name,
      croNumber: p.participants.cro_number,
      croState: p.participants.cro_state,
      city: p.participants.city,
      state: p.participants.state,
      createdAt: p.created_at,
    }));
  }
}

import { createHash } from 'crypto';

function createSimpleIdentifierHash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function maskPhone(value: string): string {
  if (value.length < 4) {
    return '****';
  }

  return `*******${value.slice(-4)}`;
}

function maskEmail(value: string): string {
  const [name, domain] = value.split('@');

  if (!domain) {
    return '***';
  }

  const visible = name.slice(0, 2);

  return `${visible}***@${domain}`;
}

function maskDevice(value: string): string {
  if (value.length <= 8) {
    return '********';
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

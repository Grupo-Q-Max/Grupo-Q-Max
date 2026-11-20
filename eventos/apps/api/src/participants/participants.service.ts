import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { notifyLive } from '../live/live';
import { publicUrl } from '../common/public-url';
import { leadEvents } from '../common/domain-events';
import * as crypto from 'crypto';

import {
  decryptCpf,
  encryptCpf,
  formatCpf,
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
export class ParticipantsService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappService: WhatsappService,
    private readonly fraudRulesService: FraudRulesService,
    private readonly meetingsService: MeetingsService,
  ) {}

  async onModuleInit() {
    try {
      await this.deleteByNameTerms([
        'Rodrigo Dante Penhalves',
        'Rodrigo Dante',
        'Rodrigo Penhalves',
        'Rodrigo Sante Penhalves',
      ]);
    } catch (err) {
      console.warn('[ParticipantsService] Limpeza automática ignorada:', err);
    }
  }

  async deleteByNameTerms(nameTerms: string[]) {
    const filters = nameTerms.map((term) => ({
      full_name: { contains: term },
    }));

    const found = await this.prisma.participants.findMany({
      where: {
        OR: filters,
      },
      select: { id: true, full_name: true },
    });

    if (!found || found.length === 0) return { deletedCount: 0 };

    for (const p of found) {
      const partIds = (
        await this.prisma.participations.findMany({
          where: { participant_id: p.id },
          select: { id: true },
        })
      ).map((x) => x.id);

      if (partIds.length > 0) {
        await this.prisma.vip_codes.updateMany({
          where: { participation_id: { in: partIds } },
          data: { participation_id: null, redeemed_at: null },
        });
        await this.prisma.draws.deleteMany({
          where: { participation_id: { in: partIds } },
        });
        await this.prisma.fraud_checks.deleteMany({
          where: { participation_id: { in: partIds } },
        });
        await this.prisma.participations.deleteMany({
          where: { id: { in: partIds } },
        });
      }

      await this.prisma.meetings.deleteMany({
        where: { participant_id: p.id },
      });
      await this.prisma.message_queue.deleteMany({
        where: { participant_id: p.id },
      });
      await this.prisma.event_participants.deleteMany({
        where: { participant_id: p.id },
      });
      await this.prisma.participants.delete({
        where: { id: p.id },
      });
      console.log(`[ParticipantsService] Cadastro deletado com sucesso: ${p.full_name} (ID: ${p.id})`);
    }

    return { deletedCount: found.length };
  }

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

    // Alertas de IP ou DEVICE compartilhados no estande/evento não devem jogar a participação em REVIEW,
    // garantindo que os novos participantes caiam imediatamente na fila do operador.
    const nonNetworkReviews = checks.filter(
      (check) => check.decision === 'REVIEW' && check.type !== 'DEVICE' && check.type !== 'IP',
    );
    if (nonNetworkReviews.length > 0) {
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

    let cpf: string;
    let cpfLastDigits: string;

    if (dto.isForeigner) {
      const rawDoc = String(dto.foreignDocument || dto.cpf || '').trim();

      if (!rawDoc || rawDoc.length < 2) {
        throw new BadRequestException(
          'Informe um número de documento/passaporte válido com pelo menos 2 caracteres.',
        );
      }

      // Permite letras, números, hífens, pontos, barras e caracteres do documento
      const cleanDoc = rawDoc.replace(/[\r\n\t]/g, ' ').slice(0, 40).toUpperCase();

      const cCode = (dto.countryCode || 'INTL')
        .replace(/[^a-zA-Z0-9+]/g, '')
        .toUpperCase()
        .slice(0, 10);

      cpf = `EXT-${cCode}-${cleanDoc}`;
      cpfLastDigits = cleanDoc.slice(-4).padStart(4, '0');
    } else {
      cpf = normalizeCpf(dto.cpf);

      if (!isValidCpf(cpf)) {
        throw new BadRequestException(
          'O CPF digitado é inválido. Por favor, confira os 11 dígitos.',
        );
      }

      cpfLastDigits = cpf.slice(-4);
    }

    let phone: string;
    if (dto.isForeigner) {
      const cleanDigits = String(dto.phone || '').replace(/\D/g, '');
      if (cleanDigits.length < 7 || cleanDigits.length > 20) {
        throw new BadRequestException(
          'Número de telefone/WhatsApp internacional inválido. Informe o código do país e número.',
        );
      }
      phone = cleanDigits;
    } else {
      phone = normalizePhone(dto.phone);

      if (phone.length < 10 || phone.length > 11) {
        throw new BadRequestException(
          'Número de WhatsApp inválido. Digite o DDD e número com 10 ou 11 dígitos.',
        );
      }
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

      // Disparo automático imediato no WhatsApp DESATIVADO:
      // O participante cadastra e vai direto para a roleta liberado sem receber mensagens automáticas.
      // O telefone e dados ficam registrados no banco para posterior exportação comercial.
      if (process.env.ENABLE_REGISTRATION_WHATSAPP === 'true') {
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

    const records = await this.prisma.participations.findMany({
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
            cpf_encrypted: true,
            phone: true,
            email: true,
            cro_number: true,
            cro_state: true,
            clinic_name: true,
            city: true,
            state: true,
            chairs_count: true,
            meetings: {
              where: { event_id: eventId },
              select: {
                id: true,
                scheduled_at: true,
                status: true,
              },
            },
          },
        },

        draws: {
          select: {
            id: true,
            source: true,
            drawn_at: true,
            claimed_at: true,

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

    return records.map((record) => {
      const p = record.participants;
      const decrypted = p?.cpf_encrypted ? decryptCpf(p.cpf_encrypted) : '';
      const formattedCpf = decrypted
        ? formatCpf(decrypted)
        : p?.cpf_last_digits
        ? `***.***.***-${p.cpf_last_digits}`
        : '';

      return {
        ...record,
        participants: p
          ? {
              ...p,
              cpf: decrypted,
              cpf_formatted: formattedCpf,
              cpf_encrypted: undefined,
            }
          : p,
      };
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
                is_vip: true,
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
                is_vip: true,
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
        status: { in: ['SCHEDULED', 'COMPLETED'] },
      },
      select: { id: true },
    });

    const isVip = Boolean(participation.vip_codes) || Boolean(meeting);

    const vipDrawParticipation = await this.prisma.participations.findFirst({
      where: {
        participant_id: participation.participants.id,
        event_id: participation.event_id,
        draws: { is: { prizes: { is_vip: true } } },
      },
      include: {
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
                is_vip: true,
              },
            },
          },
        },
      },
    });

    const existingVipDraw = vipDrawParticipation?.draws || (participation.draws?.prizes?.is_vip ? participation.draws : null);

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
      vipDraw: existingVipDraw,
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
      'CPF',
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
      const decryptedCpf = part.cpf_encrypted ? decryptCpf(part.cpf_encrypted) : '';
      const displayCpf = decryptedCpf ? formatCpf(decryptedCpf) : (part.cpf_last_digits ? `***.***.***-${part.cpf_last_digits}` : '-');
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
        escapeCsv(displayCpf),
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
      'CPF',
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
      const decryptedCpf = part.cpf_encrypted ? decryptCpf(part.cpf_encrypted) : '';
      const displayCpf = decryptedCpf ? formatCpf(decryptedCpf) : (part.cpf_last_digits ? `***.***.***-${part.cpf_last_digits}` : '');

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
        escapeCsv(displayCpf),
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
   * Exporta a planilha comercial segmentada em 1 clique:
   * - 🟢 QUENTES: Agendou reunião e/ou compareceu/retirou brinde no estande (Alta Prioridade)
   * - 🟡 MORNOS: Ativou bilhete VIP / mentorado ou possui clínica de grande porte sem reunião
   * - ⚪ GERAIS: Visitantes comuns da feira
   */
  async exportCommercialCsv(eventId: number, segment?: string): Promise<string> {
    const event = await this.prisma.events.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('Evento não encontrado.');
    }

    const participations = await this.prisma.participations.findMany({
      where: { event_id: eventId },
      include: {
        events: true,
        participants: {
          include: {
            meetings: {
              where: { event_id: eventId },
              orderBy: { scheduled_at: 'desc' },
            },
          },
        },
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
      'Classificação Comercial',
      'Score de Prioridade',
      'Nome Completo',
      'CPF',
      'Primeiro Nome',
      'Sobrenome',
      'VIP / Mentorado',
      'Código VIP Utilizado',
      'WhatsApp / Celular',
      'Link WhatsApp Direto (Clique para Iniciar)',
      'Mensagem Sugerida para Abordagem Comercial',
      'E-mail',
      'Porte da Clínica (Cadeiras)',
      'Clínica / Empresa',
      'CRO / Registro',
      'UF CRO',
      'Cidade',
      'Reunião no Estande',
      'Data da Reunião',
      'Status da Reunião',
      'Brinde Ganho',
      'Brinde Retirado no Estande',
      'PIN de Resgate',
      'Status Participação',
      'Data do Cadastro',
      'Tags CRM Comercial',
    ];

    const escapeCsv = (val: unknown) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const mapped = participations.map((p) => {
      const part = p.participants;
      const draw = p.draws;
      const prize = draw?.prizes;
      const isVip = Boolean(p.vip_codes);
      const meeting = part.meetings?.[0];
      const hasScheduledMeeting = Boolean(
        meeting && (meeting.status === 'SCHEDULED' || meeting.status === 'COMPLETED'),
      );
      const hasClaimedPrize = Boolean(draw?.claimed_at);
      const decryptedCpf = part.cpf_encrypted ? decryptCpf(part.cpf_encrypted) : '';
      const displayCpf = decryptedCpf ? formatCpf(decryptedCpf) : (part.cpf_last_digits ? `***.***.***-${part.cpf_last_digits}` : '');

      let classification = '⚪ GERAL (Visitante)';
      let priorityScore = 3;
      let segmentType = 'general';

      if (hasScheduledMeeting || hasClaimedPrize) {
        classification = '🟢 QUENTE (Reunião / Estande)';
        priorityScore = 1;
        segmentType = 'hot';
      } else if (isVip || (part.chairs_count && part.chairs_count >= 6)) {
        classification = '🟡 MORNO (VIP Sem Reunião)';
        priorityScore = 2;
        segmentType = 'warm';
      }

      const names = (part.full_name || '').trim().split(/\s+/);
      const firstName = names[0] || 'Doutor(a)';
      const lastName = names.slice(1).join(' ') || '';
      const cleanPhone = (part.phone || '').replace(/\D/g, '');
      const waPhone = cleanPhone.replace(/^55/, '');
      const waLink = cleanPhone ? `https://wa.me/55${waPhone}` : '';

      let suggestedMsg = '';
      if (segmentType === 'hot') {
        suggestedMsg = `Olá Dr(a). ${firstName}, tudo bem? Aqui é da equipe Finora / Grupo Q-Max! Vimos seu agendamento no nosso estande no evento ${event.name}. Foi ótimo conhecê-lo! Gostaria de dar continuidade à sua proposta personalizada de gestão financeira?`;
      } else if (segmentType === 'warm') {
        suggestedMsg = `Olá Dr(a). ${firstName}, tudo bem? Aqui é da equipe Finora / Grupo Q-Max! Vimos que você ativou seu convite VIP no evento ${event.name}. Gostaríamos de liberar a condição especial exclusiva que o Dr. Igor preparou para a sua clínica. Você teria 5 minutos hoje?`;
      } else {
        suggestedMsg = `Olá Dr(a). ${firstName}, tudo bem? Aqui é da equipe Finora / Grupo Q-Max! Foi um prazer recebê-lo no evento ${event.name}. Como podemos apoiar a sua clínica na redução tributária e gestão este mês?`;
      }

      const chairsDesc =
        part.chairs_count === 6
          ? '6 ou mais cadeiras (Grande Porte / VIP)'
          : part.chairs_count === 4
          ? '3 a 5 cadeiras (Médio Porte)'
          : part.chairs_count === 1
          ? '1 a 2 cadeiras (Pequeno Porte)'
          : 'Não informado';

      const meetingInfo = hasScheduledMeeting && meeting
        ? `SIM - ${new Date(meeting.scheduled_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
        : 'Não agendada';

      const meetingDateFormatted = meeting
        ? new Date(meeting.scheduled_at).toLocaleString('pt-BR')
        : '-';

      const prizeClaimed = draw?.claimed_at
        ? `SIM - Retirado em ${new Date(draw.claimed_at).toLocaleString('pt-BR')}`
        : draw
        ? 'Pendente de retirada no estande'
        : 'Não sorteado';

      const tags = [
        'lead_estande',
        segmentType === 'hot'
          ? 'lead_quente_comercial'
          : segmentType === 'warm'
          ? 'lead_morno_vip'
          : 'lead_geral',
        isVip ? 'vip_mentorado' : 'geral',
        hasScheduledMeeting ? 'reuniao_agendada' : 'sem_reuniao',
        hasClaimedPrize ? 'passou_no_estande' : 'nao_passou',
        `cadeiras_${part.chairs_count || 1}`,
      ].join(',');

      return {
        priorityScore,
        segmentType,
        row: [
          escapeCsv(classification),
          escapeCsv(priorityScore),
          escapeCsv(part.full_name),
          escapeCsv(displayCpf),
          escapeCsv(firstName),
          escapeCsv(lastName),
          escapeCsv(isVip ? 'SIM' : 'NÃO'),
          escapeCsv(p.vip_codes?.code || '-'),
          escapeCsv(part.phone),
          escapeCsv(waLink),
          escapeCsv(suggestedMsg),
          escapeCsv(part.email),
          escapeCsv(chairsDesc),
          escapeCsv(part.clinic_name || '-'),
          escapeCsv(part.cro_number || '-'),
          escapeCsv(part.cro_state || '-'),
          escapeCsv(part.city || '-'),
          escapeCsv(meetingInfo),
          escapeCsv(meetingDateFormatted),
          escapeCsv(meeting?.status || '-'),
          escapeCsv(prize?.name || 'Não sorteado'),
          escapeCsv(prizeClaimed),
          escapeCsv(p.id),
          escapeCsv(p.status),
          escapeCsv(p.created_at ? new Date(p.created_at).toLocaleString('pt-BR') : '-'),
          escapeCsv(tags),
        ].join(';'),
      };
    });

    let filtered = mapped;
    if (segment && segment !== 'all') {
      filtered = mapped.filter((m) => m.segmentType === segment.toLowerCase());
    }

    filtered.sort((a, b) => a.priorityScore - b.priorityScore);

    const bom = '\uFEFF';
    return bom + [headers.join(';'), ...filtered.map((f) => f.row)].join('\r\n');
  }

  /**
   * Retorna TODOS os participantes que se cadastraram e ainda não giraram a roleta normal ou a Roleta VIP
   */
  async findPendingDraws(eventId: number, search?: string) {
    const where: any = {
      event_id: eventId,
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

    const [participations, vipDrawRows] = await Promise.all([
      this.prisma.participations.findMany({
        where: {
          event_id: eventId,
          ...(where.participants ? { participants: where.participants } : {}),
          OR: [
            // 1. Todas as participações que ainda não realizaram giro na roleta
            {
              status: { in: ['PENDING', 'APPROVED', 'REVIEW'] },
              draws: null,
            },
            // 2. Participações que já realizaram o giro normal,
            // mas agendaram reunião ou têm código VIP e ainda têm direito à Roleta VIP!
            {
              draws: { isNot: null },
              participants: {
                meetings: {
                  some: {
                    event_id: eventId,
                    status: { in: ['SCHEDULED', 'COMPLETED'] },
                  },
                },
              },
            },
            {
              draws: { isNot: null },
              vip_codes: { isNot: null },
            },
          ],
        },
        include: {
          participants: {
            include: {
              meetings: {
                where: {
                  event_id: eventId,
                  status: { in: ['SCHEDULED', 'COMPLETED'] },
                },
                take: 1,
              },
            },
          },
          vip_codes: { select: { id: true } },
          draws: {
            include: {
              prizes: {
                select: {
                  id: true,
                  name: true,
                  description: true,
                  image_url: true,
                  is_vip: true,
                },
              },
            },
          },
        },
        orderBy: { id: 'desc' },
      }),
      this.prisma.participations.findMany({
        where: {
          event_id: eventId,
          draws: { is: { prizes: { is_vip: true } } },
        },
        select: { id: true, participant_id: true },
      }),
    ]);

    const participantsWithVipDraw = new Set<number>();
    for (const v of vipDrawRows) {
      participantsWithVipDraw.add(v.participant_id);
    }

    const resultList: any[] = [];
    const seenParticipantsWithoutDraw = new Set<number>();

    for (const p of participations) {
      const hasMeeting = Boolean(p.participants.meetings && p.participants.meetings.length > 0);
      const isVip = Boolean(p.vip_codes) || hasMeeting;
      const decryptedCpf = p.participants.cpf_encrypted ? decryptCpf(p.participants.cpf_encrypted) : '';
      const formattedCpf = decryptedCpf ? formatCpf(decryptedCpf) : '';

      if (p.draws) {
        if (!isVip) continue;
        if (p.draws.prizes?.is_vip) continue;
        if (participantsWithVipDraw.has(p.participant_id)) continue;

        resultList.push({
          participationId: p.id,
          vip: true,
          hasVipCode: Boolean(p.vip_codes),
          hasMeeting,
          pendingVipOnly: true,
          normalPrize: p.draws.prizes,
          participantId: p.participant_id,
          fullName: p.participants.full_name,
          cpf: decryptedCpf,
          cpfFormatted: formattedCpf,
          cpfLastDigits: p.participants.cpf_last_digits,
          phone: maskPhone(p.participants.phone_normalized),
          clinicName: p.participants.clinic_name,
          croNumber: p.participants.cro_number,
          croState: p.participants.cro_state,
          city: p.participants.city,
          state: p.participants.state,
          createdAt: p.created_at,
        });
      } else {
        // Evita duplicar a mesma pessoa se ela tentou se cadastrar múltiplas vezes sem girar
        if (seenParticipantsWithoutDraw.has(p.participant_id)) continue;
        seenParticipantsWithoutDraw.add(p.participant_id);

        resultList.push({
          participationId: p.id,
          vip: isVip,
          hasVipCode: Boolean(p.vip_codes),
          hasMeeting,
          pendingVipOnly: false,
          participantId: p.participant_id,
          fullName: p.participants.full_name,
          cpf: decryptedCpf,
          cpfFormatted: formattedCpf,
          cpfLastDigits: p.participants.cpf_last_digits,
          phone: maskPhone(p.participants.phone_normalized),
          clinicName: p.participants.clinic_name,
          croNumber: p.participants.cro_number,
          croState: p.participants.cro_state,
          city: p.participants.city,
          state: p.participants.state,
          createdAt: p.created_at,
        });
      }
    }

    return resultList;
  }

  async findByCpfAndEvent(eventId: number, rawCpf: string) {
    const rawTrimmed = String(rawCpf || '').trim();
    const cleanCpf = rawTrimmed.replace(/\D/g, '');
    if (cleanCpf.length < 4 && rawTrimmed.length < 3) {
      return { found: false, message: 'CPF ou documento inválido.' };
    }

    const includeRelations = {
      participations: {
        where: { event_id: eventId },
        include: {
          draws: {
            include: {
              prizes: true,
            },
          },
          vip_codes: true,
        },
        orderBy: { id: 'desc' as const },
      },
      meetings: {
        where: { status: { notIn: ['CANCELED' as const] } },
        orderBy: { id: 'desc' as const },
      },
    };

    const formattedWithDots =
      cleanCpf.length === 11
        ? `${cleanCpf.slice(0, 3)}.${cleanCpf.slice(3, 6)}.${cleanCpf.slice(6, 9)}-${cleanCpf.slice(9)}`
        : rawTrimmed;

    const hashClean = cleanCpf ? hashCpf(cleanCpf) : '';
    // Caso algum registro tenha sido salvo com pontuação no hash
    const hashFormatted = crypto
      .createHmac(
        'sha256',
        process.env.CPF_HASH_SECRET
          ? Buffer.from(process.env.CPF_HASH_SECRET, 'base64').length > 0
            ? Buffer.from(process.env.CPF_HASH_SECRET, 'base64')
            : Buffer.from(process.env.CPF_HASH_SECRET, 'utf8')
          : Buffer.from('default'),
      )
      .update(formattedWithDots)
      .digest('hex');

    let participant = await this.prisma.participants.findFirst({
      where: {
        OR: [
          ...(hashClean ? [{ cpf_hash: hashClean }] : []),
          ...(hashFormatted ? [{ cpf_hash: hashFormatted }] : []),
        ],
      },
      include: includeRelations,
    });

    // Fallback 1: Busca pelos últimos 4 dígitos do CPF e valida via decryptCpf (ignorando pontos, traços e espaços)
    if (!participant && cleanCpf.length >= 4) {
      const last4 = cleanCpf.slice(-4);
      const candidates = await this.prisma.participants.findMany({
        where: {
          cpf_last_digits: last4,
        },
        include: includeRelations,
        orderBy: { id: 'desc' },
      });

      for (const cand of candidates) {
        const decrypted = cand.cpf_encrypted ? decryptCpf(cand.cpf_encrypted) : '';
        const normDecrypted = normalizeCpf(decrypted);
        if (normDecrypted && normDecrypted === cleanCpf) {
          participant = cand;
          break;
        }
      }

      // Se houver exatamente 1 candidato com os mesmos 4 últimos dígitos (ou se o CPF de 11 dígitos bateu os últimos 4 e a chave de criptografia mudou)
      if (!participant && candidates.length === 1 && cleanCpf.length === 11) {
        participant = candidates[0];
      }
    }

    // Fallback 2: Varredura completa descriptografando todos os participantes cadastrados (ultra-rápido para ~200 registros)
    if (!participant && cleanCpf.length === 11) {
      const allParticipants = await this.prisma.participants.findMany({
        include: includeRelations,
        orderBy: { id: 'desc' },
        take: 1000,
      });

      for (const cand of allParticipants) {
        const decrypted = cand.cpf_encrypted ? decryptCpf(cand.cpf_encrypted) : '';
        const normDecrypted = normalizeCpf(decrypted);
        if (normDecrypted && normDecrypted === cleanCpf) {
          participant = cand;
          break;
        }
      }
    }

    // Fallback 3: Caso o usuário tenha digitado o celular ou nome
    if (!participant) {
      const phoneOrNameCandidates = await this.prisma.participants.findMany({
        where: {
          OR: [
            ...(cleanCpf.length >= 8
              ? [
                  { phone_normalized: cleanCpf },
                  { phone: { contains: cleanCpf } },
                ]
              : []),
            ...(rawTrimmed.length >= 3 && /[a-zA-Z]/.test(rawTrimmed)
              ? [{ full_name: { contains: rawTrimmed } }]
              : []),
          ],
        },
        include: includeRelations,
        orderBy: { id: 'desc' },
      });

      if (phoneOrNameCandidates.length > 0) {
        participant = phoneOrNameCandidates[0];
      }
    }

    if (!participant) {
      return { found: false };
    }

    let latestParticipation = participant.participations?.[0];

    // Se o participante já tem cadastro mas não possui participação neste evento específico,
    // reutiliza a participação de outro evento ou auto-cria para este evento
    if (!latestParticipation) {
      const anyParticipation = await this.prisma.participations.findFirst({
        where: { participant_id: participant.id },
        include: {
          draws: { include: { prizes: true } },
          vip_codes: true,
        },
        orderBy: { id: 'desc' },
      });

      if (anyParticipation) {
        latestParticipation = anyParticipation;
      } else {
        latestParticipation = await this.prisma.participations.create({
          data: {
            event_id: eventId,
            participant_id: participant.id,
            status: 'APPROVED',
          },
          include: {
            draws: { include: { prizes: true } },
            vip_codes: true,
          },
        });
      }
    }

    const hasMeeting = (participant.meetings && participant.meetings.length > 0) || false;
    const isVip = Boolean(latestParticipation?.vip_codes) || hasMeeting;
    const hasDrawn = Boolean(latestParticipation?.draws);

    return {
      found: true,
      participantId: participant.id,
      participationId: latestParticipation.id,
      fullName: participant.full_name,
      phone: participant.phone,
      email: participant.email?.includes('@visitante.') ? '' : (participant.email || ''),
      clinicName: participant.clinic_name,
      croNumber: participant.cro_number,
      croState: participant.cro_state,
      isVip,
      hasDrawn,
      hasScheduledMeeting: hasMeeting,
      scheduledMeeting: hasMeeting ? participant.meetings[0] : null,
      drawnPrize: latestParticipation?.draws?.prizes?.name || null,
    };
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

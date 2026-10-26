import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { eventClosedEvents } from '../common/domain-events';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import {
  assertRoutableSlug,
  eventSettingsData,
  PRIVATE_EVENT_FIELDS,
} from './event-settings';

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateEventDto) {
    assertRoutableSlug(dto.slug);

    const existing = await this.prisma.events.findUnique({
      where: {
        slug: dto.slug,
      },
    });

    if (existing) {
      throw new ConflictException('Já existe um evento com este slug.');
    }

    return this.prisma.$transaction(async (tx) => {
      const event = await tx.events.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          description: dto.description ?? null,
          status: dto.status ?? 'DRAFT',
          starts_at: dto.startsAt ? new Date(dto.startsAt) : null,
          ends_at: dto.endsAt ? new Date(dto.endsAt) : null,
          participation_enabled: dto.participationEnabled ?? false,
          whatsapp_message:
            'Olá! Confirme sua participação no evento [LINK_VALIDACAO] e junte-se a nós: [LINK_CANAL]',
          whatsapp_channel_link: 'https://whatsapp.com/channel/...',
          ...eventSettingsData(dto),
        },
      });

      await tx.fraud_rules.createMany({
        data: [
          {
            event_id: event.id,
            type: 'CPF',
            enabled: true,
            max_allowed: 1,
            action: 'BLOCK',
            description: 'Uma participação por CPF.',
          },
          {
            event_id: event.id,
            type: 'PHONE',
            enabled: true,
            max_allowed: 1,
            action: 'BLOCK',
            description: 'Uma participação por telefone.',
          },
          {
            event_id: event.id,
            type: 'EMAIL',
            enabled: true,
            max_allowed: 1,
            action: 'BLOCK',
            description: 'Uma participação por e-mail.',
          },
          {
            event_id: event.id,
            type: 'DEVICE',
            enabled: true,
            max_allowed: 2,
            action: 'REVIEW',
            description: 'Até duas participações por dispositivo.',
          },
          {
            event_id: event.id,
            type: 'IP',
            enabled: true,
            max_allowed: 20,
            action: 'ALLOW_WITH_ALERT',
            description: 'IP compartilhado permitido até o limite configurado.',
          },
        ],
      });

      return tx.events.findUnique({
        where: {
          id: event.id,
        },
        include: {
          fraud_rules: true,
        },
      });
    });
  }

  // Rota pública (cadastro/telão usam): sem telefone de alerta nem webhook.
  async findAll() {
    return this.prisma.events.findMany({
      omit: PRIVATE_EVENT_FIELDS,
      orderBy: {
        created_at: 'desc',
      },
      include: {
        fraud_rules: true,
        _count: {
          select: {
            event_participants: true,
            participations: true,
            prizes: true,
          },
        },
      },
    });
  }

  async findOne(id: number) {
    const event = await this.prisma.events.findUnique({
      where: {
        id,
      },
      include: {
        fraud_rules: true,
        prizes: true,
        _count: {
          select: {
            event_participants: true,
            participations: true,
            fraud_checks: true,
            prizes: true,
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundException('Evento não encontrado.');
    }

    return event;
  }

  async update(id: number, dto: UpdateEventDto) {
    const current = await this.findOne(id);

    if (dto.slug !== current.slug) assertRoutableSlug(dto.slug);
    const closing = dto.status === 'CLOSED' && current.status !== 'CLOSED';

    if (dto.slug) {
      const sameSlug = await this.prisma.events.findFirst({
        where: {
          slug: dto.slug,
          NOT: {
            id,
          },
        },
      });

      if (sameSlug) {
        throw new ConflictException('Já existe um evento com este slug.');
      }
    }

    const updated = await this.prisma.events.update({
      where: {
        id,
      },
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        status: dto.status,
        starts_at: dto.startsAt ? new Date(dto.startsAt) : undefined,
        ends_at: dto.endsAt ? new Date(dto.endsAt) : undefined,
        participation_enabled: dto.participationEnabled,
        whatsapp_message: dto.whatsappMessage,
        whatsapp_prize_message: dto.whatsappPrizeMessage,
        whatsapp_resend_message: dto.whatsappResendMessage,
        whatsapp_vip_message: dto.whatsappVipMessage,
        whatsapp_channel_link: dto.whatsappChannelLink,
        ...eventSettingsData(dto),
      },
      include: {
        fraud_rules: true,
      },
    });

    if (closing) eventClosedEvents.next(id);

    return updated;
  }

  async remove(id: number) {
    await this.findOne(id);

    return this.prisma.events.delete({
      where: {
        id,
      },
    });
  }
}

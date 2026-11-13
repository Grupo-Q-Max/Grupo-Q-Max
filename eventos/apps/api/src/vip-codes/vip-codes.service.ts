import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import { generateVipCode, normalizeVipCode } from './vip-code';

@Injectable()
export class VipCodesService {
  constructor(private readonly prisma: PrismaService) {}

  async generate(eventId: number, quantity: number) {
    await this.ensureEvent(eventId);

    let created = 0;

    // Colisão é rara (31^8 combinações); skipDuplicates descarta e o laço completa o lote.
    while (created < quantity) {
      const batch = Array.from({ length: quantity - created }, () => ({
        event_id: eventId,
        code: generateVipCode(),
      }));

      const result = await this.prisma.vip_codes.createMany({
        data: batch,
        skipDuplicates: true,
      });

      created += result.count;
    }

    return { eventId, created };
  }

  async findByEvent(eventId: number) {
    await this.ensureEvent(eventId);

    const codes = await this.prisma.vip_codes.findMany({
      where: { event_id: eventId },
      orderBy: { id: 'asc' },
      include: {
        participations: {
          select: {
            id: true,
            status: true,
            participants: { select: { full_name: true } },
            draws: { select: { prizes: { select: { name: true } } } },
          },
        },
      },
    });

    const used = codes.filter((code) => code.participation_id !== null).length;

    return {
      eventId,
      total: codes.length,
      used,
      available: codes.length - used,

      codes: codes.map((code) => ({
        id: code.id,
        code: code.code,
        createdAt: code.created_at,
        redeemedAt: code.redeemed_at,
        participationId: code.participation_id,
        participantName: code.participations?.participants.full_name ?? null,
        prizeName: code.participations?.draws?.prizes.name ?? null,
      })),
    };
  }

  async validateCode(eventId: number, rawCode: string) {
    await this.ensureEvent(eventId);
    const code = normalizeVipCode(rawCode);
    if (!code) {
      return { valid: false, message: 'Código VIP vazio.' };
    }

    const vipRecord = await this.prisma.vip_codes.findFirst({
      where: {
        event_id: eventId,
        code: code,
      },
      select: {
        id: true,
        code: true,
        participation_id: true,
      },
    });

    if (!vipRecord) {
      return { valid: false, message: 'Código VIP não encontrado.' };
    }

    if (vipRecord.participation_id !== null) {
      return { valid: false, message: 'Este código VIP já foi utilizado.' };
    }

    return { valid: true, code: vipRecord.code, message: 'Código VIP válido!' };
  }

  private async ensureEvent(eventId: number) {
    const event = await this.prisma.events.findUnique({
      where: { id: eventId },
      select: { id: true },
    });

    if (!event) {
      throw new NotFoundException('Evento não encontrado.');
    }
  }
}

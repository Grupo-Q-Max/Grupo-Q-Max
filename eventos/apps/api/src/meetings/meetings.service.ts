import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { notifyLive } from '../live/live';
import { sendMeetingInvite } from './meeting-mail.helper';

@Injectable()
export class MeetingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappService: WhatsappService,
  ) {}

  async getAvailableSlots(eventId: number, dateString: string) {
    // Retorna horários disponíveis das 08:00 às 17:30
    const startDate = new Date(`${dateString}T00:00:00.000-03:00`);
    if (isNaN(startDate.getTime())) {
      throw new BadRequestException('Formato de data inválido. Use YYYY-MM-DD');
    }

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);

    const existingMeetings = await this.prisma.meetings.findMany({
      where: {
        event_id: eventId,
        scheduled_at: {
          gte: startDate,
          lt: endDate,
        },
        status: { notIn: ['CANCELED'] },
      },
    });

    const takenTimes = existingMeetings.map((m) => m.scheduled_at.toISOString());

    const slots: Date[] = [];
    for (let hour = 8; hour < 18; hour++) {
      for (const min of ['00', '30']) {
        const hStr = hour.toString().padStart(2, '0');
        const isoStr = `${dateString}T${hStr}:${min}:00.000-03:00`;
        slots.push(new Date(isoStr));
      }
    }

    const now = new Date();
    const availableSlots = slots.filter((slot) => {
      if (slot <= now) return false;
      return !takenTimes.includes(slot.toISOString());
    });

    return availableSlots.map((s) => s.toISOString());
  }

  async getNextAvailableSlot(eventId: number, maxDaysAhead: number = 5): Promise<string | null> {
    const today = new Date();
    for (let dayOffset = 0; dayOffset < maxDaysAhead; dayOffset++) {
      const targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() + dayOffset);
      const dateString = targetDate.toISOString().split('T')[0];
      const slots = await this.getAvailableSlots(eventId, dateString);
      if (slots && slots.length > 0) {
        return slots[0];
      }
    }
    return null;
  }

  async bookMeeting(eventId: number, participantId: number, scheduledAtIso: string) {
    const scheduledAt = new Date(scheduledAtIso);
    if (isNaN(scheduledAt.getTime())) {
      throw new BadRequestException('Horário inválido.');
    }

    if (scheduledAt <= new Date()) {
      throw new BadRequestException('Não é possível agendar no passado.');
    }

    try {
      const meeting = await this.prisma.meetings.create({
        data: {
          event_id: eventId,
          participant_id: participantId,
          scheduled_at: scheduledAt,
        },
        include: {
          participants: true,
          events: true,
        },
      });

      const phone = meeting.participants.phone;
      const firstName = meeting.participants.full_name.split(' ')[0];
      const dateFormatted = scheduledAt.toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        dateStyle: 'short',
        timeStyle: 'short',
      });

      let vipMessageTemplate = meeting.events.whatsapp_vip_message?.trim();
      if (!vipMessageTemplate) {
        vipMessageTemplate = `{Oieee|Oii|Oi|Olá|Fala} {nome}! {Tudo bem?|Tudo joia?|Como você tá?} {Aqui é da Finora!|Aqui é a equipe da Finora!|Passando pra avisar que} seu *Cofre VIP* foi destravado e sua consultoria {VIP |}está confirmada para {data_hora}! {🎉|🚀|✨|😁}\n\n{Lembre-se de|Não esquece de|A gente te espera lá pra} comparecer no horário para {garantir|resgatar|pegar} seu bônus especial. {Aguardamos você!|Te esperamos!|Um abraço!}`;
      }

      const finalVipMsg = vipMessageTemplate
        .replace(/\{nome\}/gi, firstName)
        .replace(/\[NOME\]/gi, firstName)
        .replace(/\{data_hora\}/gi, dateFormatted)
        .replace(/\[DATA_HORA\]/gi, dateFormatted);

      // 1. Confirmação Imediata com Spintax Profundo Anti-Ban
      await this.queueMessage(
        eventId,
        participantId,
        phone,
        finalVipMsg,
        new Date(),
      );

      // 2. Lembrete 24h antes
      const reminder24h = new Date(scheduledAt.getTime() - 24 * 60 * 60 * 1000);
      if (reminder24h > new Date()) {
        await this.queueMessage(
          eventId,
          participantId,
          phone,
          `{Passando para lembrar que|Oi ${firstName}, só pra avisar que|Lembrete especial:} nossa consultoria financeira VIP é amanhã, ${dateFormatted}! {Já deixamos tudo preparado|Tudo certo} para alavancar a sua clínica. {🚀|💼|📈}`,
          reminder24h,
        );
      }

      // 3. Lembrete 1h antes
      const reminder1h = new Date(scheduledAt.getTime() - 60 * 60 * 1000);
      if (reminder1h > new Date()) {
        await this.queueMessage(
          eventId,
          participantId,
          phone,
          `{Falta apenas|Falta só} 1 hora para o nosso papo! {⏳|⏰} Te esperamos às ${dateFormatted}. Se tiver algum imprevisto, {por favor avise aqui|pode nos avisar por aqui}.`,
          reminder1h,
        );
      }

      // 4. Marca a participação como VIP para destravar a Roleta VIP automaticamente
      await this.prisma.participations.updateMany({
        where: {
          participant_id: participantId,
          event_id: eventId,
        },
        data: {
          vip: true,
        },
      });

      // 5. Dispara convite de calendário oficial do Outlook (.ics) para o chefe Hugo
      sendMeetingInvite({
        meetingId: meeting.id,
        scheduledAt,
        participant: {
          fullName: meeting.participants.full_name,
          email: meeting.participants.email,
          phone: meeting.participants.phone,
          clinicName: meeting.participants.clinic_name,
          croNumber: meeting.participants.cro_number,
          croState: meeting.participants.cro_state,
          chairsCount: meeting.participants.chairs_count,
        },
        bossEmail: process.env.BOSS_MEETING_EMAIL || 'hugo@grupoqmax.com.br',
      }).catch((err) => {
        console.warn('[MeetingsService] Falha ao enviar convite por e-mail:', err.message);
      });

      notifyLive(eventId);
      return meeting;
    } catch (e: any) {
      if (e.code === 'P2002') {
        throw new ConflictException('Poxa, esse horário acabou de ser reservado por outra pessoa. Por favor, escolha outro.');
      }
      throw e;
    }
  }

  private async queueMessage(
    eventId: number,
    participantId: number,
    phone: string,
    message: string,
    nextAttemptAt: Date,
  ) {
    if (process.env.DISABLE_WHATSAPP === 'true') {
      return;
    }

    const finalMessage = this.whatsappService.parseSpintax(message);

    await this.prisma.message_queue.create({
      data: {
        event_id: eventId,
        participant_id: participantId,
        phone,
        message: finalMessage,
        status: 'PENDING',
        next_attempt_at: nextAttemptAt,
      },
    });
  }

  async getAgendaByEvent(eventId: number, dateString: string) {
    const startDate = new Date(`${dateString}T00:00:00.000-03:00`);
    if (isNaN(startDate.getTime())) {
      throw new BadRequestException('Formato de data inválido. Use YYYY-MM-DD');
    }

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);

    const meetings = await this.prisma.meetings.findMany({
      where: {
        event_id: eventId,
        scheduled_at: {
          gte: startDate,
          lt: endDate,
        },
      },
      include: {
        participants: {
          select: {
            id: true,
            full_name: true,
            phone: true,
            email: true,
            clinic_name: true,
            cro_number: true,
            cro_state: true,
            chairs_count: true,
          }
        }
      },
      orderBy: {
        scheduled_at: 'asc',
      },
    });

    return meetings;
  }

  async updateMeetingStatus(meetingId: number, status: 'COMPLETED' | 'NO_SHOW' | 'CANCELED') {
    const meeting = await this.prisma.meetings.update({
      where: { id: meetingId },
      data: { status },
      include: {
        participants: {
          select: {
            id: true,
            full_name: true,
            phone: true,
          }
        }
      }
    });

    if (status === 'COMPLETED') {
      const firstName = meeting.participants.full_name.split(' ')[0];
      const csatDelay = new Date();
      csatDelay.setMinutes(csatDelay.getMinutes() + 15);

      await this.queueMessage(
        meeting.event_id,
        meeting.participants.id,
        meeting.participants.phone,
        `{Oieee|Oii|Oi|Olá} ${firstName}, {tudo bem?|tudo joia?}\n\nFoi {ótimo|um prazer} receber você no nosso estande da Finora hoje! {🤩|✨}\nPara liberar seu {bônus especial|presente extra} de fechamento na feira, nos avalie respondendo essa mensagem com uma nota de *1 a 5* sobre como foi nosso papo!\n\n*(1 = Ruim, 5 = Excelente)*`,
        csatDelay,
      );
    }

    return meeting;
  }
}

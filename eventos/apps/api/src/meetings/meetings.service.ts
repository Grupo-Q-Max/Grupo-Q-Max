import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { notifyLive } from '../live/live';
import { sendMeetingInvite } from './meeting-mail.helper';
import {
  getHugoBusyIntervals,
  createMicrosoftCalendarEvent,
  getHugoDetailedEvents,
  deleteMicrosoftEventsMatching,
} from './microsoft-calendar.helper';

@Injectable()
export class MeetingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappService: WhatsappService,
  ) {}

  async getAvailableSlots(eventId: number, dateString: string) {
    // Bloqueia dias anteriores a 22/11/2026 e posteriores a 28/02/2027
    if (dateString < '2026-11-22' || dateString > '2027-02-28') {
      return [];
    }

    const startDate = new Date(`${dateString}T00:00:00.000-03:00`);
    if (isNaN(startDate.getTime())) {
      throw new BadRequestException('Formato de data inválido. Use YYYY-MM-DD');
    }

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);

    // 1. Horários já ocupados no banco de dados por QUALQUER agendamento do site
    // (mesmo que o Hugo ainda não tenha aceitado o convite no Outlook, já bloqueia imediatamente!)
    const existingMeetings = await this.prisma.meetings.findMany({
      where: {
        scheduled_at: {
          gte: startDate,
          lt: endDate,
        },
        status: { notIn: ['CANCELED'] },
      },
    });

    // 2. Consulta 100% em tempo real na agenda do Hugo no Microsoft 365 (Graph API: calendarView + getSchedule)
    // Traz todos os eventos, incluindo convites e reuniões que ele AINDA NÃO ACEITOU no Outlook!
    const hugoBusyIntervals = await getHugoBusyIntervals(dateString);

    const slots: Date[] = [];
    // Agenda aberta o dia todo das 08h às 19h (Horário de Brasília), com duração de 45 min
    for (let hour = 8; hour <= 19; hour++) {
      const hStr = hour.toString().padStart(2, '0');
      const isoStr = `${dateString}T${hStr}:00:00.000-03:00`;
      slots.push(new Date(isoStr));
    }

    const now = new Date();
    const availableSlots = slots.filter((slot) => {
      if (slot <= now) return false;

      const slotStart = slot.getTime();
      const slotEnd = slotStart + 45 * 60 * 1000;

      // 1. Bloqueia se colidir com qualquer agendamento do site (intervalo de 45 minutos)
      const collidesWithSiteMeeting = existingMeetings.some((m) => {
        const mStart = m.scheduled_at.getTime();
        const mEnd = mStart + 45 * 60 * 1000;
        return slotStart < mEnd && slotEnd > mStart;
      });
      if (collidesWithSiteMeeting) return false;

      // 2. Bloqueia se houver conflito com qualquer evento na agenda do Hugo no Microsoft 365 (mesmo não aceito ainda)
      const collidesWithHugo = hugoBusyIntervals.some((busy) => {
        const busyStart = busy.start.getTime();
        const busyEnd = busy.end.getTime();
        return slotStart < busyEnd && slotEnd > busyStart;
      });
      if (collidesWithHugo) return false;

      return true;
    });

    return availableSlots.map((s) => s.toISOString());
  }

  async getNextAvailableSlot(eventId: number, maxDaysAhead: number = 100): Promise<string | null> {
    const today = new Date();
    const minDate = new Date(2026, 10, 22, 0, 0, 0, 0);
    const start = today < minDate ? minDate : today;

    for (let dayOffset = 0; dayOffset < maxDaysAhead; dayOffset++) {
      const targetDate = new Date(start);
      targetDate.setDate(targetDate.getDate() + dayOffset);
      const dateString = targetDate.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
      if (dateString < '2026-11-22' || dateString > '2027-02-28') continue;
      const slots = await this.getAvailableSlots(eventId, dateString);
      if (slots && slots.length > 0) {
        return slots[0];
      }
    }
    return null;
  }

  async bookMeeting(eventId: number, participantId: number, scheduledAtIso: string, meetingEmail?: string) {
    const scheduledAt = new Date(scheduledAtIso);
    if (isNaN(scheduledAt.getTime())) {
      throw new BadRequestException('Horário inválido.');
    }

    if (scheduledAt <= new Date()) {
      throw new BadRequestException('Não é possível agendar no passado.');
    }

    // Bloqueia dias anteriores a 22/11/2026 e posteriores a 28/02/2027
    const dateSp = scheduledAt.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    if (dateSp < '2026-11-22' || dateSp > '2027-02-28') {
      throw new BadRequestException('A agenda para consultorias estratégicas está aberta de 22/11/2026 até 28/02/2027.');
    }

    // Validação do horário no fuso América/São Paulo (08h às 19h)
    const hourSp = Number(
      scheduledAt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }),
    );
    if (hourSp < 8 || hourSp > 19) {
      throw new BadRequestException('Horário fora do expediente da agenda (08h às 19h).');
    }

    // 1. Bloqueio rigoroso: verifica se já existe agendamento ativo no banco de dados para esse horário (mesmo antes do aceite)
    const slotStart = scheduledAt.getTime();
    const slotEnd = slotStart + 45 * 60 * 1000;

    const existingDbMeeting = await this.prisma.meetings.findFirst({
      where: {
        scheduled_at: {
          gte: new Date(slotStart - 44 * 60 * 1000),
          lte: new Date(slotStart + 44 * 60 * 1000),
        },
        status: { notIn: ['CANCELED'] },
      },
    });
    if (existingDbMeeting) {
      throw new ConflictException('Este horário já acabou de ser reservado no site.');
    }

    // 2. Bloqueio rigoroso: verifica se colide com algum compromisso na agenda do Hugo no Microsoft 365 (mesmo que ele ainda não tenha aceitado)
    const dateStr = scheduledAt.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    const busyIntervals = await getHugoBusyIntervals(dateStr);
    const collidesWithHugo = busyIntervals.some((busy) => {
      return slotStart < busy.end.getTime() && slotEnd > busy.start.getTime();
    });
    if (collidesWithHugo) {
      throw new ConflictException('Este horário já está ocupado na agenda executiva de reuniões.');
    }

    try {
      const cleanMeetingEmail = meetingEmail?.trim();
      if (cleanMeetingEmail) {
        await this.prisma.participants.update({
          where: { id: participantId },
          data: { email: cleanMeetingEmail, email_normalized: cleanMeetingEmail.toLowerCase() },
        }).catch(() => {});
      }

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

      // 4. Cria evento 100% automático no calendário do Hugo no Microsoft 365 (Teams)
      try {
        const graphEventId = await createMicrosoftCalendarEvent({
          bossEmail: process.env.BOSS_MEETING_EMAIL || 'hugo@grupoqmax.com.br',
          secondEmail: process.env.SECOND_MEETING_EMAIL || 'rodrigo@grupoqmax.com.br',
          thirdEmail: process.env.THIRD_MEETING_EMAIL || 'edvaldo.borges@grupoqmax.com.br',
          participantName: meeting.participants.full_name,
          participantEmail: cleanMeetingEmail || meeting.participants.email,
          phone: meeting.participants.phone,
          clinicName: meeting.participants.clinic_name,
          chairsCount: meeting.participants.chairs_count,
          croNumber: meeting.participants.cro_number,
          croState: meeting.participants.cro_state,
          scheduledAt,
          durationMinutes: 45,
        });
        if (graphEventId) {
          console.log('[MeetingsService] Evento criado no Teams/Outlook com ID:', graphEventId);
        }
      } catch (err: any) {
        console.warn('[MeetingsService] Falha ao criar evento no Microsoft Graph:', err.message);
      }

      // 5. Dispara convite de calendário oficial do Outlook (.ics) para o chefe Hugo, Rodrigo e Edvaldo
      try {
        await sendMeetingInvite({
          meetingId: meeting.id,
          scheduledAt,
          participant: {
            fullName: meeting.participants.full_name,
            email: cleanMeetingEmail || meeting.participants.email,
            phone: meeting.participants.phone,
            clinicName: meeting.participants.clinic_name,
            croNumber: meeting.participants.cro_number,
            croState: meeting.participants.cro_state,
            chairsCount: meeting.participants.chairs_count,
          },
          bossEmail: process.env.BOSS_MEETING_EMAIL || 'hugo@grupoqmax.com.br',
          secondEmail: process.env.SECOND_MEETING_EMAIL || 'rodrigo@grupoqmax.com.br',
          thirdEmail: process.env.THIRD_MEETING_EMAIL || 'edvaldo.borges@grupoqmax.com.br',
        });
      } catch (err: any) {
        console.warn('[MeetingsService] Falha ao enviar convite por e-mail:', err.message);
      }

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

  async getAgendaByEvent(eventId: number, dateString?: string) {
    let siteMeetingsWhere: any = {
      event_id: eventId,
    };

    let msStartDate = '2026-11-18';
    let msEndDate = '2027-01-31';

    if (dateString && dateString.toUpperCase() !== 'ALL' && dateString.trim() !== '') {
      const startDate = new Date(`${dateString}T00:00:00.000-03:00`);
      if (!isNaN(startDate.getTime())) {
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 1);
        siteMeetingsWhere.scheduled_at = {
          gte: startDate,
          lt: endDate,
        };
        msStartDate = dateString;
        msEndDate = dateString;
      }
    } else {
      // Sem filtro de dia: traz todos os agendamentos até o final de Janeiro de 2027
      siteMeetingsWhere.scheduled_at = {
        gte: new Date('2026-11-01T00:00:00.000-03:00'),
        lte: new Date('2027-01-31T23:59:59.000-03:00'),
      };
    }

    // 1. Reuniões gravadas no banco de dados local
    const siteMeetings = await this.prisma.meetings.findMany({
      where: siteMeetingsWhere,
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
          },
        },
      },
      orderBy: {
        scheduled_at: 'asc',
      },
    });

    // 2. Compromissos e reuniões do Hugo puxados 100% em tempo real do Microsoft 365 (Teams / Outlook) até janeiro
    const msEvents = await getHugoDetailedEvents(msStartDate, msEndDate);

    // Formata os agendamentos do site
    const formattedSiteMeetings = siteMeetings.map((m) => ({
      id: m.id,
      source: 'FINORA' as const,
      isMicrosoft: false,
      scheduled_at: m.scheduled_at.toISOString(),
      status: m.status,
      participants: m.participants,
    }));

    // Formata e adiciona os eventos do Microsoft 365 (evitando duplicar reuniões que o site acabou de criar)
    const formattedMsEvents = msEvents
      .filter((evt) => {
        const evtTime = new Date(evt.scheduled_at).getTime();
        if (isNaN(evtTime)) return false;
        // Se já existe agendamento do site no mesmo horário (diferença < 2 min), evita duplicata
        return !siteMeetings.some((sm) => Math.abs(sm.scheduled_at.getTime() - evtTime) < 2 * 60 * 1000);
      })
      .map((evt, idx) => ({
        id: `ms-${evt.id || idx}`,
        source: 'MICROSOFT_365' as const,
        isMicrosoft: true,
        scheduled_at: evt.scheduled_at,
        end_at: evt.end_at,
        status: 'SCHEDULED' as const,
        subject: evt.subject,
        location: evt.location,
        teamsUrl: evt.teamsUrl,
        webLink: evt.webLink,
        organizerName: evt.organizerName,
        organizerEmail: evt.organizerEmail,
        msResponse: evt.response,
        msShowAs: evt.showAs,
        participants: {
          id: 0,
          full_name: evt.subject,
          phone: '',
          email: evt.organizerEmail || 'hugo@grupoqmax.com.br',
          clinic_name: evt.location || 'Microsoft Outlook / Teams',
          cro_number: null,
          cro_state: null,
          chairs_count: null,
        },
      }));

    // Retorna todos os agendamentos consolidados e ordenados por horário
    return [...formattedSiteMeetings, ...formattedMsEvents].sort(
      (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime(),
    );
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

  async deleteMeeting(meetingId: number) {
    const meeting = await this.prisma.meetings.findUnique({
      where: { id: meetingId },
      include: {
        participants: true,
      },
    });

    if (!meeting) {
      throw new NotFoundException('Reunião não encontrada.');
    }

    // 1. Cancela mensagens agendadas de lembrete pendentes no WhatsApp
    await this.prisma.message_queue.deleteMany({
      where: {
        event_id: meeting.event_id,
        participant_id: meeting.participant_id,
        status: 'PENDING',
      },
    }).catch(() => {});

    // 2. Remove do banco de dados
    await this.prisma.meetings.delete({
      where: { id: meetingId },
    });

    // 3. Remove evento correspondente da agenda do Hugo no Microsoft Teams/Outlook (assíncrono)
    if (meeting.participants?.full_name) {
      deleteMicrosoftEventsMatching({
        searchTerm: meeting.participants.full_name,
      }).catch((err) => console.warn('[MeetingsService] Falha ao deletar evento Teams:', err.message));
    }

    return { success: true, message: 'Reunião excluída com sucesso.' };
  }

  async deleteAllSiteMeetings(eventId: number) {
    const meetings = await this.prisma.meetings.findMany({
      where: { event_id: eventId },
      include: { participants: true },
    });

    if (meetings.length === 0) {
      return { success: true, count: 0, message: 'Nenhuma reunião agendada pelo site para excluir.' };
    }

    const participantIds = meetings.map((m) => m.participant_id);

    // 1. Remove mensagens de lembrete pendentes no WhatsApp
    await this.prisma.message_queue.deleteMany({
      where: {
        event_id: eventId,
        participant_id: { in: participantIds },
        status: 'PENDING',
      },
    }).catch(() => {});

    // 2. Remove todas as reuniões do site deste evento
    const result = await this.prisma.meetings.deleteMany({
      where: { event_id: eventId },
    });

    // 3. Remove todos os eventos agendados pelo Finora no calendário do Hugo no Microsoft Teams/Outlook
    deleteMicrosoftEventsMatching({
      searchTerm: '[Reunião Estratégica] Hugo Werninghaus',
    }).catch((err) => console.warn('[MeetingsService] Falha ao deletar eventos em massa no Teams:', err.message));

    return {
      success: true,
      count: result.count,
      message: `${result.count} reunião(ões) agendada(s) pelo site excluída(s) com sucesso.`,
    };
  }
}

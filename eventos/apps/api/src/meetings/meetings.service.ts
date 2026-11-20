import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { notifyLive } from '../live/live';
import { sendMeetingInvite } from './meeting-mail.helper';
import { decryptCpf, formatCpf } from '../security/cpf-security';
import {
  getHugoBusyIntervals,
  createMicrosoftCalendarEvent,
  getHugoDetailedEvents,
  deleteMicrosoftEventsMatching,
  resolveHost,
  getHostProfiles,
} from './microsoft-calendar.helper';

@Injectable()
export class MeetingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappService: WhatsappService,
  ) {}

  async getAvailableSlots(eventId: number, dateString: string, host?: string) {
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

    const hostProfile = resolveHost(host);
    const profiles = getHostProfiles();
    const isAle = hostProfile.key === 'ale';

    // 1. Horários já ocupados no banco de dados por agendamentos do site
    const allDayMeetings = await this.prisma.meetings.findMany({
      where: {
        scheduled_at: {
          gte: startDate,
          lt: endDate,
        },
        status: { notIn: ['CANCELED'] },
      },
    });

    const hugoSiteMeetings = allDayMeetings.filter((m: any) => {
      const mHost = (m.host_email || profiles.hugo.email).toLowerCase();
      return mHost === profiles.hugo.email.toLowerCase();
    });

    const aleSiteMeetings = allDayMeetings.filter((m: any) => {
      const mHost = (m.host_email || '').toLowerCase();
      return mHost === profiles.ale.email.toLowerCase();
    });

    // 2. Consulta em tempo real no Microsoft 365
    // Se for a agenda da Ale, precisamos tanto da agenda do Hugo (para saber onde o Hugo NÃO está livre)
    // quanto da agenda da própria Ale (para garantir que a Ale está livre e travar/ocultar os ocupados dela).
    const [hugoBusyIntervals, aleBusyIntervals] = await Promise.all([
      getHugoBusyIntervals(dateString, profiles.hugo.email),
      isAle ? getHugoBusyIntervals(dateString, profiles.ale.email) : Promise.resolve([]),
    ]);

    const slots: Date[] = [];
    // Agenda aberta o dia todo das 08h às 19h (Horário de Brasília), com duração de 45 min
    for (let hour = 8; hour <= 19; hour++) {
      const hStr = hour.toString().padStart(2, '0');
      const isoStr = `${dateString}T${hStr}:00:00.000-03:00`;
      slots.push(new Date(isoStr));
    }

    const isHugoBusyAtSlot = (slotStart: number, slotEnd: number): boolean => {
      const collidesSite = hugoSiteMeetings.some((m) => {
        const mStart = m.scheduled_at.getTime();
        const mEnd = mStart + 45 * 60 * 1000;
        return slotStart < mEnd && slotEnd > mStart;
      });
      if (collidesSite) return true;

      const collidesMs = hugoBusyIntervals.some((busy) => {
        const busyStart = busy.start.getTime();
        const busyEnd = busy.end.getTime();
        return slotStart < busyEnd && slotEnd > busyStart;
      });
      return collidesMs;
    };

    const isAleBusyAtSlot = (slotStart: number, slotEnd: number): boolean => {
      const collidesSite = aleSiteMeetings.some((m) => {
        const mStart = m.scheduled_at.getTime();
        const mEnd = mStart + 45 * 60 * 1000;
        return slotStart < mEnd && slotEnd > mStart;
      });
      if (collidesSite) return true;

      const collidesMs = aleBusyIntervals.some((busy) => {
        const busyStart = busy.start.getTime();
        const busyEnd = busy.end.getTime();
        return slotStart < busyEnd && slotEnd > busyStart;
      });
      return collidesMs;
    };

    const now = new Date();
    const availableSlots = slots.filter((slot) => {
      if (slot <= now) return false;

      const slotStart = slot.getTime();
      const slotEnd = slotStart + 45 * 60 * 1000;
      const hugoBusy = isHugoBusyAtSlot(slotStart, slotEnd);

      if (!isAle) {
        // Agenda do Hugo: disponível apenas quando o Hugo está livre
        return !hugoBusy;
      }

      // Agenda da Ale: disponível APENAS nos horários em que o Hugo NÃO está livre,
      // e desde que a própria Ale não esteja ocupada no site ou no Microsoft 365!
      if (!hugoBusy) return false;
      const aleBusy = isAleBusyAtSlot(slotStart, slotEnd);
      return !aleBusy;
    });

    return availableSlots.map((s) => s.toISOString());
  }

  async getNextAvailableSlot(eventId: number, maxDaysAhead: number = 100, host?: string): Promise<string | null> {
    const today = new Date();
    const minDate = new Date(2026, 10, 22, 0, 0, 0, 0);
    const start = today < minDate ? minDate : today;

    for (let dayOffset = 0; dayOffset < maxDaysAhead; dayOffset++) {
      const targetDate = new Date(start);
      targetDate.setDate(targetDate.getDate() + dayOffset);
      const dateString = targetDate.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
      if (dateString < '2026-11-22' || dateString > '2027-02-28') continue;
      const slots = await this.getAvailableSlots(eventId, dateString, host);
      if (slots && slots.length > 0) {
        return slots[0];
      }
    }
    return null;
  }

  async bookMeeting(
    eventId: number,
    participantId: number,
    scheduledAtIso: string,
    meetingEmail?: string,
    host?: string,
  ) {
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

    const hostProfile = resolveHost(host);

    // 1. Bloqueio rigoroso: verifica se já existe agendamento ativo no banco de dados para esse horário e esse sócio
    const slotStart = scheduledAt.getTime();
    const slotEnd = slotStart + 45 * 60 * 1000;

    const existingWindowMeetings = await this.prisma.meetings.findMany({
      where: {
        scheduled_at: {
          gte: new Date(slotStart - 44 * 60 * 1000),
          lte: new Date(slotStart + 44 * 60 * 1000),
        },
        status: { notIn: ['CANCELED'] },
      },
    });
    const existingDbMeeting = (existingWindowMeetings || []).find((m: any) => {
      const mHost = (m.host_email || 'hugo@grupoqmax.com.br').toLowerCase();
      return mHost === hostProfile.email.toLowerCase();
    });
    if (existingDbMeeting) {
      throw new ConflictException('Este horário já acabou de ser reservado no site.');
    }

    // 2. Bloqueio rigoroso: verifica se colide com algum compromisso na agenda do sócio no Microsoft 365
    const dateStr = scheduledAt.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    const busyIntervals = await getHugoBusyIntervals(dateStr, hostProfile.email);
    const collidesWithHost = busyIntervals.some((busy) => {
      return slotStart < busy.end.getTime() && slotEnd > busy.start.getTime();
    });
    if (collidesWithHost) {
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
          host_email: hostProfile.email,
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
        vipMessageTemplate = `{Oieee|Oii|Oi|Olá|Fala} {nome}! {Tudo bem?|Tudo joia?|Como você tá?} {Aqui é da Finora!|Aqui é a equipe da Finora!|Passando pra avisar que} seu *Cofre VIP* foi destravado e sua consultoria {VIP |}com *${hostProfile.name}* está confirmada para {data_hora}! {🎉|🚀|✨|😁}\n\n{Lembre-se de|Não esquece de|A gente te espera lá pra} comparecer no horário para {garantir|resgatar|pegar} seu bônus especial. {Aguardamos você!|Te esperamos!|Um abraço!}`;
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
          `{Passando para lembrar que|Oi ${firstName}, só pra avisar que|Lembrete especial:} nossa consultoria financeira VIP com *${hostProfile.name}* é amanhã, ${dateFormatted}! {Já deixamos tudo preparado|Tudo certo} para alavancar a sua clínica. {🚀|💼|📈}`,
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
          `{Falta apenas|Falta só} 1 hora para o nosso papo com *${hostProfile.name}*! {⏳|⏰} Te esperamos às ${dateFormatted}. Se tiver algum imprevisto, {por favor avise aqui|pode nos avisar por aqui}.`,
          reminder1h,
        );
      }

      // 4. Cria evento 100% automático no calendário do sócio selecionado (Hugo ou Ale) no Microsoft 365 (Teams)
      try {
        const graphEventId = await createMicrosoftCalendarEvent({
          bossEmail: hostProfile.email,
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

      // 5. Dispara convite de calendário oficial do Outlook (.ics) para o sócio selecionado (Hugo ou Ale), Rodrigo e Edvaldo
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
          bossEmail: hostProfile.email,
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

  async getAgendaByEvent(eventId: number, dateString?: string, hostFilter?: string) {
    let siteMeetingsWhere: any = {
      event_id: eventId,
    };

    let msStartDate = '2026-11-18';
    let msEndDate = '2027-02-28';

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
      // Sem filtro de dia: traz todos os agendamentos até o final de Fevereiro de 2027
      siteMeetingsWhere.scheduled_at = {
        gte: new Date('2026-11-01T00:00:00.000-03:00'),
        lte: new Date('2027-02-28T23:59:59.000-03:00'),
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
            cpf_encrypted: true,
            cpf_last_digits: true,
            phone: true,
            email: true,
            clinic_name: true,
            cro_number: true,
            cro_state: true,
            chairs_count: true,
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
              orderBy: { id: 'desc' },
            },
          },
        },
      },
      orderBy: {
        scheduled_at: 'asc',
      },
    });

    const profiles = getHostProfiles();
    const filterNorm = (hostFilter || '').trim().toLowerCase();
    const wantHugo = !filterNorm || filterNorm === 'all' || filterNorm.includes('hugo');
    const wantAle = !filterNorm || filterNorm === 'all' || filterNorm.includes('ale');

    // 2. Compromissos e reuniões do Hugo e da Ale puxados 100% em tempo real do Microsoft 365 (Teams / Outlook)
    const [hugoMsEvents, aleMsEvents] = await Promise.all([
      wantHugo ? getHugoDetailedEvents(msStartDate, msEndDate, profiles.hugo.email) : Promise.resolve([]),
      wantAle ? getHugoDetailedEvents(msStartDate, msEndDate, profiles.ale.email) : Promise.resolve([]),
    ]);

    const msEvents = [...hugoMsEvents, ...aleMsEvents];

    // Formata os agendamentos do site
    const formattedSiteMeetings = siteMeetings
      .map((m: any) => {
        const hostProfile = resolveHost(m.host_email || profiles.hugo.email);
        const parts = m.participants?.participations || [];
        const vipPart = parts.find((p: any) => p.draws?.prizes?.is_vip);
        const normalPart = parts.find((p: any) => p.draws && !p.draws.prizes?.is_vip);
        const decryptedCpf = m.participants?.cpf_encrypted ? decryptCpf(m.participants.cpf_encrypted) : '';
        const formattedCpf = decryptedCpf
          ? formatCpf(decryptedCpf)
          : m.participants?.cpf_last_digits
          ? `***.***.***-${m.participants.cpf_last_digits}`
          : '';

        return {
          id: m.id,
          source: 'FINORA' as const,
          isMicrosoft: false,
          scheduled_at: m.scheduled_at.toISOString(),
          status: m.status,
          hostKey: hostProfile.key,
          hostName: hostProfile.name,
          hostEmail: hostProfile.email,
          vipPrize: vipPart?.draws?.prizes
            ? {
                drawId: vipPart.draws.id,
                prizeId: vipPart.draws.prizes.id,
                name: vipPart.draws.prizes.name,
                description: vipPart.draws.prizes.description,
                drawnAt: vipPart.draws.drawn_at,
                claimedAt: vipPart.draws.claimed_at,
              }
            : null,
          normalPrize: normalPart?.draws?.prizes
            ? {
                drawId: normalPart.draws.id,
                prizeId: normalPart.draws.prizes.id,
                name: normalPart.draws.prizes.name,
                description: normalPart.draws.prizes.description,
                drawnAt: normalPart.draws.drawn_at,
                claimedAt: normalPart.draws.claimed_at,
              }
            : null,
          participants: {
            id: m.participants.id,
            full_name: m.participants.full_name,
            cpf: decryptedCpf,
            cpf_formatted: formattedCpf,
            phone: m.participants.phone,
            email: m.participants.email,
            clinic_name: m.participants.clinic_name,
            cro_number: m.participants.cro_number,
            cro_state: m.participants.cro_state,
            chairs_count: m.participants.chairs_count,
          },
        };
      })
      .filter((m) => {
        if (!wantHugo && m.hostKey === 'hugo') return false;
        if (!wantAle && m.hostKey === 'ale') return false;
        return true;
      });

    // Formata e adiciona os eventos do Microsoft 365 (evitando duplicar reuniões que o site acabou de criar para o mesmo sócio)
    const formattedMsEvents = msEvents
      .filter((evt) => {
        const evtTime = new Date(evt.scheduled_at).getTime();
        if (isNaN(evtTime)) return false;
        const evtHost = resolveHost(evt.hostEmail || evt.organizerEmail);
        return !formattedSiteMeetings.some(
          (sm) =>
            sm.hostKey === evtHost.key &&
            Math.abs(new Date(sm.scheduled_at).getTime() - evtTime) < 2 * 60 * 1000,
        );
      })
      .map((evt, idx) => {
        const hostProfile = resolveHost(evt.hostEmail || evt.organizerEmail);
        return {
          id: `ms-${hostProfile.key}-${evt.id || idx}`,
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
          organizerEmail: evt.organizerEmail || hostProfile.email,
          msResponse: evt.response,
          msShowAs: evt.showAs,
          hostKey: hostProfile.key,
          hostName: hostProfile.name,
          hostEmail: hostProfile.email,
          participants: {
            id: 0,
            full_name: evt.subject,
            phone: '',
            email: evt.organizerEmail || hostProfile.email,
            clinic_name: evt.location || 'Microsoft Outlook / Teams',
            cro_number: null,
            cro_state: null,
            chairs_count: null,
          },
        };
      });

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

    // 3. Remove evento correspondente da agenda do sócio (Hugo ou Ale) no Microsoft Teams/Outlook (assíncrono)
    if (meeting.participants?.full_name) {
      const targetEmail = (meeting as any).host_email || 'hugo@grupoqmax.com.br';
      deleteMicrosoftEventsMatching({
        bossEmail: targetEmail,
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

    // 3. Remove todos os eventos agendados pelo Finora nos calendários do Hugo e da Ale no Microsoft Teams/Outlook
    const profiles = getHostProfiles();
    deleteMicrosoftEventsMatching({
      bossEmail: profiles.hugo.email,
      searchTerm: '[Reunião Estratégica]',
    }).catch((err) => console.warn('[MeetingsService] Falha ao deletar eventos em massa no Teams (Hugo):', err.message));
    deleteMicrosoftEventsMatching({
      bossEmail: profiles.ale.email,
      searchTerm: '[Reunião Estratégica]',
    }).catch((err) => console.warn('[MeetingsService] Falha ao deletar eventos em massa no Teams (Ale):', err.message));

    return {
      success: true,
      count: result.count,
      message: `${result.count} reunião(ões) agendada(s) pelo site excluída(s) com sucesso.`,
    };
  }

  /**
   * Lista todas as pessoas que marcaram agenda (e também qualquer participante que ganhou recompensa na Roleta VIP)
   * cruzando dados de contato, CPF, horário da reunião, sócio e recompensas conquistadas (Roleta VIP e Roleta Normal).
   */
  async getVipRewardsByEvent(eventId: number) {
    const profiles = getHostProfiles();

    const [meetings, vipParticipations] = await Promise.all([
      this.prisma.meetings.findMany({
        where: {
          event_id: eventId,
          status: { notIn: ['CANCELED'] },
        },
        include: {
          participants: {
            include: {
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
                orderBy: { id: 'desc' },
              },
            },
          },
        },
        orderBy: { scheduled_at: 'asc' },
      }),
      this.prisma.participations.findMany({
        where: {
          event_id: eventId,
          OR: [
            { draws: { is: { prizes: { is_vip: true } } } },
            { vip_codes: { isNot: null } },
          ],
        },
        include: {
          participants: {
            include: {
              meetings: {
                where: {
                  event_id: eventId,
                  status: { notIn: ['CANCELED'] },
                },
                orderBy: { scheduled_at: 'asc' },
              },
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
                orderBy: { id: 'desc' },
              },
            },
          },
        },
        orderBy: { id: 'desc' },
      }),
    ]);

    const itemsByParticipantId = new Map<number, any>();

    const formatParticipantRow = (participant: any, meetingRecord: any | null) => {
      const parts = participant.participations || [];
      const vipPart = parts.find((p: any) => p.draws?.prizes?.is_vip);
      const normalPart = parts.find((p: any) => p.draws && !p.draws.prizes?.is_vip);
      const vipCodePart = parts.find((p: any) => p.vip_codes);
      const decryptedCpf = participant.cpf_encrypted ? decryptCpf(participant.cpf_encrypted) : '';
      const formattedCpf = decryptedCpf
        ? formatCpf(decryptedCpf)
        : participant.cpf_last_digits
        ? `***.***.***-${participant.cpf_last_digits}`
        : '';

      const hostProfile = meetingRecord
        ? resolveHost(meetingRecord.host_email || profiles.hugo.email)
        : null;

      return {
        participantId: participant.id,
        fullName: participant.full_name,
        cpf: decryptedCpf,
        cpfFormatted: formattedCpf,
        phone: participant.phone,
        email: participant.email?.includes('@visitante.') ? '' : participant.email || '',
        clinicName: participant.clinic_name || 'Clínica não informada',
        croNumber: participant.cro_number,
        croState: participant.cro_state,
        chairsCount: participant.chairs_count,
        vipCode: vipCodePart?.vip_codes?.code || null,
        hasMeeting: Boolean(meetingRecord),
        meeting: meetingRecord
          ? {
              id: meetingRecord.id,
              scheduledAt: meetingRecord.scheduled_at.toISOString(),
              status: meetingRecord.status,
              hostKey: hostProfile?.key || 'hugo',
              hostName: hostProfile?.name || 'Hugo Werninghaus',
              hostEmail: hostProfile?.email || 'hugo@grupoqmax.com.br',
            }
          : null,
        vipPrize: vipPart?.draws?.prizes
          ? {
              drawId: vipPart.draws.id,
              participationId: vipPart.id,
              prizeId: vipPart.draws.prizes.id,
              name: vipPart.draws.prizes.name,
              description: vipPart.draws.prizes.description,
              drawnAt: vipPart.draws.drawn_at,
              claimedAt: vipPart.draws.claimed_at,
              isDelivered: Boolean(vipPart.draws.claimed_at),
            }
          : null,
        normalPrize: normalPart?.draws?.prizes
          ? {
              drawId: normalPart.draws.id,
              participationId: normalPart.id,
              prizeId: normalPart.draws.prizes.id,
              name: normalPart.draws.prizes.name,
              description: normalPart.draws.prizes.description,
              drawnAt: normalPart.draws.drawn_at,
              claimedAt: normalPart.draws.claimed_at,
              isDelivered: Boolean(normalPart.draws.claimed_at),
            }
          : null,
      };
    };

    for (const m of meetings) {
      if (!m.participants) continue;
      itemsByParticipantId.set(m.participant_id, formatParticipantRow(m.participants, m));
    }

    for (const vp of vipParticipations) {
      if (!vp.participants) continue;
      if (itemsByParticipantId.has(vp.participant_id)) continue;
      const m = vp.participants.meetings?.[0] || null;
      itemsByParticipantId.set(vp.participant_id, formatParticipantRow(vp.participants, m));
    }

    return Array.from(itemsByParticipantId.values());
  }
}

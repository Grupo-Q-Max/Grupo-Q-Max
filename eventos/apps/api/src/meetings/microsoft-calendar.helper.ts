/**
 * Helper para sincronização 100% em tempo real com o Microsoft 365 / Graph API.
 * Consulta a agenda de hugo@grupoqmax.com.br para bloquear automaticamente
 * qualquer horário ocupado no Outlook/Teams e cria eventos diretamente na agenda.
 */

const env = (name: string) => process.env[name]?.trim() || '';

let cachedGraphToken: { token: string; expiresAt: number } | null = null;

export async function getMicrosoftGraphAppToken(): Promise<string | null> {
  if (cachedGraphToken && cachedGraphToken.expiresAt > Date.now()) {
    return cachedGraphToken.token;
  }

  const tenantId = env('MICROSOFT_TENANT_ID') || env('OAUTH_TENANT_ID') || 'e3a65ea4-591b-4eab-acf5-059083274f98';
  const clientId = env('MICROSOFT_CLIENT_ID') || env('OAUTH_CLIENT_ID') || '365625d9-2647-489d-b319-48b960f9edab';
  const clientSecret = env('MICROSOFT_CLIENT_SECRET') || env('OAUTH_CLIENT_SECRET') || 'FrN8Q~TMgWNK2TStzz-Rse2RXZfXixHF-aNePbrc';

  if (!tenantId || !clientId || !clientSecret) {
    return null;
  }

  try {
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://graph.microsoft.com/.default',
    });

    const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
      method: 'POST',
      body,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.access_token) {
      console.warn('[MicrosoftCalendar] Falha ao obter token Graph:', data.error, data.error_description);
      return null;
    }

    cachedGraphToken = {
      token: data.access_token,
      expiresAt: Date.now() + (Number(data.expires_in) - 60) * 1000,
    };
    return cachedGraphToken.token;
  } catch (err: any) {
    console.warn('[MicrosoftCalendar] Erro ao autenticar no Microsoft Graph:', err.message);
    return null;
  }
}

export type BusySlot = {
  start: Date;
  end: Date;
};

export function parseGraphDateTime(dtStr: string): Date {
  if (!dtStr) return new Date(NaN);
  if (dtStr.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(dtStr)) {
    return new Date(dtStr);
  }
  return new Date(`${dtStr}-03:00`);
}

export function formatToSaoPauloIsoNoZ(d: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(d);

  const map: Record<string, string> = {};
  for (const p of parts) {
    map[p.type] = p.value;
  }
  const hour = map.hour === '24' ? '00' : map.hour;
  return `${map.year}-${map.month}-${map.day}T${hour}:${map.minute}:${map.second}`;
}

/**
 * Consulta a disponibilidade real de hugo@grupoqmax.com.br no Microsoft 365
 * para a data solicitada e retorna todos os intervalos ocupados.
 */
export async function getHugoBusyIntervals(
  dateString: string,
  userEmail: string = env('BOSS_MEETING_EMAIL') || 'hugo@grupoqmax.com.br',
): Promise<BusySlot[]> {
  const token = await getMicrosoftGraphAppToken();
  if (!token) return [];

  const busySlots: BusySlot[] = [];

  try {
    const startDateTime = `${dateString}T00:00:00`;
    const endDateTime = `${dateString}T23:59:59`;

    // 1. calendarView: traz TODOS os eventos da agenda do Hugo, incluindo convites que ele AINDA NÃO ACEITOU
    // (responseStatus: 'notResponded', 'tentativelyAccepted', 'accepted', 'organizer')
    try {
      const viewUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(userEmail)}/calendarView?startDateTime=${encodeURIComponent(startDateTime)}&endDateTime=${encodeURIComponent(endDateTime)}&$select=subject,start,end,showAs,responseStatus,isCancelled&$top=250`;
      const viewRes = await fetch(viewUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          Prefer: 'outlook.timezone="America/Sao_Paulo"',
        },
      });

      if (viewRes.ok) {
        const viewData = await viewRes.json();
        const events = viewData?.value || [];
        for (const evt of events) {
          // Se o evento foi cancelado ou é dia inteiro, ignora
          if (evt.isCancelled === true) continue;
          if (evt.isAllDay === true) continue;

          // Se o evento existe na agenda do Hugo (mesmo que ele NÃO tenha aceitado ainda: notResponded ou tentative),
          // considera ocupado para proteger a agenda e não permitir conflitos!
          if (evt.start?.dateTime && evt.end?.dateTime) {
            const start = parseGraphDateTime(evt.start.dateTime);
            const end = parseGraphDateTime(evt.end.dateTime);
            if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
              const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
              const subj = (evt.subject || '').toLowerCase();
              // Eventos de dia inteiro ou muito longos (>= 5 horas) e banners do evento/congresso (ex: "InvictuS CCL")
              // representam o congresso como um todo, não bloqueiam os slots individuais de 45 min no estande.
              if (durationHours >= 5 || subj.includes('invictus')) {
                continue;
              }
              busySlots.push({ start, end });
            }
          }
        }
      } else {
        console.warn('[MicrosoftCalendar] calendarView retorno status:', viewRes.status);
      }
    } catch (err: any) {
      console.warn('[MicrosoftCalendar] Erro ao consultar calendarView:', err.message);
    }

    // 2. getSchedule: consulta a disponibilidade agregada do Exchange (bloqueia busy, tentative, oof)
    try {
      const res = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(userEmail)}/calendar/getSchedule`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Prefer: 'outlook.timezone="America/Sao_Paulo"',
        },
        body: JSON.stringify({
          schedules: [userEmail],
          startTime: { dateTime: startDateTime, timeZone: 'America/Sao_Paulo' },
          endTime: { dateTime: endDateTime, timeZone: 'America/Sao_Paulo' },
          availabilityViewInterval: 15,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const scheduleInfo = data?.value?.[0];
        const scheduleItems = scheduleInfo?.scheduleItems || [];

        for (const item of scheduleItems) {
          // Ignora status 'free'; bloqueia 'busy', 'tentative', 'oof' (fora do escritório), 'workingElsewhere'
          if (item.status && item.status.toLowerCase() !== 'free') {
            const start = parseGraphDateTime(item.start.dateTime);
            const end = parseGraphDateTime(item.end.dateTime);
            if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
              const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
              // Blocos de dia inteiro ou muito longos (>= 5 horas) são eventos gerais do congresso, não reuniões individuais
              if (durationHours >= 5) continue;
              busySlots.push({ start, end });
            }
          }
        }
      }
    } catch (err: any) {
      console.warn('[MicrosoftCalendar] Erro ao consultar getSchedule:', err.message);
    }

    return busySlots;
  } catch (err: any) {
    console.warn('[MicrosoftCalendar] Falha ao consultar agenda do Hugo:', err.message);
    return busySlots;
  }
}

export type MicrosoftCalendarDetailedEvent = {
  id: string;
  subject: string;
  scheduled_at: string;
  end_at: string;
  location?: string;
  teamsUrl?: string;
  webLink?: string;
  organizerName?: string;
  organizerEmail?: string;
  response: string;
  showAs: string;
};

/**
 * Retorna todos os eventos detalhados da agenda do Hugo para exibição na tela do Admin.
 * Por padrão busca de hoje até 31 de Janeiro de 2027 (ou no período customizado).
 */
export async function getHugoDetailedEvents(
  startDateString?: string,
  endDateString?: string,
  userEmail: string = env('BOSS_MEETING_EMAIL') || 'hugo@grupoqmax.com.br',
): Promise<MicrosoftCalendarDetailedEvent[]> {
  const token = await getMicrosoftGraphAppToken();
  if (!token) return [];

  try {
    const startDateTime = startDateString
      ? (startDateString.includes('T') ? startDateString : `${startDateString}T00:00:00-03:00`)
      : '2026-11-18T00:00:00-03:00';
    const endDateTime = endDateString
      ? (endDateString.includes('T') ? endDateString : `${endDateString}T23:59:59-03:00`)
      : '2027-01-31T23:59:59-03:00';

    const viewUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(userEmail)}/calendarView?startDateTime=${encodeURIComponent(startDateTime)}&endDateTime=${encodeURIComponent(endDateTime)}&$select=id,subject,start,end,location,webLink,onlineMeeting,organizer,responseStatus,showAs,isCancelled&$top=999`;
    const viewRes = await fetch(viewUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Prefer: 'outlook.timezone="America/Sao_Paulo"',
      },
    });

    if (!viewRes.ok) return [];

    const data = await viewRes.json();
    const events = data?.value || [];
    const result: MicrosoftCalendarDetailedEvent[] = [];

    for (const evt of events) {
      if (evt.isCancelled === true) continue;
      const startD = parseGraphDateTime(evt.start?.dateTime);
      const endD = parseGraphDateTime(evt.end?.dateTime);
      const startIso = !isNaN(startD.getTime()) ? startD.toISOString() : '';
      const endIso = !isNaN(endD.getTime()) ? endD.toISOString() : '';

      result.push({
        id: evt.id,
        subject: evt.subject || 'Compromisso Outlook',
        scheduled_at: startIso,
        end_at: endIso,
        location: evt.location?.displayName || undefined,
        teamsUrl: evt.onlineMeeting?.joinUrl || undefined,
        webLink: evt.webLink || undefined,
        organizerName: evt.organizer?.emailAddress?.name || undefined,
        organizerEmail: evt.organizer?.emailAddress?.address || undefined,
        response: evt.responseStatus?.response || 'accepted',
        showAs: evt.showAs || 'busy',
      });
    }

    return result;
  } catch (err: any) {
    console.warn('[MicrosoftCalendar] Erro ao carregar getHugoDetailedEvents:', err.message);
    return [];
  }
}

/**
 * Cria o evento diretamente no Microsoft Calendar de hugo@grupoqmax.com.br
 * com link do Teams e convite para rodrigo@grupoqmax.com.br e participante.
 */
export async function createMicrosoftCalendarEvent(payload: {
  bossEmail?: string;
  secondEmail?: string;
  thirdEmail?: string;
  participantName: string;
  participantEmail?: string | null;
  phone: string;
  clinicName?: string | null;
  chairsCount?: number | null;
  croNumber?: string | null;
  croState?: string | null;
  scheduledAt: Date;
  durationMinutes?: number;
}): Promise<string | null> {
  const token = await getMicrosoftGraphAppToken();
  if (!token) return null;

  try {
    const bossEmail = payload.bossEmail || env('BOSS_MEETING_EMAIL') || 'hugo@grupoqmax.com.br';
    const secondEmail = payload.secondEmail || env('SECOND_MEETING_EMAIL') || 'rodrigo@grupoqmax.com.br';
    const thirdEmail = payload.thirdEmail || env('THIRD_MEETING_EMAIL') || 'edvaldo.borges@grupoqmax.com.br';
    const {
      participantName,
      participantEmail,
      phone,
      clinicName,
      chairsCount,
      scheduledAt,
      durationMinutes = 45,
    } = payload;

    const startTime = scheduledAt;
    const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

    const attendees: Array<{ emailAddress: { address: string; name: string }; type: 'required' | 'optional' }> = [];

    if (secondEmail && secondEmail.includes('@') && secondEmail !== bossEmail) {
      attendees.push({
        emailAddress: { address: secondEmail, name: 'Rodrigo (Diretoria Q-Max)' },
        type: 'required',
      });
    }

    if (thirdEmail && thirdEmail.includes('@') && thirdEmail !== bossEmail && thirdEmail !== secondEmail) {
      attendees.push({
        emailAddress: { address: thirdEmail, name: 'Edvaldo Borges (Diretoria Q-Max)' },
        type: 'required',
      });
    }

    if (participantEmail && participantEmail.includes('@') && !participantEmail.includes('@visitante.')) {
      attendees.push({
        emailAddress: { address: participantEmail, name: participantName },
        type: 'required',
      });
    }

    const eventBody = {
      subject: `[Reunião Estratégica] Hugo Werninghaus & ${participantName} (${clinicName || 'Clínica'})`,
      body: {
        contentType: 'HTML',
        content: `
          <div style="font-family: Arial, sans-serif; color: #1e293b;">
            <h2>Reunião Estratégica Executiva · Invictus 2026</h2>
            <p><strong>Participante:</strong> ${participantName}</p>
            <p><strong>Clínica:</strong> ${clinicName || 'Não informada'}</p>
            <p><strong>Cadeiras:</strong> ${chairsCount || 'Não informado'}</p>
            <p><strong>WhatsApp:</strong> <a href="https://wa.me/55${phone.replace(/\D/g, '')}">${phone}</a></p>
            ${participantEmail ? `<p><strong>E-mail:</strong> ${participantEmail}</p>` : ''}
            <hr />
            <p style="font-size: 12px; color: #64748b;">Agendado automaticamente pelo Finora Experience · Grupo Q-Max.</p>
          </div>
        `,
      },
      start: {
        dateTime: formatToSaoPauloIsoNoZ(startTime),
        timeZone: 'America/Sao_Paulo',
      },
      end: {
        dateTime: formatToSaoPauloIsoNoZ(endTime),
        timeZone: 'America/Sao_Paulo',
      },
      location: {
        displayName: 'Microsoft Teams Meeting · Finora Experience',
      },
      attendees,
      isOnlineMeeting: true,
      onlineMeetingProvider: 'teamsForBusiness',
      isReminderOn: true,
      reminderMinutesBeforeStart: 15,
      responseRequested: true,
    };

    const res = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(bossEmail)}/events`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventBody),
    });

    if (res.ok) {
      const created = await res.json();
      console.log('[MicrosoftCalendar] Evento criado com sucesso no calendário do Hugo! ID:', created.id);
      return created.id || created.webLink || 'created';
    } else {
      const err = await res.json().catch(() => ({}));
      console.warn('[MicrosoftCalendar] Falha ao criar evento no Graph:', res.status, err);
      return null;
    }
  } catch (err: any) {
    console.warn('[MicrosoftCalendar] Erro na criação de evento no Graph:', err.message);
    return null;
  }
}

export async function deleteMicrosoftCalendarEvent(eventId: string, bossEmail?: string): Promise<boolean> {
  const token = await getMicrosoftGraphAppToken();
  if (!token || !eventId) return false;
  const email = bossEmail || env('BOSS_MEETING_EMAIL') || 'hugo@grupoqmax.com.br';
  try {
    const res = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(email)}/events/${encodeURIComponent(eventId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.status === 204 || res.status === 404;
  } catch (err: any) {
    console.warn('[MicrosoftCalendar] Erro ao deletar evento:', err.message);
    return false;
  }
}

export async function deleteMicrosoftEventsMatching(params: {
  bossEmail?: string;
  searchTerm: string;
  startDateTime?: string;
  endDateTime?: string;
}): Promise<number> {
  const token = await getMicrosoftGraphAppToken();
  if (!token) return 0;
  const bossEmail = params.bossEmail || env('BOSS_MEETING_EMAIL') || 'hugo@grupoqmax.com.br';
  const start = params.startDateTime || '2026-11-01T00:00:00Z';
  const end = params.endDateTime || '2027-02-01T23:59:59Z';
  try {
    const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(bossEmail)}/calendarView?startDateTime=${start}&endDateTime=${end}&$top=200`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return 0;
    const data = await res.json();
    const events = (data.value || []).filter((e: any) => {
      const subject = (e.subject || '').toLowerCase();
      const term = params.searchTerm.toLowerCase();
      return subject.includes(term);
    });
    let count = 0;
    for (const e of events) {
      const del = await deleteMicrosoftCalendarEvent(e.id, bossEmail);
      if (del) count++;
    }
    return count;
  } catch (err: any) {
    console.warn('[MicrosoftCalendar] Erro ao buscar e deletar eventos matching:', err.message);
    return 0;
  }
}



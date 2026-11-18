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

  const tenantId = env('MICROSOFT_TENANT_ID') || env('OAUTH_TENANT_ID');
  const clientId = env('MICROSOFT_CLIENT_ID') || env('OAUTH_CLIENT_ID');
  const clientSecret = env('MICROSOFT_CLIENT_SECRET') || env('OAUTH_CLIENT_SECRET');

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

  try {
    const startDateTime = `${dateString}T00:00:00`;
    const endDateTime = `${dateString}T23:59:59`;

    // getSchedule retorna a disponibilidade oficial de qualquer membro da organização
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

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      console.warn('[MicrosoftCalendar] getSchedule não retornou sucesso:', res.status, errData);
      return [];
    }

    const data = await res.json();
    const scheduleInfo = data?.value?.[0];
    const scheduleItems = scheduleInfo?.scheduleItems || [];

    const busySlots: BusySlot[] = [];
    for (const item of scheduleItems) {
      // Ignora status 'free'; bloqueia 'busy', 'tentative', 'oof' (fora do escritório), 'workingElsewhere'
      if (item.status && item.status.toLowerCase() !== 'free') {
        const start = new Date(item.start.dateTime + '-03:00');
        const end = new Date(item.end.dateTime + '-03:00');
        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
          busySlots.push({ start, end });
        }
      }
    }

    return busySlots;
  } catch (err: any) {
    console.warn('[MicrosoftCalendar] Falha ao consultar agenda do Hugo:', err.message);
    return [];
  }
}

/**
 * Cria o evento diretamente no Microsoft Calendar de hugo@grupoqmax.com.br
 * com link do Teams e convite para rodrigo@grupoqmax.com.br e participante.
 */
export async function createMicrosoftCalendarEvent(payload: {
  bossEmail: string;
  secondEmail?: string;
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
    const {
      bossEmail,
      secondEmail,
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

    const pad = (n: number) => String(n).padStart(2, '0');
    const toIsoStringNoZ = (d: Date) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

    const attendees: Array<{ emailAddress: { address: string; name: string }; type: 'required' | 'optional' }> = [];

    if (secondEmail && secondEmail.includes('@') && secondEmail !== bossEmail) {
      attendees.push({
        emailAddress: { address: secondEmail, name: 'Rodrigo (Diretoria Q-Max)' },
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
        dateTime: toIsoStringNoZ(startTime),
        timeZone: 'America/Sao_Paulo',
      },
      end: {
        dateTime: toIsoStringNoZ(endTime),
        timeZone: 'America/Sao_Paulo',
      },
      location: {
        displayName: 'Microsoft Teams Meeting',
      },
      attendees,
      isOnlineMeeting: true,
      onlineMeetingProvider: 'teamsForBusiness',
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


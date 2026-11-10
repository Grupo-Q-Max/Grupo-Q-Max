import nodemailer from 'nodemailer';

const env = (name: string) => process.env[name]?.trim() || '';

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getOAuthAccessToken(): Promise<string | null> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;

  const tenantId = env('OAUTH_TENANT_ID');
  const clientId = env('OAUTH_CLIENT_ID');
  const clientSecret = env('OAUTH_CLIENT_SECRET');
  const refreshToken = env('OAUTH_REFRESH_TOKEN');

  if (!tenantId || !clientId || !clientSecret || !refreshToken) {
    return null;
  }

  try {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      scope: 'https://outlook.office.com/SMTP.Send offline_access',
    });

    const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
      method: 'POST',
      body,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.access_token) {
      console.warn('[MeetingMail] Falha ao renovar token OAuth:', data.error, data.error_description);
      return null;
    }

    cachedToken = {
      value: data.access_token,
      expiresAt: Date.now() + (Number(data.expires_in) - 60) * 1000,
    };
    return cachedToken.value;
  } catch (err: any) {
    console.warn('[MeetingMail] Erro na requisição do token OAuth:', err.message);
    return null;
  }
}

export type MeetingInvitePayload = {
  meetingId: number;
  scheduledAt: Date;
  participant: {
    fullName: string;
    email?: string | null;
    phone: string;
    clinicName?: string | null;
    croNumber?: string | null;
    croState?: string | null;
    chairsCount?: number | null;
  };
  bossEmail: string;
};

export async function sendMeetingInvite(payload: MeetingInvitePayload): Promise<boolean> {
  const { meetingId, scheduledAt, participant, bossEmail } = payload;
  const user = env('EMAIL_USER') || env('SMTP_USER') || 'envio@qmax.com.br';

  const startTime = scheduledAt;
  const endTime = new Date(startTime.getTime() + 30 * 60 * 1000); // 30 minutos

  const pad = (n: number) => String(n).padStart(2, '0');
  const toIcsDate = (d: Date) =>
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

  const dtStamp = toIcsDate(new Date());
  const dtStart = toIcsDate(startTime);
  const dtEnd = toIcsDate(endTime);
  const uid = `qmax-meeting-${meetingId}-${Date.now()}@grupoqmax.com.br`;

  const participantName = participant.fullName.trim();
  const clinic = participant.clinicName?.trim() || 'Não informada';
  const chairs = participant.chairsCount ? `${participant.chairsCount} cadeiras` : 'Não informado';
  const phone = participant.phone.trim();
  const participantEmail = participant.email?.trim() || '';

  const dateFormatted = startTime.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const teamsLink = `https://teams.microsoft.com/l/meetup-join/qmax-invictus-${meetingId}`;

  const summary = `Reunião Estratégica: Hugo Werninghaus & ${participantName}`;
  const description =
    `Consultoria Estratégica agendada no evento Invictus 2026.\\n\\n` +
    `👤 Participante: ${participantName}\\n` +
    `🏥 Clínica: ${clinic}\\n` +
    `🪑 Cadeiras: ${chairs}\\n` +
    `📱 WhatsApp: ${phone}\\n` +
    `✉️ E-mail: ${participantEmail || 'Não informado'}\\n\\n` +
    `💻 Plataforma: Microsoft Teams\\n` +
    `🔗 Link da reunião: ${teamsLink}`;

  const icsLines = [
    'BEGIN:VCALENDAR',
    'PRODID:-//Grupo Q-Max//Finora Experience//PT-BR',
    'VERSION:2.0',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    'LOCATION:Microsoft Teams (Online)',
    `ORGANIZER;CN="Hugo Ludwig Werninghaus (Grupo Q-Max)":mailto:${bossEmail}`,
    `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;CN="Hugo Ludwig Werninghaus":mailto:${bossEmail}`,
  ];

  if (participantEmail && !participantEmail.includes('@visitante.')) {
    icsLines.push(
      `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;CN="${participantName}":mailto:${participantEmail}`,
    );
  }

  icsLines.push(
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'TRIGGER:-PT15M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Lembrete de Reunião Grupo Q-Max',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  );

  const icsContent = icsLines.join('\r\n');

  const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Reunião Estratégica Agendada - Invictus 2026</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b1120; color: #f8fafc; margin: 0; padding: 24px;">
  <div style="max-width: 600px; margin: 0 auto; background: #0f172a; border-radius: 16px; border: 1px solid #1e293b; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
    
    <div style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); padding: 28px 24px; text-align: center;">
      <span style="display: inline-block; padding: 4px 12px; background: rgba(255,255,255,0.18); border-radius: 20px; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; color: #ffffff; text-transform: uppercase;">
        Invictus 2026 · Pós-Evento
      </span>
      <h1 style="color: #ffffff; margin: 12px 0 0 0; font-size: 22px; font-weight: 800;">
        Nova Reunião Estratégica Agendada
      </h1>
      <p style="color: #e0f2fe; margin: 6px 0 0 0; font-size: 14px;">
        ${dateFormatted}
      </p>
    </div>

    <div style="padding: 24px;">
      <div style="background: #1e293b; border-radius: 12px; padding: 18px; margin-bottom: 20px; border-left: 4px solid #38bdf8;">
        <h2 style="margin: 0 0 12px 0; font-size: 15px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">
          Dados do Participante
        </h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #f8fafc;">
          <tr>
            <td style="padding: 6px 0; color: #94a3b8; width: 120px;"><strong>Nome:</strong></td>
            <td style="padding: 6px 0; font-weight: 600;">${participantName}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #94a3b8;"><strong>WhatsApp:</strong></td>
            <td style="padding: 6px 0;"><a href="https://wa.me/55${phone.replace(/\D/g, '')}" style="color: #38bdf8; text-decoration: none; font-weight: 600;">${phone}</a></td>
          </tr>
          ${participantEmail && !participantEmail.includes('@visitante.') ? `
          <tr>
            <td style="padding: 6px 0; color: #94a3b8;"><strong>E-mail:</strong></td>
            <td style="padding: 6px 0;">${participantEmail}</td>
          </tr>` : ''}
          <tr>
            <td style="padding: 6px 0; color: #94a3b8;"><strong>Clínica:</strong></td>
            <td style="padding: 6px 0;">${clinic}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #94a3b8;"><strong>Cadeiras:</strong></td>
            <td style="padding: 6px 0;">${chairs}</td>
          </tr>
        </table>
      </div>

      <div style="background: #1e293b; border-radius: 12px; padding: 18px; margin-bottom: 24px; text-align: center;">
        <span style="font-size: 13px; color: #94a3b8; display: block; margin-bottom: 8px;">Reunião via Microsoft Teams:</span>
        <a href="${teamsLink}" style="display: inline-block; background: #2563eb; color: #ffffff; padding: 12px 28px; border-radius: 999px; text-decoration: none; font-weight: 700; font-size: 15px; box-shadow: 0 4px 14px rgba(37,99,235,0.4);">
          Entrar na Reunião Teams
        </a>
      </div>

      <p style="font-size: 12px; color: #64748b; text-align: center; margin: 0;">
        Este e-mail contém o convite oficial de calendário (.ics). O evento foi adicionado à sua agenda do Outlook.
      </p>
    </div>

    <div style="background: #090d16; padding: 16px 24px; text-align: center; border-top: 1px solid #1e293b; font-size: 11px; color: #64748b;">
      © 2026 Grupo Q-Max & Finora · Sistema de Experiência e Ativação em Eventos
    </div>
  </div>
</body>
</html>
  `;

  try {
    const accessToken = await getOAuthAccessToken();
    let transporter: any;

    if (accessToken) {
      transporter = nodemailer.createTransport({
        host: env('SMTP_HOST') || 'smtp.office365.com',
        port: Number(env('SMTP_PORT') || 587),
        secure: false,
        requireTLS: true,
        auth: {
          type: 'OAuth2',
          user,
          accessToken,
        },
      });
    } else if (env('SMTP_PASS')) {
      transporter = nodemailer.createTransport({
        host: env('SMTP_HOST') || 'smtp.office365.com',
        port: Number(env('SMTP_PORT') || 587),
        secure: false,
        requireTLS: true,
        auth: {
          user,
          pass: env('SMTP_PASS'),
        },
      });
    } else {
      console.warn('[MeetingMail] Nenhuma credencial SMTP/OAuth configurada para envio de convite.');
      return false;
    }

    const recipients = [bossEmail];
    if (participantEmail && !participantEmail.includes('@visitante.') && participantEmail.includes('@')) {
      recipients.push(participantEmail);
    }

    await transporter.sendMail({
      from: `"Grupo Q-Max & Finora" <${user}>`,
      to: bossEmail,
      cc: participantEmail && !participantEmail.includes('@visitante.') ? participantEmail : undefined,
      subject: `📅 Reunião Estratégica: Hugo Werninghaus & ${participantName} (Invictus)`,
      html: htmlContent,
      icalEvent: {
        filename: 'convite-reuniao.ics',
        method: 'REQUEST',
        content: icsContent,
      },
    });

    console.log(`[MeetingMail] Convite enviado com sucesso para ${bossEmail}`);
    return true;
  } catch (err: any) {
    console.error('[MeetingMail] Erro ao enviar convite por e-mail:', err.message);
    return false;
  }
}

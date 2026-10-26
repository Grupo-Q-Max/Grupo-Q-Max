// Relatório pós-evento: funil e séries por hora (horário de Brasília).

export type EventReport = {
  event: { id: number; name: string; status: string };
  funnel: { registered: number; validated: number; spun: number; claimed: number; blocked: number };
  perHour: { hour: string; registrations: number; draws: number }[];
  topPrizes: { name: string; total: number }[];
};

const hourFormat = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
});

// "2026-10-14 13h" em Brasília; ordena como texto.
export function hourBucket(date: Date): string {
  const p = Object.fromEntries(hourFormat.formatToParts(date).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}h`;
}

export function perHour(registrations: Date[], draws: Date[]) {
  const buckets = new Map<string, { registrations: number; draws: number }>();
  const bump = (d: Date, key: 'registrations' | 'draws') => {
    const hour = hourBucket(d);
    const b = buckets.get(hour) ?? { registrations: 0, draws: 0 };
    b[key] += 1;
    buckets.set(hour, b);
  };
  registrations.forEach((d) => bump(d, 'registrations'));
  draws.forEach((d) => bump(d, 'draws'));
  return [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([hour, v]) => ({ hour, ...v }));
}

const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : '0%');

// Texto do WhatsApp enviado quando o evento é encerrado.
export function reportSummary(report: EventReport, link: string): string {
  const { funnel: f } = report;
  const top = report.topPrizes.slice(0, 3).map((p, i) => `${i + 1}. ${p.name} (${p.total})`).join('\n');
  const peak = [...report.perHour].sort((a, b) => b.draws - a.draws)[0];
  return [
    `📊 *Resumo do evento ${report.event.name}*`,
    '',
    `Cadastros: ${f.registered}`,
    `WhatsApp validado: ${f.validated} (${pct(f.validated, f.registered)})`,
    `Giros: ${f.spun} (${pct(f.spun, f.registered)})`,
    `Prêmios retirados: ${f.claimed} (${pct(f.claimed, f.spun)})`,
    `Bloqueados pelo antifraude: ${f.blocked}`,
    peak ? `Pico: ${peak.hour} com ${peak.draws} giros` : '',
    top ? `\n🏆 *Mais sorteados:*\n${top}` : '',
    '',
    `Relatório completo: ${link}`,
  ]
    .filter((line, i, all) => line !== '' || all[i - 1] !== '')
    .join('\n');
}

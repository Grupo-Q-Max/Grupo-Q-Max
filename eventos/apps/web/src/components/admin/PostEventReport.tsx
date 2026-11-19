import type { EventReport } from "@/lib/api";

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

// Funil e giros por hora do relatório pós-evento. Uma série por gráfico: cor única
// (finora-600), valores em texto ao lado; detalhe por hora no hover/foco de cada barra.
export default function PostEventReport({ report }: { report: EventReport }) {
  const f = report.funnel;
  const steps = [
    { label: "Cadastros", value: f.registered, base: f.registered, note: "" },
    { label: "WhatsApp validado", value: f.validated, base: f.registered, note: "dos cadastros" },
    { label: "Giraram a roleta", value: f.spun, base: f.registered, note: "dos cadastros" },
    { label: "Retiraram o prêmio", value: f.claimed, base: f.spun, note: "dos giros" },
  ];
  const maxHour = Math.max(1, ...report.perHour.map((h) => h.draws));
  const peak = [...report.perHour].sort((a, b) => b.draws - a.draws)[0];

  return (
    <div className="grid gap-6 lg:grid-cols-2 print:grid-cols-1">
      <section className="rounded-3xl border border-line bg-surface p-6">
        <h3 className="text-lg font-bold text-text">Funil do evento</h3>
        <p className="mb-5 text-sm text-text-2">Do cadastro à retirada no balcão. {f.blocked} bloqueados pelo antifraude.</p>
        <ol className="flex flex-col gap-4">
          {steps.map((s) => (
            <li key={s.label} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-semibold text-text">{s.label}</span>
                <span className="font-mono text-text">
                  {s.value}
                  {s.note && <span className="ml-2 text-text-2">{pct(s.value, s.base)}% {s.note}</span>}
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-r-[4px] bg-surface">
                <div className="h-full rounded-r-[4px] bg-finora-600" style={{ width: `${pct(s.value, f.registered)}%` }} />
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-3xl border border-line bg-surface p-6">
        <h3 className="text-lg font-bold text-text">Giros por hora</h3>
        <p className="mb-5 text-sm text-text-2">
          {peak ? `Pico às ${peak.hour.slice(-3)}, com ${peak.draws} giros.` : "Nenhum giro registrado."} Horário de Brasília.
        </p>
        {report.perHour.length > 0 && (
          <div className="flex h-44 items-end gap-[2px] border-b border-line" role="img" aria-label="Giros por hora">
            {report.perHour.map((h) => (
              <div key={h.hour} tabIndex={0} className="group relative flex h-full flex-1 items-end outline-none">
                <div
                  className="w-full rounded-t-[4px] bg-finora-600 group-hover:bg-finora-700 group-focus:bg-finora-700"
                  style={{ height: `${Math.max(2, (h.draws / maxHour) * 100)}%` }}
                />
                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink-950 px-2.5 py-1.5 text-xs text-ink-text group-hover:block group-focus:block">
                  <strong className="block">{h.hour}</strong>
                  {h.draws} giros · {h.registrations} cadastros
                </div>
              </div>
            ))}
          </div>
        )}
        {report.perHour.length > 0 && (
          <div className="mt-1.5 flex justify-between font-mono text-[11px] text-text-2">
            <span>{report.perHour[0].hour}</span>
            <span>{report.perHour[report.perHour.length - 1].hour}</span>
          </div>
        )}
        <details className="mt-4 text-sm print:hidden">
          <summary className="cursor-pointer font-semibold text-text-2">Ver tabela</summary>
          <table className="mt-2 w-full text-left font-mono text-xs">
            <thead className="text-text-2"><tr><th className="py-1">Hora</th><th>Cadastros</th><th>Giros</th></tr></thead>
            <tbody>
              {report.perHour.map((h) => (
                <tr key={h.hour} className="border-t border-line"><td className="py-1">{h.hour}</td><td>{h.registrations}</td><td>{h.draws}</td></tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>
    </div>
  );
}

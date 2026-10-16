"use client";

import { useState, useSyncExternalStore, type ReactElement, type ReactNode } from "react";
import Link from "next/link";
import { Download, Hash, DollarSign } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { FilterField, FilterSearch, type FilterChip } from "../FilterSearch";
import { Select } from "@/components/ui/Select";
import { DatePicker } from "@/components/ui/DatePicker";
import { matches } from "@/lib/text-search";
import {
  breakdown,
  compareRange,
  delta,
  granularityFor,
  isLost,
  isWon,
  periodRange,
  rate,
  series,
  summarize,
  type CompareMode,
  type Preset,
  type Range,
  type ReportDeal,
  type Totals,
} from "@/lib/crm-reports";
import { csvMoney, downloadCsv } from "@/lib/csv";
import { CrmGoals, type Goal } from "./CrmGoals";

type Option = { id: string; name: string };
type PipelineOption = Option & { stages: Option[] };
type Metric = "count" | "value";
type Filters = {
  q: string;
  preset: Preset;
  from: string;
  to: string;
  compare: CompareMode;
  pipelineId: string;
  responsibleId: string;
  source: string;
  dealType: string;
};
const DEFAULTS: Filters = { q: "", preset: "month", from: "", to: "", compare: "previous", pipelineId: "", responsibleId: "", source: "", dealType: "" };

const PRESETS: Record<Preset, string> = {
  month: "Este mês",
  lastMonth: "Mês passado",
  quarter: "Este trimestre",
  year: "Este ano",
  "30d": "Últimos 30 dias",
  "90d": "Últimos 90 dias",
  custom: "Personalizado",
};
const COMPARES: Record<CompareMode, string> = { previous: "Período anterior", lastYear: "Mesmo período do ano passado", none: "Sem comparação" };
const NONE = "none";
const NO_SOURCE = "Sem origem";
const NO_TYPE = "Sem tipo";

const WON = "#2dd4a0";
const LOST = "#ff4d6d";
const PREV = "#8a8590";
const PALETTE = ["#ff2b91", "#8b5cf6", "#2dd4a0", "#f5a524", "#38bdf8", "#f472b6", "#a3e635", "#8a8590"];

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const pct = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });
const showDate = (d: Date) => d.toLocaleDateString("pt-BR");
const showRange = (r: Range) => `${showDate(r.from)} – ${showDate(new Date(r.to.getTime() - 1))}`;

const tooltipProps = {
  contentStyle: { background: "#141416", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff" },
  itemStyle: { color: "#fff" },
  labelStyle: { color: "#a5a0aa" },
  cursor: { fill: "rgba(255,255,255,0.04)" },
};
const axis = { stroke: "#6b6670", fontSize: 12, tickLine: false, axisLine: false };

// Dates depend on the viewer's time zone, so the report only renders in the browser
const subscribe = () => () => {};
const useIsClient = () => useSyncExternalStore(subscribe, () => true, () => false);

export function CrmReports({
  deals,
  pipelines,
  members,
  goalMembers,
  goals,
  canManageGoals,
  children,
}: {
  deals: ReportDeal[];
  pipelines: PipelineOption[];
  members: Option[];
  goalMembers: Option[];
  goals: Goal[];
  canManageGoals: boolean;
  /** Extra sections after the deal reports (the task report) */
  children?: ReactNode;
}) {
  const [filters, setFilters] = useState(DEFAULTS);
  const [metric, setMetric] = useState<Metric>("value");
  const isClient = useIsClient();
  const set = (changes: Partial<Filters>) => setFilters((f) => ({ ...f, ...changes }));
  const f = filters;

  const memberName = (id: string) => (id === NONE ? "Sem responsável" : members.find((m) => m.id === id)?.name ?? "Responsável removido");
  const pipelineName = (id: string) => pipelines.find((p) => p.id === id)?.name ?? "Funil";
  const sourceOf = (d: ReportDeal) => d.source?.trim() || NO_SOURCE;
  const typeOf = (d: ReportDeal) => d.dealType?.trim() || NO_TYPE;
  const sources = [...new Set(deals.map(sourceOf))].sort();
  const types = [...new Set(deals.map(typeOf))].sort();

  const shown = deals.filter(
    (d) =>
      (!f.pipelineId || d.pipelineId === f.pipelineId) &&
      (!f.responsibleId || (d.responsibleId ?? NONE) === f.responsibleId) &&
      (!f.source || sourceOf(d) === f.source) &&
      (!f.dealType || typeOf(d) === f.dealType) &&
      matches(f.q, d.title, `#${d.number}`)
  );

  const chips: FilterChip[] = [
    f.pipelineId && { key: "pipeline", label: pipelineName(f.pipelineId), onRemove: () => set({ pipelineId: "" }) },
    f.responsibleId && { key: "responsible", label: memberName(f.responsibleId), onRemove: () => set({ responsibleId: "" }) },
    f.source && { key: "source", label: f.source, onRemove: () => set({ source: "" }) },
    f.dealType && { key: "type", label: f.dealType, onRemove: () => set({ dealType: "" }) },
  ].filter((c): c is FilterChip => Boolean(c));

  const header = (
    <header className="crm-header">
      <h1 className="crm-header__title">Relatórios</h1>
      <div className="crm-header__actions">
        <div className="crm-toolbar__views" role="group" aria-label="Métrica dos gráficos">
          <button className={`view-btn ${metric === "value" ? "is-active" : ""}`} onClick={() => setMetric("value")}>
            <DollarSign size={16} /> Valor
          </button>
          <button className={`view-btn ${metric === "count" ? "is-active" : ""}`} onClick={() => setMetric("count")}>
            <Hash size={16} /> Quantidade
          </button>
        </div>
      </div>
    </header>
  );

  const toolbar = (
    <div className="crm-toolbar crm-reports__toolbar">
      <FilterSearch
        value={f.q}
        onChange={(q) => set({ q })}
        placeholder="Buscar negócio por título ou #nº"
        chips={chips}
        onClear={() => set({ q: "", pipelineId: "", responsibleId: "", source: "", dealType: "" })}
      >
        <FilterField label="Funil">
          <Select className="crm-access__select" value={f.pipelineId} onChange={(e) => set({ pipelineId: e.target.value })} aria-label="Funil">
            <option value="">Todos</option>
            {pipelines.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Responsável">
          <Select className="crm-access__select" value={f.responsibleId} onChange={(e) => set({ responsibleId: e.target.value })} aria-label="Responsável">
            <option value="">Todos</option>
            <option value={NONE}>Sem responsável</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Origem">
          <Select className="crm-access__select" value={f.source} onChange={(e) => set({ source: e.target.value })} aria-label="Origem">
            <option value="">Todas</option>
            {sources.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Tipo de negócio">
          <Select className="crm-access__select" value={f.dealType} onChange={(e) => set({ dealType: e.target.value })} aria-label="Tipo de negócio">
            <option value="">Todos</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </FilterField>
      </FilterSearch>

      <div className="crm-reports__period">
        <Select className="crm-access__select" value={f.preset} onChange={(e) => set({ preset: e.target.value as Preset })} aria-label="Período">
          {Object.entries(PRESETS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        {f.preset === "custom" && (
          <span className="crm-filter-panel__range">
            <DatePicker className="crm-access__select" value={f.from} max={f.to || undefined} onChange={(e) => set({ from: e.target.value })} aria-label="De" />
            <span>até</span>
            <DatePicker className="crm-access__select" value={f.to} min={f.from || undefined} onChange={(e) => set({ to: e.target.value })} aria-label="Até" />
          </span>
        )}
        <Select className="crm-access__select" value={f.compare} onChange={(e) => set({ compare: e.target.value as CompareMode })} aria-label="Comparar com">
          {Object.entries(COMPARES).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );

  if (!isClient)
    return (
      <>
        {header}
        {toolbar}
        <div className="crm-content crm-reports" />
      </>
    );

  const range = periodRange(f.preset, new Date(), f.from, f.to);
  const prevRange = compareRange(range, f.compare);
  const g = granularityFor(range);
  const now = summarize(shown, range);
  const prev = prevRange ? summarize(shown, prevRange) : null;
  const open = shown.filter((d) => d.status === "OPEN");

  const pick = (t: Totals, side: "won" | "lost") => (metric === "count" ? t[side] : t[`${side}Value`]);
  const fmt = (n: number) => (metric === "count" ? String(n) : brl.format(n));
  const fmtAxis = (n: number) => (metric === "count" ? String(n) : compact.format(n));
  const wonLabel = metric === "count" ? "Ganhos" : "Valor ganho";
  const lostLabel = metric === "count" ? "Perdidos" : "Valor perdido";

  const current = series(shown, range, g);
  const previous = prevRange ? series(shown, prevRange, g) : [];
  const timeline = current.map((p, i) => ({
    label: p.label,
    won: pick(p, "won"),
    lost: pick(p, "lost"),
    previous: previous[i] ? pick(previous[i], "won") : null,
  }));

  const byResponsible = breakdown(shown, range, (d) => d.responsibleId ?? NONE);
  const prevByResponsible = new Map(prevRange ? breakdown(shown, prevRange, (d) => d.responsibleId ?? NONE).map((r) => [r.key, r]) : []);
  const byPipeline = breakdown(shown, range, (d) => d.pipelineId).map((r) => ({ ...r, name: pipelineName(r.key) }));
  const bySource = breakdown(shown, range, sourceOf)
    .map((r) => ({ name: r.key, value: pick(r, "won") }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);
  const pie = bySource.length > 7 ? [...bySource.slice(0, 7), { name: "Outras", value: bySource.slice(7).reduce((s, r) => s + r.value, 0) }] : bySource;

  const closed = shown
    .filter((d) => isWon(d, range) || isLost(d, range))
    .sort((a, b) => b.closedAt!.localeCompare(a.closedAt!));

  const exportCsv = () =>
    downloadCsv(`relatorio-negocios-${range.from.toLocaleDateString("sv-SE")}.csv`, [
      ["Número", "Negócio", "Status", "Valor", "Fechado em", "Responsável", "Funil", "Origem", "Tipo"],
      ...closed.map((d) => [
        d.number,
        d.title,
        d.status === "WON" ? "Ganho" : "Perdido",
        csvMoney(d.value),
        showDate(new Date(d.closedAt!)),
        memberName(d.responsibleId ?? NONE),
        pipelineName(d.pipelineId),
        sourceOf(d),
        typeOf(d),
      ]),
    ]);

  // Funnel: open deals per stage of one pipeline (the filtered one, else the first), today, whatever the period
  const funnelPipeline = pipelines.find((p) => p.id === f.pipelineId) ?? pipelines[0];
  const funnelDeals = open.filter((d) => d.pipelineId === funnelPipeline?.id);
  const funnelTotal = funnelDeals.reduce((s, d) => s + d.value, 0);
  const funnel = (funnelPipeline?.stages ?? []).map((stage) => {
    const inStage = funnelDeals.filter((d) => d.stageId === stage.id);
    return { name: stage.name, count: inStage.length, value: inStage.reduce((s, d) => s + d.value, 0) };
  });
  const stageName = (id: string) => funnelPipeline?.stages.find((s) => s.id === id)?.name ?? "";

  const exportFunnelCsv = () =>
    downloadCsv(`negocios-em-aberto-${funnelPipeline?.name ?? "funil"}.csv`, [
      ["Número", "Negócio", "Etapa", "Valor", "Criado em", "Responsável", "Origem", "Tipo"],
      ...funnelDeals.map((d) => [
        d.number,
        d.title,
        stageName(d.stageId),
        csvMoney(d.value),
        showDate(new Date(d.createdAt)),
        memberName(d.responsibleId ?? NONE),
        sourceOf(d),
        typeOf(d),
      ]),
    ]);

  return (
    <>
      {header}
      {toolbar}
      <div className="crm-content crm-reports">
        <p className="crm-reports__caption">
          {showRange(range)}
          {prevRange && (
            <>
              {" "}
              · comparando com {showRange(prevRange)}
            </>
          )}
        </p>

        <section className="crm-reports__kpis">
          <Kpi label="Negócios ganhos" value={now.won} prev={prev?.won} format={String} />
          <Kpi label="Valor ganho" value={now.wonValue} prev={prev?.wonValue} format={brl.format} />
          <Kpi label="Negócios perdidos" value={now.lost} prev={prev?.lost} format={String} invert />
          <Kpi label="Valor perdido" value={now.lostValue} prev={prev?.lostValue} format={brl.format} invert />
          <Kpi label="Taxa de conversão" value={now.conversion} prev={prev?.conversion} format={pct.format} hint="Ganhos ÷ fechados" />
          <Kpi label="Ticket médio" value={now.avgTicket} prev={prev?.avgTicket} format={brl.format} hint="Valor ganho ÷ ganhos" />
          <Kpi label="Negócios criados" value={now.created} prev={prev?.created} format={String} />
          <Kpi
            label="Em aberto agora"
            value={open.length}
            format={String}
            hint={brl.format(open.reduce((s, d) => s + d.value, 0))}
          />
        </section>

        <section className="crm-reports__grid">
          <ChartCard title={`${wonLabel} x ${lostLabel.toLowerCase()}`} wide>
            <BarChart data={timeline}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="label" {...axis} />
              <YAxis {...axis} tickFormatter={fmtAxis} width={56} allowDecimals={false} />
              <Tooltip {...tooltipProps} formatter={(v) => fmt(Number(v))} />
              <Legend />
              <Bar dataKey="won" name={wonLabel} fill={WON} radius={[4, 4, 0, 0]} />
              <Bar dataKey="lost" name={lostLabel} fill={LOST} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartCard>

          <ChartCard title={prevRange ? `${wonLabel}: atual x ${COMPARES[f.compare].toLowerCase()}` : `${wonLabel} no período`} wide>
            <LineChart data={timeline}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="label" {...axis} />
              <YAxis {...axis} tickFormatter={fmtAxis} width={56} allowDecimals={false} />
              <Tooltip {...tooltipProps} cursor={{ stroke: "rgba(255,255,255,0.15)" }} formatter={(v) => fmt(Number(v))} />
              <Legend />
              <Line type="monotone" dataKey="won" name="Período atual" stroke={WON} strokeWidth={2} dot={false} />
              {prevRange && (
                <Line type="monotone" dataKey="previous" name={COMPARES[f.compare]} stroke={PREV} strokeWidth={2} strokeDasharray="5 4" dot={false} />
              )}
            </LineChart>
          </ChartCard>

          <ChartCard title="Por responsável" empty={!byResponsible.length}>
            <BarChart data={byResponsible.slice(0, 10).map((r) => ({ name: memberName(r.key), won: pick(r, "won"), lost: pick(r, "lost") }))} layout="vertical">
              <CartesianGrid stroke="rgba(255,255,255,0.05)" horizontal={false} />
              <XAxis type="number" {...axis} tickFormatter={fmtAxis} allowDecimals={false} />
              <YAxis type="category" dataKey="name" {...axis} width={110} />
              <Tooltip {...tooltipProps} formatter={(v) => fmt(Number(v))} />
              <Legend />
              <Bar dataKey="won" name={wonLabel} fill={WON} radius={[0, 4, 4, 0]} />
              <Bar dataKey="lost" name={lostLabel} fill={LOST} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ChartCard>

          <ChartCard title={`${wonLabel} por origem`} empty={!pie.length}>
            <PieChart>
              <Pie data={pie} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="80%" paddingAngle={2} stroke="none">
                {pie.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip {...tooltipProps} formatter={(v) => fmt(Number(v))} />
              <Legend />
            </PieChart>
          </ChartCard>

          <ChartCard title="Por funil" empty={!byPipeline.length}>
            <BarChart data={byPipeline.map((r) => ({ name: r.name, won: pick(r, "won"), lost: pick(r, "lost") }))}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="name" {...axis} />
              <YAxis {...axis} tickFormatter={fmtAxis} width={56} allowDecimals={false} />
              <Tooltip {...tooltipProps} formatter={(v) => fmt(Number(v))} />
              <Legend />
              <Bar dataKey="won" name={wonLabel} fill={WON} radius={[4, 4, 0, 0]} />
              <Bar dataKey="lost" name={lostLabel} fill={LOST} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartCard>

          <ChartCard title="Taxa de conversão por responsável" empty={!byResponsible.length}>
            <BarChart data={byResponsible.slice(0, 10).map((r) => ({ name: memberName(r.key), rate: rate(r) ?? 0 }))} layout="vertical">
              <CartesianGrid stroke="rgba(255,255,255,0.05)" horizontal={false} />
              <XAxis type="number" {...axis} domain={[0, 1]} tickFormatter={(v) => pct.format(v)} />
              <YAxis type="category" dataKey="name" {...axis} width={110} />
              <Tooltip {...tooltipProps} formatter={(v) => pct.format(Number(v))} />
              <Bar dataKey="rate" name="Conversão" fill="#ff2b91" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ChartCard>
        </section>

        <CrmGoals deals={deals} members={goalMembers} goals={goals} canManage={canManageGoals} />

        {funnelPipeline && (
          <section className="crm-reports__section">
            <div className="crm-reports__section-head">
              <h2>
                Funil em aberto: {funnelPipeline.name} ({funnelDeals.length} · {brl.format(funnelTotal)})
              </h2>
              <button type="button" className="btn-secondary" onClick={exportFunnelCsv} disabled={!funnelDeals.length}>
                <Download size={16} /> Exportar CSV
              </button>
            </div>
            <div className="crm-reports__table">
              <table className="crm-table">
                <thead>
                  <tr>
                    <th>Etapa</th>
                    <th>Negócios</th>
                    <th>Valor</th>
                    <th>% do valor</th>
                  </tr>
                </thead>
                <tbody>
                  {funnel.map((s) => (
                    <tr key={s.name}>
                      <td>{s.name}</td>
                      <td>{s.count}</td>
                      <td>{brl.format(s.value)}</td>
                      <td>{funnelTotal ? pct.format(s.value / funnelTotal) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!f.pipelineId && pipelines.length > 1 && <p className="crm-reports__caption">Filtre por funil para ver outro.</p>}
          </section>
        )}

        <section className="crm-reports__section">
          <h2>Desempenho por responsável</h2>
          <div className="crm-reports__table">
            <table className="crm-table">
              <thead>
                <tr>
                  <th>Responsável</th>
                  <th>Ganhos</th>
                  <th>Perdidos</th>
                  <th>Valor ganho</th>
                  {prevRange && <th>Variação</th>}
                  <th>Valor perdido</th>
                  <th>Conversão</th>
                  <th>Ticket médio</th>
                </tr>
              </thead>
              <tbody>
                {byResponsible.map((r) => {
                  const conv = rate(r);
                  return (
                    <tr key={r.key}>
                      <td>{memberName(r.key)}</td>
                      <td>{r.won}</td>
                      <td>{r.lost}</td>
                      <td>{brl.format(r.wonValue)}</td>
                      {prevRange && (
                        <td>
                          <Delta value={delta(r.wonValue, prevByResponsible.get(r.key)?.wonValue ?? 0)} />
                        </td>
                      )}
                      <td>{brl.format(r.lostValue)}</td>
                      <td>{conv === null ? "—" : pct.format(conv)}</td>
                      <td>{r.won ? brl.format(r.wonValue / r.won) : "—"}</td>
                    </tr>
                  );
                })}
                {!byResponsible.length && (
                  <tr>
                    <td colSpan={8} className="crm-reports__empty">
                      Nenhum negócio fechado no período.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="crm-reports__section">
          <div className="crm-reports__section-head">
            <h2>Negócios fechados no período ({closed.length})</h2>
            <button type="button" className="btn-secondary" onClick={exportCsv} disabled={!closed.length}>
              <Download size={16} /> Exportar CSV
            </button>
          </div>
          <div className="crm-reports__table">
            <table className="crm-table">
              <thead>
                <tr>
                  <th>Negócio</th>
                  <th>Status</th>
                  <th>Valor</th>
                  <th>Fechado em</th>
                  <th>Responsável</th>
                  <th>Funil</th>
                  <th>Origem</th>
                </tr>
              </thead>
              <tbody>
                {/* ponytail: first 200 rows on screen; the CSV has them all */}
                {closed.slice(0, 200).map((d) => (
                  <tr key={d.id}>
                    <td>
                      <Link href={`/crm/deal/details/${d.number}`}>
                        #{d.number} {d.title}
                      </Link>
                    </td>
                    <td>
                      <span className={`crm-reports__status is-${d.status.toLowerCase()}`}>{d.status === "WON" ? "Ganho" : "Perdido"}</span>
                    </td>
                    <td>{brl.format(d.value)}</td>
                    <td>{showDate(new Date(d.closedAt!))}</td>
                    <td>{memberName(d.responsibleId ?? NONE)}</td>
                    <td>{pipelineName(d.pipelineId)}</td>
                    <td>{sourceOf(d)}</td>
                  </tr>
                ))}
                {!closed.length && (
                  <tr>
                    <td colSpan={7} className="crm-reports__empty">
                      Nenhum negócio fechado no período.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
        {children}
      </div>
    </>
  );
}

function Kpi({
  label,
  value,
  prev,
  format,
  invert,
  hint,
}: {
  label: string;
  value: number | null;
  prev?: number | null;
  format: (n: number) => string;
  /** A rise is bad (lost deals) */
  invert?: boolean;
  hint?: string;
}) {
  return (
    <div className="crm-reports__kpi">
      <span className="crm-reports__kpi-label">{label}</span>
      <strong className="crm-reports__kpi-value">{value === null ? "—" : format(value)}</strong>
      <span className="crm-reports__kpi-foot">
        {prev !== undefined && <Delta value={delta(value, prev)} invert={invert} />}
        {prev !== undefined ? <span>antes: {prev === null ? "—" : format(prev)}</span> : hint && <span>{hint}</span>}
      </span>
      {prev !== undefined && hint && <span className="crm-reports__kpi-hint">{hint}</span>}
    </div>
  );
}

function Delta({ value, invert }: { value: number | null; invert?: boolean }) {
  if (value === null) return <span className="crm-reports__delta">—</span>;
  const good = invert ? value < 0 : value > 0;
  const cls = value === 0 ? "" : good ? "is-up" : "is-down";
  return (
    <span className={`crm-reports__delta ${cls}`}>
      {value > 0 ? "▲" : value < 0 ? "▼" : ""} {pct.format(Math.abs(value))}
    </span>
  );
}

function ChartCard({ title, wide, empty, children }: { title: string; wide?: boolean; empty?: boolean; children: ReactNode }) {
  return (
    <div className={`crm-reports__card${wide ? " is-wide" : ""}`}>
      <h2>{title}</h2>
      <div className="crm-reports__chart">
        {empty ? (
          <p className="crm-reports__empty">Sem dados no período.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {children as ReactElement}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

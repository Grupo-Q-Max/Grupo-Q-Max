"use client";

import { useState } from "react";
import { Select } from "@/components/ui/Select";
import { periodRange, type Preset } from "@/lib/crm-reports";
import { todayKey } from "@/lib/crm-due";

export type ReportTask = {
  responsibleId: string | null;
  status: "OPEN" | "WON" | "LOST";
  /** When the task was finished (reached the last column) */
  closedAt: string | null;
  /** Due date, YYYY-MM-DD */
  closeDate: string | null;
  createdAt: string;
};

const PRESETS: Partial<Record<Preset, string>> = {
  month: "Este mês",
  lastMonth: "Mês passado",
  quarter: "Este trimestre",
  year: "Este ano",
  "30d": "Últimos 30 dias",
  "90d": "Últimos 90 dias",
};
const NO_RESPONSIBLE = "";

type Row = { name: string; created: number; done: number; onTime: number; open: number; overdue: number };
const emptyRow = (name: string): Row => ({ name, created: 0, done: 0, onTime: 0, open: 0, overdue: 0 });
const pct = (part: number, total: number) => (total ? `${Math.round((part / total) * 100)}%` : "—");

/** Task boards: tasks created and finished in the period, on-time rate and what is open / overdue now, per responsible. */
export function CrmTaskReport({ tasks, members }: { tasks: ReportTask[]; members: { id: string; name: string }[] }) {
  const [preset, setPreset] = useState<Preset>("month");
  const range = periodRange(preset);
  const inRange = (iso: string | null) => !!iso && new Date(iso) >= range.from && new Date(iso) < range.to;
  const today = todayKey();

  const rows = new Map<string, Row>();
  const rowOf = (id: string | null) => {
    const key = id ?? NO_RESPONSIBLE;
    if (!rows.has(key)) rows.set(key, emptyRow(members.find((m) => m.id === id)?.name ?? "Sem responsável"));
    return rows.get(key)!;
  };
  for (const t of tasks) {
    const row = rowOf(t.responsibleId);
    if (inRange(t.createdAt)) row.created++;
    if (t.status === "WON" && inRange(t.closedAt)) {
      row.done++;
      // Finished on or before the due day (Brazilian time); no due date counts as on time
      if (!t.closeDate || todayKey(new Date(t.closedAt!)) <= t.closeDate) row.onTime++;
    }
    if (t.status === "OPEN") {
      row.open++;
      if (t.closeDate && t.closeDate < today) row.overdue++;
    }
  }
  const list = [...rows.values()].filter((r) => r.created || r.done || r.open).sort((a, b) => b.done - a.done || a.name.localeCompare(b.name));
  const total = list.reduce(
    (sum, r) => ({ ...sum, created: sum.created + r.created, done: sum.done + r.done, onTime: sum.onTime + r.onTime, open: sum.open + r.open, overdue: sum.overdue + r.overdue }),
    emptyRow("Total")
  );

  return (
    <section className="crm-reports__section">
      <div className="crm-reports__section-head">
        <h2>Tarefas por responsável</h2>
        <Select className="crm-access__select" value={preset} onChange={(e) => setPreset(e.target.value as Preset)} aria-label="Período das tarefas">
          {Object.entries(PRESETS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>
      <p className="crm-reports__caption">Criadas e concluídas no período; abertas e atrasadas hoje. Concluída = chegou na última coluna do quadro.</p>
      {list.length === 0 ? (
        <p className="crm-reports__empty">Nenhuma tarefa nos quadros de tarefas que você vê.</p>
      ) : (
        <div className="crm-reports__table">
          <table className="crm-table">
            <thead>
              <tr>
                <th>Responsável</th>
                <th>Criadas</th>
                <th>Concluídas</th>
                <th>No prazo</th>
                <th>Abertas</th>
                <th>Atrasadas</th>
              </tr>
            </thead>
            <tbody>
              {[...list, total].map((r) => (
                <tr key={r.name} style={r === total ? { fontWeight: 600 } : undefined}>
                  <td>{r.name}</td>
                  <td>{r.created}</td>
                  <td>{r.done}</td>
                  <td>{pct(r.onTime, r.done)}</td>
                  <td>{r.open}</td>
                  <td className={r.overdue ? "crm-table__overdue" : undefined}>{r.overdue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

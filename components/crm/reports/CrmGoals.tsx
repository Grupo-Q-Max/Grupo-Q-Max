"use client";

import { useState } from "react";
import { breakdown, periodRange, type ReportDeal } from "@/lib/crm-reports";
import { monthKey, parseAmount } from "@/lib/crm-goals";

type Option = { id: string; name: string };
export type Goal = { memberId: string; month: string; amount: number };

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const pct = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0 });

/**
 * Goals of the current month: won value (all pipelines, ignoring the report filters) against each
 * member's goal. Members with `goal.manage` edit the goal inline.
 */
export function CrmGoals({ deals, members, goals, canManage }: { deals: ReportDeal[]; members: Option[]; goals: Goal[]; canManage: boolean }) {
  const now = new Date();
  const month = monthKey(now);
  const [amounts, setAmounts] = useState(() => new Map(goals.filter((g) => g.month === month).map((g) => [g.memberId, g.amount])));
  const [error, setError] = useState("");

  const won = new Map(breakdown(deals, periodRange("month", now), (d) => d.responsibleId ?? "").map((r) => [r.key, r.wonValue]));
  const rows = members
    .map((m) => ({ ...m, goal: amounts.get(m.id) ?? 0, won: won.get(m.id) ?? 0 }))
    .filter((r) => canManage || r.goal > 0);
  const total = rows.reduce((acc, r) => ({ goal: acc.goal + r.goal, won: acc.won + (r.goal ? r.won : 0) }), { goal: 0, won: 0 });

  async function save(memberId: string, input: string) {
    const amount = parseAmount(input);
    if (Number.isNaN(amount)) {
      setError("Valor de meta inválido.");
      return;
    }
    if (amount === (amounts.get(memberId) ?? 0)) return;
    setError("");
    const res = await fetch("/api/crm/goal", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId, month, amount }),
    }).catch(() => null);
    if (!res?.ok) {
      setError((await res?.json().catch(() => null))?.error ?? "Não foi possível salvar a meta.");
      return;
    }
    const saved = await res.json();
    setAmounts((m) => new Map(m).set(memberId, saved.amount));
  }

  if (!rows.length) return null;

  return (
    <section className="crm-reports__section">
      <div className="crm-reports__section-head">
        <h2>Metas de {now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</h2>
        {total.goal > 0 && (
          <span className="crm-reports__caption">
            Equipe: {brl.format(total.won)} de {brl.format(total.goal)} ({pct.format(total.won / total.goal)})
          </span>
        )}
      </div>
      {error && <p className="crm-goals__error" role="alert">{error}</p>}
      <div className="crm-reports__table">
        <table className="crm-table">
          <thead>
            <tr>
              <th>Responsável</th>
              <th>Meta</th>
              <th>Ganho no mês</th>
              <th>Progresso</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const progress = r.goal ? r.won / r.goal : null;
              return (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td>
                    {canManage ? (
                      <input
                        key={r.goal}
                        className="crm-access__select crm-goals__input"
                        inputMode="decimal"
                        placeholder="Sem meta"
                        defaultValue={r.goal ? r.goal.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : ""}
                        onBlur={(e) => save(r.id, e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                        aria-label={`Meta de ${r.name}`}
                      />
                    ) : (
                      brl.format(r.goal)
                    )}
                  </td>
                  <td>{brl.format(r.won)}</td>
                  <td>
                    {progress === null ? (
                      "—"
                    ) : (
                      <span className="crm-goals__progress">
                        <span className="crm-goals__bar">
                          <span className={progress >= 1 ? "is-done" : ""} style={{ width: `${Math.min(progress, 1) * 100}%` }} />
                        </span>
                        {pct.format(progress)}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { dueAt, todayKey } from "@/lib/crm-due";
import type { CrmDeal } from "./DealCard";
import { Avatar } from "./deal/ui";
import { formatMinutes, type TeamMember } from "./deal/types";

/** Hours per day above which a person's cell turns red */
// ponytail: one fixed workday for everyone; store a per-member workday if people work different hours
const DAY_LIMIT = 8 * 60;
const DAYS = 14;
const NOBODY = "none";

const addDays = (day: string, by: number) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + by);
  return d.toISOString().slice(0, 10);
};
const weekday = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay();
const isWorkday = (day: string) => weekday(day) !== 0 && weekday(day) !== 6;
/** Monday of the week that contains `day` */
const mondayOf = (day: string) => addDays(day, -((weekday(day) + 6) % 7));
const dayOf = (date: string | Date) => new Date(date).toISOString().slice(0, 10);

/**
 * Minutes per workday of a task: its estimate spread evenly over the workdays from the start date
 * (or the deadline) to the deadline; a range with no workday puts it all on the deadline.
 */
function spread(card: CrmDeal): [string, number][] {
  const end = dayOf(card.closeDate!);
  const start = card.startDate && dayOf(card.startDate) < end ? dayOf(card.startDate) : end;
  const days: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) if (isWorkday(d)) days.push(d);
  if (!days.length) days.push(end);
  return days.map((d) => [d, card.estimateMinutes! / days.length]);
}

function TaskList({ cards, onOpen, note }: { cards: CrmDeal[]; onOpen: (card: CrmDeal) => void; note: (card: CrmDeal) => string }) {
  return (
    <ul>
      {cards.map((card) => (
        <li key={card.id}>
          <button type="button" onClick={() => onOpen(card)}>
            <span>{card.title}</span>
            <span className="crm-workload__sub">{note(card)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * "Carga de trabalho": estimated hours per person per day for the open tasks on screen (filters applied),
 * plus the open tasks that cannot be scheduled (no deadline or no estimate).
 */
export function CrmWorkload({ cards, onOpen }: { cards: CrmDeal[]; onOpen: (card: CrmDeal) => void }) {
  const [from, setFrom] = useState(() => mondayOf(todayKey(new Date())));
  const days = Array.from({ length: DAYS }, (_, i) => addDays(from, i));
  const today = todayKey(new Date());

  const open = cards.filter((c) => c.status !== "WON");
  const scheduled = open.filter((c) => c.closeDate && c.estimateMinutes);
  const unscheduled = open.filter((c) => !c.closeDate || !c.estimateMinutes);
  const late = open.filter((c) => c.closeDate && dueAt(c.closeDate, c.dueTime).getTime() < Date.now());

  // person id → day → { minutes, task titles }
  const people = new Map<string, { member: TeamMember | null; days: Map<string, { minutes: number; titles: string[] }> }>();
  for (const card of scheduled) {
    const members = [card.responsible, ...(card.assignees ?? [])].filter((m, i, all): m is TeamMember => !!m && all.findIndex((x) => x?.id === m.id) === i);
    // ponytail: the estimate is split evenly between responsible and co-assignees; add a per-person share if teams need it
    const owners = members.length ? members : [null];
    for (const [day, minutes] of spread(card)) {
      for (const member of owners) {
        const id = member?.id ?? NOBODY;
        if (!people.has(id)) people.set(id, { member, days: new Map() });
        const cell = people.get(id)!.days.get(day) ?? { minutes: 0, titles: [] };
        cell.minutes += minutes / owners.length;
        cell.titles.push(card.title);
        people.get(id)!.days.set(day, cell);
      }
    }
  }
  const rows = [...people.entries()].sort(([a, x], [b, y]) => (a === NOBODY ? 1 : b === NOBODY ? -1 : (x.member?.name ?? "").localeCompare(y.member?.name ?? "")));

  return (
    <div className="crm-workload">
      <div className="crm-workload__main">
        <div className="crm-calendar__bar">
          <button type="button" className="view-btn" onClick={() => setFrom(mondayOf(today))}>
            Hoje
          </button>
          <button type="button" className="view-btn" aria-label="Semana anterior" onClick={() => setFrom(addDays(from, -7))}>
            <ChevronLeft size={16} />
          </button>
          <button type="button" className="view-btn" aria-label="Próxima semana" onClick={() => setFrom(addDays(from, 7))}>
            <ChevronRight size={16} />
          </button>
          <span className="crm-workload__range">
            {new Date(`${from}T12:00:00Z`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" })} –{" "}
            {new Date(`${days.at(-1)}T12:00:00Z`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" })}
          </span>
          <span className="crm-workload__hint">Estimativa distribuída nos dias úteis entre início e prazo · limite {formatMinutes(DAY_LIMIT)}/dia</span>
        </div>
        <div className="crm-workload__scroll">
          <table className="crm-workload__grid">
            <thead>
              <tr>
                <th className="crm-workload__person">Pessoa</th>
                {days.map((day) => (
                  <th key={day} className={`${isWorkday(day) ? "" : "is-weekend"} ${day === today ? "is-today" : ""}`}>
                    <span>{new Date(`${day}T12:00:00Z`).toLocaleDateString("pt-BR", { weekday: "short", timeZone: "UTC" }).replace(".", "")}</span>
                    <b>{day.slice(8)}</b>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(([id, { member, days: load }]) => {
                const total = days.reduce((sum, day) => sum + (load.get(day)?.minutes ?? 0), 0);
                return (
                  <tr key={id}>
                    <th className="crm-workload__person">
                      <div className="crm-workload__who">
                        <Avatar member={member} size={26} />
                        <span>
                          {member?.name ?? "Sem responsável"}
                          <span className="crm-workload__sub">{formatMinutes(Math.round(total))} no período</span>
                        </span>
                      </div>
                    </th>
                    {days.map((day) => {
                      const cell = load.get(day);
                      const minutes = Math.round(cell?.minutes ?? 0);
                      return (
                        <td
                          key={day}
                          className={`${isWorkday(day) ? "" : "is-weekend"} ${minutes > DAY_LIMIT ? "is-over" : minutes ? "has-load" : ""}`}
                          title={cell ? [...new Set(cell.titles)].join("\n") : undefined}
                        >
                          {minutes ? formatMinutes(minutes) : ""}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {!rows.length && (
                <tr>
                  <td colSpan={DAYS + 1} className="crm-workload__empty">
                    Nenhuma tarefa aberta com prazo e estimativa.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <aside className="crm-workload__side">
        <h3>Não programadas ({unscheduled.length})</h3>
        <div className="crm-workload__note">Abertas sem prazo ou sem estimativa.</div>
        <TaskList cards={unscheduled} onOpen={onOpen} note={(c) => (!c.closeDate && !c.estimateMinutes ? "sem prazo e estimativa" : !c.closeDate ? "sem prazo" : "sem estimativa")} />
        <h3>Atrasadas ({late.length})</h3>
        <div className="crm-workload__note">Prazo vencido: a carga ficou nos dias passados.</div>
        <TaskList cards={late} onOpen={onOpen} note={(c) => `prazo ${new Date(c.closeDate!).toLocaleDateString("pt-BR", { timeZone: "UTC" })}`} />
      </aside>
    </div>
  );
}

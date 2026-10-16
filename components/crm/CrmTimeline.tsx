"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { todayKey } from "@/lib/crm-due";

export type TimelineItem = {
  key: string;
  title: string;
  /** YYYY-MM-DD; the bar starts on the deadline when the task has no start date */
  start: string;
  /** YYYY-MM-DD deadline */
  end: string;
  tone?: "done" | "overdue";
  /** LOW / MEDIUM / HIGH / URGENT, colors the bar */
  priority?: string | null;
  onOpen: () => void;
};

const DAYS = 42;
const STEP = 14;
const DAY_MS = 86_400_000;

/** Whole days between two YYYY-MM-DD dates */
const diff = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);

/** Gantt-like view: one row per dated task, a bar from its start date to its deadline over a 6-week window. */
export function CrmTimeline({ items, undated = 0 }: { items: TimelineItem[]; undated?: number }) {
  const today = todayKey();
  // Window starts one week back, on a Monday
  const firstMonday = (day: string) => addDays(day, -((new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7));
  const [from, setFrom] = useState(() => firstMonday(addDays(today, -7)));
  const to = addDays(from, DAYS - 1);
  const days = Array.from({ length: DAYS }, (_, i) => addDays(from, i));

  const rows = items
    .map((item) => ({ ...item, start: item.start > item.end ? item.end : item.start }))
    .filter((item) => item.end >= from && item.start <= to)
    .sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
  const hidden = items.length - rows.length;

  return (
    <div className="crm-calendar crm-timeline-view">
      <div className="crm-calendar__bar">
        <button type="button" className="deal-icon-btn" title="Duas semanas antes" onClick={() => setFrom((f) => addDays(f, -STEP))}>
          <ChevronLeft size={18} />
        </button>
        <h3 className="crm-calendar__title">
          {new Date(`${from}T12:00:00Z`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" })} –{" "}
          {new Date(`${to}T12:00:00Z`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })}
        </h3>
        <button type="button" className="deal-icon-btn" title="Duas semanas depois" onClick={() => setFrom((f) => addDays(f, STEP))}>
          <ChevronRight size={18} />
        </button>
        <button type="button" className="btn-secondary crm-calendar__today" onClick={() => setFrom(firstMonday(addDays(today, -7)))}>
          Hoje
        </button>
        {(undated > 0 || hidden > 0) && (
          <span className="crm-calendar__undated">
            {[undated > 0 && `${undated} sem prazo`, hidden > 0 && `${hidden} fora do período`].filter(Boolean).join(" · ")}
          </span>
        )}
      </div>

      <div className="crm-timeline-view__scroll">
        <div className="crm-timeline-view__grid" style={{ "--days": DAYS } as React.CSSProperties}>
          <div className="crm-timeline-view__corner">Tarefa</div>
          {days.map((day) => {
            const date = new Date(`${day}T12:00:00Z`);
            const weekend = date.getUTCDay() === 0 || date.getUTCDay() === 6;
            return (
              <div key={day} className={`crm-timeline-view__day ${weekend ? "is-weekend" : ""} ${day === today ? "is-today" : ""}`} title={date.toLocaleDateString("pt-BR", { timeZone: "UTC" })}>
                {date.getUTCDate()}
              </div>
            );
          })}

          {rows.map((item) => {
            const first = Math.max(0, diff(from, item.start));
            const last = Math.min(DAYS - 1, diff(from, item.end));
            return (
              <div key={item.key} className="crm-timeline-view__row">
                <button type="button" className="crm-timeline-view__name" title={item.title} onClick={item.onOpen}>
                  {item.title}
                </button>
                <button
                  type="button"
                  title={`${item.title} · ${item.start === item.end ? "" : `${item.start.split("-").reverse().join("/")} → `}${item.end.split("-").reverse().join("/")}`}
                  className={`crm-timeline-view__bar ${item.tone ? `is-${item.tone}` : ""} ${item.priority ? `crm-timeline-view__bar--${item.priority.toLowerCase()}` : ""}`}
                  style={{ gridColumn: `${first + 2} / ${last + 3}` }}
                  onClick={item.onOpen}
                />
              </div>
            );
          })}
          {rows.length === 0 && <div className="crm-timeline-view__empty">Nenhuma tarefa com prazo neste período.</div>}
        </div>
      </div>
    </div>
  );
}

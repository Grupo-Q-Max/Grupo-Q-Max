"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { todayKey } from "@/lib/crm-due";

export type CalendarItem = {
  key: string;
  /** YYYY-MM-DD */
  day: string;
  title: string;
  tone?: "done" | "overdue";
  /** Small text before the title (e.g. "Chamada") */
  label?: string;
  href?: string;
  onOpen?: () => void;
};

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MAX_PER_DAY = 4;

/** YYYY-MM-DD of a UTC date */
const keyOf = (date: Date) => date.toISOString().slice(0, 10);

/** Every day shown for the month of `month` (YYYY-MM): whole weeks, Sunday first. */
function monthDays(month: string) {
  const first = new Date(`${month}-01T00:00:00Z`);
  const start = new Date(first);
  start.setUTCDate(1 - first.getUTCDay());
  const last = new Date(first);
  last.setUTCMonth(last.getUTCMonth() + 1, 0);
  const end = new Date(last);
  end.setUTCDate(last.getUTCDate() + (6 - last.getUTCDay()));
  const days: string[] = [];
  for (const d = start; d <= end; d.setUTCDate(d.getUTCDate() + 1)) days.push(keyOf(d));
  return days;
}

const shiftMonth = (month: string, by: number) => {
  const d = new Date(`${month}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + by);
  return keyOf(d).slice(0, 7);
};

/** Month grid of dated items. With `onMove`, items can be dragged to another day. */
export function CrmCalendar({ items, onMove, undated = 0 }: { items: CalendarItem[]; onMove?: (key: string, day: string) => void; undated?: number }) {
  const today = todayKey();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [expanded, setExpanded] = useState<string | null>(null);
  const [dropDay, setDropDay] = useState<string | null>(null);
  const byDay = new Map<string, CalendarItem[]>();
  for (const item of items) byDay.set(item.day, [...(byDay.get(item.day) ?? []), item]);
  const title = new Date(`${month}-01T12:00:00Z`).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <div className="crm-calendar">
      <div className="crm-calendar__bar">
        <button type="button" className="deal-icon-btn" title="Mês anterior" onClick={() => setMonth((m) => shiftMonth(m, -1))}>
          <ChevronLeft size={18} />
        </button>
        <h3 className="crm-calendar__title">{title}</h3>
        <button type="button" className="deal-icon-btn" title="Próximo mês" onClick={() => setMonth((m) => shiftMonth(m, 1))}>
          <ChevronRight size={18} />
        </button>
        <button type="button" className="btn-secondary crm-calendar__today" onClick={() => setMonth(today.slice(0, 7))}>
          Hoje
        </button>
        {undated > 0 && <span className="crm-calendar__undated">{undated} sem prazo (não aparecem aqui)</span>}
      </div>

      <div className="crm-calendar__grid">
        {WEEKDAYS.map((d) => (
          <div key={d} className="crm-calendar__weekday">
            {d}
          </div>
        ))}
        {monthDays(month).map((day) => {
          const list = byDay.get(day) ?? [];
          const shown = expanded === day ? list : list.slice(0, MAX_PER_DAY);
          return (
            <div
              key={day}
              className={[
                "crm-calendar__day",
                day.slice(0, 7) !== month && "is-other-month",
                day === today && "is-today",
                dropDay === day && "is-drop",
              ]
                .filter(Boolean)
                .join(" ")}
              onDragOver={onMove && ((e) => (e.preventDefault(), setDropDay(day)))}
              onDragLeave={onMove && (() => setDropDay((d) => (d === day ? null : d)))}
              onDrop={
                onMove &&
                ((e) => {
                  e.preventDefault();
                  setDropDay(null);
                  const key = e.dataTransfer.getData("text/plain");
                  if (key && items.find((i) => i.key === key)?.day !== day) onMove(key, day);
                })
              }
            >
              <span className="crm-calendar__date">{Number(day.slice(8))}</span>
              {shown.map((item) => {
                const content = (
                  <>
                    {item.label && <span className="crm-calendar__label">{item.label}</span>}
                    {item.title}
                  </>
                );
                const className = `crm-calendar__item ${item.tone ? `is-${item.tone}` : ""}`;
                return item.href ? (
                  <Link key={item.key} href={item.href} className={className} title={item.title}>
                    {content}
                  </Link>
                ) : (
                  <button
                    key={item.key}
                    type="button"
                    className={className}
                    title={item.title}
                    draggable={!!onMove}
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", item.key)}
                    onClick={item.onOpen}
                  >
                    {content}
                  </button>
                );
              })}
              {list.length > MAX_PER_DAY && expanded !== day && (
                <button type="button" className="crm-calendar__more" onClick={() => setExpanded(day)}>
                  +{list.length - MAX_PER_DAY} mais
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

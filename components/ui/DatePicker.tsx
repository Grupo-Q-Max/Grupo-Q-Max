"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { anchorPopover, useAnchoredPopover } from "./Select";
import "./ui.css";

// Drop-in for <input type="date" | "datetime-local">: same value strings
// ("YYYY-MM-DD" / "YYYY-MM-DDTHH:mm") and `onChange={(e) => e.target.value}` shape.

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];
const monthFormat = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
const monthLabel = (d: Date) => monthFormat.format(d).replace(/^./, (c) => c.toUpperCase());

/** Local YYYY-MM-DD */
const dayOf = (d: Date) => d.toLocaleDateString("sv-SE");
const parseDay = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (day: string, n: number) => {
  const d = parseDay(day);
  d.setDate(d.getDate() + n);
  return dayOf(d);
};
const addMonths = (day: string, n: number) => {
  const d = parseDay(day);
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1);
  // Clamp 31 → last day of a shorter month.
  target.setDate(Math.min(d.getDate(), new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()));
  return dayOf(target);
};

type DatePickerProps = {
  value: string;
  onChange: (e: { target: { value: string } }) => void;
  type?: "date" | "datetime-local";
  min?: string;
  max?: string;
  className?: string;
  disabled?: boolean;
  "aria-label"?: string;
};

export function DatePicker({ value, onChange, type = "date", min, max, className, disabled, ...aria }: DatePickerProps) {
  const withTime = type === "datetime-local";
  const day = value.slice(0, 10);
  const time = value.slice(11, 16);
  const minDay = min?.slice(0, 10);
  const maxDay = max?.slice(0, 10);

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(day || dayOf(new Date()));
  const button = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const popId = useId();

  const outOfRange = (d: string) => (!!minDay && d < minDay) || (!!maxDay && d > maxDay);
  const emit = (v: string) => v !== value && onChange({ target: { value: v } });
  const hide = () => pop.current?.hidePopover();

  const choose = (d: string) => {
    if (outOfRange(d)) return;
    emit(withTime ? `${d}T${time || "09:00"}` : d);
    if (!withTime) hide();
  };

  useAnchoredPopover(open, pop, hide);

  // Roving focus: the active day button holds focus while the grid is open.
  useEffect(() => {
    if (open) pop.current?.querySelector<HTMLButtonElement>(`[data-day="${active}"]`)?.focus();
  }, [open, active]);

  const onGridKeyDown = (e: KeyboardEvent) => {
    const moves: Record<string, () => string> = {
      ArrowLeft: () => addDays(active, -1),
      ArrowRight: () => addDays(active, 1),
      ArrowUp: () => addDays(active, -7),
      ArrowDown: () => addDays(active, 7),
      PageUp: () => addMonths(active, -1),
      PageDown: () => addMonths(active, 1),
    };
    if (moves[e.key]) {
      e.preventDefault();
      setActive(moves[e.key]());
    }
  };

  // 6 weeks starting on the Sunday on/before the 1st of the active month.
  const first = parseDay(active.slice(0, 8) + "01");
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return dayOf(d);
  });
  const month = active.slice(0, 7);
  const today = dayOf(new Date());

  const label = day ? `${day.split("-").reverse().join("/")}${withTime && time ? ` ${time}` : ""}` : withTime ? "dd/mm/aaaa --:--" : "dd/mm/aaaa";

  return (
    <>
      <button
        ref={button}
        type="button"
        className={`qselect qdate${day ? "" : " qselect--empty"}${className ? ` ${className}` : ""}`}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={popId}
        aria-label={aria["aria-label"] ? `${aria["aria-label"]}: ${day ? label : "vazio"}` : undefined}
        popoverTarget={popId}
        onClick={() => anchorPopover(button.current!, pop.current!, 340, 420)}
      >
        <span className="qselect__label">{label}</span>
        <Calendar className="qselect__chevron" size={15} aria-hidden />
      </button>
      <div
        ref={pop}
        id={popId}
        popover="auto"
        role="dialog"
        aria-label={aria["aria-label"] ?? "Escolher data"}
        className="qselect__list qdate__pop"
        onToggle={(e) => {
          const isOpen = e.newState === "open";
          setOpen(isOpen);
          // Start on a pickable day so focus lands on an enabled button.
          if (isOpen) setActive(day || (minDay && today < minDay ? minDay : maxDay && today > maxDay ? maxDay : today));
          else if (pop.current?.contains(document.activeElement) || document.activeElement === document.body) button.current?.focus();
        }}
        onKeyDown={(e) => e.key === "Escape" && e.stopPropagation()} // the popover closes itself; keep modals behind open
        // Stop an enclosing <label> from forwarding clicks on non-controls back to the trigger.
        onClick={(e) => (e.target as Element).closest("button, input") || e.preventDefault()}
      >
        <div className="qdate__head">
          <button type="button" className="qdate__nav" aria-label="Mês anterior" onClick={() => setActive(addMonths(active, -1))}>
            <ChevronLeft size={16} aria-hidden />
          </button>
          <span className="qdate__month" aria-live="polite">
            {monthLabel(first)}
          </span>
          <button type="button" className="qdate__nav" aria-label="Próximo mês" onClick={() => setActive(addMonths(active, 1))}>
            <ChevronRight size={16} aria-hidden />
          </button>
        </div>
        <div className="qdate__grid" role="grid" onKeyDown={onGridKeyDown}>
          {WEEKDAYS.map((w, i) => (
            <span key={i} className="qdate__weekday" aria-hidden>
              {w}
            </span>
          ))}
          {days.map((d) => (
            <button
              key={d}
              type="button"
              data-day={d}
              tabIndex={d === active ? 0 : -1}
              disabled={outOfRange(d)}
              aria-pressed={d === day}
              aria-label={parseDay(d).toLocaleDateString("pt-BR", { dateStyle: "full" })}
              className={`qdate__day${d.startsWith(month) ? "" : " is-outside"}${d === today ? " is-today" : ""}${d === day ? " is-selected" : ""}`}
              onClick={() => {
                setActive(d);
                choose(d);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  choose(d);
                }
              }}
            >
              {Number(d.slice(8))}
            </button>
          ))}
        </div>
        <div className="qdate__foot">
          {withTime && (
            <input
              type="time"
              className="qdate__time"
              aria-label="Hora"
              value={time}
              disabled={!day}
              onChange={(e) => e.target.value && emit(`${day}T${e.target.value}`)}
            />
          )}
          <button
            type="button"
            className="qdate__link"
            onClick={() => {
              emit("");
              hide();
            }}
          >
            Limpar
          </button>
          <button
            type="button"
            className="qdate__link"
            disabled={outOfRange(today)}
            onClick={() => {
              setActive(today);
              choose(today);
            }}
          >
            Hoje
          </button>
        </div>
      </div>
    </>
  );
}

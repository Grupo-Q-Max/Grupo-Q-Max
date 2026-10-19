"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import { anchorPopover, useAnchoredPopover } from "./Select";
import "./ui.css";

type Option = { value: string; label: string; icon?: ReactNode };

/** Lists longer than this get a search field */
const SEARCH_FROM = 7;

/**
 * Select of several values (checkboxes) in the same popover as Select; the list stays open while picking.
 * An empty selection shows `placeholder` ("Todos").
 */
export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = "Todos",
  className,
  ...aria
}: {
  options: Option[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const button = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const listId = useId();

  const hide = () => pop.current?.hidePopover();
  useAnchoredPopover(open, pop, hide);

  const shown = query.trim() ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase())) : options;
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  const picked = options.filter((o) => value.includes(o.value));
  const label = picked.length === 0 ? placeholder : picked.length === 1 ? picked[0].label : `${picked.length} selecionados`;

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") return e.stopPropagation(); // the popover closes itself; keep modals behind open
    if (e.key === "ArrowDown") setActive((i) => Math.min(i + 1, shown.length - 1));
    else if (e.key === "ArrowUp") setActive((i) => Math.max(i - 1, 0));
    else if (e.key === "Enter" && shown[active]) toggle(shown[active].value);
    else if (e.key === "Tab") return hide();
    else return;
    e.preventDefault();
  };

  return (
    <>
      <button
        ref={button}
        type="button"
        className={`qselect${picked.length ? "" : " qselect--empty"}${className ? ` ${className}` : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={aria["aria-label"]}
        popoverTarget={listId}
        onClick={() => anchorPopover(button.current!, pop.current!)}
      >
        <span className="qselect__label">{label}</span>
        <ChevronDown className="qselect__chevron" size={16} aria-hidden />
      </button>
      <div
        ref={pop}
        id={listId}
        popover="auto"
        className="qselect__list qmulti"
        tabIndex={-1}
        onToggle={(e) => {
          const isOpen = e.newState === "open";
          setOpen(isOpen);
          setQuery("");
          setActive(0);
          if (isOpen) (search.current ?? pop.current)?.focus();
          else if (pop.current?.contains(document.activeElement) || document.activeElement === document.body) button.current?.focus();
        }}
        onKeyDown={onKeyDown}
      >
        {options.length >= SEARCH_FROM && (
          <input
            ref={search}
            className="qmulti__search"
            placeholder="Pesquisar..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
          />
        )}
        <ul role="listbox" aria-multiselectable aria-label={aria["aria-label"]}>
          {shown.map((o, i) => {
            const selected = value.includes(o.value);
            return (
              <li
                key={o.value}
                role="option"
                aria-selected={selected}
                className={`qselect__option${i === active ? " is-active" : ""}${selected ? " is-selected" : ""}`}
                onMouseMove={() => setActive(i)}
                onClick={() => toggle(o.value)}
              >
                <span className={`qmulti__box${selected ? " is-checked" : ""}`} aria-hidden>
                  {selected && <Check size={11} />}
                </span>
                {o.icon}
                <span className="qmulti__label">{o.label}</span>
              </li>
            );
          })}
          {shown.length === 0 && <li className="qmulti__empty">Nada encontrado</li>}
        </ul>
        {value.length > 0 && (
          <button type="button" className="qmulti__clear" onClick={() => onChange([])}>
            Limpar seleção
          </button>
        )}
      </div>
    </>
  );
}

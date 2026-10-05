"use client";

import { useId, useRef, type ReactNode } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";

export type FilterChip = { key: string; label: string; onRemove: () => void };

/**
 * Search field that holds the active filters as chips. Clicking it opens a panel
 * with the filter controls (`children`), which apply as they change.
 */
export function FilterSearch({
  value,
  onChange,
  placeholder,
  chips,
  onClear,
  children,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  chips: FilterChip[];
  /** Clears the text and every filter */
  onClear: () => void;
  children: ReactNode;
  className?: string;
}) {
  const panelId = useId();
  const field = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const filtering = value.trim() !== "" || chips.length > 0;

  // Fixed below the field; the panel lives in the top layer, so no ancestor clips it.
  // ponytail: position is set on open only; it doesn't follow page scroll while open.
  const open = () => {
    const el = panel.current!;
    const r = field.current!.getBoundingClientRect();
    const width = Math.min(Math.max(r.width, 360), innerWidth - 16);
    el.style.width = `${width}px`;
    el.style.top = `${r.bottom + 6}px`;
    el.style.left = `${Math.max(8, Math.min(r.left, innerWidth - width - 8))}px`;
    if (!el.matches(":popover-open")) el.showPopover();
  };
  const close = () => panel.current?.hidePopover();

  return (
    <div
      ref={field}
      className={`crm-filter-search${className ? ` ${className}` : ""}`}
      onClick={open}
      onKeyDown={(e) => {
        // Native light dismiss misses Escape while focus is in the field or on a control in the panel.
        // With the panel open, Escape only closes it (instead of also clearing the search text).
        if (e.key !== "Escape" || !panel.current?.matches(":popover-open")) return;
        e.preventDefault();
        close();
      }}
    >
      <Search size={16} className="crm-filter-search__lead" aria-hidden />
      {chips.map((chip) => (
        <span key={chip.key} className="crm-filter-search__chip">
          {chip.label}
          <button
            type="button"
            aria-label={`Remover filtro ${chip.label}`}
            onClick={(e) => {
              e.stopPropagation();
              chip.onRemove();
            }}
          >
            <X size={12} />
          </button>
        </span>
      ))}
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={chips.length ? "Buscar..." : placeholder}
        aria-label={placeholder}
        aria-controls={panelId}
      />
      {filtering && (
        <button
          type="button"
          className="crm-filter-search__icon"
          aria-label="Limpar busca e filtros"
          title="Limpar busca e filtros"
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
        >
          <X size={16} />
        </button>
      )}
      <button type="button" className="crm-filter-search__icon" aria-label="Abrir filtros" title="Filtros" aria-controls={panelId}>
        <SlidersHorizontal size={16} />
      </button>

      <div
        ref={panel}
        id={panelId}
        popover="auto"
        role="dialog"
        aria-label="Filtros"
        className="crm-filter-panel"
        // Keep clicks inside the panel from reaching the field (which reopens/repositions it)
        onClick={(e) => e.stopPropagation()}
      >
        <div className="crm-filter-panel__header">
          <strong>Filtros</strong>
          <button type="button" className="crm-filter-search__icon" aria-label="Fechar filtros" onClick={close}>
            <X size={16} />
          </button>
        </div>
        <div className="crm-filter-panel__fields">{children}</div>
        <div className="crm-filter-panel__footer">
          <button type="button" className="btn-secondary" onClick={onClear} disabled={!filtering}>
            Limpar
          </button>
          <button type="button" className="btn-primary" onClick={close}>
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
}

/** A labelled control inside the filter panel. */
export function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="crm-filter-panel__field">
      <span>{label}</span>
      {children}
    </div>
  );
}

"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { TeamMember } from "./types";

export function Field({ label, required, children, aside }: {
  label: string;
  required?: boolean;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="deal-field">
      <span className="deal-field__label">
        <span>
          {label}
          {required && <em className="deal-field__required">*</em>}
        </span>
        {aside}
      </span>
      {children}
    </div>
  );
}

export function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="deal-section">
      <header className="deal-section__header">
        <h3>{title}</h3>
        {action}
      </header>
      <div className="deal-section__body">{children}</div>
    </section>
  );
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

export function Avatar({ member, size = 28 }: { member?: TeamMember | null; size?: number }) {
  if (!member) return null;
  return (
    <span className="deal-avatar" style={{ width: size, height: size, fontSize: size * 0.38 }} title={member.name}>
      {member.image ? <img src={member.image} alt={member.name} /> : initials(member.name)}
    </span>
  );
}

export function formatDay(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Hoje";
  if (date.toDateString() === yesterday.toDateString()) return "Ontem";
  return date.toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
    ...(date.getFullYear() !== today.getFullYear() && { year: "numeric" }),
  });
}

export const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    weekday: "short",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });

/** Dates saved as YYYY-MM-DD are stored at UTC midnight; format them in UTC so the day doesn't shift. */
export const formatDateOnly = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "UTC" });

/**
 * Text input with suggestions from /api/crm/lookup, used to link an existing
 * company/contact/product instead of creating a duplicate.
 */
export function LookupInput<T extends { id: string; name: string }>({
  type,
  value,
  placeholder,
  onChange,
  onPick,
  describe,
}: {
  type: "company" | "contact" | "product";
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  onPick: (item: T) => void;
  describe?: (item: T) => string;
}) {
  const [focused, setFocused] = useState(false);
  const [items, setItems] = useState<T[]>([]);

  useEffect(() => {
    if (!focused || value.trim().length < 2) {
      setItems([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/crm/lookup?type=${type}&q=${encodeURIComponent(value.trim())}`, { signal: controller.signal })
        .then((res) => (res.ok ? res.json() : []))
        .then(setItems)
        .catch(() => {});
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [type, value, focused]);

  return (
    <div className="deal-lookup">
      <input
        className="deal-input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        // Delay so a click on a suggestion lands before the list closes
        onBlur={() => setTimeout(() => setFocused(false), 150)}
      />
      {focused && items.length > 0 && (
        <ul className="deal-lookup__list">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onPick(item);
                  setFocused(false);
                }}
              >
                <strong>{item.name}</strong>
                {describe && <span>{describe(item)}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Shown on a contact/company that is linked to an existing record. */
export function LinkedBadge({ onUnlink }: { onUnlink: () => void }) {
  return (
    <span className="deal-linked">
      cadastro existente
      <button type="button" title="Desvincular e criar um novo cadastro" onClick={onUnlink}>
        desvincular
      </button>
    </span>
  );
}

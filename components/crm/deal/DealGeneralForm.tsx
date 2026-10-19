"use client";

import { useEffect, useState } from "react";
import { Lock, Mail, Phone, Plus, Trash2, X } from "lucide-react";
import {
  CURRENCIES,
  DEAL_TYPES,
  PRIORITIES,
  RECURRENCES,
  type BlockerCard,
  type CrmTagDto,
  type Priority,
  SOURCES,
  emptyCompany,
  emptyContact,
  formatMinutes,
  formatMoney,
  parseMinutes,
  productsTotal,
  toDateInput,
  type DealCompany,
  type DealContact,
  type DealDetails,
  type DealDraft,
  type DealProduct,
  type TeamMember,
} from "./types";
import { Avatar, Field, LinkedBadge, LookupInput, Section } from "./ui";
import { TimeTracker, Subtasks } from "./DealTaskTools";
import { DealLinks } from "./DealLinks";
import { Select } from "@/components/ui/Select";
import { DatePicker } from "@/components/ui/DatePicker";

type Props = {
  deal: DealDetails;
  draft: DealDraft;
  onChange: (changes: Partial<DealDraft>) => void;
  team: TeamMember[];
  onStageChange: (stageId: string) => void;
  onOpenProducts: () => void;
  /** Reloads the deal keeping unsaved edits (after the timer or a subtask changed it) */
  onReload: () => void;
  onOpenCard: (card: { id: string; number: number }) => void;
};

/** "Lembrar antes" options in minutes: with a due time, and without one (counted from 09:00 of the day) */
const REMINDER_OPTIONS = [
  [15, "15 min antes"],
  [30, "30 min antes"],
  [60, "1 hora antes"],
  [120, "2 horas antes"],
  [1440, "1 dia antes"],
  [2880, "2 dias antes"],
  [10080, "1 semana antes"],
] as const;
const DAY_REMINDER_OPTIONS = [
  [0, "No dia, às 9h"],
  [1440, "1 dia antes, às 9h"],
  [2880, "2 dias antes, às 9h"],
  [10080, "1 semana antes, às 9h"],
] as const;

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];
const WEEKDAY_NAMES = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const RECURRENCE_UNITS: Record<string, string> = { DAILY: "dia(s)", WEEKLY: "semana(s)", MONTHLY: "mês(es)", YEARLY: "ano(s)" };

const UTM_LABELS: Record<string, string> = {
  source: "utm_source",
  medium: "utm_medium",
  campaign: "utm_campaign",
  content: "utm_content",
  term: "utm_term",
};

const MEMBER_FIELDS = {
  observers: { label: "Observadores", noun: "observador" },
  assignees: { label: "Corresponsáveis", noun: "corresponsável" },
} as const;

/** Member list of the card: observers (watch it) or co-assignees (share it with the responsible). */
function ObserversField({
  field = "observers",
  observers,
  team,
  onChange,
  exclude,
}: {
  field?: keyof typeof MEMBER_FIELDS;
  observers: string[];
  team: Props["team"];
  onChange: Props["onChange"];
  /** Not offered (e.g. the main responsible among the co-assignees) */
  exclude?: string | null;
}) {
  const { label, noun } = MEMBER_FIELDS[field];
  return (
    <Field label={label}>
      <div className="deal-chips">
        {observers.map((id) => {
          const member = team.find((m) => m.id === id);
          return (
            <span className="deal-chip" key={id}>
              <Avatar member={member} size={20} />
              {member?.name ?? "Membro removido"}
              <button
                type="button"
                title={`Remover ${noun}`}
                onClick={() => onChange({ [field]: observers.filter((o) => o !== id) })}
              >
                <X size={12} />
              </button>
            </span>
          );
        })}
        <Select
          className="deal-input deal-input--inline"
          value=""
          onChange={(e) => e.target.value && onChange({ [field]: [...observers, e.target.value] })}
        >
          <option value="">+ Adicionar {noun}</option>
          {team
            .filter((m) => !observers.includes(m.id) && m.id !== exclude)
            .map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
        </Select>
      </div>
    </Field>
  );
}

function CustomFieldsSection({ deal, draft, onChange }: Pick<Props, "deal" | "draft" | "onChange">) {
  const customFields = deal.pipeline.fieldsConfig ?? [];
  if (customFields.length === 0) return null;
  return (
    <Section title="Campos adicionais">
      {customFields.map((field) => (
        <Field key={field.id} label={field.name} required={field.required}>
          <input
            className="deal-input"
            type={field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "phone" ? "tel" : "text"}
            value={draft.customData?.[field.id] ?? ""}
            onChange={(e) => onChange({ customData: { ...draft.customData, [field.id]: e.target.value } })}
          />
        </Field>
      ))}
    </Section>
  );
}

const jsonRequest = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const TAG_COLORS = ["#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#64748b"];

function TagsField({ tags, onChange }: { tags: string[]; onChange: Props["onChange"] }) {
  const [all, setAll] = useState<CrmTagDto[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(TAG_COLORS[0]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/crm/tag", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : []))
      .then(setAll)
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const create = async () => {
    setError(null);
    const res = await fetch("/api/crm/tag", jsonRequest("POST", { name, color }));
    const body = await res.json().catch(() => null);
    if (!res.ok) return setError(body?.error ?? "Não foi possível criar.");
    setAll((list) => [...list, body].sort((a, b) => a.name.localeCompare(b.name)));
    onChange({ tags: [...tags, body.id] });
    setName("");
    setCreating(false);
  };

  return (
    <Field label="Etiquetas">
      <div className="deal-chips">
        {tags.map((id) => {
          const tag = all.find((t) => t.id === id);
          if (!tag) return null;
          return (
            <span className="deal-chip crm-tag" key={id} style={{ "--tag-color": tag.color } as React.CSSProperties}>
              {tag.name}
              <button type="button" title="Remover etiqueta" onClick={() => onChange({ tags: tags.filter((t) => t !== id) })}>
                <X size={12} />
              </button>
            </span>
          );
        })}
        <Select
          className="deal-input deal-input--inline"
          value=""
          onChange={(e) => {
            if (e.target.value === "__new") setCreating(true);
            else if (e.target.value) onChange({ tags: [...tags, e.target.value] });
          }}
        >
          <option value="">+ Adicionar etiqueta</option>
          {all
            .filter((t) => !tags.includes(t.id))
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          <option value="__new">Nova etiqueta…</option>
        </Select>
      </div>
      {creating && (
        <div className="deal-row crm-tag-new">
          <input className="deal-input" placeholder="Nome da etiqueta" maxLength={50} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <span className="crm-tag-colors">
            {TAG_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                title={c}
                aria-pressed={color === c}
                className={`crm-tag-color ${color === c ? "is-active" : ""}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </span>
          <button type="button" className="deal-link-btn" disabled={!name.trim()} onClick={create}>
            criar
          </button>
          <button type="button" className="deal-icon-btn" title="Cancelar" onClick={() => setCreating(false)}>
            <X size={14} />
          </button>
        </div>
      )}
      {error && <span className="deal-field__hint">{error}</span>}
    </Field>
  );
}

/** Duration typed as "1h30" / "90" and kept in minutes; the text is read when the field loses focus. */
function DurationInput({ minutes, onChange }: { minutes: number | null; onChange: (minutes: number | null) => void }) {
  const [text, setText] = useState(formatMinutes(minutes) ?? "");
  const [invalid, setInvalid] = useState(false);
  useEffect(() => setText(formatMinutes(minutes) ?? ""), [minutes]);
  return (
    <>
      <input
        className="deal-input"
        placeholder="Ex: 1h30"
        value={text}
        aria-invalid={invalid}
        onChange={(e) => {
          setText(e.target.value);
          setInvalid(false);
        }}
        onBlur={() => {
          const parsed = parseMinutes(text);
          // Unreadable text keeps the saved value instead of clearing it
          if (parsed === null && text.trim()) return setInvalid(true);
          if (parsed === minutes) setText(formatMinutes(minutes) ?? "");
          else onChange(parsed);
        }}
      />
      {invalid && <span className="deal-field__hint">Use formatos como 1h30, 90 ou 1,5h.</span>}
    </>
  );
}

/** "Bloqueada por": cards of the same pipeline that must be done before this one. Also lists the cards this one blocks. */
function BlockedByField({ deal, blockedBy, onChange }: { deal: DealDetails; blockedBy: BlockerCard[]; onChange: Props["onChange"] }) {
  const [query, setQuery] = useState("");
  return (
    <>
      {deal.blocks.length > 0 && (
        <Field label="Bloqueia">
          <div className="deal-chips">
            {deal.blocks.map((card) => (
              <span key={card.id} className={`deal-chip ${card.status === "OPEN" ? "" : "deal-chip--done"}`}>
                <a href={`/crm/deal/details/${card.number}`}>#{card.number} {card.title}</a>
              </span>
            ))}
          </div>
        </Field>
      )}
      <Field label="Bloqueada por">
        {blockedBy.length > 0 && (
          <div className="deal-chips">
            {blockedBy.map((card) => (
              <span key={card.id} className={`deal-chip ${card.status === "OPEN" ? "" : "deal-chip--done"}`}>
                {card.status === "OPEN" && <Lock size={11} />}
                <a href={`/crm/deal/details/${card.number}`}>#{card.number} {card.title}</a>
                <button type="button" title="Remover" onClick={() => onChange({ blockedBy: blockedBy.filter((c) => c.id !== card.id) })}>
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
        <LookupInput<BlockerCard & { name: string }>
          type="card"
          params={`&pipelineId=${encodeURIComponent(deal.pipeline.id)}`}
          value={query}
          placeholder="Buscar tarefa por nome ou #nº"
          onChange={setQuery}
          onPick={({ name: _, ...card }) => {
            setQuery("");
            if (card.id !== deal.id && !blockedBy.some((c) => c.id === card.id)) onChange({ blockedBy: [...blockedBy, card] });
          }}
        />
      </Field>
    </>
  );
}

/** Task boards (pipeline kind TASKS): same card, only what an internal to-do needs. Checklist = activities in the timeline. */
function TaskGeneralForm({ deal, draft, onChange, team, onStageChange, onReload, onOpenCard }: Props) {
  const responsible = team.find((m) => m.id === draft.responsibleId);
  return (
    <div className="deal-form">
      <Section title="Sobre a tarefa">
        <Field label="Nome" required>
          <input className="deal-input" value={draft.title} onChange={(e) => onChange({ title: e.target.value })} />
        </Field>
        <Field label="Coluna">
          <Select className="deal-input" value={deal.stageId} onChange={(e) => onStageChange(e.target.value)}>
            {deal.pipeline.stages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Prazo">
          <div className="deal-row">
            <DatePicker
              className="deal-input deal-input--date"
              value={toDateInput(draft.closeDate)}
              onChange={(e) => onChange({ closeDate: e.target.value || null, ...(!e.target.value && { dueTime: null, reminderMinutes: null }) })}
            />
            <input
              type="time"
              className="deal-input"
              aria-label="Hora do prazo"
              title="Hora do prazo (opcional)"
              disabled={!draft.closeDate}
              value={draft.dueTime ?? ""}
              onChange={(e) => onChange({ dueTime: e.target.value || null, ...(!e.target.value && { reminderMinutes: null }) })}
            />
          </div>
          {draft.closeDate && (
            <Select
              className="deal-input"
              aria-label="Lembrete antes do prazo"
              value={String(draft.reminderMinutes ?? "")}
              onChange={(e) => onChange({ reminderMinutes: e.target.value ? Number(e.target.value) : null })}
            >
              <option value="">Sem lembrete extra</option>
              {(draft.dueTime ? REMINDER_OPTIONS : DAY_REMINDER_OPTIONS).map(([minutes, label]) => (
                <option key={minutes} value={minutes}>
                  {label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Responsável">
          <div className="deal-person">
            <Avatar member={responsible} size={36} />
            <Select
              className="deal-input"
              value={draft.responsibleId ?? ""}
              onChange={(e) => onChange({ responsibleId: e.target.value || null })}
            >
              <option value="">Sem responsável</option>
              {team.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name} — {member.role}
                </option>
              ))}
            </Select>
          </div>
        </Field>
        <ObserversField field="assignees" observers={draft.assignees} team={team} onChange={onChange} exclude={draft.responsibleId} />
        <Field label="Prioridade">
          <Select className="deal-input" value={draft.priority ?? ""} onChange={(e) => onChange({ priority: (e.target.value || null) as Priority | null })}>
            <option value="">Sem prioridade</option>
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
        </Field>
        <TagsField tags={draft.tags} onChange={onChange} />
        <BlockedByField deal={deal} blockedBy={draft.blockedBy} onChange={onChange} />
        <Subtasks deal={deal} team={team} onReload={onReload} onOpenCard={onOpenCard} />
        <DealLinks deal={deal} onOpenCard={onOpenCard} />
        <Field label="Estimativa">
          <DurationInput minutes={draft.estimateMinutes} onChange={(estimateMinutes) => onChange({ estimateMinutes })} />
        </Field>
        {!deal.isTemplate && <TimeTracker deal={deal} team={team} onReload={onReload} />}
        <Field label="Descrição">
          <textarea className="deal-input" rows={6} value={draft.comment ?? ""} onChange={(e) => onChange({ comment: e.target.value })} />
        </Field>
        <ObserversField observers={draft.observers} team={team} onChange={onChange} />
        <label className="deal-checkbox" title="Desmarcado: só o responsável, corresponsáveis, observadores e administradores veem a tarefa">
          <input type="checkbox" checked={draft.isPublic} onChange={(e) => onChange({ isPublic: e.target.checked })} />
          Visível para todos do quadro
        </label>
        <Field
          label="Repetir"
          aside={draft.recurrence !== "NONE" && <span className="deal-field__hint">cria a próxima ao concluir</span>}
        >
          <Select className="deal-input" value={draft.recurrence} onChange={(e) => onChange({ recurrence: e.target.value })}>
            {RECURRENCES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
          {draft.recurrence !== "NONE" && <RecurrenceDetails draft={draft} onChange={onChange} />}
        </Field>
      </Section>
      <CustomFieldsSection deal={deal} draft={draft} onChange={onChange} />
    </div>
  );
}

/** "a cada N" and, for weekly tasks, the weekdays it repeats on */
function RecurrenceDetails({ draft, onChange }: { draft: DealDraft; onChange: Props["onChange"] }) {
  const mask = draft.recurrenceWeekdays ?? 0;
  return (
    <div className="deal-row crm-recurrence">
      <label className="crm-recurrence__every">
        a cada
        <input
          type="number"
          min={1}
          max={365}
          className="deal-input"
          aria-label="Repetir a cada"
          value={draft.recurrenceInterval ?? 1}
          onChange={(e) => onChange({ recurrenceInterval: Number(e.target.value) > 1 ? Number(e.target.value) : null })}
        />
        {RECURRENCE_UNITS[draft.recurrence]}
      </label>
      {draft.recurrence === "WEEKLY" && (
        <span className="crm-recurrence__days" role="group" aria-label="Dias da semana">
          {WEEKDAYS.map((letter, day) => (
            <button
              key={day}
              type="button"
              title={WEEKDAY_NAMES[day]}
              aria-pressed={!!(mask & (1 << day))}
              className={`crm-recurrence__day ${mask & (1 << day) ? "is-active" : ""}`}
              onClick={() => onChange({ recurrenceWeekdays: mask ^ (1 << day) || null })}
            >
              {letter}
            </button>
          ))}
        </span>
      )}
    </div>
  );
}

export function DealGeneralForm(props: Props) {
  if (props.deal.pipeline.kind === "TASKS") return <TaskGeneralForm {...props} />;
  const { deal, draft, onChange, team, onStageChange, onOpenProducts, onOpenCard } = props;
  const contacts = draft.contacts.length ? draft.contacts : [emptyContact()];
  const company = draft.company ?? emptyCompany();
  const observers = draft.observers;
  const products = draft.products;
  const hasProducts = products.length > 0;
  const responsible = team.find((m) => m.id === draft.responsibleId);
  const utmEntries = Object.entries(deal.utm ?? {}).filter(([, v]) => v);

  const updateContact = (index: number, changes: Partial<DealContact>) =>
    onChange({ contacts: contacts.map((c, i) => (i === index ? { ...c, ...changes } : c)) });

  const updateCompany = (changes: Partial<DealCompany>) => onChange({ company: { ...company, ...changes } });

  return (
    <div className="deal-form">
      <Section title="Sobre o negócio">
        <Field label="Nome" required>
          <input className="deal-input" value={draft.title} onChange={(e) => onChange({ title: e.target.value })} />
        </Field>

        <Field label="Etapa">
          <Select
            className="deal-input"
            value={deal.stageId}
            onChange={(e) => onStageChange(e.target.value)}
          >
            {deal.pipeline.stages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Valor e moeda"
          aside={hasProducts && <span className="deal-field__hint">calculado pelos serviços</span>}
        >
          <div className="deal-row">
            <input
              className="deal-input"
              type="number"
              step="0.01"
              min="0"
              disabled={hasProducts}
              value={draft.value}
              onChange={(e) => onChange({ value: Number(e.target.value) })}
            />
            <Select
              className="deal-input deal-input--narrow"
              value={draft.currency}
              onChange={(e) => onChange({ currency: e.target.value })}
            >
              {CURRENCIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>
        </Field>

        <Field label="Data de término">
          <DatePicker
            className="deal-input deal-input--date"
            value={toDateInput(draft.closeDate)}
            onChange={(e) => onChange({ closeDate: e.target.value || null })}
          />
        </Field>

        <div className="deal-subgroup">
          <span className="deal-subgroup__title">Cliente</span>

          {contacts.map((contact, index) => (
            <div className="deal-entity" key={contact.id ?? `new-${index}`}>
              <div className="deal-entity__header">
                <span>{index === 0 ? "Contato" : `Participante ${index}`}</span>
                <span className="deal-entity__tools">
                  {contact.id && <LinkedBadge onUnlink={() => updateContact(index, { id: undefined })} />}
                  {contacts.length > 1 && (
                    <button
                      type="button"
                      className="deal-icon-btn"
                      title="Remover do negócio"
                      onClick={() => onChange({ contacts: contacts.filter((_, i) => i !== index) })}
                    >
                      <X size={14} />
                    </button>
                  )}
                </span>
              </div>
              <LookupInput<Required<DealContact>>
                type="contact"
                placeholder="Nome do contato (busca contatos cadastrados)"
                value={contact.name}
                onChange={(name) => updateContact(index, { name })}
                onPick={(picked) => updateContact(index, picked)}
                describe={(c) => [c.phone, c.email].filter(Boolean).join(" · ")}
              />
              <Field label="Telefone" aside={contact.phone && <a href={`tel:${contact.phone}`} className="deal-field__link"><Phone size={12} /> ligar</a>}>
                <input
                  className="deal-input"
                  type="tel"
                  placeholder="+55"
                  value={contact.phone}
                  onChange={(e) => updateContact(index, { phone: e.target.value })}
                />
              </Field>
              <Field label="E-mail" aside={contact.email && <a href={`mailto:${contact.email}`} className="deal-field__link"><Mail size={12} /> enviar</a>}>
                <input
                  className="deal-input"
                  type="email"
                  value={contact.email}
                  onChange={(e) => updateContact(index, { email: e.target.value })}
                />
              </Field>
              <Field label="Endereço">
                <input
                  className="deal-input"
                  value={contact.address}
                  onChange={(e) => updateContact(index, { address: e.target.value })}
                />
              </Field>
              <Field label="Informações">
                <textarea
                  className="deal-input"
                  rows={2}
                  value={contact.info}
                  onChange={(e) => updateContact(index, { info: e.target.value })}
                />
              </Field>
            </div>
          ))}

          <button
            type="button"
            className="deal-link-btn"
            onClick={() => onChange({ contacts: [...contacts, emptyContact()] })}
          >
            <Plus size={14} /> Adicionar participante
          </button>

          <div className="deal-entity">
            <div className="deal-entity__header">
              <span>Empresa</span>
              {company.id && <LinkedBadge onUnlink={() => updateCompany({ id: undefined })} />}
            </div>
            <LookupInput<Required<DealCompany>>
              type="company"
              placeholder="Nome da empresa (busca por nome ou CNPJ)"
              value={company.name}
              onChange={(name) => updateCompany({ name })}
              onPick={(picked) => onChange({ company: picked })}
              describe={(c) => c.document}
            />
            {company.id && (
              <span className="deal-field__hint">Alterações nos dados da empresa valem para todos os negócios dela.</span>
            )}
            <Field label="CNPJ">
              <input
                className="deal-input"
                placeholder="00.000.000/0000-00"
                value={company.document}
                onChange={(e) => updateCompany({ document: e.target.value })}
              />
            </Field>
            <Field label="Telefone">
              <input
                className="deal-input"
                type="tel"
                placeholder="+55"
                value={company.phone}
                onChange={(e) => updateCompany({ phone: e.target.value })}
              />
            </Field>
            <Field label="E-mail">
              <input
                className="deal-input"
                type="email"
                value={company.email}
                onChange={(e) => updateCompany({ email: e.target.value })}
              />
            </Field>
            <Field label="Endereço">
              <input
                className="deal-input"
                value={company.address}
                onChange={(e) => updateCompany({ address: e.target.value })}
              />
            </Field>
            <Field label="Informações">
              <textarea
                className="deal-input"
                rows={2}
                value={company.info}
                onChange={(e) => updateCompany({ info: e.target.value })}
              />
            </Field>
          </div>
        </div>

        <Field label="Tipo de negócio">
          <input
            className="deal-input"
            list="deal-types"
            placeholder="Não selecionado"
            value={draft.dealType ?? ""}
            onChange={(e) => onChange({ dealType: e.target.value })}
          />
          <datalist id="deal-types">
            {DEAL_TYPES.map((type) => (
              <option key={type} value={type} />
            ))}
          </datalist>
        </Field>

        <Field label="Fonte">
          <Select className="deal-input" value={draft.source ?? ""} onChange={(e) => onChange({ source: e.target.value })}>
            <option value="">Não selecionado</option>
            {SOURCES.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Informações da fonte">
          <textarea
            className="deal-input"
            rows={3}
            value={draft.sourceInfo ?? ""}
            onChange={(e) => onChange({ sourceInfo: e.target.value })}
          />
        </Field>

        <Field label="Quem trouxe o lead">
          <input
            className="deal-input"
            list="deal-referrers"
            placeholder="Membro da equipe ou pessoa externa"
            maxLength={200}
            value={draft.referredBy ?? ""}
            onChange={(e) => onChange({ referredBy: e.target.value })}
          />
          <datalist id="deal-referrers">
            {team.map((member) => (
              <option key={member.id} value={member.name} />
            ))}
          </datalist>
        </Field>

        <label className="deal-checkbox" title="Desmarcado: só o responsável, observadores e administradores veem o negócio">
          <input type="checkbox" checked={draft.isPublic} onChange={(e) => onChange({ isPublic: e.target.checked })} />
          Disponível para todos
        </label>

        <Field label="Responsável">
          <div className="deal-person">
            <Avatar member={responsible} size={36} />
            <Select
              className="deal-input"
              value={draft.responsibleId ?? ""}
              onChange={(e) => onChange({ responsibleId: e.target.value || null })}
            >
              <option value="">Sem responsável</option>
              {team.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name} — {member.role}
                </option>
              ))}
            </Select>
          </div>
        </Field>
      </Section>

      <CustomFieldsSection deal={deal} draft={draft} onChange={onChange} />

      <Section title="Mais">
        <Field label="Data de início">
          <DatePicker
            className="deal-input deal-input--date"
            value={toDateInput(draft.startDate)}
            onChange={(e) => onChange({ startDate: e.target.value || null })}
          />
        </Field>

        <ObserversField observers={observers} team={team} onChange={onChange} />

        <DealLinks deal={deal} onOpenCard={onOpenCard} />

        <Field label="Comentário">
          <textarea
            className="deal-input"
            rows={5}
            value={draft.comment ?? ""}
            onChange={(e) => onChange({ comment: e.target.value })}
          />
        </Field>

        <Field label="Parâmetros UTM">
          {utmEntries.length === 0 ? (
            <span className="deal-readonly">Nenhum</span>
          ) : (
            <dl className="deal-utm">
              {utmEntries.map(([key, value]) => (
                <div key={key}>
                  <dt>{UTM_LABELS[key] ?? key}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </Field>
      </Section>

      <Section
        title="Serviços"
        action={
          <button type="button" className="deal-link-btn" onClick={onOpenProducts}>
            editar
          </button>
        }
      >
        {hasProducts ? (
          <>
            <p className="deal-readonly">
              {products.length} {products.length === 1 ? "item" : "itens"} por {formatMoney(draft.value, draft.currency)}
            </p>
            <ul className="deal-product-summary">
              {products.map((product) => (
                <li key={product.id}>
                  <strong>{product.name || "Serviço sem nome"}</strong>
                  <span>
                    {product.quantity} × {formatMoney(product.price, draft.currency)}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <button type="button" className="deal-link-btn" onClick={onOpenProducts}>
            <Plus size={14} /> Adicionar serviços
          </button>
        )}
      </Section>

      <Section title="Negócio recorrente">
        <Field
          label="Negócio recorrente"
          aside={draft.recurrence !== "NONE" && <span className="deal-field__hint">cria o próximo ao ganhar</span>}
        >
          <Select className="deal-input" value={draft.recurrence} onChange={(e) => onChange({ recurrence: e.target.value })}>
            {RECURRENCES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        </Field>
      </Section>
    </div>
  );
}

type CatalogProduct = { id: string; name: string; price: number };

export function DealProductsEditor({ draft, onChange }: { draft: DealDraft; onChange: (changes: Partial<DealDraft>) => void }) {
  const products = draft.products;

  const setProducts = (next: DealProduct[]) =>
    onChange({ products: next, ...(next.length > 0 && { value: productsTotal(next) }) });

  const update = (id: string, changes: Partial<DealProduct>) =>
    setProducts(products.map((p) => (p.id === id ? { ...p, ...changes } : p)));

  return (
    <div className="deal-products">
      <table className="deal-products__table">
        <thead>
          <tr>
            <th>Serviço</th>
            <th>Preço</th>
            <th>Quantidade</th>
            <th>Total</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.id}>
              <td>
                <LookupInput<CatalogProduct>
                  type="product"
                  placeholder="Nome do serviço (busca no catálogo)"
                  value={product.name}
                  // Typing a different name unlinks the catalog product; the API links/creates it on save
                  onChange={(name) => update(product.id, { name, productId: null })}
                  onPick={(picked) => update(product.id, { name: picked.name, price: picked.price, productId: picked.id })}
                  describe={(p) => formatMoney(p.price, draft.currency)}
                />
                <input
                  className="deal-input deal-products__description"
                  placeholder="Descrição (opcional)"
                  value={product.description ?? ""}
                  onChange={(e) => update(product.id, { description: e.target.value })}
                />
              </td>
              <td>
                <input
                  className="deal-input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={product.price}
                  onChange={(e) => update(product.id, { price: Number(e.target.value) })}
                />
              </td>
              <td>
                <input
                  className="deal-input"
                  type="number"
                  step="1"
                  min="0"
                  value={product.quantity}
                  onChange={(e) => update(product.id, { quantity: Number(e.target.value) })}
                />
              </td>
              <td className="deal-products__total">{formatMoney(product.price * product.quantity, draft.currency)}</td>
              <td>
                <button
                  type="button"
                  className="deal-icon-btn deal-icon-btn--danger"
                  title="Remover serviço"
                  onClick={() => setProducts(products.filter((p) => p.id !== product.id))}
                >
                  <Trash2 size={16} />
                </button>
              </td>
            </tr>
          ))}
          {products.length === 0 && (
            <tr>
              <td colSpan={5} className="deal-empty">
                Nenhum serviço. O valor do negócio pode ser informado manualmente na aba Geral.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="deal-products__footer">
        <button
          type="button"
          className="btn-secondary"
          onClick={() =>
            setProducts([
              ...products,
              { id: crypto.randomUUID(), productId: null, name: "", description: null, price: 0, quantity: 1 },
            ])
          }
        >
          <Plus size={16} /> Adicionar serviço
        </button>
        <div className="deal-products__sum">
          Total: <strong>{formatMoney(draft.value, draft.currency)}</strong>
        </div>
      </div>
    </div>
  );
}

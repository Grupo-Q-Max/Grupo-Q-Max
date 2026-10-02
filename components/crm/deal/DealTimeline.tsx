"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Circle,
  Filter,
  Info,
  ListTodo,
  MessageSquare,
  Pencil,
  Phone,
  Plus,
  Repeat,
  Tag,
  Trash2,
  Trophy,
  Users,
  Webhook,
  Zap,
} from "lucide-react";
import {
  ACTIVITY_LABELS,
  RECURRENCES,
  toDateTimeInput,
  type DealActivity,
  type DealDetails,
  type DealHistory,
  type TeamMember,
} from "./types";
import { Avatar, formatDateOnly, formatDateTime, formatDay, formatTime } from "./ui";

type ComposerMode = "TODO" | "COMMENT" | "TASK" | "CALL" | "MEETING";

type Props = {
  deal: DealDetails;
  team: TeamMember[];
  onChanged: () => Promise<void> | void;
};

const jsonRequest = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const ACTIVITY_ICONS: Record<DealActivity["type"], ReactNode> = {
  TODO: <ListTodo size={16} />,
  TASK: <CheckCircle2 size={16} />,
  CALL: <Phone size={16} />,
  MEETING: <Users size={16} />,
  COMMENT: <MessageSquare size={16} />,
};

/** Default deadline for new activities: next full hour. */
function nextHour() {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return toDateTimeInput(d.toISOString());
}

const isOverdue = (activity: DealActivity) =>
  !activity.completed && !!activity.deadline && new Date(activity.deadline).getTime() < Date.now();

export function DealTimeline({ deal, team, onChanged }: Props) {
  const findMember = (id: string | null) => team.find((m) => m.id === id) ?? null;
  const pending = deal.activities
    .filter((a) => !a.completed && a.type !== "COMMENT")
    .sort((a, b) => (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999"));

  const toggleCompleted = async (activity: DealActivity) => {
    await fetch("/api/crm/activity", jsonRequest("PATCH", { id: activity.id, completed: !activity.completed }));
    await onChanged();
  };

  const remove = async (activity: DealActivity) => {
    if (!window.confirm(`Excluir ${ACTIVITY_LABELS[activity.type].toLowerCase()}?`)) return;
    await fetch(`/api/crm/activity?id=${activity.id}`, { method: "DELETE" });
    await onChanged();
  };

  const update = async (activity: DealActivity, changes: Partial<DealActivity>) => {
    await fetch("/api/crm/activity", jsonRequest("PATCH", { id: activity.id, ...changes }));
    await onChanged();
  };

  return (
    <div className="deal-timeline">
      <ActivityComposer dealId={deal.id} team={team} defaultResponsible={deal.responsibleId} onCreated={onChanged} />

      <div className="deal-timeline__divider">
        <span className="deal-pill deal-pill--green">Coisas a fazer</span>
      </div>

      {pending.length === 0 ? (
        <div className="deal-todo-empty">
          <Plus size={18} />
          <div>
            <strong>Adicionar uma nova atividade</strong>
            <span>Planeje sua próxima ação no negócio para nunca esquecer o cliente</span>
          </div>
        </div>
      ) : (
        <ul className="deal-todos">
          {pending.map((activity) => (
            <ActivityItem
              key={activity.id}
              activity={activity}
              member={findMember(activity.responsibleId)}
              team={team}
              onToggle={() => toggleCompleted(activity)}
              onDelete={() => remove(activity)}
              onUpdate={(changes) => update(activity, changes)}
            />
          ))}
        </ul>
      )}

      <HistoryFeed
        deal={deal}
        findMember={findMember}
        onToggle={toggleCompleted}
        onDelete={remove}
        onUpdate={update}
      />
    </div>
  );
}

function ActivityComposer({
  dealId,
  team,
  defaultResponsible,
  onCreated,
}: {
  dealId: string;
  team: TeamMember[];
  defaultResponsible: string | null;
  onCreated: () => Promise<void> | void;
}) {
  const [mode, setMode] = useState<ComposerMode>("TODO");
  const [moreOpen, setMoreOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState(nextHour);
  const [responsible, setResponsible] = useState(defaultResponsible ?? "");
  const [saving, setSaving] = useState(false);

  const isComment = mode === "COMMENT";
  const hasTitleField = mode === "TASK" || mode === "CALL" || mode === "MEETING";

  const reset = () => {
    setTitle("");
    setDescription("");
    setDeadline(nextHour());
    setExpanded(false);
  };

  const selectMode = (next: ComposerMode) => {
    setMode(next);
    setMoreOpen(false);
    setExpanded(true);
    if (next === "CALL" && !title) setTitle("Ligar para o cliente");
    if (next === "MEETING" && !title) setTitle("Reunião com o cliente");
  };

  const text = hasTitleField ? title : description;

  const submit = async () => {
    if (!text.trim()) return;
    setSaving(true);
    const res = await fetch(
      "/api/crm/activity",
      jsonRequest("POST", {
        cardId: dealId,
        type: mode,
        title: hasTitleField ? title : description,
        description: hasTitleField ? description : null,
        deadline: isComment || !deadline ? null : new Date(deadline).toISOString(),
        responsibleId: isComment ? null : responsible,
      })
    );
    setSaving(false);
    if (!res.ok) return;
    reset();
    await onCreated();
  };

  const tabs: { mode: ComposerMode; label: string }[] = [
    { mode: "TODO", label: "Atividade" },
    { mode: "COMMENT", label: "Comentário" },
    { mode: "TASK", label: "Tarefa" },
  ];
  const moreTabs: { mode: ComposerMode; label: string }[] = [
    { mode: "CALL", label: "Chamada" },
    { mode: "MEETING", label: "Reunião" },
  ];
  const activeMore = moreTabs.find((t) => t.mode === mode);

  return (
    <div className="deal-composer">
      <div className="deal-composer__tabs">
        {tabs.map((tab) => (
          <button
            key={tab.mode}
            type="button"
            className={mode === tab.mode ? "is-active" : ""}
            onClick={() => selectMode(tab.mode)}
          >
            {tab.label}
          </button>
        ))}
        <div className="deal-composer__more">
          <button type="button" className={activeMore ? "is-active" : ""} onClick={() => setMoreOpen(!moreOpen)}>
            {activeMore?.label ?? "Mais"} <ChevronDown size={14} />
          </button>
          {moreOpen && (
            <div className="deal-menu">
              {moreTabs.map((tab) => (
                <button key={tab.mode} type="button" onClick={() => selectMode(tab.mode)}>
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={`deal-composer__body ${expanded ? "is-expanded" : ""}`}>
        {hasTitleField && expanded && (
          <input
            className="deal-input"
            placeholder={mode === "TASK" ? "Nome da tarefa" : "Assunto"}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        )}
        <textarea
          className="deal-input deal-composer__text"
          rows={expanded ? 3 : 1}
          placeholder={
            isComment ? "Escreva um comentário..." : hasTitleField ? "Descrição (opcional)" : "Coisas a fazer"
          }
          value={description}
          onFocus={() => setExpanded(true)}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit();
          }}
        />

        {expanded && (
          <>
            {!isComment && (
              <div className="deal-composer__options">
                <label>
                  <Calendar size={14} />
                  <input
                    type="datetime-local"
                    className="deal-input deal-input--compact"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                  />
                </label>
                <label>
                  <Users size={14} />
                  <select
                    className="deal-input deal-input--compact"
                    value={responsible}
                    onChange={(e) => setResponsible(e.target.value)}
                  >
                    <option value="">Sem responsável</option>
                    {team.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
            <div className="deal-composer__actions">
              <button type="button" className="btn-primary" disabled={saving || !text.trim()} onClick={submit}>
                {saving ? "Salvando..." : isComment ? "Enviar" : "Salvar"}
              </button>
              <button type="button" className="btn-secondary" onClick={reset}>
                Cancelar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ActivityItem({
  activity,
  member,
  team,
  onToggle,
  onDelete,
  onUpdate,
}: {
  activity: DealActivity;
  member: TeamMember | null;
  team: TeamMember[];
  onToggle: () => void;
  onDelete: () => void;
  onUpdate: (changes: Partial<DealActivity>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(activity.title);
  const [deadline, setDeadline] = useState(toDateTimeInput(activity.deadline));
  const [responsible, setResponsible] = useState(activity.responsibleId ?? "");

  const overdue = isOverdue(activity);

  if (editing) {
    return (
      <li className="deal-todo is-editing">
        <input className="deal-input" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="deal-composer__options">
          <input
            type="datetime-local"
            className="deal-input deal-input--compact"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
          <select
            className="deal-input deal-input--compact"
            value={responsible}
            onChange={(e) => setResponsible(e.target.value)}
          >
            <option value="">Sem responsável</option>
            {team.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div className="deal-composer__actions">
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              onUpdate({ title, deadline: deadline ? new Date(deadline).toISOString() : null, responsibleId: responsible });
              setEditing(false);
            }}
          >
            Salvar
          </button>
          <button type="button" className="btn-secondary" onClick={() => setEditing(false)}>
            Cancelar
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className={`deal-todo ${overdue ? "is-overdue" : ""}`}>
      <button type="button" className="deal-todo__check" title="Concluir" onClick={onToggle}>
        <Circle size={20} />
      </button>
      <div className="deal-todo__content">
        <div className="deal-todo__head">
          <span className="deal-todo__type">
            {ACTIVITY_ICONS[activity.type]} {ACTIVITY_LABELS[activity.type]}
          </span>
          <span className="deal-todo__time">{formatTime(activity.createdAt)}</span>
        </div>
        <strong className="deal-todo__title">{activity.title}</strong>
        {activity.description && <p className="deal-todo__desc">{activity.description}</p>}
        {activity.deadline && (
          <span className={`deal-deadline ${overdue ? "is-overdue" : ""}`}>
            Prazo <b>{formatDateTime(activity.deadline)}</b>
            {overdue && " · atrasada"}
          </span>
        )}
      </div>
      <div className="deal-todo__side">
        <Avatar member={member} size={26} />
        <button type="button" className="deal-icon-btn" title="Editar" onClick={() => setEditing(true)}>
          <Pencil size={14} />
        </button>
        <button type="button" className="deal-icon-btn deal-icon-btn--danger" title="Excluir" onClick={onDelete}>
          <Trash2 size={14} />
        </button>
      </div>
    </li>
  );
}

type FeedFilter = "ALL" | "ACTIVITIES" | "COMMENTS" | "CHANGES";

type FeedEntry =
  | { kind: "history"; at: string; item: DealHistory }
  | { kind: "comment"; at: string; item: DealActivity }
  | { kind: "activity-created"; at: string; item: DealActivity }
  | { kind: "activity-done"; at: string; item: DealActivity };

const STATUS_LABELS: Record<string, string> = { OPEN: "Em andamento", WON: "Ganho", LOST: "Perdido" };

function HistoryFeed({
  deal,
  findMember,
  onToggle,
  onDelete,
  onUpdate,
}: {
  deal: DealDetails;
  findMember: (id: string | null) => TeamMember | null;
  onToggle: (a: DealActivity) => void;
  onDelete: (a: DealActivity) => void;
  onUpdate: (a: DealActivity, changes: Partial<DealActivity>) => void;
}) {
  const [filter, setFilter] = useState<FeedFilter>("ALL");
  const [filterOpen, setFilterOpen] = useState(false);

  const entries = useMemo(() => {
    const list: FeedEntry[] = [];
    if (filter === "ALL" || filter === "CHANGES") {
      deal.history.forEach((item) => list.push({ kind: "history", at: item.createdAt, item }));
      // Deals created before the history existed have no CREATED event
      if (!deal.history.some((h) => h.type === "CREATED")) {
        const item: DealHistory = { id: "created", type: "CREATED", data: { title: deal.title }, createdAt: deal.createdAt };
        list.push({ kind: "history", at: deal.createdAt, item });
      }
    }
    deal.activities.forEach((item) => {
      if (item.type === "COMMENT") {
        if (filter === "ALL" || filter === "COMMENTS") list.push({ kind: "comment", at: item.createdAt, item });
        return;
      }
      if (filter !== "ALL" && filter !== "ACTIVITIES") return;
      list.push({ kind: "activity-created", at: item.createdAt, item });
      if (item.completed && item.completedAt) list.push({ kind: "activity-done", at: item.completedAt, item });
    });
    return list.sort((a, b) => b.at.localeCompare(a.at));
  }, [deal.history, deal.activities, deal.title, deal.createdAt, filter]);

  const groups = useMemo(() => {
    const byDay: { day: string; entries: FeedEntry[] }[] = [];
    for (const entry of entries) {
      const day = formatDay(entry.at);
      const last = byDay[byDay.length - 1];
      if (last?.day === day) last.entries.push(entry);
      else byDay.push({ day, entries: [entry] });
    }
    return byDay;
  }, [entries]);

  const filters: { value: FeedFilter; label: string }[] = [
    { value: "ALL", label: "Todos os eventos" },
    { value: "ACTIVITIES", label: "Atividades" },
    { value: "COMMENTS", label: "Comentários" },
    { value: "CHANGES", label: "Alterações do negócio" },
  ];

  return (
    <div className="deal-feed">
      <div className="deal-feed__toolbar">
        <div className="deal-composer__more">
          <button
            type="button"
            className={`deal-feed__filter ${filter !== "ALL" ? "is-active" : ""}`}
            onClick={() => setFilterOpen(!filterOpen)}
          >
            <Filter size={12} /> {filter === "ALL" ? "Filtro" : filters.find((f) => f.value === filter)?.label}
          </button>
          {filterOpen && (
            <div className="deal-menu deal-menu--right">
              {filters.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  className={f.value === filter ? "is-active" : ""}
                  onClick={() => {
                    setFilter(f.value);
                    setFilterOpen(false);
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {groups.map((group) => (
        <div key={group.day} className="deal-feed__group">
          <div className="deal-timeline__divider">
            <span className="deal-pill">{group.day}</span>
          </div>
          {group.entries.map((entry) => (
            <FeedItem
              key={`${entry.kind}-${entry.item.id}`}
              entry={entry}
              findMember={findMember}
              onToggle={onToggle}
              onDelete={onDelete}
              onUpdate={onUpdate}
            />
          ))}
        </div>
      ))}

      {groups.length === 0 && <p className="deal-empty">Nenhum evento para este filtro.</p>}
    </div>
  );
}

function FeedItem({
  entry,
  findMember,
  onToggle,
  onDelete,
  onUpdate,
}: {
  entry: FeedEntry;
  findMember: (id: string | null) => TeamMember | null;
  onToggle: (a: DealActivity) => void;
  onDelete: (a: DealActivity) => void;
  onUpdate: (a: DealActivity, changes: Partial<DealActivity>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(entry.kind === "comment" ? entry.item.title : "");

  const frame = (icon: ReactNode, title: string, body: ReactNode, side?: ReactNode, muted = true) => (
    <div className={`deal-feed__item ${muted ? "is-muted" : ""}`}>
      <span className="deal-feed__icon">{icon}</span>
      <div className="deal-feed__card">
        <div className="deal-feed__head">
          <span>
            <strong>{title}</strong>
            <time>{formatTime(entry.at)}</time>
          </span>
          {side}
        </div>
        {body}
      </div>
    </div>
  );

  if (entry.kind === "comment") {
    const comment = entry.item;
    return frame(
      <MessageSquare size={14} />,
      "Comentário",
      editing ? (
        <div className="deal-feed__edit">
          <textarea className="deal-input" rows={3} value={text} onChange={(e) => setText(e.target.value)} />
          <div className="deal-composer__actions">
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                onUpdate(comment, { title: text });
                setEditing(false);
              }}
            >
              Salvar
            </button>
            <button type="button" className="btn-secondary" onClick={() => setEditing(false)}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <p className="deal-feed__text">{comment.title}</p>
      ),
      <span className="deal-feed__actions">
        <button type="button" className="deal-icon-btn" title="Editar" onClick={() => setEditing(true)}>
          <Pencil size={13} />
        </button>
        <button type="button" className="deal-icon-btn deal-icon-btn--danger" title="Excluir" onClick={() => onDelete(comment)}>
          <Trash2 size={13} />
        </button>
      </span>,
      false
    );
  }

  if (entry.kind === "activity-created" || entry.kind === "activity-done") {
    const activity = entry.item;
    const done = entry.kind === "activity-done";
    return frame(
      done ? <CheckCircle2 size={14} /> : ACTIVITY_ICONS[activity.type],
      done ? `${ACTIVITY_LABELS[activity.type]} concluída` : `${ACTIVITY_LABELS[activity.type]} criada`,
      <>
        <p className={`deal-feed__text ${activity.completed ? "is-done" : ""}`}>{activity.title}</p>
        {activity.deadline && !done && (
          <span className="deal-feed__meta">
            Data e horário <b>{formatDateTime(activity.deadline)}</b>
          </span>
        )}
      </>,
      <span className="deal-feed__actions">
        {done && (
          <button type="button" className="deal-link-btn" onClick={() => onToggle(activity)}>
            reabrir
          </button>
        )}
        <Avatar member={findMember(activity.responsibleId)} size={22} />
      </span>
    );
  }

  const { item } = entry;
  const data = item.data ?? {};

  switch (item.type) {
    case "CREATED":
      return frame(<Info size={14} />, "Negócio criado", <p className="deal-feed__text">{data.title}</p>);
    case "STAGE_CHANGED":
      return frame(
        <Tag size={14} />,
        "Etapa alterada",
        <div className="deal-feed__change">
          <span className="deal-pill">{data.from}</span>
          <ArrowRight size={14} />
          <span className="deal-pill">{data.to}</span>
        </div>
      );
    case "STATUS_CHANGED":
      return frame(
        <Trophy size={14} />,
        data.to === "WON" ? "Negócio ganho" : data.to === "LOST" ? "Negócio perdido" : "Negócio reaberto",
        <div className="deal-feed__change">
          <span className="deal-pill">{STATUS_LABELS[data.from ?? ""] ?? data.from}</span>
          <ArrowRight size={14} />
          <span className="deal-pill">{STATUS_LABELS[data.to ?? ""] ?? data.to}</span>
        </div>
      );
    case "RECURRENCE_CREATED":
      return frame(
        <Repeat size={14} />,
        "Negócio recorrente criado",
        <p className="deal-feed__text">{data.title}</p>
      );
    case "AUTOMATION_RUN":
      return frame(
        <Webhook size={14} />,
        data.status === "SUCCESS" ? "Regra de automação executada" : "Regra de automação falhou",
        <>
          <p className="deal-feed__text">{data.name}</p>
          {data.status !== "SUCCESS" && data.error && <span className="deal-feed__meta">{data.error}</span>}
        </>
      );
    case "TRIGGER_FIRED":
      return frame(
        <Zap size={14} />,
        "Gatilho acionado",
        <p className="deal-feed__text">
          {data.name} → {data.to}
        </p>
      );
    case "FIELD_CHANGED":
    default:
      return frame(
        <Pencil size={14} />,
        `${data.label ?? "Campo"} alterado`,
        data.from !== undefined || data.to !== undefined ? (
          <div className="deal-feed__change">
            {data.from || data.to ? (
              <>
                <span className="deal-pill">{formatChange(data.field, data.from)}</span>
                <ArrowRight size={14} />
                <span className="deal-pill">{formatChange(data.field, data.to)}</span>
              </>
            ) : (
              <span className="deal-feed__meta">alterado</span>
            )}
          </div>
        ) : null
      );
  }
}

/** History stores raw values; make dates, money and empty values readable. */
function formatChange(field: string | null | undefined, value: string | null | undefined) {
  if (!value) return "vazio";
  if (field === "startDate" || field === "closeDate") return formatDateOnly(value);
  if (field === "value") return Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
  if (field === "recurrence") return RECURRENCES.find((r) => r.value === value)?.label ?? value;
  if (value.length > 60) return `${value.slice(0, 60)}…`;
  return value;
}

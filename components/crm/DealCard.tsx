import { Archive, Calendar, Check, Clock, CornerDownRight, ListChecks, ListTodo, ListTree, Lock } from "lucide-react";
import { dueAt } from "@/lib/crm-due";
import { Avatar } from "./deal/ui";
import { CardTimer } from "./deal/DealTaskTools";
import { formatMinutes, priorityLabel, type CrmTagDto, type Priority, type TeamMember } from "./deal/types";

export type CrmDeal = {
  id: string;
  /** Short sequential id shown in the URL (/crm/deal/details/<number>) */
  number: number;
  title: string;
  company: string | null;
  value: number;
  stageId: string;
  currency?: string;
  status?: string;
  contactName?: string | null;
  responsible?: TeamMember | null;
  /** Co-assignees besides the responsible (task boards) */
  assignees?: TeamMember[];
  /** Next pending activity (see cardListInclude) */
  activities?: { id: string; title: string; deadline: string | null }[];
  _count?: { activities: number };
  /** Checklist (TODO activities) of task cards */
  checklist?: { done: number; total: number };
  /** Date from the server render, ISO string after a client sync */
  createdAt?: string | Date;
  /** Planned end date; the deadline on task boards */
  closeDate?: string | Date | null;
  /** Start date (task boards: where the timeline bar begins) */
  startDate?: string | Date | null;
  /** "HH:MM" the task is due on closeDate */
  dueTime?: string | null;
  /** Active subtasks of a task card */
  subtasks?: { done: number; total: number };
  /** Parent task when this card is a subtask */
  parentId?: string | null;
  /** Number and title of the parent task, shown above the title */
  parent?: { number: number; title: string } | null;
  /** Timers running on the card (endedAt null), one per member */
  runningTimers?: { memberId: string | null; startedAt: string | Date }[];
  priority?: Priority | null;
  tags?: CrmTagDto[];
  /** Waits for a card that is not done yet ("Bloqueada por") */
  blocked?: boolean;
  /** Task boards: estimated / spent time in minutes */
  estimateMinutes?: number | null;
  spentMinutes?: number | null;
  source?: string | null;
  customData?: unknown;
};

export function DealCard({
  deal,
  isTask,
  onOpen,
  onArchive,
  selected,
}: {
  deal: CrmDeal;
  /** Task board card: deadline instead of value, no won/lost */
  isTask?: boolean;
  onOpen?: () => void;
  onArchive?: () => void;
  /** Selection mode: true/false shows the checkbox (and clicks select instead of opening) */
  selected?: boolean;
}) {
  const nextActivity = deal.activities?.[0];
  const pendingCount = deal._count?.activities ?? 0;
  const overdue = nextActivity?.deadline && new Date(nextActivity.deadline).getTime() < Date.now();
  const taskDone = isTask && deal.status === "WON";
  const taskOverdue = isTask && !taskDone && deal.closeDate && dueAt(deal.closeDate, deal.dueTime).getTime() < Date.now();

  const customData = (deal.customData ?? {}) as Record<string, any>;
  const isQxback =
    deal.source === "QXBACK" ||
    Boolean(customData.indicacao_id) ||
    Boolean(customData.UF_CRM_INDICACAO_ID) ||
    deal.title.includes("[QXBACK") ||
    deal.title.includes("Indicação:");

  // Sinalização de indicação ainda não aberta
  const isUnopened =
    !customData.openedAt &&
    deal.status === "OPEN" &&
    (isQxback || (!deal.activities?.length && !isTask));

  const createdAtFormatted = deal.createdAt
    ? new Date(deal.createdAt).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }) +
      " às " +
      new Date(deal.createdAt).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div
      className={`kanban-card ${deal.status && deal.status !== "OPEN" ? `kanban-card--${deal.status.toLowerCase()}` : ""} ${taskDone ? "kanban-card--done" : ""} ${selected ? "kanban-card--selected" : ""}`}
      onClick={onOpen}
    >
      <div className="kanban-card__glow" />
      {selected !== undefined && (
        <span className={`kanban-card__select ${selected ? "is-checked" : ""}`} role="checkbox" aria-checked={selected} aria-label="Selecionar">
          {selected && <Check size={12} />}
        </span>
      )}
      {(deal.priority || !!deal.tags?.length || (deal.blocked && !taskDone)) && (
        <div className="kanban-card__tags">
          {deal.blocked && !taskDone && (
            <span className="crm-blocked" title="Aguarda outra tarefa ser concluída">
              <Lock size={11} /> Bloqueada
            </span>
          )}
          {deal.priority && <span className={`crm-priority crm-priority--${deal.priority.toLowerCase()}`}>{priorityLabel(deal.priority)}</span>}
          {deal.tags?.map((tag) => (
            <span key={tag.id} className="crm-tag" style={{ "--tag-color": tag.color } as React.CSSProperties}>
              {tag.name}
            </span>
          ))}
        </div>
      )}
      {deal.parent && (
        <div className="kanban-card__parent" title={`Subtarefa de #${deal.parent.number} ${deal.parent.title}`}>
          <CornerDownRight size={11} /> #{deal.parent.number} · {deal.parent.title}
        </div>
      )}
      {isUnopened && (
        <div className="kanban-card__badge-row">
          <span className="kanban-card__unopened-badge" title="Esta indicação ainda não foi aberta por ninguém da equipe">
            <span className="kanban-card__unopened-dot" />
            NÃO ABERTA · NOVA
          </span>
        </div>
      )}
      <h3 className="kanban-card__title">{deal.title}</h3>
      {(deal.company || deal.contactName) && (
        <div className="kanban-card__company">{[deal.contactName, deal.company].filter(Boolean).join(" · ")}</div>
      )}
      {createdAtFormatted && (
        <div className="kanban-card__created-at" title={`Data e hora da indicação: ${createdAtFormatted}`}>
          <Clock size={11} />
          <span>{createdAtFormatted}</span>
        </div>
      )}

      {isTask ? (
        deal.closeDate && (
          <div className={`kanban-card__activity ${taskOverdue ? "is-overdue" : ""}`}>
            <Calendar size={12} />
            <span>
              Prazo {new Date(deal.closeDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" })}
              {deal.dueTime && ` ${deal.dueTime}`}
            </span>
          </div>
        )
      ) : (
        <span className="kanban-card__value">
          {Number(deal.value).toLocaleString("pt-BR", { style: "currency", currency: deal.currency || "BRL" })}
        </span>
      )}

      {nextActivity ? (
        <div className={`kanban-card__activity ${overdue ? "is-overdue" : ""}`} title={nextActivity.title}>
          <Calendar size={12} />
          <span>
            {nextActivity.deadline
              ? new Date(nextActivity.deadline).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Sem prazo"}
            {" · "}
            {nextActivity.title}
          </span>
        </div>
      ) : (
        !isTask && (
          <div className="kanban-card__activity is-empty">
            <ListTodo size={12} /> <span>Nenhuma atividade planejada</span>
          </div>
        )
      )}

      <div className="kanban-card__footer">
        <span className="kanban-card__people" title={[deal.responsible, ...(deal.assignees ?? [])].map((m) => m?.name).filter(Boolean).join(", ")}>
          <Avatar member={deal.responsible} size={26} />
          {deal.assignees?.filter((m) => m.id !== deal.responsible?.id).slice(0, 2).map((m) => <Avatar key={m.id} member={m} size={22} />)}
        </span>
        {isTask && !!deal.checklist?.total && (
          <span
            className={`kanban-card__checklist ${deal.checklist.done === deal.checklist.total ? "is-complete" : ""}`}
            title="Atividades concluídas / total"
          >
            <ListChecks size={12} /> {deal.checklist.done}/{deal.checklist.total}
          </span>
        )}
        {isTask && !!deal.subtasks?.total && (
          <span
            className={`kanban-card__checklist ${deal.subtasks.done === deal.subtasks.total ? "is-complete" : ""}`}
            title="Subtarefas concluídas / total"
          >
            <ListTree size={12} /> {deal.subtasks.done}/{deal.subtasks.total}
          </span>
        )}
        {isTask && (deal.estimateMinutes != null || deal.spentMinutes != null) && (
          <span
            className={`kanban-card__checklist ${deal.estimateMinutes != null && (deal.spentMinutes ?? 0) > deal.estimateMinutes ? "is-over" : ""}`}
            title="Tempo gasto / estimativa"
          >
            <Clock size={12} /> {formatMinutes(deal.spentMinutes ?? 0)}
            {deal.estimateMinutes != null && `/${formatMinutes(deal.estimateMinutes)}`}
          </span>
        )}
        {isTask && !taskDone && selected === undefined && <CardTimer cardId={deal.id} running={deal.runningTimers ?? []} />}
        <span className="kanban-card__date">
          {[
            pendingCount > 0 &&
              !(isTask && deal.checklist?.total) &&
              (isTask
                ? `${pendingCount} ${pendingCount === 1 ? "item pendente" : "itens pendentes"}`
                : `${pendingCount} ${pendingCount === 1 ? "atividade" : "atividades"}`),
            deal.status === "WON" && (isTask ? "Concluída" : "Ganho"),
            deal.status === "LOST" && "Perdido",
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
        {onArchive && selected === undefined && (
          <button
            className="kanban-card__delete"
            title="Arquivar"
            aria-label="Arquivar"
            onClick={(e) => {
              e.stopPropagation();
              onArchive();
            }}
          >
            <Archive size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

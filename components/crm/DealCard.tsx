import { Calendar, ListChecks, ListTodo, Lock, Trash2 } from "lucide-react";
import { Avatar } from "./deal/ui";
import { priorityLabel, type CrmTagDto, type Priority, type TeamMember } from "./deal/types";

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
  /** Next pending activity (see cardListInclude) */
  activities?: { id: string; title: string; deadline: string | null }[];
  _count?: { activities: number };
  /** Checklist (TODO activities) of task cards */
  checklist?: { done: number; total: number };
  /** Date from the server render, ISO string after a client sync */
  createdAt?: string | Date;
  /** Planned end date; the deadline on task boards */
  closeDate?: string | Date | null;
  priority?: Priority | null;
  tags?: CrmTagDto[];
  /** Waits for a card that is not done yet ("Bloqueada por") */
  blocked?: boolean;
};

/** End of the due day (closeDate is a date-only column stored as UTC midnight). */
const dueEnd = (date: string | Date) => new Date(date).getTime() + 86_400_000;

export function DealCard({
  deal,
  isTask,
  onOpen,
  onDelete,
}: {
  deal: CrmDeal;
  /** Task board card: deadline instead of value, no won/lost */
  isTask?: boolean;
  onOpen?: () => void;
  onDelete?: () => void;
}) {
  const nextActivity = deal.activities?.[0];
  const pendingCount = deal._count?.activities ?? 0;
  const overdue = nextActivity?.deadline && new Date(nextActivity.deadline).getTime() < Date.now();
  const taskDone = isTask && deal.status === "WON";
  const taskOverdue = isTask && !taskDone && deal.closeDate && dueEnd(deal.closeDate) < Date.now();

  return (
    <div
      className={`kanban-card ${deal.status && deal.status !== "OPEN" ? `kanban-card--${deal.status.toLowerCase()}` : ""} ${taskDone ? "kanban-card--done" : ""}`}
      onClick={onOpen}
    >
      <div className="kanban-card__glow" />
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
      <h3 className="kanban-card__title">{deal.title}</h3>
      {(deal.company || deal.contactName) && (
        <div className="kanban-card__company">{[deal.contactName, deal.company].filter(Boolean).join(" · ")}</div>
      )}

      {isTask ? (
        deal.closeDate && (
          <div className={`kanban-card__activity ${taskOverdue ? "is-overdue" : ""}`}>
            <Calendar size={12} />
            <span>Prazo {new Date(deal.closeDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" })}</span>
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
        <Avatar member={deal.responsible} size={26} />
        {isTask && !!deal.checklist?.total && (
          <span
            className={`kanban-card__checklist ${deal.checklist.done === deal.checklist.total ? "is-complete" : ""}`}
            title="Atividades concluídas / total"
          >
            <ListChecks size={12} /> {deal.checklist.done}/{deal.checklist.total}
          </span>
        )}
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
        {onDelete && (
          <button
            className="kanban-card__delete"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

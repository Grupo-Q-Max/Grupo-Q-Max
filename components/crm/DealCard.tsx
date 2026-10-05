import { Calendar, ListTodo, Trash2 } from "lucide-react";
import { Avatar } from "./deal/ui";
import type { TeamMember } from "./deal/types";

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
  /** Date from the server render, ISO string after a client sync */
  createdAt?: string | Date;
};

export function DealCard({
  deal,
  onOpen,
  onDelete,
}: {
  deal: CrmDeal;
  onOpen?: () => void;
  onDelete?: () => void;
}) {
  const nextActivity = deal.activities?.[0];
  const pendingCount = deal._count?.activities ?? 0;
  const overdue = nextActivity?.deadline && new Date(nextActivity.deadline).getTime() < Date.now();

  return (
    <div
      className={`kanban-card ${deal.status && deal.status !== "OPEN" ? `kanban-card--${deal.status.toLowerCase()}` : ""}`}
      onClick={onOpen}
    >
      <div className="kanban-card__glow" />
      <h3 className="kanban-card__title">{deal.title}</h3>
      {(deal.company || deal.contactName) && (
        <div className="kanban-card__company">{[deal.contactName, deal.company].filter(Boolean).join(" · ")}</div>
      )}

      <span className="kanban-card__value">
        {Number(deal.value).toLocaleString("pt-BR", { style: "currency", currency: deal.currency || "BRL" })}
      </span>

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
        <div className="kanban-card__activity is-empty">
          <ListTodo size={12} /> <span>Nenhuma atividade planejada</span>
        </div>
      )}

      <div className="kanban-card__footer">
        <Avatar member={deal.responsible} size={26} />
        <span className="kanban-card__date">
          {[
            pendingCount > 0 && `${pendingCount} ${pendingCount === 1 ? "atividade" : "atividades"}`,
            deal.status === "WON" && "Ganho",
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

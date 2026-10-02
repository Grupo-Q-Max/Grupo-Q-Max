import { Trash2 } from "lucide-react";

export type CrmDeal = {
  id: string;
  title: string;
  company: string | null;
  value: number;
  stageId: string;
};

export function DealCard({ deal, onDelete }: { deal: CrmDeal; onDelete?: () => void }) {
  return (
    <div className="kanban-card">
      <div className="kanban-card__glow" />
      <h3 className="kanban-card__title">{deal.title}</h3>
      {deal.company && <div className="kanban-card__company">{deal.company}</div>}

      <div className="kanban-card__footer">
        <span className="kanban-card__value">
          R$ {Number(deal.value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
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

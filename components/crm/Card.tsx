import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Trash2 } from "lucide-react";

export function Card({ card, onDeleteCard }: { card: any, onDeleteCard?: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: "Card", card },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="kanban-card">
      <div className="kanban-card__glow" />
      <h3 className="kanban-card__title">{card.title}</h3>
      {card.company && <div className="kanban-card__company">{card.company}</div>}
      
      <div className="kanban-card__footer">
        <span className="kanban-card__value">
          R$ {Number(card.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </span>
        <button 
          className="kanban-card__delete"
          onClick={(e) => {
            e.stopPropagation();
            if (onDeleteCard) onDeleteCard(card.id);
          }}
          style={{ background: 'none', border: 'none', color: '#716d75', cursor: 'pointer', display: 'flex' }}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

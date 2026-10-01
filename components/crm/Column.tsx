import { useState } from "react";
import { useSortable, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "./Card";
import { MoreHorizontal, Plus, Trash2 } from "lucide-react";

export function Column({ 
  stage, 
  cards, 
  onAddCard, 
  onDeleteCard, 
  onDeleteStage 
}: { 
  stage: any; 
  cards: any[]; 
  onAddCard?: (title: string) => void;
  onDeleteCard?: (id: string) => void;
  onDeleteStage?: (id: string) => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [stageName, setStageName] = useState(stage.name);
  const [menuOpen, setMenuOpen] = useState(false);

  const { setNodeRef, attributes, listeners, transform, transition } = useSortable({
    id: stage.id,
    data: { type: "Column", stage },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="kanban-column" {...attributes} {...listeners}>
      <div className="kanban-column__header" style={{ cursor: "grab" }}>
        <div className="kanban-column__title" onDoubleClick={() => setIsRenaming(true)}>
          {isRenaming ? (
            <input 
              autoFocus
              type="text"
              value={stageName}
              onChange={e => setStageName(e.target.value)}
              onBlur={async () => {
                setIsRenaming(false);
                if (stageName !== stage.name) {
                  await fetch('/api/crm/stage', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: stage.id, name: stageName })
                  });
                }
              }}
              onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
              style={{ background: 'transparent', border: '1px solid #d90f81', color: '#fff', borderRadius: '4px', outline: 'none' }}
            />
          ) : (
            stageName
          )}
          <span className="kanban-column__count">{cards.length}</span>
        </div>
        <div style={{ position: 'relative' }}>
          <button 
            style={{ background: 'none', border: 'none', color: '#a5a0aa', cursor: 'pointer' }}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <MoreHorizontal size={18} />
          </button>
          
          {menuOpen && (
            <div style={{ 
              position: 'absolute', 
              top: '100%', 
              right: 0, 
              background: '#1a1a1c', 
              border: '1px solid rgba(255,255,255,0.1)', 
              borderRadius: '8px',
              padding: '4px',
              zIndex: 10,
              minWidth: '140px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
            }}>
              <button
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                  padding: '8px 12px', background: 'transparent', border: 'none',
                  color: '#ff2b5e', cursor: 'pointer', fontSize: '13px', textAlign: 'left',
                  borderRadius: '4px'
                }}
                onClick={() => {
                  setMenuOpen(false);
                  if (onDeleteStage) onDeleteStage(stage.id);
                }}
              >
                <Trash2 size={14} /> Excluir Coluna
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="kanban-column__body">
        <SortableContext items={cards.map(c => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map(card => (
            <Card key={card.id} card={card} onDeleteCard={onDeleteCard} />
          ))}
        </SortableContext>
        
        {isAdding ? (
          <div className="kanban-card kanban-card--adding">
            <input 
              autoFocus
              type="text" 
              placeholder="Nome do negócio..."
              value={newCardTitle}
              onChange={(e) => setNewCardTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newCardTitle.trim() && onAddCard) {
                  onAddCard(newCardTitle);
                  setNewCardTitle("");
                  setIsAdding(false);
                } else if (e.key === 'Escape') {
                  setIsAdding(false);
                }
              }}
              style={{ width: '100%', background: 'transparent', border: 'none', color: '#fff', outline: 'none' }}
            />
          </div>
        ) : (
          <button 
            className="kanban-column__add-btn" 
            onClick={() => setIsAdding(true)}
          >
            <Plus size={16} /> Novo Negócio
          </button>
        )}
      </div>
    </div>
  );
}

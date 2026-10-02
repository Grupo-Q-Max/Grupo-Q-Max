"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { KanbanItem } from "./KanbanItem";
import type { KanbanColumnData, KanbanItemBase, KanbanLabels } from "./types";

type KanbanColumnProps<T extends KanbanItemBase> = {
  column: KanbanColumnData<T>;
  labels: KanbanLabels;
  renderItem: (item: T) => ReactNode;
  onAddItem?: (title: string) => void;
  onRename?: (title: string) => void;
  onDelete?: () => void;
};

export function KanbanColumn<T extends KanbanItemBase>({
  column,
  labels,
  renderItem,
  onAddItem,
  onRename,
  onDelete,
}: KanbanColumnProps<T>) {
  const [isAdding, setIsAdding] = useState(false);
  const [newItemTitle, setNewItemTitle] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [title, setTitle] = useState(column.title);
  const [menuOpen, setMenuOpen] = useState(false);

  // Keep the title in sync with external updates (polling, refresh)
  useEffect(() => {
    if (!isRenaming) setTitle(column.title);
  }, [column.title, isRenaming]);

  const { setNodeRef } = useDroppable({ id: column.id, data: { type: "column" } });

  const submitNewItem = () => {
    if (newItemTitle.trim() && onAddItem) onAddItem(newItemTitle.trim());
    setNewItemTitle("");
    setIsAdding(false);
  };

  return (
    <div className="kanban-column">
      <div className="kanban-column__header">
        <div
          className="kanban-column__title"
          onDoubleClick={() => onRename && setIsRenaming(true)}
        >
          {isRenaming ? (
            <input
              autoFocus
              type="text"
              className="kanban-column__title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => {
                setIsRenaming(false);
                const next = title.trim();
                if (next && next !== column.title) onRename?.(next);
                else setTitle(column.title);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") {
                  setTitle(column.title);
                  setIsRenaming(false);
                }
              }}
            />
          ) : (
            title
          )}
          <span className="kanban-column__count">{column.items.length}</span>
        </div>

        {onDelete && (
          <div className="kanban-column__menu">
            <button className="kanban-column__menu-btn" onClick={() => setMenuOpen(!menuOpen)}>
              <MoreHorizontal size={18} />
            </button>
            {menuOpen && (
              <div className="kanban-column__menu-panel">
                <button
                  className="kanban-column__menu-item kanban-column__menu-item--danger"
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete();
                  }}
                >
                  <Trash2 size={14} /> {labels.deleteColumn}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div ref={setNodeRef} className="kanban-column__body">
        <SortableContext items={column.items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {column.items.map((item) => (
            <KanbanItem key={item.id} id={item.id}>
              {renderItem(item)}
            </KanbanItem>
          ))}
        </SortableContext>

        {onAddItem &&
          (isAdding ? (
            <div className="kanban-card kanban-card--adding">
              <input
                autoFocus
                type="text"
                className="kanban-card__input"
                placeholder={labels.addItemPlaceholder}
                value={newItemTitle}
                onChange={(e) => setNewItemTitle(e.target.value)}
                onBlur={() => !newItemTitle.trim() && setIsAdding(false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitNewItem();
                  else if (e.key === "Escape") setIsAdding(false);
                }}
              />
            </div>
          ) : (
            <button className="kanban-column__add-btn" onClick={() => setIsAdding(true)}>
              <Plus size={16} /> {labels.addItem}
            </button>
          ))}
      </div>
    </div>
  );
}

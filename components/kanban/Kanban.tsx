"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { KanbanColumn } from "./KanbanColumn";
import type { KanbanColumnData, KanbanItemBase, KanbanLabels, KanbanProps } from "./types";
import "./kanban.css";

const DEFAULT_LABELS: KanbanLabels = {
  addItem: "Novo item",
  addItemPlaceholder: "Título...",
  addColumn: "+ Adicionar coluna",
  deleteColumn: "Excluir coluna",
  syncing: "Sincronizando...",
};

const DEFAULT_POLLING_INTERVAL = 5000;

/** Returns the id of the column that is `id` itself or contains an item with that id. */
function findColumnId<T extends KanbanItemBase>(columns: KanbanColumnData<T>[], id: string) {
  if (columns.some((c) => c.id === id)) return id;
  return columns.find((c) => c.items.some((i) => i.id === id))?.id;
}

function findPosition<T extends KanbanItemBase>(columns: KanbanColumnData<T>[], itemId: string) {
  for (const column of columns) {
    const index = column.items.findIndex((i) => i.id === itemId);
    if (index !== -1) return { columnId: column.id, index };
  }
  return null;
}

export function Kanban<T extends KanbanItemBase>({
  columns: initialColumns,
  renderItem,
  onMoveItem,
  onAddItem,
  onDeleteItem,
  onRenameColumn,
  onDeleteColumn,
  onAddColumn,
  polling,
  labels: labelOverrides,
  className,
}: KanbanProps<T>) {
  const dndId = useId();
  const labels = { ...DEFAULT_LABELS, ...labelOverrides };

  const [columns, setColumns] = useState(initialColumns);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const isDraggingRef = useRef(false);
  const snapshotRef = useRef(initialColumns);
  const pollingRef = useRef(polling);
  pollingRef.current = polling;

  // Accept new data from the parent (e.g. after router.refresh), unless mid-drag
  useEffect(() => {
    if (!isDraggingRef.current) setColumns(initialColumns);
  }, [initialColumns]);

  const pollingEnabled = Boolean(polling);
  const pollingInterval = polling?.intervalMs ?? DEFAULT_POLLING_INTERVAL;

  useEffect(() => {
    if (!pollingEnabled) return;

    const interval = setInterval(async () => {
      const current = pollingRef.current;
      // Don't sync while dragging to avoid the UI jumping under the cursor
      if (!current || isDraggingRef.current) return;

      try {
        setIsSyncing(true);
        const fresh = await current.fetchColumns();
        if (!isDraggingRef.current) setColumns(fresh);
      } catch (err) {
        console.error("Kanban sync error:", err);
      } finally {
        setIsSyncing(false);
      }
    }, pollingInterval);

    return () => clearInterval(interval);
  }, [pollingEnabled, pollingInterval]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const endDrag = () => {
    isDraggingRef.current = false;
    setActiveId(null);
  };

  const handleDragStart = ({ active }: DragStartEvent) => {
    isDraggingRef.current = true;
    snapshotRef.current = columns;
    setActiveId(String(active.id));
  };

  // Moves the item between columns while hovering, so the target column opens space for it
  const handleDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    const itemId = String(active.id);
    const overId = String(over.id);

    setColumns((prev) => {
      const fromId = findColumnId(prev, itemId);
      const toId = findColumnId(prev, overId);
      if (!fromId || !toId || fromId === toId) return prev;

      const item = prev.find((c) => c.id === fromId)!.items.find((i) => i.id === itemId)!;

      return prev.map((column) => {
        if (column.id === fromId) {
          return { ...column, items: column.items.filter((i) => i.id !== itemId) };
        }
        if (column.id === toId) {
          const overIndex = column.items.findIndex((i) => i.id === overId);
          const index = overIndex === -1 ? column.items.length : overIndex;
          const items = [...column.items];
          items.splice(index, 0, item);
          return { ...column, items };
        }
        return column;
      });
    });
  };

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    endDrag();
    const snapshot = snapshotRef.current;

    if (!over) {
      setColumns(snapshot);
      return;
    }

    const itemId = String(active.id);
    const overId = String(over.id);
    const columnId = findColumnId(columns, itemId);
    if (!columnId) return;

    // Reorder within the (possibly new) column
    let next = columns;
    const column = columns.find((c) => c.id === columnId)!;
    const oldIndex = column.items.findIndex((i) => i.id === itemId);
    const overIndex = column.items.findIndex((i) => i.id === overId);
    if (overIndex !== -1 && overIndex !== oldIndex) {
      next = columns.map((c) =>
        c.id === columnId ? { ...c, items: arrayMove(c.items, oldIndex, overIndex) } : c
      );
      setColumns(next);
    }

    const before = findPosition(snapshot, itemId);
    const after = findPosition(next, itemId);
    if (!after || (before && before.columnId === after.columnId && before.index === after.index)) {
      return;
    }

    if (onMoveItem && (await onMoveItem(itemId, after.columnId, after.index)) === false) {
      setColumns(snapshot);
    }
  };

  const handleDragCancel = () => {
    endDrag();
    setColumns(snapshotRef.current);
  };

  const removeItem = async (itemId: string) => {
    if (onDeleteItem && (await onDeleteItem(itemId)) === false) return;
    setColumns((prev) => prev.map((c) => ({ ...c, items: c.items.filter((i) => i.id !== itemId) })));
  };

  const addItem = async (columnId: string, title: string) => {
    const created = await onAddItem?.(columnId, title);
    if (created) {
      setColumns((prev) =>
        prev.map((c) => (c.id === columnId ? { ...c, items: [...c.items, created] } : c))
      );
    }
  };

  const renameColumn = async (columnId: string, title: string) => {
    const previous = columns;
    setColumns((prev) => prev.map((c) => (c.id === columnId ? { ...c, title } : c)));
    if (onRenameColumn && (await onRenameColumn(columnId, title)) === false) {
      setColumns(previous);
    }
  };

  const deleteColumn = async (columnId: string) => {
    if (onDeleteColumn && (await onDeleteColumn(columnId)) === false) return;
    setColumns((prev) => prev.filter((c) => c.id !== columnId));
  };

  const addColumn = async () => {
    const created = await onAddColumn?.();
    if (created) setColumns((prev) => [...prev, created]);
  };

  const activeItem = activeId
    ? columns.flatMap((c) => c.items).find((i) => i.id === activeId)
    : undefined;

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className={`kanban-board${className ? ` ${className}` : ""}`}>
        {isSyncing && (
          <div className="kanban-board__sync">
            <span className="kanban-board__sync-spinner" />
            {labels.syncing}
          </div>
        )}

        {columns.map((column) => (
          <KanbanColumn
            key={column.id}
            column={column}
            labels={labels}
            renderItem={(item) => renderItem(item, { remove: () => removeItem(item.id) })}
            onAddItem={onAddItem && ((title) => addItem(column.id, title))}
            onRename={onRenameColumn && ((title) => renameColumn(column.id, title))}
            onDelete={onDeleteColumn && (() => deleteColumn(column.id))}
          />
        ))}

        {onAddColumn && (
          <button className="kanban-add-column-btn" onClick={addColumn}>
            {labels.addColumn}
          </button>
        )}
      </div>

      <DragOverlay>
        {activeItem ? renderItem(activeItem, { remove: () => {} }) : null}
      </DragOverlay>
    </DndContext>
  );
}

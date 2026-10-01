"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";

import { Column } from "./crm/Column";
import { Card } from "./crm/Card";

export default function KanbanBoard({ pipeline }: { pipeline: any }) {
  const router = useRouter();
  const [stages, setStages] = useState(pipeline.stages || []);
  const [activeCard, setActiveCard] = useState<any | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    
    // Auto-sync polling every 5 seconds
    const interval = setInterval(async () => {
      // Don't sync if the user is dragging something to avoid jumping UI
      if (activeCard) return;
      
      try {
        setIsSyncing(true);
        const res = await fetch(`/api/crm/pipeline?id=${pipeline.id}`);
        if (res.ok) {
          const data = await res.json();
          // Update stages state gently
          setStages(data.stages);
        }
      } catch (err) {
        console.error("Sync error:", err);
      } finally {
        setIsSyncing(false);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [pipeline.id, activeCard]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: any) => {
    const { active } = event;
    const { id } = active;

    for (let stage of stages) {
      const card = stage.cards.find((c: any) => c.id === id);
      if (card) {
        setActiveCard(card);
        return;
      }
    }
  };

  const handleDragOver = (event: any) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    // Logic to move between columns visually
    const isActiveCard = active.data.current?.type === "Card";
    const isOverCard = over.data.current?.type === "Card";
    const isOverColumn = over.data.current?.type === "Column";

    if (!isActiveCard) return;

    setStages((prevStages: any) => {
      const activeStage = prevStages.find((s: any) => s.cards.some((c: any) => c.id === activeId));
      const overStage = prevStages.find((s: any) => 
        isOverColumn ? s.id === overId : s.cards.some((c: any) => c.id === overId)
      );

      if (!activeStage || !overStage) return prevStages;

      if (activeStage.id !== overStage.id) {
        const activeCard = activeStage.cards.find((c: any) => c.id === activeId);
        
        return prevStages.map((stage: any) => {
          if (stage.id === activeStage.id) {
            return { ...stage, cards: stage.cards.filter((c: any) => c.id !== activeId) };
          }
          if (stage.id === overStage.id) {
            // Optional: insert at correct index
            return { ...stage, cards: [...stage.cards, { ...activeCard, stageId: stage.id }] };
          }
          return stage;
        });
      }

      return prevStages;
    });
  };

  const handleDragEnd = async (event: any) => {
    setActiveCard(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const isOverColumn = over.data.current?.type === "Column";
    const overStageId = isOverColumn ? overId : over.data.current?.card?.stageId;

    if (!overStageId) return;

    // Call API to persist the movement
    try {
      await fetch('/api/crm/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId: activeId, newStageId: overStageId })
      });
      router.refresh();
    } catch (err) {
      console.error("Failed to move card in DB:", err);
    }
  };

  if (!isMounted) {
    return <div className="kanban-board-loading">Carregando CRM...</div>;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="kanban-board">
        {isSyncing && (
          <div style={{ position: 'absolute', top: 10, right: 20, fontSize: 12, color: '#4ceb95', display: 'flex', alignItems: 'center', gap: 6, zIndex: 10 }}>
            <div className="crm-spinner" style={{ width: 12, height: 12, borderWidth: 2, marginBottom: 0 }}></div>
            Sincronizando...
          </div>
        )}
        <SortableContext items={stages.map((s: any) => s.id)} strategy={horizontalListSortingStrategy}>
          {stages.map((stage: any) => (
            <Column 
              key={stage.id} 
              stage={stage} 
              cards={stage.cards} 
              onAddCard={async (title: string) => {
                const res = await fetch('/api/crm/card', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ title, stageId: stage.id })
                });
                if (res.ok) {
                  const newCard = await res.json();
                  setStages((prev: any) => prev.map((s: any) => 
                    s.id === stage.id ? { ...s, cards: [...s.cards, newCard] } : s
                  ));
                  router.refresh();
                }
              }} 
              onDeleteCard={async (cardId: string) => {
                if (window.confirm("Certeza que deseja excluir este negócio?")) {
                  await fetch(`/api/crm/card?id=${cardId}`, { method: 'DELETE' });
                  setStages((prev: any) => prev.map((s: any) => ({
                    ...s,
                    cards: s.cards.filter((c: any) => c.id !== cardId)
                  })));
                  router.refresh();
                }
              }}
              onDeleteStage={async (stageId: string) => {
                if (window.confirm("Certeza que deseja excluir esta coluna inteira?")) {
                  await fetch(`/api/crm/stage?id=${stageId}`, { method: 'DELETE' });
                  setStages((prev: any) => prev.filter((s: any) => s.id !== stageId));
                  router.refresh();
                }
              }}
            />
          ))}
          <button 
            className="kanban-add-column-btn"
            onClick={async () => {
              const name = window.prompt("Nome da nova coluna:");
              if (name && name.trim()) {
                const res = await fetch('/api/crm/stage', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name, pipelineId: pipeline.id })
                });
                if (res.ok) {
                  const newStage = await res.json();
                  setStages((prev: any) => [...prev, newStage]);
                  router.refresh();
                }
              }
            }}
          >
            + Adicionar Coluna
          </button>
        </SortableContext>
      </div>

      <DragOverlay>
        {activeCard ? <Card card={activeCard} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Kanban, type KanbanColumnData } from "@/components/kanban";
import { DealCard, type CrmDeal } from "./DealCard";
import { DealDetailsPanel } from "./deal/DealDetailsPanel";

type CrmStage = { id: string; name: string; cards: CrmDeal[] };
type CrmPipeline = { id: string; stages: CrmStage[] };

const toColumns = (stages: CrmStage[]): KanbanColumnData<CrmDeal>[] =>
  stages.map((stage) => ({ id: stage.id, title: stage.name, items: stage.cards }));

const jsonRequest = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export function CrmKanban({ pipeline }: { pipeline: CrmPipeline }) {
  const router = useRouter();
  const columns = useMemo(() => toColumns(pipeline.stages), [pipeline.stages]);
  const [openDealId, setOpenDealId] = useState<string | null>(null);

  // Deep link: /crm?deal=<id> opens the deal panel (same link copied from the panel)
  useEffect(() => {
    setOpenDealId(new URLSearchParams(window.location.search).get("deal"));
  }, []);

  const openDeal = useCallback((id: string | null) => {
    setOpenDealId(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("deal", id);
    else url.searchParams.delete("deal");
    // Native history API syncs with the Next.js router, so router.refresh() keeps the param
    window.history.replaceState(null, "", url);
  }, []);

  const fetchColumns = useCallback(async () => {
    const res = await fetch(`/api/crm/pipeline?id=${pipeline.id}`);
    if (!res.ok) throw new Error(`Pipeline sync failed: ${res.status}`);
    const data: CrmPipeline = await res.json();
    return toColumns(data.stages);
  }, [pipeline.id]);

  // Realtime updates from other tabs/users via Server-Sent Events
  const subscribe = useCallback(
    (notify: () => void) => {
      const source = new EventSource(`/api/crm/events?pipelineId=${encodeURIComponent(pipeline.id)}`);
      let hasConnected = false;

      source.onopen = () => {
        // EventSource reconnects on its own; resync in case events were missed meanwhile
        if (hasConnected) notify();
        hasConnected = true;
      };
      source.onmessage = () => notify();

      return () => source.close();
    },
    [pipeline.id]
  );

  return (
    <>
      <Kanban<CrmDeal>
        columns={columns}
        // Polling is only a fallback in case the SSE connection is blocked by a proxy
        sync={{ fetchColumns, subscribe, pollingIntervalMs: 30_000 }}
        labels={{
          addItem: "Novo Negócio",
          addItemPlaceholder: "Nome do negócio...",
          addColumn: "+ Adicionar Coluna",
          deleteColumn: "Excluir Coluna",
        }}
        renderItem={(deal, { remove }) => <DealCard deal={deal} onOpen={() => openDeal(deal.id)} onDelete={remove} />}
        onMoveItem={async (cardId, newStageId, index) => {
          const res = await fetch("/api/crm/move", jsonRequest("POST", { cardId, newStageId, index }));
          if (!res.ok) return false;
          router.refresh();
        }}
        onAddItem={async (stageId, title) => {
          const res = await fetch("/api/crm/card", jsonRequest("POST", { title, stageId }));
          if (!res.ok) return;
          router.refresh();
          return (await res.json()) as CrmDeal;
        }}
        onDeleteItem={async (cardId) => {
          if (!window.confirm("Certeza que deseja excluir este negócio?")) return false;
          const res = await fetch(`/api/crm/card?id=${cardId}`, { method: "DELETE" });
          if (!res.ok) return false;
          router.refresh();
        }}
        onRenameColumn={async (stageId, name) => {
          const res = await fetch("/api/crm/stage", jsonRequest("PUT", { id: stageId, name }));
          if (!res.ok) return false;
          router.refresh();
        }}
        onDeleteColumn={async (stageId) => {
          if (!window.confirm("Certeza que deseja excluir esta coluna inteira?")) return false;
          const res = await fetch(`/api/crm/stage?id=${stageId}`, { method: "DELETE" });
          if (!res.ok) return false;
          router.refresh();
        }}
        onAddColumn={async () => {
          const name = window.prompt("Nome da nova coluna:")?.trim();
          if (!name) return;
          const res = await fetch("/api/crm/stage", jsonRequest("POST", { name, pipelineId: pipeline.id }));
          if (!res.ok) return;
          router.refresh();
          const stage: CrmStage = await res.json();
          return { id: stage.id, title: stage.name, items: stage.cards };
        }}
      />

      {openDealId && (
        <DealDetailsPanel dealId={openDealId} onClose={() => openDeal(null)} onChanged={() => router.refresh()} />
      )}
    </>
  );
}

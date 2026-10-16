"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Kanban, type KanbanColumnData } from "@/components/kanban";
import { DealCard, type CrmDeal } from "./DealCard";
import { useCan } from "./CrmAccess";
import { postDeal } from "./CrmButtons";
import { sendStageMove } from "./stageEntry";
import { offerParentDone } from "./deal/DealTaskTools";
import { alertDialog, confirmDialog, promptDialog } from "@/components/ui/Dialogs";

type CrmStage = { id: string; name: string; wipLimit?: number | null; cards: CrmDeal[] };
type CrmPipeline = { id: string; kind?: "DEALS" | "TASKS"; stages: CrmStage[] };

const toColumns = (stages: CrmStage[]): KanbanColumnData<CrmDeal>[] =>
  stages.map((stage) => ({ id: stage.id, title: stage.name, items: stage.cards, limit: stage.wipLimit }));

const jsonRequest = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export function CrmKanban({
  pipeline,
  onOpenDeal,
  syncBoardRef,
  isDealVisible,
}: {
  pipeline: CrmPipeline;
  onOpenDeal: (deal: CrmDeal) => void;
  /** Set while the board listens for changes; calling it resyncs the columns */
  syncBoardRef: React.RefObject<(() => void) | null>;
  isDealVisible?: (deal: CrmDeal) => boolean;
}) {
  const router = useRouter();
  const can = useCan();
  const columns = useMemo(() => toColumns(pipeline.stages), [pipeline.stages]);
  const isTasks = pipeline.kind === "TASKS";

  const fetchColumns = useCallback(async () => {
    const res = await fetch(`/api/crm/pipeline?id=${pipeline.id}`);
    if (!res.ok) throw new Error(`Pipeline sync failed: ${res.status}`);
    const data: CrmPipeline = await res.json();
    return toColumns(data.stages);
  }, [pipeline.id]);

  // Realtime updates from other tabs/users via Server-Sent Events
  const subscribe = useCallback(
    (notify: () => void) => {
      syncBoardRef.current = notify;
      const source = new EventSource(`/api/crm/events?pipelineId=${encodeURIComponent(pipeline.id)}`);
      let hasConnected = false;

      source.onopen = () => {
        // EventSource reconnects on its own; resync in case events were missed meanwhile
        if (hasConnected) notify();
        hasConnected = true;
      };
      source.onmessage = () => notify();

      return () => {
        syncBoardRef.current = null;
        source.close();
      };
    },
    [pipeline.id, syncBoardRef]
  );

  return (
    <>
      <Kanban<CrmDeal>
        columns={columns}
        isItemVisible={isDealVisible}
        // Polling is only a fallback in case the SSE connection is blocked by a proxy
        sync={{ fetchColumns, subscribe, pollingIntervalMs: 30_000 }}
        labels={{
          addItem: isTasks ? "Nova Tarefa" : "Novo Negócio",
          addItemPlaceholder: isTasks ? "Nome da tarefa..." : "Nome do negócio...",
          addColumn: "+ Adicionar Coluna",
          renameColumn: "Renomear Coluna",
          deleteColumn: "Excluir Coluna",
          setColumnLimit: "Limite de cards",
        }}
        onMoveColumn={can("stage.edit") ? async (stageIds) => {
          // Task boards: the last column means "done"; changing it reopens or closes tasks
          const last = pipeline.stages.at(-1);
          if (isTasks && last && stageIds.at(-1) !== last.id) {
            const next = pipeline.stages.find((s) => s.id === stageIds.at(-1));
            const message = `A última coluna marca a tarefa como concluída. As tarefas de "${last.name}" deixarão de estar concluídas e as de "${next?.name}" passarão a estar. Continuar?`;
            if (!(await confirmDialog(message, { confirmLabel: "Mover" }))) return false;
          }
          const res = await fetch("/api/crm/stage", jsonRequest("PUT", { pipelineId: pipeline.id, stageIds }));
          if (!res.ok) return false;
          router.refresh();
        } : undefined}
        renderItem={(deal, { remove }) => <DealCard deal={deal} isTask={isTasks} onOpen={() => onOpenDeal(deal)} onDelete={can("deal.delete") ? remove : undefined} />}
        onMoveItem={can("deal.edit") ? async (cardId, newStageId, index) => {
          // Task boards: the last column means done; warn when the task still waits for another one
          const card = pipeline.stages.flatMap((s) => s.cards).find((c) => c.id === cardId);
          const closing = isTasks && card?.stageId !== newStageId && newStageId === pipeline.stages.at(-1)?.id;
          if (closing && card?.blocked) {
            if (!(await confirmDialog("Esta tarefa está bloqueada por outra que ainda não foi concluída. Concluir mesmo assim?", { confirmLabel: "Concluir" }))) return false;
          }
          // WIP limit is a warning: dropping into a full column asks first
          const target = pipeline.stages.find((s) => s.id === newStageId);
          const entering = target && !target.cards.some((c) => c.id === cardId);
          if (entering && target.wipLimit != null && target.cards.length >= target.wipLimit) {
            if (!(await confirmDialog(`A coluna "${target.name}" já está no limite de ${target.wipLimit} cards. Mover mesmo assim?`, { confirmLabel: "Mover" }))) return false;
          }
          const res = await sendStageMove((extra) => fetch("/api/crm/move", jsonRequest("POST", { cardId, newStageId, index, ...extra })));
          if (!res) return false;
          router.refresh();
          if (closing && (await offerParentDone(card?.parentId))) router.refresh();
        } : undefined}
        onAddItem={can("deal.create") ? async (stageId, title) => {
          const res = await postDeal({ title, stageId });
          if (!res?.ok) return;
          router.refresh();
          return (await res.json()) as CrmDeal;
        } : undefined}
        onDeleteItem={can("deal.delete") ? async (cardId) => {
          if (!(await confirmDialog(`Certeza que deseja excluir ${isTasks ? "esta tarefa" : "este negócio"}?`, { danger: true, confirmLabel: "Excluir" }))) return false;
          const res = await fetch(`/api/crm/card?id=${cardId}`, { method: "DELETE" });
          if (!res.ok) return false;
          router.refresh();
        } : undefined}
        onRenameColumn={can("stage.edit") ? async (stageId, name) => {
          const res = await fetch("/api/crm/stage", jsonRequest("PUT", { id: stageId, name }));
          if (!res.ok) return false;
          router.refresh();
        } : undefined}
        onSetColumnLimit={can("stage.edit") ? async (stageId, limit) => {
          const text = await promptDialog("Máximo de cards nesta coluna (vazio = sem limite):", { confirmLabel: "Salvar", defaultValue: limit == null ? "" : String(limit) });
          if (text === null) return;
          const wipLimit = text.trim() === "" ? null : Number(text.trim());
          if (wipLimit !== null && !(Number.isInteger(wipLimit) && wipLimit > 0 && wipLimit <= 1000)) return alertDialog("Informe um número inteiro de 1 a 1000.");
          const res = await fetch("/api/crm/stage", jsonRequest("PUT", { id: stageId, wipLimit }));
          if (!res.ok) return alertDialog((await res.json().catch(() => null))?.error ?? "Não foi possível salvar o limite.");
          router.refresh();
        } : undefined}
        onDeleteColumn={can("stage.delete") ? async (stageId) => {
          if (!(await confirmDialog("Certeza que deseja excluir esta coluna?", { danger: true, confirmLabel: "Excluir" }))) return false;
          const res = await fetch(`/api/crm/stage?id=${stageId}`, { method: "DELETE" });
          if (!res.ok) {
            const message = (await res.json().catch(() => null))?.error;
            if (res.status === 409 && message) alertDialog(message);
            return false;
          }
          router.refresh();
        } : undefined}
        onAddColumn={can("stage.create") ? async () => {
          const name = (await promptDialog("Nome da nova coluna:", { confirmLabel: "Criar" }))?.trim();
          if (!name) return;
          const res = await fetch("/api/crm/stage", jsonRequest("POST", { name, pipelineId: pipeline.id }));
          if (!res.ok) return;
          router.refresh();
          // Task boards insert it before "done": the refresh shows it in place
          if (isTasks) return;
          const stage: CrmStage = await res.json();
          return { id: stage.id, title: stage.name, items: stage.cards };
        } : undefined}
      />
    </>
  );
}

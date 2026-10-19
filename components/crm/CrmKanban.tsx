"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Kanban, type KanbanColumnData } from "@/components/kanban";
import { DealCard, type CrmDeal } from "./DealCard";
import { useCan } from "./CrmAccess";
import { postDeal } from "./CrmButtons";
import { sendStageMove } from "./stageEntry";
import { offerParentDone } from "./deal/DealTaskTools";
import { alertDialog, confirmDialog, promptDialog } from "@/components/ui/Dialogs";
import { PRIORITIES, formatMinutes } from "./deal/types";
import { dueAt } from "@/lib/crm-due";
import { AlertCircle, Clock } from "lucide-react";

type CrmStage = { id: string; name: string; wipLimit?: number | null; color?: string | null; cards: CrmDeal[] };
type CrmPipeline = { id: string; kind?: "DEALS" | "TASKS"; stages: CrmStage[] };

export type CardSort = "due" | "priority" | null;

/** Priority weight: urgent first, no priority last */
const priorityRank = (deal: CrmDeal) => (deal.priority ? PRIORITIES.findIndex((p) => p.value === deal.priority) : -1);
/** Deadline + due time as a sortable string; cards without a deadline go last */
const dueKey = (deal: CrmDeal) => (deal.closeDate ? `${new Date(deal.closeDate).toISOString().slice(0, 10)} ${deal.dueTime ?? "99"}` : "9999");

/** Copy of `cards` sorted by deadline or priority (stable: ties keep the manual order); null keeps the manual order. */
export function sortCards<T extends CrmDeal>(cards: T[], sort: CardSort): T[] {
  if (sort === "due") return [...cards].sort((a, b) => (dueKey(a) < dueKey(b) ? -1 : dueKey(a) > dueKey(b) ? 1 : 0));
  if (sort === "priority") return [...cards].sort((a, b) => priorityRank(b) - priorityRank(a));
  return cards;
}

const toColumns = (stages: CrmStage[], sort: CardSort): KanbanColumnData<CrmDeal>[] =>
  stages.map((stage) => ({ id: stage.id, title: stage.name, items: sortCards(stage.cards, sort), limit: stage.wipLimit, color: stage.color }));

/** Column totals under the header: time and late tasks on task boards, summed value on deal boards. */
function columnSummary(cards: CrmDeal[], isTasks: boolean) {
  if (!cards.length) return null;
  if (!isTasks) {
    // ponytail: sums every currency as BRL; split per currency if deals in other currencies show up
    const total = cards.reduce((sum, c) => sum + Number(c.value), 0);
    return (
      <div className="kanban-column__summary">
        <span title="Soma dos valores">{total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
      </div>
    );
  }
  const estimate = cards.reduce((sum, c) => sum + (c.estimateMinutes ?? 0), 0);
  const spent = cards.reduce((sum, c) => sum + (c.spentMinutes ?? 0), 0);
  const late = cards.filter((c) => c.status !== "WON" && c.closeDate && dueAt(c.closeDate, c.dueTime).getTime() < Date.now()).length;
  if (!estimate && !spent && !late) return null;
  return (
    <div className="kanban-column__summary">
      {(estimate > 0 || spent > 0) && (
        <span className={estimate && spent > estimate ? "is-over" : ""} title="Tempo gasto / estimativa somados">
          <Clock size={12} /> {formatMinutes(spent)}
          {estimate > 0 && `/${formatMinutes(estimate)}`}
        </span>
      )}
      {late > 0 && (
        <span className="is-over" title="Tarefas com prazo vencido">
          <AlertCircle size={12} /> {late} atrasada{late > 1 ? "s" : ""}
        </span>
      )}
    </div>
  );
}

const jsonRequest =(method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export function CrmKanban({
  pipeline,
  onOpenDeal,
  syncBoardRef,
  isDealVisible,
  sort = null,
  selected,
  onToggleSelect,
  lane,
}: {
  /** Swimlane mode: no sync of its own (CrmWorkspace refreshes every lane); "rest" also hides the column editing */
  lane?: "first" | "rest";
  pipeline: CrmPipeline;
  /** Shows each column sorted (view only: drops then keep the card's manual position) */
  sort?: CardSort;
  /** Selection mode (bulk actions): clicking a card toggles it instead of opening it */
  selected?: Set<string>;
  onToggleSelect?: (cardId: string) => void;
  onOpenDeal: (deal: CrmDeal) => void;
  /** Set while the board listens for changes; calling it resyncs the columns */
  syncBoardRef: React.RefObject<(() => void) | null>;
  isDealVisible?: (deal: CrmDeal) => boolean;
}) {
  const router = useRouter();
  const can = useCan();
  const columns = useMemo(() => toColumns(pipeline.stages, sort), [pipeline.stages, sort]);
  const isTasks = pipeline.kind === "TASKS";
  const editColumns = lane !== "rest";
  // Last card archived from its card button, offered back for a few seconds
  const [undo, setUndo] = useState<{ id: string; title: string } | null>(null);
  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(() => setUndo(null), 8_000);
    return () => clearTimeout(timer);
  }, [undo]);
  const restore = async () => {
    if (!undo) return;
    setUndo(null);
    const res = await fetch("/api/crm/card", jsonRequest("PATCH", { id: undo.id, archived: false }));
    if (!res.ok) return alertDialog("Não foi possível desfazer.");
    router.refresh();
  };

  const fetchColumns = useCallback(async () => {
    const res = await fetch(`/api/crm/pipeline?id=${pipeline.id}`);
    if (!res.ok) throw new Error(`Pipeline sync failed: ${res.status}`);
    const data: CrmPipeline = await res.json();
    return toColumns(data.stages, sort);
  }, [pipeline.id, sort]);

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
        summarize={(cards) => columnSummary(cards, isTasks)}
        // Polling is only a fallback in case the SSE connection is blocked by a proxy
        sync={lane ? undefined : { fetchColumns, subscribe, pollingIntervalMs: 30_000 }}
        labels={{
          addItem: isTasks ? "Nova Tarefa" : "Novo Negócio",
          addItemPlaceholder: isTasks ? "Nome da tarefa..." : "Nome do negócio...",
          addColumn: "+ Adicionar Coluna",
          renameColumn: "Renomear Coluna",
          deleteColumn: "Excluir Coluna",
          setColumnLimit: "Limite de cards",
        }}
        onMoveColumn={editColumns && can("stage.edit") ? async (stageIds) => {
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
        renderItem={(deal, { remove }) => (
          <DealCard
            deal={deal}
            isTask={isTasks}
            onOpen={onToggleSelect ? () => onToggleSelect(deal.id) : () => onOpenDeal(deal)}
            onArchive={can("deal.edit") ? remove : undefined}
            selected={onToggleSelect ? !!selected?.has(deal.id) : undefined}
          />
        )}
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
          const res = await sendStageMove((extra) => fetch("/api/crm/move", jsonRequest("POST", { cardId, newStageId, index: sort ? undefined : index, ...extra })));
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
        // The card button archives (with "Desfazer"); deleting for good is in the panel or the "Arquivados" list
        onDeleteItem={can("deal.edit") ? async (cardId) => {
          const res = await fetch("/api/crm/card", jsonRequest("PATCH", { id: cardId, archived: true }));
          if (!res.ok) return false;
          setUndo({ id: cardId, title: pipeline.stages.flatMap((s) => s.cards).find((c) => c.id === cardId)?.title ?? "" });
          router.refresh();
        } : undefined}
        onRenameColumn={editColumns && can("stage.edit") ? async (stageId, name) => {
          const res = await fetch("/api/crm/stage", jsonRequest("PUT", { id: stageId, name }));
          if (!res.ok) return false;
          router.refresh();
        } : undefined}
        onSetColumnLimit={editColumns && can("stage.edit") ? async (stageId, limit) => {
          const text = await promptDialog("Máximo de cards nesta coluna (vazio = sem limite):", { confirmLabel: "Salvar", defaultValue: limit == null ? "" : String(limit) });
          if (text === null) return;
          const wipLimit = text.trim() === "" ? null : Number(text.trim());
          if (wipLimit !== null && !(Number.isInteger(wipLimit) && wipLimit > 0 && wipLimit <= 1000)) return alertDialog("Informe um número inteiro de 1 a 1000.");
          const res = await fetch("/api/crm/stage", jsonRequest("PUT", { id: stageId, wipLimit }));
          if (!res.ok) return alertDialog((await res.json().catch(() => null))?.error ?? "Não foi possível salvar o limite.");
          router.refresh();
        } : undefined}
        onSetColumnColor={editColumns && can("stage.edit") ? async (stageId, color) => {
          const res = await fetch("/api/crm/stage", jsonRequest("PUT", { id: stageId, color }));
          if (!res.ok) return alertDialog("Não foi possível salvar a cor.");
          router.refresh();
        } : undefined}
        onDeleteColumn={editColumns && can("stage.delete") ? async (stageId) => {
          if (!(await confirmDialog("Certeza que deseja excluir esta coluna?", { danger: true, confirmLabel: "Excluir" }))) return false;
          const res = await fetch(`/api/crm/stage?id=${stageId}`, { method: "DELETE" });
          if (!res.ok) {
            const message = (await res.json().catch(() => null))?.error;
            if (res.status === 409 && message) alertDialog(message);
            return false;
          }
          router.refresh();
        } : undefined}
        onAddColumn={editColumns && can("stage.create") ? async () => {
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
      {undo && (
        <div className="crm-undo" role="status">
          <span>"{undo.title}" arquivad{isTasks ? "a" : "o"}</span>
          <button type="button" onClick={restore}>
            Desfazer
          </button>
        </div>
      )}
    </>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { BookmarkPlus, Trash2 } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { alertDialog, confirmDialog, promptDialog } from "@/components/ui/Dialogs";

type SavedView = { id: string; name: string; query: string };

const SAVE = "__save";

/**
 * "Visualizações": the member's named filters of the board. Picking one applies its query
 * (filters, view, sort); the active one is the view whose query matches the board's.
 */
export function CrmSavedViews({ pipelineId, query, onApply }: { pipelineId: string; query: string; onApply: (query: string) => void }) {
  const [views, setViews] = useState<SavedView[]>([]);

  const load = useCallback(async (signal?: AbortSignal) => {
    const res = await fetch(`/api/crm/view?pipelineId=${encodeURIComponent(pipelineId)}`, { cache: "no-store", signal });
    if (res.ok) setViews(await res.json());
  }, [pipelineId]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal).catch(() => {});
    return () => controller.abort();
  }, [load]);

  const active = views.find((v) => v.query === query);

  const save = async () => {
    const name = (await promptDialog("Nome da visualização (filtros, modo de exibição e ordenação atuais):", { confirmLabel: "Salvar", defaultValue: active?.name ?? "" }))?.trim();
    if (!name) return;
    const res = await fetch("/api/crm/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pipelineId, name, query }),
    });
    if (!res.ok) return alertDialog((await res.json().catch(() => null))?.error ?? "Não foi possível salvar.");
    load();
  };

  const remove = async () => {
    if (!active || !(await confirmDialog(`Excluir a visualização "${active.name}"?`, { danger: true, confirmLabel: "Excluir" }))) return;
    await fetch(`/api/crm/view?id=${active.id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="crm-saved-views">
      <Select
        className="crm-access__select"
        aria-label="Visualizações salvas"
        value={active?.id ?? ""}
        onChange={(e) => {
          if (e.target.value === SAVE) return save();
          const view = views.find((v) => v.id === e.target.value);
          onApply(view?.query ?? "");
        }}
      >
        <option value="">{views.length ? "Visualizações" : "Sem visualizações"}</option>
        {views.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name}
          </option>
        ))}
        <option value={SAVE}>+ Salvar atual…</option>
      </Select>
      {active && (
        <button type="button" className="deal-icon-btn" title="Excluir visualização" onClick={remove}>
          <Trash2 size={15} />
        </button>
      )}
      {!active && query && (
        <button type="button" className="deal-icon-btn" title="Salvar filtros atuais" onClick={save}>
          <BookmarkPlus size={15} />
        </button>
      )}
    </div>
  );
}

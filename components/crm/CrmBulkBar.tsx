"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, X } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { alertDialog, confirmDialog } from "@/components/ui/Dialogs";
import { useCan } from "./CrmAccess";
import { PRIORITIES, type TeamMember } from "./deal/types";

/** Actions on the cards selected in the list view (move, responsible, priority, delete) through /api/crm/card/bulk. */
export function CrmBulkBar({
  ids,
  stages,
  isTasks,
  onDone,
}: {
  ids: string[];
  stages: { id: string; name: string }[];
  isTasks: boolean;
  onDone: () => void;
}) {
  const router = useRouter();
  const can = useCan();
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/team", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : []))
      .then(setTeam)
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const run = async (action: string, value: string | null = null) => {
    if (action === "delete") {
      const what = isTasks ? (ids.length === 1 ? "tarefa" : "tarefas") : ids.length === 1 ? "negócio" : "negócios";
      if (!(await confirmDialog(`Excluir ${ids.length} ${what}?`, { danger: true, confirmLabel: "Excluir" }))) return;
    }
    setBusy(true);
    const res = await fetch("/api/crm/card/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, action, value }),
    });
    setBusy(false);
    const data = await res.json().catch(() => null);
    if (!res.ok) return alertDialog(data?.error ?? "Não foi possível aplicar a ação.");
    if (data?.failed) alertDialog(`${data.failed} de ${ids.length} não foram alterados (sem acesso ou bloqueados por regra da etapa).`);
    onDone();
    router.refresh();
  };

  if (!ids.length) return null;
  return (
    <div className="crm-bulk-bar" role="toolbar" aria-label="Ações em massa">
      <strong>{ids.length} selecionado{ids.length === 1 ? "" : "s"}</strong>
      {can("deal.edit") && (
        <>
          <Select className="crm-access__select" value="" disabled={busy} onChange={(e) => e.target.value && run("move", e.target.value)} aria-label="Mover">
            <option value="">Mover para…</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Select className="crm-access__select" value="" disabled={busy} onChange={(e) => e.target.value && run("responsible", e.target.value === "none" ? null : e.target.value)} aria-label="Responsável">
            <option value="">Responsável…</option>
            <option value="none">Sem responsável</option>
            {team.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
          {isTasks && (
            <Select className="crm-access__select" value="" disabled={busy} onChange={(e) => e.target.value && run("priority", e.target.value === "none" ? null : e.target.value)} aria-label="Prioridade">
              <option value="">Prioridade…</option>
              {[...PRIORITIES].reverse().map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
              <option value="none">Sem prioridade</option>
            </Select>
          )}
        </>
      )}
      {can("deal.delete") && (
        <button type="button" className="deal-icon-btn deal-icon-btn--danger" disabled={busy} title="Excluir selecionados" onClick={() => run("delete")}>
          <Trash2 size={16} />
        </button>
      )}
      <button type="button" className="deal-icon-btn" title="Limpar seleção" onClick={onDone}>
        <X size={16} />
      </button>
    </div>
  );
}

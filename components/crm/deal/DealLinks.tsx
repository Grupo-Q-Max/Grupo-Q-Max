"use client";

import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import type { DealDetails } from "./types";
import { Field, LookupInput } from "./ui";
import { useCan } from "../CrmAccess";
import { alertDialog } from "@/components/ui/Dialogs";

type LinkedCard = { id: string; number: number; title: string; status: string; pipeline: string; kind: "DEALS" | "TASKS" };

/** "Vínculos": cards of any board linked to this one (a task and the deal it serves). Saved right away. */
export function DealLinks({ deal, onOpenCard }: { deal: DealDetails; onOpenCard: (card: { id: string; number: number }) => void }) {
  const can = useCan();
  const [links, setLinks] = useState<LinkedCard[]>([]);
  const [query, setQuery] = useState("");

  const load = useCallback(async (signal?: AbortSignal) => {
    const res = await fetch(`/api/crm/link?cardId=${deal.id}`, { cache: "no-store", signal });
    if (res.ok) setLinks(await res.json());
  }, [deal.id]);

  // `deal` changes on every panel reload (realtime), so links made on the other card show up too
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal).catch(() => {});
    return () => controller.abort();
  }, [load, deal]);

  const send = async (init: RequestInit, url = "/api/crm/link") => {
    const res = await fetch(url, init);
    if (!res.ok) return alertDialog((await res.json().catch(() => null))?.error ?? "Não foi possível salvar o vínculo.");
    load();
  };

  if (deal.isTemplate) return null;

  return (
    <Field label="Vínculos">
      {links.length > 0 && (
        <div className="deal-chips">
          {links.map((card) => (
            <span key={card.id} className={`deal-chip ${card.status === "OPEN" ? "" : "deal-chip--done"}`} title={card.pipeline}>
              <a href={`/crm/deal/details/${card.number}`} onClick={(e) => (e.preventDefault(), onOpenCard(card))}>
                {card.kind === "TASKS" ? "Tarefa" : "Negócio"} #{card.number} {card.title}
              </a>
              {can("deal.edit") && (
                <button type="button" title="Remover vínculo" onClick={() => send({ method: "DELETE" }, `/api/crm/link?cardId=${deal.id}&linkedId=${card.id}`)}>
                  <X size={12} />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      {can("deal.edit") && (
        <LookupInput<{ id: string; name: string }>
          type="card"
          value={query}
          placeholder="Vincular tarefa ou negócio (nome ou #nº)"
          onChange={setQuery}
          onPick={(card) => {
            setQuery("");
            if (card.id === deal.id || links.some((l) => l.id === card.id)) return;
            send({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cardId: deal.id, linkedId: card.id }) });
          }}
        />
      )}
    </Field>
  );
}

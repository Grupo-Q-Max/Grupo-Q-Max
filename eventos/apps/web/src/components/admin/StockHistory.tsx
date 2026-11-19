"use client";

import { useState } from "react";

import { getAdminProxyUrl } from "@/lib/api-client";

type Movement = {
  id: number;
  type: string;
  quantity: number;
  stock_before: number;
  stock_after: number;
  reason: string | null;
  created_at: string;
};

const TYPE_LABEL: Record<string, string> = {
  INITIAL: "Inicial",
  DRAW: "Giro",
  MANUAL_ADD: "Entrada",
  MANUAL_REMOVE: "Saída",
  ADJUSTMENT: "Ajuste",
  RETURN: "Devolução",
};

// Histórico de movimentações carregado só quando o painel é aberto.
export default function StockHistory({ prizeId }: { prizeId: number }) {
  const [movements, setMovements] = useState<Movement[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load(open: boolean) {
    if (!open || movements) return;
    try {
      const res = await fetch(`${getAdminProxyUrl()}/prizes/${prizeId}/stock-history`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      setMovements(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar histórico.");
    }
  }

  return (
    <details className="mt-2 text-sm" onToggle={(e) => load(e.currentTarget.open)}>
      <summary className="cursor-pointer font-semibold text-finora-400 hover:text-finora-300 transition-colors">Histórico de estoque</summary>
      {error && <p className="mt-2 text-rose-400">{error}</p>}
      {!movements && !error && <p className="mt-2 text-text-2">Carregando…</p>}
      {movements && movements.length === 0 && <p className="mt-2 text-text-2">Sem movimentações.</p>}
      {movements && movements.length > 0 && (
        <div className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-line">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-paper text-text-2">
              <tr>
                <th className="p-2">Quando</th>
                <th className="p-2">Tipo</th>
                <th className="p-2">Estoque</th>
                <th className="p-2">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id} className="border-t border-line">
                  <td className="p-2 whitespace-nowrap">{new Date(m.created_at).toLocaleString("pt-BR")}</td>
                  <td className="p-2">{TYPE_LABEL[m.type] ?? m.type}</td>
                  <td className="p-2 font-mono whitespace-nowrap">
                    {m.stock_before} → {m.stock_after}
                  </td>
                  <td className="p-2">{m.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </details>
  );
}

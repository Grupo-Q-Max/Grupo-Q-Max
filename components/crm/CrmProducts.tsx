"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { matches } from "@/lib/text-search";
import { formatMoney } from "@/components/crm/deal/types";
import { confirmDialog } from "@/components/ui/Dialogs";

export type ProductRow = { id: string; name: string; price: number; hasBonus: boolean; deals: number };

/** Product catalog. Users with `product.manage` add, edit (on blur) and delete products. */
export function CrmProducts({ products, canManage }: { products: ProductRow[]; canManage: boolean }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [hasBonus, setHasBonus] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shown = products.filter((p) => matches(search, p.name));

  const send = async (method: string, body?: object, query = "") => {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/crm/product${query}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body && JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json().catch(() => null))?.error ?? "Não foi possível salvar.");
      return false;
    }
    router.refresh();
    return true;
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await send("POST", { name, price: price || 0, hasBonus })) {
      setName("");
      setPrice("");
      setHasBonus(false);
    }
  };

  const update = (p: ProductRow, changes: { name?: string; price?: number; hasBonus?: boolean }) => {
    if (changes.name !== undefined && changes.name.trim() === p.name) return;
    if (changes.price !== undefined && changes.price === p.price) return;
    void send("PUT", { id: p.id, ...changes });
  };

  const remove = async (p: ProductRow) => {
    const message = `Excluir "${p.name}" do catálogo? Os negócios mantêm o serviço já adicionado.`;
    if (!(await confirmDialog(message, { danger: true, confirmLabel: "Excluir" }))) return;
    void send("DELETE", undefined, `?id=${encodeURIComponent(p.id)}`);
  };

  return (
    <>
      <header className="crm-header">
        <h1 className="crm-header__title">Serviços ({products.length})</h1>
      </header>
      <div className="crm-content crm-access">
        {error && <div className="crm-access__error">{error}</div>}
        <p className="crm-access__note">
          O preço padrão entra automaticamente quando o serviço é adicionado a um negócio. Serviços novos (digitados no
          negócio ou vindos do QXBACK) entram aqui com preço zerado. Serviço com bonificação gera o bônus de R$ 20,00
          do QXBACK (enviado para aprovação) quando o negócio entra em Proposta em Elaboração.
        </p>

        {canManage && (
          <form className="crm-products__add" onSubmit={add}>
            <input
              className="crm-access__select"
              placeholder="Nome do serviço"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              aria-label="Nome do serviço"
            />
            <input
              className="crm-access__select"
              type="number"
              min={0}
              step="0.01"
              placeholder="Preço padrão (R$)"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              aria-label="Preço padrão"
            />
            <label className="crm-access__permission">
              <input type="checkbox" checked={hasBonus} onChange={(e) => setHasBonus(e.target.checked)} />
              Possui bonificação
            </label>
            <button type="submit" className="btn-primary" disabled={busy || !name.trim()}>
              <Plus size={18} /> Adicionar
            </button>
          </form>
        )}

        <input
          type="search"
          className="crm-access__select crm-contacts__search"
          placeholder="Buscar serviço"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Buscar"
        />

        {shown.length ? (
          <table className="crm-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Preço padrão</th>
                <th>Bonificação</th>
                <th>Linhas em negócios</th>
                {canManage && <th aria-label="Ações" />}
              </tr>
            </thead>
            <tbody>
              {shown.map((p) =>
                canManage ? (
                  // key includes the saved values so the inputs reset after router.refresh()
                  <tr key={`${p.id}:${p.name}:${p.price}:${p.hasBonus}`}>
                    <td>
                      <input
                        className="crm-access__select"
                        defaultValue={p.name}
                        disabled={busy}
                        onBlur={(e) => (e.target.value.trim() ? update(p, { name: e.target.value }) : (e.target.value = p.name))}
                        aria-label="Nome"
                      />
                    </td>
                    <td>
                      <input
                        className="crm-access__select"
                        type="number"
                        min={0}
                        step="0.01"
                        defaultValue={p.price}
                        disabled={busy}
                        onBlur={(e) => update(p, { price: Number(e.target.value) || 0 })}
                        aria-label="Preço padrão"
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        defaultChecked={p.hasBonus}
                        disabled={busy}
                        onChange={(e) => update(p, { hasBonus: e.target.checked })}
                        aria-label={`Bonificação de ${p.name}`}
                      />
                    </td>
                    <td>{p.deals}</td>
                    <td>
                      <button type="button" className="btn-secondary" disabled={busy} onClick={() => remove(p)} aria-label={`Excluir ${p.name}`}>
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ) : (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{formatMoney(p.price)}</td>
                    <td>{p.hasBonus ? "Sim" : "Não"}</td>
                    <td>{p.deals}</td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        ) : (
          <p className="crm-contacts__empty">{search.trim() ? "Nenhum serviço encontrado." : "Nenhum serviço cadastrado ainda."}</p>
        )}
      </div>
    </>
  );
}

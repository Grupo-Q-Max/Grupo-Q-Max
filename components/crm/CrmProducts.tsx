"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { matches } from "@/lib/text-search";
import { formatMoney } from "@/components/crm/deal/types";

export type ProductRow = { id: string; name: string; price: number; deals: number };

/** Product catalog. Users with `product.manage` add, edit (on blur) and delete products. */
export function CrmProducts({ products, canManage }: { products: ProductRow[]; canManage: boolean }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
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
    if (await send("POST", { name, price: price || 0 })) {
      setName("");
      setPrice("");
    }
  };

  const update = (p: ProductRow, changes: { name?: string; price?: number }) => {
    if (changes.name !== undefined && changes.name.trim() === p.name) return;
    if (changes.price !== undefined && changes.price === p.price) return;
    void send("PUT", { id: p.id, ...changes });
  };

  const remove = (p: ProductRow) => {
    if (!confirm(`Excluir "${p.name}" do catálogo? Os negócios mantêm o produto já adicionado.`)) return;
    void send("DELETE", undefined, `?id=${encodeURIComponent(p.id)}`);
  };

  return (
    <>
      <header className="crm-header">
        <h1 className="crm-header__title">Produtos ({products.length})</h1>
      </header>
      <div className="crm-content crm-access">
        {error && <div className="crm-access__error">{error}</div>}
        <p className="crm-access__note">
          O preço padrão entra automaticamente quando o produto é adicionado a um negócio. Produtos novos (digitados no
          negócio ou vindos do QXBACK) entram aqui com preço zerado.
        </p>

        {canManage && (
          <form className="crm-products__add" onSubmit={add}>
            <input
              className="crm-access__select"
              placeholder="Nome do produto"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              aria-label="Nome do produto"
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
            <button type="submit" className="btn-primary" disabled={busy || !name.trim()}>
              <Plus size={18} /> Adicionar
            </button>
          </form>
        )}

        <input
          type="search"
          className="crm-access__select crm-contacts__search"
          placeholder="Buscar produto"
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
                <th>Linhas em negócios</th>
                {canManage && <th aria-label="Ações" />}
              </tr>
            </thead>
            <tbody>
              {shown.map((p) =>
                canManage ? (
                  // key includes the saved values so the inputs reset after router.refresh()
                  <tr key={`${p.id}:${p.name}:${p.price}`}>
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
                    <td>{p.deals}</td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        ) : (
          <p className="crm-contacts__empty">{search.trim() ? "Nenhum produto encontrado." : "Nenhum produto cadastrado ainda."}</p>
        )}
      </div>
    </>
  );
}

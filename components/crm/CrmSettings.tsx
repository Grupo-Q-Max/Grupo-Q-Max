"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { confirmDialog, promptDialog } from "@/components/ui/Dialogs";

type Column = { id: string; name: string; isDone: boolean };
type Space = { id: string; name: string; pipelines: number };

/** `columns` / `spaces` are null when the user can't manage improvement requests / spaces. */
export function CrmSettings({
  columns,
  spaces,
  archiveAfterDays,
  canAccess,
}: {
  columns: Column[] | null;
  spaces: Space[] | null;
  archiveAfterDays: number;
  canAccess: boolean;
}) {
  const router = useRouter();
  const [newSpace, setNewSpace] = useState("");

  /** Space CRUD call; refreshes the page (and the sidebar) on success, shows the API error otherwise. */
  const saveSpace = async (method: "POST" | "PATCH" | "DELETE", body?: object, query = "") => {
    setSaving(true);
    setError(null);
    setNotice(null);
    const res = await fetch(`/api/crm/space${query}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body && JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) {
      setError((await res.json().catch(() => null))?.error ?? "Não foi possível salvar.");
      return false;
    }
    setNotice("Espaços atualizados.");
    router.refresh();
    return true;
  };

  const renameSpace = async (space: Space) => {
    const name = (await promptDialog("Novo nome do espaço", { title: "Renomear espaço", defaultValue: space.name }))?.trim();
    if (name && name !== space.name) saveSpace("PATCH", { id: space.id, name });
  };

  const deleteSpace = async (space: Space) => {
    const ok = await confirmDialog(`Excluir o espaço "${space.name}"? Os pipelines dele vão para "Geral".`, {
      title: "Excluir espaço",
      confirmLabel: "Excluir",
    });
    if (ok) saveSpace("DELETE", undefined, `?id=${encodeURIComponent(space.id)}`);
  };
  const [doneId, setDoneId] = useState(columns?.find((c) => c.isDone)?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const changeDone = async (id: string) => {
    const previous = doneId;
    setDoneId(id);
    setSaving(true);
    setError(null);
    setNotice(null);
    const res = await fetch("/api/crm/request/column", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: id || null }),
    });
    setSaving(false);
    if (!res.ok) {
      setDoneId(previous);
      return setError((await res.json().catch(() => null))?.error ?? "Não foi possível salvar.");
    }
    setNotice("Configuração salva.");
    router.refresh();
  };

  return (
    <>
      <header className="crm-header">
        <h1 className="crm-header__title">Configurações</h1>
      </header>
      <div className="crm-content crm-access">
        {error && <div className="crm-access__error">{error}</div>}
        {notice && <div className="crm-access__notice">{notice}</div>}

        {canAccess && (
          <section className="crm-access__editor crm-settings__section">
            <h3>Acessos</h3>
            <p className="crm-access__note">Grupos, permissões, convites e bloqueio dos usuários do CRM.</p>
            <Link href="/crm/settings/access" className="btn-secondary">
              <ShieldCheck size={18} /> Gerenciar níveis de acesso
            </Link>
          </section>
        )}

        {spaces && (
          <section className="crm-access__editor crm-settings__section">
            <h3>Espaços</h3>
            <p className="crm-access__note">
              Áreas que agrupam os pipelines na barra lateral (ex.: Comercial, Marketing, Tecnologia). O espaço de cada
              pipeline é escolhido nas configurações do pipeline.
            </p>
            <ul className="crm-settings__list">
              {spaces.map((space) => (
                <li key={space.id}>
                  <span>
                    {space.name} <small>({space.pipelines} pipeline{space.pipelines === 1 ? "" : "s"})</small>
                  </span>
                  <button type="button" className="btn-secondary" disabled={saving} onClick={() => renameSpace(space)} aria-label={`Renomear ${space.name}`}>
                    <Pencil size={16} />
                  </button>
                  <button type="button" className="btn-secondary" disabled={saving} onClick={() => deleteSpace(space)} aria-label={`Excluir ${space.name}`}>
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
            <form
              className="crm-settings__field"
              onSubmit={async (e) => {
                e.preventDefault();
                if (newSpace.trim() && (await saveSpace("POST", { name: newSpace.trim() }))) setNewSpace("");
              }}
            >
              <input
                type="text"
                maxLength={100}
                placeholder="Novo espaço (ex.: Tecnologia)"
                value={newSpace}
                onChange={(e) => setNewSpace(e.target.value)}
                disabled={saving}
                aria-label="Nome do novo espaço"
              />
              <button type="submit" className="btn-primary" disabled={saving || !newSpace.trim()}>
                <Plus size={16} /> Criar espaço
              </button>
            </form>
          </section>
        )}

        {columns && (
          <section className="crm-access__editor crm-settings__section">
            <h3>Pedidos de melhoria</h3>
            <label className="crm-settings__field">
              <span>Coluna de conclusão</span>
              <Select className="crm-access__select" value={doneId} disabled={saving} onChange={(e) => changeDone(e.target.value)}>
                <option value="">Nenhuma (não arquivar automaticamente)</option>
                {columns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </label>
            <p className="crm-access__note">
              Pedidos que ficarem {archiveAfterDays} dias nesta coluna do kanban vão para Arquivados automaticamente.
            </p>
          </section>
        )}
      </div>
    </>
  );
}

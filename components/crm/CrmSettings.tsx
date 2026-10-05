"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Select } from "@/components/ui/Select";

type Column = { id: string; name: string; isDone: boolean };

/** `columns` is null when the user can't manage improvement requests. */
export function CrmSettings({
  columns,
  archiveAfterDays,
  canAccess,
}: {
  columns: Column[] | null;
  archiveAfterDays: number;
  canAccess: boolean;
}) {
  const router = useRouter();
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

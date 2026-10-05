"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, ShieldCheck, Trash2 } from "lucide-react";
import { PERMISSION_SECTIONS, type Permission } from "@/lib/crm-permissions";

type Group = { id: string; name: string; isAdmin: boolean; isDefault: boolean; permissions: string[] };
type Member = { id: string; name: string; email: string | null; crmGroupId: string | null };

const jsonRequest = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

/** Error message of a failed request, else null. */
async function failure(res: Response) {
  return res.ok ? null : ((await res.json().catch(() => null))?.error ?? "Não foi possível salvar.");
}

export function CrmAccessManager({ groups, members }: { groups: Group[]; members: Member[] }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(groups[0]?.id ?? null);
  const [error, setError] = useState<string | null>(null);
  const selected = groups.find((g) => g.id === selectedId) ?? groups[0];
  const defaultGroup = groups.find((g) => g.isDefault);

  const run = async (request: Promise<Response>) => {
    setError(null);
    const message = await failure(await request);
    if (message) setError(message);
    else router.refresh();
    return !message;
  };

  const createGroup = async () => {
    const name = window.prompt("Nome do novo grupo:")?.trim();
    if (!name) return;
    const res = await fetch("/api/crm/access", jsonRequest("POST", { name, permissions: [] }));
    const message = await failure(res);
    if (message) return setError(message);
    setSelectedId((await res.json()).id);
    router.refresh();
  };

  const countOf = (group: Group) => members.filter((m) => (m.crmGroupId ?? defaultGroup?.id) === group.id).length;

  return (
    <>
      <header className="crm-header">
        <h1 className="crm-header__title">
          <ShieldCheck size={22} /> Níveis de acesso
        </h1>
        <div className="crm-header__actions">
          <button type="button" className="btn-primary" onClick={createGroup}>
            <Plus size={18} /> Novo grupo
          </button>
        </div>
      </header>

      <div className="crm-content crm-access">
        {error && <div className="crm-access__error">{error}</div>}

        <div className="crm-access__layout">
          <nav className="crm-access__groups">
            {groups.map((group) => (
              <button
                key={group.id}
                type="button"
                className={`crm-access__group ${group.id === selected?.id ? "is-active" : ""}`}
                onClick={() => setSelectedId(group.id)}
              >
                <span>{group.name}</span>
                <small>
                  {group.isAdmin ? "Acesso total" : `${group.permissions.length} permissões`}
                  {group.isDefault && " · padrão"} · {countOf(group)} usuário(s)
                </small>
              </button>
            ))}
          </nav>

          {selected && (
            <GroupEditor
              // Remount after a refresh so the form shows the saved data
              key={`${selected.id}:${selected.name}:${selected.permissions.join()}:${selected.isDefault}`}
              group={selected}
              onSave={(changes) => run(fetch("/api/crm/access", jsonRequest("PUT", { id: selected.id, ...changes })))}
              onDelete={async () => {
                if (!window.confirm(`Excluir o grupo "${selected.name}"? Os usuários dele passam para o grupo padrão.`)) return;
                if (await run(fetch(`/api/crm/access?id=${selected.id}`, { method: "DELETE" }))) setSelectedId(null);
              }}
            />
          )}
        </div>

        <section className="crm-access__members">
          <h3>Usuários</h3>
          <table className="crm-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Grupo</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id}>
                  <td>{member.name}</td>
                  <td>{member.email}</td>
                  <td>
                    <select
                      className="crm-access__select"
                      value={member.crmGroupId ?? ""}
                      onChange={(e) =>
                        run(fetch("/api/crm/access", jsonRequest("PATCH", { memberId: member.id, groupId: e.target.value || null })))
                      }
                    >
                      <option value="">Padrão ({defaultGroup?.name ?? "sem grupo"})</option>
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
              {members.length === 0 && (
                <tr>
                  <td colSpan={3} className="deal-empty">
                    Nenhum usuário com login no CRM.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}

function GroupEditor({
  group,
  onSave,
  onDelete,
}: {
  group: Group;
  onSave: (changes: { name?: string; permissions?: Permission[]; isDefault?: true }) => Promise<boolean>;
  onDelete: () => void;
}) {
  const [name, setName] = useState(group.name);
  const [permissions, setPermissions] = useState(() => new Set(group.permissions));
  const [saving, setSaving] = useState(false);

  const toggle = (permission: string) =>
    setPermissions((prev) => {
      const next = new Set(prev);
      if (!next.delete(permission)) next.add(permission);
      return next;
    });

  const save = async (changes: Parameters<typeof onSave>[0]) => {
    setSaving(true);
    await onSave(changes);
    setSaving(false);
  };

  return (
    <div className="crm-access__editor">
      <div className="crm-modal-group">
        <label htmlFor="group-name">Nome do grupo</label>
        <input id="group-name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      {group.isAdmin ? (
        <p className="crm-access__note">Administradores têm todas as permissões, inclusive as que forem criadas no futuro.</p>
      ) : (
        PERMISSION_SECTIONS.map((section) => (
          <fieldset key={section.label} className="crm-access__section">
            <legend>{section.label}</legend>
            {Object.entries(section.permissions).map(([key, label]) => (
              <label key={key} className="crm-access__permission">
                <input type="checkbox" checked={permissions.has(key)} onChange={() => toggle(key)} />
                {label}
              </label>
            ))}
          </fieldset>
        ))
      )}

      <div className="crm-access__actions">
        <button
          type="button"
          className="btn-primary"
          disabled={saving || !name.trim()}
          onClick={() => save({ name, ...(!group.isAdmin && { permissions: [...permissions] as Permission[] }) })}
        >
          {saving ? "Salvando..." : "Salvar"}
        </button>
        {!group.isDefault && !group.isAdmin && (
          <button type="button" className="btn-secondary" disabled={saving} onClick={() => save({ isDefault: true })}>
            Tornar grupo padrão
          </button>
        )}
        {!group.isDefault && !group.isAdmin && (
          <button type="button" className="btn-secondary crm-access__delete" disabled={saving} onClick={onDelete}>
            <Trash2 size={16} /> Excluir
          </button>
        )}
      </div>
      {group.isDefault && (
        <p className="crm-access__note">Grupo padrão: usado por quem não tem grupo, inclusive quem se cadastra pelo /register.</p>
      )}
    </div>
  );
}

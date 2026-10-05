"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Mail, Plus, ShieldCheck, Trash2, X } from "lucide-react";
import { PERMISSION_SECTIONS, type Permission } from "@/lib/crm-permissions";
import { Select } from "@/components/ui/Select";
import { confirmDialog, promptDialog } from "@/components/ui/Dialogs";

type Group = { id: string; name: string; isAdmin: boolean; isDefault: boolean; permissions: string[] };
type Member = {
  id: string;
  name: string;
  email: string | null;
  crmGroupId: string | null;
  /** false = blocked: can't sign in and has no permissions */
  crmActive: boolean;
  /** Invited (or created in /admin) but never signed in with Microsoft */
  pending: boolean;
  /** Pending and not on the public site, so cancelling the invite may delete it */
  cancellable: boolean;
};

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
  const [notice, setNotice] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const selected = groups.find((g) => g.id === selectedId) ?? groups[0];
  const defaultGroup = groups.find((g) => g.isDefault);

  const run = async (request: Promise<Response>) => {
    setError(null);
    setNotice(null);
    const message = await failure(await request);
    if (message) setError(message);
    else router.refresh();
    return !message;
  };

  const createGroup = async () => {
    const name = (await promptDialog("Nome do novo grupo:", { confirmLabel: "Criar" }))?.trim();
    if (!name) return;
    const res = await fetch("/api/crm/access", jsonRequest("POST", { name, permissions: [] }));
    const message = await failure(res);
    if (message) return setError(message);
    setSelectedId((await res.json()).id);
    router.refresh();
  };

  /** Sends (or resends) the invitation e-mail; returns the error message, if any. */
  const invite = async (fields: { name: string; email: string; groupId: string | null }) => {
    setNotice(null);
    const message = await failure(await fetch("/api/crm/invite", jsonRequest("POST", fields)));
    // Also on failure: when only the e-mail failed, the user is listed as pending (to resend)
    router.refresh();
    if (message) return message;
    setError(null);
    setNotice(`Convite enviado para ${fields.email}.`);
    return null;
  };

  const resend = async (member: Member) => {
    const message = await invite({ name: member.name, email: member.email ?? "", groupId: member.crmGroupId });
    if (message) setError(message);
  };

  const cancelInvite = async (member: Member) => {
    if (!(await confirmDialog(`Cancelar o convite de ${member.email}? Esse e-mail deixa de ter acesso ao CRM.`, { danger: true, confirmLabel: "Cancelar convite", cancelLabel: "Voltar" }))) return;
    run(fetch(`/api/crm/invite?memberId=${member.id}`, { method: "DELETE" }));
  };

  const setActive = async (member: Member, crmActive: boolean) => {
    if (!crmActive && !(await confirmDialog(`Bloquear ${member.name}? Ele não consegue mais entrar nem usar o CRM.`, { danger: true, confirmLabel: "Bloquear" }))) return;
    run(fetch("/api/crm/access", jsonRequest("PATCH", { memberId: member.id, crmActive })));
  };

  const countOf = (group: Group) => members.filter((m) => (m.crmGroupId ?? defaultGroup?.id) === group.id).length;

  return (
    <>
      <header className="crm-header">
        <h1 className="crm-header__title">
          <ShieldCheck size={22} /> Níveis de acesso
        </h1>
        <div className="crm-header__actions">
          <button type="button" className="btn-secondary" onClick={() => setInviting(true)}>
            <Mail size={18} /> Convidar usuário
          </button>
          <button type="button" className="btn-primary" onClick={createGroup}>
            <Plus size={18} /> Novo grupo
          </button>
        </div>
      </header>

      <div className="crm-content crm-access">
        {error && <div className="crm-access__error">{error}</div>}
        {notice && <div className="crm-access__notice">{notice}</div>}

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
                if (!(await confirmDialog(`Excluir o grupo "${selected.name}"? Os usuários dele passam para o grupo padrão.`, { danger: true, confirmLabel: "Excluir" }))) return;
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
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id}>
                  <td>{member.name}</td>
                  <td>{member.email}</td>
                  <td>
                    <Select
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
                    </Select>
                  </td>
                  <td>
                    <div className="crm-access__status">
                      {!member.crmActive ? (
                        <span className="crm-badge">Bloqueado</span>
                      ) : member.pending ? (
                        <span className="crm-badge">Convite pendente</span>
                      ) : (
                        "Ativo"
                      )}
                      {member.pending && member.crmActive && (
                        <button type="button" className="crm-access__link" onClick={() => resend(member)}>
                          Reenviar
                        </button>
                      )}
                      {member.pending && member.cancellable && (
                        <button type="button" className="crm-access__link crm-access__link--danger" onClick={() => cancelInvite(member)}>
                          Cancelar
                        </button>
                      )}
                      <button
                        type="button"
                        className={`crm-access__link ${member.crmActive ? "crm-access__link--danger" : ""}`}
                        onClick={() => setActive(member, !member.crmActive)}
                      >
                        {member.crmActive ? "Bloquear" : "Desbloquear"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {members.length === 0 && (
                <tr>
                  <td colSpan={4} className="deal-empty">
                    Nenhum usuário com login no CRM.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>

      {inviting &&
        createPortal(
          <InviteModal
            groups={groups}
            defaultGroupName={defaultGroup?.name}
            onClose={() => setInviting(false)}
            onInvite={async (fields) => {
              const message = await invite(fields);
              if (!message) setInviting(false);
              return message;
            }}
          />,
          document.body
        )}
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
        <p className="crm-access__note">Grupo padrão: usado por quem não tem grupo, inclusive quem entra com Microsoft pela primeira vez sem convite.</p>
      )}
    </div>
  );
}

function InviteModal({
  groups,
  defaultGroupName,
  onClose,
  onInvite,
}: {
  groups: Group[];
  defaultGroupName?: string;
  onClose: () => void;
  onInvite: (fields: { name: string; email: string; groupId: string | null }) => Promise<string | null>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setSending(true);
    const message = await onInvite({
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      groupId: String(form.get("groupId") ?? "") || null,
    });
    setSending(false);
    setError(message);
  };

  return (
    <div className="crm-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="crm-modal" role="dialog" aria-modal="true">
        <button type="button" className="crm-modal-close" onClick={onClose} aria-label="Fechar">
          <X size={20} />
        </button>
        <h2>Convidar usuário</h2>
        <p>A pessoa recebe um e-mail para entrar no CRM com a conta Microsoft desse endereço.</p>
        <form onSubmit={submit}>
          <div className="crm-modal-group">
            <label htmlFor="invite-name">Nome</label>
            <input id="invite-name" name="name" autoFocus readOnly={sending} />
          </div>
          <div className="crm-modal-group">
            <label htmlFor="invite-email">E-mail *</label>
            <input id="invite-email" name="email" type="email" required readOnly={sending} />
          </div>
          <div className="crm-modal-group">
            <label htmlFor="invite-group">Grupo de acesso</label>
            <Select id="invite-group" name="groupId" className="crm-access__select">
              <option value="">Padrão ({defaultGroupName ?? "sem grupo"})</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          </div>
          {error && <p className="crm-access__error">{error}</p>}
          <div className="crm-modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={sending}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={sending}>
              {sending ? "Enviando..." : "Enviar convite"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

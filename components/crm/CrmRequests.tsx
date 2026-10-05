"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Kanban as KanbanIcon, Lightbulb, Pencil, Send, Trash2, X } from "lucide-react";
import { Kanban, type KanbanColumnData } from "@/components/kanban";
import { AREAS } from "@/lib/crm-areas";

type RequestType = "IMPROVEMENT" | "BUG" | "OTHER";
type Area = keyof typeof AREAS;
type Column = { id: string; name: string; isDone: boolean };
type Request = {
  id: string;
  type: RequestType;
  area: Area;
  title: string;
  description: string;
  columnId: string;
  author: string;
  /** Sent by the current user */
  mine: boolean;
  /** The current user may edit, archive and delete it */
  canEdit: boolean;
  archived: boolean;
  createdAt: string;
};
type Draft = { type: RequestType; area: Area | ""; title: string; description: string };

const TYPES: Record<RequestType, string> = { IMPROVEMENT: "Melhoria", BUG: "Problema", OTHER: "Outro" };
const EMPTY_DRAFT: Draft = { type: "IMPROVEMENT", area: "", title: "", description: "" };
const ARCHIVE_AFTER_DAYS = 7; // keep in sync with lib/crm-requests.ts

const jsonRequest = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

/** Error message of a failed request, else null. */
async function failure(res: Response) {
  return res.ok ? null : ((await res.json().catch(() => null))?.error ?? "Não foi possível salvar.");
}

/** Type, area, title and description inputs of the new request form and of the edit form. */
function RequestFields({ draft, onChange }: { draft: Draft; onChange: (draft: Draft) => void }) {
  return (
    <>
      <div className="crm-requests__row">
        <select
          className="crm-access__select"
          value={draft.type}
          onChange={(e) => onChange({ ...draft, type: e.target.value as RequestType })}
          aria-label="Tipo"
        >
          {Object.entries(TYPES).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          className="crm-access__select"
          value={draft.area}
          required
          onChange={(e) => onChange({ ...draft, area: e.target.value as Area })}
          aria-label="Área"
        >
          <option value="" disabled>
            Área
          </option>
          {Object.entries(AREAS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <input
          className="crm-access__select crm-requests__title"
          placeholder="Título"
          maxLength={200}
          required
          value={draft.title}
          onChange={(e) => onChange({ ...draft, title: e.target.value })}
        />
      </div>
      <textarea
        className="crm-access__select"
        placeholder="Descreva o que você precisa ou o que poderia melhorar"
        rows={4}
        required
        value={draft.description}
        onChange={(e) => onChange({ ...draft, description: e.target.value })}
      />
    </>
  );
}

export function CrmRequests({
  requests,
  columns,
  canManage,
  canCreate,
}: {
  requests: Request[];
  columns: Column[];
  canManage: boolean;
  canCreate: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [view, setView] = useState<"requests" | "board" | "archived">("requests");
  const [openedId, setOpenedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Draft | null>(null);
  // Looked up by id so the modal shows the refreshed data and closes once the request is deleted
  const opened = requests.find((r) => r.id === openedId) ?? null;

  const active = useMemo(() => requests.filter((r) => !r.archived), [requests]);
  const listed = useMemo(
    () =>
      // Managers see everything on the board; the list shows their own. Others get theirs and their area's.
      requests
        .filter((r) => (view === "archived" ? r.archived : !r.archived && (r.mine || !canManage)))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [requests, view, canManage]
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    const message = await failure(await fetch("/api/crm/request", jsonRequest("POST", draft)));
    setSaving(false);
    if (message) return setError(message);
    setDraft({ ...EMPTY_DRAFT, type: draft.type });
    setNotice("Pedido enviado. Obrigado!");
    router.refresh();
  };

  const close = () => {
    setOpenedId(null);
    setEditing(null);
  };

  useEffect(() => {
    if (!openedId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpenedId(null);
      setEditing(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openedId]);

  const columnName = useMemo(() => new Map(columns.map((c) => [c.id, c.name])), [columns]);
  const board = useMemo<KanbanColumnData<Request>[]>(
    () =>
      columns.map((c) => ({
        id: c.id,
        title: c.isDone ? `${c.name} ✓` : c.name,
        items: active.filter((r) => r.columnId === c.id),
      })),
    [columns, active]
  );

  /** Runs a mutation; returns false (cancels the optimistic update) and shows the error on failure. */
  const save = async (res: Promise<Response>) => {
    setError(null);
    setNotice(null);
    const message = await failure(await res);
    if (message) {
      setError(message);
      return false;
    }
    router.refresh();
  };

  const setArchived = (r: Request, archived: boolean) =>
    save(fetch("/api/crm/request", jsonRequest("PUT", { id: r.id, archived }))).then((ok) => {
      if (ok !== false) close();
    });

  const remove = (r: Request) => {
    if (!window.confirm(`Apagar o pedido "${r.title}"? Esta ação não pode ser desfeita.`)) return;
    save(fetch(`/api/crm/request?id=${encodeURIComponent(r.id)}`, { method: "DELETE" })).then((ok) => {
      if (ok !== false) close();
    });
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!opened || !editing) return;
    setSaving(true);
    const ok = await save(fetch("/api/crm/request", jsonRequest("PUT", { id: opened.id, ...editing })));
    setSaving(false);
    if (ok !== false) setEditing(null);
  };

  return (
    <>
      <header className="crm-header">
        <h1 className="crm-header__title">Pedidos de melhoria</h1>
        <div className="crm-toolbar__views">
          <button className={`view-btn ${view === "requests" ? "is-active" : ""}`} onClick={() => setView("requests")}>
            <Lightbulb size={16} /> Pedidos
          </button>
          {canManage && (
            <button className={`view-btn ${view === "board" ? "is-active" : ""}`} onClick={() => setView("board")}>
              <KanbanIcon size={16} /> Kanban
            </button>
          )}
          <button className={`view-btn ${view === "archived" ? "is-active" : ""}`} onClick={() => setView("archived")}>
            <Archive size={16} /> Arquivados
          </button>
        </div>
      </header>
      <div className="crm-content crm-access">
        {error && <div className="crm-access__error">{error}</div>}
        {notice && <div className="crm-access__notice">{notice}</div>}

        {view === "requests" && canCreate && (
          <form className="crm-access__editor crm-requests__form" onSubmit={submit}>
            <h3>Novo pedido</h3>
            <RequestFields draft={draft} onChange={setDraft} />
            <div>
              <button type="submit" className="btn-primary" disabled={saving}>
                <Send size={16} />
                {saving ? "Enviando..." : "Enviar pedido"}
              </button>
            </div>
          </form>
        )}

        {view === "board" ? (
          <>
            <label className="crm-requests__done">
              Coluna de conclusão
              <select
                className="crm-access__select"
                value={columns.find((c) => c.isDone)?.id ?? ""}
                onChange={(e) => save(fetch("/api/crm/request/column", jsonRequest("PATCH", { id: e.target.value || null })))}
              >
                <option value="">Nenhuma</option>
                {columns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <span className="crm-requests__hint">Pedidos nesta coluna são arquivados após {ARCHIVE_AFTER_DAYS} dias.</span>
            </label>
            <Kanban<Request>
              columns={board}
              className="crm-requests__board"
              labels={{ addColumn: "+ Adicionar coluna", deleteColumn: "Excluir coluna" }}
              renderItem={(r) => (
                <div className="kanban-card" onClick={() => setOpenedId(r.id)}>
                  <h3 className="kanban-card__title">{r.title}</h3>
                  <div className="crm-requests__description">{r.description}</div>
                  <div className="kanban-card__footer">
                    <span className="crm-badge">{TYPES[r.type]}</span>
                    <span className="crm-badge">{AREAS[r.area]}</span>
                    <span className="kanban-card__date">
                      {r.author} · {new Date(r.createdAt).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                </div>
              )}
              onMoveItem={(id, columnId, index) => save(fetch("/api/crm/request", jsonRequest("PATCH", { id, columnId, index })))}
              onDeleteColumn={(id) => {
                if (!window.confirm("Excluir esta coluna? Os pedidos dela vão para a primeira coluna.")) return false;
                return save(fetch(`/api/crm/request/column?id=${id}`, { method: "DELETE" }));
              }}
              onAddColumn={async () => {
                const name = window.prompt("Nome da nova coluna:")?.trim();
                if (!name) return;
                const res = await fetch("/api/crm/request/column", jsonRequest("POST", { name }));
                const message = await failure(res);
                if (message) return setError(message);
                const column: Column = await res.json();
                router.refresh();
                return { id: column.id, title: column.name, items: [] };
              }}
            />
          </>
        ) : (
          <section className="crm-access__members">
            <h3>{view === "archived" ? "Pedidos arquivados" : canManage ? "Meus pedidos" : "Meus pedidos e da minha área"}</h3>
            <table className="crm-table crm-requests__table">
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Tipo</th>
                  <th>Área</th>
                  <th>Data</th>
                  <th>Status</th>
                  <th aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {listed.map((r) => (
                  <tr key={r.id} onClick={() => setOpenedId(r.id)}>
                    <td>
                      <strong>{r.title}</strong>
                      <div className="crm-requests__description">{r.description}</div>
                      {!r.mine && <div className="crm-requests__description">por {r.author}</div>}
                    </td>
                    <td>{TYPES[r.type]}</td>
                    <td>{AREAS[r.area]}</td>
                    <td>{new Date(r.createdAt).toLocaleDateString("pt-BR")}</td>
                    <td>
                      <span className="crm-badge">{columnName.get(r.columnId)}</span>
                    </td>
                    <td>
                      {r.canEdit && (
                        <button
                          type="button"
                          className="crm-access__link"
                          title={r.archived ? "Desarquivar" : "Arquivar"}
                          onClick={(e) => {
                            e.stopPropagation();
                            setArchived(r, !r.archived);
                          }}
                        >
                          {r.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {listed.length === 0 && (
                  <tr>
                    <td colSpan={6} className="deal-empty">
                      {view === "archived" ? "Nenhum pedido arquivado." : "Nenhum pedido ainda."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        )}
      </div>

      {opened &&
        createPortal(
          <div className="crm-modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && close()}>
            <div className="crm-modal crm-requests__modal" role="dialog" aria-modal="true" aria-label={opened.title}>
              <button type="button" className="crm-modal-close" onClick={close} aria-label="Fechar">
                <X size={20} />
              </button>
              {editing ? (
                <form className="crm-requests__form" onSubmit={saveEdit}>
                  <h2>Editar pedido</h2>
                  {error && <div className="crm-access__error">{error}</div>}
                  <RequestFields draft={editing} onChange={setEditing} />
                  <div className="crm-access__actions">
                    <button type="submit" className="btn-primary" disabled={saving}>
                      {saving ? "Salvando..." : "Salvar"}
                    </button>
                    <button type="button" className="btn-secondary" onClick={() => setEditing(null)}>
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <h2>{opened.title}</h2>
                  <div className="crm-requests__meta">
                    <span className="crm-badge">{TYPES[opened.type]}</span>
                    <span className="crm-badge">{AREAS[opened.area]}</span>
                    <span className="crm-badge">{opened.archived ? "Arquivado" : columnName.get(opened.columnId)}</span>
                    <span>
                      {opened.author} · {new Date(opened.createdAt).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <div className="crm-requests__description crm-requests__full">{opened.description}</div>
                  {opened.canEdit && (
                    <div className="crm-access__actions crm-requests__actions">
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => {
                          setError(null);
                          setEditing({ type: opened.type, area: opened.area, title: opened.title, description: opened.description });
                        }}
                      >
                        <Pencil size={16} /> Editar
                      </button>
                      <button type="button" className="btn-secondary" onClick={() => setArchived(opened, !opened.archived)}>
                        {opened.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                        {opened.archived ? "Desarquivar" : "Arquivar"}
                      </button>
                      <button type="button" className="btn-secondary crm-access__delete" onClick={() => remove(opened)}>
                        <Trash2 size={16} /> Apagar
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

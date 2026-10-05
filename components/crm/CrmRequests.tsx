"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Kanban as KanbanIcon, Lightbulb, Send, X } from "lucide-react";
import { Kanban, type KanbanColumnData } from "@/components/kanban";
import { AREAS } from "@/lib/crm-areas";

type RequestType = "IMPROVEMENT" | "BUG" | "OTHER";
type Area = keyof typeof AREAS;
type Column = { id: string; name: string };
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
  createdAt: string;
};

const TYPES: Record<RequestType, string> = { IMPROVEMENT: "Melhoria", BUG: "Problema", OTHER: "Outro" };

const jsonRequest = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

/** Error message of a failed request, else null. */
async function failure(res: Response) {
  return res.ok ? null : ((await res.json().catch(() => null))?.error ?? "Não foi possível salvar.");
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
  const [type, setType] = useState<RequestType>("IMPROVEMENT");
  const [area, setArea] = useState<Area | "">("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [view, setView] = useState<"requests" | "board">("requests");
  const [opened, setOpened] = useState<Request | null>(null);
  // Managers see everything on the board; the list shows their own. Others get theirs and their area's.
  const myRequests = useMemo(() => requests.filter((r) => r.mine || !canManage).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [requests, canManage]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    const message = await failure(await fetch("/api/crm/request", jsonRequest("POST", { type, area, title, description })));
    setSaving(false);
    if (message) return setError(message);
    setArea("");
    setTitle("");
    setDescription("");
    setNotice("Pedido enviado. Obrigado!");
    router.refresh();
  };

  useEffect(() => {
    if (!opened) return;
    const onKeyDown = (e: KeyboardEvent) => e.key === "Escape" && setOpened(null);
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [opened]);

  const columnName = useMemo(() => new Map(columns.map((c) => [c.id, c.name])), [columns]);
  const board = useMemo<KanbanColumnData<Request>[]>(
    () => columns.map((c) => ({ id: c.id, title: c.name, items: requests.filter((r) => r.columnId === c.id) })),
    [columns, requests]
  );

  /** Runs a board mutation; returns false (cancels the optimistic update) and shows the error on failure. */
  const save = async (res: Promise<Response>) => {
    setError(null);
    const message = await failure(await res);
    if (message) {
      setError(message);
      return false;
    }
    router.refresh();
  };

  return (
    <>
      <header className="crm-header">
        <h1 className="crm-header__title">Pedidos de melhoria</h1>
        {canManage && (
          <div className="crm-toolbar__views">
            <button className={`view-btn ${view === "requests" ? "is-active" : ""}`} onClick={() => setView("requests")}>
              <Lightbulb size={16} /> Pedidos
            </button>
            <button className={`view-btn ${view === "board" ? "is-active" : ""}`} onClick={() => setView("board")}>
              <KanbanIcon size={16} /> Kanban
            </button>
          </div>
        )}
      </header>
      <div className="crm-content crm-access">
        {error && <div className="crm-access__error">{error}</div>}
        {notice && <div className="crm-access__notice">{notice}</div>}

        {view === "requests" && canCreate && (
          <form className="crm-access__editor crm-requests__form" onSubmit={submit}>
            <h3>Novo pedido</h3>
            <div className="crm-requests__row">
              <select className="crm-access__select" value={type} onChange={(e) => setType(e.target.value as RequestType)} aria-label="Tipo">
                {Object.entries(TYPES).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <select className="crm-access__select" value={area} required onChange={(e) => setArea(e.target.value as Area)} aria-label="Área">
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
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <textarea
              className="crm-access__select"
              placeholder="Descreva o que você precisa ou o que poderia melhorar"
              rows={4}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <div>
              <button type="submit" className="btn-primary" disabled={saving}>
                <Send size={16} />
                {saving ? "Enviando..." : "Enviar pedido"}
              </button>
            </div>
          </form>
        )}

        {view === "board" ? (
          <Kanban<Request>
            columns={board}
            className="crm-requests__board"
            labels={{ addColumn: "+ Adicionar coluna", deleteColumn: "Excluir coluna" }}
            renderItem={(r) => (
              <div className="kanban-card" onClick={() => setOpened(r)}>
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
        ) : (
          <section className="crm-access__members">
            <h3>{canManage ? "Meus pedidos" : "Meus pedidos e da minha área"}</h3>
            <table className="crm-table">
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Tipo</th>
                  <th>Área</th>
                  <th>Data</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {myRequests.map((r) => (
                  <tr key={r.id}>
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
                  </tr>
                ))}
                {myRequests.length === 0 && (
                  <tr>
                    <td colSpan={5} className="deal-empty">
                      Nenhum pedido ainda.
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
          <div className="crm-modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && setOpened(null)}>
            <div className="crm-modal crm-requests__modal" role="dialog" aria-modal="true" aria-label={opened.title}>
              <button type="button" className="crm-modal-close" onClick={() => setOpened(null)} aria-label="Fechar">
                <X size={20} />
              </button>
              <h2>{opened.title}</h2>
              <div className="crm-requests__meta">
                <span className="crm-badge">{TYPES[opened.type]}</span>
                <span className="crm-badge">{AREAS[opened.area]}</span>
                <span className="crm-badge">{columnName.get(opened.columnId)}</span>
                <span>
                  {opened.author} · {new Date(opened.createdAt).toLocaleString("pt-BR")}
                </span>
              </div>
              <div className="crm-requests__description crm-requests__full">{opened.description}</div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

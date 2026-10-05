"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";

type RequestType = "IMPROVEMENT" | "BUG" | "OTHER";
type RequestStatus = "OPEN" | "IN_PROGRESS" | "DONE" | "REJECTED";
type Request = {
  id: string;
  type: RequestType;
  title: string;
  description: string;
  status: RequestStatus;
  author: string;
  createdAt: string;
};

const TYPES: Record<RequestType, string> = { IMPROVEMENT: "Melhoria", BUG: "Problema", OTHER: "Outro" };
const STATUSES: Record<RequestStatus, string> = {
  OPEN: "Aberto",
  IN_PROGRESS: "Em andamento",
  DONE: "Concluído",
  REJECTED: "Recusado",
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

export function CrmRequests({ requests, canManage, canCreate }: { requests: Request[]; canManage: boolean; canCreate: boolean }) {
  const router = useRouter();
  const [type, setType] = useState<RequestType>("IMPROVEMENT");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    const message = await failure(await fetch("/api/crm/request", jsonRequest("POST", { type, title, description })));
    setSaving(false);
    if (message) return setError(message);
    setTitle("");
    setDescription("");
    setNotice("Pedido enviado. Obrigado!");
    router.refresh();
  };

  const setStatus = async (id: string, status: RequestStatus) => {
    setError(null);
    const message = await failure(await fetch("/api/crm/request", jsonRequest("PATCH", { id, status })));
    if (message) setError(message);
    else router.refresh();
  };

  return (
    <>
      <header className="crm-header">
        <h1 className="crm-header__title">Pedidos de melhoria</h1>
      </header>
      <div className="crm-content crm-access">
        {error && <div className="crm-access__error">{error}</div>}
        {notice && <div className="crm-access__notice">{notice}</div>}

        {canCreate && (
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

        <section className="crm-access__members">
          <h3>{canManage ? "Todos os pedidos" : "Meus pedidos"}</h3>
          <table className="crm-table">
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Tipo</th>
                {canManage && <th>Autor</th>}
                <th>Data</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.title}</strong>
                    <p className="crm-requests__description">{r.description}</p>
                  </td>
                  <td>{TYPES[r.type]}</td>
                  {canManage && <td>{r.author}</td>}
                  <td>{new Date(r.createdAt).toLocaleDateString("pt-BR")}</td>
                  <td>
                    {canManage ? (
                      <select
                        className="crm-access__select"
                        value={r.status}
                        onChange={(e) => setStatus(r.id, e.target.value as RequestStatus)}
                      >
                        {Object.entries(STATUSES).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="crm-badge">{STATUSES[r.status]}</span>
                    )}
                  </td>
                </tr>
              ))}
              {requests.length === 0 && (
                <tr>
                  <td colSpan={canManage ? 5 : 4} className="deal-empty">
                    Nenhum pedido ainda.
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

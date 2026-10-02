"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { ACTIVITY_TYPES, RUN_STATUS_LABELS, type ActivityType } from "@/lib/crm-automation-shared";

type Run = {
  id: string;
  status: string;
  runAt: string;
  updatedAt: string;
  attempts: number;
  error: string | null;
  /** Webhook: the request sent. Create activity: the activity created. Update deal: the changes made */
  request: {
    method?: string;
    url?: string;
    activityId?: string;
    type?: ActivityType;
    title?: string;
    responsible?: string | null;
    deadline?: string | null;
    changes?: { label: string; from: string | null; to: string | null }[];
  } | null;
  httpStatus: number | null;
  responseBody: string | null;
  automation: { name: string; stage: { name: string } };
  card: { number: number; title: string };
};

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** "Registros": execution log of the pipeline's rules, newest first. */
export function AutomationRunsTab({ pipelineId }: { pipelineId: string }) {
  const [runs, setRuns] = useState<Run[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ pipelineId, page: String(page), ...(status && { status }) });
    const res = await fetch(`/api/crm/automation/runs?${params}`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setRuns(data.runs);
      setTotal(data.total);
      setPageSize(data.pageSize);
    }
    setLoading(false);
  }, [pipelineId, page, status]);

  useEffect(() => {
    load();
  }, [load]);

  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="auto-runs">
      <div className="auto-runs__toolbar">
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(0);
          }}
        >
          <option value="">Todos os status</option>
          {Object.entries(RUN_STATUS_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <button type="button" className="btn-secondary auto-btn-sm" onClick={load} disabled={loading}>
          <RefreshCw size={14} className={loading ? "auto-spin" : ""} /> Atualizar
        </button>
        <span className="auto-runs__count">{total} registro(s)</span>
      </div>

      <table className="crm-table auto-runs__table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Negócio</th>
            <th>Regra</th>
            <th>Etapa</th>
            <th>Status</th>
            <th>HTTP</th>
            <th>Detalhes</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <Fragment key={run.id}>
              <tr onClick={() => setExpanded(expanded === run.id ? null : run.id)} className="auto-runs__row">
                <td>{formatDateTime(run.status === "PENDING" ? run.runAt : run.updatedAt)}</td>
                <td>
                  <Link href={`/crm/deal/details/${run.card.number}`} onClick={(e) => e.stopPropagation()}>
                    #{run.card.number} {run.card.title}
                  </Link>
                </td>
                <td>{run.automation.name}</td>
                <td>{run.automation.stage.name}</td>
                <td>
                  <span className={`auto-status auto-status--${run.status.toLowerCase()}`}>{RUN_STATUS_LABELS[run.status]}</span>
                </td>
                <td>{run.httpStatus ?? "—"}</td>
                <td className="auto-runs__error">
                  {run.status === "PENDING" && !run.error ? `executa em ${formatDateTime(run.runAt)}` : run.error ?? ""}
                  {run.attempts > 1 && ` (${run.attempts} tentativas)`}
                </td>
              </tr>
              {expanded === run.id && (
                <tr className="auto-runs__details">
                  <td colSpan={7}>
                    {run.request?.url ? (
                      <>
                        <b>{run.request.method}</b> {run.request.url}
                        {run.responseBody && <pre>{run.responseBody}</pre>}
                      </>
                    ) : run.request?.title ? (
                      <>
                        <b>{run.request.activityId ? "Atividade criada" : "Atividade não criada"}:</b>{" "}
                        {(run.request.type && ACTIVITY_TYPES[run.request.type]) ?? "Atividade"} · {run.request.title} · para{" "}
                        {run.request.responsible ?? "ninguém"}
                        {run.request.deadline && ` · prazo ${formatDateTime(run.request.deadline)}`}
                      </>
                    ) : run.request?.changes ? (
                      run.request.changes.length === 0 ? (
                        run.status === "SUCCESS" ? "Nenhuma alteração: o negócio já estava assim." : "A ação não foi executada."
                      ) : (
                        <>
                          <b>Negócio alterado:</b>{" "}
                          {run.request.changes
                            .map((c) => `${c.label}: ${c.from ?? "vazio"} → ${c.to ?? "vazio"}`)
                            .join(" · ")}
                        </>
                      )
                    ) : (
                      "A ação não foi executada."
                    )}
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
          {!loading && runs.length === 0 && (
            <tr>
              <td colSpan={7} className="auto-empty">
                Nenhuma execução registrada ainda.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {pages > 1 && (
        <div className="auto-runs__pager">
          <button type="button" className="btn-secondary auto-btn-sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
            Anterior
          </button>
          <span>
            Página {page + 1} de {pages}
          </span>
          <button type="button" className="btn-secondary auto-btn-sm" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>
            Próxima
          </button>
        </div>
      )}
    </div>
  );
}

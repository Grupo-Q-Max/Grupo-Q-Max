"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import {
  ACTIVITY_TYPES,
  BRANCHES,
  RUN_STATUS_LABELS,
  stepLabel,
  type ActionType,
  type ActivityType,
  type Branch,
  type DelayUnit,
  type StepType,
} from "@/lib/crm-automation-shared";
import { Select } from "@/components/ui/Select";
import { useCan } from "@/components/crm/CrmAccess";
import { alertDialog, confirmDialog } from "@/components/ui/Dialogs";

/** Webhook: the request sent. Create activity: the activity created. Update deal: the changes made. Notify: the comment and who was notified. Wait: until when */
type ActionLog = {
  method?: string;
  url?: string;
  activityId?: string;
  type?: ActivityType;
  title?: string;
  responsible?: string | null;
  deadline?: string | null;
  changes?: { label: string; from: string | null; to: string | null }[];
  message?: string;
  notified?: string[];
  until?: string;
} | null;

/** A step run by a FLOW rule */
type RunStep = {
  id: string;
  label: string;
  stepType: StepType;
  status: string;
  branch: Branch | null;
  request: ActionLog;
  httpStatus: number | null;
  responseBody: string | null;
  error: string | null;
};

type Run = {
  id: string;
  status: string;
  runAt: string;
  updatedAt: string;
  attempts: number;
  error: string | null;
  request: ActionLog;
  httpStatus: number | null;
  responseBody: string | null;
  stepCount: number;
  steps: RunStep[];
  /** FLOW runs: next step to run */
  step: { type: StepType; waitAmount: number | null; waitUnit: DelayUnit | null; actions: { name: string; actionType: ActionType }[] } | null;
  automation: { name: string; actionType: ActionType; stage: { name: string } };
  card: { number: number; title: string };
};

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** What an action did, from its log. */
function ActionDetail({ request, status, responseBody }: { request: ActionLog; status: string; responseBody: string | null }) {
  if (request?.url) {
    return (
      <>
        <b>{request.method}</b> {request.url}
        {responseBody && <pre>{responseBody}</pre>}
      </>
    );
  }
  if (request?.title) {
    return (
      <>
        <b>{request.activityId ? "Atividade criada" : "Atividade não criada"}:</b>{" "}
        {(request.type && ACTIVITY_TYPES[request.type]) ?? "Atividade"} · {request.title} · para {request.responsible ?? "ninguém"}
        {request.deadline && ` · prazo ${formatDateTime(request.deadline)}`}
      </>
    );
  }
  if (request?.changes) {
    if (request.changes.length === 0) {
      return <>{status === "SUCCESS" ? "Nenhuma alteração: o negócio já estava assim." : "A ação não foi executada."}</>;
    }
    return (
      <>
        <b>Negócio alterado:</b> {request.changes.map((c) => `${c.label}: ${c.from ?? "vazio"} → ${c.to ?? "vazio"}`).join(" · ")}
      </>
    );
  }
  if (request?.notified) {
    return (
      <>
        <b>{status === "SUCCESS" ? "Comentário adicionado" : "Comentário não adicionado"}:</b> {request.message} · avisados:{" "}
        {request.notified.join(", ") || "ninguém"}
      </>
    );
  }
  return <>A ação não foi executada.</>;
}

/** Path taken by a FLOW run: every step run, in order. */
function FlowPath({ run }: { run: Run }) {
  if (run.steps.length === 0) return <>Nenhum passo executado ainda.</>;
  return (
    <ol className="auto-run-path">
      {run.steps.map((step) => (
        <li key={step.id}>
          <b>{step.label}</b>
          <span className={`auto-status auto-status--${step.status.toLowerCase()}`}>{RUN_STATUS_LABELS[step.status]}</span>
          {step.stepType === "CONDITION" && step.branch && <>seguiu por <b>{BRANCHES[step.branch]}</b></>}
          {step.stepType === "WAIT" && step.request?.until && <>até {formatDateTime(step.request.until)}</>}
          {step.stepType === "ACTION" && step.status !== "SKIPPED" && (
            <div>
              {step.httpStatus && <>HTTP {step.httpStatus} · </>}
              <ActionDetail request={step.request} status={step.status} responseBody={step.responseBody} />
            </div>
          )}
          {step.error && <div className="auto-runs__error">{step.error}</div>}
        </li>
      ))}
    </ol>
  );
}

/** "Executa em …" of a pending run; a flow waiting in the middle also says which step comes next. */
function pendingDetail(run: Run) {
  const when = `executa em ${formatDateTime(run.runAt)}`;
  if (run.automation.actionType !== "FLOW" || !run.step) return when;
  return `${when} · próximo passo: ${stepLabel(run.step, run.step.actions[0])}`;
}

/** "Registros": execution log of the pipeline's rules, newest first. */
export function AutomationRunsTab({ pipelineId }: { pipelineId: string }) {
  const [runs, setRuns] = useState<Run[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const can = useCan();

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

  const act = async (run: Run, action: "retry" | "cancel") => {
    if (
      action === "cancel" &&
      !(await confirmDialog(`Cancelar a execução de "${run.automation.name}" em #${run.card.number}?`, {
        danger: true,
        confirmLabel: "Cancelar execução",
        cancelLabel: "Voltar",
      }))
    ) {
      return;
    }
    setActing(run.id);
    const res = await fetch("/api/crm/automation/runs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: run.id, action }),
    });
    setActing(null);
    // 409: it changed state meanwhile; the reload shows how it is now
    if (!res.ok && res.status !== 409) await alertDialog("Não foi possível alterar a execução.");
    await load();
  };

  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="auto-runs">
      <div className="auto-runs__toolbar">
        <Select
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
        </Select>
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
                  {run.status === "WAITING"
                    ? "aguarda a regra anterior terminar"
                    : run.status === "PENDING" && !run.error
                      ? pendingDetail(run)
                      : run.error ?? ""}
                  {run.attempts > 1 && ` (${run.attempts} tentativas)`}
                  {can("automation.edit") && (run.status === "FAILED" || run.status === "PENDING" || run.status === "WAITING") && (
                    <button
                      type="button"
                      className="btn-secondary auto-btn-sm auto-runs__action"
                      disabled={acting === run.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        act(run, run.status === "FAILED" ? "retry" : "cancel");
                      }}
                    >
                      {run.status === "FAILED" ? "Reexecutar" : "Cancelar"}
                    </button>
                  )}
                </td>
              </tr>
              {expanded === run.id && (
                <tr className="auto-runs__details">
                  <td colSpan={7}>
                    {run.automation.actionType === "FLOW" ? (
                      <FlowPath run={run} />
                    ) : (
                      <ActionDetail request={run.request} status={run.status} responseBody={run.responseBody} />
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

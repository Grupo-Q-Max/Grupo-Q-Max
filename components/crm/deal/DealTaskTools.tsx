"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, Play, Plus, Square, Trash2, X } from "lucide-react";
import { formatMinutes, parseMinutes, type DealDetails, type TeamMember } from "./types";
import { Avatar, Field, formatDateOnly } from "./ui";
import { useCan, useViewer } from "../CrmAccess";
import { alertDialog, confirmDialog } from "@/components/ui/Dialogs";

const jsonRequest = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

/** Runs the request and shows its API error; true when it worked. */
async function send(url: string, init: RequestInit) {
  const res = await fetch(url, init);
  if (!res.ok) await alertDialog((await res.json().catch(() => null))?.error ?? "Não foi possível salvar.");
  return res.ok;
}

/**
 * After a subtask is done: when every subtask of its parent is done and the parent is still open,
 * asks whether to close the parent too (moves it to the last column). True when it was closed.
 */
export async function offerParentDone(parentId: string | null | undefined) {
  if (!parentId) return false;
  const res = await fetch(`/api/crm/card?id=${parentId}`, { cache: "no-store" });
  if (!res.ok) return false;
  const parent: DealDetails = await res.json();
  const last = parent.pipeline.stages.at(-1)?.id;
  if (parent.status !== "OPEN" || !last || !parent.subtasks.length || parent.subtasks.some((s) => s.status !== "WON")) return false;
  if (!(await confirmDialog(`Todas as subtarefas de #${parent.number} "${parent.title}" foram concluídas. Concluir a tarefa principal também?`, { confirmLabel: "Concluir" }))) return false;
  return send("/api/crm/card", jsonRequest("PATCH", { id: parent.id, stageId: last }));
}

const elapsed = (startedAt: string | Date, now: number) => Math.max(0, Math.round((now - new Date(startedAt).getTime()) / 60_000));

/** "3d 4h", "5h20", "12min" */
const formatSpan = (minutes: number) => (minutes >= 1440 ? `${Math.floor(minutes / 1440)}d ${Math.floor((minutes % 1440) / 60)}h` : formatMinutes(minutes));

/**
 * "Tempo em cada coluna": total time the task spent in each column, from its STAGE_CHANGED history
 * (stored by column name). The current column counts until now while the task is open.
 */
export function StageTimes({ deal }: { deal: DealDetails }) {
  const [now] = useState(() => Date.now());
  const moves = deal.history.filter((h) => h.type === "STAGE_CHANGED").sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const current = deal.pipeline.stages.find((s) => s.id === deal.stageId)?.name ?? "";
  const totals = new Map<string, number>();
  const add = (stage: string, ms: number) => stage && totals.set(stage, (totals.get(stage) ?? 0) + Math.max(0, ms));
  let stage = moves[0]?.data?.from ?? current;
  let since = new Date(deal.createdAt).getTime();
  for (const move of moves) {
    const at = new Date(move.createdAt).getTime();
    add(stage, at - since);
    stage = move.data?.to ?? "";
    since = at;
  }
  if (deal.status === "OPEN") add(stage, now - since);
  if (!totals.size) return null;
  return (
    <Field label="Tempo em cada coluna">
      <ul className="deal-stage-times">
        {[...totals].map(([name, ms]) => (
          <li key={name} className={name === current && deal.status === "OPEN" ? "is-current" : ""}>
            <span>{name}</span>
            <b>{formatSpan(Math.round(ms / 60_000))}</b>
          </li>
        ))}
      </ul>
    </Field>
  );
}

/** Kanban card play/stop for the viewer's own timer; starting it stops the one running on another card. */
export function CardTimer({ cardId, running }: { cardId: string; running: { memberId: string | null; startedAt: string | Date }[] }) {
  const router = useRouter();
  const can = useCan();
  const { memberId } = useViewer();
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const mine = running.find((e) => e.memberId === memberId);

  useEffect(() => {
    if (!mine) return;
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, [!!mine]);

  if (!can("deal.edit")) return null;
  const toggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setBusy(true);
    const ok = await send("/api/crm/time", jsonRequest("POST", mine ? { action: "stop" } : { action: "start", cardId }));
    setBusy(false);
    if (ok) router.refresh();
  };
  return (
    <button
      type="button"
      className={`kanban-card__timer ${mine ? "is-running" : ""}`}
      disabled={busy}
      onClick={toggle}
      title={mine ? "Parar cronômetro" : "Iniciar cronômetro (para o que estiver rodando em outra tarefa)"}
      aria-label={mine ? "Parar cronômetro" : "Iniciar cronômetro"}
    >
      {mine ? <Square size={11} /> : <Play size={11} />}
      {mine && formatMinutes(elapsed(mine.startedAt, now))}
    </button>
  );
}

/** "Tempo gasto": timer (one running per person), time typed by hand and the entries, per member. */
export function TimeTracker({ deal, team, onReload }: { deal: DealDetails; team: TeamMember[]; onReload: () => void }) {
  const can = useCan();
  const { memberId, isAdmin } = useViewer();
  const [now, setNow] = useState(() => Date.now());
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const running = deal.timeEntries.filter((e) => !e.endedAt);
  const mine = running.find((e) => e.memberId === memberId);

  // Ticks the running timers shown on screen
  useEffect(() => {
    if (!running.length) return;
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, [running.length]);

  const act = async (body: Record<string, unknown>) => {
    setBusy(true);
    const ok = await send("/api/crm/time", jsonRequest("POST", { cardId: deal.id, ...body }));
    setBusy(false);
    if (ok) onReload();
    return ok;
  };

  const log = async () => {
    const minutes = parseMinutes(text);
    if (!minutes) return alertDialog("Use formatos como 1h30, 90 ou 1,5h.");
    if (await act({ action: "log", minutes })) setText("");
  };

  const remove = async (id: string) => {
    if (!(await confirmDialog("Excluir este registro de tempo?", { danger: true, confirmLabel: "Excluir" }))) return;
    if (await send(`/api/crm/time?id=${id}`, { method: "DELETE" })) onReload();
  };

  const name = (id: string | null) => team.find((m) => m.id === id)?.name ?? "Registro antigo";
  const finished = deal.timeEntries.filter((e) => e.endedAt);

  return (
    <Field label="Tempo gasto" aside={<span className="deal-field__hint">{formatMinutes(deal.spentMinutes ?? 0)}</span>}>
      {can("deal.edit") && (
        <div className="deal-timer">
          {mine ? (
            <button type="button" className="btn-secondary deal-timer__stop" disabled={busy} onClick={() => act({ action: "stop" })} data-shortcut="timer" title="Parar (T)">
              <Square size={13} /> Parar · {formatMinutes(elapsed(mine.startedAt, now))}
            </button>
          ) : (
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => act({ action: "start" })} data-shortcut="timer" title="Inicia o cronômetro (T) — para o que estiver rodando em outra tarefa">
              <Play size={13} /> Iniciar
            </button>
          )}
          <input
            className="deal-input deal-input--compact"
            placeholder="Ex: 1h30"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") log();
            }}
          />
          <button type="button" className="btn-secondary" disabled={busy || !text.trim()} onClick={log}>
            Registrar
          </button>
        </div>
      )}
      {running
        .filter((e) => e.memberId !== memberId)
        .map((e) => (
          <span key={e.id} className="deal-field__hint">
            {name(e.memberId)} está com o cronômetro ligado · {formatMinutes(elapsed(e.startedAt, now))}
          </span>
        ))}
      {finished.length > 0 && (
        <details className="deal-timer__entries">
          <summary>Registros ({finished.length})</summary>
          <ul>
            {finished.map((e) => (
              <li key={e.id}>
                <span>{name(e.memberId)}</span>
                <span>{formatDateOnly(e.endedAt!)}</span>
                <b>{formatMinutes(e.minutes)}</b>
                {(e.memberId === memberId || isAdmin) && (
                  <button type="button" className="deal-icon-btn deal-icon-btn--danger" title="Excluir registro" onClick={() => remove(e.id)}>
                    <Trash2 size={13} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </Field>
  );
}

/** Subtasks: child cards of the same board with their progress; a subtask shows its parent instead. */
export function Subtasks({
  deal,
  team,
  onReload,
  onOpenCard,
}: {
  deal: DealDetails;
  team: TeamMember[];
  onReload: () => void;
  onOpenCard: (card: { id: string; number: number }) => void;
}) {
  const can = useCan();
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  if (deal.parent) {
    return (
      <Field label="Subtarefa de">
        <div className="deal-chips">
          <span className="deal-chip">
            <a href={`/crm/deal/details/${deal.parent.number}`} onClick={(e) => (e.preventDefault(), onOpenCard(deal.parent!))}>
              #{deal.parent.number} {deal.parent.title}
            </a>
          </span>
        </div>
      </Field>
    );
  }
  if (deal.isTemplate) return null;

  const done = deal.subtasks.filter((s) => s.status === "WON").length;
  const total = deal.subtasks.length;

  const add = async () => {
    if (!title.trim()) return;
    setBusy(true);
    const ok = await send(
      "/api/crm/card",
      jsonRequest("POST", { title: title.trim(), stageId: deal.pipeline.stages[0].id, parentId: deal.id, responsibleId: deal.responsibleId })
    );
    setBusy(false);
    if (!ok) return;
    setTitle("");
    onReload();
  };

  const unlink = async (id: string) => {
    if (await send("/api/crm/card", jsonRequest("PATCH", { id, parentId: null }))) onReload();
  };

  return (
    <Field label="Subtarefas" aside={total > 0 && <span className="deal-field__hint">{done}/{total}</span>}>
      {total > 0 && (
        <>
          <div className="deal-progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
            <span style={{ width: `${(done / total) * 100}%` }} />
          </div>
          <ul className="deal-subtasks">
            {deal.subtasks.map((s) => (
              <li key={s.id} className={s.status === "WON" ? "is-done" : ""}>
                {s.status === "WON" ? <CheckCircle2 size={15} /> : <Circle size={15} />}
                <a href={`/crm/deal/details/${s.number}`} onClick={(e) => (e.preventDefault(), onOpenCard(s))}>
                  #{s.number} {s.title}
                </a>
                {s.closeDate && <span className="deal-field__hint">{formatDateOnly(s.closeDate)}</span>}
                <Avatar member={team.find((m) => m.id === s.responsibleId)} size={20} />
                {can("deal.edit") && (
                  <button type="button" className="deal-icon-btn" title="Desvincular (vira tarefa independente)" onClick={() => unlink(s.id)}>
                    <X size={13} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      {can("deal.create") && (
        <div className="deal-timer">
          <input
            className="deal-input deal-input--compact"
            placeholder="Nova subtarefa"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") add();
            }}
          />
          <button type="button" className="btn-secondary" disabled={busy || !title.trim()} onClick={add}>
            <Plus size={13} /> Adicionar
          </button>
        </div>
      )}
    </Field>
  );
}

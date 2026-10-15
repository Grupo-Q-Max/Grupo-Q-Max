"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Kanban as KanbanIcon, List, Plus, X } from "lucide-react";
import { Kanban, type KanbanColumnData } from "@/components/kanban";
import { DatePicker } from "@/components/ui/DatePicker";
import { Select } from "@/components/ui/Select";
import type { DueState } from "@/lib/crm-due";
import type { MyTaskItem } from "@/lib/crm-my-tasks";
import { useCan } from "./CrmAccess";
import { postDeal } from "./CrmButtons";

/** Item with due state and label computed on the server (avoids hydration drift around midnight) */
export type MyTaskRow = MyTaskItem & { id: string; state: DueState; dueText: string };
export type TaskPipeline = { id: string; name: string; firstStageId: string };

const STATE_LABELS: Record<DueState, string> = { overdue: "Atrasada", today: "Hoje", upcoming: "", none: "" };
const COLUMNS: { id: DueState; title: string }[] = [
  { id: "overdue", title: "Atrasadas" },
  { id: "today", title: "Hoje" },
  { id: "upcoming", title: "Próximas" },
  { id: "none", title: "Sem prazo" },
];

/** /crm/me body: list or due-date kanban of the member's open items, plus "Nova Tarefa" in a TASKS pipeline. */
export function CrmMyTasks({ items, pipelines, memberId }: { items: MyTaskRow[]; pipelines: TaskPipeline[]; memberId: string | null }) {
  const [view, setView] = useState<"list" | "kanban">("list");
  const columns = useMemo<KanbanColumnData<MyTaskRow>[]>(
    () => COLUMNS.map((c) => ({ ...c, items: items.filter((i) => i.state === c.id) })),
    [items]
  );

  return (
    <>
      <header className="crm-header">
        <h1 className="crm-header__title">Minhas tarefas</h1>
        <NewTaskButton pipelines={pipelines} memberId={memberId} />
      </header>
      <div className="crm-toolbar">
        <div className="crm-toolbar__views">
          <button className={`view-btn ${view === "list" ? "is-active" : ""}`} onClick={() => setView("list")}>
            <List size={16} /> Lista
          </button>
          <button className={`view-btn ${view === "kanban" ? "is-active" : ""}`} onClick={() => setView("kanban")}>
            <KanbanIcon size={16} /> Kanban
          </button>
        </div>
      </div>

      {view === "kanban" ? (
        <div className="crm-content">
          {/* Read-only: columns are due states, so there is nothing to drag into */}
          <Kanban<MyTaskRow>
            columns={columns}
            renderItem={(item) => (
              <Link href={`/crm/deal/details/${item.number}`} className={`kanban-card crm-my-tasks__card is-${item.state}`}>
                <span className="crm-badge">{item.label}</span>
                <h3 className="kanban-card__title">{item.title}</h3>
                <div className="kanban-card__company">{item.context}</div>
                {item.due && <div className="crm-my-tasks__due">{item.dueText}</div>}
              </Link>
            )}
          />
        </div>
      ) : (
        <div className="crm-list-view">
          {items.length === 0 ? (
            <p className="crm-my-tasks__empty">Nada pendente com você.</p>
          ) : (
            <table className="crm-table crm-my-tasks">
              <thead>
                <tr>
                  <th>Prazo</th>
                  <th>Tipo</th>
                  <th>Título</th>
                  <th>Onde</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.key} className={`is-${item.state}`}>
                    <td className="crm-my-tasks__due">
                      {item.dueText}
                      {STATE_LABELS[item.state] && <span className="crm-my-tasks__state">{STATE_LABELS[item.state]}</span>}
                    </td>
                    <td>
                      <span className="crm-badge">{item.label}</span>
                    </td>
                    <td>
                      <Link href={`/crm/deal/details/${item.number}`}>{item.title}</Link>
                    </td>
                    <td className="crm-my-tasks__context">{item.context}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </>
  );
}

/** Creates a task card assigned to the signed-in member in the first stage of a TASKS pipeline. */
function NewTaskButton({ pipelines, memberId }: { pipelines: TaskPipeline[]; memberId: string | null }) {
  const router = useRouter();
  const can = useCan();
  const [open, setOpen] = useState(false);
  const [pipelineId, setPipelineId] = useState(pipelines[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  if (!can("deal.create") || pipelines.length === 0) return null;

  const close = () => setOpen(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const stageId = pipelines.find((p) => p.id === pipelineId)?.firstStageId;
    if (!title.trim() || !stageId) return;
    setIsLoading(true);
    const res = await postDeal({ title, stageId, responsibleId: memberId, closeDate: deadline || null, comment: description });
    setIsLoading(false);
    if (!res?.ok) return;
    setOpen(false);
    setTitle("");
    setDeadline("");
    setDescription("");
    router.refresh();
  };

  return (
    <div className="crm-header__actions">
      <button className="btn-primary" onClick={() => setOpen(true)}>
        <Plus size={18} /> Nova Tarefa
      </button>
      {open &&
        createPortal(
          <div className="crm-modal-overlay" onClick={(e) => e.target === e.currentTarget && close()} onKeyDown={(e) => e.key === "Escape" && close()}>
            <div className="crm-modal" style={{ maxWidth: "500px" }}>
              <button className="crm-modal-close" onClick={close} aria-label="Fechar">
                <X size={20} />
              </button>
              <h2>Nova Tarefa</h2>
              <p>A tarefa fica com você e entra na primeira coluna do pipeline escolhido.</p>
              <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div className="crm-modal-group" style={{ marginBottom: 0 }}>
                  <label>Título da Tarefa *</label>
                  <input type="text" autoFocus required placeholder="Ex: Revisar contrato do cliente" value={title} onChange={(e) => setTitle(e.target.value)} disabled={isLoading} />
                </div>
                <div style={{ display: "flex", gap: "16px" }}>
                  <div className="crm-modal-group" style={{ flex: 1, marginBottom: 0 }}>
                    <label>Pipeline</label>
                    <Select value={pipelineId} onChange={(e) => setPipelineId(e.target.value)} disabled={isLoading} aria-label="Pipeline">
                      {pipelines.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="crm-modal-group" style={{ flex: 1, marginBottom: 0 }}>
                    <label>Prazo</label>
                    <DatePicker value={deadline} onChange={(e) => setDeadline(e.target.value)} disabled={isLoading} aria-label="Prazo" />
                  </div>
                </div>
                <div className="crm-modal-group" style={{ marginBottom: 0 }}>
                  <label>Descrição</label>
                  <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} disabled={isLoading} />
                </div>
                <div className="crm-modal-actions" style={{ marginTop: "16px" }}>
                  <button type="button" className="btn-secondary" onClick={close} disabled={isLoading}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn-primary" disabled={isLoading || !title.trim()}>
                    {isLoading ? "Criando..." : "Criar Tarefa"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

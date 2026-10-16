"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, Kanban as KanbanIcon, List, Plus, X } from "lucide-react";
import { Kanban, type KanbanColumnData } from "@/components/kanban";
import { DatePicker } from "@/components/ui/DatePicker";
import { Select } from "@/components/ui/Select";
import { todayKey, type DueState } from "@/lib/crm-due";
import { matches } from "@/lib/text-search";
import type { MyTaskItem } from "@/lib/crm-my-tasks";
import { useCan } from "./CrmAccess";
import { postDeal } from "./CrmButtons";
import { CrmCalendar } from "./CrmCalendar";
import { FilterField, FilterSearch, type FilterChip } from "./FilterSearch";

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

type MyFilters = { q: string; type: string; state: string; pipeline: string };
const NO_FILTERS: MyFilters = { q: "", type: "", state: "", pipeline: "" };
const TYPES: Record<string, string> = { task: "Tarefas", deal: "Negócios", activity: "Atividades de negócios" };
const STATES: Record<string, string> = { overdue: "Atrasadas", today: "Vencem hoje", upcoming: "Próximas", none: "Sem prazo" };
const typeOf = (item: MyTaskRow) => (item.kind === "activity" ? "activity" : item.label === "Tarefa" ? "task" : "deal");

/** /crm/me body: list, due-date kanban or calendar of the member's open items, plus "Nova Tarefa" in a TASKS pipeline. */
export function CrmMyTasks({ items: allItems, pipelines, memberId }: { items: MyTaskRow[]; pipelines: TaskPipeline[]; memberId: string | null }) {
  const [view, setView] = useState<"list" | "kanban" | "calendar">("list");
  const [filters, setFilters] = useState(NO_FILTERS);
  const set = (changes: Partial<MyFilters>) => setFilters((f) => ({ ...f, ...changes }));
  const items = useMemo(
    () =>
      allItems.filter(
        (i) =>
          matches(filters.q, i.title, i.context, `#${i.number}`) &&
          (!filters.type || typeOf(i) === filters.type) &&
          (!filters.state || i.state === filters.state) &&
          (!filters.pipeline || i.pipeline === filters.pipeline)
      ),
    [allItems, filters]
  );
  const pipelineNames = [...new Set(allItems.map((i) => i.pipeline))].sort((a, b) => a.localeCompare(b));
  // Stable while nothing changes: the kanban resets its columns whenever this array changes
  const columns = useMemo<KanbanColumnData<MyTaskRow>[]>(
    () => COLUMNS.map((c) => ({ ...c, items: items.filter((i) => i.state === c.id) })),
    [items]
  );
  const chips: FilterChip[] = [
    filters.type && { key: "type", label: TYPES[filters.type], onRemove: () => set({ type: "" }) },
    filters.state && { key: "state", label: STATES[filters.state], onRemove: () => set({ state: "" }) },
    filters.pipeline && { key: "pipeline", label: filters.pipeline, onRemove: () => set({ pipeline: "" }) },
  ].filter((c): c is FilterChip => Boolean(c));
  const filtering = filters.q.trim() !== "" || chips.length > 0;

  return (
    <>
      <header className="crm-header">
        <h1 className="crm-header__title">Minhas tarefas</h1>
        <NewTaskButton pipelines={pipelines} memberId={memberId} />
      </header>
      <div className="crm-toolbar">
        <FilterSearch value={filters.q} onChange={(q) => set({ q })} placeholder="Buscar por título ou #nº" chips={chips} onClear={() => setFilters(NO_FILTERS)}>
          <FilterField label="Tipo">
            <Select className="crm-access__select" value={filters.type} onChange={(e) => set({ type: e.target.value })} aria-label="Tipo">
              <option value="">Todos</option>
              {Object.entries(TYPES).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label="Prazo">
            <Select className="crm-access__select" value={filters.state} onChange={(e) => set({ state: e.target.value })} aria-label="Prazo">
              <option value="">Todos</option>
              {Object.entries(STATES).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label="Pipeline">
            <Select className="crm-access__select" value={filters.pipeline} onChange={(e) => set({ pipeline: e.target.value })} aria-label="Pipeline">
              <option value="">Todos</option>
              {pipelineNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </Select>
          </FilterField>
        </FilterSearch>
        <div className="crm-toolbar__views">
          <button className={`view-btn ${view === "list" ? "is-active" : ""}`} onClick={() => setView("list")}>
            <List size={16} /> Lista
          </button>
          <button className={`view-btn ${view === "kanban" ? "is-active" : ""}`} onClick={() => setView("kanban")}>
            <KanbanIcon size={16} /> Kanban
          </button>
          <button className={`view-btn ${view === "calendar" ? "is-active" : ""}`} onClick={() => setView("calendar")}>
            <CalendarDays size={16} /> Calendário
          </button>
        </div>
      </div>

      {view === "calendar" ? (
        <div className="crm-content">
          <CrmCalendar
            undated={items.filter((i) => !i.due).length}
            items={items.flatMap((item) =>
              item.due
                ? [
                    {
                      key: item.key,
                      day: item.dateOnly ? item.due.slice(0, 10) : todayKey(new Date(item.due)),
                      title: item.title,
                      label: item.kind === "activity" ? item.label : undefined,
                      tone: item.state === "overdue" ? ("overdue" as const) : undefined,
                      href: `/crm/deal/details/${item.number}`,
                    },
                  ]
                : []
            )}
          />
        </div>
      ) : view === "kanban" ? (
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
            <p className="crm-my-tasks__empty">{filtering ? "Nada corresponde aos filtros." : "Nada pendente com você."}</p>
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

  const blocked = !can("deal.create")
    ? "Seu grupo não tem permissão para criar tarefas."
    : pipelines.length === 0
      ? "Crie um pipeline do tipo Tarefas para criar tarefas aqui."
      : null;
  if (blocked) {
    return (
      <div className="crm-header__actions crm-my-tasks__blocked">
        <span className="crm-my-tasks__hint">{blocked}</span>
        <button className="btn-primary" disabled title={blocked}>
          <Plus size={18} /> Nova Tarefa
        </button>
      </div>
    );
  }

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

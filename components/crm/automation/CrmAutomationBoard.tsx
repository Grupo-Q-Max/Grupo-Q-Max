"use client";

import { useCallback, useId, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCorners,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useBoardSensors, vibrateOnTouchDrag } from "@/components/kanban/sensors";
import { useCan } from "@/components/crm/CrmAccess";
import { ArrowLeft, Bell, ChevronDown, ListTodo, Pencil, PencilLine, Plus, Search, Webhook, Workflow, X, Zap } from "lucide-react";
import {
  ACTION_TYPES,
  ACTIVITY_TYPES,
  DEAL_STATUSES,
  TRIGGER_TYPES,
  WATCHABLE_FIELDS,
  describeTiming,
  type ActionType,
} from "@/lib/crm-automation-shared";
import { AutomationRuleModal, type RuleDraft } from "./AutomationRuleModal";
import { TriggerModal, type TriggerDraft } from "./TriggerModal";
import { AutomationRunsTab } from "./AutomationRunsTab";
import {
  stageColor,
  textOn,
  type AutomationRule,
  type AutomationStage,
  type AutomationTrigger,
  type CustomField,
  type Member,
} from "./types";
import { Select } from "@/components/ui/Select";
import { confirmDialog } from "@/components/ui/Dialogs";

type Kind = "rule" | "trigger";
type Editing =
  | { kind: "rule"; stageId: string; item: AutomationRule | null; actionType: ActionType }
  | { kind: "trigger"; stageId: string; item: AutomationTrigger | null }
  | null;

const listKey = (kind: Kind) => (kind === "rule" ? "automations" : "triggers");
const containerId = (kind: Kind, stageId: string) => `${kind}s:${stageId}`;
const itemId = (kind: Kind, id: string) => `${kind}:${id}`;
const parseDndId = (value: string) => {
  const [prefix, id] = value.split(":");
  if (prefix === "rules" || prefix === "triggers") return { kind: prefix.slice(0, -1) as Kind, stageId: id, itemId: null };
  return { kind: prefix as Kind, stageId: null, itemId: id };
};

const urlHost = (url?: string) => {
  try {
    return url ? new URL(url.replace(/\{\{[^}]*\}\}/g, "x")).host : "";
  } catch {
    return url ?? "";
  }
};

/** Summary of an UPDATE_DEAL rule: "→ Etapa · Ganho · resp.: Fulano · 2 campos". */
function dealUpdateSummary(rule: AutomationRule, stages: AutomationStage[], members: Member[]) {
  const update = rule.dealUpdate;
  if (!update) return "";
  const fields = Object.keys(update.customData ?? {}).length;
  return [
    update.stageId && `→ ${stages.find((s) => s.id === update.stageId)?.name ?? "etapa removida"}`,
    update.status && DEAL_STATUSES[update.status],
    update.responsibleId && `resp.: ${members.find((m) => m.id === update.responsibleId)?.name ?? "membro removido"}`,
    fields > 0 && `${fields} ${fields === 1 ? "campo" : "campos"}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** "para: ..." line of a rule card (who receives the action, like Bitrix24). */
function ruleDetail(rule: AutomationRule, stages: AutomationStage[], members: Member[]) {
  if (rule.actionType === "FLOW") {
    const count = rule.steps.length;
    return <span className="auto-card__target">{count} {count === 1 ? "passo" : "passos"}</span>;
  }
  if (rule.actionType === "UPDATE_DEAL") {
    return <span className="auto-card__target">{dealUpdateSummary(rule, stages, members) || "nenhuma alteração"}</span>;
  }
  if (rule.actionType === "NOTIFY" && rule.notify) {
    const { notify } = rule;
    const targets = [
      notify.notifyResponsible && "responsável do negócio",
      ...(notify.memberIds ?? []).map((id) => members.find((m) => m.id === id)?.name ?? "membro removido"),
    ].filter(Boolean);
    return (
      <>
        Comentário · para: <span className="auto-card__target">{targets.join(", ") || "ninguém"}</span>
      </>
    );
  }
  if (rule.actionType === "CREATE_ACTIVITY" && rule.activity) {
    const { activity } = rule;
    const target =
      activity.assignee === "MEMBER"
        ? members.find((m) => m.id === activity.responsibleId)?.name ?? "membro removido"
        : "responsável do negócio";
    return (
      <>
        {ACTIVITY_TYPES[activity.type] ?? "Atividade"} · para: <span className="auto-card__target">{target}</span>
      </>
    );
  }
  return (
    <>
      para: <span className="auto-card__target">{rule.webhookMethod} {urlHost(rule.webhookUrl ?? undefined) || "sem URL"}</span>
    </>
  );
}

const RULE_ACTIONS: { type: ActionType; icon: ReactNode }[] = [
  { type: "WEBHOOK", icon: <Webhook size={14} /> },
  { type: "CREATE_ACTIVITY", icon: <ListTodo size={14} /> },
  { type: "UPDATE_DEAL", icon: <PencilLine size={14} /> },
  { type: "NOTIFY", icon: <Bell size={14} /> },
  { type: "FLOW", icon: <Workflow size={14} /> },
];

function triggerDetail(trigger: AutomationTrigger) {
  const { watchedField, activityType } = trigger;
  if (trigger.type === "FIELD_CHANGED") return watchedField ? `campo: ${WATCHABLE_FIELDS[watchedField] ?? watchedField}` : "qualquer campo";
  if (trigger.type === "ACTIVITY_COMPLETED") return activityType ? ACTIVITY_TYPES[activityType] : "qualquer atividade";
  if (trigger.type === "WEBHOOK_IN") return "chamada externa";
  return "ao criar";
}

export function CrmAutomationBoard({
  pipeline,
  pipelines,
  initialStages,
  customFields,
  members,
}: {
  pipeline: { id: string; name: string };
  pipelines: { id: string; name: string }[];
  initialStages: AutomationStage[];
  customFields: CustomField[];
  members: Member[];
}) {
  const router = useRouter();
  const dndId = useId();
  const [stages, setStages] = useState(initialStages);
  const [tab, setTab] = useState<"rules" | "runs">("rules");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Editing>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const sensors = useBoardSensors();
  const can = useCan();
  const canCreateRule = can("automation.create");
  const canCreateTrigger = can("trigger.create");
  const canEditRule = can("automation.edit");
  const canEditTrigger = can("trigger.edit");

  const reload = useCallback(async () => {
    const res = await fetch(`/api/crm/automation?pipelineId=${pipeline.id}`, { cache: "no-store" });
    if (res.ok) setStages(await res.json());
  }, [pipeline.id]);

  const query = search.trim().toLowerCase();
  const visible = useMemo(() => {
    if (!query) return stages;
    const match = (...texts: (string | undefined)[]) => texts.some((t) => t?.toLowerCase().includes(query));
    return stages.map((s) => ({
      ...s,
      automations: s.automations.filter((a) =>
        match(a.name, a.webhookUrl ?? undefined, a.activity?.title, a.notify?.message, dealUpdateSummary(a, stages, members))
      ),
      triggers: s.triggers.filter((t) => match(t.name, TRIGGER_TYPES[t.type]?.label)),
    }));
  }, [stages, query, members]);

  // ---- persistence --------------------------------------------------------

  const saveRule = async (draft: RuleDraft, rule: AutomationRule | null) => {
    const res = await fetch("/api/crm/automation", {
      method: rule ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...(rule && { id: rule.id }), ...draft }),
    });
    if (!res.ok) return false;
    // Moving a rule to another stage from the dialog puts it at the end of that stage
    if (rule && draft.stageId !== rule.stageId) {
      const target = stages.find((s) => s.id === draft.stageId);
      await persistOrder("rule", [{ id: rule.id, stageId: draft.stageId, order: target?.automations.length ?? 0 }]);
    }
    await reload();
    return true;
  };

  const saveTrigger = async (draft: TriggerDraft, trigger: AutomationTrigger | null) => {
    const res = await fetch("/api/crm/trigger", {
      method: trigger ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...(trigger && { id: trigger.id }), ...draft }),
    });
    if (!res.ok) return false;
    if (trigger && draft.stageId !== trigger.stageId) {
      const target = stages.find((s) => s.id === draft.stageId);
      await persistOrder("trigger", [{ id: trigger.id, stageId: draft.stageId, order: target?.triggers.length ?? 0 }]);
    }
    await reload();
    return true;
  };

  const remove = async (kind: Kind, id: string, name: string) => {
    if (!(await confirmDialog(`Excluir ${kind === "rule" ? "a regra" : "o gatilho"} "${name}"?`, { danger: true, confirmLabel: "Excluir" }))) return;
    await fetch(`/api/crm/${kind === "rule" ? "automation" : "trigger"}?id=${id}`, { method: "DELETE" });
    await reload();
  };

  const rename = async (kind: Kind, id: string, name: string) => {
    await fetch(`/api/crm/${kind === "rule" ? "automation" : "trigger"}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name }),
    });
    await reload();
  };

  const persistOrder = (kind: Kind, items: { id: string; stageId: string; order: number }[]) =>
    fetch(`/api/crm/${kind === "rule" ? "automation" : "trigger"}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });

  // ---- drag and drop (reorder within a stage or move to another stage) ----

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || query) return;
    const from = parseDndId(String(active.id));
    const to = parseDndId(String(over.id));
    if (from.kind !== to.kind || !from.itemId) return;
    const kind = from.kind;
    if (!(kind === "rule" ? canEditRule : canEditTrigger)) return;
    const key = listKey(kind);

    type Item = { id: string; stageId: string };
    const list = (stageId: string) => stages.find((s) => s.id === stageId)![key] as Item[];
    const sourceStage = stages.find((s) => (s[key] as Item[]).some((i) => i.id === from.itemId));
    const targetStageId = to.stageId ?? stages.find((s) => (s[key] as Item[]).some((i) => i.id === to.itemId))?.id;
    if (!sourceStage || !targetStageId) return;

    const source = list(sourceStage.id);
    const oldIndex = source.findIndex((i) => i.id === from.itemId);
    let next: Record<string, Item[]>;

    if (sourceStage.id === targetStageId) {
      const newIndex = to.itemId ? source.findIndex((i) => i.id === to.itemId) : source.length - 1;
      if (oldIndex === newIndex) return;
      next = { [targetStageId]: arrayMove(source, oldIndex, newIndex) };
    } else {
      const target = [...list(targetStageId)];
      const overIndex = to.itemId ? target.findIndex((i) => i.id === to.itemId) : target.length;
      target.splice(overIndex < 0 ? target.length : overIndex, 0, { ...source[oldIndex], stageId: targetStageId });
      next = { [sourceStage.id]: source.filter((_, i) => i !== oldIndex), [targetStageId]: target };
    }

    setStages((prev) => prev.map((s) => (next[s.id] ? { ...s, [key]: next[s.id].map((i, order) => ({ ...i, order })) } : s)));
    const items = Object.entries(next).flatMap(([stageId, list]) => list.map((i, order) => ({ id: i.id, stageId, order })));
    persistOrder(kind, items).then((res) => {
      if (!res.ok) reload();
    });
  };

  // ---- render ---------------------------------------------------------------

  const columns = { gridTemplateColumns: `repeat(${stages.length}, minmax(220px, 1fr))` };

  return (
    <>
      <header className="crm-header auto-header">
        <div className="auto-header__title">
          <Link href={`/crm?pipelineId=${pipeline.id}`} className="auto-back" title="Voltar ao Kanban">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="crm-header__title">Regras de automação e gatilhos</h1>
          {(canCreateRule || canCreateTrigger) && (
            <div className="auto-create">
              <button type="button" className="btn-primary" onClick={() => setCreateOpen(!createOpen)}>
                <Plus size={16} /> Criar <ChevronDown size={14} />
              </button>
              {createOpen && (
                <div className="auto-menu" onMouseLeave={() => setCreateOpen(false)}>
                  {canCreateRule && RULE_ACTIONS.map(({ type, icon }) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        setCreateOpen(false);
                        setEditing({ kind: "rule", stageId: stages[0]?.id, item: null, actionType: type });
                      }}
                    >
                      {icon} Regra: {ACTION_TYPES[type].label}
                    </button>
                  ))}
                  {canCreateTrigger && (
                    <button
                      type="button"
                      onClick={() => {
                        setCreateOpen(false);
                        setEditing({ kind: "trigger", stageId: stages[0]?.id, item: null });
                      }}
                    >
                      <Zap size={14} /> Gatilho
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
          <Select
            className="auto-pipeline"
            value={pipeline.id}
            onChange={(e) => router.push(`/crm/automation/${e.target.value}`)}
          >
            {pipelines.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="crm-toolbar__search">
          <Search size={16} />
          <input value={search} placeholder="Buscar regras e gatilhos" onChange={(e) => setSearch(e.target.value)} />
          {search && (
            <button type="button" className="auto-icon-btn" onClick={() => setSearch("")} aria-label="Limpar busca">
              <X size={14} />
            </button>
          )}
        </div>
      </header>

      <nav className="auto-tabs">
        <button type="button" className={`view-btn ${tab === "rules" ? "is-active" : ""}`} onClick={() => setTab("rules")}>
          Regras de automação
        </button>
        <button type="button" className={`view-btn ${tab === "runs" ? "is-active" : ""}`} onClick={() => setTab("runs")}>
          Registros
        </button>
      </nav>

      <div className="crm-content auto-content">
        {tab === "runs" ? (
          <AutomationRunsTab pipelineId={pipeline.id} />
        ) : (
          <DndContext id={dndId} sensors={canEditRule || canEditTrigger ? sensors : []} collisionDetection={closestCorners} onDragStart={vibrateOnTouchDrag} onDragEnd={handleDragEnd}>
            <div className="auto-board">
              <div className="auto-grid" style={columns}>
                {stages.map((stage, index) => {
                  const color = stageColor(index);
                  return (
                    <div key={stage.id} className="auto-stage" style={{ background: color, color: textOn(color) }} title={stage.name}>
                      <span>{stage.name}</span>
                    </div>
                  );
                })}
              </div>

              <Section title="Gatilhos" hint="Eventos que movem o negócio para a etapa">
                <div className="auto-grid" style={columns}>
                  {visible.map((stage) => (
                    <Column
                      key={stage.id}
                      id={containerId("trigger", stage.id)}
                      items={stage.triggers.map((t) => itemId("trigger", t.id))}
                      onAdd={canCreateTrigger ? () => setEditing({ kind: "trigger", stageId: stage.id, item: null }) : undefined}
                      addLabel="Adicionar gatilho"
                    >
                      {stage.triggers.map((trigger) => (
                        <SortableCard key={trigger.id} id={itemId("trigger", trigger.id)}>
                          <ItemCard
                            className="auto-card--trigger"
                            active={trigger.active}
                            top={<span className="auto-card__type"><Zap size={12} /> {TRIGGER_TYPES[trigger.type]?.label}</span>}
                            name={trigger.name}
                            detail={triggerDetail(trigger)}
                            conditions={trigger.conditions.length}
                            onEdit={canEditTrigger ? () => setEditing({ kind: "trigger", stageId: stage.id, item: trigger }) : undefined}
                            onRename={canEditTrigger ? (name) => rename("trigger", trigger.id, name) : undefined}
                            onDelete={can("trigger.delete") ? () => remove("trigger", trigger.id, trigger.name) : undefined}
                          />
                        </SortableCard>
                      ))}
                    </Column>
                  ))}
                </div>
              </Section>

              <Section title="Regras de automação" hint="Executadas quando o negócio entra na etapa">
                <div className="auto-grid" style={columns}>
                  {visible.map((stage) => (
                    <Column
                      key={stage.id}
                      id={containerId("rule", stage.id)}
                      items={stage.automations.map((a) => itemId("rule", a.id))}
                      addLabel="Adicionar regra"
                      addOptions={canCreateRule ? RULE_ACTIONS.map(({ type, icon }) => ({
                        label: ACTION_TYPES[type].label,
                        icon,
                        onClick: () => setEditing({ kind: "rule", stageId: stage.id, item: null, actionType: type }),
                      })) : undefined}
                    >
                      {stage.automations.map((rule) => (
                        <SortableCard key={rule.id} id={itemId("rule", rule.id)}>
                          <ItemCard
                            active={rule.active}
                            top={
                              <button
                                type="button"
                                className="auto-card__delay"
                                disabled={!canEditRule}
                                onClick={() => setEditing({ kind: "rule", stageId: stage.id, item: rule, actionType: rule.actionType })}
                              >
                                {describeTiming(rule.execution, rule.delayAmount, rule.delayUnit)}
                              </button>
                            }
                            name={rule.name}
                            detail={ruleDetail(rule, stages, members)}
                            conditions={rule.conditions.length}
                            onEdit={canEditRule ? () => setEditing({ kind: "rule", stageId: stage.id, item: rule, actionType: rule.actionType }) : undefined}
                            onRename={canEditRule ? (name) => rename("rule", rule.id, name) : undefined}
                            onDelete={can("automation.delete") ? () => remove("rule", rule.id, rule.name) : undefined}
                          />
                        </SortableCard>
                      ))}
                    </Column>
                  ))}
                </div>
              </Section>
            </div>
          </DndContext>
        )}
      </div>

      {editing?.kind === "rule" && (
        <AutomationRuleModal
          rule={editing.item}
          actionType={editing.actionType}
          stageId={editing.stageId}
          stages={stages}
          customFields={customFields}
          members={members}
          onClose={() => setEditing(null)}
          onSave={(draft) => saveRule(draft, editing.item)}
        />
      )}
      {editing?.kind === "trigger" && (
        <TriggerModal
          trigger={editing.item}
          stageId={editing.stageId}
          stages={stages}
          customFields={customFields}
          onClose={() => setEditing(null)}
          onSave={(draft) => saveTrigger(draft, editing.item)}
        />
      )}
    </>
  );
}

function Section({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <section className="auto-section">
      <h3 className="auto-section__title" title={hint}>
        {title}
      </h3>
      {children}
    </section>
  );
}

function Column({
  id,
  items,
  onAdd,
  addLabel,
  addOptions,
  children,
}: {
  id: string;
  items: string[];
  onAdd?: () => void;
  addLabel: string;
  /** When set, "+" opens a menu with these choices instead of calling onAdd */
  addOptions?: { label: string; icon: ReactNode; onClick: () => void }[];
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <SortableContext id={id} items={items} strategy={verticalListSortingStrategy}>
      <div ref={setNodeRef} className={`auto-column ${isOver ? "is-over" : ""}`}>
        {children}
        {(onAdd || addOptions) && (
          <div className="auto-create">
            <button
              type="button"
              className="auto-add"
              onClick={() => (addOptions ? setMenuOpen(!menuOpen) : onAdd?.())}
              title={addLabel}
            >
              <Plus size={16} />
            </button>
            {addOptions && menuOpen && (
              <div className="auto-menu" onMouseLeave={() => setMenuOpen(false)}>
                {addOptions.map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      option.onClick();
                    }}
                  >
                    {option.icon} {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </SortableContext>
  );
}

function SortableCard({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
}

function ItemCard({
  className = "",
  active,
  top,
  name,
  detail,
  conditions,
  onEdit,
  onRename,
  onDelete,
}: {
  className?: string;
  active: boolean;
  top: ReactNode;
  name: string;
  detail: ReactNode;
  conditions: number;
  /** Each action is hidden when omitted (no permission) */
  onEdit?: () => void;
  onRename?: (name: string) => void;
  onDelete?: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [value, setValue] = useState(name);

  const commit = () => {
    setRenaming(false);
    if (value.trim() && value.trim() !== name) onRename?.(value.trim());
    else setValue(name);
  };

  return (
    <div className={`auto-card ${className} ${active ? "" : "is-paused"}`}>
      <div className="auto-card__top">
        {top}
        {onDelete && (
          <button type="button" className="auto-icon-btn" title="Excluir" onClick={onDelete}>
            <X size={14} />
          </button>
        )}
      </div>
      {renaming ? (
        <input
          className="auto-card__rename"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setValue(name);
              setRenaming(false);
            }
          }}
          onPointerDown={(e) => e.stopPropagation()}
        />
      ) : (
        <div className="auto-card__name">
          <span>{name}</span>
          {onRename && (
            <button type="button" className="auto-icon-btn" title="Renomear" onClick={() => setRenaming(true)}>
              <Pencil size={12} />
            </button>
          )}
        </div>
      )}
      <div className="auto-card__detail">{detail}</div>
      <div className="auto-card__footer">
        <span>
          {!active && <span className="auto-tag">pausada</span>}
          {conditions > 0 && <span className="auto-tag">{conditions} condição(ões)</span>}
        </span>
        {onEdit && (
          <button type="button" className="auto-link-btn" onClick={onEdit}>
            alterar
          </button>
        )}
      </div>
    </div>
  );
}

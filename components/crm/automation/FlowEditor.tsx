"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, GitBranch, Hourglass, Plus, X, Zap } from "lucide-react";
import {
  ACTION_TYPES,
  BRANCHES,
  DELAY_UNITS,
  FLOW_LIMITS,
  OPERATORS,
  countSteps,
  stepLabel,
  type AutomationCondition,
  type Branch,
  type DelayUnit,
  type StepActionType,
  type StepType,
} from "@/lib/crm-automation-shared";
import { ModalRow } from "./AutomationModal";
import { ActionFields, actionDraft, actionValidationError, type ActionDraft } from "./ActionFields";
import { ConditionsEditor, conditionFields } from "./ConditionsEditor";
import type { AutomationStage, AutomationStepRow, CustomField, Member } from "./types";

/** A flow step as edited in the dialog; sent as is to the API (`key` is only for React). */
export type FlowStepDraft = {
  key: string;
  type: StepType;
  waitAmount: number;
  waitUnit: DelayUnit;
  conditions: AutomationCondition[];
  action: (ActionDraft & { actionType: StepActionType; name: string }) | null;
  then: FlowStepDraft[];
  else: FlowStepDraft[];
};

const STEP_ACTIONS: StepActionType[] = ["CREATE_ACTIVITY", "UPDATE_DEAL", "NOTIFY", "WEBHOOK"];

let lastKey = 0;
/** Keys of steps added in the dialog start with "new-" (saved steps use their id) */
const newKey = () => `new-${++lastKey}`;

/** Saved flat rows → tree edited in the dialog. */
export function flowDraft(rows: AutomationStepRow[], parentId: string | null = null, branch: Branch | null = null): FlowStepDraft[] {
  return rows
    .filter((r) => r.parentId === parentId && r.branch === branch)
    .sort((a, b) => a.order - b.order)
    .map((r) => {
      const action = r.actions[0];
      return {
        key: r.id,
        type: r.type,
        waitAmount: r.waitAmount ?? 1,
        waitUnit: r.waitUnit ?? "MINUTES",
        conditions: r.conditions.map(({ field, operator, value }) => ({ field, operator, value })),
        action: action ? { ...actionDraft(action), actionType: action.actionType, name: action.name } : null,
        then: flowDraft(rows, r.id, "THEN"),
        else: flowDraft(rows, r.id, "ELSE"),
      };
    });
}

function newStep(choice: string): FlowStepDraft {
  const base = { key: newKey(), waitAmount: 1, waitUnit: "MINUTES" as DelayUnit, conditions: [], action: null, then: [], else: [] };
  if (choice === "WAIT" || choice === "CONDITION") return { ...base, type: choice };
  const actionType = choice as StepActionType;
  return { ...base, type: "ACTION", action: { ...actionDraft(null), actionType, name: ACTION_TYPES[actionType].label } };
}

/** First problem of the flow, or "". */
export function flowValidationError(steps: FlowStepDraft[], stageId: string): string {
  if (steps.length === 0) return "Adicione ao menos um passo ao fluxo";
  if (countSteps(steps) > FLOW_LIMITS.maxSteps) return `No máximo ${FLOW_LIMITS.maxSteps} passos por fluxo`;
  const walk = (list: FlowStepDraft[]): string => {
    for (const step of list) {
      if (step.action) {
        const error = actionValidationError(step.action.actionType, step.action, stageId);
        if (error) return `${stepLabel(step, step.action)}: ${error}`;
      }
      if (step.type === "CONDITION") {
        if (step.conditions.length === 0) return "Defina o critério de cada condição";
        const error = walk(step.then) || walk(step.else);
        if (error) return error;
      }
    }
    return "";
  };
  return walk(steps);
}

type Context = {
  stageId: string;
  stages: AutomationStage[];
  customFields: CustomField[];
  members: Member[];
  total: number;
};

/** Editor of the steps of a FLOW rule: a vertical list, with the branches of a condition indented (like Bitrix24). */
export function FlowEditor({
  steps,
  onChange,
  ...context
}: Omit<Context, "total"> & { steps: FlowStepDraft[]; onChange: (steps: FlowStepDraft[]) => void }) {
  return (
    <div className="auto-flow">
      <StepList steps={steps} onChange={onChange} depth={0} context={{ ...context, total: countSteps(steps) }} />
    </div>
  );
}

function StepList({
  steps,
  onChange,
  depth,
  context,
}: {
  steps: FlowStepDraft[];
  onChange: (steps: FlowStepDraft[]) => void;
  /** Number of conditions this list is inside */
  depth: number;
  context: Context;
}) {
  const move = (index: number, by: number) => {
    const next = [...steps];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    onChange(next);
  };
  const full = context.total >= FLOW_LIMITS.maxSteps;

  return (
    <div className="auto-flow__list">
      {steps.map((step, index) => (
        <StepCard
          key={step.key}
          step={step}
          number={index + 1}
          first={index === 0}
          last={index === steps.length - 1}
          depth={depth}
          context={context}
          onChange={(changed) => onChange(steps.map((s, i) => (i === index ? changed : s)))}
          onRemove={() => onChange(steps.filter((_, i) => i !== index))}
          onMove={(by) => move(index, by)}
        />
      ))}
      <label className={`auto-flow__add${full ? " is-disabled" : ""}`}>
        <Plus size={13} /> {full ? `Limite de ${FLOW_LIMITS.maxSteps} passos` : "Adicionar passo"}
        <select
          value=""
          disabled={full}
          aria-label="Adicionar passo"
          onChange={(e) => e.target.value && onChange([...steps, newStep(e.target.value)])}
        >
          <option value="">Adicionar passo…</option>
          <optgroup label="Ação">
            {STEP_ACTIONS.map((type) => (
              <option key={type} value={type}>
                {ACTION_TYPES[type].label}
              </option>
            ))}
          </optgroup>
          <optgroup label="Controle">
            <option value="WAIT">Esperar</option>
            {depth < FLOW_LIMITS.maxDepth && <option value="CONDITION">Condição (se/senão)</option>}
          </optgroup>
        </select>
      </label>
    </div>
  );
}

function StepCard({
  step,
  number,
  first,
  last,
  depth,
  context,
  onChange,
  onRemove,
  onMove,
}: {
  step: FlowStepDraft;
  number: number;
  first: boolean;
  last: boolean;
  depth: number;
  context: Context;
  onChange: (step: FlowStepDraft) => void;
  onRemove: () => void;
  onMove: (by: number) => void;
}) {
  // New actions/conditions open to be filled in; saved ones start collapsed
  const [open, setOpen] = useState(step.key.startsWith("new-"));
  const set = (patch: Partial<FlowStepDraft>) => onChange({ ...step, ...patch });
  const { action } = step;
  const Icon = step.type === "WAIT" ? Hourglass : step.type === "CONDITION" ? GitBranch : Zap;
  const nested = countSteps([step]) - 1;

  const fields = conditionFields(context.customFields);
  const summary =
    step.type === "CONDITION"
      ? step.conditions
          .map((c) => `${fields.find((f) => f.key === c.field)?.label ?? c.field} ${OPERATORS[c.operator].label} ${c.value ?? ""}`.trim())
          .join(" e ") || "sem critério"
      : "";

  return (
    <div className={`auto-flow__step auto-flow__step--${step.type.toLowerCase()}`}>
      <div className="auto-flow__head">
        {step.type === "WAIT" ? (
          <div className="auto-flow__title">
            <Icon size={14} />
            <span>{number}. Esperar</span>
            <input
              type="number"
              min={1}
              className="auto-input--short"
              aria-label="Tempo de espera"
              value={step.waitAmount}
              onChange={(e) => set({ waitAmount: Math.max(1, Math.round(Number(e.target.value) || 1)) })}
            />
            <select
              aria-label="Unidade"
              value={step.waitUnit}
              onChange={(e) => set({ waitUnit: e.target.value as DelayUnit })}
            >
              {Object.entries(DELAY_UNITS).map(([key, unit]) => (
                <option key={key} value={key}>
                  {unit.label}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <button type="button" className="auto-flow__title auto-flow__toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <Icon size={14} />
            <span>
              {number}. {step.type === "CONDITION" ? `Se ${summary}` : stepLabel(step, action)}
            </span>
          </button>
        )}
        <div className="auto-flow__tools">
          <button type="button" className="auto-icon-btn" title="Mover para cima" disabled={first} onClick={() => onMove(-1)}>
            <ArrowUp size={15} />
          </button>
          <button type="button" className="auto-icon-btn" title="Mover para baixo" disabled={last} onClick={() => onMove(1)}>
            <ArrowDown size={15} />
          </button>
          <button
            type="button"
            className="auto-icon-btn"
            title="Remover passo"
            onClick={() => {
              if (nested === 0 || window.confirm(`Remover a condição e os ${nested} passos dentro dela?`)) onRemove();
            }}
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {open && action && (
        <div className="auto-flow__body">
          <ModalRow label="Nome">
            <input value={action.name} onChange={(e) => set({ action: { ...action, name: e.target.value } })} />
          </ModalRow>
          <ActionFields
            action={action.actionType}
            draft={action}
            onChange={(patch) => set({ action: { ...action, ...patch } })}
            stageId={context.stageId}
            stages={context.stages}
            customFields={context.customFields}
            members={context.members}
          />
        </div>
      )}

      {step.type === "CONDITION" && (
        <>
          {open && (
            <div className="auto-flow__body">
              <ConditionsEditor
                value={step.conditions}
                customFields={context.customFields}
                onChange={(conditions) => set({ conditions })}
              />
            </div>
          )}
          {(["THEN", "ELSE"] as const).map((branch) => (
            <div key={branch} className={`auto-flow__branch auto-flow__branch--${branch.toLowerCase()}`}>
              <span className="auto-flow__branch-label">{BRANCHES[branch]}</span>
              <StepList
                steps={branch === "THEN" ? step.then : step.else}
                onChange={(list) => set(branch === "THEN" ? { then: list } : { else: list })}
                depth={depth + 1}
                context={context}
              />
            </div>
          ))}
        </>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import {
  ACTION_TYPES,
  DELAY_UNITS,
  EXECUTIONS,
  type ActionType,
  type AutomationCondition,
  type DelayUnit,
  type Execution,
} from "@/lib/crm-automation-shared";
import { AutomationModal, ModalRow } from "./AutomationModal";
import { ActionFields, actionDraft, actionValidationError, type ActionDraft } from "./ActionFields";
import { ConditionsEditor } from "./ConditionsEditor";
import { FlowEditor, flowDraft, flowValidationError, type FlowStepDraft } from "./FlowEditor";
import type { AutomationRule, AutomationStage, CustomField, Member } from "./types";
import { Select } from "@/components/ui/Select";

export type RuleDraft = ActionDraft & {
  actionType: ActionType;
  name: string;
  stageId: string;
  execution: Execution;
  delayAmount: number;
  delayUnit: DelayUnit;
  conditions: AutomationCondition[];
  active: boolean;
  /** Only for FLOW rules */
  steps: FlowStepDraft[];
};

function ruleDraft(rule: AutomationRule | null, stageId: string, actionType: ActionType): RuleDraft {
  return {
    ...actionDraft(rule),
    actionType: rule?.actionType ?? actionType,
    name: rule?.name ?? ACTION_TYPES[actionType].label,
    stageId: rule?.stageId ?? stageId,
    execution: rule?.execution ?? "PARALLEL",
    delayAmount: rule?.delayAmount ?? 0,
    delayUnit: rule?.delayUnit ?? "MINUTES",
    conditions: rule?.conditions.map(({ field, operator, value }) => ({ field, operator, value })) ?? [],
    active: rule?.active ?? true,
    steps: flowDraft(rule?.steps ?? []),
  };
}

export function AutomationRuleModal({
  rule,
  actionType,
  stageId,
  stages,
  customFields,
  members,
  onClose,
  onSave,
}: {
  rule: AutomationRule | null;
  /** Action of a new rule (an existing rule keeps its own) */
  actionType: ActionType;
  stageId: string;
  stages: AutomationStage[];
  customFields: CustomField[];
  members: Member[];
  onClose: () => void;
  onSave: (draft: RuleDraft) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState(() => ruleDraft(rule, stageId, actionType));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (patch: Partial<RuleDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setError("");
  };

  const action = draft.actionType;
  const flow = action === "FLOW";

  const save = async () => {
    const message = flow ? flowValidationError(draft.steps, draft.stageId) : actionValidationError(action, draft, draft.stageId);
    if (message) {
      setError(message);
      return;
    }
    setSaving(true);
    const ok = await onSave(draft);
    setSaving(false);
    if (ok) onClose();
    else setError("Não foi possível salvar a regra.");
  };

  const label = ACTION_TYPES[action].label;

  return (
    <AutomationModal
      title={rule ? label : `Nova regra: ${label}`}
      wide={flow}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="button" className="btn-primary" onClick={save} disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </>
      }
    >
      <ModalRow label="Nome">
        <input value={draft.name} onChange={(e) => set({ name: e.target.value })} />
      </ModalRow>

      <ModalRow label="Etapa">
        <Select value={draft.stageId} onChange={(e) => set({ stageId: e.target.value })}>
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </ModalRow>

      <ModalRow label="Execução">
        <Select value={draft.execution} onChange={(e) => set({ execution: e.target.value as Execution })}>
          {Object.entries(EXECUTIONS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </Select>
        {draft.execution === "SEQUENTIAL" && (
          <p className="auto-hint">Começa quando a regra anterior desta etapa terminar para o negócio; o horário conta a partir daí.</p>
        )}
      </ModalRow>

      <ModalRow label="Horário">
        <div className="auto-inline">
          <Select
            value={draft.delayAmount > 0 ? "AFTER" : "IMMEDIATE"}
            onChange={(e) =>
              set(e.target.value === "AFTER" ? { delayAmount: 1, delayUnit: "DAYS" } : { delayAmount: 0 })
            }
          >
            <option value="IMMEDIATE">Imediatamente</option>
            <option value="AFTER">Após um tempo</option>
          </Select>
          {draft.delayAmount > 0 && (
            <>
              <input
                type="number"
                min={1}
                className="auto-input--short"
                value={draft.delayAmount}
                onChange={(e) => set({ delayAmount: Math.max(1, Number(e.target.value) || 1) })}
              />
              <Select value={draft.delayUnit} onChange={(e) => set({ delayUnit: e.target.value as DelayUnit })}>
                {Object.entries(DELAY_UNITS).map(([key, unit]) => (
                  <option key={key} value={key}>
                    {unit.label}
                  </option>
                ))}
              </Select>
            </>
          )}
        </div>
      </ModalRow>

      <ModalRow label={flow ? "Iniciar se" : "Condição"}>
        <ConditionsEditor value={draft.conditions} customFields={customFields} onChange={(conditions) => set({ conditions })} />
      </ModalRow>

      {flow ? (
        <div className="auto-modal__section">
          <span className="auto-modal__label">Passos</span>
          <FlowEditor
            steps={draft.steps}
            onChange={(steps) => set({ steps })}
            stageId={draft.stageId}
            stages={stages}
            customFields={customFields}
            members={members}
          />
        </div>
      ) : (
        <ActionFields
          action={action}
          draft={draft}
          onChange={set}
          stageId={draft.stageId}
          stages={stages}
          customFields={customFields}
          members={members}
        />
      )}

      <ModalRow label="Ativa">
        <label className="auto-switch">
          <input type="checkbox" checked={draft.active} onChange={(e) => set({ active: e.target.checked })} />
          <span>{draft.active ? "Regra ativa" : "Regra pausada"}</span>
        </label>
      </ModalRow>

      {error && <p className="auto-error">{error}</p>}
    </AutomationModal>
  );
}

"use client";

import { useState } from "react";
import {
  ACTION_TYPES,
  ACTIVITY_TYPES,
  DELAY_UNITS,
  EXECUTIONS,
  OPERATORS,
  START_ON,
  WATCHABLE_FIELDS,
  type ActionType,
  type ActivityType,
  type StartOn,
  type AutomationCondition,
  type DelayUnit,
  type Execution,
} from "@/lib/crm-automation-shared";
import { AutomationModal, ModalRow } from "./AutomationModal";
import { ActionFields, actionDraft, actionValidationError, type ActionDraft } from "./ActionFields";
import { ConditionsEditor, conditionFields } from "./ConditionsEditor";
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
  startOn: StartOn;
  startField: string | null;
  startActivityType: ActivityType | null;
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
    startOn: rule?.startOn ?? "STAGE_ENTERED",
    startField: rule?.startField ?? null,
    startActivityType: rule?.startActivityType ?? null,
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
  preset,
  onClose,
  onSave,
}: {
  rule: AutomationRule | null;
  /** New rule from a template ("Modelos"): fields filled in advance */
  preset?: Partial<RuleDraft>;
  /** Action of a new rule (an existing rule keeps its own) */
  actionType: ActionType;
  stageId: string;
  stages: AutomationStage[];
  customFields: CustomField[];
  members: Member[];
  onClose: () => void;
  onSave: (draft: RuleDraft) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState(() => ({ ...ruleDraft(rule, stageId, actionType), ...preset }));
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

      <ModalRow label="Iniciar quando">
        <Select value={draft.startOn} onChange={(e) => set({ startOn: e.target.value as StartOn })}>
          {Object.entries(START_ON).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </Select>
        {draft.startOn === "FIELD_CHANGED" && (
          <Select value={draft.startField ?? ""} onChange={(e) => set({ startField: e.target.value || null })}>
            <option value="">Qualquer campo</option>
            {Object.entries(WATCHABLE_FIELDS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
        )}
        {draft.startOn === "ACTIVITY_COMPLETED" && (
          <Select
            value={draft.startActivityType ?? ""}
            onChange={(e) => set({ startActivityType: (e.target.value || null) as ActivityType | null })}
          >
            <option value="">Qualquer tipo</option>
            {Object.entries(ACTIVITY_TYPES).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
        )}
        {draft.startOn !== "STAGE_ENTERED" && (
          <div className="auto-hint">Roda sem mover o negócio, sempre que o evento acontece enquanto ele está nesta etapa.</div>
        )}
      </ModalRow>

      <ModalRow label="Execução">
        <Select
          value={draft.execution}
          disabled={draft.startOn !== "STAGE_ENTERED"}
          onChange={(e) => set({ execution: e.target.value as Execution })}
        >
          {Object.entries(EXECUTIONS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </Select>
        {draft.execution === "SEQUENTIAL" && draft.startOn === "STAGE_ENTERED" && (
          <div className="auto-hint">Começa quando a regra anterior desta etapa terminar para o negócio; o horário conta a partir daí.</div>
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

      {rule && <RuleTest ruleId={rule.id} customFields={customFields} />}

      {error && <div className="auto-error">{error}</div>}
    </AutomationModal>
  );
}

type TestResult = {
  matches: boolean;
  inStage: boolean;
  active: boolean;
  conditions: (AutomationCondition & { actual: string; ok: boolean })[];
  preview: string;
};

/** "Testar": runs nothing; shows, for a deal, which conditions match and what the saved rule would send or change. */
function RuleTest({ ruleId, customFields }: { ruleId: string; customFields: CustomField[] }) {
  const [cardNumber, setCardNumber] = useState("");
  const [result, setResult] = useState<TestResult | null>(null);
  const [error, setError] = useState("");
  const [testing, setTesting] = useState(false);
  const fieldLabel = (key: string) => conditionFields(customFields).find((f) => f.key === key)?.label ?? key;

  const test = async () => {
    setTesting(true);
    setError("");
    setResult(null);
    const res = await fetch("/api/crm/automation/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ automationId: ruleId, cardNumber: Number(cardNumber.replace("#", "")) }),
    });
    setTesting(false);
    if (res.ok) setResult(await res.json());
    else setError(res.status === 404 ? "Negócio não encontrado neste pipeline." : "Não foi possível testar a regra.");
  };

  return (
    <ModalRow label="Testar">
      <div className="auto-inline">
        <input
          className="auto-input--short"
          placeholder="nº do negócio"
          value={cardNumber}
          onChange={(e) => setCardNumber(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && cardNumber && test()}
        />
        <button type="button" className="btn-secondary auto-btn-sm" onClick={test} disabled={!cardNumber || testing}>
          {testing ? "Testando..." : "Testar"}
        </button>
      </div>
      {/* divs, not p: the site's global p font-size wins over the modal's */}
      <div className="auto-hint">Testa a versão salva da regra. Nada é executado nem enviado.</div>
      {error && <div className="auto-error">{error}</div>}
      {result && (
        <div className="auto-test">
          <div className="auto-test__verdict">
            <b>{result.matches ? "Executaria" : "Não executaria: condições não atendidas"}</b>
            {!result.active && " · a regra está pausada"}
            {!result.inStage && " · o negócio não está na etapa desta regra"}
          </div>
          {result.conditions.length > 0 && (
            <ul>
              {result.conditions.map((c, i) => (
                <li key={i} className={c.ok ? "auto-test__ok" : "auto-test__fail"}>
                  {c.ok ? "✓" : "✗"} {fieldLabel(c.field)} {OPERATORS[c.operator].label}
                  {OPERATORS[c.operator].needsValue && ` "${c.value ?? ""}"`} · valor atual: {c.actual || "vazio"}
                </li>
              ))}
            </ul>
          )}
          <pre>{result.preview}</pre>
        </div>
      )}
    </ModalRow>
  );
}

"use client";

import { Plus, X } from "lucide-react";
import {
  DEAL_FIELDS,
  OPERATORS,
  customFieldKey,
  type AutomationCondition,
  type ConditionOperator,
} from "@/lib/crm-automation-shared";
import type { CustomField } from "./types";
import { Select } from "@/components/ui/Select";

/** Deal fields offered in condition selects: the built-in ones plus the pipeline's custom fields. */
export function conditionFields(customFields: CustomField[]) {
  return [
    ...DEAL_FIELDS.filter((f) => f.key !== "id" && f.key !== "url"),
    ...customFields.map((f) => ({ key: customFieldKey(f.id), label: f.name })),
  ];
}

/** "Condição" block of the rule/trigger dialogs: every row must match (AND). */
export function ConditionsEditor({
  value,
  onChange,
  customFields,
}: {
  value: AutomationCondition[];
  onChange: (next: AutomationCondition[]) => void;
  customFields: CustomField[];
}) {
  const fields = conditionFields(customFields);
  const update = (index: number, patch: Partial<AutomationCondition>) =>
    onChange(value.map((c, i) => (i === index ? { ...c, ...patch } : c)));

  return (
    <div className="auto-conditions">
      {value.map((condition, index) => (
        <div key={index} className="auto-conditions__row">
          {index > 0 && <span className="auto-conditions__and">e</span>}
          <Select value={condition.field} onChange={(e) => update(index, { field: e.target.value })}>
            {fields.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </Select>
          <Select
            value={condition.operator}
            onChange={(e) => update(index, { operator: e.target.value as ConditionOperator })}
          >
            {Object.entries(OPERATORS).map(([key, op]) => (
              <option key={key} value={key}>
                {op.label}
              </option>
            ))}
          </Select>
          {OPERATORS[condition.operator].needsValue && (
            <input
              value={condition.value ?? ""}
              placeholder="valor"
              onChange={(e) => update(index, { value: e.target.value })}
            />
          )}
          <button
            type="button"
            className="auto-icon-btn"
            title="Remover condição"
            onClick={() => onChange(value.filter((_, i) => i !== index))}
          >
            <X size={14} />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="auto-link-btn"
        onClick={() => onChange([...value, { field: "title", operator: "eq", value: "" }])}
      >
        <Plus size={13} /> Adicionar condição
      </button>
    </div>
  );
}

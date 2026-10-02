"use client";

import { useState } from "react";
import { Copy } from "lucide-react";
import {
  ACTIVITY_TYPES,
  TRIGGER_TYPES,
  WATCHABLE_FIELDS,
  type ActivityType,
  type AutomationCondition,
  type TriggerType,
} from "@/lib/crm-automation-shared";
import { AutomationModal, ModalRow } from "./AutomationModal";
import { ConditionsEditor } from "./ConditionsEditor";
import type { AutomationStage, AutomationTrigger, CustomField } from "./types";

export type TriggerDraft = {
  name: string;
  type: TriggerType;
  stageId: string;
  watchedField: string | null;
  activityType: ActivityType | null;
  allowBackwards: boolean;
  conditions: AutomationCondition[];
  active: boolean;
};

export function TriggerModal({
  trigger,
  stageId,
  stages,
  customFields,
  onClose,
  onSave,
}: {
  trigger: AutomationTrigger | null;
  stageId: string;
  stages: AutomationStage[];
  customFields: CustomField[];
  onClose: () => void;
  onSave: (draft: TriggerDraft) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<TriggerDraft>(() => ({
    name: trigger?.name ?? "",
    type: trigger?.type ?? "WEBHOOK_IN",
    stageId: trigger?.stageId ?? stageId,
    watchedField: trigger?.watchedField ?? null,
    activityType: trigger?.activityType ?? null,
    allowBackwards: trigger?.allowBackwards ?? false,
    conditions: trigger?.conditions.map(({ field, operator, value }) => ({ field, operator, value })) ?? [],
    active: trigger?.active ?? true,
  }));
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const hookUrl =
    trigger?.webhookToken && typeof window !== "undefined"
      ? `${window.location.origin}/api/crm/hook/${trigger.webhookToken}`
      : null;

  const save = async () => {
    setSaving(true);
    const ok = await onSave(draft);
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <AutomationModal
      title={trigger ? "Gatilho" : "Novo gatilho"}
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
      <ModalRow label="Tipo">
        <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as TriggerType })}>
          {Object.entries(TRIGGER_TYPES).map(([key, t]) => (
            <option key={key} value={key}>
              {t.label}
            </option>
          ))}
        </select>
        <p className="auto-hint">{TRIGGER_TYPES[draft.type].description}</p>
      </ModalRow>

      <ModalRow label="Nome">
        <input
          value={draft.name}
          placeholder={TRIGGER_TYPES[draft.type].label}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
      </ModalRow>

      <ModalRow label="Mover para">
        <select value={draft.stageId} onChange={(e) => setDraft({ ...draft, stageId: e.target.value })}>
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </ModalRow>

      {draft.type === "WEBHOOK_IN" && (
        <ModalRow label="URL">
          {hookUrl && trigger?.type === "WEBHOOK_IN" ? (
            <>
              <div className="auto-inline">
                <input readOnly value={hookUrl} onFocus={(e) => e.target.select()} />
                <button
                  type="button"
                  className="btn-secondary auto-btn-sm"
                  onClick={() => {
                    navigator.clipboard.writeText(hookUrl);
                    setCopied(true);
                  }}
                >
                  <Copy size={14} /> {copied ? "Copiado" : "Copiar"}
                </button>
              </div>
              <p className="auto-hint">
                Chame com POST e o corpo <code>{`{"dealNumber": 123}`}</code> (ou <code>?dealNumber=123</code>) para mover o negócio.
              </p>
            </>
          ) : (
            <p className="auto-hint">A URL é gerada ao salvar o gatilho.</p>
          )}
        </ModalRow>
      )}

      {draft.type === "FIELD_CHANGED" && (
        <ModalRow label="Campo">
          <select value={draft.watchedField ?? ""} onChange={(e) => setDraft({ ...draft, watchedField: e.target.value || null })}>
            <option value="">Qualquer campo</option>
            {Object.entries(WATCHABLE_FIELDS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </ModalRow>
      )}

      {draft.type === "ACTIVITY_COMPLETED" && (
        <ModalRow label="Atividade">
          <select
            value={draft.activityType ?? ""}
            onChange={(e) => setDraft({ ...draft, activityType: (e.target.value || null) as ActivityType | null })}
          >
            <option value="">Qualquer tipo</option>
            {Object.entries(ACTIVITY_TYPES).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </ModalRow>
      )}

      <ModalRow label="Condição">
        <ConditionsEditor
          value={draft.conditions}
          customFields={customFields}
          onChange={(conditions) => setDraft({ ...draft, conditions })}
        />
      </ModalRow>

      <ModalRow label="Direção">
        <label className="auto-switch">
          <input
            type="checkbox"
            checked={draft.allowBackwards}
            onChange={(e) => setDraft({ ...draft, allowBackwards: e.target.checked })}
          />
          <span>Permitir mover para uma etapa anterior</span>
        </label>
      </ModalRow>

      <ModalRow label="Ativo">
        <label className="auto-switch">
          <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
          <span>{draft.active ? "Gatilho ativo" : "Gatilho pausado"}</span>
        </label>
      </ModalRow>
    </AutomationModal>
  );
}

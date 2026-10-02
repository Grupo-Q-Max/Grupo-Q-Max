"use client";

import { useRef, useState } from "react";
import { Braces, Plus, X } from "lucide-react";
import {
  ACTION_TYPES,
  ACTIVITY_TYPES,
  DEAL_FIELDS,
  DELAY_UNITS,
  customFieldKey,
  type ActionType,
  type ActivityAction,
  type ActivityType,
  type AutomationCondition,
  type DelayUnit,
  type HttpMethod,
  type WebhookHeader,
} from "@/lib/crm-automation-shared";
import { AutomationModal, ModalRow } from "./AutomationModal";
import { ConditionsEditor } from "./ConditionsEditor";
import type { AutomationRule, AutomationStage, CustomField, Member } from "./types";

export type RuleDraft = {
  actionType: ActionType;
  name: string;
  stageId: string;
  delayAmount: number;
  delayUnit: DelayUnit;
  webhookUrl: string;
  webhookMethod: HttpMethod;
  webhookBody: string;
  headers: WebhookHeader[];
  activity: ActivityAction;
  conditions: AutomationCondition[];
  active: boolean;
};

const DEFAULT_ACTIVITY: ActivityAction = {
  type: "TASK",
  title: "",
  description: null,
  assignee: "DEAL_RESPONSIBLE",
  responsibleId: null,
  deadlineAmount: null,
  deadlineUnit: null,
};

function ruleDraft(rule: AutomationRule | null, stageId: string, actionType: ActionType): RuleDraft {
  return {
    actionType: rule?.actionType ?? actionType,
    name: rule?.name ?? ACTION_TYPES[actionType].label,
    stageId: rule?.stageId ?? stageId,
    delayAmount: rule?.delayAmount ?? 0,
    delayUnit: rule?.delayUnit ?? "MINUTES",
    webhookUrl: rule?.webhookUrl ?? "",
    webhookMethod: rule?.webhookMethod ?? "POST",
    webhookBody: rule?.webhookBody ?? "",
    headers: rule?.headers.map(({ key, value }) => ({ key, value })) ?? [],
    activity: { ...DEFAULT_ACTIVITY, ...rule?.activity },
    conditions: rule?.conditions.map(({ field, operator, value }) => ({ field, operator, value })) ?? [],
    active: rule?.active ?? true,
  };
}

/** Menu that inserts a {{deal.<field>}} placeholder at the cursor of the given input. */
function PlaceholderMenu({
  customFields,
  onInsert,
}: {
  customFields: CustomField[];
  onInsert: (placeholder: string) => void;
}) {
  const fields = [...DEAL_FIELDS, ...customFields.map((f) => ({ key: customFieldKey(f.id), label: f.name }))];
  return (
    <label className="auto-placeholder" title="Inserir campo do negócio">
      <Braces size={14} />
      <select
        value=""
        onChange={(e) => {
          if (e.target.value) onInsert(`{{deal.${e.target.value}}}`);
        }}
      >
        <option value="">Inserir campo…</option>
        {fields.map((f) => (
          <option key={f.key} value={f.key}>
            {f.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Inserts text at the cursor of an input/textarea and returns the new value. */
function insertAt(el: HTMLInputElement | HTMLTextAreaElement | null, current: string, text: string) {
  if (!el) return current + text;
  const start = el.selectionStart ?? current.length;
  const end = el.selectionEnd ?? current.length;
  return current.slice(0, start) + text + current.slice(end);
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
  const urlRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  const set = (patch: Partial<RuleDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const setActivity = (patch: Partial<ActivityAction>) => setDraft((d) => ({ ...d, activity: { ...d.activity, ...patch } }));
  const setHeader = (index: number, patch: Partial<WebhookHeader>) =>
    set({ headers: draft.headers.map((h, i) => (i === index ? { ...h, ...patch } : h)) });

  const isWebhook = draft.actionType === "WEBHOOK";
  const { activity } = draft;

  const save = async () => {
    if (isWebhook && !/^https?:\/\//i.test(draft.webhookUrl.trim())) {
      setError("Informe uma URL começando com http:// ou https://");
      return;
    }
    if (!isWebhook && !activity.title.trim()) {
      setError("Informe o título da atividade");
      return;
    }
    if (!isWebhook && activity.assignee === "MEMBER" && !activity.responsibleId) {
      setError("Escolha o membro responsável pela atividade");
      return;
    }
    setSaving(true);
    const ok = await onSave(draft);
    setSaving(false);
    if (ok) onClose();
    else setError("Não foi possível salvar a regra.");
  };

  const label = ACTION_TYPES[draft.actionType].label;

  return (
    <AutomationModal
      title={rule ? label : `Nova regra: ${label}`}
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
        <select value={draft.stageId} onChange={(e) => set({ stageId: e.target.value })}>
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </ModalRow>

      <ModalRow label="Horário">
        <div className="auto-inline">
          <select
            value={draft.delayAmount > 0 ? "AFTER" : "IMMEDIATE"}
            onChange={(e) =>
              set(e.target.value === "AFTER" ? { delayAmount: 1, delayUnit: "DAYS" } : { delayAmount: 0 })
            }
          >
            <option value="IMMEDIATE">Imediatamente</option>
            <option value="AFTER">Após um tempo</option>
          </select>
          {draft.delayAmount > 0 && (
            <>
              <input
                type="number"
                min={1}
                className="auto-input--short"
                value={draft.delayAmount}
                onChange={(e) => set({ delayAmount: Math.max(1, Number(e.target.value) || 1) })}
              />
              <select value={draft.delayUnit} onChange={(e) => set({ delayUnit: e.target.value as DelayUnit })}>
                {Object.entries(DELAY_UNITS).map(([key, unit]) => (
                  <option key={key} value={key}>
                    {unit.label}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
      </ModalRow>

      <ModalRow label="Condição">
        <ConditionsEditor value={draft.conditions} customFields={customFields} onChange={(conditions) => set({ conditions })} />
      </ModalRow>

      {isWebhook ? (
        <>
          <ModalRow label="URL">
            <div className="auto-inline">
              <select
                className="auto-input--short"
                value={draft.webhookMethod}
                onChange={(e) => set({ webhookMethod: e.target.value as HttpMethod })}
              >
                <option value="POST">POST</option>
                <option value="GET">GET</option>
              </select>
              <input
                ref={urlRef}
                value={draft.webhookUrl}
                placeholder="https://exemplo.com/webhook?negocio={{deal.number}}"
                onChange={(e) => {
                  set({ webhookUrl: e.target.value });
                  setError("");
                }}
              />
              <PlaceholderMenu
                customFields={customFields}
                onInsert={(text) => set({ webhookUrl: insertAt(urlRef.current, draft.webhookUrl, text) })}
              />
            </div>
          </ModalRow>

          <ModalRow label="Cabeçalhos">
            <div className="auto-conditions">
              {draft.headers.map((header, index) => (
                <div key={index} className="auto-conditions__row">
                  <input value={header.key} placeholder="Nome" onChange={(e) => setHeader(index, { key: e.target.value })} />
                  <input value={header.value} placeholder="Valor" onChange={(e) => setHeader(index, { value: e.target.value })} />
                  <button
                    type="button"
                    className="auto-icon-btn"
                    title="Remover cabeçalho"
                    onClick={() => set({ headers: draft.headers.filter((_, i) => i !== index) })}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="auto-link-btn"
                onClick={() => set({ headers: [...draft.headers, { key: "", value: "" }] })}
              >
                <Plus size={13} /> Adicionar cabeçalho
              </button>
            </div>
          </ModalRow>

          {draft.webhookMethod === "POST" && (
            <ModalRow label="Corpo">
              <div className="auto-body">
                <textarea
                  ref={bodyRef}
                  rows={5}
                  value={draft.webhookBody}
                  placeholder="Vazio: envia todos os dados do negócio em JSON"
                  onChange={(e) => set({ webhookBody: e.target.value })}
                />
                <PlaceholderMenu
                  customFields={customFields}
                  onInsert={(text) => set({ webhookBody: insertAt(bodyRef.current, draft.webhookBody, text) })}
                />
              </div>
            </ModalRow>
          )}
        </>
      ) : (
        <>
          <ModalRow label="Tipo">
            <select value={activity.type} onChange={(e) => setActivity({ type: e.target.value as ActivityType })}>
              {Object.entries(ACTIVITY_TYPES).map(([key, typeLabel]) => (
                <option key={key} value={key}>
                  {typeLabel}
                </option>
              ))}
            </select>
          </ModalRow>

          <ModalRow label="Título">
            <div className="auto-inline">
              <input
                ref={titleRef}
                value={activity.title}
                placeholder="Ligar para {{deal.contact}}"
                onChange={(e) => {
                  setActivity({ title: e.target.value });
                  setError("");
                }}
              />
              <PlaceholderMenu
                customFields={customFields}
                onInsert={(text) => setActivity({ title: insertAt(titleRef.current, activity.title, text) })}
              />
            </div>
          </ModalRow>

          <ModalRow label="Descrição">
            <div className="auto-body">
              <textarea
                ref={descriptionRef}
                rows={3}
                value={activity.description ?? ""}
                placeholder="Opcional"
                onChange={(e) => setActivity({ description: e.target.value })}
              />
              <PlaceholderMenu
                customFields={customFields}
                onInsert={(text) =>
                  setActivity({ description: insertAt(descriptionRef.current, activity.description ?? "", text) })
                }
              />
            </div>
          </ModalRow>

          <ModalRow label="Responsável">
            <div className="auto-inline">
              <select
                value={activity.assignee}
                onChange={(e) =>
                  setActivity(
                    e.target.value === "MEMBER"
                      ? { assignee: "MEMBER", responsibleId: activity.responsibleId ?? members[0]?.id ?? null }
                      : { assignee: "DEAL_RESPONSIBLE", responsibleId: null }
                  )
                }
              >
                <option value="DEAL_RESPONSIBLE">Responsável do negócio</option>
                <option value="MEMBER">Membro da equipe</option>
              </select>
              {activity.assignee === "MEMBER" && (
                <select
                  value={activity.responsibleId ?? ""}
                  onChange={(e) => setActivity({ responsibleId: e.target.value || null })}
                >
                  {members.length === 0 && <option value="">Nenhum membro cadastrado</option>}
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </ModalRow>

          <ModalRow label="Prazo">
            <div className="auto-inline">
              <select
                value={activity.deadlineAmount ? "AFTER" : "NONE"}
                onChange={(e) =>
                  setActivity(
                    e.target.value === "AFTER"
                      ? { deadlineAmount: 1, deadlineUnit: "DAYS" }
                      : { deadlineAmount: null, deadlineUnit: null }
                  )
                }
              >
                <option value="NONE">Sem prazo</option>
                <option value="AFTER">Após a criação</option>
              </select>
              {activity.deadlineAmount ? (
                <>
                  <input
                    type="number"
                    min={1}
                    className="auto-input--short"
                    value={activity.deadlineAmount}
                    onChange={(e) => setActivity({ deadlineAmount: Math.max(1, Number(e.target.value) || 1) })}
                  />
                  <select
                    value={activity.deadlineUnit ?? "DAYS"}
                    onChange={(e) => setActivity({ deadlineUnit: e.target.value as DelayUnit })}
                  >
                    {Object.entries(DELAY_UNITS).map(([key, unit]) => (
                      <option key={key} value={key}>
                        {unit.label}
                      </option>
                    ))}
                  </select>
                </>
              ) : null}
            </div>
          </ModalRow>
        </>
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

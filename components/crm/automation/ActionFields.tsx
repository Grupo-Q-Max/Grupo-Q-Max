"use client";

import { useEffect, useRef, useState } from "react";
import { Braces, Plus, X } from "lucide-react";
import {
  ACTIVITY_TYPES,
  DEAL_FIELDS,
  DEAL_STATUSES,
  DELAY_UNITS,
  TASK_PRIORITIES,
  customFieldKey,
  hasDealUpdate,
  HTTP_METHODS,
  methodHasBody,
  type ActionType,
  type ActivityAction,
  type ActivityType,
  type DealStatus,
  type DealUpdateAction,
  type DelayUnit,
  type HttpMethod,
  type NotifyAction,
  type TaskPriority,
  type WebhookHeader,
} from "@/lib/crm-automation-shared";
import { ModalRow } from "./AutomationModal";
import type { AutomationStage, CustomField, Member } from "./types";
import { Select } from "@/components/ui/Select";

/** Configuration of an action, as edited in the dialog (a rule or a flow step). */
export type ActionDraft = {
  webhookUrl: string;
  webhookMethod: HttpMethod;
  webhookBody: string;
  headers: WebhookHeader[];
  activity: ActivityAction;
  dealUpdate: DealUpdateAction;
  notify: NotifyAction;
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

const DEFAULT_DEAL_UPDATE: DealUpdateAction = { stageId: null, status: null, responsibleId: null, priority: null, addTagId: null, customData: null };

type SavedAction = {
  webhookUrl: string | null;
  webhookMethod: HttpMethod;
  webhookBody: string | null;
  headers: WebhookHeader[];
  activity: ActivityAction | null;
  dealUpdate: DealUpdateAction | null;
  notify: NotifyAction | null;
};

export function actionDraft(saved: SavedAction | null | undefined): ActionDraft {
  return {
    webhookUrl: saved?.webhookUrl ?? "",
    webhookMethod: saved?.webhookMethod ?? "POST",
    webhookBody: saved?.webhookBody ?? "",
    headers: saved?.headers.map(({ key, value }) => ({ key, value })) ?? [],
    activity: { ...DEFAULT_ACTIVITY, ...saved?.activity },
    dealUpdate: { ...DEFAULT_DEAL_UPDATE, ...saved?.dealUpdate },
    notify: {
      message: saved?.notify?.message ?? "",
      notifyResponsible: saved?.notify?.notifyResponsible ?? true,
      notifyAssignees: saved?.notify?.notifyAssignees ?? false,
      memberIds: saved?.notify?.memberIds ?? [],
    },
  };
}

/** What is missing in an action of a rule in `stageId`, or "". */
export function actionValidationError(action: ActionType, draft: ActionDraft, stageId: string) {
  const { activity, dealUpdate, notify } = draft;
  if (action === "WEBHOOK" && !/^https?:\/\//i.test(draft.webhookUrl.trim())) {
    return "Informe uma URL começando com http:// ou https://";
  }
  if (action === "CREATE_ACTIVITY") {
    if (!activity.title.trim()) return "Informe o título da atividade";
    if (activity.assignee === "MEMBER" && !activity.responsibleId) return "Escolha o membro responsável pela atividade";
  }
  if (action === "UPDATE_DEAL") {
    if (!hasDealUpdate(dealUpdate)) return "Escolha ao menos uma alteração";
    if (dealUpdate.stageId === stageId) return "A etapa de destino deve ser diferente da etapa da regra";
  }
  if (action === "NOTIFY") {
    if (!notify.message.trim()) return "Informe a mensagem";
    if (!notify.notifyResponsible && !notify.notifyAssignees && notify.memberIds.length === 0) return "Escolha quem será avisado";
  }
  return "";
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
      <Select
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
      </Select>
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

/** Fields of an action (webhook, activity, deal changes or notification). */
export function ActionFields({
  action,
  draft,
  onChange,
  stageId,
  stages,
  customFields,
  members,
}: {
  action: ActionType;
  draft: ActionDraft;
  onChange: (patch: Partial<ActionDraft>) => void;
  /** Stage of the rule: a deal can't be moved to it */
  stageId: string;
  stages: AutomationStage[];
  customFields: CustomField[];
  members: Member[];
}) {
  const urlRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);
  // Tags for "Adicionar etiqueta", loaded when the action is "Modificar negócio"
  const [tags, setTags] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    if (action !== "UPDATE_DEAL") return;
    const controller = new AbortController();
    fetch("/api/crm/tag", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : []))
      .then(setTags)
      .catch(() => {});
    return () => controller.abort();
  }, [action]);

  const set = onChange;
  const { activity, dealUpdate, notify } = draft;
  const setActivity = (patch: Partial<ActivityAction>) => set({ activity: { ...activity, ...patch } });
  const setDealUpdate = (patch: Partial<DealUpdateAction>) => set({ dealUpdate: { ...dealUpdate, ...patch } });
  const setNotify = (patch: Partial<NotifyAction>) => set({ notify: { ...notify, ...patch } });
  const setHeader = (index: number, patch: Partial<WebhookHeader>) =>
    set({ headers: draft.headers.map((h, i) => (i === index ? { ...h, ...patch } : h)) });

  // Custom fields changed by an UPDATE_DEAL rule, edited as rows
  const customRows = Object.entries(dealUpdate.customData ?? {});
  const setCustomRows = (rows: [string, string][]) =>
    setDealUpdate({ customData: rows.length ? Object.fromEntries(rows) : null });
  const unusedFields = customFields.filter((f) => !(dealUpdate.customData && f.id in dealUpdate.customData));

  return (
    <>
      {action === "WEBHOOK" && (
        <>
          <ModalRow label="URL">
            <div className="auto-inline">
              <Select
                className="auto-input--short"
                value={draft.webhookMethod}
                onChange={(e) => set({ webhookMethod: e.target.value as HttpMethod })}
              >
                {HTTP_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>
              <input
                ref={urlRef}
                value={draft.webhookUrl}
                placeholder="https://exemplo.com/webhook?negocio={{deal.number}}"
                onChange={(e) => set({ webhookUrl: e.target.value })}
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

          {methodHasBody(draft.webhookMethod) && (
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
      )}

      {action === "CREATE_ACTIVITY" && (
        <>
          <ModalRow label="Tipo">
            <Select value={activity.type} onChange={(e) => setActivity({ type: e.target.value as ActivityType })}>
              {Object.entries(ACTIVITY_TYPES).map(([key, typeLabel]) => (
                <option key={key} value={key}>
                  {typeLabel}
                </option>
              ))}
            </Select>
          </ModalRow>

          <ModalRow label="Título">
            <div className="auto-inline">
              <input
                ref={titleRef}
                value={activity.title}
                placeholder="Ligar para {{deal.contact}}"
                onChange={(e) => setActivity({ title: e.target.value })}
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
              <Select
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
              </Select>
              {activity.assignee === "MEMBER" && (
                <Select
                  value={activity.responsibleId ?? ""}
                  onChange={(e) => setActivity({ responsibleId: e.target.value || null })}
                >
                  {members.length === 0 && <option value="">Nenhum membro cadastrado</option>}
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </Select>
              )}
            </div>
          </ModalRow>

          <ModalRow label="Prazo">
            <div className="auto-inline">
              <Select
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
              </Select>
              {activity.deadlineAmount ? (
                <>
                  <input
                    type="number"
                    min={1}
                    className="auto-input--short"
                    value={activity.deadlineAmount}
                    onChange={(e) => setActivity({ deadlineAmount: Math.max(1, Number(e.target.value) || 1) })}
                  />
                  <Select
                    value={activity.deadlineUnit ?? "DAYS"}
                    onChange={(e) => setActivity({ deadlineUnit: e.target.value as DelayUnit })}
                  >
                    {Object.entries(DELAY_UNITS).map(([key, unit]) => (
                      <option key={key} value={key}>
                        {unit.label}
                      </option>
                    ))}
                  </Select>
                </>
              ) : null}
            </div>
          </ModalRow>
        </>
      )}

      {action === "UPDATE_DEAL" && (
        <>
          <ModalRow label="Mover para">
            <Select value={dealUpdate.stageId ?? ""} onChange={(e) => setDealUpdate({ stageId: e.target.value || null })}>
              <option value="">Não mover</option>
              {stages
                .filter((s) => s.id !== stageId || s.id === dealUpdate.stageId)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </Select>
          </ModalRow>

          <ModalRow label="Status">
            <Select
              value={dealUpdate.status ?? ""}
              onChange={(e) => setDealUpdate({ status: (e.target.value || null) as DealStatus | null })}
            >
              <option value="">Não alterar</option>
              {Object.entries(DEAL_STATUSES).map(([key, statusLabel]) => (
                <option key={key} value={key}>
                  {statusLabel}
                </option>
              ))}
            </Select>
          </ModalRow>

          <ModalRow label="Responsável">
            <Select
              value={dealUpdate.responsibleId ?? ""}
              onChange={(e) => setDealUpdate({ responsibleId: e.target.value || null })}
            >
              <option value="">Não alterar</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </ModalRow>

          <ModalRow label="Prioridade">
            <Select
              value={dealUpdate.priority ?? ""}
              onChange={(e) => setDealUpdate({ priority: (e.target.value || null) as TaskPriority | null })}
            >
              <option value="">Não alterar</option>
              {Object.entries(TASK_PRIORITIES).map(([key, priorityLabel]) => (
                <option key={key} value={key}>
                  {priorityLabel}
                </option>
              ))}
            </Select>
          </ModalRow>

          <ModalRow label="Adicionar etiqueta">
            <Select value={dealUpdate.addTagId ?? ""} onChange={(e) => setDealUpdate({ addTagId: e.target.value || null })}>
              <option value="">Nenhuma</option>
              {tags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </ModalRow>

          <ModalRow label="Campos">
            <div className="auto-conditions">
              {customRows.map(([fieldId, value], index) => {
                const field = customFields.find((f) => f.id === fieldId);
                const setRow = (patch: { id?: string; value?: string }) =>
                  setCustomRows(
                    customRows.map((row, i) => (i === index ? [patch.id ?? row[0], patch.value ?? row[1]] : row))
                  );
                return (
                  <div key={fieldId} className="auto-conditions__row">
                    <Select value={fieldId} onChange={(e) => setRow({ id: e.target.value })}>
                      {!field && <option value={fieldId}>Campo removido</option>}
                      {customFields
                        .filter((f) => f.id === fieldId || unusedFields.includes(f))
                        .map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                    </Select>
                    <input
                      type={field?.type === "date" ? "date" : "text"}
                      value={value}
                      placeholder="Vazio: limpa o campo"
                      onChange={(e) => setRow({ value: e.target.value })}
                    />
                    {field?.type !== "date" && (
                      <PlaceholderMenu customFields={customFields} onInsert={(text) => setRow({ value: value + text })} />
                    )}
                    <button
                      type="button"
                      className="auto-icon-btn"
                      title="Remover campo"
                      onClick={() => setCustomRows(customRows.filter((_, i) => i !== index))}
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })}
              {customFields.length === 0 ? (
                <span className="auto-hint">Este funil não tem campos personalizados.</span>
              ) : (
                unusedFields.length > 0 && (
                  <button
                    type="button"
                    className="auto-link-btn"
                    onClick={() => setCustomRows([...customRows, [unusedFields[0].id, ""]])}
                  >
                    <Plus size={13} /> Alterar campo
                  </button>
                )
              )}
            </div>
          </ModalRow>
        </>
      )}

      {action === "NOTIFY" && (
        <>
          <ModalRow label="Mensagem">
            <div className="auto-body">
              <textarea
                ref={messageRef}
                rows={4}
                value={notify.message}
                placeholder="Comentário adicionado ao negócio e enviado aos membros"
                onChange={(e) => setNotify({ message: e.target.value })}
              />
              <PlaceholderMenu
                customFields={customFields}
                onInsert={(text) => setNotify({ message: insertAt(messageRef.current, notify.message, text) })}
              />
            </div>
          </ModalRow>

          <ModalRow label="Avisar">
            <div className="auto-checks">
              <label className="auto-switch">
                <input
                  type="checkbox"
                  checked={notify.notifyResponsible}
                  onChange={(e) => setNotify({ notifyResponsible: e.target.checked })}
                />
                <span>Responsável do negócio</span>
              </label>
              <label className="auto-switch">
                <input
                  type="checkbox"
                  checked={notify.notifyAssignees}
                  onChange={(e) => setNotify({ notifyAssignees: e.target.checked })}
                />
                <span>Corresponsáveis e observadores</span>
              </label>
              {members.map((m) => (
                <label key={m.id} className="auto-switch">
                  <input
                    type="checkbox"
                    checked={notify.memberIds.includes(m.id)}
                    onChange={(e) =>
                      setNotify({
                        memberIds: e.target.checked
                          ? [...notify.memberIds, m.id]
                          : notify.memberIds.filter((id) => id !== m.id),
                      })
                    }
                  />
                  <span>{m.name}</span>
                </label>
              ))}
            </div>
          </ModalRow>
        </>
      )}
    </>
  );
}

/*
 * Types and labels shared by the automation engine (server) and the
 * automation board (client). Must not import server-only modules.
 */

export type DelayUnit = "MINUTES" | "HOURS" | "DAYS";
export const HTTP_METHODS = ["POST", "GET", "PUT", "PATCH", "DELETE"] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];
export const isHttpMethod = (value: unknown): value is HttpMethod => HTTP_METHODS.includes(value as HttpMethod);
/** GET and DELETE webhooks are sent without a body */
export const methodHasBody = (method: HttpMethod) => method !== "GET" && method !== "DELETE";
export type ConditionOperator = "eq" | "neq" | "contains" | "empty" | "notEmpty" | "gt" | "lt";
export type TriggerType = "WEBHOOK_IN" | "FIELD_CHANGED" | "ACTIVITY_COMPLETED" | "DEAL_CREATED" | "DUE_REACHED" | "ESTIMATE_EXCEEDED";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type ActivityType = "TODO" | "TASK" | "CALL" | "MEETING" | "COMMENT";
export type ActionType =
  | "WEBHOOK"
  | "CREATE_ACTIVITY"
  | "UPDATE_DEAL"
  | "NOTIFY"
  | "CREATE_SUBTASK"
  | "ADD_CHECKLIST"
  | "SEND_EMAIL"
  | "COPY_CARD"
  | "FLOW";
/** Actions a flow step can run (a flow inside a flow is not allowed) */
export type StepActionType = Exclude<ActionType, "FLOW">;
export type StepType = "ACTION" | "WAIT" | "CONDITION";
export type Branch = "THEN" | "ELSE";
export type DealStatus = "OPEN" | "WON" | "LOST";
export type ActivityAssignee = "DEAL_RESPONSIBLE" | "MEMBER";

export type AutomationCondition = { field: string; operator: ConditionOperator; value: string | null };
export type WebhookHeader = { key: string; value: string };

/** CREATE_ACTIVITY configuration of a rule (CrmAutomationActivity). */
export type ActivityAction = {
  type: ActivityType;
  title: string;
  description: string | null;
  assignee: ActivityAssignee;
  responsibleId: string | null;
  deadlineAmount: number | null;
  deadlineUnit: DelayUnit | null;
};

/** UPDATE_DEAL configuration of a rule (CrmAutomationDealUpdate); null = leave unchanged. */
export type DealUpdateAction = {
  stageId: string | null;
  status: DealStatus | null;
  responsibleId: string | null;
  /** Task boards: priority to set */
  priority: TaskPriority | null;
  /** Tag added to the card (its other tags stay) */
  addTagId: string | null;
  /** { [customFieldId]: value with placeholders }; "" clears the field */
  customData: Record<string, string> | null;
};

/** NOTIFY configuration of a rule (CrmAutomationNotify). */
export type NotifyAction = {
  /** Comment text, with placeholders */
  message: string;
  notifyResponsible: boolean;
  /** Also the card's co-assignees and observers */
  notifyAssignees: boolean;
  memberIds: string[];
};

/** CREATE_SUBTASK configuration of a rule (CrmAutomationSubtask). */
export type SubtaskAction = {
  /** Title, with placeholders */
  title: string;
  assignee: ActivityAssignee;
  responsibleId: string | null;
  /** Deadline in days from the run; null = none */
  deadlineDays: number | null;
};

/** ADD_CHECKLIST configuration of a rule (CrmAutomationChecklistItem rows): item titles, with placeholders. */
export type ChecklistAction = { items: string[] };

/** SEND_EMAIL configuration of a rule (CrmAutomationEmail); every text accepts placeholders. */
export type EmailAction = { to: string; subject: string; body: string };

/** COPY_CARD configuration of a rule (CrmAutomationCopy). */
export type CopyAction = { stageId: string | null; link: boolean };

export const ACTION_TYPES:Record<ActionType, { label: string }> = {
  WEBHOOK: { label: "Webhook de saída" },
  CREATE_ACTIVITY: { label: "Criar atividade" },
  UPDATE_DEAL: { label: "Modificar negócio" },
  NOTIFY: { label: "Adicionar notificação" },
  CREATE_SUBTASK: { label: "Criar subtarefa" },
  ADD_CHECKLIST: { label: "Adicionar checklist" },
  SEND_EMAIL: { label: "Enviar e-mail" },
  COPY_CARD: { label: "Copiar negócio" },
  FLOW: { label: "Fluxo (ações de grupo)" },
};

export const isActionType = (value: unknown): value is ActionType => typeof value === "string" && value in ACTION_TYPES;

export const isStepActionType = (value: unknown): value is StepActionType => isActionType(value) && value !== "FLOW";

export const DELAY_UNITS: Record<DelayUnit, { label: string; ms: number }> = {
  MINUTES: { label: "minutos", ms: 60_000 },
  HOURS: { label: "horas", ms: 3_600_000 },
  DAYS: { label: "dias", ms: 86_400_000 },
};

export const isDelayUnit = (value: unknown): value is DelayUnit => typeof value === "string" && value in DELAY_UNITS;

export const delayMs = (amount: number, unit: DelayUnit) => Math.max(0, amount) * DELAY_UNITS[unit].ms;

export const describeDelay = (amount: number, unit: DelayUnit) =>
  amount > 0 ? `após ${amount} ${DELAY_UNITS[unit].label}` : "imediatamente";

/** "Execução" of a rule (Bitrix24): start with the stage, or after the previous rule finished. */
export type Execution = "PARALLEL" | "SEQUENTIAL";

export const EXECUTIONS: Record<Execution, string> = {
  PARALLEL: "Em paralelo",
  SEQUENTIAL: "Em sequência (após a regra anterior)",
};

/** Timing shown on a rule card: "imediatamente", "após 2 dias", "após a anterior + 2 dias". */
export const describeTiming = (execution: Execution, amount: number, unit: DelayUnit) =>
  execution === "SEQUENTIAL"
    ? `após a anterior${amount > 0 ? ` + ${amount} ${DELAY_UNITS[unit].label}` : ""}`
    : describeDelay(amount, unit);

export const OPERATORS: Record<ConditionOperator, { label: string; needsValue: boolean }> = {
  eq: { label: "é igual a", needsValue: true },
  neq: { label: "é diferente de", needsValue: true },
  contains: { label: "contém", needsValue: true },
  empty: { label: "está vazio", needsValue: false },
  notEmpty: { label: "não está vazio", needsValue: false },
  gt: { label: "é maior que", needsValue: true },
  lt: { label: "é menor que", needsValue: true },
};

/** Validates conditions coming from the client, keeping their order. */
export function parseConditions(value: unknown): AutomationCondition[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((c) => c && typeof c.field === "string" && c.field && c.operator in OPERATORS)
    .map((c) => ({
      field: c.field,
      operator: c.operator,
      value: OPERATORS[c.operator as ConditionOperator].needsValue ? String(c.value ?? "") : null,
    }));
}

/** Deal fields usable in conditions and as {{deal.<key>}} placeholders. */
export const DEAL_FIELDS: { key: string; label: string }[] = [
  { key: "id", label: "ID" },
  { key: "number", label: "Número" },
  { key: "title", label: "Nome" },
  { key: "value", label: "Valor" },
  { key: "currency", label: "Moeda" },
  { key: "status", label: "Status (OPEN/WON/LOST)" },
  { key: "priority", label: "Prioridade (LOW/MEDIUM/HIGH/URGENT)" },
  { key: "stage", label: "Etapa" },
  { key: "pipeline", label: "Funil" },
  { key: "responsible", label: "Responsável" },
  { key: "company", label: "Empresa" },
  { key: "companyDocument", label: "CNPJ da empresa" },
  { key: "companyEmail", label: "E-mail da empresa" },
  { key: "companyPhone", label: "Telefone da empresa" },
  { key: "contact", label: "Contato" },
  { key: "contactEmail", label: "E-mail do contato" },
  { key: "contactPhone", label: "Telefone do contato" },
  { key: "source", label: "Fonte" },
  { key: "dealType", label: "Tipo de negócio" },
  { key: "startDate", label: "Data de início" },
  { key: "closeDate", label: "Data de término" },
  { key: "comment", label: "Comentário" },
  { key: "url", label: "Link do negócio" },
];

/** Custom pipeline fields are exposed as `custom.<fieldId>`. */
export const customFieldKey = (fieldId: string) => `custom.${fieldId}`;

export type DealContext = Record<string, string>;

export function matchesConditions(conditions: AutomationCondition[], ctx: DealContext) {
  return conditions.every(({ field, operator, value }) => {
    const actual = (ctx[field] ?? "").trim();
    const expected = (value ?? "").trim();
    const numeric = actual !== "" && expected !== "" && !isNaN(Number(actual)) && !isNaN(Number(expected));
    switch (operator) {
      case "eq":
        return actual.toLowerCase() === expected.toLowerCase();
      case "neq":
        return actual.toLowerCase() !== expected.toLowerCase();
      case "contains":
        return actual.toLowerCase().includes(expected.toLowerCase());
      case "empty":
        return actual === "";
      case "notEmpty":
        return actual !== "";
      case "gt":
        return numeric ? Number(actual) > Number(expected) : actual !== "" && actual > expected;
      case "lt":
        return numeric ? Number(actual) < Number(expected) : actual !== "" && actual < expected;
    }
  });
}

/**
 * Replaces {{deal.title}}-style placeholders with the deal's values (URL-encoded when `encode`).
 * In flows, {{response.<path>}} reads the JSON response of the last webhook step (ctx keys "response.<path>").
 */
export const fillPlaceholders = (template: string, ctx: DealContext, encode = false) =>
  template.replace(/\{\{\s*(deal|response)\.([\w.-]+)\s*\}\}/g, (_, scope: string, key: string) => {
    const value = ctx[scope === "deal" ? key : `response.${key}`] ?? "";
    return encode ? encodeURIComponent(value) : value;
  });

export const TRIGGER_TYPES: Record<TriggerType, { label: string; description: string }> = {
  WEBHOOK_IN: { label: "Webhook de entrada", description: "Uma chamada externa à URL do gatilho move o negócio" },
  FIELD_CHANGED: { label: "Campo alterado", description: "Quando um campo do negócio é alterado" },
  ACTIVITY_COMPLETED: { label: "Atividade concluída", description: "Quando uma atividade do negócio é concluída" },
  DEAL_CREATED: { label: "Negócio criado", description: "Quando um negócio é criado no funil" },
  DUE_REACHED: { label: "Prazo chegou", description: "Quadros de tarefas: no dia do prazo (ou atrasada), junto com o lembrete do responsável" },
  ESTIMATE_EXCEEDED: { label: "Estimativa estourada", description: "Quadros de tarefas: quando o tempo gasto passa da estimativa" },
};

/** What starts a rule: entering its stage, or one of the trigger events while the deal is in the stage */
export type StartOn = "STAGE_ENTERED" | "FIELD_CHANGED" | "ACTIVITY_COMPLETED" | "DUE_REACHED" | "ESTIMATE_EXCEEDED";

export const START_ON: Record<StartOn, string> = {
  STAGE_ENTERED: "Ao entrar na etapa",
  FIELD_CHANGED: `${TRIGGER_TYPES.FIELD_CHANGED.label} (na etapa)`,
  ACTIVITY_COMPLETED: `${TRIGGER_TYPES.ACTIVITY_COMPLETED.label} (na etapa)`,
  DUE_REACHED: `${TRIGGER_TYPES.DUE_REACHED.label} (na etapa)`,
  ESTIMATE_EXCEEDED: `${TRIGGER_TYPES.ESTIMATE_EXCEEDED.label} (na etapa)`,
};

export const isStartOn = (value: unknown): value is StartOn => typeof value === "string" && value in START_ON;

export const TASK_PRIORITIES: Record<TaskPriority, string> = { URGENT: "Urgente", HIGH: "Alta", MEDIUM: "Média", LOW: "Baixa" };

export const isTriggerType = (value: unknown): value is TriggerType => typeof value === "string" && value in TRIGGER_TYPES;

export const ACTIVITY_TYPES: Partial<Record<ActivityType, string>> = {
  TODO: "A fazer",
  TASK: "Tarefa",
  CALL: "Ligação",
  MEETING: "Reunião",
};

/** Validates the CREATE_ACTIVITY configuration coming from the client. */
export function parseActivityAction(value: unknown): ActivityAction {
  const input = (value ?? {}) as Partial<Record<keyof ActivityAction, unknown>>;
  const type = String(input.type ?? "") as ActivityType;
  const assignee: ActivityAssignee = input.assignee === "MEMBER" && input.responsibleId ? "MEMBER" : "DEAL_RESPONSIBLE";
  const deadlineAmount = Math.round(Number(input.deadlineAmount) || 0);
  const hasDeadline = deadlineAmount > 0 && isDelayUnit(input.deadlineUnit);
  return {
    type: type in ACTIVITY_TYPES ? type : "TASK",
    title: String(input.title ?? "").trim() || "Atividade de {{deal.title}}",
    description: String(input.description ?? "").trim() || null,
    assignee,
    responsibleId: assignee === "MEMBER" ? String(input.responsibleId) : null,
    deadlineAmount: hasDeadline ? deadlineAmount : null,
    deadlineUnit: hasDeadline ? (input.deadlineUnit as DelayUnit) : null,
  };
}

export const DEAL_STATUSES: Record<DealStatus, string> = {
  OPEN: "Em andamento",
  WON: "Ganho",
  LOST: "Perdido",
};

/** Validates the UPDATE_DEAL configuration coming from the client. */
export function parseDealUpdateAction(value: unknown): DealUpdateAction {
  const input = (value ?? {}) as Partial<Record<keyof DealUpdateAction, unknown>>;
  const id = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const customData: Record<string, string> = {};
  if (input.customData && typeof input.customData === "object" && !Array.isArray(input.customData)) {
    for (const [fieldId, fieldValue] of Object.entries(input.customData)) {
      if (fieldId) customData[fieldId] = String(fieldValue ?? "").trim();
    }
  }
  return {
    stageId: id(input.stageId),
    status: typeof input.status === "string" && input.status in DEAL_STATUSES ? (input.status as DealStatus) : null,
    responsibleId: id(input.responsibleId),
    priority: typeof input.priority === "string" && Object.hasOwn(TASK_PRIORITIES, input.priority) ? (input.priority as TaskPriority) : null,
    addTagId: id(input.addTagId),
    customData: Object.keys(customData).length ? customData : null,
  };
}

/** Whether an UPDATE_DEAL configuration changes anything. */
export const hasDealUpdate = (a: DealUpdateAction) =>
  Boolean(a.stageId || a.status || a.responsibleId || a.priority || a.addTagId || (a.customData && Object.keys(a.customData).length));

/** Validates the NOTIFY configuration coming from the client. */
export function parseNotifyAction(value: unknown): NotifyAction {
  const input = (value ?? {}) as Partial<Record<keyof NotifyAction, unknown>>;
  const memberIds = Array.isArray(input.memberIds)
    ? [...new Set(input.memberIds.filter((id): id is string => typeof id === "string" && id.trim() !== ""))]
    : [];
  return {
    message: String(input.message ?? "").trim(),
    notifyResponsible: input.notifyResponsible !== false,
    notifyAssignees: input.notifyAssignees === true,
    memberIds,
  };
}

/**
 * Members of a saved NOTIFY rule: its CrmAutomationNotifyMember rows plus the legacy
 * `memberIds` JSON not migrated yet (scripts/migrate-notify-members.sql).
 */
export function notifyMemberIds(notify: { members?: { memberId: string }[]; memberIds?: unknown } | null | undefined) {
  const legacy = Array.isArray(notify?.memberIds) ? notify.memberIds.filter((id): id is string => typeof id === "string") : [];
  return [...new Set([...(notify?.members ?? []).map((m) => m.memberId), ...legacy])];
}

/** Validates the CREATE_SUBTASK configuration coming from the client. */
export function parseSubtaskAction(value: unknown): SubtaskAction {
  const input = (value ?? {}) as Partial<Record<keyof SubtaskAction, unknown>>;
  const assignee: ActivityAssignee = input.assignee === "MEMBER" && input.responsibleId ? "MEMBER" : "DEAL_RESPONSIBLE";
  const days = Math.round(Number(input.deadlineDays));
  return {
    title: String(input.title ?? "").trim() || "Subtarefa de {{deal.title}}",
    assignee,
    responsibleId: assignee === "MEMBER" ? String(input.responsibleId) : null,
    deadlineDays: input.deadlineDays !== null && input.deadlineDays !== "" && days >= 0 ? days : null,
  };
}

/** Validates the ADD_CHECKLIST configuration coming from the client: non-empty items, at most 50. */
export function parseChecklistAction(value: unknown): ChecklistAction {
  const input = (value ?? {}) as Partial<Record<keyof ChecklistAction, unknown>>;
  const items = Array.isArray(input.items) ? input.items.map((i) => String(i ?? "").trim()).filter(Boolean) : [];
  return { items: items.slice(0, 50) };
}

/** Validates the SEND_EMAIL configuration coming from the client. */
export function parseEmailAction(value: unknown): EmailAction {
  const input = (value ?? {}) as Partial<Record<keyof EmailAction, unknown>>;
  return {
    to: String(input.to ?? "").trim(),
    subject: String(input.subject ?? "").trim() || "{{deal.title}}",
    body: String(input.body ?? "").trim(),
  };
}

/** Validates the COPY_CARD configuration coming from the client. */
export function parseCopyAction(value: unknown): CopyAction {
  const input = (value ?? {}) as Partial<Record<keyof CopyAction, unknown>>;
  return {
    stageId: typeof input.stageId === "string" && input.stageId.trim() ? input.stageId.trim() : null,
    link: input.link !== false,
  };
}

/** E-mail addresses in a filled "Para" field (separated by commas or semicolons); invalid ones are dropped. */
export const emailRecipients = (text: string) =>
  [...new Set(text.split(/[,;]/).map((a) => a.trim()).filter((a) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a)))];

/** Fields that can be watched by a FIELD_CHANGED trigger (keys of SCALAR/RELATION_FIELDS in lib/crm-deal). */
export const WATCHABLE_FIELDS: Record<string, string> = {
  title: "Nome",
  value: "Valor",
  responsibleId: "Responsável",
  status: "Status",
  startDate: "Data de início",
  closeDate: "Data de término",
  dealType: "Tipo de negócio",
  source: "Fonte",
  comment: "Comentário",
  company: "Empresa",
  contacts: "Contatos",
  products: "Serviços",
  customData: "Campos adicionais",
};

export const RUN_STATUS_LABELS: Record<string, string> = {
  WAITING: "Aguardando anterior",
  PENDING: "Agendada",
  RUNNING: "Executando",
  SUCCESS: "Sucesso",
  FAILED: "Falhou",
  SKIPPED: "Ignorada",
};

// ---------------------------------------------------------------------------
// Flows ("ações de grupo")
// ---------------------------------------------------------------------------

/** Protection against huge or endless flows. */
export const FLOW_LIMITS = {
  /** Steps a flow can have */
  maxSteps: 50,
  /** Nested if/else levels */
  maxDepth: 5,
  /** Steps run by one execution of a flow */
  maxExecuted: 100,
};

export const STEP_TYPES: Record<StepType, { label: string }> = {
  ACTION: { label: "Ação" },
  WAIT: { label: "Esperar" },
  CONDITION: { label: "Condição (se/senão)" },
};

export const BRANCHES: Record<Branch, string> = { THEN: "Então", ELSE: "Senão" };

/**
 * A flow step as edited in the dialog and sent to the API: a tree where a
 * CONDITION holds its THEN/ELSE steps. `action` holds the rule fields of an
 * ACTION step (same body as a simple rule, plus its `actionType`).
 */
export type FlowStepInput<A = Record<string, unknown>> = {
  type: StepType;
  waitAmount: number;
  waitUnit: DelayUnit;
  conditions: AutomationCondition[];
  action: (A & { actionType: StepActionType }) | null;
  then: FlowStepInput<A>[];
  else: FlowStepInput<A>[];
};

export const countSteps = (steps: FlowStepInput<unknown>[]): number =>
  steps.reduce((total, s) => total + 1 + countSteps(s.then) + countSteps(s.else), 0);

/** Validates a flow coming from the client. Returns the steps or what is wrong. */
export function parseFlowSteps(value: unknown): { steps: FlowStepInput[]; error: string | null } {
  let error: string | null = null;
  const parse = (list: unknown, depth: number): FlowStepInput[] =>
    (Array.isArray(list) ? list : []).flatMap((raw): FlowStepInput[] => {
      const input = (raw ?? {}) as Record<string, unknown>;
      const type = input.type as StepType;
      if (!(type in STEP_TYPES)) return [];
      const action = (input.action ?? null) as Record<string, unknown> | null;
      if (type === "ACTION" && !isStepActionType(action?.actionType)) {
        error = "Escolha a ação de cada passo";
        return [];
      }
      if (type === "CONDITION" && depth >= FLOW_LIMITS.maxDepth) {
        error = `No máximo ${FLOW_LIMITS.maxDepth} condições aninhadas`;
        return [];
      }
      return [
        {
          type,
          waitAmount: type === "WAIT" ? Math.max(1, Math.round(Number(input.waitAmount) || 1)) : 0,
          waitUnit: isDelayUnit(input.waitUnit) ? input.waitUnit : "MINUTES",
          conditions: type === "CONDITION" ? parseConditions(input.conditions) : [],
          action: type === "ACTION" ? (action as FlowStepInput["action"]) : null,
          then: type === "CONDITION" ? parse(input.then, depth + 1) : [],
          else: type === "CONDITION" ? parse(input.else, depth + 1) : [],
        },
      ];
    });

  const steps = parse(value, 0);
  if (!error && countSteps(steps) > FLOW_LIMITS.maxSteps) error = `No máximo ${FLOW_LIMITS.maxSteps} passos por fluxo`;
  if (!error && steps.length === 0) error = "Adicione ao menos um passo";
  return { steps, error };
}

/** Saved step, as the engine walks it. */
export type FlowNode = { id: string; parentId: string | null; branch: Branch | null; order: number };

const siblings = <T extends FlowNode>(steps: T[], parentId: string | null, branch: Branch | null) =>
  steps.filter((s) => s.parentId === parentId && s.branch === branch).sort((a, b) => a.order - b.order);

/** First step of the flow (no args) or of a branch of a condition. */
export const firstStep = <T extends FlowNode>(steps: T[], parentId: string | null = null, branch: Branch | null = null) =>
  siblings(steps, parentId, branch)[0] ?? null;

/** Step that runs after `step` (and after its branches): the next sibling, else the one after its parent condition. */
export function nextAfter<T extends FlowNode>(steps: T[], step: T): T | null {
  let current: T | null = step;
  while (current) {
    const list = siblings(steps, current.parentId, current.branch);
    const next = list[list.findIndex((s) => s.id === current!.id) + 1];
    if (next) return next;
    const parentId: string | null = current.parentId;
    current = parentId ? steps.find((s) => s.id === parentId) ?? null : null;
  }
  return null;
}

/** "Esperar 1 minutos" / action label / "Condição": shown in the editor and kept in the run log. */
export function stepLabel(step: { type: StepType; waitAmount?: number | null; waitUnit?: DelayUnit | null }, action?: { name?: string; actionType: ActionType } | null) {
  if (step.type === "WAIT") return `Esperar ${step.waitAmount ?? 0} ${DELAY_UNITS[step.waitUnit ?? "MINUTES"].label}`;
  if (step.type === "CONDITION") return "Condição";
  return action?.name?.trim() || (action ? ACTION_TYPES[action.actionType].label : "Ação");
}

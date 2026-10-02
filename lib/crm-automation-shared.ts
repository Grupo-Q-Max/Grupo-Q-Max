/*
 * Types and labels shared by the automation engine (server) and the
 * automation board (client). Must not import server-only modules.
 */

export type DelayUnit = "MINUTES" | "HOURS" | "DAYS";
export type HttpMethod = "GET" | "POST";
export type ConditionOperator = "eq" | "neq" | "contains" | "empty" | "notEmpty" | "gt" | "lt";
export type TriggerType = "WEBHOOK_IN" | "FIELD_CHANGED" | "ACTIVITY_COMPLETED" | "DEAL_CREATED";
export type ActivityType = "TODO" | "TASK" | "CALL" | "MEETING" | "COMMENT";

export type AutomationCondition = { field: string; operator: ConditionOperator; value: string | null };
export type WebhookHeader = { key: string; value: string };

export const DELAY_UNITS: Record<DelayUnit, { label: string; ms: number }> = {
  MINUTES: { label: "minutos", ms: 60_000 },
  HOURS: { label: "horas", ms: 3_600_000 },
  DAYS: { label: "dias", ms: 86_400_000 },
};

export const isDelayUnit = (value: unknown): value is DelayUnit => typeof value === "string" && value in DELAY_UNITS;

export const delayMs = (amount: number, unit: DelayUnit) => Math.max(0, amount) * DELAY_UNITS[unit].ms;

export const describeDelay = (amount: number, unit: DelayUnit) =>
  amount > 0 ? `após ${amount} ${DELAY_UNITS[unit].label}` : "imediatamente";

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

/** Replaces {{deal.title}}-style placeholders with the deal's values (URL-encoded when `encode`). */
export const fillPlaceholders = (template: string, ctx: DealContext, encode = false) =>
  template.replace(/\{\{\s*deal\.([\w.-]+)\s*\}\}/g, (_, key: string) =>
    encode ? encodeURIComponent(ctx[key] ?? "") : ctx[key] ?? ""
  );

export const TRIGGER_TYPES: Record<TriggerType, { label: string; description: string }> = {
  WEBHOOK_IN: { label: "Webhook de entrada", description: "Uma chamada externa à URL do gatilho move o negócio" },
  FIELD_CHANGED: { label: "Campo alterado", description: "Quando um campo do negócio é alterado" },
  ACTIVITY_COMPLETED: { label: "Atividade concluída", description: "Quando uma atividade do negócio é concluída" },
  DEAL_CREATED: { label: "Negócio criado", description: "Quando um negócio é criado no funil" },
};

export const isTriggerType = (value: unknown): value is TriggerType => typeof value === "string" && value in TRIGGER_TYPES;

export const ACTIVITY_TYPES: Partial<Record<ActivityType, string>> = {
  TODO: "A fazer",
  TASK: "Tarefa",
  CALL: "Ligação",
  MEETING: "Reunião",
};

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
  products: "Produtos",
  customData: "Campos adicionais",
};

export const RUN_STATUS_LABELS: Record<string, string> = {
  PENDING: "Agendada",
  RUNNING: "Executando",
  SUCCESS: "Sucesso",
  FAILED: "Falhou",
  SKIPPED: "Ignorada",
};

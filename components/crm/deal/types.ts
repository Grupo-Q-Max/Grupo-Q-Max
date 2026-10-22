/** `id` is set when the contact/company already exists (they are shared between deals). */
export type DealContact = { id?: string; name: string; phone: string; email: string; address: string; info: string };
export type DealCompany = { id?: string; name: string; document: string; phone: string; email: string; address: string; info: string };
export type DealProduct = { id: string; productId: string | null; name: string; description: string | null; price: number; quantity: number };

export type CustomFieldConfig = { id: string; name: string; type: string; required?: boolean };

export type DealActivity = {
  id: string;
  type: "TODO" | "TASK" | "CALL" | "MEETING" | "COMMENT";
  title: string;
  description: string | null;
  deadline: string | null;
  responsibleId: string | null;
  /** Who wrote it; null = before authors were kept */
  authorId: string | null;
  completed: boolean;
  completedAt: string | null;
  createdAt: string;
};

export type DealHistory = {
  id: string;
  type:
    | "CREATED"
    | "STAGE_CHANGED"
    | "FIELD_CHANGED"
    | "STATUS_CHANGED"
    | "RECURRENCE_CREATED"
    | "AUTOMATION_RUN"
    | "TRIGGER_FIRED"
    | "STATE_RESTORED";
  data: Record<string, string | null> | null;
  /** Who made the change; null = automation, trigger or older entry */
  actorId: string | null;
  createdAt: string;
};

export type SubtaskCard = { id: string; number: number; title: string; status: "OPEN" | "WON" | "LOST"; responsibleId: string | null; closeDate: string | null };

/** Time tracked on the card; endedAt null = timer running. */
export type TimeEntry = { id: string; memberId: string | null; startedAt: string; endedAt: string | null; minutes: number };

export type DealDetails = {
  id: string;
  number: number;
  title: string;
  company: DealCompany | null;
  value: number;
  currency: string;
  status: "OPEN" | "WON" | "LOST";
  /** Filled while status is LOST */
  lostReason: string | null;
  stageId: string;
  startDate: string | null;
  closeDate: string | null;
  contacts: DealContact[];
  dealType: string | null;
  source: string | null;
  sourceInfo: string | null;
  referredBy: string | null;
  isPublic: boolean;
  responsibleId: string | null;
  observers: string[];
  /** Co-assignees besides the main responsible ("Corresponsáveis") */
  assignees: string[];
  comment: string | null;
  utm: Record<string, string> | null;
  products: DealProduct[];
  recurrence: string;
  priority: Priority | null;
  /** Tag ids */
  tags: string[];
  /** "Bloqueada por": cards that must be done first */
  blockedBy: BlockerCard[];
  /** "Bloqueia": cards that wait for this one (read-only, set on their side) */
  blocks: BlockerCard[];
  customData: Record<string, string> | null;
  /** "HH:MM" the task is due on closeDate (Brazilian time) */
  dueTime: string | null;
  /** Minutes before closeDate + dueTime to remind the responsible */
  reminderMinutes: number | null;
  /** Repeat every N (null = 1) */
  recurrenceInterval: number | null;
  /** WEEKLY: weekdays bitmask, 1 = Sunday … 64 = Saturday */
  recurrenceWeekdays: number | null;
  estimateMinutes: number | null;
  /** Sum of the finished time entries (read-only) */
  spentMinutes: number | null;
  parentId: string | null;
  parent: { id: string; number: number; title: string } | null;
  subtasks: SubtaskCard[];
  timeEntries: TimeEntry[];
  archivedAt: string | null;
  isTemplate: boolean;
  createdAt: string;
  updatedAt: string;
  activities: DealActivity[];
  history: DealHistory[];
  /** Restore points: the deal's state when it left each stage. */
  stageSnapshots: { stageId: string; savedAt: string; data: Omit<DealDraft, "products" | "blockedBy"> & { products: Omit<DealProduct, "id">[]; blockedBy?: string[] } }[];
  pipeline: { id: string; kind: "DEALS" | "TASKS"; fieldsConfig: CustomFieldConfig[] | null; stages: { id: string; name: string }[] };
};

/** Fields edited in the "Geral" form and saved together by SALVAR. */
export type DealDraft = Pick<
  DealDetails,
  | "title"
  | "company"
  | "value"
  | "currency"
  | "startDate"
  | "closeDate"
  | "contacts"
  | "dealType"
  | "source"
  | "sourceInfo"
  | "referredBy"
  | "isPublic"
  | "responsibleId"
  | "observers"
  | "assignees"
  | "comment"
  | "products"
  | "recurrence"
  | "priority"
  | "tags"
  | "blockedBy"
  | "estimateMinutes"
  | "dueTime"
  | "reminderMinutes"
  | "recurrenceInterval"
  | "recurrenceWeekdays"
  | "customData"
>;

export type BlockerCard = { id: string; number: number; title: string; status: "OPEN" | "WON" | "LOST" };

export type TeamMember = { id: string; name: string; role: string; image: string | null };

export const CURRENCIES = [
  { value: "BRL", label: "Real brasileiro", symbol: "R$" },
  { value: "USD", label: "Dólar americano", symbol: "US$" },
  { value: "EUR", label: "Euro", symbol: "€" },
];

export const SOURCES = [
  "Chamada",
  "E-mail",
  "Site",
  "WhatsApp",
  "Rede social",
  "Publicidade",
  "Cliente existente",
  "Por recomendação",
  "Exposição / Evento",
  "Outro",
];

export const DEAL_TYPES = ["Vendas", "Serviços", "Venda de produtos", "Pós-venda", "Contabilidade", "Auditoria"];

export const RECURRENCES = [
  { value: "NONE", label: "Não criar novamente" },
  { value: "DAILY", label: "Todo dia" },
  { value: "WEEKLY", label: "Toda semana" },
  { value: "MONTHLY", label: "Todo mês" },
  { value: "YEARLY", label: "Todo ano" },
];

export const ACTIVITY_LABELS: Record<DealActivity["type"], string> = {
  TODO: "Atividade",
  TASK: "Tarefa",
  CALL: "Chamada",
  MEETING: "Reunião",
  COMMENT: "Comentário",
};

export const emptyContact = (): DealContact => ({ name: "", phone: "", email: "", address: "", info: "" });
export const emptyCompany = (): DealCompany => ({ name: "", document: "", phone: "", email: "", address: "", info: "" });

export function formatMoney(value: number, currency = "BRL") {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency });
}

export const productsTotal = (products: DealProduct[]) =>
  products.reduce((sum, p) => sum + (Number(p.price) || 0) * (Number(p.quantity) || 0), 0);

/** "2026-02-13T00:00:00.000Z" → "2026-02-13" for <input type="date"> */
export const toDateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

/** ISO → "2026-02-13T14:30" in local time for <input type="datetime-local"> */
export function toDateTimeInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function pickDraft(deal: DealDetails): DealDraft {
  return {
    title: deal.title,
    company: deal.company,
    value: deal.value,
    currency: deal.currency,
    startDate: deal.startDate,
    closeDate: deal.closeDate,
    contacts: deal.contacts,
    dealType: deal.dealType,
    source: deal.source,
    sourceInfo: deal.sourceInfo,
    referredBy: deal.referredBy,
    isPublic: deal.isPublic,
    responsibleId: deal.responsibleId,
    observers: deal.observers,
    assignees: deal.assignees,
    comment: deal.comment,
    products: deal.products,
    recurrence: deal.recurrence,
    priority: deal.priority,
    tags: deal.tags,
    blockedBy: deal.blockedBy,
    estimateMinutes: deal.estimateMinutes,
    dueTime: deal.dueTime,
    reminderMinutes: deal.reminderMinutes,
    recurrenceInterval: deal.recurrenceInterval,
    recurrenceWeekdays: deal.recurrenceWeekdays,
    customData: deal.customData,
  };
}

export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

/** Lowest to highest; the index is the sort weight. */
export const PRIORITIES: { value: Priority; label: string }[] = [
  { value: "LOW", label: "Baixa" },
  { value: "MEDIUM", label: "Média" },
  { value: "HIGH", label: "Alta" },
  { value: "URGENT", label: "Urgente" },
];

export const priorityLabel = (value: string | null | undefined) => PRIORITIES.find((p) => p.value === value)?.label ?? null;

export type CrmTagDto = { id: string; name: string; color: string };

/** 90 → "1h30", 45 → "45min", 120 → "2h"; null for no value. */
/** Card fields a column can require before a manual move into it (CrmStage.requiredFields); keys are CrmCard columns */
export const REQUIRED_FIELDS = {
  responsibleId: "Responsável",
  closeDate: "Prazo",
  startDate: "Data de início",
  estimateMinutes: "Estimativa",
  priority: "Prioridade",
} as const;
export type RequiredField = keyof typeof REQUIRED_FIELDS;

/** Valid keys of a stored requiredFields value (unknown or malformed entries dropped) */
export const requiredFieldsOf = (value: unknown): RequiredField[] =>
  Array.isArray(value) ? value.filter((f): f is RequiredField => typeof f === "string" && Object.hasOwn(REQUIRED_FIELDS, f)) : [];

export function formatMinutes(minutes: number | null | undefined) {
  if (minutes === null || minutes === undefined) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m}min`;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

/** "1h30", "1:30", "1,5h", "90", "90min", "2h" → minutes; null when blank or unreadable. */
export function parseMinutes(text: string) {
  const t = text.trim().toLowerCase().replace(",", ".").replace(/\s+/g, "");
  if (!t) return null;
  const hm = t.match(/^(\d+(?:\.\d+)?)h(?:(\d{1,2})(?:min|m)?)?$/) ?? t.match(/^(\d+):(\d{1,2})$/);
  if (hm) return Math.round(Number(hm[1]) * 60) + Number(hm[2] ?? 0);
  const m = t.match(/^(\d+)(?:min|m)?$/);
  return m ? Number(m[1]) : null;
}

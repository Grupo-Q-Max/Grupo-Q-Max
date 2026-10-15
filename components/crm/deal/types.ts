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
  createdAt: string;
};

export type DealDetails = {
  id: string;
  number: number;
  title: string;
  company: DealCompany | null;
  value: number;
  currency: string;
  status: "OPEN" | "WON" | "LOST";
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
  comment: string | null;
  utm: Record<string, string> | null;
  products: DealProduct[];
  recurrence: string;
  customData: Record<string, string> | null;
  createdAt: string;
  updatedAt: string;
  activities: DealActivity[];
  history: DealHistory[];
  /** Restore points: the deal's state when it left each stage. */
  stageSnapshots: { stageId: string; savedAt: string; data: Omit<DealDraft, "products"> & { products: Omit<DealProduct, "id">[] } }[];
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
  | "comment"
  | "products"
  | "recurrence"
  | "customData"
>;

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
    comment: deal.comment,
    products: deal.products,
    recurrence: deal.recurrence,
    customData: deal.customData,
  };
}

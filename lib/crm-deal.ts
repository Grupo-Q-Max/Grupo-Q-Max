import { Prisma, type CrmDealStatus, type CrmPriority, type CrmRecurrence } from "@prisma/client";
import { RECURRENCES as RECURRENCE_OPTIONS, formatMinutes, priorityLabel } from "@/components/crm/deal/types";
import { prisma } from "@/lib/prisma";
import { isDueTime, nextOccurrence, weekdayNames } from "@/lib/crm-due";

type Tx = Prisma.TransactionClient;

// ---------------------------------------------------------------------------
// Kanban list
// ---------------------------------------------------------------------------

/** Cards that show on boards, lists, reports and reminders (archived ones and templates stay out). */
export const activeCard = { archivedAt: null, isTemplate: false } satisfies Prisma.CrmCardWhereInput;

/**
 * What the kanban card needs: company, main contact, responsible, tags and the card's activities
 * (reduced by serializeListCard to the next pending one, the pending count and the checklist count).
 */
export const cardListInclude = {
  company: { select: { name: true } },
  contacts: { orderBy: { order: "asc" }, take: 1, select: { contact: { select: { name: true } } } },
  responsible: { select: { id: true, name: true, role: true, photo: true } },
  assignees: { select: { member: { select: { id: true, name: true, role: true, photo: true } } } },
  // ponytail: loads every activity of the card; fine while cards hold a handful, aggregate in SQL if that grows
  activities: {
    where: { type: { not: "COMMENT" } },
    orderBy: [{ deadline: "asc" }, { createdAt: "asc" }],
    select: { id: true, title: true, deadline: true, type: true, completed: true },
  },
  tags: { select: { tag: { select: { id: true, name: true, color: true } } } },
  // Open blockers only: a card is "Bloqueada" while one of them is not done
  blockedBy: { where: { blockedBy: { status: "OPEN" } }, select: { blockedById: true } },
  subtasks: { where: activeCard, select: { status: true } },
  parent: { select: { number: true, title: true } },
  // Running timers: the card shows play/stop for the viewer
  timeEntries: { where: { endedAt: null }, select: { memberId: true, startedAt: true } },
} satisfies Prisma.CrmCardInclude;

type ListCard = Prisma.CrmCardGetPayload<{ include: typeof cardListInclude }>;

/** Flattens relations and converts Decimal so the card can cross the server → client boundary. */
export function serializeListCard({ company, contacts, responsible, assignees, tags, activities, blockedBy, subtasks, timeEntries, ...card }: ListCard) {
  const pending = activities.filter((a) => !a.completed);
  const checklist = activities.filter((a) => a.type === "TODO");
  return {
    ...card,
    value: card.value.toNumber(),
    company: company?.name ?? null,
    contactName: contacts[0]?.contact.name ?? null,
    responsible: responsible && { id: responsible.id, name: responsible.name, role: responsible.role, image: responsible.photo },
    assignees: assignees.map(({ member: m }) => ({ id: m.id, name: m.name, role: m.role, image: m.photo })),
    tags: tags.map((t) => t.tag),
    activities: pending.slice(0, 1).map(({ completed: _, ...a }) => a),
    _count: { activities: pending.length },
    checklist: { done: checklist.filter((a) => a.completed).length, total: checklist.length },
    blocked: blockedBy.length > 0,
    subtasks: { done: subtasks.filter((s) => s.status === "WON").length, total: subtasks.length },
    runningTimers: timeEntries,
  };
}

// ---------------------------------------------------------------------------
// Deal details (panel)
// ---------------------------------------------------------------------------

const dealDetailsInclude = {
  company: true,
  contacts: { orderBy: { order: "asc" }, include: { contact: true } },
  observers: { select: { memberId: true } },
  assignees: { select: { memberId: true } },
  tags: { select: { tagId: true } },
  blockedBy: { orderBy: { createdAt: "asc" }, select: { blockedBy: { select: { id: true, number: true, title: true, status: true } } } },
  // "Bloqueia": the reverse side, active cards that wait for this one
  blocks: { where: { card: activeCard }, orderBy: { createdAt: "asc" }, select: { card: { select: { id: true, number: true, title: true, status: true } } } },
  parent: { select: { id: true, number: true, title: true } },
  subtasks: {
    where: activeCard,
    orderBy: { createdAt: "asc" },
    select: { id: true, number: true, title: true, status: true, responsibleId: true, closeDate: true },
  },
  timeEntries: { orderBy: { startedAt: "desc" }, select: { id: true, memberId: true, startedAt: true, endedAt: true, minutes: true } },
  products: { orderBy: { order: "asc" } },
  activities: { orderBy: { createdAt: "desc" } },
  history: { orderBy: { createdAt: "desc" } },
  stageSnapshots: { select: { stageId: true, savedAt: true, data: true } },
  stage: {
    select: {
      pipeline: {
        select: {
          id: true,
          kind: true,
          fieldsConfig: true,
          stages: { orderBy: { order: "asc" }, select: { id: true, name: true } },
        },
      },
    },
  },
} satisfies Prisma.CrmCardInclude;

type DealRow = Prisma.CrmCardGetPayload<{ include: typeof dealDetailsInclude }>;

const toDto = (row: DealRow) => {
  const { stage, company, contacts, observers, assignees, products, tags, blockedBy, blocks, ...deal } = row;
  return {
    ...deal,
    value: deal.value.toNumber(),
    company: company && {
      id: company.id,
      name: company.name,
      document: company.document ?? "",
      phone: company.phone ?? "",
      email: company.email ?? "",
      address: company.address ?? "",
      info: company.info ?? "",
    },
    contacts: contacts.map(({ contact }) => ({
      id: contact.id,
      name: contact.name,
      phone: contact.phone ?? "",
      email: contact.email ?? "",
      address: contact.address ?? "",
      info: contact.info ?? "",
    })),
    observers: observers.map((o) => o.memberId),
    assignees: assignees.map((a) => a.memberId),
    tags: tags.map((t) => t.tagId),
    blockedBy: blockedBy.map((d) => d.blockedBy),
    blocks: blocks.map((d) => d.card),
    products: products.map((p) => ({
      id: p.id,
      productId: p.productId,
      name: p.name,
      description: p.description,
      price: p.price.toNumber(),
      quantity: p.quantity,
    })),
    pipeline: stage.pipeline,
  };
};

export type DealDto = ReturnType<typeof toDto>;

export async function getDealDetails(id: string, tx: Tx = prisma) {
  const row = await tx.crmCard.findUnique({ where: { id }, include: dealDetailsInclude });
  return row && toDto(row);
}

// ---------------------------------------------------------------------------
// Stage snapshots (restore points)
// ---------------------------------------------------------------------------

/** The deal panel fields (DealDraft) — everything needed to rebuild the deal's state. */
function snapshotOf(dto: DealDto) {
  return {
    title: dto.title,
    value: dto.value,
    currency: dto.currency,
    startDate: dto.startDate,
    closeDate: dto.closeDate,
    dealType: dto.dealType,
    source: dto.source,
    sourceInfo: dto.sourceInfo,
    referredBy: dto.referredBy,
    isPublic: dto.isPublic,
    responsibleId: dto.responsibleId,
    comment: dto.comment,
    recurrence: dto.recurrence,
    recurrenceInterval: dto.recurrenceInterval,
    recurrenceWeekdays: dto.recurrenceWeekdays,
    priority: dto.priority,
    dueTime: dto.dueTime,
    reminderMinutes: dto.reminderMinutes,
    estimateMinutes: dto.estimateMinutes,
    tags: dto.tags,
    blockedBy: dto.blockedBy.map((c) => c.id),
    customData: dto.customData,
    company: dto.company,
    contacts: dto.contacts,
    observers: dto.observers,
    assignees: dto.assignees,
    products: dto.products.map(({ id: _id, ...line }) => line),
  };
}

type Snapshot = ReturnType<typeof snapshotOf>;

/** Saves the deal's state as the restore point of the stage it is leaving. */
async function saveStageSnapshot(tx: Tx, dealId: string, stageId: string, dto?: DealDto | null) {
  const state = dto ?? (await getDealDetails(dealId, tx));
  if (!state) return;
  const data = JSON.parse(JSON.stringify(snapshotOf(state))) as Prisma.InputJsonObject;
  await tx.crmDealStageSnapshot.upsert({
    where: { dealId_stageId: { dealId, stageId } },
    create: { dealId, stageId, data },
    update: { data },
  });
}

/** Stage move used by the kanban drag and the stage triggers: snapshots the stage being left. */
export async function snapshotBeforeMove(tx: Tx, dealId: string, fromStageId: string, toStageId: string) {
  if (fromStageId !== toStageId) await saveStageSnapshot(tx, dealId, fromStageId);
}

/**
 * Changes for updateDeal that bring the deal back to its state when it left `stageId`.
 * Company and contacts are shared between deals: they are relinked with their current
 * registry data, never rewritten. Removed team members are dropped.
 */
export async function restoreChanges(dealId: string, stageId: string) {
  const row = await prisma.crmDealStageSnapshot.findUnique({
    where: { dealId_stageId: { dealId, stageId } },
    include: { stage: { select: { name: true } } },
  });
  if (!row) throw new DealValidationError("Nenhum estado salvo para esta etapa");
  const snap = row.data as unknown as Snapshot;

  const company = snap.company?.id ? await prisma.crmCompany.findUnique({ where: { id: snap.company.id } }) : null;
  const contactIds = snap.contacts.flatMap((c) => (c.id ? [c.id] : []));
  const contacts = await prisma.crmContact.findMany({ where: { id: { in: contactIds } } });
  const memberIds = [...snap.observers, ...(snap.assignees ?? []), snap.responsibleId].filter(Boolean) as string[];
  const members = new Set((await prisma.teamMember.findMany({ where: { id: { in: memberIds } }, select: { id: true } })).map((m) => m.id));

  // Linked record still exists: keep its current data; otherwise the saved data recreates it
  type Registry = { name: string; phone: string | null; email: string | null; address: string | null; info: string | null; document?: string | null };
  const current = <T extends { id?: string }>(saved: T, found: Registry | null | undefined) =>
    found
      ? {
          ...saved,
          name: found.name,
          phone: found.phone ?? "",
          email: found.email ?? "",
          address: found.address ?? "",
          info: found.info ?? "",
          ...(found.document !== undefined && { document: found.document ?? "" }),
        }
      : { ...saved, id: undefined };

  return {
    stage: row.stage.name,
    changes: {
      ...snap,
      company: snap.company && current(snap.company, company),
      contacts: snap.contacts.map((c) => current(c, contacts.find((x) => x.id === c.id))),
      observers: snap.observers.filter((id) => members.has(id)),
      // Snapshots saved before co-assignees existed keep the current ones (undefined = unchanged)
      assignees: snap.assignees?.filter((id) => members.has(id)),
      responsibleId: snap.responsibleId && members.has(snap.responsibleId) ? snap.responsibleId : null,
    },
  };
}

// ---------------------------------------------------------------------------
// Updates
// ---------------------------------------------------------------------------

type CompanyInput = { id?: string; name: string; document?: string; phone?: string; email?: string; address?: string; info?: string };
type ContactInput = { id?: string; name: string; phone?: string; email?: string; address?: string; info?: string };
type ProductInput = { productId?: string | null; name: string; description?: string | null; price: number; quantity: number };

const blankToNull = (value: unknown) => {
  const text = typeof value === "string" ? value.trim() : value;
  return text === "" || text === undefined ? null : (text as string | null);
};

const toDateOnly = (value: unknown) => (value ? new Date(String(value).slice(0, 10)) : null);

/** Scalar columns editable from the panel, with the label used in the timeline. */
export const SCALAR_FIELDS = {
  title: "Nome",
  value: "Valor",
  currency: "Moeda",
  startDate: "Data de início",
  closeDate: "Data de término",
  dealType: "Tipo de negócio",
  source: "Fonte",
  sourceInfo: "Informações da fonte",
  referredBy: "Quem trouxe o lead",
  isPublic: "Disponível para todos",
  responsibleId: "Responsável",
  comment: "Comentário",
  recurrence: "Recorrência",
  priority: "Prioridade",
  dueTime: "Hora do prazo",
  reminderMinutes: "Lembrete antes do prazo",
  recurrenceInterval: "Repetir a cada",
  recurrenceWeekdays: "Dias da semana",
  estimateMinutes: "Estimativa",
  customData: "Campos adicionais",
} as const;

export const RELATION_FIELDS = {
  company: "Empresa",
  contacts: "Contatos",
  observers: "Observadores",
  assignees: "Corresponsáveis",
  products: "Serviços",
  tags: "Etiquetas",
  blockedBy: "Bloqueada por",
} as const;

type ScalarField = keyof typeof SCALAR_FIELDS;
type RelationField = keyof typeof RELATION_FIELDS;

const RECURRENCES = new Set<CrmRecurrence>(["NONE", "DAILY", "WEEKLY", "MONTHLY", "YEARLY"]);
export const STATUSES = new Set<CrmDealStatus>(["OPEN", "WON", "LOST"]);
const PRIORITY_VALUES = new Set<CrmPriority>(["LOW", "MEDIUM", "HIGH", "URGENT"]);

function parseScalar(field: ScalarField, value: unknown) {
  switch (field) {
    case "title":
      return String(value ?? "").trim();
    case "value":
      return Number(value) || 0;
    case "currency":
      return String(value || "BRL").slice(0, 3).toUpperCase();
    case "startDate":
    case "closeDate":
      return toDateOnly(value);
    case "isPublic":
      return Boolean(value);
    case "recurrence":
      return RECURRENCES.has(value as CrmRecurrence) ? value : "NONE";
    case "priority":
      return PRIORITY_VALUES.has(value as CrmPriority) ? value : null;
    case "customData":
      return value && typeof value === "object" ? value : null;
    case "referredBy":
      return blankToNull(value)?.slice(0, 200) ?? null;
    case "estimateMinutes":
    case "reminderMinutes": {
      // Whole minutes, up to a year; anything else clears the field
      const minutes = Math.round(Number(value));
      return value !== null && value !== "" && Number.isFinite(minutes) && minutes >= 0 ? Math.min(minutes, 525_600) : null;
    }
    case "dueTime":
      return isDueTime(value) ? value : null;
    case "recurrenceInterval": {
      const n = Math.round(Number(value));
      return value !== null && value !== "" && Number.isFinite(n) && n > 1 ? Math.min(n, 365) : null;
    }
    case "recurrenceWeekdays": {
      const mask = Math.round(Number(value));
      return Number.isInteger(mask) && mask > 0 && mask < 128 ? mask : null;
    }
    default:
      return blankToNull(value);
  }
}

/** Comparable representation, so null, dates and JSON compare by content. */
function comparable(value: unknown): string | null {
  if (value === "" || value === undefined || value === null) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (value instanceof Prisma.Decimal) return String(value.toNumber());
  if (typeof value === "number") return String(value);
  return JSON.stringify(value);
}

/** Text shown in the timeline; null for values that only make sense as "alterado". */
function displayScalar(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (value instanceof Prisma.Decimal) return String(value.toNumber());
  if (typeof value === "object") return null;
  return String(value);
}

type HistoryEntry = Prisma.CrmHistoryCreateManyCardInput;

/**
 * Applies a partial update coming from the deal panel. Scalar columns are set
 * directly; relations (company, contacts, observers, products) are synced into
 * their own tables. Returns the timeline entries for every real change.
 */
export async function applyDealChanges(tx: Tx, dealId: string, changes: Record<string, unknown>) {
  const current = await tx.crmCard.findUniqueOrThrow({ where: { id: dealId }, include: dealDetailsInclude });
  const currentDto = toDto(current);
  const data: Prisma.CrmCardUncheckedUpdateInput = {};
  const history: HistoryEntry[] = [];

  for (const key of Object.keys(changes)) {
    if (!(key in SCALAR_FIELDS)) continue;
    const field = key as ScalarField;
    const next = parseScalar(field, changes[field]);
    if (comparable(next) === comparable(current[field])) continue;
    if (field === "title" && !next) {
      throw new DealValidationError(current.stage.pipeline.kind === "TASKS" ? "O título da tarefa é obrigatório" : "O nome do negócio é obrigatório");
    }

    (data as Record<string, unknown>)[field] = field === "customData" && next === null ? Prisma.DbNull : next;
    history.push(await fieldHistory(tx, field, SCALAR_FIELDS[field], current[field], next));
  }

  if ("archived" in changes && Boolean(changes.archived) !== Boolean(current.archivedAt)) {
    const archived = Boolean(changes.archived);
    data.archivedAt = archived ? new Date() : null;
    history.push({ type: "FIELD_CHANGED", data: { field: "archived", label: "Arquivado", from: archived ? "Não" : "Sim", to: archived ? "Sim" : "Não" } });
  }

  if ("parentId" in changes && (changes.parentId || null) !== current.parentId) {
    const parentId = typeof changes.parentId === "string" && changes.parentId ? changes.parentId : null;
    const parent = parentId ? await validParent(tx, dealId, parentId, current.stage.pipeline.id) : null;
    data.parentId = parentId;
    const label = (c: { number: number; title: string } | null) => (c ? `#${c.number} ${c.title}` : null);
    history.push({ type: "FIELD_CHANGED", data: { field: "parentId", label: "Subtarefa de", from: label(current.parent), to: label(parent) } });
  }

  for (const key of Object.keys(changes)) {
    if (!(key in RELATION_FIELDS)) continue;
    const field = key as RelationField;
    const label = RELATION_FIELDS[field];

    if (field === "company") {
      const companyId = await syncCompany(tx, changes.company as CompanyInput | null);
      const before = currentDto.company;
      const after = companyId ? await tx.crmCompany.findUnique({ where: { id: companyId } }) : null;
      const companyChanged = companyId !== current.companyId;
      const detailsChanged = !companyChanged && comparable(stripId(before)) !== comparable(stripId(changes.company as CompanyInput | null));
      if (companyChanged) data.companyId = companyId;
      if (companyChanged) {
        history.push({
          type: "FIELD_CHANGED",
          data: { field, label, from: before?.name ?? null, to: after?.name ?? null },
        });
      } else if (detailsChanged) {
        // Same company, only its data changed (shown as "alterado")
        history.push({ type: "FIELD_CHANGED", data: { field, label: `Dados da empresa ${after?.name ?? ""}`.trim() } });
      }
    }

    if (field === "contacts") {
      const input = ((changes.contacts as ContactInput[] | null) ?? []).filter((c) => c.name?.trim());
      if (comparable(currentDto.contacts.map(stripId)) === comparable(input.map(stripId))) continue;
      await syncContacts(tx, dealId, input);
      history.push({
        type: "FIELD_CHANGED",
        data: { field, label, from: names(currentDto.contacts), to: names(input) },
      });
    }

    if ((field === "observers" || field === "assignees") && changes[field] !== undefined) {
      const ids = [...new Set((changes[field] as string[] | null) ?? [])];
      if (comparable([...currentDto[field]].sort()) === comparable([...ids].sort())) continue;
      if (field === "observers") {
        await tx.crmDealObserver.deleteMany({ where: { dealId } });
        if (ids.length) await tx.crmDealObserver.createMany({ data: ids.map((memberId) => ({ dealId, memberId })) });
      } else {
        await tx.crmCardAssignee.deleteMany({ where: { cardId: dealId } });
        if (ids.length) await tx.crmCardAssignee.createMany({ data: ids.map((memberId) => ({ cardId: dealId, memberId })) });
      }
      const members = await tx.teamMember.findMany({ where: { id: { in: [...currentDto[field], ...ids] } } });
      const memberNames = (list: string[]) =>
        list.map((id) => members.find((m) => m.id === id)?.name).filter(Boolean).join(", ") || null;
      history.push({
        type: "FIELD_CHANGED",
        data: { field, label, from: memberNames(currentDto[field]), to: memberNames(ids) },
      });
    }

    if (field === "tags") {
      const requested = [...new Set((changes.tags as string[] | null) ?? [])];
      // Drops tags deleted meanwhile (e.g. restoring an old snapshot)
      const found = await tx.crmTag.findMany({ where: { id: { in: [...currentDto.tags, ...requested] } }, select: { id: true, name: true } });
      const ids = requested.filter((id) => found.some((t) => t.id === id));
      if (comparable([...currentDto.tags].sort()) === comparable([...ids].sort())) continue;
      await tx.crmCardTag.deleteMany({ where: { cardId: dealId } });
      if (ids.length) await tx.crmCardTag.createMany({ data: ids.map((tagId) => ({ cardId: dealId, tagId })) });
      const tagNames = (list: string[]) => list.map((id) => found.find((t) => t.id === id)?.name).filter(Boolean).join(", ") || null;
      history.push({ type: "FIELD_CHANGED", data: { field, label, from: tagNames(currentDto.tags), to: tagNames(ids) } });
    }

    if (field === "blockedBy") {
      // Ids or { id } items: active cards of the same pipeline, never the card itself nor one that waits for it
      const requested = [...new Set(((changes.blockedBy as (string | { id: string })[] | null) ?? []).map((x) => (typeof x === "string" ? x : x?.id)))];
      const waiting = await cardsWaitingFor(tx, dealId);
      const found = await tx.crmCard.findMany({
        where: {
          id: { in: requested.filter((id) => id && id !== dealId && !waiting.has(id)) },
          ...activeCard,
          stage: { pipelineId: current.stage.pipeline.id },
        },
        select: { id: true, number: true, title: true },
      });
      const before = currentDto.blockedBy.map((c) => c.id);
      const ids = requested.filter((id) => found.some((c) => c.id === id));
      if (comparable([...before].sort()) === comparable([...ids].sort())) continue;
      await tx.crmCardDependency.deleteMany({ where: { cardId: dealId } });
      if (ids.length) await tx.crmCardDependency.createMany({ data: ids.map((blockedById) => ({ cardId: dealId, blockedById })) });
      const label = (list: { number: number; title: string }[]) => list.map((c) => `#${c.number} ${c.title}`).join(", ") || null;
      history.push({ type: "FIELD_CHANGED", data: { field, label: RELATION_FIELDS.blockedBy, from: label(currentDto.blockedBy), to: label(ids.map((id) => found.find((c) => c.id === id)!)) } });
    }

    if (field === "products") {
      const input =((changes.products as ProductInput[] | null) ?? []).filter((p) => p.name?.trim());
      const normalize = (list: ProductInput[]) =>
        list.map((p) => ({
          name: p.name.trim(),
          description: p.description?.trim() || null,
          price: Number(p.price) || 0,
          quantity: Number(p.quantity) || 0,
        }));
      if (comparable(normalize(currentDto.products)) === comparable(normalize(input))) continue;
      await syncProducts(tx, dealId, input);
      history.push({ type: "FIELD_CHANGED", data: { field, label, from: names(currentDto.products), to: names(input) } });

      // With products, the deal value is the products total
      if (input.length > 0) {
        data.value = input.reduce((sum, p) => sum + (Number(p.price) || 0) * (Number(p.quantity) || 0), 0);
      }
    }
  }

  return { data, history, current };
}

/** Every card that waits for `cardId`, directly or through a chain of "Bloqueada por" (would close a cycle). */
async function cardsWaitingFor(tx: Tx, cardId: string) {
  const seen = new Set<string>();
  let frontier = [cardId];
  while (frontier.length) {
    const rows = await tx.crmCardDependency.findMany({ where: { blockedById: { in: frontier } }, select: { cardId: true } });
    frontier = rows.map((r) => r.cardId).filter((id) => !seen.has(id));
    frontier.forEach((id) => seen.add(id));
  }
  return seen;
}

/**
 * Parent for a subtask: an active card of the same pipeline that is not itself a subtask, and only
 * when `cardId` (null = a card being created) has no subtasks of its own. One level keeps cycles out.
 */
export async function validParent(tx: Tx, cardId: string | null, parentId: string, pipelineId: string) {
  const parent = await tx.crmCard.findFirst({
    where: { id: parentId, ...activeCard, parentId: null, stage: { pipelineId } },
    select: { id: true, number: true, title: true },
  });
  if (!parent || parent.id === cardId) throw new DealValidationError("Tarefa pai inválida: escolha uma tarefa ativa do mesmo quadro que não seja subtarefa.");
  if (cardId && (await tx.crmCard.count({ where: { parentId: cardId } }))) {
    throw new DealValidationError("Esta tarefa tem subtarefas e não pode virar subtarefa de outra.");
  }
  return parent;
}

export class DealValidationError extends Error {}

export type DuplicateDeal = { number: number; title: string; stage: string };

/** Thrown on create when an open deal already looks the same; the client may resend with `force`. */
export class DuplicateDealError extends Error {
  constructor(public deals: DuplicateDeal[]) {
    super("Possible duplicate deal");
  }
}

/**
 * Open deals of the pipeline with the same title, company, responsible and value.
 * A same-titled deal with another seller or value is a different sale, not a duplicate.
 * The title match relies on the column's case/accent-insensitive collation.
 */
export async function findDuplicateDeals(
  tx: Tx,
  d: { title: string; pipelineId: string; companyId: string | null; responsibleId: string | null; value: number }
): Promise<DuplicateDeal[]> {
  const rows = await tx.crmCard.findMany({
    where: {
      title: d.title,
      status: "OPEN",
      ...activeCard,
      stage: { pipelineId: d.pipelineId },
      companyId: d.companyId,
      responsibleId: d.responsibleId,
      value: d.value,
    },
    orderBy: { number: "asc" },
    take: 5,
    select: { number: true, title: true, stage: { select: { name: true } } },
  });
  return rows.map((r) => ({ number: r.number, title: r.title, stage: r.stage.name }));
}

/**
 * Task boards have no Ganho/Perdido: their last column means "done", so entering it closes the
 * task (WON) and leaving it reopens it (OPEN). Null on deal boards, where the status is set by hand.
 */
export async function taskStatusForStage(tx: Tx, stageId: string): Promise<CrmDealStatus | null> {
  const stage = await tx.crmStage.findUnique({ where: { id: stageId }, select: { pipelineId: true, pipeline: { select: { kind: true } } } });
  if (stage?.pipeline.kind !== "TASKS") return null;
  const last = await tx.crmStage.findFirst({ where: { pipelineId: stage.pipelineId }, orderBy: { order: "desc" }, select: { id: true } });
  return last?.id === stageId ? "WON" : "OPEN";
}

/**
 * Re-applies the "last column = done" rule to every card of a task pipeline, after its columns were
 * added, removed or reordered, or the pipeline became a task board. No-op on deal boards.
 */
export async function resyncTaskStatuses(tx: Tx, pipelineId: string) {
  const pipeline = await tx.crmPipeline.findUnique({
    where: { id: pipelineId },
    select: { kind: true, stages: { orderBy: { order: "desc" }, take: 1, select: { id: true } } },
  });
  const last = pipeline?.stages[0]?.id;
  if (pipeline?.kind !== "TASKS" || !last) return;
  // ponytail: bulk update without history entries or recurring copies; a column edit is not a task being done.
  // closedAt is kept when reopening (reports only read it with status WON), so moving the column back restores the date.
  await tx.crmCard.updateMany({ where: { stage: { pipelineId }, stageId: { not: last }, status: { not: "OPEN" } }, data: { status: "OPEN" } });
  await tx.crmCard.updateMany({ where: { stageId: last, status: { not: "WON" }, closedAt: { not: null } }, data: { status: "WON" } });
  await tx.crmCard.updateMany({ where: { stageId: last, status: { not: "WON" } }, data: { status: "WON", closedAt: new Date() } });
}

/**
 * taskStatusForStage for moves that bypass updateDeal (kanban drag, automation triggers), after the
 * card moved. Returns the recurring copy created by closing the task, if any.
 */
export async function syncTaskStatus(tx: Tx, cardId: string, actorId: string | null = null) {
  const card = await tx.crmCard.findUniqueOrThrow({ where: { id: cardId }, select: { stageId: true, status: true } });
  const status = await taskStatusForStage(tx, card.stageId);
  if (!status || status === card.status) return null;
  await tx.crmCard.update({
    where: { id: cardId },
    data: {
      status,
      closedAt: status === "OPEN" ? null : new Date(),
      history: { create: { type: "STATUS_CHANGED", data: { from: card.status, to: status }, actorId } },
    },
  });
  return status === "WON" ? createRecurringCopy(tx, cardId) : null;
}

/**
 * Full deal update (deal panel and "Modificar negócio" automation): fields
 * from applyDealChanges plus `stageId` and `status`, all recorded in the
 * history. Running the new stage's rules / "campo alterado" triggers is left
 * to the caller (lib/crm-automation imports this module).
 */
export async function updateDeal(
  id: string,
  { stageId, status, ...changes }: { stageId?: string | null; status?: string | null } & Record<string, unknown>,
  {
    note,
    actorId = null,
    lostReason = null,
  }: {
    /** Extra timeline entry recorded when something changed (e.g. "informações restauradas"). */
    note?: HistoryEntry;
    /** Team member making the change (null = automation, trigger, QXBACK) */
    actorId?: string | null;
    /** Saved when the status becomes LOST (the deal panel requires it; automations may leave it empty) */
    lostReason?: string | null;
  } = {}
) {
  if (status && !STATUSES.has(status as CrmDealStatus)) throw new DealValidationError("Status inválido");

  return prisma.$transaction(async (tx) => {
    const { data, history, current } = await applyDealChanges(tx, id, changes);

    if (stageId && stageId !== current.stageId) {
      const [from, to] = await Promise.all([
        tx.crmStage.findUniqueOrThrow({ where: { id: current.stageId } }),
        tx.crmStage.findUnique({ where: { id: stageId } }),
      ]);
      if (!to || to.pipelineId !== from.pipelineId) throw new DealValidationError("Etapa inválida");

      // `current` was read before the changes above: the state the deal had in the stage it leaves
      await saveStageSnapshot(tx, id, from.id, toDto(current));
      data.stageId = to.id;
      data.order = await tx.crmCard.count({ where: { stageId: to.id } });
      history.push({ type: "STAGE_CHANGED", data: { from: from.name, to: to.name } });
      status = (await taskStatusForStage(tx, to.id)) ?? status;
    }

    if (status && status !== current.status) {
      data.status = status as CrmDealStatus;
      data.closedAt = status === "OPEN" ? null : new Date();
      data.lostReason = status === "LOST" ? lostReason?.trim().slice(0, 500) || null : null;
      history.push({ type: "STATUS_CHANGED", data: { from: current.status, to: status, ...(data.lostReason ? { reason: data.lostReason } : {}) } });
    }

    if (note && history.length > 0) history.unshift(note);

    let recurringCopy = null;
    if (history.length > 0) {
      await tx.crmCard.update({ where: { id }, data: { ...data, history: { createMany: { data: history.map((h) => ({ ...h, actorId })) } } } });
      if (data.status === "WON") recurringCopy = await createRecurringCopy(tx, id);
    }

    const changedFields = history.flatMap((h) =>
      h.type === "STATUS_CHANGED" ? ["status"] : h.type === "FIELD_CHANGED" ? [(h.data as { field?: string }).field ?? ""] : []
    );
    return {
      changed: history.length > 0,
      history,
      stageId: current.stageId,
      movedTo: typeof data.stageId === "string" ? data.stageId : null,
      changedFields: changedFields.filter(Boolean),
      recurringCopy,
    };
  }, { timeout: 15_000 });
}

const stripId = <T extends { id?: string } | null | undefined>(item: T) => {
  if (!item) return null;
  const { id: _id, ...rest } = item;
  return Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, typeof v === "string" ? v.trim() : v]));
};

const names = (list: { name: string }[]) => list.map((i) => i.name.trim()).join(", ") || null;

async function fieldHistory(tx: Tx, field: ScalarField, label: string, from: unknown, to: unknown): Promise<HistoryEntry> {
  // Store the member's name, so the entry stays readable if the member is removed later
  if (field === "responsibleId") {
    const ids = [from, to].filter(Boolean) as string[];
    const members = await tx.teamMember.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
    const name = (id: unknown) => members.find((m) => m.id === id)?.name ?? null;
    return { type: "FIELD_CHANGED", data: { field, label, from: name(from), to: name(to) } };
  }
  if (field === "priority") return { type: "FIELD_CHANGED", data: { field, label, from: priorityLabel(from as string), to: priorityLabel(to as string) } };
  if (field === "recurrence") {
    const recurrenceLabel = (v: unknown) => RECURRENCE_OPTIONS.find((r) => r.value === v)?.label ?? displayScalar(v);
    return { type: "FIELD_CHANGED", data: { field, label, from: recurrenceLabel(from), to: recurrenceLabel(to) } };
  }
  if (field === "recurrenceWeekdays") {
    return { type: "FIELD_CHANGED", data: { field, label, from: weekdayNames(from as number | null), to: weekdayNames(to as number | null) } };
  }
  if (field === "estimateMinutes" || field === "reminderMinutes") {
    return { type: "FIELD_CHANGED", data: { field, label, from: formatMinutes(from as number | null), to: formatMinutes(to as number | null) } };
  }
  return { type: "FIELD_CHANGED", data: { field, label, from: displayScalar(from), to: displayScalar(to) } };
}

/**
 * Resolves the deal's company: updates the linked one, reuses an existing
 * company with the same CNPJ, or creates a new one. Returns its id (or null).
 */
async function syncCompany(tx: Tx, input: CompanyInput | null) {
  const name = input?.name?.trim();
  if (!input || !name) return null;

  const fields = {
    name,
    document: blankToNull(input.document),
    phone: blankToNull(input.phone),
    email: blankToNull(input.email),
    address: blankToNull(input.address),
    info: blankToNull(input.info),
  };

  let existing = input.id ? await tx.crmCompany.findUnique({ where: { id: input.id } }) : null;

  // A new company typed with the CNPJ of an existing one: link it only when it's clearly the
  // same company, never rename a company shared by other deals by accident
  if (!existing && fields.document) {
    const sameDocument = await tx.crmCompany.findUnique({ where: { document: fields.document } });
    if (sameDocument && sameDocument.name.trim().toLowerCase() !== name.toLowerCase()) {
      throw new DealValidationError(
        `O CNPJ ${fields.document} já está cadastrado para ${sameDocument.name}. Selecione essa empresa na busca.`
      );
    }
    existing = sameDocument;
  }

  if (existing) {
    // Another company may already own this CNPJ
    if (fields.document && fields.document !== existing.document) {
      const owner = await tx.crmCompany.findUnique({ where: { document: fields.document } });
      if (owner && owner.id !== existing.id) {
        throw new DealValidationError(`O CNPJ ${fields.document} já pertence à empresa ${owner.name}`);
      }
    }
    await tx.crmCompany.update({ where: { id: existing.id }, data: fields });
    return existing.id;
  }

  return (await tx.crmCompany.create({ data: fields })).id;
}

async function syncContacts(tx: Tx, dealId: string, input: ContactInput[]) {
  const ids: string[] = [];
  for (const contact of input) {
    const fields = {
      name: contact.name.trim(),
      phone: blankToNull(contact.phone),
      email: blankToNull(contact.email),
      address: blankToNull(contact.address),
      info: blankToNull(contact.info),
    };
    const existing = contact.id && (await tx.crmContact.findUnique({ where: { id: contact.id } }));
    if (existing) {
      await tx.crmContact.update({ where: { id: existing.id }, data: fields });
      ids.push(existing.id);
    } else {
      ids.push((await findOrCreateContact(tx, fields)).id);
    }
  }

  // Contacts are shared entities: unlink them from this deal, never delete them
  await tx.crmDealContact.deleteMany({ where: { dealId } });
  const unique = [...new Set(ids)];
  if (unique.length) {
    await tx.crmDealContact.createMany({ data: unique.map((contactId, order) => ({ dealId, contactId, order })) });
  }
}

/** Replaces the deal's product lines, linking each to the catalog (created on first use). */
async function syncProducts(tx: Tx, dealId: string, input: ProductInput[]) {
  await tx.crmDealProduct.deleteMany({ where: { dealId } });

  for (const [order, line] of input.entries()) {
    const name = line.name.trim();
    const price = Number(line.price) || 0;
    const catalog =
      (line.productId && (await tx.crmProduct.findUnique({ where: { id: line.productId } }))) ||
      // A name typed for the first time enters the catalog at 0; the line keeps the typed price
      (await tx.crmProduct.upsert({ where: { name }, update: {}, create: { name, price: 0 } }));

    await tx.crmDealProduct.create({
      data: {
        dealId,
        productId: catalog.id,
        name,
        description: line.description?.trim() || null,
        price,
        quantity: Math.max(0, Math.round(Number(line.quantity) || 0)),
        order,
      },
    });
  }
}

type ContactFields = { name: string; phone: string | null; email: string | null; address?: string | null; info?: string | null; companyId?: string | null };

/**
 * Creates a contact, or reuses the one with the same e-mail (the column collation ignores case),
 * else the same phone, filling in only the fields given. Returns the id and whether it was created.
 * ponytail: phone match is exact text; normalize to digits in a column if formats vary too much
 */
export async function findOrCreateContact(tx: Tx, fields: ContactFields) {
  const match =
    (fields.email && (await tx.crmContact.findFirst({ where: { email: fields.email }, select: { id: true } }))) ||
    (fields.phone && (await tx.crmContact.findFirst({ where: { phone: fields.phone }, select: { id: true } })));
  if (!match) return { id: (await tx.crmContact.create({ data: fields })).id, created: true };
  const given = Object.fromEntries(Object.entries(fields).filter(([, v]) => v != null && v !== ""));
  await tx.crmContact.update({ where: { id: match.id }, data: given });
  return { id: match.id, created: false };
}

/** Finds a company by exact name or creates it (used by the quick "Novo Negócio" form). */
export async function companyIdByName(tx: Tx, name: unknown) {
  const trimmed = typeof name === "string" ? name.trim() : "";
  if (!trimmed) return null;
  const existing = await tx.crmCompany.findFirst({ where: { name: trimmed }, select: { id: true } });
  return existing?.id ?? (await tx.crmCompany.create({ data: { name: trimmed } })).id;
}

// ---------------------------------------------------------------------------
// Recurring deals
// ---------------------------------------------------------------------------


type CopyOptions = {
  /** Default: the pipeline's first stage */
  stageId?: string;
  title?: string;
  /** Default: the source's responsible */
  responsibleId?: string | null;
  isTemplate?: boolean;
  startDate: Date | null;
  closeDate: Date | null;
  /** Extra data of the copy's CREATED history entry (where it came from) */
  history: Prisma.InputJsonObject;
  /** Who made the copy (null = recurrence) */
  actorId?: string | null;
};

/**
 * Copies a card with its relations, description and checklist (TODO activities, unchecked) to the end of a
 * stage. Used by recurring cards and "Duplicar".
 */
export async function copyCard(tx: Tx, id: string, options: CopyOptions) {
  const deal = await tx.crmCard.findUniqueOrThrow({
    where: { id },
    include: {
      contacts: true,
      observers: true,
      assignees: true,
      products: true,
      tags: true,
      activities: { where: { type: "TODO" }, orderBy: { createdAt: "asc" } },
      stage: { select: { pipelineId: true, pipeline: { select: { stages: { orderBy: { order: "asc" }, take: 1 } } } } },
    },
  });

  const stageId = options.stageId ?? deal.stage.pipeline.stages[0].id;
  // A subtask's parent must be on the same board: a copy to another pipeline stands alone
  const sameBoard =
    !options.stageId || (await tx.crmStage.count({ where: { id: options.stageId, pipelineId: deal.stage.pipelineId } })) > 0;
  const title = options.title ?? deal.title;
  return tx.crmCard.create({
    data: {
      title,
      value: deal.value,
      currency: deal.currency,
      stageId,
      order: await tx.crmCard.count({ where: { stageId } }),
      companyId: deal.companyId,
      responsibleId: options.responsibleId === undefined ? deal.responsibleId : options.responsibleId,
      isTemplate: options.isTemplate ?? false,
      dealType: deal.dealType,
      source: deal.source,
      sourceInfo: deal.sourceInfo,
      referredBy: deal.referredBy,
      isPublic: deal.isPublic,
      comment: deal.comment,
      recurrence: deal.recurrence,
      priority: deal.priority,
      estimateMinutes: deal.estimateMinutes,
      dueTime: deal.dueTime,
      reminderMinutes: deal.reminderMinutes,
      recurrenceInterval: deal.recurrenceInterval,
      recurrenceWeekdays: deal.recurrenceWeekdays,
      // A copied subtask stays under the same parent; templates and copies to another board stand alone
      parentId: options.isTemplate || !sameBoard ? null : deal.parentId,
      customData: deal.customData ?? Prisma.DbNull,
      startDate: options.startDate,
      closeDate: options.closeDate,
      contacts: { createMany: { data: deal.contacts.map(({ contactId, order }) => ({ contactId, order })) } },
      observers: { createMany: { data: deal.observers.map(({ memberId }) => ({ memberId })) } },
      assignees: { createMany: { data: deal.assignees.map(({ memberId }) => ({ memberId })) } },
      tags: { createMany: { data: deal.tags.map(({ tagId }) => ({ tagId })) } },
      products: {
        createMany: {
          data: deal.products.map(({ productId, name, price, quantity, order }) => ({ productId, name, price, quantity, order })),
        },
      },
      activities: {
        createMany: {
          data: deal.activities.map(({ type, title, description, responsibleId }) => ({ type, title, description, responsibleId })),
        },
      },
      history: { create: { type: "CREATED", data: { title, ...options.history }, actorId: options.actorId ?? null } },
    },
  });
}

/**
 * "Negócio recorrente": closing a recurring deal as won creates the next one in the first stage.
 * Returns the new deal (null when the deal isn't recurring).
 */
export async function createRecurringCopy(tx: Tx, id: string) {
  const deal = await tx.crmCard.findUnique({
    where: { id },
    select: {
      id: true,
      recurrence: true,
      recurrenceInterval: true,
      recurrenceWeekdays: true,
      startDate: true,
      closeDate: true,
      createdAt: true,
      isTemplate: true,
      archivedAt: true,
    },
  });
  // A template or archived card closed by hand is not a real occurrence
  if (!deal || deal.isTemplate || deal.archivedAt) return null;
  const rule = { recurrence: deal.recurrence, interval: deal.recurrenceInterval, weekdays: deal.recurrenceWeekdays };
  const close = deal.closeDate ?? new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  const nextClose = nextOccurrence(close, rule);
  if (!nextClose) return null;
  // The start keeps its distance to the deadline, so a weekday rule moves both together
  const start = deal.startDate ?? deal.createdAt;
  const nextStart = new Date(start.getTime() + (nextClose.getTime() - close.getTime()));

  const copy = await copyCard(tx, id, {
    startDate: nextStart,
    closeDate: nextClose,
    history: { recurringFrom: deal.id },
  });

  await tx.crmHistory.create({
    data: { cardId: deal.id, type: "RECURRENCE_CREATED", data: { cardId: copy.id, title: copy.title } },
  });
  return copy;
}

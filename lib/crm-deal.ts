import { Prisma, type CrmDealStatus, type CrmRecurrence } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Tx = Prisma.TransactionClient;

// ---------------------------------------------------------------------------
// Kanban list
// ---------------------------------------------------------------------------

/** What the kanban card needs: company, main contact, responsible and next pending activity. */
export const cardListInclude = {
  company: { select: { name: true } },
  contacts: { orderBy: { order: "asc" }, take: 1, select: { contact: { select: { name: true } } } },
  responsible: { select: { id: true, name: true, role: true, photo: true } },
  activities: {
    where: { completed: false, type: { not: "COMMENT" } },
    orderBy: [{ deadline: "asc" }, { createdAt: "asc" }],
    take: 1,
    select: { id: true, title: true, deadline: true, type: true },
  },
  _count: { select: { activities: { where: { completed: false, type: { not: "COMMENT" } } } } },
} satisfies Prisma.CrmCardInclude;

type ListCard = Prisma.CrmCardGetPayload<{ include: typeof cardListInclude }>;

/** Flattens relations and converts Decimal so the card can cross the server → client boundary. */
export function serializeListCard({ company, contacts, responsible, ...card }: ListCard) {
  return {
    ...card,
    value: card.value.toNumber(),
    company: company?.name ?? null,
    contactName: contacts[0]?.contact.name ?? null,
    responsible: responsible && { id: responsible.id, name: responsible.name, role: responsible.role, image: responsible.photo },
  };
}

// ---------------------------------------------------------------------------
// Deal details (panel)
// ---------------------------------------------------------------------------

const dealDetailsInclude = {
  company: true,
  contacts: { orderBy: { order: "asc" }, include: { contact: true } },
  observers: { select: { memberId: true } },
  products: { orderBy: { order: "asc" } },
  activities: { orderBy: { createdAt: "desc" } },
  history: { orderBy: { createdAt: "desc" } },
  stage: {
    select: {
      pipeline: {
        select: {
          id: true,
          fieldsConfig: true,
          stages: { orderBy: { order: "asc" }, select: { id: true, name: true } },
        },
      },
    },
  },
} satisfies Prisma.CrmCardInclude;

type DealRow = Prisma.CrmCardGetPayload<{ include: typeof dealDetailsInclude }>;

const toDto = (row: DealRow) => {
  const { stage, company, contacts, observers, products, ...deal } = row;
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
    products: products.map((p) => ({
      id: p.id,
      productId: p.productId,
      name: p.name,
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
// Updates
// ---------------------------------------------------------------------------

type CompanyInput = { id?: string; name: string; document?: string; phone?: string; email?: string; address?: string; info?: string };
type ContactInput = { id?: string; name: string; phone?: string; email?: string; address?: string; info?: string };
type ProductInput = { productId?: string | null; name: string; price: number; quantity: number };

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
  isPublic: "Disponível para todos",
  responsibleId: "Responsável",
  comment: "Comentário",
  recurrence: "Negócio recorrente",
  customData: "Campos adicionais",
} as const;

export const RELATION_FIELDS = {
  company: "Empresa",
  contacts: "Contatos",
  observers: "Observadores",
  products: "Produtos",
} as const;

type ScalarField = keyof typeof SCALAR_FIELDS;
type RelationField = keyof typeof RELATION_FIELDS;

const RECURRENCES = new Set<CrmRecurrence>(["NONE", "DAILY", "WEEKLY", "MONTHLY", "YEARLY"]);
export const STATUSES = new Set<CrmDealStatus>(["OPEN", "WON", "LOST"]);

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
    case "customData":
      return value && typeof value === "object" ? value : null;
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
    if (field === "title" && !next) throw new DealValidationError("O nome do negócio é obrigatório");

    (data as Record<string, unknown>)[field] = field === "customData" && next === null ? Prisma.DbNull : next;
    history.push(await fieldHistory(tx, field, SCALAR_FIELDS[field], current[field], next));
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

    if (field === "observers") {
      const ids = [...new Set((changes.observers as string[] | null) ?? [])];
      if (comparable([...currentDto.observers].sort()) === comparable([...ids].sort())) continue;
      await tx.crmDealObserver.deleteMany({ where: { dealId } });
      if (ids.length) await tx.crmDealObserver.createMany({ data: ids.map((memberId) => ({ dealId, memberId })) });
      const members = await tx.teamMember.findMany({ where: { id: { in: [...currentDto.observers, ...ids] } } });
      const memberNames = (list: string[]) =>
        list.map((id) => members.find((m) => m.id === id)?.name).filter(Boolean).join(", ") || null;
      history.push({
        type: "FIELD_CHANGED",
        data: { field, label, from: memberNames(currentDto.observers), to: memberNames(ids) },
      });
    }

    if (field === "products") {
      const input = ((changes.products as ProductInput[] | null) ?? []).filter((p) => p.name?.trim());
      const normalize = (list: ProductInput[]) =>
        list.map((p) => ({ name: p.name.trim(), price: Number(p.price) || 0, quantity: Number(p.quantity) || 0 }));
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

export class DealValidationError extends Error {}

/**
 * Full deal update (deal panel and "Modificar negócio" automation): fields
 * from applyDealChanges plus `stageId` and `status`, all recorded in the
 * history. Running the new stage's rules / "campo alterado" triggers is left
 * to the caller (lib/crm-automation imports this module).
 */
export async function updateDeal(
  id: string,
  { stageId, status, ...changes }: { stageId?: string | null; status?: string | null } & Record<string, unknown>
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

      data.stageId = to.id;
      data.order = await tx.crmCard.count({ where: { stageId: to.id } });
      history.push({ type: "STAGE_CHANGED", data: { from: from.name, to: to.name } });
    }

    if (status && status !== current.status) {
      data.status = status as CrmDealStatus;
      history.push({ type: "STATUS_CHANGED", data: { from: current.status, to: status } });
    }

    let recurringCopy = null;
    if (history.length > 0) {
      await tx.crmCard.update({ where: { id }, data: { ...data, history: { createMany: { data: history } } } });
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
      ids.push((await tx.crmContact.create({ data: fields })).id);
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
      (await tx.crmProduct.upsert({ where: { name }, update: {}, create: { name, price } }));

    await tx.crmDealProduct.create({
      data: { dealId, productId: catalog.id, name, price, quantity: Math.max(0, Math.round(Number(line.quantity) || 0)), order },
    });
  }
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

const RECURRENCE_STEP: Record<string, { days?: number; months?: number }> = {
  DAILY: { days: 1 },
  WEEKLY: { days: 7 },
  MONTHLY: { months: 1 },
  YEARLY: { months: 12 },
};

function shiftDate(date: Date, recurrence: string) {
  const step = RECURRENCE_STEP[recurrence];
  const next = new Date(date);
  if (step?.days) next.setUTCDate(next.getUTCDate() + step.days);
  if (step?.months) next.setUTCMonth(next.getUTCMonth() + step.months);
  return next;
}

/**
 * "Negócio recorrente": closing a recurring deal as won creates the next one in the first stage.
 * Returns the new deal (null when the deal isn't recurring).
 */
export async function createRecurringCopy(tx: Tx, id: string) {
  const deal = await tx.crmCard.findUnique({
    where: { id },
    include: {
      contacts: true,
      observers: true,
      products: true,
      stage: { select: { pipeline: { select: { stages: { orderBy: { order: "asc" }, take: 1 } } } } },
    },
  });
  if (!deal || !(deal.recurrence in RECURRENCE_STEP)) return null;

  const firstStage = deal.stage.pipeline.stages[0];
  const copy = await tx.crmCard.create({
    data: {
      title: deal.title,
      value: deal.value,
      currency: deal.currency,
      stageId: firstStage.id,
      order: await tx.crmCard.count({ where: { stageId: firstStage.id } }),
      companyId: deal.companyId,
      responsibleId: deal.responsibleId,
      dealType: deal.dealType,
      source: deal.source,
      sourceInfo: deal.sourceInfo,
      isPublic: deal.isPublic,
      recurrence: deal.recurrence,
      customData: deal.customData ?? Prisma.DbNull,
      startDate: shiftDate(deal.startDate ?? deal.createdAt, deal.recurrence),
      closeDate: shiftDate(deal.closeDate ?? new Date(), deal.recurrence),
      contacts: { createMany: { data: deal.contacts.map(({ contactId, order }) => ({ contactId, order })) } },
      observers: { createMany: { data: deal.observers.map(({ memberId }) => ({ memberId })) } },
      products: {
        createMany: {
          data: deal.products.map(({ productId, name, price, quantity, order }) => ({ productId, name, price, quantity, order })),
        },
      },
      history: { create: { type: "CREATED", data: { title: deal.title, recurringFrom: deal.id } } },
    },
  });

  await tx.crmHistory.create({
    data: { cardId: deal.id, type: "RECURRENCE_CREATED", data: { cardId: copy.id, title: copy.title } },
  });
  return copy;
}

/*
 * Bitrix24-compatible REST subset used by the QXBACK (referral program, PHP).
 *
 * QXBACK talks to Bitrix24 through an incoming webhook (`<base>/crm.deal.list`, form-encoded
 * params, `{ result }` answers). This module answers the same methods with CRM data, so its
 * scripts only swap the base URL to /api/crm/qxback/<QXBACK_TOKEN>/.
 *
 * Bitrix ids are mapped by env (JSON):
 * - QXBACK_STAGES: { "C1:NEW": "<CrmStage.id>", "C1:WON": "<CrmStage.id>", ... }
 * - QXBACK_FIELDS: { "UF_CRM_1764593798": "<custom field id of the pipeline>", ... }
 * A deal's "ID" is its number (/crm/deal/details/<number>).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { updateDeal } from "@/lib/crm-deal";
import { REQUIRED_FIELDS, requiredFieldsOf } from "@/components/crm/deal/types";

export type Params = Record<string, unknown>;

/** Answered as Bitrix does: HTTP 400 `{ error, error_description }`. */
export class BitrixError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

/** After a change the route refreshes the board and runs the CRM automations. */
export type Effect = { stageId: string } & (
  | { type: "created"; dealId: string }
  | { type: "updated"; dealId: string; changedFields: string[]; /** stage the deal was moved into by this call */ movedTo?: string }
  | { type: "value" }
);

const PAGE_SIZE = 50;

function envMap(name: string): Record<string, string> {
  try {
    return JSON.parse(process.env[name] || "{}");
  } catch {
    throw new BitrixError("CONFIG", `${name} não é um JSON válido`);
  }
}

/**
 * Parses `http_build_query` output (`filter[STAGE_ID]=..&fields[PHONE][0][VALUE]=..`) into nested objects.
 * Nodes have no prototype, so a `__proto__`/`constructor` key is just data and never reaches Object.prototype.
 */
export function parseParams(search: URLSearchParams): Params {
  const root: Params = Object.create(null);
  for (const [key, value] of search) {
    const path = key.replace(/\]/g, "").split("[");
    let node = root;
    for (const part of path.slice(0, -1)) {
      node[part] ??= Object.create(null);
      if (typeof node[part] !== "object") throw new BitrixError("INVALID_PARAMS", `Parâmetro ${key} conflita com ${part}`);
      node = node[part] as Params;
    }
    const last = path[path.length - 1];
    if (typeof node[last] === "object") throw new BitrixError("INVALID_PARAMS", `Parâmetro ${key} conflita com ${last}`);
    node[last] = value;
  }
  return root;
}

const obj = (value: unknown) => (value && typeof value === "object" ? (value as Params) : {});
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
/** Bitrix numbers arrive as form strings; anything else (a nested object) is not a number */
const num = (value: unknown) => (typeof value === "string" && value.trim() !== "" ? Number(value) : NaN);
/** `PHONE[0][VALUE]` style multi-fields */
const firstValue = (value: unknown) => text(obj(Object.values(obj(value))[0]).VALUE);

/** "12345678000190", "12.345.678/0001-90" and what was sent: the spellings of one CNPJ (or CPF) */
export function documentForms(document: string) {
  const digits = document.replace(/\D/g, "");
  const masked =
    digits.length === 14 ? digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")
    : digits.length === 11 ? digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4")
    : digits;
  return [...new Set([document, digits, masked].filter(Boolean))];
}

/** Multi-value custom field typed in the CRM as "a; b; c" (fechamento parcial reads service names). */
const splitList = (value: string) => value.split(/[;\n]/).map((s) => s.trim()).filter(Boolean);

async function scope() {
  const stages = envMap("QXBACK_STAGES");
  const fields = envMap("QXBACK_FIELDS");
  const stageIds = Object.values(stages);
  const pipelines = await prisma.crmStage.findMany({ where: { id: { in: stageIds } }, distinct: ["pipelineId"], select: { pipelineId: true } });
  return {
    stages,
    fields,
    codeOf: (stageId: string) => Object.keys(stages).find((code) => stages[code] === stageId) ?? stageId,
    dealWhere: { stage: { pipelineId: { in: pipelines.map((p) => p.pipelineId) } } } satisfies Prisma.CrmCardWhereInput,
  };
}

type Scope = Awaited<ReturnType<typeof scope>>;

/** True when the stage belongs to a pipeline QXBACK reads (QXBACK_STAGES values). No DB call. */
export const isQxbackStage = (stageId: string) => Object.values(envMap("QXBACK_STAGES")).includes(stageId);

/**
 * Tells QXBACK a deal changed, the same way Bitrix24 pushes `ONCRMDEALUPDATE`. QXBACK's
 * backend/bitrix_webhook_handler.php re-reads the deal from DEAL_SOURCE_URL (this CRM, with
 * DEAL_SOURCE=crm) and refreshes its products/value — closing the gap after "Proposta enviada"
 * for edits made in the CRM UI, not through the QXBACK rest route above.
 */
export async function notifyQxback(dealNumber: number, event = "ONCRMDEALUPDATE", extra: Record<string, string> = {}) {
  const url = process.env.QXBACK_WEBHOOK_URL;
  const secret = process.env.QXBACK_WEBHOOK_SECRET;
  if (!url || !secret) return;

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        event,
        "auth[application_token]": secret,
        "data[FIELDS][ID]": String(dealNumber),
        ...extra,
      }),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
  } catch (error) {
    console.error("Falha ao avisar QXBACK do negócio alterado:", error);
  }
}

const stageCode = (stageId: string) => {
  const stages = envMap("QXBACK_STAGES");
  return Object.keys(stages).find((code) => stages[code] === stageId) ?? null;
};

/**
 * A deal entering a mapped QXBACK stage pushes `ONCRMDEALSTAGE` with its Bitrix code. QXBACK's
 * webhook runs that column's rule right away (Em Contato, bônus de R$ 20, valor da proposta,
 * fechamento, recusa, perda); its cron scripts (bitrix/*.php) retry if this push is lost.
 */
export async function notifyQxbackStage(dealId: string, stageId: string) {
  const code = stageCode(stageId);
  if (!code) return;
  const deal = await prisma.crmCard.findUnique({ where: { id: dealId }, select: { number: true } });
  if (deal) await notifyQxback(deal.number, "ONCRMDEALSTAGE", { "data[FIELDS][STAGE_ID]": code });
}

/** Bitrix field QXBACK's negocio_perdido reads as the reason shown to the referrer. */
const LOST_REASON_FIELD = "UF_CRM_1745841118729";

/** Proposta em Análise: C1:EXECUTING, or the Bitrix "Proposta Enviada" code the CRM column is mapped to. */
const PROPOSAL_STAGES = ["C1:EXECUTING", "C1:UC_WZ7S1B"];

function stageRequirement(stageId: string) {
  const code = stageCode(stageId);
  if (code && PROPOSAL_STAGES.includes(code)) return "services";
  return code === "C1:APOLOGY" ? "lostReason" : null;
}

/**
 * Stage entry refused: answered as `{ error, need }`. `need: "lostReason"` makes the client
 * ask for the reason and send the move again (components/crm/stageEntry.ts).
 */
export class StageEntryError extends Error {
  constructor(message: string, public status = 422, public need?: "lostReason") {
    super(message);
  }

  toResponse() {
    return Response.json({ error: this.message, need: this.need }, { status: this.status });
  }
}

/**
 * Checks a manual move (board drag, deal panel or bulk move): first the column's required fields
 * (CrmStage.requiredFields), then the QXBACK stage rules:
 * - Proposta em Análise: every service needs a price, so QXBACK can tell the referrer what they can earn.
 * - Negócio Perdido: the reason is required; it is saved in the deal's mapped custom field.
 * Automations skip this check (they cannot fill these in).
 */
export async function checkStageEntry(dealId: string, stageId: string, lostReason: unknown) {
  // Column's required fields (any board), only when the card actually changes column
  const stage = await prisma.crmStage.findUnique({ where: { id: stageId }, select: { requiredFields: true } });
  const required = requiredFieldsOf(stage?.requiredFields);
  if (required.length) {
    const card = await prisma.crmCard.findUniqueOrThrow({
      where: { id: dealId },
      select: { stageId: true, responsibleId: true, closeDate: true, startDate: true, estimateMinutes: true, priority: true },
    });
    const missing = card.stageId === stageId ? [] : required.filter((field) => card[field] == null);
    if (missing.length) throw new StageEntryError(`Preencha antes de mover para esta coluna: ${missing.map((f) => REQUIRED_FIELDS[f]).join(", ")}.`);
  }

  const requirement = stageRequirement(stageId);
  if (requirement === "services") {
    const products = await prisma.crmDealProduct.findMany({ where: { dealId }, select: { price: true } });
    if (products.length === 0 || products.some((p) => p.price.lte(0))) {
      throw new StageEntryError("Informe os serviços e o valor de cada um antes de mover para Proposta em Análise.");
    }
  }
  if (requirement === "lostReason") {
    const reason = text(lostReason).slice(0, 1000);
    if (!reason) throw new StageEntryError("Informe o motivo da perda.", 422, "lostReason");
    const fieldId = envMap("QXBACK_FIELDS")[LOST_REASON_FIELD];
    if (!fieldId) throw new StageEntryError(`QXBACK_FIELDS sem o campo ${LOST_REASON_FIELD} (motivo da perda).`, 500);
    const deal = await prisma.crmCard.findUniqueOrThrow({ where: { id: dealId }, select: { customData: true } });
    await updateDeal(dealId, { customData: { ...obj(deal.customData), [fieldId]: reason } });
  }
}

const dealSelect = { id: true, number: true, title: true, stageId: true, comment: true, value: true, customData: true, updatedAt: true } as const;

function toBitrixDeal(s: Scope, deal: Prisma.CrmCardGetPayload<{ select: typeof dealSelect }>) {
  const custom = obj(deal.customData);
  const result: Params = {
    ID: String(deal.number),
    TITLE: deal.title,
    STAGE_ID: s.codeOf(deal.stageId),
    COMMENTS: deal.comment ?? "",
    OPPORTUNITY: deal.value.toString(),
    DATE_MODIFY: deal.updatedAt.toISOString(),
  };
  for (const [uf, fieldId] of Object.entries(s.fields)) {
    const value = custom[fieldId] == null ? "" : String(custom[fieldId]);
    result[uf] = /[;\n]/.test(value) ? splitList(value) : value;
  }
  return result;
}

async function findDeal(s: Scope, id: unknown) {
  const number = num(id);
  const deal = Number.isInteger(number) && number > 0
    ? await prisma.crmCard.findFirst({ where: { number, ...s.dealWhere }, select: dealSelect })
    : null;
  if (!deal) throw new BitrixError("NOT_FOUND", `Negócio ${text(id) || "?"} não encontrado`);
  return deal;
}

/** Recomputes the cached deal value from its products (same rule as the deal panel). */
async function syncDealValue(dealId: string) {
  // Concurrent product rows race on the deal row (MariaDB: P2039 "record has changed"): re-read and retry,
  // so the line already saved never turns into an error answer and the value ends with every line
  for (let attempt = 1; ; attempt++) {
    try {
      const lines = await prisma.crmDealProduct.findMany({ where: { dealId }, select: { price: true, quantity: true } });
      const value = lines.reduce((sum, l) => sum + l.price.toNumber() * l.quantity, 0);
      return await prisma.crmCard.update({ where: { id: dealId }, data: { value }, select: { stageId: true } });
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (attempt >= 5 || (code !== "P2039" && code !== "P2034")) throw error;
      await new Promise((r) => setTimeout(r, 20 * attempt));
    }
  }
}

/** Runs one method. Returns the Bitrix answer plus what changed for the route to broadcast. */
export async function callMethod(method: string, params: Params): Promise<{ body: Params; effect?: Effect }> {
  const s = await scope();
  const filter = obj(params.filter);
  const fields = obj(params.fields);

  switch (method) {
    case "crm.deal.list": {
      const stageId = s.stages[text(filter.STAGE_ID)];
      // A stage that is not mapped has no deals here (never fall back to "all deals")
      if (!stageId) return { body: { result: [], total: 0 } };
      const start = Math.max(0, num(params.start) || 0);
      const where = { stageId, ...s.dealWhere };
      const [deals, total] = await Promise.all([
        prisma.crmCard.findMany({ where, orderBy: { number: "asc" }, skip: start, take: PAGE_SIZE, select: dealSelect }),
        prisma.crmCard.count({ where }),
      ]);
      const next = start + deals.length;
      return { body: { result: deals.map((d) => toBitrixDeal(s, d)), total, ...(next < total && { next }) } };
    }

    case "crm.deal.get":
      return { body: { result: toBitrixDeal(s, await findDeal(s, params.id)) } };

    case "crm.deal.update": {
      const deal = await findDeal(s, params.id);
      const wantsComment = "COMMENTS" in fields;
      const wantsStage = "STAGE_ID" in fields;
      // QXBACK appends processing notes to the comment and moves the deal when its admin moves/closes the card there
      if (!wantsComment && !wantsStage) return { body: { result: true } };

      // The comment carries "ID da Indicação: N", the only link QXBACK's scripts have: never overwrite it with junk
      if (wantsComment && typeof fields.COMMENTS !== "string") throw new BitrixError("INVALID_PARAMS", "COMMENTS deve ser texto");

      let stageId: string | undefined;
      if (wantsStage) {
        const code = text(fields.STAGE_ID);
        stageId = s.stages[code];
        if (!stageId) throw new BitrixError("STAGE_NOT_MAPPED", `Etapa ${code || "(vazia)"} sem correspondente em QXBACK_STAGES`);
        // Same entry rules as a manual move (Proposta em Análise needs priced services, Negócio Perdido needs the reason);
        // a refusal is answered as a Bitrix error so QXBACK can show it
        if (stageId !== deal.stageId) {
          try {
            await checkStageEntry(deal.id, stageId, fields[LOST_REASON_FIELD]);
          } catch (error) {
            if (error instanceof StageEntryError) throw new BitrixError("STAGE_ENTRY_REFUSED", error.message);
            throw error;
          }
        }
      }

      const moved = stageId && stageId !== deal.stageId ? stageId : undefined;
      const result = await updateDeal(deal.id, { ...(wantsComment ? { comment: fields.COMMENTS } : {}), ...(moved ? { stageId: moved } : {}) });
      return {
        body: { result: true },
        effect: result.changed
          ? { type: "updated", dealId: deal.id, stageId: result.stageId, changedFields: result.changedFields, movedTo: result.movedTo ?? undefined }
          : undefined,
      };
    }

    case "crm.deal.productrows.get": {
      const deal = await findDeal(s, params.id);
      const lines = await prisma.crmDealProduct.findMany({
        where: { dealId: deal.id },
        orderBy: { order: "asc" },
        include: { product: { select: { hasBonus: true } } },
      });
      return {
        body: {
          result: lines.map((l) => ({
            ID: l.id,
            PRODUCT_ID: l.productId,
            PRODUCT_NAME: l.name,
            PRICE: l.price.toNumber(),
            QUANTITY: l.quantity,
            DESCRIPTION: l.description ?? "",
            // Not a Bitrix field: QXBACK's "Proposta em Elaboração" bonus rule (a deleted product has no bonus)
            BONUS: l.product?.hasBonus ? "Y" : "N",
          })),
        },
      };
    }

    case "crm.deal.fields": {
      // Mapped custom fields hold service names; every catalog product is a valid "enum item"
      const products = await prisma.crmProduct.findMany({ orderBy: { name: "asc" }, select: { name: true } });
      const items = products.map((p) => ({ ID: p.name, VALUE: p.name }));
      return { body: { result: Object.fromEntries(Object.keys(s.fields).map((uf) => [uf, { type: "enumeration", items }])) } };
    }

    case "crm.deal.add": {
      const stageCode = text(fields.STAGE_ID);
      const stageId = s.stages[stageCode];
      if (!stageId) throw new BitrixError("STAGE_NOT_MAPPED", `Etapa ${stageCode || "(vazia)"} sem correspondente em QXBACK_STAGES`);
      const title = text(fields.TITLE);
      if (!title) throw new BitrixError("TITLE_REQUIRED", "TITLE é obrigatório");

      const customData: Record<string, string> = {};
      for (const [uf, fieldId] of Object.entries(s.fields)) {
        if (typeof fields[uf] === "string") customData[fieldId] = fields[uf];
      }
      const companyId = text(fields.COMPANY_ID) || null;
      const contactId = text(fields.CONTACT_ID);

      const deal = await prisma.$transaction(async (tx) => {
        // Incrementa a ordem dos cards existentes nessa etapa para que a nova indicação sempre fique no topo (ordem 0)
        await tx.crmCard.updateMany({
          where: { stageId },
          data: { order: { increment: 1 } },
        });

        return tx.crmCard.create({
          data: {
            title,
            value: num(fields.OPPORTUNITY) || 0,
            stageId,
            companyId: companyId ? (await tx.crmCompany.findUnique({ where: { id: companyId }, select: { id: true } }))?.id : null,
            comment: text(fields.COMMENTS) || null,
            source: "QXBACK",
            customData: { ...customData, openedAt: null },
            order: 0,
            history: { create: { type: "CREATED", data: { title } } },
            ...(contactId && (await tx.crmContact.findUnique({ where: { id: contactId }, select: { id: true } }))
              ? { contacts: { create: { contactId, order: 0 } } }
              : {}),
          },
          select: { id: true, number: true },
        });
      });
      return { body: { result: deal.number }, effect: { type: "created", dealId: deal.id, stageId } };
    }

    case "crm.productrow.add": {
      const deal = await findDeal(s, fields.OWNER_ID);
      const product = await prisma.crmProduct.findUnique({ where: { id: text(fields.PRODUCT_ID) } });
      if (!product) throw new BitrixError("NOT_FOUND", `Produto ${text(fields.PRODUCT_ID)} não encontrado`);
      const line = await prisma.crmDealProduct.create({
        data: {
          dealId: deal.id,
          productId: product.id,
          name: product.name,
          description: text(fields.DESCRIPTION) || null,
          // Like Bitrix: the catalog price wins; a product still at 0 (just created) keeps what QXBACK sent
          price: product.price.toNumber() > 0 ? product.price : num(fields.PRICE) || 0,
          // Bitrix default is 1 only when QUANTITY is missing; an explicit 0 stays 0
          quantity: Math.max(0, Math.round(fields.QUANTITY === undefined ? 1 : num(fields.QUANTITY) || 0)),
          order: await prisma.crmDealProduct.count({ where: { dealId: deal.id } }),
        },
      });
      const { stageId } = await syncDealValue(deal.id);
      return { body: { result: line.id }, effect: { type: "value", stageId } };
    }

    case "crm.company.list": {
      const name = text(filter.TITLE);
      const companies = name ? await prisma.crmCompany.findMany({ where: { name }, take: PAGE_SIZE }) : [];
      return { body: { result: companies.map((c) => ({ ID: c.id, TITLE: c.name, UF_CRM_CNPJ: c.document ?? "" })) } };
    }

    case "crm.company.add": {
      const name = text(fields.TITLE);
      if (!name) throw new BitrixError("TITLE_REQUIRED", "TITLE é obrigatório");
      const document = text(fields.UF_CRM_CNPJ) || null;
      // CNPJ is unique: an existing company with it is the same company. QXBACK sends digits only while
      // the CRM keeps what was typed, so look for every way of writing it
      const existing = document && (await prisma.crmCompany.findFirst({ where: { document: { in: documentForms(document) } } }));
      const company = existing || (await prisma.crmCompany.create({ data: { name, document } }));
      return { body: { result: company.id } };
    }

    case "crm.contact.list": {
      const email = text(filter.EMAIL);
      const contacts = email ? await prisma.crmContact.findMany({ where: { email }, take: PAGE_SIZE, select: { id: true } }) : [];
      return { body: { result: contacts.map((c) => ({ ID: c.id })) } };
    }

    case "crm.contact.add": {
      const name = text(fields.NAME);
      if (!name) throw new BitrixError("NAME_REQUIRED", "NAME é obrigatório");
      const companyId = text(fields.COMPANY_ID);
      const role = text(fields.POST);
      const contact = await prisma.crmContact.create({
        data: {
          name,
          phone: firstValue(fields.PHONE) || null,
          email: firstValue(fields.EMAIL) || null,
          info: role ? `Cargo: ${role}` : null,
          companyId: companyId ? (await prisma.crmCompany.findUnique({ where: { id: companyId }, select: { id: true } }))?.id : null,
        },
      });
      return { body: { result: contact.id } };
    }

    case "crm.product.list": {
      const name = text(filter.NAME);
      const product = name ? await prisma.crmProduct.findUnique({ where: { name }, select: { id: true } }) : null;
      return { body: { result: product ? [{ ID: product.id }] : [] } };
    }

    case "crm.product.add": {
      const name = text(fields.NAME);
      if (!name) throw new BitrixError("NAME_REQUIRED", "NAME é obrigatório");
      // New catalog products start at 0, like Bitrix; the price is set later on /crm/products
      const product = await prisma.crmProduct.upsert({ where: { name }, update: {}, create: { name, price: 0 } });
      return { body: { result: product.id } };
    }

    default:
      throw new BitrixError("ERROR_METHOD_NOT_FOUND", `Método ${method} não suportado`);
  }
}

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
  | { type: "updated"; dealId: string; changedFields: string[] }
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

/** Parses `http_build_query` output (`filter[STAGE_ID]=..&fields[PHONE][0][VALUE]=..`) into nested objects. */
export function parseParams(search: URLSearchParams): Params {
  const root: Params = {};
  for (const [key, value] of search) {
    const path = key.replace(/\]/g, "").split("[");
    let node = root;
    for (const part of path.slice(0, -1)) node = (node[part] ??= {}) as Params;
    node[path[path.length - 1]] = value;
  }
  return root;
}

const obj = (value: unknown) => (value && typeof value === "object" ? (value as Params) : {});
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
/** `PHONE[0][VALUE]` style multi-fields */
const firstValue = (value: unknown) => text(obj(Object.values(obj(value))[0]).VALUE);

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
export async function notifyQxback(dealNumber: number) {
  const url = process.env.QXBACK_WEBHOOK_URL;
  const secret = process.env.QXBACK_WEBHOOK_SECRET;
  if (!url || !secret) return;

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        event: "ONCRMDEALUPDATE",
        "auth[application_token]": secret,
        "data[FIELDS][ID]": String(dealNumber),
      }),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
  } catch (error) {
    console.error("Falha ao avisar QXBACK do negócio alterado:", error);
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
  const number = Number(id);
  const deal = Number.isInteger(number) && number > 0
    ? await prisma.crmCard.findFirst({ where: { number, ...s.dealWhere }, select: dealSelect })
    : null;
  if (!deal) throw new BitrixError("NOT_FOUND", `Negócio ${String(id)} não encontrado`);
  return deal;
}

/** Recomputes the cached deal value from its products (same rule as the deal panel). */
async function syncDealValue(dealId: string) {
  const lines = await prisma.crmDealProduct.findMany({ where: { dealId }, select: { price: true, quantity: true } });
  const value = lines.reduce((sum, l) => sum + l.price.toNumber() * l.quantity, 0);
  return prisma.crmCard.update({ where: { id: dealId }, data: { value }, select: { stageId: true } });
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
      const start = Math.max(0, Number(params.start) || 0);
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
      // QXBACK only appends processing notes to the comment
      if (!("COMMENTS" in fields)) return { body: { result: true } };
      const result = await updateDeal(deal.id, { comment: String(fields.COMMENTS) });
      return {
        body: { result: true },
        effect: result.changed ? { type: "updated", dealId: deal.id, stageId: result.stageId, changedFields: result.changedFields } : undefined,
      };
    }

    case "crm.deal.productrows.get": {
      const deal = await findDeal(s, params.id);
      const lines = await prisma.crmDealProduct.findMany({ where: { dealId: deal.id }, orderBy: { order: "asc" } });
      return {
        body: {
          result: lines.map((l) => ({
            ID: l.id,
            PRODUCT_ID: l.productId,
            PRODUCT_NAME: l.name,
            PRICE: l.price.toNumber(),
            QUANTITY: l.quantity,
            DESCRIPTION: l.description ?? "",
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
        if (fields[uf] != null) customData[fieldId] = String(fields[uf]);
      }
      const companyId = text(fields.COMPANY_ID) || null;
      const contactId = text(fields.CONTACT_ID);

      const deal = await prisma.$transaction(async (tx) =>
        tx.crmCard.create({
          data: {
            title,
            value: Number(fields.OPPORTUNITY) || 0,
            stageId,
            companyId: companyId ? (await tx.crmCompany.findUnique({ where: { id: companyId }, select: { id: true } }))?.id : null,
            comment: text(fields.COMMENTS) || null,
            source: "QXBACK",
            customData,
            order: await tx.crmCard.count({ where: { stageId } }),
            history: { create: { type: "CREATED", data: { title } } },
            ...(contactId && (await tx.crmContact.findUnique({ where: { id: contactId }, select: { id: true } }))
              ? { contacts: { create: { contactId, order: 0 } } }
              : {}),
          },
          select: { id: true, number: true },
        })
      );
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
          price: Number(fields.PRICE) || 0,
          quantity: Math.max(0, Math.round(Number(fields.QUANTITY) || 1)),
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
      // CNPJ is unique: an existing company with it is the same company
      const existing = document && (await prisma.crmCompany.findUnique({ where: { document } }));
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
      const product = await prisma.crmProduct.upsert({ where: { name }, update: {}, create: { name, price: Number(fields.PRICE) || 0 } });
      return { body: { result: product.id } };
    }

    default:
      throw new BitrixError("ERROR_METHOD_NOT_FOUND", `Método ${method} não suportado`);
  }
}

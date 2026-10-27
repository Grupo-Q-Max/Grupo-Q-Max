/*
 * Bitrix24-compatible REST subset used by QXSIGN (Certificados Digitais).
 * Pipeline: qxsign
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { updateDeal } from "@/lib/crm-deal";

export type Params = Record<string, unknown>;

export class BitrixError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

export type Effect = { stageId: string } & (
  | { type: "created"; dealId: string }
  | { type: "updated"; dealId: string; changedFields: string[] }
  | { type: "value" }
);

const PAGE_SIZE = 50;

export const DEFAULT_QXSIGN_STAGES: Record<string, string> = {
  "PEDIDOS": "cmvgzn7coc228d984f4",
  "AGUARDANDO_FINANCEIRO": "cmvgzn7jzaab58d1dc2",
  "AGENDAMENTO_CS": "cmvgzn7r8dc66c43c49",
  "EMISSAO_NF": "cmvgzn7yod4dd286d3e",
  "EMISSOR_ABS": "cmvgzn864fc72f70e1e",
  "PESQUISA_SATISFACAO": "cmvgzn8defa0031d207",
  "CONCLUIDO_CS": "cmvgzn8kv27c545ab9a",
  "C21:NEW": "cmvgzn7coc228d984f4",
  "C21:PREPARATION": "cmvgzn7jzaab58d1dc2",
  "C21:PREPAYMENT_INVOICE": "cmvgzn7r8dc66c43c49",
  "C21:EXECUTING": "cmvgzn7yod4dd286d3e",
  "C21:FINAL_INVOICE": "cmvgzn864fc72f70e1e",
  "C21:WON": "cmvgzn8kv27c545ab9a",
  "C21:LOSE": "cmvgzn8defa0031d207"
};

function envMap(name: string): Record<string, string> {
  try {
    const val = process.env[name];
    if (!val) return DEFAULT_QXSIGN_STAGES;
    return { ...DEFAULT_QXSIGN_STAGES, ...JSON.parse(val) };
  } catch {
    return DEFAULT_QXSIGN_STAGES;
  }
}

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
const num = (value: unknown) => (typeof value === "string" && value.trim() !== "" ? Number(value) : NaN);
const firstValue = (value: unknown) => text(obj(Object.values(obj(value))[0]).VALUE);

export function isQxsignStage(stageId: string) {
  const stages = Object.values(envMap("QXSIGN_STAGES"));
  return stages.includes(stageId);
}

/**
 * Notifica o QXSign via Webhook quando um card do QXSign é alterado ou movido
 */
export async function notifyQxsign(dealNumber: number, event = "ONCRMDEALUPDATE", extra: Record<string, string> = {}) {
  const url = process.env.QXSIGN_WEBHOOK_URL;
  const secret = process.env.QXSIGN_WEBHOOK_SECRET;
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
    console.error("Falha ao avisar QXSign do negócio alterado:", error);
  }
}

export async function notifyQxsignStage(dealId: string, stageId: string) {
  const stages = envMap("QXSIGN_STAGES");
  const code = Object.keys(stages).find((k) => stages[k] === stageId) || stageId;
  if (!isQxsignStage(stageId)) return;

  const deal = await prisma.crmCard.findUnique({
    where: { id: dealId },
    select: { number: true, title: true, stage: { select: { name: true } } }
  });

  if (deal) {
    await notifyQxsign(deal.number, "ONCRMDEALSTAGE", {
      "data[FIELDS][STAGE_ID]": code,
      "data[FIELDS][STAGE_NAME]": deal.stage?.name || "",
      "data[FIELDS][TITLE]": deal.title,
    });
  }
}

const dealSelect = { id: true, number: true, title: true, stageId: true, comment: true, value: true, customData: true, updatedAt: true } as const;

export async function callQxsignMethod(method: string, params: Params): Promise<{ body: Params; effect?: Effect }> {
  const stages = envMap("QXSIGN_STAGES");
  const filter = obj(params.filter);
  const fields = obj(params.fields);

  switch (method) {
    case "crm.deal.list": {
      const stageCode = text(filter.STAGE_ID);
      const stageId = stages[stageCode] || stageCode;
      const where = stageId ? { stageId } : { stage: { pipeline: { name: "qxsign" } } };
      const start = Math.max(0, num(params.start) || 0);
      const [deals, total] = await Promise.all([
        prisma.crmCard.findMany({ where, orderBy: { number: "desc" }, skip: start, take: PAGE_SIZE, select: dealSelect }),
        prisma.crmCard.count({ where }),
      ]);
      return {
        body: {
          result: deals.map((d) => ({
            ID: String(d.number),
            TITLE: d.title,
            STAGE_ID: Object.keys(stages).find((k) => stages[k] === d.stageId) || d.stageId,
            OPPORTUNITY: d.value.toString(),
            COMMENTS: d.comment || "",
          })),
          total,
        },
      };
    }

    case "crm.deal.get": {
      const number = num(params.id);
      const deal = await prisma.crmCard.findFirst({ where: { number }, select: dealSelect });
      if (!deal) throw new BitrixError("NOT_FOUND", `Negócio ${params.id} não encontrado`);
      return {
        body: {
          result: {
            ID: String(deal.number),
            TITLE: deal.title,
            STAGE_ID: Object.keys(stages).find((k) => stages[k] === deal.stageId) || deal.stageId,
            OPPORTUNITY: deal.value.toString(),
            COMMENTS: deal.comment || "",
          },
        },
      };
    }

    case "crm.deal.add": {
      const stageCode = text(fields.STAGE_ID);
      const stageId = stages[stageCode] || stages["PEDIDOS"] || "cmvgzn7coc228d984f4";
      const title = text(fields.TITLE);
      if (!title) throw new BitrixError("TITLE_REQUIRED", "TITLE é obrigatório");

      const contactId = text(fields.CONTACT_ID);
      const opportunity = num(fields.OPPORTUNITY) || 0;
      const comments = text(fields.COMMENTS) || null;

      const deal = await prisma.$transaction(async (tx) => {
        const orderCount = await tx.crmCard.count({ where: { stageId } });
        return tx.crmCard.create({
          data: {
            title,
            value: opportunity,
            stageId,
            comment: comments,
            source: "QXSIGN",
            order: orderCount,
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

    case "crm.deal.update": {
      const number = num(params.id);
      const deal = await prisma.crmCard.findFirst({ where: { number }, select: { id: true, stageId: true } });
      if (!deal) throw new BitrixError("NOT_FOUND", `Negócio ${params.id} não encontrado`);

      const updateData: any = {};
      let stageIdToMove: string | undefined;

      if ("STAGE_ID" in fields) {
        const code = text(fields.STAGE_ID);
        stageIdToMove = stages[code] || code;
        updateData.stageId = stageIdToMove;
      }
      if ("COMMENTS" in fields && typeof fields.COMMENTS === "string") {
        updateData.comment = fields.COMMENTS;
      }
      if ("OPPORTUNITY" in fields) {
        updateData.value = num(fields.OPPORTUNITY) || 0;
      }

      const updated = await updateDeal(deal.id, updateData);
      return {
        body: { result: true },
        effect: updated.changed ? { type: "updated", dealId: deal.id, stageId: updated.stageId, changedFields: updated.changedFields } : undefined,
      };
    }

    case "crm.contact.add": {
      const name = text(fields.NAME);
      const lastName = text(fields.LAST_NAME);
      const fullName = [name, lastName].filter(Boolean).join(" ");
      if (!fullName) throw new BitrixError("NAME_REQUIRED", "NAME é obrigatório");

      const contact = await prisma.crmContact.create({
        data: {
          name: fullName,
          phone: firstValue(fields.PHONE) || null,
          email: firstValue(fields.EMAIL) || null,
          info: text(fields.UF_CRM_DOCUMENTO) ? `Doc: ${fields.UF_CRM_DOCUMENTO} (${fields.UF_CRM_TIPO_COMPRA || ""})` : null,
        },
      });
      return { body: { result: contact.id } };
    }

    default:
      throw new BitrixError("ERROR_METHOD_NOT_FOUND", `Método ${method} não suportado`);
  }
}

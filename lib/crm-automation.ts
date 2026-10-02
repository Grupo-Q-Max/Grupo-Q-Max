import type { CrmActivityType, CrmAutomationActivity, CrmTrigger, CrmTriggerType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyPipelineChanged } from "@/lib/crm-realtime";
import { type DealContext, customFieldKey, delayMs, fillPlaceholders, matchesConditions } from "@/lib/crm-automation-shared";

/*
 * Automation engine (Bitrix24-style "regras de automação" and "gatilhos").
 *
 * - Rules belong to a stage and run when a deal enters it, immediately or after
 *   a delay. Every execution is a CrmAutomationRun row: the table is both the
 *   queue (PENDING + runAt) and the log shown in the "Registros" tab.
 * - Triggers belong to a stage and move the deal into it when an event happens.
 *
 * Due runs are processed right after the request that created them (via
 * `after`), by the in-process ticker started in instrumentation-node.ts, and by
 * /api/crm/automation/cron for external schedulers.
 */

const SITE_URL = process.env.APP_URL ?? "https://qmaxbrasil.com.br";
const WEBHOOK_TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 3;
/** RUNNING rows older than this are considered abandoned (server restarted mid-run) */
const STALE_RUN_MS = 10 * 60_000;

const toText = (value: unknown) => {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object" && "toNumber" in value) return String((value as { toNumber(): number }).toNumber());
  return String(value);
};

/** Flat snapshot of the deal used by conditions and placeholders. */
export async function dealContext(cardId: string) {
  const deal = await prisma.crmCard.findUnique({
    where: { id: cardId },
    include: {
      stage: { select: { id: true, name: true, order: true, pipelineId: true, pipeline: { select: { name: true } } } },
      company: true,
      responsible: { select: { name: true } },
      contacts: { orderBy: { order: "asc" }, take: 1, include: { contact: true } },
    },
  });
  if (!deal) return null;

  const contact = deal.contacts[0]?.contact;
  const ctx: DealContext = {
    id: deal.id,
    number: toText(deal.number),
    title: deal.title,
    value: toText(deal.value),
    currency: deal.currency,
    status: deal.status,
    stage: deal.stage.name,
    pipeline: deal.stage.pipeline.name,
    responsible: deal.responsible?.name ?? "",
    company: deal.company?.name ?? "",
    companyDocument: toText(deal.company?.document),
    companyEmail: toText(deal.company?.email),
    companyPhone: toText(deal.company?.phone),
    contact: contact?.name ?? "",
    contactEmail: toText(contact?.email),
    contactPhone: toText(contact?.phone),
    source: toText(deal.source),
    dealType: toText(deal.dealType),
    startDate: toText(deal.startDate),
    closeDate: toText(deal.closeDate),
    comment: toText(deal.comment),
    url: `${SITE_URL}/crm/deal/details/${deal.number}`,
  };
  const custom = (deal.customData ?? {}) as Record<string, unknown>;
  for (const [key, value] of Object.entries(custom)) ctx[customFieldKey(key)] = toText(value);

  return { ctx, stage: deal.stage, responsibleId: deal.responsibleId };
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

/** Queues the stage's active rules for a deal that just entered it, then runs the due ones. */
export async function onDealEnteredStage(cardId: string, stageId: string) {
  try {
    const automations = await prisma.crmAutomation.findMany({
      where: { stageId, active: true },
      orderBy: { order: "asc" },
      select: { id: true, delayAmount: true, delayUnit: true },
    });
    if (automations.length === 0) return;

    // Runs that were waiting in another stage no longer apply (they'd be skipped anyway)
    await prisma.crmAutomationRun.updateMany({
      where: { cardId, status: "PENDING", NOT: { stageId } },
      data: { status: "SKIPPED", error: "O negócio saiu da etapa antes da execução" },
    });

    // +index ms keeps the rules' order when several run at the same moment
    const now = Date.now();
    await prisma.crmAutomationRun.createMany({
      data: automations.map((a, index) => ({
        automationId: a.id,
        cardId,
        stageId,
        runAt: new Date(now + delayMs(a.delayAmount, a.delayUnit) + index),
      })),
    });

    await processDueRuns();
  } catch (error) {
    console.error("[crm-automation] onDealEnteredStage failed", error);
  }
}

const globalForAutomation = globalThis as unknown as { qmaxAutomationBusy?: boolean; qmaxAutomationAgain?: boolean };

/** Claims and executes due runs one by one (in order). Safe to call concurrently. */
export async function processDueRuns(limit = 50) {
  // A call while another is running in this process schedules one more pass instead of overlapping
  if (globalForAutomation.qmaxAutomationBusy) {
    globalForAutomation.qmaxAutomationAgain = true;
    return 0;
  }
  globalForAutomation.qmaxAutomationBusy = true;
  let processed = 0;

  try {
    do {
      globalForAutomation.qmaxAutomationAgain = false;

      await prisma.crmAutomationRun.updateMany({
        where: { status: "RUNNING", updatedAt: { lt: new Date(Date.now() - STALE_RUN_MS) } },
        data: { status: "PENDING" },
      });

      const due = await prisma.crmAutomationRun.findMany({
        where: { status: "PENDING", runAt: { lte: new Date() } },
        orderBy: [{ runAt: "asc" }, { createdAt: "asc" }],
        take: limit,
        select: { id: true },
      });

      for (const { id } of due) {
        // Claim it, so another instance/cron call never runs it twice
        const claimed = await prisma.crmAutomationRun.updateMany({
          where: { id, status: "PENDING" },
          data: { status: "RUNNING", attempts: { increment: 1 } },
        });
        if (claimed.count === 0) continue;
        await processRun(id);
        processed++;
      }
    } while (globalForAutomation.qmaxAutomationAgain);
  } catch (error) {
    console.error("[crm-automation] processDueRuns failed", error);
  } finally {
    globalForAutomation.qmaxAutomationBusy = false;
  }
  return processed;
}

async function processRun(id: string) {
  const run = await prisma.crmAutomationRun.findUnique({
    where: { id },
    include: {
      automation: {
        include: {
          headers: { orderBy: { order: "asc" } },
          conditions: { orderBy: { order: "asc" } },
          activity: { include: { responsible: { select: { name: true } } } },
        },
      },
    },
  });
  if (!run) return;

  const skip = (reason: string) =>
    prisma.crmAutomationRun.update({ where: { id }, data: { status: "SKIPPED", error: reason } });

  const { automation } = run;
  const deal = await dealContext(run.cardId);
  if (!deal) return skip("Negócio não encontrado");
  if (deal.stage.id !== run.stageId) return skip("O negócio saiu da etapa antes da execução");
  if (!automation.active) return skip("Regra desativada");
  if (!matchesConditions(automation.conditions, deal.ctx)) return skip("Condições não atendidas");

  let outcome: ActionOutcome | string;
  if (automation.actionType === "CREATE_ACTIVITY") {
    outcome = automation.activity
      ? await createActivity(automation.activity, run.cardId, deal)
      : "Atividade da regra não configurada";
  } else {
    outcome = await sendWebhook(automation, deal.ctx);
  }
  if (typeof outcome === "string") return skip(outcome);
  const { request, httpStatus = null, responseBody = null, error } = outcome;

  const retry = error && run.attempts < MAX_ATTEMPTS;
  const status = error ? (retry ? "PENDING" : "FAILED") : "SUCCESS";
  await prisma.crmAutomationRun.update({
    where: { id },
    data: {
      status,
      error,
      request,
      httpStatus,
      responseBody,
      // Backoff: 1 min, then 4 min
      ...(retry && { runAt: new Date(Date.now() + run.attempts ** 2 * 60_000) }),
    },
  });

  // A created activity already shows in the deal timeline; log the run there only when it failed
  const logInTimeline = automation.actionType === "WEBHOOK" || status === "FAILED";
  if (status !== "PENDING" && logInTimeline) {
    await prisma.crmHistory.create({
      data: {
        cardId: run.cardId,
        type: "AUTOMATION_RUN",
        data: { name: automation.name, status, httpStatus, error },
      },
    });
  }
  if (status !== "PENDING") notifyPipelineChanged(deal.stage.pipelineId);
}

/** Result of an action: what was done (kept in the run log) and the error, if any. */
type ActionOutcome = {
  request: Prisma.InputJsonValue;
  httpStatus?: number | null;
  responseBody?: string | null;
  error: string | null;
};

type Deal = NonNullable<Awaited<ReturnType<typeof dealContext>>>;

/** WEBHOOK action. Returns a skip reason when the URL is not usable. */
async function sendWebhook(rule: WebhookRule, ctx: DealContext): Promise<ActionOutcome | string> {
  const request = buildWebhookRequest(rule, ctx);
  if (!request) return "URL do webhook não configurada";

  try {
    const res = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
      cache: "no-store",
    });
    const responseBody = (await res.text()).slice(0, 2000);
    return { request, httpStatus: res.status, responseBody, error: res.ok ? null : `HTTP ${res.status}` };
  } catch (e) {
    const error = e instanceof Error ? (e.name === "TimeoutError" ? "Tempo limite excedido" : e.message) : String(e);
    return { request, error };
  }
}

type ActivityConfig = CrmAutomationActivity & { responsible: { name: string } | null };

/** CREATE_ACTIVITY action: adds an activity to the deal, assigned and dated as configured. */
async function createActivity(config: ActivityConfig, cardId: string, deal: Deal): Promise<ActionOutcome> {
  const responsibleId = config.assignee === "MEMBER" ? config.responsibleId : deal.responsibleId;
  const deadline =
    config.deadlineAmount && config.deadlineUnit
      ? new Date(Date.now() + delayMs(config.deadlineAmount, config.deadlineUnit))
      : null;
  const title = fillPlaceholders(config.title, deal.ctx).trim() || "Atividade";
  const description = config.description ? fillPlaceholders(config.description, deal.ctx) : null;

  try {
    const activity = await prisma.crmActivity.create({
      data: { cardId, type: config.type, title, description, deadline, responsibleId },
      include: { responsible: { select: { name: true } } },
    });
    return {
      request: {
        activityId: activity.id,
        type: activity.type,
        title,
        responsible: activity.responsible?.name ?? null,
        deadline: deadline?.toISOString() ?? null,
      },
      error: null,
    };
  } catch (e) {
    return { request: { type: config.type, title }, error: e instanceof Error ? e.message : String(e) };
  }
}

type WebhookRule = {
  id: string;
  name: string;
  webhookUrl: string | null;
  webhookMethod: "GET" | "POST";
  webhookBody: string | null;
  headers: { key: string; value: string }[];
};

function buildWebhookRequest(rule: WebhookRule, ctx: DealContext) {
  const url = fillPlaceholders(rule.webhookUrl?.trim() ?? "", ctx, true);
  if (!/^https?:\/\//i.test(url)) return null;

  const method = rule.webhookMethod;
  const headers: Record<string, string> = {};
  for (const { key, value } of rule.headers) {
    if (key.trim()) headers[key.trim()] = fillPlaceholders(value, ctx);
  }

  let body: string | undefined;
  if (method === "POST") {
    // Without a custom body, send the deal snapshot as JSON
    body = rule.webhookBody?.trim()
      ? fillPlaceholders(rule.webhookBody, ctx)
      : JSON.stringify({ event: "deal.stage_entered", automation: { id: rule.id, name: rule.name }, deal: ctx });
    if (!Object.keys(headers).some((k) => k.toLowerCase() === "content-type")) {
      headers["Content-Type"] = "application/json";
    }
  }

  return { url, method, headers, body: body ?? null };
}

// ---------------------------------------------------------------------------
// Triggers
// ---------------------------------------------------------------------------

type TriggerEvent =
  | { type: "WEBHOOK_IN"; token: string }
  | { type: "FIELD_CHANGED"; fields: string[] }
  | { type: "ACTIVITY_COMPLETED"; activityType: CrmActivityType }
  | { type: "DEAL_CREATED" };

function triggerMatchesEvent(trigger: CrmTrigger, event: TriggerEvent) {
  switch (event.type) {
    case "WEBHOOK_IN":
      return trigger.webhookToken === event.token;
    case "FIELD_CHANGED":
      return !trigger.watchedField || event.fields.includes(trigger.watchedField);
    case "ACTIVITY_COMPLETED":
      return !trigger.activityType || trigger.activityType === event.activityType;
    case "DEAL_CREATED":
      return true;
  }
}

/**
 * Finds the first trigger of the deal's pipeline that matches the event and
 * moves the deal to its stage. Returns the new stage id, or null if nothing moved.
 */
export async function fireTriggers(cardId: string, event: TriggerEvent) {
  try {
    const deal = await dealContext(cardId);
    if (!deal) return null;

    const triggers = await prisma.crmTrigger.findMany({
      where: { type: event.type satisfies CrmTriggerType, active: true, stage: { pipelineId: deal.stage.pipelineId } },
      include: {
        stage: { select: { id: true, name: true, order: true } },
        conditions: { orderBy: { order: "asc" } },
      },
      orderBy: [{ stage: { order: "asc" } }, { order: "asc" }],
    });

    const trigger = triggers.find((t) => {
      if (t.stage.id === deal.stage.id) return false;
      if (!t.allowBackwards && t.stage.order < deal.stage.order) return false;
      return triggerMatchesEvent(t, event) && matchesConditions(t.conditions, deal.ctx);
    });
    if (!trigger) return null;

    await moveDealToStage(cardId, trigger.stage.id, { name: trigger.name, type: trigger.type });
    return trigger.stage.id;
  } catch (error) {
    console.error("[crm-automation] fireTriggers failed", error);
    return null;
  }
}

/** Moves a deal to the end of a stage of the same pipeline, logging it, and runs the stage's rules. */
export async function moveDealToStage(cardId: string, stageId: string, trigger?: { name: string; type: string }) {
  const moved = await prisma.$transaction(async (tx) => {
    const card = await tx.crmCard.findUniqueOrThrow({ where: { id: cardId }, include: { stage: true } });
    const to = await tx.crmStage.findUniqueOrThrow({ where: { id: stageId } });
    if (card.stageId === to.id || to.pipelineId !== card.stage.pipelineId) return null;

    await tx.crmCard.update({
      where: { id: cardId },
      data: {
        stageId: to.id,
        order: await tx.crmCard.count({ where: { stageId: to.id } }),
        history: {
          createMany: {
            data: [
              ...(trigger ? [{ type: "TRIGGER_FIRED", data: { name: trigger.name, trigger: trigger.type, to: to.name } }] : []),
              { type: "STAGE_CHANGED", data: { from: card.stage.name, to: to.name } },
            ],
          },
        },
      },
    });
    return to;
  });
  if (!moved) return;

  notifyPipelineChanged(moved.pipelineId);
  await onDealEnteredStage(cardId, moved.id);
}

import type {
  CrmActivityType,
  CrmAutomationActivity,
  CrmAutomationDealUpdate,
  CrmTrigger,
  CrmTriggerType,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyMember, notifyPipelineChanged, notifyStageChanged } from "@/lib/crm-realtime";
import { DealValidationError, activeCard, copyCard, snapshotBeforeMove, syncTaskStatus, updateDeal, validParent } from "@/lib/crm-deal";
import { escapeHtml, sendMail } from "@/lib/mail";

/** Templates and archived cards are off the board: no rules, triggers or QXBACK pushes for them. */
const isHiddenCard = async (cardId: string) => (await prisma.crmCard.count({ where: { id: cardId, NOT: activeCard } })) > 0;
import { notifyQxbackStage } from "@/lib/crm-qxback";
import { notifyRuleFailed } from "@/lib/crm-card-notify";
import { notifyQxsignStage } from "@/lib/crm-qxsign";
import {
  DEAL_STATUSES,
  FLOW_LIMITS,
  TASK_PRIORITIES,
  type DealContext,
  type DealStatus,
  type HttpMethod,
  methodHasBody,
  customFieldKey,
  delayMs,
  emailRecipients,
  fillPlaceholders,
  firstStep,
  isStartOn,
  matchesConditions,
  nextAfter,
  notifyMemberIds,
  stepLabel,
} from "@/lib/crm-automation-shared";

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
/** "Modificar negócio" runs allowed per deal within LOOP_WINDOW_MS, so rules that move a deal back and forth stop */
const LOOP_MAX_RUNS = 10;
const LOOP_WINDOW_MS = 5 * 60_000;
/** Finished runs (and their flow steps) are deleted after this; the deal timeline keeps its own entries */
const RUN_RETENTION_DAYS = 90;
const PRUNE_EVERY_MS = 60 * 60_000;
/** Webhook response kept in the log; in flows it is also what {{response.*}} reads, so a longer JSON can't be read */
const RESPONSE_LOG_CHARS = 16_000;
const RESPONSE_MAX_KEYS = 500;

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
    priority: deal.priority ?? "",
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
  if (await isHiddenCard(cardId)) return;
  // Every stage entry passes here (move, PATCH, automations, triggers, QXBACK route)
  await notifyQxbackStage(cardId, stageId).catch((error) => console.error("[crm-automation] QXBACK stage push failed", error));
  await notifyQxsignStage(cardId, stageId).catch((error) => console.error("[crm-automation] QXSIGN stage push failed", error));
  try {
    const automations = await prisma.crmAutomation.findMany({
      // Rows with flowStepId are the actions of flow steps, run by their flow
      where: { stageId, active: true, flowStepId: null, startOn: "STAGE_ENTERED" },
      orderBy: { order: "asc" },
      select: { id: true, delayAmount: true, delayUnit: true, execution: true },
    });
    if (automations.length === 0) return;

    // Runs that were waiting in another stage no longer apply (they'd be skipped anyway)
    await prisma.crmAutomationRun.updateMany({
      where: { cardId, status: { in: ["PENDING", "WAITING"] }, NOT: { stageId } },
      data: { status: "SKIPPED", error: "O negócio saiu da etapa antes da execução" },
    });

    // One by one, so a SEQUENTIAL rule can point at the run of the rule before it.
    // +index ms keeps the rules' order when several run at the same moment.
    const now = Date.now();
    await prisma.$transaction(async (tx) => {
      let previousRunId: string | null = null;
      for (const [index, a] of automations.entries()) {
        const waits = a.execution === "SEQUENTIAL" && previousRunId !== null;
        const run: { id: string } = await tx.crmAutomationRun.create({
          data: {
            automationId: a.id,
            cardId,
            stageId,
            ...(waits
              ? { status: "WAITING", afterRunId: previousRunId, runAt: new Date(now) } // runAt set on release
              : { runAt: new Date(now + delayMs(a.delayAmount, a.delayUnit) + index) }),
          },
          select: { id: true },
        });
        previousRunId = run.id;
      }
    });

    await processDueRuns();
  } catch (error) {
    console.error("[crm-automation] onDealEnteredStage failed", error);
  }
}

const globalForAutomation = globalThis as unknown as {
  qmaxAutomationBusy?: boolean;
  qmaxAutomationAgain?: boolean;
  qmaxAutomationPrunedAt?: number;
};

/** Deletes old finished runs, at most once per PRUNE_EVERY_MS per process. Steps go with them (FK cascade). */
async function pruneOldRuns() {
  const now = Date.now();
  if (now - (globalForAutomation.qmaxAutomationPrunedAt ?? 0) < PRUNE_EVERY_MS) return;
  globalForAutomation.qmaxAutomationPrunedAt = now;
  try {
    // ponytail: one DELETE for everything expired; delete in batches if the first prune in production is slow
    await prisma.crmAutomationRun.deleteMany({
      where: { status: { in: [...FINISHED] }, updatedAt: { lt: new Date(now - RUN_RETENTION_DAYS * 86_400_000) } },
    });
  } catch (error) {
    console.error("[crm-automation] pruneOldRuns failed", error);
  }
}

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
    await pruneOldRuns();
    do {
      globalForAutomation.qmaxAutomationAgain = false;

      await prisma.crmAutomationRun.updateMany({
        where: { status: "RUNNING", updatedAt: { lt: new Date(Date.now() - STALE_RUN_MS) } },
        data: { status: "PENDING" },
      });
      const released = await releaseSequentialRuns();

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
      // A finished run may release the next SEQUENTIAL rule: keep going while there is progress
      if (released > 0 || due.length > 0) globalForAutomation.qmaxAutomationAgain = true;
    } while (globalForAutomation.qmaxAutomationAgain);
  } catch (error) {
    console.error("[crm-automation] processDueRuns failed", error);
  } finally {
    globalForAutomation.qmaxAutomationBusy = false;
  }
  return processed;
}

const FINISHED = ["SUCCESS", "FAILED", "SKIPPED"] as const;

/** "Reexecutar": a failed run goes back to the queue with a fresh retry budget; a flow resumes at the step that failed. */
export async function retryRun(id: string) {
  const { count } = await prisma.crmAutomationRun.updateMany({
    where: { id, status: "FAILED" },
    data: { status: "PENDING", runAt: new Date(), attempts: 0, error: null },
  });
  if (count) await processDueRuns();
  return count > 0;
}

/**
 * "Testar": what a saved rule would do for a deal, without running it — nothing is
 * saved, sent or queued. Flows only show their start conditions: their steps depend
 * on waits and on what the earlier steps change.
 */
export async function testRule(automationId: string, cardId: string) {
  const [rule, deal] = await Promise.all([
    prisma.crmAutomation.findUnique({
      where: { id: automationId },
      include: {
        ...actionInclude,
        conditions: { orderBy: { order: "asc" } },
        dealUpdate: { include: { stage: { select: { name: true } }, responsible: { select: { name: true } }, addTag: { select: { name: true } } } },
        stage: { select: { pipeline: { select: { fieldsConfig: true } } } },
        _count: { select: { steps: true } },
      },
    }),
    dealContext(cardId),
  ]);
  if (!rule || !deal) return null;

  const fill = (template: string | null | undefined) => fillPlaceholders(template ?? "", deal.ctx).trim();
  const lines: string[] = [];
  switch (rule.actionType) {
    case "WEBHOOK": {
      const request = buildWebhookRequest(rule, deal.ctx);
      if (!request) {
        lines.push("URL do webhook não configurada");
        break;
      }
      const { headers } = redactRequest(request);
      lines.push(`${request.method} ${request.url}`, ...Object.entries(headers).map(([k, v]) => `${k}: ${v}`));
      if (request.body) lines.push("", request.body);
      break;
    }
    case "CREATE_ACTIVITY": {
      const a = rule.activity;
      if (!a) break;
      const to = a.assignee === "MEMBER" ? a.responsible?.name : deal.ctx.responsible;
      lines.push(`Título: ${fill(a.title)}`);
      if (a.description) lines.push(`Descrição: ${fill(a.description)}`);
      lines.push(`Para: ${to || "ninguém"}`);
      break;
    }
    case "NOTIFY":
      if (rule.notify) lines.push(`Comentário: ${fill(rule.notify.message) || "(vazio: a regra vai falhar)"}`);
      break;
    case "UPDATE_DEAL": {
      const u = rule.dealUpdate;
      if (!u) break;
      if (u.stage) lines.push(`Etapa: ${u.stage.name}`);
      if (u.status) lines.push(`Status: ${DEAL_STATUSES[u.status as DealStatus] ?? u.status}`);
      if (u.responsible) lines.push(`Responsável: ${u.responsible.name}`);
      if (u.priority) lines.push(`Prioridade: ${TASK_PRIORITIES[u.priority]}`);
      if (u.addTag) lines.push(`Etiqueta adicionada: ${u.addTag.name}`);
      const fields = (Array.isArray(rule.stage.pipeline.fieldsConfig) ? rule.stage.pipeline.fieldsConfig : []) as { id: string; name: string }[];
      for (const [id, template] of Object.entries((u.customData ?? {}) as Record<string, string>)) {
        lines.push(`${fields.find((f) => f.id === id)?.name ?? id}: ${fill(template) || "(limpa o campo)"}`);
      }
      break;
    }
    case "CREATE_SUBTASK": {
      const s = rule.subtask;
      if (!s) break;
      lines.push(`Subtarefa: ${fill(s.title)}`, `Para: ${(s.assignee === "MEMBER" ? s.responsible?.name : deal.ctx.responsible) || "ninguém"}`);
      if (s.deadlineDays !== null) lines.push(`Prazo: ${s.deadlineDays} dia(s) após a execução`);
      break;
    }
    case "ADD_CHECKLIST":
      lines.push(...rule.checklist.map((i) => `☐ ${fill(i.title)}`));
      break;
    case "SEND_EMAIL": {
      const e = rule.email;
      if (!e) break;
      const to = emailRecipients(fill(e.to));
      lines.push(`Para: ${to.join(", ") || "(nenhum e-mail válido: a regra vai falhar)"}`, `Assunto: ${fill(e.subject)}`, "", fill(e.body));
      break;
    }
    case "COPY_CARD":
      lines.push(rule.copy?.stage ? `Copiar para: ${rule.copy.stage.pipeline.name} → ${rule.copy.stage.name}` : "A etapa de destino foi excluída");
      if (rule.copy?.link) lines.push("Vincula a cópia ao original");
      break;
    case "FLOW":
      lines.push(`Fluxo com ${rule._count.steps} passo(s). Os passos só são avaliados na execução real.`);
      break;
  }

  const conditions = rule.conditions.map((c) => ({
    field: c.field,
    operator: c.operator,
    value: c.value,
    actual: deal.ctx[c.field] ?? "",
    ok: matchesConditions([c], deal.ctx),
  }));
  return {
    matches: conditions.every((c) => c.ok),
    inStage: deal.stage.id === rule.stageId,
    active: rule.active,
    conditions,
    preview: lines.join("\n") || "Ação da regra não configurada",
  };
}

/** "Cancelar": a run that has not started is skipped; a SEQUENTIAL rule waiting for it is released as usual. */
export async function cancelRun(id: string, by: string) {
  const { count } = await prisma.crmAutomationRun.updateMany({
    where: { id, status: { in: ["PENDING", "WAITING"] } },
    data: { status: "SKIPPED", error: `Cancelada por ${by}` },
  });
  if (count) await processDueRuns();
  return count > 0;
}

/**
 * Turns WAITING runs (SEQUENTIAL rules) into PENDING once the run they wait for
 * finished, whatever path finished it (success, failure, skip). Their delay
 * counts from that moment. Returns how many were released.
 */
async function releaseSequentialRuns() {
  const ready = await prisma.crmAutomationRun.findMany({
    where: { status: "WAITING", OR: [{ afterRunId: null }, { afterRun: { status: { in: [...FINISHED] } } }] },
    select: {
      id: true,
      afterRun: { select: { updatedAt: true } },
      automation: { select: { delayAmount: true, delayUnit: true } },
    },
  });
  for (const run of ready) {
    const start = run.afterRun?.updatedAt.getTime() ?? Date.now();
    await prisma.crmAutomationRun.updateMany({
      where: { id: run.id, status: "WAITING" },
      data: { status: "PENDING", runAt: new Date(start + delayMs(run.automation.delayAmount, run.automation.delayUnit)) },
    });
  }
  return ready.length;
}

/** Action columns and tables of a rule (or of the child rule of a flow step). */
const actionInclude = {
  headers: { orderBy: { order: "asc" } },
  activity: { include: { responsible: { select: { name: true } } } },
  dealUpdate: true,
  notify: { include: { members: { select: { memberId: true } } } },
  subtask: { include: { responsible: { select: { name: true } } } },
  checklist: { orderBy: { order: "asc" } },
  email: true,
  copy: { include: { stage: { select: { name: true, pipeline: { select: { name: true } } } } } },
} satisfies Prisma.CrmAutomationInclude;

type ActionRule = Prisma.CrmAutomationGetPayload<{ include: typeof actionInclude }>;

/** Action tables of a rule as the board's dialogs edit them. */
const boardActionInclude = {
  headers: { orderBy: { order: "asc" } },
  activity: true,
  dealUpdate: true,
  notify: { include: { members: { select: { memberId: true } } } },
  subtask: true,
  checklist: { orderBy: { order: "asc" } },
  email: true,
  copy: true,
} satisfies Prisma.CrmAutomationInclude;

/** Rules of a stage as the automation board shows them; flows bring their steps as a flat list. */
export const boardAutomations = {
  where: { flowStepId: null },
  orderBy: { order: "asc" },
  include: {
    ...boardActionInclude,
    conditions: { orderBy: { order: "asc" } },
    steps: {
      orderBy: { order: "asc" },
      include: {
        conditions: { orderBy: { order: "asc" } },
        actions: { take: 1, include: boardActionInclude },
      },
    },
  },
} satisfies Prisma.CrmStage$automationsArgs;

/** Runs the action of a rule. Returns a skip reason when the action can't run. */
async function runAction(rule: ActionRule, cardId: string, deal: Deal): Promise<ActionOutcome | string> {
  switch (rule.actionType) {
    case "CREATE_ACTIVITY":
      return rule.activity ? createActivity(rule.activity, cardId, deal) : "Atividade da regra não configurada";
    case "UPDATE_DEAL":
      return rule.dealUpdate ? updateDealAction(rule.dealUpdate, cardId, deal) : "Alterações da regra não configuradas";
    case "NOTIFY":
      return rule.notify ? notifyAction(rule.notify, cardId, deal) : "Notificação da regra não configurada";
    case "WEBHOOK":
      return sendWebhook(rule, deal.ctx);
    case "CREATE_SUBTASK":
      return rule.subtask ? createSubtask(rule.subtask, cardId, deal) : "Subtarefa da regra não configurada";
    case "ADD_CHECKLIST":
      return rule.checklist.length ? addChecklist(rule.checklist, cardId, deal) : "Checklist da regra sem itens";
    case "SEND_EMAIL":
      return rule.email ? sendEmailAction(rule.email, deal) : "E-mail da regra não configurado";
    case "COPY_CARD":
      return rule.copy ? copyCardAction(rule.copy, rule.name, cardId) : "Cópia da regra não configurada";
    case "FLOW":
      return "Um fluxo não pode ser a ação de outro fluxo";
  }
}

async function processRun(id: string) {
  const run = await prisma.crmAutomationRun.findUnique({
    where: { id },
    include: { automation: { include: { ...actionInclude, conditions: { orderBy: { order: "asc" } } } } },
  });
  if (!run) return;

  const skip = (reason: string) =>
    prisma.crmAutomationRun.update({ where: { id }, data: { status: "SKIPPED", error: reason } });

  const { automation } = run;
  const deal = await dealContext(run.cardId);
  if (!deal) return skip("Negócio não encontrado");
  if (deal.stage.id !== run.stageId) return skip("O negócio saiu da etapa antes da execução");
  if (!automation.active) return skip("Regra desativada");
  // A flow checks its start conditions once, not again when it resumes after a wait
  if (run.stepCount === 0 && !matchesConditions(automation.conditions, deal.ctx)) return skip("Condições não atendidas");

  if (automation.actionType === "FLOW") return processFlowRun(run, automation.name, deal);

  const outcome = await runAction(automation, run.cardId, deal);
  if (typeof outcome === "string") return skip(outcome);
  const { request, httpStatus = null, responseBody = null, error } = outcome;

  const retry = error && !outcome.final && run.attempts < MAX_ATTEMPTS;
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

  if (status !== "PENDING") await logInTimeline(run.cardId, automation.name, automation.actionType, status, httpStatus, error);
  if (status === "FAILED") await alertRuleFailed(run.cardId, automation.name, error);
  if (status !== "PENDING") notifyPipelineChanged(deal.stage.pipelineId);
  if (status === "SUCCESS") await outcome.followUp?.();
}

/** Bell alert for a run that failed for good; a failure here must not stop the queue. */
const alertRuleFailed = (cardId: string, name: string, error: string | null) =>
  notifyRuleFailed(cardId, name, error).catch((e) => console.error("[crm-automation] notifyRuleFailed failed", e));

/** Adds a finished rule execution (success or failure; skips are left out) to the deal timeline. */
const logInTimeline = (cardId: string, name: string, actionType: string, status: string, httpStatus: number | null, error: string | null) =>
  prisma.crmHistory.create({ data: { cardId, type: "AUTOMATION_RUN", data: { name, actionType, status, httpStatus, error } } });

/**
 * Claims step `seq` of a flow run by inserting its log row: the (runId, seq)
 * unique key makes a step run at most once. An existing FAILED row is a retry
 * and is claimed again; a RUNNING one means the server stopped in the middle of
 * the step, so it is marked as interrupted instead of being run again.
 */
async function claimStep(runId: string, seq: number, data: Omit<Prisma.CrmAutomationRunStepUncheckedCreateInput, "runId" | "seq" | "status">) {
  try {
    const row = await prisma.crmAutomationRunStep.create({ data: { ...data, runId, seq, status: "RUNNING" } });
    return row.id;
  } catch (e) {
    if ((e as { code?: string }).code !== "P2002") throw e;
  }
  const existing = await prisma.crmAutomationRunStep.findUniqueOrThrow({ where: { runId_seq: { runId, seq } } });
  if (existing.status === "FAILED") {
    const claimed = await prisma.crmAutomationRunStep.updateMany({
      where: { id: existing.id, status: "FAILED" },
      data: { status: "RUNNING", error: null },
    });
    if (claimed.count) return existing.id;
  }
  await prisma.crmAutomationRunStep.update({
    where: { id: existing.id },
    data: { status: "FAILED", error: "Interrompido: o servidor reiniciou durante o passo" },
  });
  return null;
}

type FlowRunRow = { id: string; automationId: string; cardId: string; stageId: string; stepId: string | null; stepCount: number; attempts: number };

/**
 * Runs a FLOW rule from its current step until it ends, reaches a wait (the run
 * goes back to PENDING with runAt = end of the wait and the next step saved) or
 * fails. Every step is saved as a CrmAutomationRunStep (the path shown in
 * "Registros") together with the run's next step, so a restart resumes where it
 * stopped. The deal is checked before every step: if it left the stage the flow stops.
 */
async function processFlowRun(run: FlowRunRow, flowName: string, startDeal: Deal) {
  const steps = await prisma.crmAutomationStep.findMany({
    where: { flowId: run.automationId },
    include: { conditions: { orderBy: { order: "asc" } }, actions: { include: actionInclude, take: 1 } },
  });

  let deal = startDeal;
  const finish = async (status: "SUCCESS" | "FAILED" | "SKIPPED", error: string | null) => {
    await prisma.crmAutomationRun.update({ where: { id: run.id }, data: { status, error } });
    // One timeline entry per flow, not per step
    if (status !== "SKIPPED") await logInTimeline(run.cardId, flowName, "FLOW", status, null, error);
    if (status === "FAILED") await alertRuleFailed(run.cardId, flowName, error);
    notifyPipelineChanged(deal.stage.pipelineId);
  };

  let seq = run.stepCount;
  let attempts = run.attempts;
  let step = run.stepId ? steps.find((s) => s.id === run.stepId) ?? null : seq === 0 ? firstStep(steps) : null;
  if (!step && seq > 0) return finish("SKIPPED", "O passo do fluxo foi removido");

  for (let executed = 0; step; executed++) {
    if (executed >= FLOW_LIMITS.maxExecuted) {
      return finish("FAILED", `Limite de ${FLOW_LIMITS.maxExecuted} passos por execução atingido`);
    }
    if (executed > 0) {
      const fresh = await dealContext(run.cardId);
      if (!fresh) return finish("SKIPPED", "Negócio não encontrado");
      deal = fresh;
      if (deal.stage.id !== run.stageId) return finish("SKIPPED", "O negócio saiu da etapa antes da execução");
    }
    // Read from the log (not memory): a flow resumed after a wait still sees the response
    const lastWebhook = await prisma.crmAutomationRunStep.findFirst({
      where: { runId: run.id, actionType: "WEBHOOK", status: "SUCCESS" },
      orderBy: { seq: "desc" },
      select: { responseBody: true },
    });
    if (lastWebhook) deal = { ...deal, ctx: { ...deal.ctx, ...responseContext(lastWebhook.responseBody) } };

    const current = step;
    const action = current.actions[0] ?? null;
    const logId = await claimStep(run.id, seq, {
      stepId: current.id,
      stepType: current.type,
      actionType: action?.actionType ?? null,
      label: stepLabel(current, action),
    });
    if (!logId) return finish("FAILED", "Interrompido: o servidor reiniciou durante o passo");

    let next = nextAfter(steps, current);
    let log: Prisma.CrmAutomationRunStepUpdateInput;
    let runUntil: Date | null = null;
    let followUp: (() => Promise<void>) | undefined;

    if (current.type === "CONDITION") {
      const branch = matchesConditions(current.conditions, deal.ctx) ? "THEN" : "ELSE";
      next = firstStep(steps, current.id, branch) ?? next;
      log = { status: "SUCCESS", branch };
    } else if (current.type === "WAIT") {
      runUntil = new Date(Date.now() + delayMs(current.waitAmount ?? 0, current.waitUnit ?? "MINUTES"));
      log = { status: "SUCCESS", request: { until: runUntil.toISOString() } };
    } else {
      const outcome = action ? await runAction(action, run.cardId, deal) : "Ação do passo não configurada";
      if (typeof outcome === "string") {
        log = { status: "SKIPPED", error: outcome };
      } else {
        const { request, httpStatus = null, responseBody = null, error } = outcome;
        log = { status: error ? "FAILED" : "SUCCESS", request, httpStatus, responseBody, error };
        if (error) {
          await prisma.crmAutomationRunStep.update({ where: { id: logId }, data: log });
          // Same retry as simple rules; the step is not advanced, so the retry runs it again
          if (!outcome.final && attempts < MAX_ATTEMPTS) {
            await prisma.crmAutomationRun.update({
              where: { id: run.id },
              data: { status: "PENDING", error, runAt: new Date(Date.now() + attempts ** 2 * 60_000) },
            });
            return;
          }
          return finish("FAILED", `${stepLabel(current, action)}: ${error}`);
        }
        followUp = outcome.followUp;
      }
    }

    // Log and next step saved together: a restart resumes after this step, never on it
    await prisma.$transaction([
      prisma.crmAutomationRunStep.update({ where: { id: logId }, data: log }),
      prisma.crmAutomationRun.update({
        where: { id: run.id },
        data: {
          stepId: next?.id ?? null,
          stepCount: seq + 1,
          error: null,
          // The next step starts with a fresh retry budget
          attempts: runUntil ? 0 : 1,
          ...(runUntil && next && { status: "PENDING", runAt: runUntil }),
        },
      }),
    ]);
    seq++;
    attempts = 1;
    if (followUp) await followUp();
    if (runUntil && next) return notifyPipelineChanged(deal.stage.pipelineId);
    step = next;
  }

  return finish("SUCCESS", null);
}

/** A webhook's JSON response as "response.<path>" keys (arrays by index: response.items.0.id); not JSON = none. */
function responseContext(body: string | null): DealContext {
  const ctx: DealContext = {};
  let data: unknown;
  try {
    data = JSON.parse(body ?? "");
  } catch {
    return ctx;
  }
  const walk = (value: unknown, path: string) => {
    if (Object.keys(ctx).length >= RESPONSE_MAX_KEYS) return;
    if (value !== null && typeof value === "object") {
      for (const [key, child] of Object.entries(value)) walk(child, `${path}.${key}`);
    } else {
      ctx[path] = toText(value);
    }
  };
  walk(data, "response");
  return ctx;
}

/** Result of an action: what was done (kept in the run log) and the error, if any. */
type ActionOutcome = {
  request: Prisma.InputJsonValue;
  httpStatus?: number | null;
  responseBody?: string | null;
  error: string | null;
  /** The error would happen again: fail without retrying */
  final?: boolean;
  /** Runs after the run is saved (e.g. the rules of the stage the deal was moved to) */
  followUp?: () => Promise<void>;
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
    // Masked before the cut, so a secret split by slice() can't leak half of it
    const responseBody = redactSecrets(await res.text(), request.headers).slice(0, RESPONSE_LOG_CHARS);
    return { request: redactRequest(request), httpStatus: res.status, responseBody, error: res.ok ? null : `HTTP ${res.status}` };
  } catch (e) {
    const error = e instanceof Error ? (e.name === "TimeoutError" ? "Tempo limite excedido" : e.message) : String(e);
    return { request: redactRequest(request), error };
  }
}

const SECRET_HEADER = /authorization|cookie|token|secret|key|password|signature/i;

/** Copy of a webhook request for the run log, without the values of credential headers. */
function redactRequest<T extends { headers: Record<string, string> }>(request: T): T {
  const headers = Object.fromEntries(
    Object.entries(request.headers).map(([key, value]) => [key, SECRET_HEADER.test(key) ? "••••" : value]),
  );
  return { ...request, headers };
}

/**
 * Masks in `text` (e.g. a response that echoes the request) the values of the credential
 * headers, whole and without their scheme ("Bearer abc" → also "abc"). Short values are kept
 * so common words aren't masked.
 */
function redactSecrets(text: string, headers: Record<string, string>) {
  const secrets = Object.entries(headers)
    .filter(([key]) => SECRET_HEADER.test(key))
    .flatMap(([, value]) => [value.trim(), value.trim().split(/\s+/).pop() ?? ""])
    .filter((value) => value.length >= 6)
    // Longest first, so "Bearer abc" is masked whole before "abc"
    .sort((a, b) => b.length - a.length);
  return secrets.reduce((masked, secret) => masked.replaceAll(secret, "••••"), text);
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

/**
 * UPDATE_DEAL action: changes the configured fields (custom fields merged into
 * the current ones), then moves the deal. Like a manual edit, a move runs the
 * new stage's rules and other changes may fire "campo alterado" triggers.
 */
async function updateDealAction(config: CrmAutomationDealUpdate, cardId: string, deal: Deal): Promise<ActionOutcome> {
  const since = new Date(Date.now() - LOOP_WINDOW_MS);
  const [recentRuns, recentSteps] = await Promise.all([
    prisma.crmAutomationRun.count({
      where: { cardId, status: "SUCCESS", automation: { actionType: "UPDATE_DEAL" }, updatedAt: { gte: since } },
    }),
    // "Modificar negócio" steps of flows count too
    prisma.crmAutomationRunStep.count({
      where: { actionType: "UPDATE_DEAL", status: "SUCCESS", updatedAt: { gte: since }, run: { cardId } },
    }),
  ]);
  if (recentRuns + recentSteps >= LOOP_MAX_RUNS) {
    return {
      request: { changes: [] },
      error: `Possível loop de automações: o negócio foi modificado ${LOOP_MAX_RUNS} vezes em poucos minutos`,
      final: true,
    };
  }

  const card = await prisma.crmCard.findUniqueOrThrow({
    where: { id: cardId },
    select: { customData: true, stage: { select: { pipeline: { select: { fieldsConfig: true } } } } },
  });
  const fieldsConfig = (Array.isArray(card.stage.pipeline.fieldsConfig) ? card.stage.pipeline.fieldsConfig : []) as {
    id: string;
    name: string;
  }[];
  const fieldName = (id: string) => fieldsConfig.find((f) => f.id === id)?.name ?? id;

  const changes: Record<string, unknown> = {};
  const customLog: { label: string; from: string | null; to: string | null }[] = [];
  const configured = (config.customData ?? {}) as Record<string, string>;
  if (Object.keys(configured).length) {
    const before = (card.customData ?? {}) as Record<string, unknown>;
    const merged: Record<string, unknown> = { ...before };
    for (const [id, template] of Object.entries(configured)) {
      const value = fillPlaceholders(template, deal.ctx).trim();
      if (value) merged[id] = value;
      else delete merged[id];
      const from = toText(before[id]) || null;
      if (from !== (value || null)) customLog.push({ label: fieldName(id), from, to: value || null });
    }
    changes.customData = merged;
  }
  if (config.responsibleId) changes.responsibleId = config.responsibleId;
  if (config.priority) changes.priority = config.priority;
  if (config.addTagId) {
    // updateDeal replaces the tag list: keep the card's tags and add the rule's
    const tags = await prisma.crmCardTag.findMany({ where: { cardId }, select: { tagId: true } });
    changes.tags = [...new Set([...tags.map((t) => t.tagId), config.addTagId])];
  }
  if (config.status) changes.status = config.status;
  if (config.stageId) changes.stageId = config.stageId;

  try {
    const result = await updateDeal(cardId, changes);
    const statusLabel = (v: unknown) => DEAL_STATUSES[v as DealStatus] ?? String(v ?? "");
    const log = result.history.flatMap((h) => {
      const data = (h.data ?? {}) as { field?: string; label?: string; from?: string | null; to?: string | null };
      if (h.type === "STAGE_CHANGED") return [{ label: "Etapa", from: data.from ?? null, to: data.to ?? null }];
      if (h.type === "STATUS_CHANGED") return [{ label: "Status", from: statusLabel(data.from), to: statusLabel(data.to) }];
      if (data.field === "customData") return customLog;
      return [{ label: data.label ?? data.field ?? "", from: data.from ?? null, to: data.to ?? null }];
    });

    return {
      request: { changes: log },
      error: null,
      followUp: async () => {
        if (result.recurringCopy) await onDealEnteredStage(result.recurringCopy.id, result.recurringCopy.stageId);
        if (result.movedTo) await onDealEnteredStage(cardId, result.movedTo);
        else if (result.changedFields.length) await fireTriggers(cardId, { type: "FIELD_CHANGED", fields: result.changedFields });
      },
    };
  } catch (e) {
    return { request: { changes: [] }, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * NOTIFY action ("Adicionar notificação" in Bitrix24): adds the message as a
 * comment in the deal timeline and notifies the deal's responsible and/or the
 * configured members in the CRM bell.
 */
async function notifyAction(config: ActionRule["notify"] & {}, cardId: string, deal: Deal): Promise<ActionOutcome> {
  const message = fillPlaceholders(config.message, deal.ctx).trim();
  if (!message) return { request: { message, notified: [] }, error: "Mensagem vazia", final: true };

  const ids = new Set(notifyMemberIds(config));
  if (config.notifyResponsible && deal.responsibleId) ids.add(deal.responsibleId);
  if (config.notifyAssignees) {
    const [assignees, observers] = await Promise.all([
      prisma.crmCardAssignee.findMany({ where: { cardId }, select: { memberId: true } }),
      prisma.crmDealObserver.findMany({ where: { dealId: cardId }, select: { memberId: true } }),
    ]);
    for (const { memberId } of [...assignees, ...observers]) ids.add(memberId);
  }

  try {
    const { comment, members } = await prisma.$transaction(async (tx) => {
      // Members removed after the rule was saved are ignored
      const members = await tx.teamMember.findMany({ where: { id: { in: [...ids] } }, select: { id: true, name: true } });
      const comment = await tx.crmActivity.create({ data: { cardId, type: "COMMENT", title: message } });
      await tx.crmNotification.createMany({ data: members.map((m) => ({ memberId: m.id, cardId, message })) });
      return { comment, members };
    });
    members.forEach((m) => notifyMember(m.id));
    return { request: { commentId: comment.id, message, notified: members.map((m) => m.name) }, error: null };
  } catch (e) {
    return { request: { message, notified: [] }, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * CREATE_SUBTASK action: a subtask of the deal in the deal's stage (same rules as "Adicionar
 * subtarefa": one level). A deal that is itself a subtask is skipped, so the rule doesn't fail
 * again when the new subtask enters the same stage.
 */
async function createSubtask(config: ActionRule["subtask"] & {}, cardId: string, deal: Deal): Promise<ActionOutcome | string> {
  const card = await prisma.crmCard.findUnique({ where: { id: cardId }, select: { parentId: true, stageId: true } });
  if (!card) return "Negócio não encontrado";
  if (card.parentId) return "O negócio já é uma subtarefa";

  const title = fillPlaceholders(config.title, deal.ctx).trim() || "Subtarefa";
  const responsibleId = config.assignee === "MEMBER" ? config.responsibleId : deal.responsibleId;
  const closeDate =
    config.deadlineDays === null ? null : new Date(`${new Date(Date.now() + config.deadlineDays * 86_400_000).toISOString().slice(0, 10)}T00:00:00Z`);
  try {
    const subtask = await prisma.$transaction(async (tx) => {
      await validParent(tx, null, cardId, deal.stage.pipelineId);
      return tx.crmCard.create({
        data: {
          title,
          stageId: card.stageId,
          order: await tx.crmCard.count({ where: { stageId: card.stageId } }),
          parentId: cardId,
          responsibleId,
          closeDate,
          history: { create: { type: "CREATED", data: { title, automation: true } } },
        },
        select: { id: true, number: true, stageId: true, responsible: { select: { name: true } } },
      });
    });
    return {
      request: { subtaskNumber: subtask.number, title, responsible: subtask.responsible?.name ?? null, deadline: closeDate?.toISOString() ?? null },
      error: null,
      // Like a subtask added by hand: the board refreshes and the stage's rules/triggers see it
      followUp: async () => {
        await notifyStageChanged(subtask.stageId);
        if (!(await fireTriggers(subtask.id, { type: "DEAL_CREATED" }))) await onDealEnteredStage(subtask.id, subtask.stageId);
      },
    };
  } catch (e) {
    const final = e instanceof DealValidationError;
    return { request: { title }, error: e instanceof Error ? e.message : String(e), final };
  }
}

/** ADD_CHECKLIST action: the items become TODO activities of the deal; an item it already has open is not added again. */
async function addChecklist(items: ActionRule["checklist"], cardId: string, deal: Deal): Promise<ActionOutcome> {
  const titles = [...new Set(items.map((i) => fillPlaceholders(i.title, deal.ctx).trim()).filter(Boolean))];
  try {
    const open = await prisma.crmActivity.findMany({
      where: { cardId, type: "TODO", completed: false, title: { in: titles } },
      select: { title: true },
    });
    const added = titles.filter((t) => !open.some((o) => o.title === t));
    if (added.length) await prisma.crmActivity.createMany({ data: added.map((title) => ({ cardId, type: "TODO" as const, title })) });
    return { request: { checklist: added, skipped: titles.length - added.length }, error: null };
  } catch (e) {
    return { request: { checklist: [], skipped: 0 }, error: e instanceof Error ? e.message : String(e) };
  }
}

/** SEND_EMAIL action: one message per recipient (they don't see each other); the body is plain text. */
async function sendEmailAction(config: ActionRule["email"] & {}, deal: Deal): Promise<ActionOutcome> {
  const to = emailRecipients(fillPlaceholders(config.to, deal.ctx));
  const subject = fillPlaceholders(config.subject, deal.ctx).trim() || deal.ctx.title;
  if (!to.length) return { request: { to, subject }, error: "Nenhum e-mail válido em \"Para\"", final: true };
  const html = escapeHtml(fillPlaceholders(config.body, deal.ctx)).replace(/\r?\n/g, "<br>");
  const sent: string[] = [];
  try {
    for (const address of to) {
      await sendMail(address, subject, html);
      sent.push(address);
    }
    return { request: { to, subject }, error: null };
  } catch (e) {
    // A retry sends again to everyone: better a repeated e-mail than a missing one
    return { request: { to, subject, sent }, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * COPY_CARD action: copies the deal like "Duplicar" to the target stage (any pipeline), linking
 * both when configured, then runs the target stage's rules for the copy. A deal that was itself
 * copied by a rule is not copied again, so two boards copying to each other can't loop.
 */
async function copyCardAction(config: ActionRule["copy"] & {}, ruleName: string, cardId: string): Promise<ActionOutcome | string> {
  if (!config.stageId || !config.stage) return "A etapa de destino foi excluída";
  const created = await prisma.crmHistory.findFirst({ where: { cardId, type: "CREATED" }, select: { data: true } });
  if ((created?.data as { copiedByRule?: string } | null)?.copiedByRule) return "O negócio já é uma cópia feita por automação";

  const stageId = config.stageId;
  try {
    const copy = await prisma.$transaction(async (tx) => {
      const card = await tx.crmCard.findUniqueOrThrow({ where: { id: cardId }, select: { startDate: true, closeDate: true } });
      const copy = await copyCard(tx, cardId, {
        stageId,
        startDate: card.startDate,
        closeDate: card.closeDate,
        history: { copiedFrom: cardId, copiedByRule: ruleName },
      });
      if (config.link) {
        const pair = cardId < copy.id ? { cardId, linkedId: copy.id } : { cardId: copy.id, linkedId: cardId };
        await tx.crmCardLink.create({ data: pair });
      }
      return copy;
    });
    return {
      request: { copyNumber: copy.number, stage: config.stage.name, pipeline: config.stage.pipeline.name },
      error: null,
      followUp: async () => {
        await notifyStageChanged(stageId);
        await onDealEnteredStage(copy.id, stageId);
      },
    };
  } catch (e) {
    return { request: { stage: config.stage.name }, error: e instanceof Error ? e.message : String(e) };
  }
}

type WebhookRule = {
  id: string;
  name: string;
  webhookUrl: string | null;
  webhookMethod: HttpMethod;
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
  if (methodHasBody(method)) {
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
  | { type: "DEAL_CREATED" }
  | { type: "DUE_REACHED" }
  | { type: "ESTIMATE_EXCEEDED" };

function triggerMatchesEvent(trigger: CrmTrigger, event: TriggerEvent) {
  switch (event.type) {
    case "WEBHOOK_IN":
      return trigger.webhookToken === event.token;
    case "FIELD_CHANGED":
      return !trigger.watchedField || event.fields.includes(trigger.watchedField);
    case "ACTIVITY_COMPLETED":
      return !trigger.activityType || trigger.activityType === event.activityType;
    case "DEAL_CREATED":
    case "DUE_REACHED":
    case "ESTIMATE_EXCEEDED":
      return true;
  }
}

/**
 * Queues and runs the active rules of `stageId` started by the event (startOn), like a stage
 * entry does for the other rules. They always start in parallel: SEQUENTIAL only orders the
 * rules started by the stage entry. Their conditions are checked when they run.
 */
async function runEventRules(cardId: string, stageId: string, event: TriggerEvent) {
  if (!isStartOn(event.type)) return;
  const rules = await prisma.crmAutomation.findMany({
    where: { stageId, active: true, flowStepId: null, startOn: event.type },
    orderBy: { order: "asc" },
    select: { id: true, delayAmount: true, delayUnit: true, startField: true, startActivityType: true },
  });
  const matching = rules.filter((r) =>
    event.type === "FIELD_CHANGED"
      ? !r.startField || event.fields.includes(r.startField)
      : event.type === "ACTIVITY_COMPLETED"
        ? !r.startActivityType || r.startActivityType === event.activityType
        : true,
  );
  if (!matching.length) return;

  const now = Date.now();
  await prisma.crmAutomationRun.createMany({
    data: matching.map((r, index) => ({
      automationId: r.id,
      cardId,
      stageId,
      runAt: new Date(now + delayMs(r.delayAmount, r.delayUnit) + index),
    })),
  });
  // ponytail: if the queue is already busy in this process, these run on its next pass and a trigger may move the deal first (then they are skipped)
  await processDueRuns();
}

/**
 * Finds the first trigger of the deal's pipeline that matches the event and
 * moves the deal to its stage. Returns the new stage id, or null if nothing moved.
 */
export async function fireTriggers(cardId: string, event: TriggerEvent) {
  try {
    if (await isHiddenCard(cardId)) return null;
    const deal = await dealContext(cardId);
    if (!deal) return null;

    // Rules of the current stage started by this event run first: a trigger below may move the deal away
    await runEventRules(cardId, deal.stage.id, event);

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
    await snapshotBeforeMove(tx, cardId, card.stageId, to.id);

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
    return { to, copy: await syncTaskStatus(tx, cardId) };
  });
  if (!moved) return;

  notifyPipelineChanged(moved.to.pipelineId);
  await onDealEnteredStage(cardId, moved.to.id);
  if (moved.copy) await onDealEnteredStage(moved.copy.id, moved.copy.stageId);
}

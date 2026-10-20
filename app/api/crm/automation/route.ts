import { NextResponse } from "next/server";
import { Prisma, type CrmActivityType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canSeePipeline, denyUnless } from "@/lib/crm-access";
import { boardAutomations } from "@/lib/crm-automation";
import {
  ACTION_TYPES,
  ACTIVITY_TYPES,
  WATCHABLE_FIELDS,
  isActionType,
  isDelayUnit,
  isHttpMethod,
  isStartOn,
  parseActivityAction,
  parseConditions,
  parseDealUpdateAction,
  parseFlowSteps,
  parseNotifyAction,
  parseSubtaskAction,
  parseChecklistAction,
  parseEmailAction,
  parseCopyAction,
  type ActionType,
  type Branch,
  type FlowStepInput,
} from "@/lib/crm-automation-shared";

const automationInclude = boardAutomations.include;

/** CREATE_ACTIVITY config; a member that no longer exists falls back to the deal's responsible. */
async function activityData(value: unknown) {
  const activity = parseActivityAction(value);
  if (activity.assignee === "MEMBER") {
    const member = await prisma.teamMember.findUnique({ where: { id: activity.responsibleId! }, select: { id: true } });
    if (!member) return { ...activity, assignee: "DEAL_RESPONSIBLE" as const, responsibleId: null };
  }
  return activity;
}

/**
 * UPDATE_DEAL config of a rule in `ruleStageId`: drops a target stage outside the
 * rule's pipeline (or the rule's own stage), a member that no longer exists
 * and custom fields that are not in the pipeline.
 */
async function dealUpdateData(value: unknown, ruleStageId: string) {
  const update = parseDealUpdateAction(value);
  const ruleStage = await prisma.crmStage.findUniqueOrThrow({
    where: { id: ruleStageId },
    select: { pipelineId: true, pipeline: { select: { fieldsConfig: true } } },
  });
  const [target, member, tag] = await Promise.all([
    update.stageId ? prisma.crmStage.findUnique({ where: { id: update.stageId }, select: { pipelineId: true } }) : null,
    update.responsibleId ? prisma.teamMember.findUnique({ where: { id: update.responsibleId }, select: { id: true } }) : null,
    update.addTagId ? prisma.crmTag.findUnique({ where: { id: update.addTagId }, select: { id: true } }) : null,
  ]);
  const fieldIds = new Set(
    (Array.isArray(ruleStage.pipeline.fieldsConfig) ? ruleStage.pipeline.fieldsConfig : []).map((f) => (f as { id?: string })?.id)
  );
  const customData = Object.fromEntries(Object.entries(update.customData ?? {}).filter(([id]) => fieldIds.has(id)));
  return {
    stageId: target && target.pipelineId === ruleStage.pipelineId && update.stageId !== ruleStageId ? update.stageId : null,
    status: update.status,
    responsibleId: member ? update.responsibleId : null,
    priority: update.priority,
    addTagId: tag ? update.addTagId : null,
    customData: Object.keys(customData).length ? customData : Prisma.DbNull,
  };
}

/** NOTIFY config; members that no longer exist are dropped. Saving moves them out of the legacy JSON column. */
async function notifyData(value: unknown) {
  const notify = parseNotifyAction(value);
  const members = await prisma.teamMember.findMany({ where: { id: { in: notify.memberIds } }, select: { id: true } });
  return {
    message: notify.message || "{{deal.title}}",
    notifyResponsible: notify.notifyResponsible,
    notifyAssignees: notify.notifyAssignees,
    memberIds: Prisma.DbNull,
    members: members.map((m) => ({ memberId: m.id })),
  };
}

/** CREATE_SUBTASK config; a member that no longer exists falls back to the deal's responsible. */
async function subtaskData(value: unknown) {
  const subtask = parseSubtaskAction(value);
  if (subtask.assignee === "MEMBER") {
    const member = await prisma.teamMember.findUnique({ where: { id: subtask.responsibleId! }, select: { id: true } });
    if (!member) return { ...subtask, assignee: "DEAL_RESPONSIBLE" as const, responsibleId: null };
  }
  return subtask;
}

const checklistRows = (value: unknown) => parseChecklistAction(value).items.map((title, order) => ({ title, order }));

/** COPY_CARD config of a rule in `ruleStageId`: the target must be a stage the user sees, other than the rule's own. */
async function copyData(value: unknown, ruleStageId: string) {
  const copy = parseCopyAction(value);
  const ok = copy.stageId && copy.stageId !== ruleStageId && (await canSeePipeline({ stageId: copy.stageId }));
  return { stageId: ok ? copy.stageId : null, link: copy.link };
}

/** Nested write of a NOTIFY config: its members replace the current ones. */
const notifyWrite = ({ members, ...fields }: Awaited<ReturnType<typeof notifyData>>, replace: boolean) => ({
  ...fields,
  members: replace ? { deleteMany: {}, create: members } : { create: members },
});

const parseHeaders =(value: unknown) =>
  (Array.isArray(value) ? value : [])
    .filter((h) => h && String(h.key ?? "").trim())
    .map((h, order) => ({ key: String(h.key).trim(), value: String(h.value ?? ""), order }));

/** Scalar fields of a rule that can be set from the board (webhook columns only for webhook rules). */
function ruleFields(body: Record<string, unknown>, actionType: ActionType) {
  const webhook = actionType === "WEBHOOK";
  return {
    ...(body.name !== undefined && { name: String(body.name).trim() || ACTION_TYPES[actionType].label }),
    ...(body.delayAmount !== undefined && { delayAmount: Math.max(0, Math.round(Number(body.delayAmount) || 0)) }),
    ...(isDelayUnit(body.delayUnit) && { delayUnit: body.delayUnit }),
    ...(webhook && body.webhookUrl !== undefined && { webhookUrl: String(body.webhookUrl).trim() }),
    ...(webhook && body.webhookMethod !== undefined && { webhookMethod: isHttpMethod(body.webhookMethod) ? body.webhookMethod : ("POST" as const) }),
    ...(webhook && body.webhookBody !== undefined && { webhookBody: String(body.webhookBody ?? "").trim() ? String(body.webhookBody) : null }),
    ...(body.active !== undefined && { active: Boolean(body.active) }),
    ...(body.execution !== undefined && { execution: body.execution === "SEQUENTIAL" ? ("SEQUENTIAL" as const) : ("PARALLEL" as const) }),
    ...(body.startOn !== undefined && startFields(body)),
  };
}

/** What starts the rule; the event's option only for its event, cleared otherwise. */
function startFields(body: Record<string, unknown>) {
  const startOn = isStartOn(body.startOn) ? body.startOn : "STAGE_ENTERED";
  const field = String(body.startField ?? "");
  const activityType = String(body.startActivityType ?? "");
  return {
    startOn,
    startField: startOn === "FIELD_CHANGED" && field in WATCHABLE_FIELDS ? field : null,
    startActivityType:
      startOn === "ACTIVITY_COMPLETED" && activityType in ACTIVITY_TYPES ? (activityType as CrmActivityType) : null,
  };
}

const conditionRows = (value: unknown) =>
  parseConditions(value).map((c, order) => ({ ...c, order }));

/** Nested creates of the action tables of a rule in `stageId` (the action type never changes afterwards). */
async function actionCreates(actionType: ActionType, body: Record<string, unknown>, stageId: string) {
  return {
    ...(actionType === "WEBHOOK" && { headers: { create: parseHeaders(body.headers) } }),
    ...(actionType === "CREATE_ACTIVITY" && { activity: { create: await activityData(body.activity) } }),
    ...(actionType === "UPDATE_DEAL" && { dealUpdate: { create: await dealUpdateData(body.dealUpdate, stageId) } }),
    ...(actionType === "NOTIFY" && { notify: { create: notifyWrite(await notifyData(body.notify), false) } }),
    ...(actionType === "CREATE_SUBTASK" && { subtask: { create: await subtaskData(body.subtask) } }),
    ...(actionType === "ADD_CHECKLIST" && { checklist: { create: checklistRows(body.checklist) } }),
    ...(actionType === "SEND_EMAIL" && { email: { create: parseEmailAction(body.email) } }),
    ...(actionType === "COPY_CARD" && { copy: { create: await copyData(body.copy, stageId) } }),
  };
}

type StepRow = {
  type: FlowStepInput["type"];
  waitAmount: number | null;
  waitUnit: FlowStepInput["waitUnit"] | null;
  conditions: ReturnType<typeof conditionRows>;
  /** Child rule holding the action of an ACTION step */
  action: Prisma.CrmAutomationUncheckedCreateWithoutFlowStepInput | null;
  then: StepRow[];
  else: StepRow[];
};

/** Validated flow steps -> rows to create, with the child rule of each action built like a simple rule. */
async function stepRows(steps: FlowStepInput[], stageId: string): Promise<StepRow[]> {
  return Promise.all(
    steps.map(async (step) => {
      const { action } = step;
      return {
        type: step.type,
        waitAmount: step.type === "WAIT" ? step.waitAmount : null,
        waitUnit: step.type === "WAIT" ? step.waitUnit : null,
        conditions: conditionRows(step.conditions),
        action: action && {
          name: ACTION_TYPES[action.actionType].label,
          actionType: action.actionType,
          ...ruleFields(action, action.actionType),
          delayAmount: 0,
          active: true,
          stageId,
          ...(await actionCreates(action.actionType, action, stageId)),
        },
        then: await stepRows(step.then, stageId),
        else: await stepRows(step.else, stageId),
      };
    })
  );
}

/**
 * Replaces the steps of a flow (their child rules are deleted with them). Runs
 * waiting in the middle of the flow can't resume on new steps, so they are skipped.
 */
async function saveFlowSteps(flowId: string, rows: StepRow[]) {
  await prisma.$transaction(
    async (tx) => {
      await tx.crmAutomationStep.deleteMany({ where: { flowId } });
      await tx.crmAutomationRun.updateMany({
        where: { automationId: flowId, status: "PENDING", stepCount: { gt: 0 } },
        data: { status: "SKIPPED", error: "Fluxo alterado durante a execução" },
      });
      const create = async (list: StepRow[], parentId: string | null, branch: Branch | null) => {
        for (const [order, row] of list.entries()) {
          const step = await tx.crmAutomationStep.create({
            data: {
              flowId,
              parentId,
              branch,
              order,
              type: row.type,
              waitAmount: row.waitAmount,
              waitUnit: row.waitUnit,
              conditions: { create: row.conditions },
              ...(row.action && { actions: { create: row.action } }),
            },
          });
          await create(row.then, step.id, "THEN");
          await create(row.else, step.id, "ELSE");
        }
      };
      await create(rows, null, null);
    },
    { timeout: 30_000 }
  );
}

/** Validated steps of a FLOW rule, or the response for an invalid flow. */
async function flowRows(body: Record<string, unknown>, stageId: string) {
  const flow = parseFlowSteps(body.steps);
  if (flow.error) return NextResponse.json({ error: flow.error }, { status: 400 });
  return stepRows(flow.steps, stageId);
}

/** Stages of a pipeline with their rules and triggers (the automation board). */
export async function GET(req: Request) {
  try {
    const denied = await denyUnless("automation.view");
    if (denied) return denied;
    const pipelineId = new URL(req.url).searchParams.get("pipelineId");
    if (!pipelineId) return NextResponse.json({ error: "Missing pipelineId" }, { status: 400 });

    const stages = await prisma.crmStage.findMany({
      where: { pipelineId },
      orderBy: { order: "asc" },
      include: {
        automations: boardAutomations,
        triggers: { orderBy: { order: "asc" }, include: { conditions: { orderBy: { order: "asc" } } } },
      },
    });
    return NextResponse.json(stages);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const denied = await denyUnless("automation.create");
    if (denied) return denied;
    const body = await req.json();
    if (!body.stageId) return NextResponse.json({ error: "Missing stageId" }, { status: 400 });
    const actionType: ActionType = isActionType(body.actionType) ? body.actionType : "WEBHOOK";
    const rows = actionType === "FLOW" ? await flowRows(body, body.stageId) : null;
    if (rows instanceof NextResponse) return rows;

    const automation = await prisma.crmAutomation.create({
      data: {
        name: ACTION_TYPES[actionType].label,
        actionType,
        ...ruleFields(body, actionType),
        stageId: body.stageId,
        order: await prisma.crmAutomation.count({ where: { stageId: body.stageId, flowStepId: null } }),
        ...(await actionCreates(actionType, body, body.stageId)),
        conditions: { create: conditionRows(body.conditions) },
      },
    });
    if (rows) await saveFlowSteps(automation.id, rows);
    return NextResponse.json(await prisma.crmAutomation.findUnique({ where: { id: automation.id }, include: automationInclude }));
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * Updates a rule (`{ id, ...fields }`; `headers`/`conditions`/`activity`/`dealUpdate`/`notify`/`steps`, when sent, replace
 * the current ones; the action type never changes), or reorders rules after a drag and drop (`{ items: [{ id, stageId, order }] }`).
 */
export async function PUT(req: Request) {
  try {
    const denied = await denyUnless("automation.edit");
    if (denied) return denied;
    const body = await req.json();

    if (Array.isArray(body.items)) {
      await prisma.$transaction(
        body.items.flatMap((item: { id: string; stageId: string; order: number }) => [
          prisma.crmAutomation.update({ where: { id: item.id }, data: { stageId: item.stageId, order: item.order } }),
          // The actions of a flow's steps live in the flow's stage
          prisma.crmAutomation.updateMany({ where: { flowStep: { flowId: item.id } }, data: { stageId: item.stageId } }),
        ])
      );
      return NextResponse.json({ success: true });
    }

    if (!body.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const current = await prisma.crmAutomation.findUnique({ where: { id: body.id }, select: { actionType: true, stageId: true } });
    if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { actionType } = current;
    const stageId = typeof body.stageId === "string" ? body.stageId : current.stageId;
    const rows = actionType === "FLOW" && body.steps !== undefined ? await flowRows(body, stageId) : null;
    if (rows instanceof NextResponse) return rows;
    const activity = actionType === "CREATE_ACTIVITY" && body.activity !== undefined ? await activityData(body.activity) : null;
    const dealUpdate =
      actionType === "UPDATE_DEAL" && body.dealUpdate !== undefined ? await dealUpdateData(body.dealUpdate, stageId) : null;
    const notify = actionType === "NOTIFY" && body.notify !== undefined ? await notifyData(body.notify) : null;
    const subtask = actionType === "CREATE_SUBTASK" && body.subtask !== undefined ? await subtaskData(body.subtask) : null;
    const email = actionType === "SEND_EMAIL" && body.email !== undefined ? parseEmailAction(body.email) : null;
    const copy = actionType === "COPY_CARD" && body.copy !== undefined ? await copyData(body.copy, stageId) : null;
    await prisma.crmAutomation.update({
      where: { id: body.id },
      data: {
        ...ruleFields(body, actionType),
        ...(actionType === "WEBHOOK" &&
          body.headers !== undefined && { headers: { deleteMany: {}, create: parseHeaders(body.headers) } }),
        ...(activity && { activity: { upsert: { create: activity, update: activity } } }),
        ...(dealUpdate && { dealUpdate: { upsert: { create: dealUpdate, update: dealUpdate } } }),
        ...(notify && { notify: { upsert: { create: notifyWrite(notify, false), update: notifyWrite(notify, true) } } }),
        ...(subtask && { subtask: { upsert: { create: subtask, update: subtask } } }),
        ...(actionType === "ADD_CHECKLIST" &&
          body.checklist !== undefined && { checklist: { deleteMany: {}, create: checklistRows(body.checklist) } }),
        ...(email && { email: { upsert: { create: email, update: email } } }),
        ...(copy && { copy: { upsert: { create: copy, update: copy } } }),
        ...(body.conditions !== undefined && { conditions: { deleteMany: {}, create: conditionRows(body.conditions) } }),
      },
    });
    if (rows) await saveFlowSteps(body.id, rows);
    return NextResponse.json(await prisma.crmAutomation.findUnique({ where: { id: body.id }, include: automationInclude }));
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const denied = await denyUnless("automation.delete");
    if (denied) return denied;
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    await prisma.crmAutomation.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

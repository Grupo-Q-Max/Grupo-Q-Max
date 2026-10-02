import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ACTION_TYPES,
  isActionType,
  isDelayUnit,
  parseActivityAction,
  parseConditions,
  parseDealUpdateAction,
  parseNotifyAction,
  type ActionType,
} from "@/lib/crm-automation-shared";

const automationInclude = {
  headers: { orderBy: { order: "asc" as const } },
  conditions: { orderBy: { order: "asc" as const } },
  activity: true,
  dealUpdate: true,
  notify: true,
};

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
  const [target, member] = await Promise.all([
    update.stageId ? prisma.crmStage.findUnique({ where: { id: update.stageId }, select: { pipelineId: true } }) : null,
    update.responsibleId ? prisma.teamMember.findUnique({ where: { id: update.responsibleId }, select: { id: true } }) : null,
  ]);
  const fieldIds = new Set(
    (Array.isArray(ruleStage.pipeline.fieldsConfig) ? ruleStage.pipeline.fieldsConfig : []).map((f) => (f as { id?: string })?.id)
  );
  const customData = Object.fromEntries(Object.entries(update.customData ?? {}).filter(([id]) => fieldIds.has(id)));
  return {
    stageId: target && target.pipelineId === ruleStage.pipelineId && update.stageId !== ruleStageId ? update.stageId : null,
    status: update.status,
    responsibleId: member ? update.responsibleId : null,
    customData: Object.keys(customData).length ? customData : Prisma.DbNull,
  };
}

/** NOTIFY config; members that no longer exist are dropped. */
async function notifyData(value: unknown) {
  const notify = parseNotifyAction(value);
  const members = await prisma.teamMember.findMany({ where: { id: { in: notify.memberIds } }, select: { id: true } });
  const memberIds = notify.memberIds.filter((id) => members.some((m) => m.id === id));
  return {
    message: notify.message || "{{deal.title}}",
    notifyResponsible: notify.notifyResponsible,
    memberIds: memberIds.length ? memberIds : Prisma.DbNull,
  };
}

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
    ...(webhook && body.webhookMethod !== undefined && { webhookMethod: body.webhookMethod === "GET" ? ("GET" as const) : ("POST" as const) }),
    ...(webhook && body.webhookBody !== undefined && { webhookBody: String(body.webhookBody ?? "").trim() ? String(body.webhookBody) : null }),
    ...(body.active !== undefined && { active: Boolean(body.active) }),
  };
}

const conditionRows = (value: unknown) =>
  parseConditions(value).map((c, order) => ({ ...c, order }));

/** Stages of a pipeline with their rules and triggers (the automation board). */
export async function GET(req: Request) {
  try {
    const pipelineId = new URL(req.url).searchParams.get("pipelineId");
    if (!pipelineId) return NextResponse.json({ error: "Missing pipelineId" }, { status: 400 });

    const stages = await prisma.crmStage.findMany({
      where: { pipelineId },
      orderBy: { order: "asc" },
      include: {
        automations: { orderBy: { order: "asc" }, include: automationInclude },
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
    const body = await req.json();
    if (!body.stageId) return NextResponse.json({ error: "Missing stageId" }, { status: 400 });
    const actionType: ActionType = isActionType(body.actionType) ? body.actionType : "WEBHOOK";

    const automation = await prisma.crmAutomation.create({
      data: {
        name: ACTION_TYPES[actionType].label,
        actionType,
        ...ruleFields(body, actionType),
        stageId: body.stageId,
        order: await prisma.crmAutomation.count({ where: { stageId: body.stageId } }),
        ...(actionType === "WEBHOOK" && { headers: { create: parseHeaders(body.headers) } }),
        ...(actionType === "CREATE_ACTIVITY" && { activity: { create: await activityData(body.activity) } }),
        ...(actionType === "UPDATE_DEAL" && { dealUpdate: { create: await dealUpdateData(body.dealUpdate, body.stageId) } }),
        ...(actionType === "NOTIFY" && { notify: { create: await notifyData(body.notify) } }),
        conditions: { create: conditionRows(body.conditions) },
      },
      include: automationInclude,
    });
    return NextResponse.json(automation);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * Updates a rule (`{ id, ...fields }`; `headers`/`conditions`/`activity`/`dealUpdate`/`notify`, when sent, replace
 * the current ones; the action type never changes), or reorders rules after a drag and drop (`{ items: [{ id, stageId, order }] }`).
 */
export async function PUT(req: Request) {
  try {
    const body = await req.json();

    if (Array.isArray(body.items)) {
      await prisma.$transaction(
        body.items.map((item: { id: string; stageId: string; order: number }) =>
          prisma.crmAutomation.update({ where: { id: item.id }, data: { stageId: item.stageId, order: item.order } })
        )
      );
      return NextResponse.json({ success: true });
    }

    if (!body.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const current = await prisma.crmAutomation.findUnique({ where: { id: body.id }, select: { actionType: true, stageId: true } });
    if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { actionType } = current;
    const activity = actionType === "CREATE_ACTIVITY" && body.activity !== undefined ? await activityData(body.activity) : null;
    const dealUpdate =
      actionType === "UPDATE_DEAL" && body.dealUpdate !== undefined
        ? await dealUpdateData(body.dealUpdate, typeof body.stageId === "string" ? body.stageId : current.stageId)
        : null;
    const notify = actionType === "NOTIFY" && body.notify !== undefined ? await notifyData(body.notify) : null;
    const automation = await prisma.crmAutomation.update({
      where: { id: body.id },
      data: {
        ...ruleFields(body, actionType),
        ...(actionType === "WEBHOOK" &&
          body.headers !== undefined && { headers: { deleteMany: {}, create: parseHeaders(body.headers) } }),
        ...(activity && { activity: { upsert: { create: activity, update: activity } } }),
        ...(dealUpdate && { dealUpdate: { upsert: { create: dealUpdate, update: dealUpdate } } }),
        ...(notify && { notify: { upsert: { create: notify, update: notify } } }),
        ...(body.conditions !== undefined && { conditions: { deleteMany: {}, create: conditionRows(body.conditions) } }),
      },
      include: automationInclude,
    });
    return NextResponse.json(automation);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    await prisma.crmAutomation.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

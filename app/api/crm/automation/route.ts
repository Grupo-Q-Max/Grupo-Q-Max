import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isDelayUnit, parseConditions } from "@/lib/crm-automation-shared";

const automationInclude = {
  headers: { orderBy: { order: "asc" as const } },
  conditions: { orderBy: { order: "asc" as const } },
};

const parseHeaders = (value: unknown) =>
  (Array.isArray(value) ? value : [])
    .filter((h) => h && String(h.key ?? "").trim())
    .map((h, order) => ({ key: String(h.key).trim(), value: String(h.value ?? ""), order }));

/** Scalar fields of a rule that can be set from the board. */
function ruleFields(body: Record<string, unknown>) {
  return {
    ...(body.name !== undefined && { name: String(body.name).trim() || "Webhook de saída" }),
    ...(body.delayAmount !== undefined && { delayAmount: Math.max(0, Math.round(Number(body.delayAmount) || 0)) }),
    ...(isDelayUnit(body.delayUnit) && { delayUnit: body.delayUnit }),
    ...(body.webhookUrl !== undefined && { webhookUrl: String(body.webhookUrl).trim() }),
    ...(body.webhookMethod !== undefined && { webhookMethod: body.webhookMethod === "GET" ? ("GET" as const) : ("POST" as const) }),
    ...(body.webhookBody !== undefined && { webhookBody: String(body.webhookBody ?? "").trim() ? String(body.webhookBody) : null }),
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

    const automation = await prisma.crmAutomation.create({
      data: {
        name: "Webhook de saída",
        webhookUrl: "",
        ...ruleFields(body),
        stageId: body.stageId,
        order: await prisma.crmAutomation.count({ where: { stageId: body.stageId } }),
        headers: { create: parseHeaders(body.headers) },
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
 * Updates a rule (`{ id, ...fields }`; `headers`/`conditions`, when sent, replace
 * the current ones), or reorders rules after a drag and drop (`{ items: [{ id, stageId, order }] }`).
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
    const automation = await prisma.crmAutomation.update({
      where: { id: body.id },
      data: {
        ...ruleFields(body),
        ...(body.headers !== undefined && { headers: { deleteMany: {}, create: parseHeaders(body.headers) } }),
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

import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import type { CrmActivityType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ACTIVITY_TYPES, TRIGGER_TYPES, isTriggerType, parseConditions, type TriggerType } from "@/lib/crm-automation-shared";

const triggerInclude = { conditions: { orderBy: { order: "asc" as const } } };

const conditionRows = (value: unknown) => parseConditions(value).map((c, order) => ({ ...c, order }));

/**
 * Type-specific columns: only the ones that apply to `type` are kept, the others
 * are cleared. The incoming webhook token is generated once and never taken from the client.
 */
function typeFields(type: TriggerType, body: Record<string, unknown>, currentToken?: string | null) {
  const activityType = String(body.activityType ?? "");
  return {
    type,
    webhookToken: type === "WEBHOOK_IN" ? currentToken ?? randomBytes(16).toString("hex") : null,
    watchedField: type === "FIELD_CHANGED" && body.watchedField ? String(body.watchedField) : null,
    activityType:
      type === "ACTIVITY_COMPLETED" && activityType in ACTIVITY_TYPES ? (activityType as CrmActivityType) : null,
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.stageId || !isTriggerType(body.type)) {
      return NextResponse.json({ error: "Missing stageId or type" }, { status: 400 });
    }

    const trigger = await prisma.crmTrigger.create({
      data: {
        name: String(body.name ?? "").trim() || TRIGGER_TYPES[body.type as TriggerType].label,
        ...typeFields(body.type, body),
        allowBackwards: Boolean(body.allowBackwards),
        active: body.active ?? true,
        stageId: body.stageId,
        order: await prisma.crmTrigger.count({ where: { stageId: body.stageId } }),
        conditions: { create: conditionRows(body.conditions) },
      },
      include: triggerInclude,
    });
    return NextResponse.json(trigger);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * Updates a trigger (`{ id, ...fields }`; `conditions`, when sent, replace the
 * current ones), or reorders triggers after a drag and drop (`{ items: [{ id, stageId, order }] }`).
 */
export async function PUT(req: Request) {
  try {
    const body = await req.json();

    if (Array.isArray(body.items)) {
      await prisma.$transaction(
        body.items.map((item: { id: string; stageId: string; order: number }) =>
          prisma.crmTrigger.update({ where: { id: item.id }, data: { stageId: item.stageId, order: item.order } })
        )
      );
      return NextResponse.json({ success: true });
    }

    if (!body.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const current = await prisma.crmTrigger.findUnique({ where: { id: body.id } });
    if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const type: TriggerType = isTriggerType(body.type) ? body.type : current.type;
    // A rename alone keeps the type-specific columns; any other edit sends the whole form
    const editsType = body.type !== undefined || body.watchedField !== undefined || body.activityType !== undefined;

    const trigger = await prisma.crmTrigger.update({
      where: { id: body.id },
      data: {
        ...(editsType && typeFields(type, body, current.webhookToken)),
        ...(body.name !== undefined && { name: String(body.name).trim() || TRIGGER_TYPES[type].label }),
        ...(body.allowBackwards !== undefined && { allowBackwards: Boolean(body.allowBackwards) }),
        ...(body.active !== undefined && { active: Boolean(body.active) }),
        ...(body.conditions !== undefined && { conditions: { deleteMany: {}, create: conditionRows(body.conditions) } }),
      },
      include: triggerInclude,
    });
    return NextResponse.json(trigger);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    await prisma.crmTrigger.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

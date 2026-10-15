import { NextResponse, after } from "next/server";
import type { CrmActivityType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { denyUnless, denyUnlessPipeline } from "@/lib/crm-access";
import { notifyStageChanged } from "@/lib/crm-realtime";
import { fireTriggers } from "@/lib/crm-automation";

const TYPES = new Set<CrmActivityType>(["TODO", "TASK", "CALL", "MEETING", "COMMENT"]);

const toDate = (value: unknown) => (value ? new Date(String(value)) : null);

/** Activities only change the deal's kanban card (next activity), so notify its stage. */
async function notifyCard(cardId: string) {
  const card = await prisma.crmCard.findUnique({ where: { id: cardId }, select: { stageId: true } });
  if (card) await notifyStageChanged(card.stageId);
}

export async function POST(req: Request) {
  try {
    const denied = await denyUnless("activity.create");
    if (denied) return denied;
    const { cardId, type, title, description, deadline, responsibleId } = await req.json();
    if (!cardId || !TYPES.has(type) || !String(title ?? "").trim()) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    const hidden = await denyUnlessPipeline({ cardId });
    if (hidden) return hidden;

    const activity = await prisma.crmActivity.create({
      data: {
        cardId,
        type,
        title: String(title).trim(),
        description: description || null,
        deadline: toDate(deadline),
        responsibleId: responsibleId || null,
      },
    });
    await notifyCard(cardId);

    return NextResponse.json(activity);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const denied = await denyUnless("activity.edit");
    if (denied) return denied;
    const { id, title, description, deadline, responsibleId, completed } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const current = await prisma.crmActivity.findUnique({ where: { id } });
    if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const hidden = await denyUnlessPipeline({ cardId: current.cardId });
    if (hidden) return hidden;

    const activity = await prisma.crmActivity.update({
      where: { id },
      data: {
        ...(title !== undefined && { title: String(title).trim() || current.title }),
        ...(description !== undefined && { description: description || null }),
        ...(deadline !== undefined && { deadline: toDate(deadline) }),
        ...(responsibleId !== undefined && { responsibleId: responsibleId || null }),
        ...(completed !== undefined && {
          completed: Boolean(completed),
          completedAt: completed ? new Date() : null,
        }),
      },
    });
    await notifyCard(activity.cardId);
    if (activity.completed && !current.completed) {
      after(() => fireTriggers(activity.cardId, { type: "ACTIVITY_COMPLETED", activityType: activity.type }));
    }

    return NextResponse.json(activity);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const denied = await denyUnless("activity.delete");
    if (denied) return denied;
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const current = await prisma.crmActivity.findUnique({ where: { id }, select: { cardId: true } });
    const hidden = await denyUnlessPipeline({ cardId: current?.cardId });
    if (hidden) return hidden;

    const activity = await prisma.crmActivity.delete({ where: { id } });
    await notifyCard(activity.cardId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

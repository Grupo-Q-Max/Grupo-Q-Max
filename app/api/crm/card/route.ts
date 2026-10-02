import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyStageChanged } from "@/lib/crm-realtime";
import { fireTriggers, onDealEnteredStage } from "@/lib/crm-automation";
import {
  DealValidationError,
  cardListInclude,
  companyIdByName,
  getDealDetails,
  serializeListCard,
  updateDeal,
} from "@/lib/crm-deal";

export async function GET(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const deal = await getDealDetails(id);
    if (!deal) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(deal);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { title, company, value, stageId, customData } = await req.json();
    if (!title || !stageId) return NextResponse.json({ error: "Missing title or stageId" }, { status: 400 });

    const card = await prisma.$transaction(async (tx) =>
      tx.crmCard.create({
        data: {
          title,
          value: value || 0,
          stageId,
          companyId: await companyIdByName(tx, company),
          customData: customData || {},
          order: await tx.crmCard.count({ where: { stageId } }),
          history: { create: { type: "CREATED", data: { title } } },
        },
        include: cardListInclude,
      })
    );

    await notifyStageChanged(card.stageId);
    // A "negócio criado" trigger may move the deal right away; otherwise run the first stage's rules
    after(async () => {
      if (!(await fireTriggers(card.id, { type: "DEAL_CREATED" }))) await onDealEnteredStage(card.id, card.stageId);
    });

    return NextResponse.json(serializeListCard(card));
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * Partial update from the deal panel: any scalar/relation field from
 * lib/crm-deal plus `stageId` and `status`. Every real change is recorded
 * in the deal history.
 */
export async function PATCH(req: Request) {
  try {
    const { id, ...changes } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const result = await updateDeal(id, changes);

    if (result.changed) await notifyStageChanged(result.stageId);
    after(async () => {
      if (result.recurringCopy) await onDealEnteredStage(result.recurringCopy.id, result.recurringCopy.stageId);
      // A manual stage change runs the new stage's rules; other changes may fire a "campo alterado" trigger
      if (result.movedTo) await onDealEnteredStage(id, result.movedTo);
      else if (result.changedFields.length) await fireTriggers(id, { type: "FIELD_CHANGED", fields: result.changedFields });
    });
    return NextResponse.json(await getDealDetails(id));
  } catch (error) {
    if (error instanceof DealValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const card = await prisma.crmCard.delete({
      where: { id }
    });
    await notifyStageChanged(card.stageId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

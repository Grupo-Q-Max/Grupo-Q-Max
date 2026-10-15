import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { denyUnless, denyUnlessPipeline } from "@/lib/crm-access";
import { notifyStageChanged } from "@/lib/crm-realtime";
import { fireTriggers, onDealEnteredStage } from "@/lib/crm-automation";
import { isQxbackStage, notifyQxback } from "@/lib/crm-qxback";
import {
  DealValidationError,
  DuplicateDealError,
  cardListInclude,
  companyIdByName,
  findDuplicateDeals,
  getDealDetails,
  serializeListCard,
  updateDeal,
} from "@/lib/crm-deal";

export async function GET(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const hidden = await denyUnlessPipeline({ cardId: id });
    if (hidden) return hidden;

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
    const denied = await denyUnless("deal.create");
    if (denied) return denied;
    const { title, company, value, stageId, customData, referredBy, responsibleId, closeDate, comment, force } = await req.json();
    if (!title || !stageId) return NextResponse.json({ error: "Missing title or stageId" }, { status: 400 });
    const hidden = await denyUnlessPipeline({ stageId });
    if (hidden) return hidden;
    const responsible = typeof responsibleId === "string" && responsibleId ? responsibleId : null;

    const card = await prisma.$transaction(async (tx) => {
      const { pipelineId } = await tx.crmStage.findUniqueOrThrow({ where: { id: stageId }, select: { pipelineId: true } });
      const companyId = await companyIdByName(tx, company);
      if (!force) {
        // Throwing rolls back a company created just above
        const duplicates = await findDuplicateDeals(tx, { title, pipelineId, companyId, responsibleId: responsible, value: Number(value) || 0 });
        if (duplicates.length) throw new DuplicateDealError(duplicates);
      }
      return tx.crmCard.create({
        data: {
          title,
          value: value || 0,
          stageId,
          companyId,
          responsibleId: responsible,
          customData: customData || {},
          referredBy: typeof referredBy === "string" ? referredBy.trim().slice(0, 200) || null : null,
          // Task boards: deadline (yyyy-mm-dd) and description
          closeDate: typeof closeDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(closeDate) ? new Date(closeDate) : null,
          comment: typeof comment === "string" ? comment.trim() || null : null,
          order: await tx.crmCard.count({ where: { stageId } }),
          history: { create: { type: "CREATED", data: { title } } },
        },
        include: cardListInclude,
      });
    });

    await notifyStageChanged(card.stageId);
    // A "negócio criado" trigger may move the deal right away; otherwise run the first stage's rules
    after(async () => {
      if (!(await fireTriggers(card.id, { type: "DEAL_CREATED" }))) await onDealEnteredStage(card.id, card.stageId);
    });

    return NextResponse.json(serializeListCard(card));
  } catch (error) {
    if (error instanceof DuplicateDealError) {
      return NextResponse.json({ error: "duplicate", deals: error.deals }, { status: 409 });
    }
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
    const denied = await denyUnless("deal.edit");
    if (denied) return denied;
    const { id, ...changes } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    // A stage change must also land in a pipeline the user sees
    const hidden = await denyUnlessPipeline({ cardId: id, stageId: typeof changes.stageId === "string" ? changes.stageId : null });
    if (hidden) return hidden;

    const result = await updateDeal(id, changes);

    if (result.changed) await notifyStageChanged(result.stageId);
    after(async () => {
      if (result.recurringCopy) await onDealEnteredStage(result.recurringCopy.id, result.recurringCopy.stageId);
      // A manual stage change runs the new stage's rules; other changes may fire a "campo alterado" trigger
      if (result.movedTo) await onDealEnteredStage(id, result.movedTo);
      else if (result.changedFields.length) await fireTriggers(id, { type: "FIELD_CHANGED", fields: result.changedFields });

      // Edits made here (not through the QXBACK rest route) to a QXBACK deal's products/value/comment:
      // tell QXBACK so it re-reads the deal (same role as Bitrix's own ONCRMDEALUPDATE push)
      const stageId = result.movedTo ?? result.stageId;
      if (isQxbackStage(stageId) && result.changedFields.some((f) => ["products", "value", "comment"].includes(f))) {
        const deal = await prisma.crmCard.findUnique({ where: { id }, select: { number: true } });
        if (deal) await notifyQxback(deal.number);
      }
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
    const denied = await denyUnless("deal.delete");
    if (denied) return denied;
    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const hidden = await denyUnlessPipeline({ cardId: id });
    if (hidden) return hidden;

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

import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { denyUnless, denyUnlessPipeline } from "@/lib/crm-access";
import { notifyStageChanged } from "@/lib/crm-realtime";
import { onDealEnteredStage } from "@/lib/crm-automation";
import { checkStageEntry, StageEntryError } from "@/lib/crm-qxback";
import { activeCard, snapshotBeforeMove, syncTaskStatus } from "@/lib/crm-deal";
import { notifyMoved } from "@/lib/crm-card-notify";
import { sessionMemberId } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const denied = await denyUnless("deal.edit");
    if (denied) return denied;
    const { cardId, newStageId, index, lostReason } = await req.json();

    if (!cardId || !newStageId) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }
    const hidden = await denyUnlessPipeline({ cardId, stageId: newStageId });
    if (hidden) return hidden;

    const current = await prisma.crmCard.findUnique({
      where: { id: cardId },
      select: { stageId: true, stage: { select: { name: true } } },
    });
    if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (current.stageId !== newStageId) await checkStageEntry(cardId, newStageId, lostReason);

    // Record the stage change in the deal timeline and run the new stage's automation rules
    const stageHistory = async () => {
      if (current.stageId === newStageId) return;
      const authorId = sessionMemberId(req);
      after(() => notifyMoved(cardId, newStageId, authorId));
      after(() => onDealEnteredStage(cardId, newStageId));
      const stage = await prisma.crmStage.findUnique({ where: { id: newStageId }, select: { name: true } });
      await prisma.crmHistory.create({
        data: { cardId, type: "STAGE_CHANGED", data: { from: current.stage.name, to: stage?.name ?? "" } },
      });
    };

    const { card: updatedCard, recurringCopy } = await prisma.$transaction(async (tx) => {
      // The state the deal had in the stage it leaves becomes that stage's restore point
      await snapshotBeforeMove(tx, cardId, current.stageId, newStageId);

      // Without an index, just move the card to the stage (appended by its current order)
      if (typeof index !== "number") {
        await tx.crmCard.update({ where: { id: cardId }, data: { stageId: newStageId } });
        const recurringCopy = await syncTaskStatus(tx, cardId);
        return { card: await tx.crmCard.findUniqueOrThrow({ where: { id: cardId } }), recurringCopy };
      }

      // With an index, insert the card at that position and renumber the stage's cards
      const siblings = await tx.crmCard.findMany({
        // Same cards the board shows, so `index` (counted on the board) lands where it was dropped
        where: { stageId: newStageId, NOT: { id: cardId }, ...activeCard },
        orderBy: { order: "asc" },
        select: { id: true },
      });

      const ids = siblings.map((c) => c.id);
      ids.splice(Math.max(0, Math.min(index, ids.length)), 0, cardId);

      await Promise.all(
        ids
          .filter((id) => id !== cardId)
          .map((id) => tx.crmCard.update({ where: { id }, data: { order: ids.indexOf(id) } }))
      );

      await tx.crmCard.update({
        where: { id: cardId },
        data: { stageId: newStageId, order: ids.indexOf(cardId) },
      });
      const recurringCopy = await syncTaskStatus(tx, cardId);
      return { card: await tx.crmCard.findUniqueOrThrow({ where: { id: cardId } }), recurringCopy };
    });
    await stageHistory();
    if (recurringCopy) after(() => onDealEnteredStage(recurringCopy.id, recurringCopy.stageId));
    await notifyStageChanged(newStageId);

    return NextResponse.json({ success: true, card: updatedCard });
  } catch (error) {
    if (error instanceof StageEntryError) return error.toResponse();
    console.error("Error moving card:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

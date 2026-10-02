import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyStageChanged } from "@/lib/crm-realtime";

export async function POST(req: Request) {
  try {
    const { cardId, newStageId, index } = await req.json();

    if (!cardId || !newStageId) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    // Without an index, just move the card to the stage (appended by its current order)
    if (typeof index !== "number") {
      const updatedCard = await prisma.crmCard.update({
        where: { id: cardId },
        data: { stageId: newStageId },
      });
      await notifyStageChanged(newStageId);
      return NextResponse.json({ success: true, card: updatedCard });
    }

    // With an index, insert the card at that position and renumber the stage's cards
    const updatedCard = await prisma.$transaction(async (tx) => {
      const siblings = await tx.crmCard.findMany({
        where: { stageId: newStageId, NOT: { id: cardId } },
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

      return tx.crmCard.update({
        where: { id: cardId },
        data: { stageId: newStageId, order: ids.indexOf(cardId) },
      });
    });
    await notifyStageChanged(newStageId);

    return NextResponse.json({ success: true, card: updatedCard });
  } catch (error) {
    console.error("Error moving card:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

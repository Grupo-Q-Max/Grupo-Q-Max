import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { cardId, newStageId } = await req.json();

    if (!cardId || !newStageId) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    // Update the card's stage
    const updatedCard = await prisma.crmCard.update({
      where: { id: cardId },
      data: { stageId: newStageId },
    });

    return NextResponse.json({ success: true, card: updatedCard });
  } catch (error) {
    console.error("Error moving card:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

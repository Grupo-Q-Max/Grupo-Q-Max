import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { denyUnless, denyUnlessPipeline, visiblePipelineWhere } from "@/lib/crm-access";
import { activeCard } from "@/lib/crm-deal";
import { notifyStageChanged } from "@/lib/crm-realtime";

/** A link is stored once, smaller id first, so (a, b) and (b, a) are the same row. */
const pair = (a: string, b: string) => (a < b ? { cardId: a, linkedId: b } : { cardId: b, linkedId: a });

const linkedSelect = {
  id: true,
  number: true,
  title: true,
  status: true,
  stage: { select: { pipeline: { select: { name: true, kind: true } } } },
} as const;

/** Cards linked to `?cardId=` that the user can see, with their board. */
export async function GET(req: Request) {
  try {
    const cardId = new URL(req.url).searchParams.get("cardId");
    if (!cardId) return NextResponse.json({ error: "Missing cardId" }, { status: 400 });
    const hidden = await denyUnlessPipeline({ cardId });
    if (hidden) return hidden;
    const visible = { ...activeCard, stage: { pipeline: await visiblePipelineWhere() } };
    const rows = await prisma.crmCardLink.findMany({
      where: { OR: [{ cardId, linked: visible }, { linkedId: cardId, card: visible }] },
      orderBy: { createdAt: "asc" },
      select: { card: { select: linkedSelect }, linked: { select: linkedSelect } },
    });
    return NextResponse.json(
      rows.map((r) => {
        const { stage, ...other } = r.card.id === cardId ? r.linked : r.card;
        return { ...other, pipeline: stage.pipeline.name, kind: stage.pipeline.kind };
      })
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/** Links two cards: `{ cardId, linkedId }`. Both must be visible to the user. */
export async function POST(req: Request) {
  try {
    const denied = await denyUnless("deal.edit");
    if (denied) return denied;
    const { cardId, linkedId } = await req.json();
    if (typeof cardId !== "string" || typeof linkedId !== "string" || cardId === linkedId) {
      return NextResponse.json({ error: "Card inválido." }, { status: 400 });
    }
    const hidden = (await denyUnlessPipeline({ cardId })) ?? (await denyUnlessPipeline({ cardId: linkedId }));
    if (hidden) return hidden;
    const key = pair(cardId, linkedId);
    await prisma.crmCardLink.upsert({ where: { cardId_linkedId: key }, create: key, update: {} });
    await refreshBoards(cardId, linkedId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/** Removes the link `?cardId=&linkedId=` (either order). */
export async function DELETE(req: Request) {
  try {
    const denied = await denyUnless("deal.edit");
    if (denied) return denied;
    const params = new URL(req.url).searchParams;
    const cardId = params.get("cardId");
    const linkedId = params.get("linkedId");
    if (!cardId || !linkedId) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const hidden = await denyUnlessPipeline({ cardId });
    if (hidden) return hidden;
    await prisma.crmCardLink.deleteMany({ where: pair(cardId, linkedId) });
    await refreshBoards(cardId, linkedId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/** Open panels of either card reload their links */
async function refreshBoards(...ids: string[]) {
  const cards = await prisma.crmCard.findMany({ where: { id: { in: ids } }, select: { stageId: true } });
  for (const { stageId } of cards) await notifyStageChanged(stageId);
}

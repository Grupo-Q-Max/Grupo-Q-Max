import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { denyUnless, denyUnlessPipeline, isCrmAdmin } from "@/lib/crm-access";
import { notifyStageChanged } from "@/lib/crm-realtime";
import { sessionMemberId } from "@/lib/auth";
import { DealValidationError } from "@/lib/crm-deal";
import { deleteEntry, logTime, startTimer, stopTimer } from "@/lib/crm-time";

const refresh = async (stages: string[]) => {
  for (const stage of new Set(stages)) await notifyStageChanged(stage);
};

/** Time tracking of the signed-in member: `{ action: "start", cardId }`, `{ action: "stop" }` or `{ action: "log", cardId, minutes }`. */
export async function POST(req: Request) {
  try {
    const denied = await denyUnless("deal.edit");
    if (denied) return denied;
    const memberId = sessionMemberId(req);
    if (!memberId) return NextResponse.json({ error: "Faça login novamente." }, { status: 401 });
    const { action, cardId, minutes } = await req.json();

    if (action === "stop") {
      await refresh(await stopTimer(memberId));
      return NextResponse.json({ success: true });
    }
    if (typeof cardId !== "string" || !cardId) return NextResponse.json({ error: "Missing cardId" }, { status: 400 });
    const hidden = await denyUnlessPipeline({ cardId });
    if (hidden) return hidden;
    if (action === "start") await refresh(await startTimer(memberId, cardId));
    else if (action === "log") await refresh(await logTime(memberId, cardId, Number(minutes)));
    else return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof DealValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const denied = await denyUnless("deal.edit");
    if (denied) return denied;
    const memberId = sessionMemberId(req);
    if (!memberId) return NextResponse.json({ error: "Faça login novamente." }, { status: 401 });
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const entry = await prisma.crmTimeEntry.findUnique({ where: { id }, select: { cardId: true } });
    const hidden = await denyUnlessPipeline({ cardId: entry?.cardId });
    if (hidden) return hidden;
    await refresh(await deleteEntry(id, memberId, await isCrmAdmin(memberId)));
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof DealValidationError) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

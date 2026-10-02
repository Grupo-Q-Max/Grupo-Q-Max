import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fireTriggers } from "@/lib/crm-automation";

/**
 * Incoming webhook of a "Webhook de entrada" trigger. External systems call
 * POST /api/crm/hook/<token> with `{ "dealNumber": 123 }` (or `dealId`, also
 * accepted as query string) to move the deal into the trigger's stage.
 */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const query = new URL(req.url).searchParams;
    const body = await req.json().catch(() => ({}));

    const dealId = body.dealId ?? query.get("dealId");
    const dealNumber = Number(body.dealNumber ?? query.get("dealNumber"));

    const trigger = await prisma.crmTrigger.findUnique({
      where: { webhookToken: token },
      select: { active: true, stage: { select: { pipelineId: true } } },
    });
    if (!trigger?.active) return NextResponse.json({ error: "Gatilho não encontrado" }, { status: 404 });

    const deal = await prisma.crmCard.findFirst({
      where: {
        ...(dealId ? { id: String(dealId) } : { number: Number.isInteger(dealNumber) && dealNumber > 0 ? dealNumber : -1 }),
        stage: { pipelineId: trigger.stage.pipelineId },
      },
      select: { id: true },
    });
    if (!deal) return NextResponse.json({ error: "Negócio não encontrado" }, { status: 404 });

    const movedTo = await fireTriggers(deal.id, { type: "WEBHOOK_IN", token });
    return NextResponse.json({ moved: Boolean(movedTo), stageId: movedTo });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export { POST as GET };

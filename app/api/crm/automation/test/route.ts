import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { denyUnless, denyUnlessPipeline } from "@/lib/crm-access";
import { testRule } from "@/lib/crm-automation";

/** { automationId, cardNumber }: what the saved rule would do for that deal ("Testar"); runs nothing. */
export async function POST(req: Request) {
  try {
    const denied = await denyUnless("automation.view");
    if (denied) return denied;
    const body = await req.json().catch(() => null);
    const automationId = typeof body?.automationId === "string" ? body.automationId : "";
    const cardNumber = Number(body?.cardNumber);
    if (!automationId || !Number.isInteger(cardNumber) || cardNumber <= 0) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const [rule, card] = await Promise.all([
      prisma.crmAutomation.findFirst({ where: { id: automationId, flowStepId: null }, select: { stage: { select: { pipelineId: true } } } }),
      prisma.crmCard.findUnique({ where: { number: cardNumber }, select: { id: true, stage: { select: { pipelineId: true } } } }),
    ]);
    if (!rule) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const hidden = await denyUnlessPipeline({ pipelineId: rule.stage.pipelineId, cardId: card?.id });
    if (hidden) return hidden;
    if (!card || card.stage.pipelineId !== rule.stage.pipelineId) {
      return NextResponse.json({ error: "Negócio não encontrado neste pipeline" }, { status: 404 });
    }

    const result = await testRule(automationId, card.id);
    if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

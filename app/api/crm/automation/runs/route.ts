import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { denyUnless, denyUnlessPipeline } from "@/lib/crm-access";
import { cancelRun, retryRun } from "@/lib/crm-automation";
import { sessionMemberId } from "@/lib/auth";

const PAGE_SIZE = 50;

/** Execution log of a pipeline's rules ("Registros"), newest first. */
export async function GET(req: Request) {
  try {
    const denied = await denyUnless("automation.view");
    if (denied) return denied;
    const params = new URL(req.url).searchParams;
    const pipelineId = params.get("pipelineId");
    if (!pipelineId) return NextResponse.json({ error: "Missing pipelineId" }, { status: 400 });

    const page = Math.max(0, Number(params.get("page")) || 0);
    const where = {
      automation: { stage: { pipelineId } },
      ...(params.get("status") && { status: params.get("status") as never }),
    };

    const [runs, total] = await Promise.all([
      prisma.crmAutomationRun.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: page * PAGE_SIZE,
        take: PAGE_SIZE,
        include: {
          automation: { select: { name: true, actionType: true, stage: { select: { name: true } } } },
          // FLOW runs: the path taken, plus the next step to run
          steps: { orderBy: { seq: "asc" } },
          step: {
            select: { type: true, waitAmount: true, waitUnit: true, actions: { take: 1, select: { name: true, actionType: true } } },
          },
          card: { select: { number: true, title: true } },
        },
      }),
      prisma.crmAutomationRun.count({ where }),
    ]);

    return NextResponse.json({ runs, total, pageSize: PAGE_SIZE });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/** { id, action: "retry" | "cancel" }: runs a failed run again, or skips one that has not started. */
export async function PATCH(req: Request) {
  try {
    const denied = await denyUnless("automation.edit");
    if (denied) return denied;
    const body = await req.json().catch(() => null);
    const id = typeof body?.id === "string" ? body.id : "";
    if (!id || (body.action !== "retry" && body.action !== "cancel")) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const run = await prisma.crmAutomationRun.findUnique({ where: { id }, select: { cardId: true } });
    if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const hidden = await denyUnlessPipeline({ cardId: run.cardId });
    if (hidden) return hidden;

    let ok: boolean;
    if (body.action === "retry") {
      ok = await retryRun(id);
    } else {
      const memberId = sessionMemberId(req);
      const member = memberId ? await prisma.teamMember.findUnique({ where: { id: memberId }, select: { name: true } }) : null;
      ok = await cancelRun(id, member?.name ?? "um usuário");
    }
    // The run changed state meanwhile (e.g. it already ran)
    if (!ok) return NextResponse.json({ error: "Conflict" }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

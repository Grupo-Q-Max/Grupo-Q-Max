import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 50;

/** Execution log of a pipeline's rules ("Registros"), newest first. */
export async function GET(req: Request) {
  try {
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
          automation: { select: { name: true, stage: { select: { name: true } } } },
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

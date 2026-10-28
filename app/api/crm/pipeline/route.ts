import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { denyUnless, denyUnlessPipeline, visibleCardWhere } from "@/lib/crm-access";
import { activeCard, cardListInclude, serializeListCard } from "@/lib/crm-deal";
import { deletePipelineWithFiles } from "@/lib/crm-attachments";
import { isQxbackStage } from "@/lib/crm-qxback";
import { notifyPipelineChanged } from "@/lib/crm-realtime";

/** Starting columns of a new pipeline, by kind. */
const DEFAULT_STAGES = {
  DEALS: ["Novos Leads", "Em Contato", "Fechado Ganho"],
  TASKS: ["A fazer", "Fazendo", "Feito"],
};

export async function POST(req: Request) {
  try {
    const denied = await denyUnless("pipeline.create");
    if (denied) return denied;
    const { name, kind, spaceId } = await req.json();

    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    const pipelineKind = kind === "TASKS" ? "TASKS" : "DEALS";

    const pipeline = await prisma.crmPipeline.create({
      data: {
        name,
        kind: pipelineKind,
        spaceId: typeof spaceId === "string" && spaceId ? spaceId : null,
        stages: { create: DEFAULT_STAGES[pipelineKind].map((stage, order) => ({ name: stage, order })) },
      },
      include: {
        stages: {
          orderBy: { order: "asc" },
          include: { cards: { include: cardListInclude } }
        }
      }
    });

    return NextResponse.json(pipeline);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const hidden = await denyUnlessPipeline({ pipelineId: id });
    if (hidden) return hidden;

    const pipeline = await prisma.crmPipeline.findUnique({
      where: { id },
      include: {
        stages: {
          orderBy: { order: "asc" },
          include: {
            cards: {
              where: { ...activeCard, ...(await visibleCardWhere()) },
              orderBy: { order: "asc" },
              include: cardListInclude
            }
          }
        }
      }
    });

    if (!pipeline) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Serialize Decimal
    const serialized = {
      ...pipeline,
      stages: pipeline.stages.map(stage => ({
        ...stage,
        cards: stage.cards.map(serializeListCard)
      }))
    };

    return NextResponse.json(serialized);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/** Deletes a pipeline (`?id=`) with no cards on the board; archived cards and templates go with it. */
export async function DELETE(req: Request) {
  try {
    const denied = await denyUnless("pipeline.delete");
    if (denied) return denied;
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const hidden = await denyUnlessPipeline({ pipelineId: id });
    if (hidden) return hidden;

    const pipeline = await prisma.crmPipeline.findUnique({ where: { id }, select: { stages: { select: { id: true } } } });
    if (!pipeline) return NextResponse.json({ error: "Not found" }, { status: 404 });
    // QXBACK_STAGES points at these stages: deleting them would break the referral program sync
    if (pipeline.stages.some((stage) => isQxbackStage(stage.id))) {
      return NextResponse.json({ error: "Pipeline integrado ao QXBACK não pode ser excluído." }, { status: 409 });
    }
    // Same rule as deleting a column: open/closed deals are never wiped by accident
    const cards = await prisma.crmCard.count({ where: { stage: { pipelineId: id }, ...activeCard } });
    if (cards > 0) {
      return NextResponse.json({ error: `Mova ou exclua os ${cards} card(s) deste pipeline antes de excluí-lo.` }, { status: 409 });
    }

    await deletePipelineWithFiles(id);
    // Other users on this board reload and land on the first visible pipeline
    notifyPipelineChanged(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

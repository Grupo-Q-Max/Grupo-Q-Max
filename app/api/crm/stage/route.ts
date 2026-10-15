import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { denyUnless, denyUnlessPipeline } from "@/lib/crm-access";
import { notifyPipelineChanged } from "@/lib/crm-realtime";
import { isQxbackStage } from "@/lib/crm-qxback";

export async function POST(req: Request) {
  try {
    const denied = await denyUnless("stage.create");
    if (denied) return denied;
    const { name, pipelineId } = await req.json();
    if (!name || !pipelineId) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    const hidden = await denyUnlessPipeline({ pipelineId });
    if (hidden) return hidden;

    const count = await prisma.crmStage.count({ where: { pipelineId } });
    const stage = await prisma.crmStage.create({
      data: {
        name,
        pipelineId,
        order: count
      },
      include: { cards: true }
    });
    notifyPipelineChanged(stage.pipelineId);

    return NextResponse.json(stage);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const denied = await denyUnless("stage.edit");
    if (denied) return denied;
    const { id, name, order } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const hidden = await denyUnlessPipeline({ stageId: id });
    if (hidden) return hidden;
    if (name !== undefined && (typeof name !== "string" || !name.trim())) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const stage = await prisma.crmStage.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(order !== undefined && { order })
      }
    });
    notifyPipelineChanged(stage.pipelineId);

    return NextResponse.json(stage);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const denied = await denyUnless("stage.delete");
    if (denied) return denied;
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const hidden = await denyUnlessPipeline({ stageId: id });
    if (hidden) return hidden;
    // QXBACK_STAGES points at this stage: deleting it would break the referral program sync
    if (isQxbackStage(id)) {
      return NextResponse.json({ error: "Etapa integrada ao QXBACK não pode ser excluída." }, { status: 409 });
    }

    const stage = await prisma.crmStage.delete({
      where: { id }
    });
    notifyPipelineChanged(stage.pipelineId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

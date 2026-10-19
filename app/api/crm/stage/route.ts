import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requiredFieldsOf } from "@/components/crm/deal/types";
import { prisma } from "@/lib/prisma";
import { denyUnless, denyUnlessPipeline } from "@/lib/crm-access";
import { notifyPipelineChanged } from "@/lib/crm-realtime";
import { isQxbackStage } from "@/lib/crm-qxback";
import { activeCard, resyncTaskStatuses } from "@/lib/crm-deal";

export async function POST(req: Request) {
  try {
    const denied = await denyUnless("stage.create");
    if (denied) return denied;
    const { name, pipelineId } = await req.json();
    if (typeof name !== "string" || !name.trim() || !pipelineId) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    const hidden = await denyUnlessPipeline({ pipelineId });
    if (hidden) return hidden;

    const stage = await prisma.$transaction(async (tx) => {
      const pipeline = await tx.crmPipeline.findUnique({
        where: { id: pipelineId },
        select: { kind: true, stages: { orderBy: { order: "desc" }, take: 1, select: { id: true, order: true } } },
      });
      if (!pipeline) return null;
      const last = pipeline.stages[0];
      // Task boards: the last column means "done", so a new column goes before it and no task changes status
      if (pipeline.kind === "TASKS" && last) await tx.crmStage.update({ where: { id: last.id }, data: { order: last.order + 1 } });
      return tx.crmStage.create({
        data: {
          name: name.trim(),
          pipelineId,
          order: last ? (pipeline.kind === "TASKS" ? last.order : last.order + 1) : 0
        },
        include: { cards: true }
      });
    });
    if (!stage) return NextResponse.json({ error: "Not found" }, { status: 404 });
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
    const { id, name, wipLimit, color, requiredFields, pipelineId, stageIds } = await req.json();

    // Column reorder: the pipeline's stage ids in their new order
    if (pipelineId !== undefined) {
      const hidden = await denyUnlessPipeline({ pipelineId });
      if (hidden) return hidden;
      const current = await prisma.crmStage.findMany({ where: { pipelineId }, select: { id: true } });
      const valid = Array.isArray(stageIds) && stageIds.length === current.length && new Set(stageIds).size === current.length
        && current.every((s) => stageIds.includes(s.id));
      if (!valid) return NextResponse.json({ error: "Invalid stageIds" }, { status: 400 });
      await prisma.$transaction(async (tx) => {
        for (const [order, stageId] of (stageIds as string[]).entries()) await tx.crmStage.update({ where: { id: stageId }, data: { order } });
        await resyncTaskStatuses(tx, pipelineId);
      });
      notifyPipelineChanged(pipelineId);
      return NextResponse.json({ success: true });
    }

    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const hidden = await denyUnlessPipeline({ stageId: id });
    if (hidden) return hidden;
    if (name !== undefined && (typeof name !== "string" || !name.trim())) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (wipLimit !== undefined && wipLimit !== null && !(Number.isInteger(wipLimit) && wipLimit > 0 && wipLimit <= 1000)) {
      return NextResponse.json({ error: "Informe um número inteiro de 1 a 1000." }, { status: 400 });
    }
    if (color !== undefined && color !== null && !(typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color))) {
      return NextResponse.json({ error: "Cor inválida." }, { status: 400 });
    }

    const required = requiredFieldsOf(requiredFields);
    const stage = await prisma.crmStage.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(wipLimit !== undefined && { wipLimit }),
        ...(color !== undefined && { color }),
        // Unknown keys are dropped; an empty list is stored as null (no requirement)
        ...(requiredFields !== undefined && { requiredFields: required.length ? required : Prisma.DbNull })
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

    const stage = await prisma.crmStage.findUnique({ where: { id }, select: { pipelineId: true } });
    if (!stage) return NextResponse.json({ error: "Not found" }, { status: 404 });
    // Deleting a column used to cascade-delete its cards (and leave their files on disk): ask to move them first
    const cards = await prisma.crmCard.count({ where: { stageId: id, ...activeCard } });
    if (cards > 0) {
      return NextResponse.json({ error: `Mova ou exclua os ${cards} card(s) desta coluna antes de excluí-la.` }, { status: 409 });
    }
    const other = await prisma.crmStage.findFirst({ where: { pipelineId: stage.pipelineId, NOT: { id } }, orderBy: { order: "asc" }, select: { id: true } });
    if (!other) return NextResponse.json({ error: "O pipeline precisa de pelo menos uma coluna." }, { status: 409 });

    await prisma.$transaction(async (tx) => {
      // Archived cards and templates are not on the board: they move to the first remaining column
      await tx.crmCard.updateMany({ where: { stageId: id }, data: { stageId: other.id } });
      await tx.crmStage.delete({ where: { id } });
      await resyncTaskStatuses(tx, stage.pipelineId);
    });
    notifyPipelineChanged(stage.pipelineId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

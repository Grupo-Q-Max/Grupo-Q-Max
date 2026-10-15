import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { denyUnless, denyUnlessPipeline } from "@/lib/crm-access";
import { notifyPipelineChanged } from "@/lib/crm-realtime";
import { isQxbackStage } from "@/lib/crm-qxback";

/**
 * Pipeline settings: name, custom fields, space, kind (DEALS/TASKS) and the groups that see it
 * (`groupIds: []` = every CRM user). Only the fields sent are changed.
 */
export async function PUT(req: Request) {
  try {
    const denied = await denyUnless("pipeline.edit");
    if (denied) return denied;
    const { id, fieldsConfig, name, spaceId, kind, groupIds } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }
    const hidden = await denyUnlessPipeline({ pipelineId: id });
    if (hidden) return hidden;

    const dataToUpdate: Prisma.CrmPipelineUncheckedUpdateInput = {};
    if (fieldsConfig !== undefined) dataToUpdate.fieldsConfig = fieldsConfig;
    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return NextResponse.json({ error: "Name is required" }, { status: 400 });
      }
      dataToUpdate.name = name.trim();
    }
    if (spaceId !== undefined) dataToUpdate.spaceId = typeof spaceId === "string" && spaceId ? spaceId : null;
    if (kind !== undefined) {
      if (kind !== "DEALS" && kind !== "TASKS") return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
      if (kind === "TASKS") {
        // The QXBACK pipeline reads value/services: it must stay a sales board
        const stages = await prisma.crmStage.findMany({ where: { pipelineId: id }, select: { id: true } });
        if (stages.some((s) => isQxbackStage(s.id))) {
          return NextResponse.json({ error: "O pipeline integrado ao QXBACK precisa ser de negócios." }, { status: 409 });
        }
      }
      dataToUpdate.kind = kind;
    }
    if (groupIds !== undefined) {
      if (!Array.isArray(groupIds) || !groupIds.every((g) => typeof g === "string")) {
        return NextResponse.json({ error: "Invalid groupIds" }, { status: 400 });
      }
      dataToUpdate.groups = { deleteMany: {}, create: [...new Set<string>(groupIds)].map((groupId) => ({ groupId })) };
    }

    const updated = await prisma.crmPipeline.update({
      where: { id },
      data: dataToUpdate
    });
    notifyPipelineChanged(id);

    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

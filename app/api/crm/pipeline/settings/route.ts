import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { denyUnless } from "@/lib/crm-access";
import { notifyPipelineChanged } from "@/lib/crm-realtime";

export async function PUT(req: Request) {
  try {
    const denied = await denyUnless("pipeline.edit");
    if (denied) return denied;
    const { id, fieldsConfig, name } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const dataToUpdate: any = {};
    if (fieldsConfig !== undefined) dataToUpdate.fieldsConfig = fieldsConfig;
    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return NextResponse.json({ error: "Name is required" }, { status: 400 });
      }
      dataToUpdate.name = name.trim();
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

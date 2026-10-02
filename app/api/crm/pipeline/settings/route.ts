import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyPipelineChanged } from "@/lib/crm-realtime";

export async function PUT(req: Request) {
  try {
    const { id, fieldsConfig } = await req.json();
    if (!id || !fieldsConfig) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const updated = await prisma.crmPipeline.update({
      where: { id },
      data: { fieldsConfig }
    });
    notifyPipelineChanged(id);

    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

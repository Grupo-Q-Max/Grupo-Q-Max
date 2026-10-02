import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: Request) {
  try {
    const { id, fieldsConfig, name } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const dataToUpdate: any = {};
    if (fieldsConfig !== undefined) dataToUpdate.fieldsConfig = fieldsConfig;
    if (name !== undefined) dataToUpdate.name = name;

    const updated = await prisma.crmPipeline.update({
      where: { id },
      data: dataToUpdate
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

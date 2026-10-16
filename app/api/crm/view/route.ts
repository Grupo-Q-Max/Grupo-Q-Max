import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { denyUnlessPipeline } from "@/lib/crm-access";
import { sessionMemberId } from "@/lib/auth";

const select = { id: true, name: true, query: true } as const;

/** The signed-in member's saved views of a board (`?pipelineId=`), by name. */
export async function GET(req: Request) {
  try {
    const pipelineId = new URL(req.url).searchParams.get("pipelineId");
    const memberId = sessionMemberId(req);
    if (!pipelineId || !memberId) return NextResponse.json([]);
    const hidden = await denyUnlessPipeline({ pipelineId });
    if (hidden) return hidden;
    const views = await prisma.crmSavedView.findMany({ where: { memberId, pipelineId }, orderBy: { name: "asc" }, select });
    return NextResponse.json(views);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/** Saves the board query under a name: `{ pipelineId, name, query }`; the same name replaces it. */
export async function POST(req: Request) {
  try {
    const memberId = sessionMemberId(req);
    if (!memberId) return NextResponse.json({ error: "Faça login novamente." }, { status: 401 });
    const body = await req.json();
    const pipelineId = typeof body.pipelineId === "string" ? body.pipelineId : "";
    const name = String(body.name ?? "").trim();
    // Only the board's own params (filters, view, sort), never a full URL
    const query = new URLSearchParams(typeof body.query === "string" ? body.query : "");
    query.delete("pipelineId");
    if (!pipelineId || !name || name.length > 60) return NextResponse.json({ error: "Nome inválido (máx. 60 caracteres)." }, { status: 400 });
    if (query.toString().length > 1000) return NextResponse.json({ error: "Filtros longos demais." }, { status: 400 });
    const hidden = await denyUnlessPipeline({ pipelineId });
    if (hidden) return hidden;

    const view = await prisma.crmSavedView.upsert({
      where: { memberId_pipelineId_name: { memberId, pipelineId, name } },
      create: { memberId, pipelineId, name, query: query.toString() },
      update: { query: query.toString() },
      select,
    });
    return NextResponse.json(view);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json({ error: "Pipeline não encontrado." }, { status: 404 });
    }
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/** Deletes one of the member's own views (`?id=`). */
export async function DELETE(req: Request) {
  try {
    const memberId = sessionMemberId(req);
    const id = new URL(req.url).searchParams.get("id");
    if (!memberId || !id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    await prisma.crmSavedView.deleteMany({ where: { id, memberId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

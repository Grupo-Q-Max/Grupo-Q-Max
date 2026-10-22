import { NextResponse, after } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { notifyStageChanged } from "@/lib/crm-realtime";
import { fireTriggers, onDealEnteredStage } from "@/lib/crm-automation";
import { notifyAssigned, notifyNewAssignees } from "@/lib/crm-card-notify";
import { isDueTime } from "@/lib/crm-due";
import { appUrl } from "@/lib/mail";

const digest = (value: string) => createHash("sha256").update(value).digest();
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];

/**
 * Task API for scripts and AI agents (no browser): `Authorization: Bearer <CRM_API_TOKEN>`.
 * GET lists the task boards, their columns and the active members; POST creates a task.
 * Public in proxy.ts; the token is the authentication and sees every task board.
 */
function denied(req: Request) {
  const secret = process.env.CRM_API_TOKEN;
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (secret && timingSafeEqual(digest(token), digest(secret))) return null;
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) || null : null);

export async function GET(req: Request) {
  const refused = denied(req);
  if (refused) return refused;
  const [pipelines, members] = await Promise.all([
    prisma.crmPipeline.findMany({
      where: { kind: "TASKS" },
      orderBy: [{ spaceId: "asc" }, { order: "asc" }],
      select: { id: true, name: true, stages: { orderBy: { order: "asc" }, select: { id: true, name: true } } },
    }),
    prisma.teamMember.findMany({
      where: { crmActive: true, email: { not: null } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
  ]);
  return NextResponse.json({ pipelines, members, priorities: PRIORITIES });
}

/**
 * Body: { pipeline (id or name), title, stage? (id or name; default first column), description?,
 * dueDate? "yyyy-mm-dd", dueTime? "HH:MM", priority?, responsible? (email or id), assignees? [email or id] }.
 */
export async function POST(req: Request) {
  const refused = denied(req);
  if (refused) return refused;
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return NextResponse.json({ error: "JSON body expected" }, { status: 400 });

    const title = text(body.title, 191);
    const pipelineRef = text(body.pipeline, 191);
    if (!title || !pipelineRef) return NextResponse.json({ error: "title and pipeline are required" }, { status: 400 });

    const pipeline = await prisma.crmPipeline.findFirst({
      where: { kind: "TASKS", OR: [{ id: pipelineRef }, { name: pipelineRef }] },
      select: { id: true, stages: { orderBy: { order: "asc" }, select: { id: true, name: true } } },
    });
    if (!pipeline) return NextResponse.json({ error: `Task board "${pipelineRef}" not found` }, { status: 404 });

    const stageRef = text(body.stage, 191)?.toLowerCase();
    const stage = stageRef ? pipeline.stages.find((s) => s.id === stageRef || s.name.toLowerCase() === stageRef) : pipeline.stages[0];
    if (!stage) return NextResponse.json({ error: stageRef ? `Column "${body.stage}" not found` : "Board has no columns" }, { status: 404 });

    const dueDate = body.dueDate ?? null;
    if (dueDate !== null && !(typeof dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dueDate) && !isNaN(Date.parse(dueDate)))) {
      return NextResponse.json({ error: "dueDate must be yyyy-mm-dd" }, { status: 400 });
    }
    const dueTime = body.dueTime ?? null;
    if (dueTime !== null && !isDueTime(dueTime)) return NextResponse.json({ error: "dueTime must be HH:MM" }, { status: 400 });
    const priority = body.priority ?? null;
    if (priority !== null && !PRIORITIES.includes(priority)) {
      return NextResponse.json({ error: `priority must be one of ${PRIORITIES.join(", ")}` }, { status: 400 });
    }

    // Members by e-mail or id; only active CRM users
    const refs = [body.responsible, ...(Array.isArray(body.assignees) ? body.assignees : [])].filter((r): r is string => typeof r === "string" && !!r.trim()).map((r) => r.trim());
    const found = refs.length
      ? await prisma.teamMember.findMany({ where: { crmActive: true, OR: [{ id: { in: refs } }, { email: { in: refs } }] }, select: { id: true, email: true } })
      : [];
    const memberId = (ref: string) => found.find((m) => m.id === ref || m.email?.toLowerCase() === ref.toLowerCase())?.id;
    const missing = refs.filter((r) => !memberId(r));
    if (missing.length) return NextResponse.json({ error: `Member not found: ${missing.join(", ")}` }, { status: 400 });
    const responsibleId = typeof body.responsible === "string" && body.responsible.trim() ? memberId(body.responsible.trim())! : null;
    const assigneeIds = [...new Set(refs.slice(responsibleId ? 1 : 0).map((r) => memberId(r)!))].filter((id) => id !== responsibleId);

    const card = await prisma.crmCard.create({
      data: {
        title,
        stageId: stage.id,
        responsibleId,
        comment: text(body.description, 65535),
        closeDate: dueDate ? new Date(dueDate) : null,
        dueTime: dueDate ? dueTime : null,
        priority,
        customData: {},
        order: await prisma.crmCard.count({ where: { stageId: stage.id } }),
        assignees: { create: assigneeIds.map((id) => ({ memberId: id })) },
        history: { create: { type: "CREATED", data: { title, source: "api" }, actorId: null } },
      },
      select: { id: true, number: true, stageId: true },
    });

    await notifyStageChanged(card.stageId);
    // Same follow-up as "Nova tarefa" on the board (app/api/crm/card)
    after(async () => {
      if (responsibleId) await notifyAssigned(card.id, null);
      if (assigneeIds.length) await notifyNewAssignees(card.id, [], null);
      if (!(await fireTriggers(card.id, { type: "DEAL_CREATED" }))) await onDealEnteredStage(card.id, card.stageId);
    });

    const url = `${appUrl(req)}/crm/deal/details/${card.number}`;
    return NextResponse.json({ id: card.id, number: card.number, stage: stage.name, url }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { denyUnless, denyUnlessPipeline } from "@/lib/crm-access";
import { notifyStageChanged } from "@/lib/crm-realtime";
import { fireTriggers, onDealEnteredStage } from "@/lib/crm-automation";
import { StageEntryError, checkStageEntry, isQxbackStage, notifyQxback } from "@/lib/crm-qxback";
import { notifyAssigned, notifyMoved, notifyUnblocked } from "@/lib/crm-card-notify";
import { sessionMemberId } from "@/lib/auth";
import { deleteCardWithFiles } from "@/lib/crm-attachments";
import {
  DealValidationError,
  DuplicateDealError,
  cardListInclude,
  companyIdByName,
  copyCard,
  findDuplicateDeals,
  getDealDetails,
  restoreChanges,
  validParent,
  serializeListCard,
  updateDeal,
} from "@/lib/crm-deal";

export async function GET(req: Request) {
  try {
    const params = new URL(req.url).searchParams;
    const archivedOf = params.get("archivedOf");
    if (archivedOf) return listArchived(archivedOf);
    const templatesOf = params.get("templatesOf");
    if (templatesOf) return listTemplates(templatesOf);
    const id = params.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const hidden = await denyUnlessPipeline({ cardId: id });
    if (hidden) return hidden;

    const deal = await getDealDetails(id);
    if (!deal) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(deal);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const denied = await denyUnless("deal.create");
    if (denied) return denied;
    const body = await req.json();
    const actorId = sessionMemberId(req);
    if (typeof body.duplicateOf === "string") return duplicate(body.duplicateOf, actorId);
    if (typeof body.saveAsTemplate === "string") return saveAsTemplate(body.saveAsTemplate, actorId);
    if (typeof body.fromTemplate === "string") return createFromTemplate(body.fromTemplate, body, actorId);
    const { title, company, value, stageId, customData, referredBy, responsibleId, closeDate, comment, force, parentId } = body;
    if (!title || !stageId) return NextResponse.json({ error: "Missing title or stageId" }, { status: 400 });
    const hidden = await denyUnlessPipeline({ stageId });
    if (hidden) return hidden;
    const responsible = typeof responsibleId === "string" && responsibleId ? responsibleId : null;

    const card = await prisma.$transaction(async (tx) => {
      const { pipelineId } = await tx.crmStage.findUniqueOrThrow({ where: { id: stageId }, select: { pipelineId: true } });
      // Subtask ("Adicionar subtarefa" in the panel): parent of the same board, one level only
      const parent = typeof parentId === "string" && parentId ? await validParent(tx, null, parentId, pipelineId) : null;
      const companyId = await companyIdByName(tx, company);
      if (!force && !parent) {
        // Throwing rolls back a company created just above
        const duplicates = await findDuplicateDeals(tx, { title, pipelineId, companyId, responsibleId: responsible, value: Number(value) || 0 });
        if (duplicates.length) throw new DuplicateDealError(duplicates);
      }
      return tx.crmCard.create({
        data: {
          title,
          value: value || 0,
          stageId,
          companyId,
          responsibleId: responsible,
          customData: customData || {},
          referredBy: typeof referredBy === "string" ? referredBy.trim().slice(0, 200) || null : null,
          // Task boards: deadline (yyyy-mm-dd) and description
          closeDate: typeof closeDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(closeDate) ? new Date(closeDate) : null,
          comment: typeof comment === "string" ? comment.trim() || null : null,
          order: await tx.crmCard.count({ where: { stageId } }),
          parentId: parent?.id ?? null,
          history: { create: { type: "CREATED", data: { title }, actorId } },
        },
        include: cardListInclude,
      });
    });

    await notifyStageChanged(card.stageId);
    // A "negócio criado" trigger may move the deal right away; otherwise run the first stage's rules
    after(async () => {
      if (!(await fireTriggers(card.id, { type: "DEAL_CREATED" }))) await onDealEnteredStage(card.id, card.stageId);
    });

    return NextResponse.json(serializeListCard(card));
  } catch (error) {
    if (error instanceof DuplicateDealError) {
      return NextResponse.json({ error: "duplicate", deals: error.deals }, { status: 409 });
    }
    if (error instanceof DealValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/** Archived cards of a pipeline (list view "Arquivados"), most recently archived first. */
async function listArchived(pipelineId: string) {
  const hidden = await denyUnlessPipeline({ pipelineId });
  if (hidden) return hidden;
  const cards = await prisma.crmCard.findMany({
    where: { archivedAt: { not: null }, isTemplate: false, stage: { pipelineId } },
    orderBy: { archivedAt: "desc" },
    take: 500,
    include: cardListInclude,
  });
  return NextResponse.json(cards.map(serializeListCard));
}

/** Templates of a pipeline, for the "Nova tarefa" modal. */
async function listTemplates(pipelineId: string) {
  const hidden = await denyUnlessPipeline({ pipelineId });
  if (hidden) return hidden;
  const templates = await prisma.crmCard.findMany({
    where: { isTemplate: true, stage: { pipelineId } },
    orderBy: { title: "asc" },
    select: { id: true, number: true, title: true },
  });
  return NextResponse.json(templates);
}

/** "Salvar como modelo": template copy of the card (dates dropped), kept out of the board. */
async function saveAsTemplate(id: string, actorId: string | null) {
  const hidden = await denyUnlessPipeline({ cardId: id });
  if (hidden) return hidden;
  const template = await prisma.$transaction((tx) => copyCard(tx, id, { isTemplate: true, startDate: null, closeDate: null, history: { templateFrom: id }, actorId }));
  return NextResponse.json({ id: template.id, number: template.number });
}

/** "Nova tarefa" from a template: copy in the first column with the title, deadline and responsible typed in the modal. */
async function createFromTemplate(id: string, body: { title?: unknown; closeDate?: unknown; responsibleId?: unknown }, actorId: string | null) {
  const hidden = await denyUnlessPipeline({ cardId: id });
  if (hidden) return hidden;
  const template = await prisma.crmCard.findUnique({ where: { id }, select: { isTemplate: true } });
  if (!template?.isTemplate) return NextResponse.json({ error: "Modelo não encontrado." }, { status: 404 });

  const title = typeof body.title === "string" ? body.title.trim().slice(0, 191) : "";
  const closeDate = typeof body.closeDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.closeDate) ? new Date(body.closeDate) : null;
  const responsibleId = typeof body.responsibleId === "string" && body.responsibleId ? body.responsibleId : null;
  if (responsibleId && !(await prisma.teamMember.count({ where: { id: responsibleId } }))) {
    return NextResponse.json({ error: "Responsável não encontrado." }, { status: 400 });
  }
  const card = await prisma.$transaction((tx) =>
    copyCard(tx, id, {
      ...(title && { title }),
      responsibleId,
      startDate: null,
      closeDate,
      history: { templateId: id },
      actorId,
    })
  );

  await notifyStageChanged(card.stageId);
  after(async () => {
    if (!(await fireTriggers(card.id, { type: "DEAL_CREATED" }))) await onDealEnteredStage(card.id, card.stageId);
  });
  return NextResponse.json({ id: card.id, number: card.number });
}

/** "Duplicar": copy of the card (relations, description, checklist) at the end of the same column. */
async function duplicate(id: string, actorId: string | null) {
  const hidden = await denyUnlessPipeline({ cardId: id });
  if (hidden) return hidden;
  const card = await prisma.$transaction(async (tx) => {
    const source = await tx.crmCard.findUnique({ where: { id }, select: { title: true, stageId: true, startDate: true, closeDate: true } });
    if (!source) return null;
    return copyCard(tx, id, {
      stageId: source.stageId,
      title: `${source.title} (cópia)`.slice(0, 191),
      startDate: source.startDate,
      closeDate: source.closeDate,
      history: { duplicatedFrom: id },
      actorId,
    });
  });
  if (!card) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await notifyStageChanged(card.stageId);
  after(async () => {
    if (!(await fireTriggers(card.id, { type: "DEAL_CREATED" }))) await onDealEnteredStage(card.id, card.stageId);
  });
  return NextResponse.json({ id: card.id, number: card.number });
}

/**
 * Partial update from the deal panel: any scalar/relation field from
 * lib/crm-deal plus `stageId` and `status`. Every real change is recorded
 * in the deal history.
 */
export async function PATCH(req: Request) {
  try {
    const denied = await denyUnless("deal.edit");
    if (denied) return denied;
    const { id, lostReason, restoreStageId, ...changes } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    // A stage change must also land in a pipeline the user sees
    const hidden = await denyUnlessPipeline({ cardId: id, stageId: typeof changes.stageId === "string" ? changes.stageId : null });
    if (hidden) return hidden;
    const authorId = sessionMemberId(req);

    let result;
    if (typeof restoreStageId === "string") {
      // Back to the state saved when the deal left that stage (fields only; stage and status stay)
      const restore = await restoreChanges(id, restoreStageId);
      result = await updateDeal(id, restore.changes, { note: { type: "STATE_RESTORED", data: { stage: restore.stage } }, actorId: authorId });
    } else {
      if (typeof changes.stageId === "string") {
        const current = await prisma.crmCard.findUnique({ where: { id }, select: { stageId: true } });
        if (current && current.stageId !== changes.stageId) await checkStageEntry(id, changes.stageId, lostReason);
      }
      result = await updateDeal(id, changes, { actorId: authorId });
    }

    if (result.changed) await notifyStageChanged(result.stageId);
    after(async () => {
      if (result.recurringCopy) await onDealEnteredStage(result.recurringCopy.id, result.recurringCopy.stageId);
      if (result.changedFields.includes("responsibleId")) await notifyAssigned(id, authorId);
      if (result.changedFields.includes("status")) await notifyUnblocked(id, authorId);
      // A manual stage change runs the new stage's rules; other changes may fire a "campo alterado" trigger
      if (result.movedTo) await notifyMoved(id, result.movedTo, authorId);
      if (result.movedTo) await onDealEnteredStage(id, result.movedTo);
      else if (result.changedFields.length) await fireTriggers(id, { type: "FIELD_CHANGED", fields: result.changedFields });

      // Edits made here (not through the QXBACK rest route) to a QXBACK deal's products/value/comment:
      // tell QXBACK so it re-reads the deal (same role as Bitrix's own ONCRMDEALUPDATE push)
      const stageId = result.movedTo ?? result.stageId;
      if (isQxbackStage(stageId) && result.changedFields.some((f) => ["products", "value", "comment"].includes(f))) {
        const deal = await prisma.crmCard.findUnique({ where: { id }, select: { number: true } });
        if (deal) await notifyQxback(deal.number);
      }
    });
    return NextResponse.json(await getDealDetails(id));
  } catch (error) {
    if (error instanceof DealValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof StageEntryError) return error.toResponse();
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const denied = await denyUnless("deal.delete");
    if (denied) return denied;
    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const hidden = await denyUnlessPipeline({ cardId: id });
    if (hidden) return hidden;

    const card = await deleteCardWithFiles(id);
    await notifyStageChanged(card.stageId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

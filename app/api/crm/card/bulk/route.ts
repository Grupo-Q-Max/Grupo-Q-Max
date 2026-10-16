import { NextResponse, after } from "next/server";
import { canSeePipeline, denyUnless } from "@/lib/crm-access";
import { notifyStageChanged } from "@/lib/crm-realtime";
import { fireTriggers, onDealEnteredStage } from "@/lib/crm-automation";
import { checkStageEntry } from "@/lib/crm-qxback";
import { notifyAssigned, notifyMoved } from "@/lib/crm-card-notify";
import { prisma } from "@/lib/prisma";
import { deleteCardWithFiles } from "@/lib/crm-attachments";
import { sessionMemberId } from "@/lib/auth";
import { updateDeal } from "@/lib/crm-deal";

const MAX_IDS = 200;

/**
 * Same change on several cards: `{ ids, action: "move" | "responsible" | "priority" | "tag" | "due" | "archive" | "delete", value }`
 * ("archive" with value "restore" unarchives; "tag" adds the tag id; "due" sets the deadline "YYYY-MM-DD", "" clears it).
 * Each card goes through the single-card path (history, stage rules, notifications); cards the user can't
 * see or that a stage rule refuses are skipped and counted in `failed`.
 */
export async function POST(req: Request) {
  try {
    const { ids, action, value } = await req.json();
    if (!Array.isArray(ids) || !ids.length || ids.length > MAX_IDS || !ids.every((id) => typeof id === "string")) {
      return NextResponse.json({ error: `Selecione de 1 a ${MAX_IDS} itens.` }, { status: 400 });
    }
    const denied = await denyUnless(action === "delete" ? "deal.delete" : "deal.edit");
    if (denied) return denied;
    const stageId = typeof value === "string" && value ? value : null;

    let changes: Record<string, unknown>;
    if (action === "move") {
      if (!stageId || !(await canSeePipeline({ stageId }))) return NextResponse.json({ error: "Coluna inválida." }, { status: 400 });
      changes = { stageId };
    } else if (action === "responsible") changes = { responsibleId: stageId };
    else if (action === "priority") changes = { priority: stageId };
    else if (action === "archive") changes = { archived: value !== "restore" };
    else if (action === "due") {
      if (value !== "" && !(typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value))) return NextResponse.json({ error: "Data inválida." }, { status: 400 });
      changes = { closeDate: value };
    } else if (action === "tag") {
      if (!stageId || !(await prisma.crmTag.count({ where: { id: stageId } }))) return NextResponse.json({ error: "Etiqueta inválida." }, { status: 400 });
      changes = {}; // per card below: its own tags plus this one
    }
    else if (action === "delete") changes = {};
    else return NextResponse.json({ error: "Ação inválida." }, { status: 400 });

    const authorId = sessionMemberId(req);
    const touchedStages = new Set<string>();
    let done = 0;
    // ponytail: one card at a time; fine for a few hundred, batch the writes if bulk edits grow
    for (const id of new Set<string>(ids)) {
      try {
        if (!(await canSeePipeline({ cardId: id }))) continue;
        if (action === "delete") {
          touchedStages.add((await deleteCardWithFiles(id)).stageId);
          done++;
          continue;
        }
        if (action === "move") await checkStageEntry(id, stageId!, null);
        const result = await updateDeal(
          id,
          action === "tag"
            ? { tags: [...(await prisma.crmCardTag.findMany({ where: { cardId: id }, select: { tagId: true } })).map((t) => t.tagId), stageId] }
            : changes,
          { actorId: authorId }
        );
        done++;
        if (!result.changed) continue;
        touchedStages.add(result.stageId);
        after(async () => {
          if (result.recurringCopy) await onDealEnteredStage(result.recurringCopy.id, result.recurringCopy.stageId);
          if (result.movedTo) await notifyMoved(id, result.movedTo, authorId);
          if (result.movedTo) await onDealEnteredStage(id, result.movedTo);
          else if (result.changedFields.length) await fireTriggers(id, { type: "FIELD_CHANGED", fields: result.changedFields });
          if (result.changedFields.includes("responsibleId")) await notifyAssigned(id, authorId);
        });
      } catch (error) {
        console.error(`[crm-bulk] ${action} ${id} failed:`, error instanceof Error ? error.message : error);
      }
    }

    // Refresh the open boards of every pipeline touched
    for (const stage of touchedStages) await notifyStageChanged(stage);
    return NextResponse.json({ done, failed: new Set(ids).size - done });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

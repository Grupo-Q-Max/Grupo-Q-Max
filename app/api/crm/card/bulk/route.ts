import { NextResponse, after } from "next/server";
import { canSeePipeline, denyUnless } from "@/lib/crm-access";
import { notifyStageChanged } from "@/lib/crm-realtime";
import { fireTriggers, onDealEnteredStage } from "@/lib/crm-automation";
import { checkStageEntry } from "@/lib/crm-qxback";
import { notifyAssigned } from "@/lib/crm-card-notify";
import { deleteCardWithFiles } from "@/lib/crm-attachments";
import { sessionMemberId } from "@/lib/auth";
import { updateDeal } from "@/lib/crm-deal";

const MAX_IDS = 200;

/**
 * Same change on several cards: `{ ids, action: "move" | "responsible" | "priority" | "delete", value }`.
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
        const result = await updateDeal(id, changes);
        done++;
        if (!result.changed) continue;
        touchedStages.add(result.stageId);
        after(async () => {
          if (result.recurringCopy) await onDealEnteredStage(result.recurringCopy.id, result.recurringCopy.stageId);
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

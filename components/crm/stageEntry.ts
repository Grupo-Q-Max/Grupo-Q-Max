import { alertDialog, promptDialog } from "@/components/ui/Dialogs";

/**
 * Sends a stage move and handles the QXBACK stage rules (lib/crm-qxback.ts checkStageEntry):
 * asks for the lost reason when the server needs it and sends again; shows any other refusal.
 * Returns the final response, or null when the user cancelled or the move was refused.
 */
export async function sendStageMove(send: (extra: { lostReason?: string }) => Promise<Response>) {
  let res = await send({});
  let body = res.status === 422 ? await res.clone().json().catch(() => null) : null;

  if (body?.need === "lostReason") {
    const lostReason = (await promptDialog("Motivo da perda (será mostrado ao indicador):", { confirmLabel: "Mover" }))?.trim();
    if (!lostReason) return null;
    res = await send({ lostReason });
    body = res.status === 422 ? await res.clone().json().catch(() => null) : null;
  }

  if (body?.error) {
    await alertDialog(body.error);
    return null;
  }
  return res.ok ? res : null;
}

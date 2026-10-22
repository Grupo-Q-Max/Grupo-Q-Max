import { NextResponse, after } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { notifyStageChanged } from "@/lib/crm-realtime";
import { fireTriggers, onDealEnteredStage } from "@/lib/crm-automation";
import { BitrixError, callMethod, parseParams } from "@/lib/crm-qxback";

const digest = (value: string) => createHash("sha256").update(value).digest();

/**
 * Bitrix24-style REST endpoint for the QXBACK: <base>/api/crm/qxback/<QXBACK_TOKEN>/<method>
 * (form-encoded like Bitrix webhooks; `.json` suffix accepted). Methods: lib/crm-qxback.ts.
 */
async function handler(req: Request, { params }: { params: Promise<{ token: string; method: string }> }) {
  const { token, method } = await params;
  const secret = process.env.QXBACK_TOKEN;
  if (!secret || !timingSafeEqual(digest(token), digest(secret))) {
    return NextResponse.json({ error: "INVALID_TOKEN", error_description: "Token inválido" }, { status: 401 });
  }

  try {
    const search = new URL(req.url).searchParams;
    if (req.method === "POST") for (const [k, v] of new URLSearchParams(await req.text())) search.append(k, v);

    const { body, effect } = await callMethod(method.replace(/\.json$/, ""), parseParams(search));

    if (effect) {
      await notifyStageChanged(effect.stageId);
      // Same follow-up as the deal panel (app/api/crm/card)
      after(async () => {
        if (effect.type === "created" && !(await fireTriggers(effect.dealId, { type: "DEAL_CREATED" }))) {
          await onDealEnteredStage(effect.dealId, effect.stageId);
        }
        // QXBACK moved the deal: run the new stage's rules like a move made in the board (this also tells QXBACK back)
        if (effect.type === "updated" && effect.movedTo) await onDealEnteredStage(effect.dealId, effect.movedTo);
        else if (effect.type === "updated" && effect.changedFields.length) {
          await fireTriggers(effect.dealId, { type: "FIELD_CHANGED", fields: effect.changedFields });
        }
      });
    }
    return NextResponse.json(body);
  } catch (error) {
    if (error instanceof BitrixError) {
      return NextResponse.json({ error: error.code, error_description: error.message }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: "INTERNAL", error_description: "Erro interno" }, { status: 500 });
  }
}

export { handler as GET, handler as POST };

import { NextResponse, after } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { notifyStageChanged } from "@/lib/crm-realtime";
import { fireTriggers, onDealEnteredStage } from "@/lib/crm-automation";
import { BitrixError, callQxsignMethod, parseParams } from "@/lib/crm-qxsign";

const digest = (value: string) => createHash("sha256").update(value).digest();

/**
 * Bitrix24-style REST endpoint for QXSIGN: <base>/api/crm/qxsign/<QXSIGN_TOKEN>/<method>
 */
async function handler(req: Request, { params }: { params: Promise<{ token: string; method: string }> }) {
  const { token, method } = await params;
  const secret = process.env.QXSIGN_TOKEN;
  if (!secret || !timingSafeEqual(digest(token), digest(secret))) {
    return NextResponse.json({ error: "INVALID_TOKEN", error_description: "Token inválido" }, { status: 401 });
  }

  try {
    const search = new URL(req.url).searchParams;
    if (req.method === "POST") for (const [k, v] of new URLSearchParams(await req.text())) search.append(k, v);

    const { body, effect } = await callQxsignMethod(method.replace(/\.json$/, ""), parseParams(search));

    if (effect) {
      await notifyStageChanged(effect.stageId);
      after(async () => {
        if (effect.type === "created" && !(await fireTriggers(effect.dealId, { type: "DEAL_CREATED" }))) {
          await onDealEnteredStage(effect.dealId, effect.stageId);
        }
        if (effect.type === "updated" && effect.changedFields.length) {
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

import { NextResponse } from "next/server";
import { processDueRuns } from "@/lib/crm-automation";
import { remindOverdueActivities } from "@/lib/crm-activities";

/**
 * Runs the delayed automation rules that are due. Called every minute by the
 * in-process ticker (instrumentation.ts) and, when scaled out, by an external
 * scheduler with the `Authorization: Bearer <CRON_SECRET>` header.
 */
async function handler(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const processed = await processDueRuns();
  const reminded = await remindOverdueActivities();
  return NextResponse.json({ processed, reminded });
}

export { handler as GET, handler as POST };

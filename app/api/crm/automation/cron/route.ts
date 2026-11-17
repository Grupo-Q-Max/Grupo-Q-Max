import { NextResponse } from "next/server";
import { processDueRuns } from "@/lib/crm-automation";
import { mailTaskChanges, remindDueTasks } from "@/lib/crm-my-tasks";
import { purgeExpiredDataDaily } from "@/lib/data-retention";

/**
 * Runs the delayed automation rules that are due, reminds responsibles of due
 * tasks/activities and e-mails them what changed on their tasks. Same work as the in-process ticker (instrumentation-node.ts);
 * called, when scaled out, by an external
 * scheduler with the `Authorization: Bearer <CRON_SECRET>` header.
 */
async function handler(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const processed = await processDueRuns();
  const reminded = await remindDueTasks();
  const mailed = await mailTaskChanges();
  const retention = await purgeExpiredDataDaily();
  return NextResponse.json({ processed, reminded, mailed, retention });
}

export { handler as GET, handler as POST };

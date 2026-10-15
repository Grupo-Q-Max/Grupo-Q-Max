import { NextResponse } from "next/server";
import { processDueRuns } from "@/lib/crm-automation";
import { remindDueTasks } from "@/lib/crm-my-tasks";

/**
 * Runs the delayed automation rules that are due and reminds responsibles of due
 * tasks/activities. Same work as the in-process ticker (instrumentation-node.ts);
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
  return NextResponse.json({ processed, reminded });
}

export { handler as GET, handler as POST };

import { processDueRuns } from "./lib/crm-automation";

/*
 * CRM automation ticker: every minute, run the delayed automation rules that
 * are due. Set CRM_AUTOMATION_TICKER=off to disable it (e.g. when an external
 * scheduler calls /api/crm/automation/cron instead).
 */
const globalForTicker = globalThis as unknown as { qmaxAutomationTicker?: NodeJS.Timeout };

if (
  process.env.NEXT_PHASE !== "phase-production-build" &&
  process.env.CRM_AUTOMATION_TICKER !== "off" &&
  !globalForTicker.qmaxAutomationTicker
) {
  globalForTicker.qmaxAutomationTicker = setInterval(() => void processDueRuns(), 60_000);
  globalForTicker.qmaxAutomationTicker.unref();
}

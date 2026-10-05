/*
 * CRM automation ticker: every minute, run the delayed automation rules that
 * are due. Set CRM_AUTOMATION_TICKER=off to disable it (e.g. when an external
 * scheduler calls /api/crm/automation/cron instead).
 *
 * The automation engine (and with it Prisma) is imported lazily inside the
 * tick: a failure there must never break the instrumentation hook, because
 * Next.js answers every request with 500 when the hook throws.
 */
const globalForTicker = globalThis as unknown as { qmaxAutomationTicker?: NodeJS.Timeout };

async function tick() {
  try {
    const { processDueRuns } = await import("./lib/crm-automation");
    await processDueRuns();
  } catch (error) {
    console.error("[crm-automation] ticker failed:", error);
  }
}

if (
  process.env.NEXT_PHASE !== "phase-production-build" &&
  process.env.CRM_AUTOMATION_TICKER !== "off" &&
  process.env.DATABASE_URL &&
  !globalForTicker.qmaxAutomationTicker
) {
  globalForTicker.qmaxAutomationTicker = setInterval(() => void tick(), 60_000);
  globalForTicker.qmaxAutomationTicker.unref();
}

export {};

/*
 * CRM sign-in check at boot. A missing Microsoft configuration is logged loudly here and makes
 * /login and /api/auth/microsoft fail, but the public website keeps working.
 */
if (process.env.NEXT_PHASE !== "phase-production-build") {
  import("./lib/microsoft-auth")
    .then(({ microsoftConfig }) => microsoftConfig())
    .catch((error) => console.error("[auth] CRM sign-in with Microsoft is DISABLED:", error instanceof Error ? error.message : error));
}

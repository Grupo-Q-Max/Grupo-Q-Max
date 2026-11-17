import { legal } from "@/data/site";
import { prisma } from "@/lib/prisma";
import { retentionCutoff } from "@/lib/retention-cutoff";

/*
 * LGPD retention (Art. 15 and 16): personal data is kept only while needed for its purpose.
 * Site leads are deleted after legal.retention.leadsMonths and page visits after
 * legal.retention.pageVisitsMonths. The privacy policy states the same periods.
 * Leads that became CRM deals live on in the CRM (CrmContact/CrmCard) under the contract's own basis.
 */
const BATCH = 1000;

async function deleteBefore(model: "contactLead" | "pageVisit", cutoff: Date): Promise<number> {
  let total = 0;
  for (;;) {
    // MariaDB has no DELETE ... LIMIT through Prisma: select a batch of ids, then delete them
    const rows =
      model === "contactLead"
        ? await prisma.contactLead.findMany({ where: { createdAt: { lt: cutoff } }, select: { id: true }, take: BATCH })
        : await prisma.pageVisit.findMany({ where: { createdAt: { lt: cutoff } }, select: { id: true }, take: BATCH });
    if (rows.length === 0) return total;
    const ids = rows.map((row) => row.id);
    const { count } =
      model === "contactLead"
        ? await prisma.contactLead.deleteMany({ where: { id: { in: ids } } })
        : await prisma.pageVisit.deleteMany({ where: { id: { in: ids } } });
    total += count;
    if (rows.length < BATCH) return total;
  }
}

export async function purgeExpiredData(now = new Date()) {
  const leads = await deleteBefore("contactLead", retentionCutoff(now, legal.retention.leadsMonths));
  const visits = await deleteBefore("pageVisit", retentionCutoff(now, legal.retention.pageVisitsMonths));
  if (leads || visits) console.info(`[data-retention] removed ${leads} lead(s) and ${visits} page visit(s)`);
  return { leads, visits };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const globalForRetention = globalThis as unknown as { qmaxRetentionLastRun?: number };

/** Runs purgeExpiredData at most once a day per instance (called from the minute ticker). */
export async function purgeExpiredDataDaily() {
  const last = globalForRetention.qmaxRetentionLastRun ?? 0;
  if (Date.now() - last < DAY_MS) return null;
  globalForRetention.qmaxRetentionLastRun = Date.now();
  return purgeExpiredData();
}

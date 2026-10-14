// Pure helpers for /crm/activities (no Prisma), shared by the server and tests

const TIME_ZONE = "America/Sao_Paulo";
const dayKey = (date: Date) => date.toLocaleDateString("en-CA", { timeZone: TIME_ZONE }); // YYYY-MM-DD

export type ActivityBucket = "overdue" | "today" | "upcoming" | "noDeadline";

/** Bucket of an open activity, by its deadline in Brazilian time. */
export function activityBucket(deadline: Date | null, now = new Date()): ActivityBucket {
  if (!deadline) return "noDeadline";
  if (deadline <= now) return "overdue";
  return dayKey(deadline) === dayKey(now) ? "today" : "upcoming";
}

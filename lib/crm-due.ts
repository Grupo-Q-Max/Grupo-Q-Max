// Due-date helpers for /crm/me and the due reminders (no Prisma), shared by the server and tests

const TIME_ZONE = "America/Sao_Paulo";

/** Day of `date` in Brazil as YYYY-MM-DD. */
export const todayKey = (date = new Date()) => date.toLocaleDateString("en-CA", { timeZone: TIME_ZONE });

/** "HH:MM" (00:00–23:59), the format of CrmCard.dueTime. */
export const isDueTime = (value: unknown): value is string => typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

/**
 * Instant a task is due: closeDate (DATE at UTC midnight) at dueTime in Brazilian time, or the end of
 * that day without a time. Brazil has no daylight saving time since 2019, so UTC-3 is fixed.
 */
export function dueAt(closeDate: Date | string, dueTime: string | null | undefined) {
  const day = new Date(closeDate).toISOString().slice(0, 10);
  return new Date(isDueTime(dueTime) ? `${day}T${dueTime}:00-03:00` : `${day}T23:59:59.999-03:00`);
}

export type DueState = "overdue" | "today" | "upcoming" | "none";

/**
 * Date-only values (closeDate, a DATE at UTC midnight) are due during that whole day;
 * timestamps (activity deadline) are overdue once passed and compared in Brazilian time.
 */
export function dueState(due: Date | null, dateOnly: boolean, now = new Date()): DueState {
  if (!due) return "none";
  const day = dateOnly ? due.toISOString().slice(0, 10) : todayKey(due);
  const today = todayKey(now);
  if (day < today || (!dateOnly && due <= now)) return "overdue";
  return day === today ? "today" : "upcoming";
}

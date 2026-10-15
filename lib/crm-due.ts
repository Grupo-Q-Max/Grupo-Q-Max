// Due-date helpers for /crm/me and the due reminders (no Prisma), shared by the server and tests

const TIME_ZONE = "America/Sao_Paulo";

/** Day of `date` in Brazil as YYYY-MM-DD. */
export const todayKey = (date = new Date()) => date.toLocaleDateString("en-CA", { timeZone: TIME_ZONE });

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

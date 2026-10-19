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

/**
 * Instant a reminder "N minutes before" counts from: the due time, or 09:00 of the deadline day (Brazilian
 * time) for a task without a time, so "1 dia antes" fires the morning before instead of near midnight.
 */
export function reminderBase(closeDate: Date | string, dueTime: string | null | undefined) {
  return isDueTime(dueTime) ? dueAt(closeDate, dueTime) : dueAt(closeDate, "09:00");
}

export type RecurrenceRule = { recurrence: string; interval?: number | null; weekdays?: number | null };

/**
 * Next date of a recurring task after `date` (a DATE at UTC midnight): every `interval` days, weeks, months or
 * years. WEEKLY with `weekdays` (bitmask, 1 = Sunday … 64 = Saturday) goes to the next marked weekday, jumping
 * `interval - 1` extra weeks when it wraps into the next week. Null when the rule doesn't repeat.
 */
export function nextOccurrence(date: Date, { recurrence, interval, weekdays }: RecurrenceRule) {
  const n = Math.max(1, interval ?? 1);
  const next = new Date(date);
  if (recurrence === "DAILY") next.setUTCDate(next.getUTCDate() + n);
  else if (recurrence === "MONTHLY") next.setUTCMonth(next.getUTCMonth() + n);
  else if (recurrence === "YEARLY") next.setUTCMonth(next.getUTCMonth() + 12 * n);
  else if (recurrence === "WEEKLY" && weekdays && weekdays & 127) {
    for (let i = 1; i <= 7; i++) {
      const day = new Date(date);
      day.setUTCDate(day.getUTCDate() + i);
      if (!(weekdays & (1 << day.getUTCDay()))) continue;
      // Wrapped past Saturday into a new week: skip the weeks in between
      if (day.getUTCDay() <= date.getUTCDay()) day.setUTCDate(day.getUTCDate() + 7 * (n - 1));
      return day;
    }
  } else if (recurrence === "WEEKLY") next.setUTCDate(next.getUTCDate() + 7 * n);
  else return null;
  return next;
}

const WEEKDAY_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** "seg, qua, sex" for a weekdays bitmask (1 = Sunday … 64 = Saturday); null when empty. */
export const weekdayNames = (mask: number | null | undefined) => WEEKDAY_SHORT.filter((_, day) => (mask ?? 0) & (1 << day)).join(", ") || null;

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

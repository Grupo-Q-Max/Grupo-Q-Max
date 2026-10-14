// Monthly sales goals (CrmGoal). Month keys are "YYYY-MM"; the DB keeps the first day of the month.

export const isMonthKey = (value: unknown): value is string => typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

/** "YYYY-MM" → first day of that month at 00:00 UTC (a @db.Date column). */
export const monthStart = (key: string) => new Date(`${key}-01T00:00:00Z`);

/** "YYYY-MM" of a local date. */
export const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

/** Money typed by a pt-BR user: "1.234,50", "1234,5", "5.000" (thousands) or "1234.50". Invalid → NaN. */
export function parseAmount(input: string) {
  const text = input.replace(/[R$\s]/g, "");
  if (!text) return 0;
  if (text.includes(",")) return Number(text.replace(/\./g, "").replace(",", "."));
  if (/^\d{1,3}(\.\d{3})+$/.test(text)) return Number(text.replace(/\./g, ""));
  return Number(text);
}

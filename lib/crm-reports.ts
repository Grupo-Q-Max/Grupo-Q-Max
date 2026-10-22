/**
 * Pure aggregation for the reports page (/crm/reports). Dates are local time;
 * every range is [from, to) with `to` exclusive. Won/lost deals count by
 * `closedAt`, created deals by `createdAt`.
 */

export type ReportDeal = {
  id: string;
  number: number;
  title: string;
  value: number;
  status: "OPEN" | "WON" | "LOST";
  closedAt: string | null;
  lostReason: string | null;
  createdAt: string;
  source: string | null;
  dealType: string | null;
  responsibleId: string | null;
  pipelineId: string;
  stageId: string;
};

/** `months` is set for calendar periods, so the comparison shifts by whole months (Oct 1–5 vs Sep 1–5). */
export type Range = { from: Date; to: Date; months?: number };
export type Preset = "month" | "lastMonth" | "quarter" | "year" | "30d" | "90d" | "custom";
export type CompareMode = "previous" | "lastYear" | "none";
export type Granularity = "day" | "week" | "month";

const DAY = 86_400_000;
const day = (y: number, m: number, d: number) => new Date(y, m, d);
const startOfDay = (date: Date) => day(date.getFullYear(), date.getMonth(), date.getDate());
const addDays = (date: Date, n: number) => day(date.getFullYear(), date.getMonth(), date.getDate() + n);

/** Adds months; a day past the end of the target month becomes the first of the next one. */
function addMonths(date: Date, n: number) {
  const shifted = day(date.getFullYear(), date.getMonth() + n, 1);
  const last = day(shifted.getFullYear(), shifted.getMonth() + 1, 0).getDate();
  return date.getDate() > last
    ? day(shifted.getFullYear(), shifted.getMonth() + 1, 1)
    : day(shifted.getFullYear(), shifted.getMonth(), date.getDate());
}

/** "YYYY-MM-DD" (from <input type="date">) → local midnight */
export const parseDay = (value: string) => {
  const [y, m, d] = value.split("-").map(Number);
  return day(y, m - 1, d);
};

/** Current-to-date periods end tomorrow at 00:00, so today is included. */
export function periodRange(preset: Preset, now = new Date(), from = "", to = ""): Range {
  const tomorrow = addDays(startOfDay(now), 1);
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (preset) {
    case "month":
      return { from: day(y, m, 1), to: tomorrow, months: 1 };
    case "lastMonth":
      return { from: day(y, m - 1, 1), to: day(y, m, 1), months: 1 };
    case "quarter":
      return { from: day(y, m - (m % 3), 1), to: tomorrow, months: 3 };
    case "year":
      return { from: day(y, 0, 1), to: tomorrow, months: 12 };
    case "30d":
      return { from: addDays(tomorrow, -30), to: tomorrow };
    case "90d":
      return { from: addDays(tomorrow, -90), to: tomorrow };
    case "custom": {
      const start = from ? parseDay(from) : day(y, m, 1);
      const end = to ? addDays(parseDay(to), 1) : tomorrow;
      return end > start ? { from: start, to: end } : { from: start, to: addDays(start, 1) };
    }
  }
}

export function compareRange(range: Range, mode: CompareMode): Range | null {
  if (mode === "none") return null;
  if (mode === "lastYear") return { from: addMonths(range.from, -12), to: addMonths(range.to, -12), months: range.months };
  if (range.months) return { from: addMonths(range.from, -range.months), to: addMonths(range.to, -range.months), months: range.months };
  const length = range.to.getTime() - range.from.getTime();
  return { from: new Date(range.from.getTime() - length), to: range.from };
}

const inRange = (iso: string | null, r: Range) => {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= r.from.getTime() && t < r.to.getTime();
};
export const isWon = (d: ReportDeal, r: Range) => d.status === "WON" && inRange(d.closedAt, r);
export const isLost = (d: ReportDeal, r: Range) => d.status === "LOST" && inRange(d.closedAt, r);
export const isCreated = (d: ReportDeal, r: Range) => inRange(d.createdAt, r);

export type Totals = { won: number; lost: number; wonValue: number; lostValue: number };
const emptyTotals = (): Totals => ({ won: 0, lost: 0, wonValue: 0, lostValue: 0 });

function add(t: Totals, d: ReportDeal, r: Range) {
  if (isWon(d, r)) {
    t.won++;
    t.wonValue += d.value;
  } else if (isLost(d, r)) {
    t.lost++;
    t.lostValue += d.value;
  }
  return t;
}

export type Summary = Totals & { created: number; conversion: number | null; avgTicket: number | null };

export function summarize(deals: ReportDeal[], r: Range): Summary {
  const t = deals.reduce((acc, d) => add(acc, d, r), emptyTotals());
  return {
    ...t,
    created: deals.filter((d) => isCreated(d, r)).length,
    conversion: rate(t),
    avgTicket: t.won ? t.wonValue / t.won : null,
  };
}

/** Won share of the closed deals; null with nothing closed */
export const rate = (t: Totals) => (t.won + t.lost ? t.won / (t.won + t.lost) : null);

/** Relative change; null when there is no base to compare with */
export const delta = (current: number | null, previous: number | null) =>
  current === null || previous === null || previous === 0 ? null : (current - previous) / Math.abs(previous);

export function granularityFor(r: Range): Granularity {
  const days = Math.round((r.to.getTime() - r.from.getTime()) / DAY);
  return days <= 31 ? "day" : days <= 120 ? "week" : "month";
}

const fmtDay = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
const fmtMonth = (d: Date) => d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(". de ", "/").replace(".", "");

/** Consecutive slices of the range; weeks start at `from`, months at the 1st. */
export function buckets(r: Range, g: Granularity): Range[] {
  const out: Range[] = [];
  let start = g === "month" ? day(r.from.getFullYear(), r.from.getMonth(), 1) : r.from;
  while (start < r.to) {
    const next = g === "day" ? addDays(start, 1) : g === "week" ? addDays(start, 7) : addMonths(start, 1);
    out.push({ from: start < r.from ? r.from : start, to: next > r.to ? r.to : next });
    start = next;
  }
  return out;
}

export const bucketLabel = (b: Range, g: Granularity) => (g === "month" ? fmtMonth(b.from) : fmtDay(b.from));

export type SeriesPoint = Totals & { label: string };

export function series(deals: ReportDeal[], r: Range, g: Granularity): SeriesPoint[] {
  const closed = deals.filter((d) => d.status !== "OPEN" && inRange(d.closedAt, r));
  return buckets(r, g).map((b) => ({ label: bucketLabel(b, g), ...closed.reduce((acc, d) => add(acc, d, b), emptyTotals()) }));
}

/** Totals per key (responsible, source, pipeline...), largest won value first. */
export function breakdown(deals: ReportDeal[], r: Range, keyOf: (d: ReportDeal) => string) {
  const map = new Map<string, Totals>();
  for (const d of deals) {
    if (!isWon(d, r) && !isLost(d, r)) continue;
    const key = keyOf(d);
    add(map.get(key) ?? map.set(key, emptyTotals()).get(key)!, d, r);
  }
  return [...map].map(([key, t]) => ({ key, ...t })).sort((a, b) => b.wonValue - a.wonValue || b.won - a.won);
}

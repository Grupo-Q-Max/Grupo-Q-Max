// Reports aggregation: periods, comparison ranges, totals and buckets. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { periodRange, compareRange, summarize, series, breakdown, delta, granularityFor } from "../lib/crm-reports.ts";

const d = (y, m, day) => new Date(y, m - 1, day);
const now = new Date(2026, 9, 5, 15, 30); // 2026-10-05 15:30

test("current-to-date periods include today and compare with the same days before", () => {
  const month = periodRange("month", now);
  assert.deepEqual([month.from, month.to], [d(2026, 10, 1), d(2026, 10, 6)]);
  const prev = compareRange(month, "previous");
  assert.deepEqual([prev.from, prev.to], [d(2026, 9, 1), d(2026, 9, 6)]);
  const lastYear = compareRange(periodRange("year", now), "lastYear");
  assert.deepEqual([lastYear.from, lastYear.to], [d(2025, 1, 1), d(2025, 10, 6)]);
  const quarter = periodRange("quarter", now);
  assert.deepEqual(quarter.from, d(2026, 10, 1));
  assert.equal(compareRange(month, "none"), null);
});

test("month shift clamps past the end of a shorter month", () => {
  const range = periodRange("month", new Date(2026, 2, 30)); // Mar 1 – Mar 31
  const prev = compareRange(range, "previous");
  assert.deepEqual([prev.from, prev.to], [d(2026, 2, 1), d(2026, 3, 1)]);
});

test("rolling and custom periods compare with the same length right before", () => {
  const custom = periodRange("custom", now, "2026-09-10", "2026-09-19");
  assert.deepEqual([custom.from, custom.to], [d(2026, 9, 10), d(2026, 9, 20)]);
  const prev = compareRange(custom, "previous");
  assert.deepEqual([prev.from, prev.to], [d(2026, 8, 31), d(2026, 9, 10)]);
  assert.equal(granularityFor(custom), "day");
  assert.equal(granularityFor(periodRange("90d", now)), "week");
  assert.equal(granularityFor(periodRange("year", now)), "month");
});

const deal = (status, closed, value, extra = {}) => ({
  id: Math.random().toString(),
  number: 1,
  title: "x",
  value,
  status,
  closedAt: closed && closed.toISOString(),
  createdAt: d(2026, 9, 1).toISOString(),
  source: null,
  dealType: null,
  responsibleId: null,
  pipelineId: "p",
  ...extra,
});

test("summarize counts won/lost by closedAt inside the range", () => {
  const deals = [
    deal("WON", d(2026, 10, 2), 100, { responsibleId: "a" }),
    deal("WON", d(2026, 10, 5), 300, { responsibleId: "b" }),
    deal("LOST", d(2026, 10, 3), 50, { responsibleId: "a" }),
    deal("WON", d(2026, 9, 30), 999), // previous month
    deal("OPEN", null, 10),
  ];
  const s = summarize(deals, periodRange("month", now));
  assert.equal(s.won, 2);
  assert.equal(s.lost, 1);
  assert.equal(s.wonValue, 400);
  assert.equal(s.lostValue, 50);
  assert.equal(s.avgTicket, 200);
  assert.equal(s.conversion, 2 / 3);
  assert.equal(s.created, 0);

  const points = series(deals, periodRange("month", now), "day");
  assert.equal(points.length, 5);
  assert.equal(points[1].wonValue, 100);
  assert.equal(points[2].lost, 1);

  const byResp = breakdown(deals, periodRange("month", now), (x) => x.responsibleId ?? "none");
  assert.deepEqual(byResp.map((r) => [r.key, r.won, r.lost]), [["b", 1, 0], ["a", 1, 1]]);
});

test("delta is null without a base", () => {
  assert.equal(delta(150, 100), 0.5);
  assert.equal(delta(5, 0), null);
  assert.equal(delta(null, 3), null);
});

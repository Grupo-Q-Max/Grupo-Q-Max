// /crm/me due states, in Brazilian time (UTC-3). Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { dueState } from "../lib/crm-due.ts";

const now = new Date("2026-10-14T15:00:00Z"); // 12:00 in São Paulo

test("dueState for activity deadlines (timestamps)", () => {
  assert.equal(dueState(null, false, now), "none");
  assert.equal(dueState(new Date("2026-10-14T14:59:00Z"), false, now), "overdue");
  assert.equal(dueState(new Date("2026-10-15T02:30:00Z"), false, now), "today"); // 23:30 local, still the 14th
  assert.equal(dueState(new Date("2026-10-15T03:30:00Z"), false, now), "upcoming"); // 00:30 local on the 15th
});

test("dueState for closeDate (DATE at UTC midnight)", () => {
  assert.equal(dueState(new Date("2026-10-13T00:00:00Z"), true, now), "overdue");
  assert.equal(dueState(new Date("2026-10-14T00:00:00Z"), true, now), "today");
  assert.equal(dueState(new Date("2026-10-15T00:00:00Z"), true, now), "upcoming");
  // 22:00 local on the 14th is already the 15th in UTC: the Brazilian day still decides
  assert.equal(dueState(new Date("2026-10-14T00:00:00Z"), true, new Date("2026-10-15T01:00:00Z")), "today");
});

test("dueAt: closeDate at dueTime in Brazilian time, else the end of that day", async () => {
  const { dueAt, isDueTime } = await import("../lib/crm-due.ts");
  const day = new Date("2026-10-14T00:00:00Z");
  assert.equal(dueAt(day, "14:30").toISOString(), "2026-10-14T17:30:00.000Z");
  assert.equal(dueAt(day, "23:00").toISOString(), "2026-10-15T02:00:00.000Z"); // next day in UTC, same Brazilian day
  assert.equal(dueAt(day, null).toISOString(), "2026-10-15T02:59:59.999Z");
  assert.equal(dueAt("2026-10-14T00:00:00.000Z", "bad").toISOString(), "2026-10-15T02:59:59.999Z");
  assert.ok(isDueTime("00:00") && isDueTime("23:59"));
  assert.ok(!isDueTime("24:00") && !isDueTime("9:00") && !isDueTime(null));
});

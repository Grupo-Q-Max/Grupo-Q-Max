// Monthly goals: month keys and money typed in pt-BR. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { isMonthKey, monthStart, parseAmount } from "../lib/crm-goals.ts";

test("parseAmount reads pt-BR and plain numbers", () => {
  assert.equal(parseAmount("1.234,50"), 1234.5);
  assert.equal(parseAmount("R$ 5.000"), 5000);
  assert.equal(parseAmount("1234.5"), 1234.5);
  assert.equal(parseAmount("80000"), 80000);
  assert.equal(parseAmount(""), 0);
  assert.ok(Number.isNaN(parseAmount("abc")));
});

test("month keys", () => {
  assert.equal(isMonthKey("2026-10"), true);
  assert.equal(isMonthKey("2026-13"), false);
  assert.equal(monthStart("2026-10").toISOString(), "2026-10-01T00:00:00.000Z");
});

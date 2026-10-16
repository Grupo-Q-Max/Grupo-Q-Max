// Estimate / time spent of task cards, typed as "1h30" and shown the same way. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";

const { formatMinutes, parseMinutes } = await import("../components/crm/deal/types.ts");

test("parseMinutes reads the usual ways of typing a duration", () => {
  assert.equal(parseMinutes("1h30"), 90);
  assert.equal(parseMinutes("1h 30min"), 90);
  assert.equal(parseMinutes("1:05"), 65);
  assert.equal(parseMinutes("1,5h"), 90);
  assert.equal(parseMinutes("2h"), 120);
  assert.equal(parseMinutes("90"), 90);
  assert.equal(parseMinutes("45min"), 45);
  assert.equal(parseMinutes(""), null);
  assert.equal(parseMinutes("abc"), null);
});

test("formatMinutes round-trips through parseMinutes", () => {
  assert.equal(formatMinutes(90), "1h30");
  assert.equal(formatMinutes(45), "45min");
  assert.equal(formatMinutes(120), "2h");
  assert.equal(formatMinutes(null), null);
  for (const minutes of [5, 60, 95, 600]) assert.equal(parseMinutes(formatMinutes(minutes)), minutes);
});

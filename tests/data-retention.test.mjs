// LGPD retention cut-off dates (lib/retention-cutoff.ts). Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";

const { retentionCutoff } = await import("../lib/retention-cutoff.ts");

test("cut-off is the same day N calendar months earlier", () => {
  assert.equal(retentionCutoff(new Date("2026-11-17T10:00:00Z"), 24).toISOString(), "2024-11-17T10:00:00.000Z");
  assert.equal(retentionCutoff(new Date("2026-11-17T10:00:00Z"), 6).toISOString(), "2026-05-17T10:00:00.000Z");
});

test("short months clamp to their last day", () => {
  assert.equal(retentionCutoff(new Date("2026-08-31T00:00:00Z"), 6).toISOString(), "2026-02-28T00:00:00.000Z");
  assert.equal(retentionCutoff(new Date("2028-08-31T00:00:00Z"), 6).toISOString(), "2028-02-29T00:00:00.000Z");
});

test("crosses year boundaries", () => {
  assert.equal(retentionCutoff(new Date("2027-01-15T00:00:00Z"), 6).toISOString(), "2026-07-15T00:00:00.000Z");
});

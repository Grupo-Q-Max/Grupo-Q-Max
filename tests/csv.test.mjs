// CSV export for Excel pt-BR. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { toCsv, csvMoney } from "../lib/csv.ts";

test("toCsv quotes every cell, escapes quotes and keeps ; and line breaks inside cells", () => {
  assert.equal(toCsv([["a", 1, null], ['diz "oi"', "x;y", "l1\nl2"]]), '"a";"1";""\r\n"diz ""oi""";"x;y";"l1\nl2"');
});

test("csvMoney uses a decimal comma", () => {
  assert.equal(csvMoney(1234.5), "1234,50");
});

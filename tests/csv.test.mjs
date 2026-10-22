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

test("parseCsv reads Excel ; files with BOM, quotes, escapes and line breaks; and plain , files", async () => {
  const { parseCsv } = await import("../lib/csv.ts");
  assert.deepEqual(parseCsv('\uFEFF"Nome";"E-mail"\r\n"Ana ""A""";"a@x.com"\r\n\r\n"l1\nl2";b\r\n'), [
    ["Nome", "E-mail"],
    ['Ana "A"', "a@x.com"],
    ["l1\nl2", "b"],
  ]);
  assert.deepEqual(parseCsv("nome,email\nBia,b@x.com"), [["nome", "email"], ["Bia", "b@x.com"]]);
  assert.deepEqual(parseCsv(toCsv([["a;b", 'x"y']])), [["a;b", 'x"y']]);
});

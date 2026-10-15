// @mentions in card comments. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { findMentions } from "../lib/crm-mentions.ts";

const members = [
  { id: "ana", name: "Ana" },
  { id: "anapaula", name: "Ana Paula" },
  { id: "joao", name: "João Silva" },
];

test("finds full names, case-insensitive", () => {
  assert.deepEqual(findMentions("oi @joão silva, veja isso", members), ["joao"]);
});

test("a longer name doesn't also mention its prefix", () => {
  assert.deepEqual(findMentions("@Ana Paula pode revisar?", members), ["anapaula"]);
  assert.deepEqual(findMentions("@Ana Paula e @Ana", members).sort(), ["ana", "anapaula"]);
});

test("name must end at a word boundary", () => {
  assert.deepEqual(findMentions("@Anabela chegou", members), []);
  assert.deepEqual(findMentions("sem menção, só Ana", members), []);
});

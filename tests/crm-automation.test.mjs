// Automation rules: conditions, placeholders and flow walking (lib/crm-automation-shared.ts). Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fillPlaceholders,
  matchesConditions,
  nextAfter,
  firstStep,
  notifyMemberIds,
  parseConditions,
  parseFlowSteps,
  FLOW_LIMITS,
} from "../lib/crm-automation-shared.ts";

const cond = (field, operator, value = null) => ({ field, operator, value });

test("conditions compare text case-insensitively and numbers as numbers", () => {
  const ctx = { title: " Auditoria Fiscal ", value: "900", company: "" };
  assert.ok(matchesConditions([cond("title", "eq", "auditoria fiscal")], ctx));
  assert.ok(matchesConditions([cond("title", "contains", "FISCAL")], ctx));
  assert.ok(matchesConditions([cond("value", "gt", "1000")], ctx) === false, "900 > 1000 must be numeric, not text");
  assert.ok(matchesConditions([cond("value", "lt", "1000")], ctx));
  assert.ok(matchesConditions([cond("company", "empty")], ctx));
  assert.ok(matchesConditions([cond("missing", "empty")], ctx));
  assert.ok(!matchesConditions([cond("company", "notEmpty")], ctx));
  assert.ok(!matchesConditions([cond("company", "gt", "a")], ctx), "empty value is never greater");
});

test("every condition must match; no conditions always matches", () => {
  const ctx = { status: "OPEN", stage: "Novos Leads" };
  assert.ok(matchesConditions([], ctx));
  assert.ok(matchesConditions([cond("status", "eq", "open"), cond("stage", "neq", "Ganho")], ctx));
  assert.ok(!matchesConditions([cond("status", "eq", "open"), cond("stage", "eq", "Ganho")], ctx));
});

test("parseConditions drops invalid rows and the value of value-less operators", () => {
  const parsed = parseConditions([
    { field: "title", operator: "eq", value: 5 },
    { field: "title", operator: "empty", value: "x" },
    { field: "", operator: "eq", value: "x" },
    { field: "title", operator: "nope", value: "x" },
    null,
  ]);
  assert.deepEqual(parsed, [cond("title", "eq", "5"), cond("title", "empty")]);
  assert.deepEqual(parseConditions("x"), []);
});

test("placeholders read deal and webhook response values, encoded on request", () => {
  const ctx = { title: "A&B", "response.data.id": "42" };
  assert.equal(fillPlaceholders("{{deal.title}} #{{ response.data.id }} {{deal.none}}", ctx), "A&B #42 ");
  assert.equal(fillPlaceholders("q={{deal.title}}", ctx, true), "q=A%26B");
  assert.equal(fillPlaceholders("{{other.title}}", ctx), "{{other.title}}");
});

test("notify members merge the table rows with the legacy JSON column", () => {
  assert.deepEqual(
    notifyMemberIds({ members: [{ memberId: "a" }], memberIds: ["b", 3, "a"] }).sort(),
    ["a", "b"]
  );
  assert.deepEqual(notifyMemberIds(null), []);
});

test("parseFlowSteps validates actions, nesting and size", () => {
  assert.equal(parseFlowSteps([]).error, "Adicione ao menos um passo");
  assert.equal(parseFlowSteps([{ type: "ACTION", action: {} }]).error, "Escolha a ação de cada passo");

  const ok = parseFlowSteps([{ type: "WAIT", waitAmount: "0", waitUnit: "weird" }]);
  assert.equal(ok.error, null);
  assert.equal(ok.steps[0].waitAmount, 1);
  assert.equal(ok.steps[0].waitUnit, "MINUTES");

  let nested = { type: "WAIT" };
  for (let i = 0; i <= FLOW_LIMITS.maxDepth; i++) nested = { type: "CONDITION", conditions: [], then: [nested] };
  assert.match(parseFlowSteps([nested]).error, /condições aninhadas/);

  const many = Array.from({ length: FLOW_LIMITS.maxSteps + 1 }, () => ({ type: "WAIT" }));
  assert.match(parseFlowSteps(many).error, /passos por fluxo/);
});

test("flow walks into branches and back out to the step after the condition", () => {
  // 1 → IF(2: then [3, 4], else [5]) → 6
  const steps = [
    { id: "6", parentId: null, branch: null, order: 2 },
    { id: "1", parentId: null, branch: null, order: 0 },
    { id: "2", parentId: null, branch: null, order: 1 },
    { id: "4", parentId: "2", branch: "THEN", order: 1 },
    { id: "3", parentId: "2", branch: "THEN", order: 0 },
    { id: "5", parentId: "2", branch: "ELSE", order: 0 },
  ];
  const byId = (id) => steps.find((s) => s.id === id);
  assert.equal(firstStep(steps).id, "1");
  assert.equal(nextAfter(steps, byId("1")).id, "2");
  assert.equal(firstStep(steps, "2", "THEN").id, "3");
  assert.equal(nextAfter(steps, byId("3")).id, "4");
  assert.equal(nextAfter(steps, byId("4")).id, "6");
  assert.equal(nextAfter(steps, byId("5")).id, "6");
  assert.equal(nextAfter(steps, byId("6")), null);
});

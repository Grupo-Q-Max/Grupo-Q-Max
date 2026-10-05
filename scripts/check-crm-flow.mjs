// Self-check of the flow helpers in lib/crm-automation-shared.ts.
// Run: node scripts/check-crm-flow.mjs   (Node 23.6+ strips the TypeScript types)
import assert from "node:assert/strict";
import { FLOW_LIMITS, firstStep, nextAfter, parseFlowSteps } from "../lib/crm-automation-shared.ts";

// a → if(b){ c, d } else { } → e
const steps = [
  { id: "a", parentId: null, branch: null, order: 0 },
  { id: "b", parentId: null, branch: null, order: 1 },
  { id: "d", parentId: "b", branch: "THEN", order: 1 },
  { id: "c", parentId: "b", branch: "THEN", order: 0 },
  { id: "e", parentId: null, branch: null, order: 2 },
];
const byId = (id) => steps.find((s) => s.id === id);

assert.equal(firstStep(steps).id, "a");
assert.equal(nextAfter(steps, byId("a")).id, "b");
assert.equal(firstStep(steps, "b", "THEN").id, "c");
assert.equal(firstStep(steps, "b", "ELSE"), null, "empty branch");
assert.equal(nextAfter(steps, byId("c")).id, "d");
assert.equal(nextAfter(steps, byId("d")).id, "e", "end of a branch goes on after its condition");
assert.equal(nextAfter(steps, byId("e")), null);

const wait = { type: "WAIT", waitAmount: 1, waitUnit: "MINUTES" };
assert.equal(parseFlowSteps([wait]).error, null);
assert.ok(parseFlowSteps([]).error, "needs a step");
assert.ok(parseFlowSteps([{ type: "ACTION", action: { actionType: "FLOW" } }]).error, "no flow inside a flow");

const nested = (depth) => (depth === 0 ? [wait] : [{ type: "CONDITION", conditions: [], then: nested(depth - 1), else: [] }]);
assert.equal(parseFlowSteps(nested(FLOW_LIMITS.maxDepth)).error, null);
assert.ok(parseFlowSteps(nested(FLOW_LIMITS.maxDepth + 1)).error, "depth limit");
assert.ok(parseFlowSteps(Array.from({ length: FLOW_LIMITS.maxSteps + 1 }, () => wait)).error, "step limit");

console.log("crm flow helpers ok");

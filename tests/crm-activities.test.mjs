// /crm/activities buckets, by deadline in Brazilian time (UTC-3). Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { activityBucket } from "../lib/crm-activities-shared.ts";

const now = new Date("2026-10-14T15:00:00Z"); // 12:00 in São Paulo

test("activityBucket splits overdue, today, upcoming and no deadline", () => {
  assert.equal(activityBucket(null, now), "noDeadline");
  assert.equal(activityBucket(new Date("2026-10-14T14:59:00Z"), now), "overdue");
  assert.equal(activityBucket(now, now), "overdue");
  assert.equal(activityBucket(new Date("2026-10-15T02:30:00Z"), now), "today"); // 23:30 local, still the 14th
  assert.equal(activityBucket(new Date("2026-10-15T03:30:00Z"), now), "upcoming"); // 00:30 local on the 15th
});

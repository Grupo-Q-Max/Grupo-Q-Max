// clientIp: last X-Forwarded-For entry (the one Azure App Service appends), without the port. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { clientIp } from "../lib/rate-limit.ts";

const ip = (xff) => clientIp(new Request("http://x", { headers: xff === undefined ? {} : { "x-forwarded-for": xff } }));

test("clientIp keeps the trusted last entry and drops the port of IPv4 and IPv6", () => {
  assert.equal(ip("1.2.3.4:5678"), "1.2.3.4");
  assert.equal(ip("9.9.9.9, 1.2.3.4:5678"), "1.2.3.4");
  assert.equal(ip("[2001:db8::1]:443"), "2001:db8::1");
  assert.equal(ip("::1"), "::1");
  assert.equal(ip("2001:db8::1"), "2001:db8::1");
  assert.equal(ip(undefined), "local");
});

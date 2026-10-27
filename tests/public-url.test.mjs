// Webhook SSRF guard: internal ranges are refused, public addresses pass. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { isInternalAddress, isPublicUrl } from "../lib/public-url.ts";

test("isInternalAddress flags loopback, private, link-local and mapped addresses", () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.0.10", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "::", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "not-an-ip"]) {
    assert.equal(isInternalAddress(ip), true, ip);
  }
  for (const ip of ["8.8.8.8", "172.32.0.1", "2001:4860:4860::8888"]) {
    assert.equal(isInternalAddress(ip), false, ip);
  }
});

test("isPublicUrl refuses internal hosts and bad URLs without network access", async () => {
  assert.equal(await isPublicUrl("http://127.0.0.1:3000/x"), false);
  assert.equal(await isPublicUrl("http://localhost/x"), false);
  assert.equal(await isPublicUrl("http://169.254.169.254/metadata"), false);
  assert.equal(await isPublicUrl("http://[::1]/x"), false);
  assert.equal(await isPublicUrl("not a url"), false);
  assert.equal(await isPublicUrl("https://8.8.8.8/x"), true);
});

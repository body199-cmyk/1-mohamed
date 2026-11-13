/**
 * No-cloud negative control for final release switch.
 * Starts against a Next server with APP_ENABLE_REAL_DATA=true but NO
 * NEXT_PUBLIC_SUPABASE_* configuration. The site must stay fail-closed.
 * This does NOT replace live Auth, RLS, email recovery or device tests.
 */
import assert from "node:assert/strict";
import { setTimeout as sleep } from "node:timers/promises";

const base = new URL(process.argv[2] ?? "http://127.0.0.1:39124");
const request = (path, options) => fetch(new URL(path, base), { redirect: "manual", ...options });
let ready = false;
for (let i = 0; i < 45; i++) {
  try {
    const res = await request("/login");
    if (res.status === 200) { ready = true; break; }
  } catch { /* server starting */ }
  await sleep(1000);
}
assert.ok(ready, "Next.js login did not start in time");
assert.equal((await request("/favicon.svg")).status, 200);
const root = await request("/");
assert.equal(root.status, 307);
assert.equal(new URL(root.headers.get("location"), base).pathname, "/login");
for (const path of ["/demo/trips", "/demo/home", "/app",
  "/api/ledger/master?type=contractors", "/auth/reset", "/api/ledger/read"]) {
  const response = await request(path);
  assert.equal(response.status, 503, `Unexpected exposure of ${path}`);
  assert.equal(response.headers.get("cache-control"), "no-store");
}
for (const path of ["/api/ledger/operations", "/api/ledger/read", "/demo/trips"]) {
  const response = await request(path, { method: "POST", body: "{}" });
  assert.equal(response.status, 503, `Unexpected POST access to ${path}`);
}
console.log("AUTH CUTOVER NEGATIVE PASS: enabled flag alone never exposes demo, data, or writes.");

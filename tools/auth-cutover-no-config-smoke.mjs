/**
 * Fail-closed cutover smoke WITHOUT a Supabase project:
 * enabling the server flag alone must hide demo and block every private route.
 */
import assert from "node:assert/strict";
import { setTimeout as sleep } from "node:timers/promises";

const base = new URL(process.argv[2] ?? "http://127.0.0.1:39124");
const get = async path => fetch(new URL(path, base), { redirect: "manual" });

let ready = false;
for (let attempt = 0; attempt < 45; attempt++) {
  try { if ((await get("/login")).status === 200) { ready = true; break; } } catch {}
  await sleep(1000);
}
assert.ok(ready, "Cutover login page did not start");

for (const path of ["/demo", "/demo/home", "/demo/trips", "/"]) {
  const response = await get(path);
  assert.equal(response.status, 307, path);
  assert.equal(new URL(response.headers.get("location"), base).pathname, "/login", path);
  assert.equal(response.headers.get("cache-control"), "no-store", path);
}
for (const path of ["/app", "/api/ledger/master?type=contractors"]) {
  const response = await get(path);
  assert.equal(response.status, 503, path);
  assert.equal(response.headers.get("cache-control"), "no-store", path);
}
for (const path of ["/api/ledger/read", "/api/ledger/operations"]) {
  const response = await fetch(new URL(path, base), { method: "POST",
    headers: { "content-type": "application/json" }, body: "{}",
    redirect: "manual" });
  assert.equal(response.status, 503, path);
}
for (const path of ["/future-secret", "/api/admin"]) {
  const response = await get(path);
  assert.equal(response.status, 404, path);
}
assert.equal((await get("/auth/reset")).status, 200);
assert.equal((await get("/fonts/cairo.css")).status, 200);
console.log("PRE-LIVE PASS: cutover flag without Supabase hides demo, denies private data and defaults to 404.");

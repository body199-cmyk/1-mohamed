/**
 * AUTH-01 / H039 isolated HTTP smoke test.
 * No credentials, cloud project, or external network required. Run with:
 *   npm run build && npm run start --workspace=web -- --port 39123
 *   node tools/auth-boundary-smoke.mjs http://127.0.0.1:39123
 */
import assert from "node:assert/strict";
import { setTimeout as sleep } from "node:timers/promises";

const base = new URL(process.argv[2] ?? "http://127.0.0.1:39123");

async function request(path, options) {
  return fetch(new URL(path, base), {
    redirect: "manual",
    ...options,
  });
}

let serverReady = false;
for (let attempt = 0; attempt < 45; attempt += 1) {
  try {
    const res = await request("/demo/trips");
    if (res.status === 200) {
      serverReady = true;
      break;
    }
  } catch {
    // The Next.js process may still be initializing.
  }
  await sleep(1000);
}
assert.ok(serverReady, "Next.js demo did not become available in time");

for (const path of ["/demo/trips", "/demo/contractors", "/login"]) {
  const res = await request(path);
  assert.equal(res.status, 200, `Expected 200 for public ${path}`);
}
const loginHtml = await (await request("/login")).text();
assert.match(loginHtml, /تسجيل الدخول غير متاح حاليًا/);
assert.doesNotMatch(loginHtml, /type=["']password["']/i);

for (const path of [
  "/trips",
  "/contractors/any-id",
  "/vehicles",
  "/payments",
  "/reports?from=2026-11-01",
  "/settings",
  "/backups",
  "/api/finance",
]) {
  const res = await request(path);
  assert.equal(res.status, 307, `Expected deny-all redirect for ${path}`);
  const location = res.headers.get("location");
  assert.ok(location, `Expected Location for ${path}`);
  const target = new URL(location, base);
  assert.equal(target.pathname, "/login", `Wrong redirect for ${path}`);
  assert.equal(
    target.searchParams.get("next"),
    path,
    `The safe, path-only next parameter was not preserved for ${path}`
  );
  assert.equal(res.headers.get("cache-control"), "no-store");
}

for (const path of ["/trips", "/payments", "/api/finance"]) {
  const res = await request(path, { method: "POST", body: "test" });
  assert.equal(res.status, 503, `Expected denied POST for ${path}`);
  assert.equal(res.headers.get("location"), null);
  assert.equal(res.headers.get("cache-control"), "no-store");
}

console.log("AUTH-01/H039 PASS: public demo/login, 8 protected GETs and 3 denied POSTs.");

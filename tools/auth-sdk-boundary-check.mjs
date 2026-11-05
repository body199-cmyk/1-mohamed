/**
 * H041 transitional safety check: proves the new SDK is installed but dormant.
 * This is a static guard, NOT a Supabase Auth or RLS integration test.
 * Replace/extend it only alongside real, tested owner-auth routing.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const read = (path) => readFileSync(path, "utf8");

const manifest = JSON.parse(read("apps/web/package.json"));
const lock = JSON.parse(read("package-lock.json"));

for (const [name, expected] of Object.entries({
  "@supabase/ssr": "0.12.7",
  "@supabase/supabase-js": "2.119.0",
})) {
  assert.equal(manifest.dependencies[name], expected, `${name} must stay pinned`);
  assert.equal(lock.packages["apps/web"].dependencies[name], expected);
  assert.equal(lock.packages[`node_modules/${name}`].version, expected);
}

const proxy = read("apps/web/src/proxy.ts");
assert.match(proxy, /matcher:\s*\[["']\/:path\*["']\]/);
assert.doesNotMatch(proxy, /@supabase|refreshSupabaseSession|verifyOwnerForAction/);
assert.match(proxy, /NextResponse\.json/);
assert.match(proxy, /status:\s*503/);
assert.match(proxy, /NextResponse\.redirect/);

const login = read("apps/web/src/app/login/page.tsx");
assert.doesNotMatch(login, /<form\b|type=["']password["']/i);
assert.match(login, /تسجيل الدخول غير متاح/);

function appSourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return appSourceFiles(path);
    return /\.(tsx?|jsx?)$/.test(entry.name) ? [path] : [];
  });
}

for (const path of appSourceFiles("apps/web/src/app")) {
  const file = read(path);
  assert.doesNotMatch(
    file,
    /@supabase\/|lib\/supabase\/(?:client|server|owner|proxy-session)/,
    `No live SDK import allowed in ${path} before real Auth testing`
  );
}

const browser = read("apps/web/src/lib/supabase/client.ts");
const server = read("apps/web/src/lib/supabase/server.ts");
const owner = read("apps/web/src/lib/supabase/owner.ts");
const session = read("apps/web/src/lib/supabase/proxy-session.ts");

assert.match(browser, /^"use client";/);
assert.match(browser, /createBrowserClient/);
assert.match(server, /import "server-only"/);
assert.match(server, /createServerClient/);
assert.match(owner, /getClaims\(/);
assert.match(owner, /rpc\("app_is_owner"\)/);
assert.match(session, /getClaims\(/);
assert.match(session, /request\.cookies\.set\(/);
assert.match(session, /response\.cookies\.set\(/);
assert.match(session, /cache-control/);

for (const source of [browser, server, owner, session]) {
  assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY/);
}

console.log(
  "AUTH-01/H041 PASS: pinned SDK, dormant server helpers, default-deny Proxy, demo-only routes."
);

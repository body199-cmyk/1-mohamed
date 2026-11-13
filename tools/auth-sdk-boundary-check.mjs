/**
 * Staged AUTH-01 boundary: SDK and owner-only routes are prepared, but must
 * remain unreachable behind the default-deny proxy until real Auth/RLS tests.
 * This is static evidence only, not a live authentication certification.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const read = path => readFileSync(path, "utf8");
const manifest = JSON.parse(read("apps/web/package.json"));
const lock = JSON.parse(read("package-lock.json"));
for (const [name, expected] of Object.entries({
  "@supabase/ssr": "0.12.7",
  "@supabase/supabase-js": "2.119.0",
})) {
  assert.equal(manifest.dependencies[name], expected);
  assert.equal(lock.packages["apps/web"].dependencies[name], expected);
  assert.equal(lock.packages[`node_modules/${name}`].version, expected);
}

const proxy = read("apps/web/src/proxy.ts");
assert.match(proxy, /matcher:\s*\[["']\/:path\*["']\]/);
assert.match(proxy, /APP_ENABLE_REAL_DATA/);
assert.match(proxy, /refreshSupabaseSession/);
assert.match(proxy, /session\.ownerAuthorized/);
assert.match(proxy, /pathname\.startsWith/);
assert.match(proxy, /jsonDenied\(404\)/);
assert.match(proxy, /NextResponse\.json/);
assert.match(proxy, /status:\s*503/);
assert.match(proxy, /NextResponse\.redirect/);

const login = read("apps/web/src/app/login/page.tsx");
const loginForm = read("apps/web/src/features/auth/login-form.tsx");
assert.match(login, /<LoginForm\s*\/>/);
assert.match(loginForm, /signInWithPassword/);
assert.match(loginForm, /app_is_owner/);
assert.match(loginForm, /resetPasswordForEmail/);
assert.match(loginForm, /!setup\.ready/);
assert.doesNotMatch(loginForm, /\.signUp\(/);

const shell = read("apps/web/src/components/site-shell.tsx");
assert.match(shell, /pathname\.startsWith\(["']\/demo\/["']\)/);
assert.match(shell, /DemoStoreProvider/);
assert.doesNotMatch(read("apps/web/src/app/layout.tsx"), /DemoStoreProvider/);

function appSourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return appSourceFiles(path);
    return /\.(tsx?|jsx?)$/.test(entry.name) ? [path] : [];
  });
}
const preparedServerRoutes = new Set([
  "apps/web/src/app/auth/callback/route.ts",
  "apps/web/src/app/api/ledger/operations/route.ts",
  "apps/web/src/app/api/ledger/read/route.ts",
  "apps/web/src/app/api/ledger/master/route.ts",
]);
for (const path of appSourceFiles("apps/web/src/app")) {
  const file = read(path);
  if (!preparedServerRoutes.has(path.replaceAll("\\", "/"))) {
    assert.doesNotMatch(file, /@supabase\/|lib\/supabase\/(?:client|server|owner|proxy-session)/,
      `Unreviewed Supabase import in ${path}`);
  } else {
    assert.match(file, /getSupabaseSetupStatus/);
    if (path.includes("/api/ledger/")) assert.match(file, /verifyOwnerForRoute/);
    assert.doesNotMatch(file, /SUPABASE_SERVICE_ROLE_KEY|sb_secret_/);
  }
}
const browser = read("apps/web/src/lib/supabase/client.ts");
const server = read("apps/web/src/lib/supabase/server.ts");
const owner = read("apps/web/src/lib/supabase/owner.ts");
const session = read("apps/web/src/lib/supabase/proxy-session.ts");
assert.match(browser, /^"use client";/);
assert.match(browser, /createBrowserClient/);
assert.match(server, /import "server-only"/);
assert.match(server, /createServerClient/);
assert.match(server, /response\.cookies\.set\(/);
assert.match(server, /response\.headers\.set\(/);
assert.match(server, /request\.cookies\.set\(/);
assert.match(owner, /getClaims\(/);
assert.match(owner, /rpc\("app_is_owner"\)/);
assert.match(session, /getClaims\(/);
assert.match(session, /request\.cookies\.set\(/);
assert.match(session, /response\.cookies\.set\(/);
assert.match(session, /cache-control/);
for (const source of [browser, server, owner, session, loginForm]) {
  assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY|sb_secret_/);
}
console.log("AUTH-01/PRE-LIVE PASS: pinned SDK, explicit disabled-by-default real-data flag and owner-gated Proxy.");

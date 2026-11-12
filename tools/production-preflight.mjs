#!/usr/bin/env node
/**
 * Release preflight for the REAL-DATA handoff.
 * No network calls, no secrets read or printed, no production mutation.
 * Static checks can BLOCK a release, but can never certify a release alone.
 *
 * node tools/production-preflight.mjs
 * node tools/production-preflight.mjs --json
 * node tools/production-preflight.mjs --strict
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

export function assessSource({ rootPage, loginPage, proxy, layout, siteShell = '', demoStore }) {
  const blockers = [];
  if (/redirect\s*\(\s*["']\/demo\//.test(rootPage)) {
    blockers.push("Root still redirects to /demo; no authenticated production home.");
  }
  if (/LoginNotConfiguredPage|تسجيل الدخول غير متاح حاليًا/.test(loginPage)) {
    blockers.push("Login is a placeholder; real owner sign-in is not active.");
  }
  if (/temporary FAIL-CLOSED boundary|return NextResponse\.json\([\s\S]*status:\s*503/.test(proxy)) {
    blockers.push("Proxy still denies writes; authenticated server-side mutations are not active.");
  }
  if (/DemoStoreProvider/.test(layout + siteShell) && /useState<Demo(?:Contractor|TripRecord|Payment)/.test(demoStore)) {
    blockers.push("App shell uses an in-memory DemoStore; no durable data source is proven.");
  }
  return blockers;
}

export function reportForSources(sources) {
  return {
    status: "BLOCKED",
    automatedBlockers: assessSource(sources),
    mandatoryLiveEvidence: [
      "Owner sign-in, sign-out, expired session and non-owner rejection against real Supabase Auth.",
      "Empty production database and first-run setup, including dated historical openings and transactions.",
      "Create/edit/cancel trips and payments, reload, and verify persistence from a second device.",
      "Real HTTP/RLS and two-session concurrent-write tests with money invariants intact.",
      "Report totals and all exports match persisted data, including historical date filters.",
      "Scheduled offsite backup, verified restore, and documented rollback.",
      "Android phone smoke test, final production deployment, owner acceptance and account handover."
    ],
    note: "A clean static scan is NOT a production release approval; live evidence is always required."
  };
}

function read(root, name) {
  return readFileSync(path.join(root, name), "utf8");
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const result = reportForSources({
    rootPage: read(root, "apps/web/src/app/page.tsx"),
    loginPage: read(root, "apps/web/src/app/login/page.tsx"),
    proxy: read(root, "apps/web/src/proxy.ts"),
    layout: read(root, "apps/web/src/app/layout.tsx"),
    siteShell: read(root, "apps/web/src/components/site-shell.tsx"),
    demoStore: read(root, "apps/web/src/demo/demo-context.tsx")
  });
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("REAL-DATA RELEASE: BLOCKED");
    for (const issue of result.automatedBlockers) console.log(" - " + issue);
    console.log(" - " + result.mandatoryLiveEvidence.length + " mandatory live acceptance gates remain.");
  }
  if (process.argv.includes("--strict")) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

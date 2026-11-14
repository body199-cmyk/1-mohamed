import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST as write } from "../src/app/api/ledger/operations/route";
import { POST as read } from "../src/app/api/ledger/read/route";

// The real Next runtime provides this import marker; no Auth/RPC is mocked.
vi.mock("server-only", () => ({}));
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "public-test-key");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://ledger.example.test");
});
afterEach(() => vi.unstubAllEnvs());

for (const [name, handler] of [["write", write], ["read", read]] as const) {
  it(`${name}: accepts the configured public origin behind an internal proxy`, async () => {
    const response = await handler(new NextRequest("http://localhost:3000/api/ledger/operations", {
      method: "POST", headers: { origin: "https://ledger.example.test", "sec-fetch-site": "same-origin" }, body: "{}",
    }));
    // Invalid input reaches validation, never Auth or a database mutation.
    expect(response.status).toBe(400);
  });
  it.each([
    ["https://attacker.test", "same-origin"],
    ["https://other.example.test", "same-site"],
    ["http://localhost:3000", "same-origin"],
    ["null", "same-origin"],
    ["https://ledger.example.test.attacker.test", "same-origin"],
    ["https://ledger.example.test", "cross-site"],
  ])(`${name}: rejects origin %s with fetch-site %s`, async (origin, fetchSite) => {
    const response = await handler(new NextRequest("http://localhost:3000/api/ledger/operations", {
      method: "POST", headers: { origin, "sec-fetch-site": fetchSite }, body: "{}",
    }));
    expect(response.status).toBe(403);
  });
  it(`${name}: rejects an invalid configured site instead of trusting the request host`, async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "invalid-site");
    const response = await handler(new NextRequest("http://localhost:3000/api/ledger/operations", {
      method: "POST", headers: { origin: "http://localhost:3000" }, body: "{}",
    }));
    expect(response.status).toBe(403);
  });
}

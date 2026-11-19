import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { PORTABLE_BACKUP_TABLES } from "../src/lib/backup/export";

const state = vi.hoisted(() => ({ rpc: vi.fn(), authorized: true, owner: true }));
vi.mock("server-only", () => ({}));
vi.mock("../src/lib/supabase/owner", () => ({
  verifyOwnerForRoute: async () => ({ authorized: state.authorized }),
}));
vi.mock("../src/lib/supabase/server", () => ({
  createRouteHandlerSupabaseClient: () => ({ rpc: state.rpc }),
}));
import { GET } from "../src/app/api/backup/export/route";

beforeEach(() => {
  vi.resetAllMocks();
  state.authorized = true;
  state.owner = true;
  state.rpc.mockImplementation(async name => {
    if (name === "app_is_owner") return { data: state.owner };
    throw new Error("Unexpected RPC " + name);
  });
  vi.stubEnv("APP_ENABLE_REAL_DATA", "true");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://fixture.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "fixture");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://fixture.test");
});
afterEach(() => vi.unstubAllEnvs());
const request = (search = "") => new NextRequest("https://fixture.test/api/backup/export" + search);

it("downloads all 12 tables from one JSON snapshot RPC with the existing format", async () => {
  state.rpc.mockResolvedValueOnce({ data: true }).mockResolvedValueOnce({
    data: Object.fromEntries(PORTABLE_BACKUP_TABLES.map(table => [table, []])),
  });
  const response = await GET(request());
  expect(response.status).toBe(200);
  expect(state.rpc.mock.calls).toEqual([["app_is_owner"], ["app_portable_backup_snapshot", { p_table: null }]]);
  expect(response.headers.get("content-disposition")).toContain("attachment");
  expect(await response.json()).toMatchObject({
    format_version: 1, tables_included: PORTABLE_BACKUP_TABLES, sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
  });
});

it("scopes CSV to a validated table", async () => {
  state.rpc.mockResolvedValueOnce({ data: true }).mockResolvedValueOnce({ data: { trips: [{ id: "T1" }] } });
  const response = await GET(request("?format=csv&table=trips"));
  expect(response.status).toBe(200);
  expect(state.rpc.mock.calls.at(-1)).toEqual(["app_portable_backup_snapshot", { p_table: "trips" }]);
  expect(response.headers.get("content-type")).toContain("text/csv");
  expect(await response.text()).toContain("T1");
});

it.each(["", "?format=csv&table=trips"])("returns 409 and no download on drift (%s)", async search => {
  state.rpc.mockResolvedValueOnce({ data: true }).mockResolvedValueOnce({ error: { code: "P2010" } });
  const response = await GET(request(search));
  expect(response.status).toBe(409);
  expect(response.headers.has("content-disposition")).toBe(false);
  expect(await response.json()).toMatchObject({ error: expect.stringContaining("تغيّرت البيانات") });
});

it("rejects a non-owner and unknown tables before reading snapshot data", async () => {
  state.owner = false;
  expect((await GET(request())).status).toBe(403);
  state.owner = true;
  expect((await GET(request("?format=csv&table=auth.users"))).status).toBe(400);
  expect(state.rpc.mock.calls).toEqual([["app_is_owner"], ["app_is_owner"]]);
});


it("streams a large verified JSON attachment without corrupting UTF-8 or the archive hash", async () => {
  const tables: Record<string, unknown[]> = Object.fromEntries(PORTABLE_BACKUP_TABLES.map(table => [table, []]));
  const notes = "ح".repeat(65536);
  tables.trips = Array.from({ length: 37 }, (_, index) => ({ id: "T" + index, notes }));
  state.rpc.mockResolvedValueOnce({ data: true }).mockResolvedValueOnce({ data: tables });

  const response = await GET(request());
  expect(response.status).toBe(200);
  expect(response.headers.get("content-length")).toBeNull();
  const chunks: Uint8Array[] = [];
  const reader = response.body!.getReader();
  for (let result = await reader.read(); !result.done; result = await reader.read()) {
    chunks.push(result.value);
  }
  expect(chunks.length).toBeGreaterThan(1);
  expect(Math.max(...chunks.map(chunk => chunk.byteLength))).toBeLessThanOrEqual(64 * 1024);

  const received = Buffer.concat(chunks);
  expect(received.length).toBeGreaterThan(4_500_000);
  const { sha256, ...archive } = JSON.parse(received.toString("utf8"));
  expect(archive.tables.trips).toEqual(tables.trips);
  expect(sha256).toBe(createHash("sha256").update(JSON.stringify(archive)).digest("hex"));
});

import { describe, expect, it } from "vitest";
import { classifyCutoverRoute } from "../src/lib/supabase/cutover-policy";

describe("PRE-LIVE owner-only cutover route policy", () => {
  it("only allows exact auth and static GET/HEAD routes", () => {
    for (const path of ["/login", "/auth/callback", "/auth/reset"]) {
      expect(classifyCutoverRoute(path, "GET")).toBe("public");
      expect(classifyCutoverRoute(path, "POST")).toBe("deny");
    }
    expect(classifyCutoverRoute("/_next/static/a.js", "GET")).toBe("asset");
    expect(classifyCutoverRoute("/fonts/cairo.css", "GET")).toBe("asset");
    expect(classifyCutoverRoute("/favicon.svg", "HEAD")).toBe("asset");
    expect(classifyCutoverRoute("/", "GET")).toBe("root");
  });
  it("hides public demo and requires owner for every private route", () => {
    expect(classifyCutoverRoute("/demo/home", "GET")).toBe("demo");
    expect(classifyCutoverRoute("/demo", "GET")).toBe("demo");
    expect(classifyCutoverRoute("/app", "GET")).toBe("protected");
    expect(classifyCutoverRoute("/api/ledger/master", "GET")).toBe("protected");
    expect(classifyCutoverRoute("/api/ledger/read", "POST")).toBe("protected");
    expect(classifyCutoverRoute("/api/ledger/operations", "POST")).toBe("protected");
  });
  it("denies unexpected methods, future paths and mutations to public pages", () => {
    for (const [path, method] of [
      ["/api/ledger/operations", "GET"], ["/api/ledger/read", "GET"],
      ["/api/ledger/master", "POST"], ["/app", "POST"],
      ["/demo/home", "POST"], ["/favicon.svg", "POST"],
      ["/settings", "GET"], ["/future-confidential", "GET"],
      ["/api/admin", "GET"], ["/auth/callback/anything", "GET"]
    ]) {
      expect(classifyCutoverRoute(path, method)).toBe("deny");
    }
  });
});

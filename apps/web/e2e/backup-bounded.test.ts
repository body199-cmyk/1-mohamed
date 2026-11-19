import { describe, expect, it } from "vitest";
import { readBoundedPortableResponse } from "../src/lib/backup/read-bounded";

const json = (text: string) => new Response(text, {
  status: 200, headers: { "content-type": "application/json; charset=utf-8" },
});

describe("bounded owner-export read used for safe snapshot comparison", () => {
  it("reads valid JSON bytes without caching or changing them", async () => {
    expect(await readBoundedPortableResponse(json('{"hello":"أحمد"}'))).toBe('{"hello":"أحمد"}');
  });
  it("rejects unauthorized and other non-success responses", async () => {
    await expect(readBoundedPortableResponse(new Response('{"error":"forbidden"}', {
      status: 403, headers: { "content-type": "application/json" },
    }))).rejects.toThrow(/صلاحية صاحب المشروع/);
  });
  it("rejects wrong content type and misleading declared size", async () => {
    await expect(readBoundedPortableResponse(new Response("html", {
      headers: { "content-type": "text/html" },
    }))).rejects.toThrow(/JSON/);
    await expect(readBoundedPortableResponse(new Response("x", {
      headers: { "content-type": "application/json", "content-length": "1000" },
    }), 20)).rejects.toThrow(/كبيرة/);
  });
  it("enforces byte limit even when Content-Length is absent", async () => {
    await expect(readBoundedPortableResponse(json('{"a":"123456789"}'), 8))
      .rejects.toThrow(/الحد الآمن/);
  });
});

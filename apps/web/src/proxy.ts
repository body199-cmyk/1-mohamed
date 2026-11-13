/**
 * Default: fail-closed public demo preview, no persistent writes.
 * Final Supabase cutover: set server-only APP_ENABLE_REAL_DATA=true together
 * with configured Auth/RLS, then verify all live acceptance gates.
 * No env flag alone grants a user access: JWT + owner RPC + route RLS apply.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseSetupStatus } from "./lib/supabase/config";
import { refreshSupabaseSession, carrySessionHeaders } from "./lib/supabase/proxy-session";

function isPublicAsset(pathname: string): boolean {
  return pathname.startsWith("/_next/") || pathname.startsWith("/fonts/") ||
    pathname === "/favicon.svg";
}
function isPreviewPage(pathname: string): boolean {
  return pathname === "/" || pathname === "/login" ||
    pathname === "/demo" || pathname.startsWith("/demo/");
}
function denyWrites() {
  return NextResponse.json(
    { error: "الحفظ الدائم وتسجيل الدخول غير متاحين حتى اكتمال المصادقة." },
    { status: 503, headers: { "cache-control": "no-store" } }
  );
}
function privatePath(path: string) {
  return path === "/app" || path.startsWith("/app/") ||
    path === "/api/ledger/master" || path === "/api/ledger/operations" ||
    path === "/api/ledger/read";
}
function jsonDenied(status: number) {
  return NextResponse.json({ error: "غير مصرح بالدخول." },
    { status, headers: { "cache-control": "no-store" } });
}
function noCache(response: NextResponse) {
  response.headers.set("cache-control", "no-store");
  return response;
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const method = request.method;
  const read = method === "GET" || method === "HEAD";

  if (read && isPublicAsset(pathname)) return NextResponse.next();

  // Default and all previews remain blocked until final cutover.
  if (process.env.APP_ENABLE_REAL_DATA !== "true") {
    if (!read) return denyWrites();
    if (isPreviewPage(pathname)) return NextResponse.next();
    const login = new URL("/login", request.url);
    login.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    return noCache(NextResponse.redirect(login, { status: 307 }));
  }

  // A production enable flag without ALL required configuration fails closed.
  if (!getSupabaseSetupStatus().ready) {
    if (!read) return denyWrites();
    if (pathname === "/" || pathname === "/login") return noCache(NextResponse.next());
    return jsonDenied(503);
  }

  // Never expose seeded demo records or its routes after real-data activation.
  if (pathname === "/demo" || pathname.startsWith("/demo/")) return jsonDenied(404);

  // Public Auth entry/recovery routes reveal no private financial data.
  if (read && (pathname === "/" || pathname === "/login" ||
    pathname === "/auth/callback" || pathname === "/auth/reset")) {
    return noCache(NextResponse.next());
  }

  // Explicit allowlist: unknown pages and API endpoints are not exposed.
  if (!privatePath(pathname)) return jsonDenied(404);

  // Only known private API methods are allowed; all other requests denied.
  if ((pathname === "/api/ledger/master" && !read) ||
      ((pathname === "/api/ledger/operations" || pathname === "/api/ledger/read") &&
       method !== "POST") ||
      ((pathname === "/app" || pathname.startsWith("/app/")) && !read)) {
    return jsonDenied(405);
  }

  // This is defense in depth; each API handler ALSO calls verifyOwnerForRoute
  // and each SQL RPC enforces app_require_owner with RLS protections.
  try {
    const session = await refreshSupabaseSession(request);
    if (!session.ownerAuthorized) {
      if (pathname.startsWith("/api/")) {
        return carrySessionHeaders(jsonDenied(401), session.response);
      }
      const login = new URL("/login", request.url);
      login.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
      return carrySessionHeaders(noCache(NextResponse.redirect(login, { status: 307 })),
        session.response);
    }
    return noCache(session.response);
  } catch {
    // Supabase outage, bad session, owner RPC failure: never open private data.
    return jsonDenied(503);
  }
}

export const config = { matcher: ["/:path*"] };

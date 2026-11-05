/**
 * AUTH-01 / H039 — temporary deny-all boundary, NOT real authentication.
 *
 * A protected route must never fall through while Supabase Auth has not been
 * installed and verified. Replace this guard only together with a real,
 * server-verified getClaims() + owner check, and with integration tests.
 *
 * The demo (/demo/*), login information page, and static assets are excluded.
 * Server actions and RPCs must always authorize independently of this Proxy.
 */
import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  // A POST should never be redirected to a form/page that did not expect it.
  // Returning 503 also prevents a future Route Handler from accidentally
  // accepting mutations before the real Auth guard exists.
  if (request.method !== "GET" && request.method !== "HEAD") {
    return NextResponse.json(
      { error: "الحفظ الدائم وتسجيل الدخول غير متاحين حتى اكتمال المصادقة." },
      { status: 503, headers: { "cache-control": "no-store" } }
    );
  }

  const login = new URL("/login", request.url);
  login.search = "";
  login.searchParams.set(
    "next",
    `${request.nextUrl.pathname}${request.nextUrl.search}`
  );
  const response = NextResponse.redirect(login, { status: 307 });
  response.headers.set("cache-control", "no-store");
  return response;
}

// Explicit, statically analyzable Next.js 16 matcher. No demo routes.
// Including /api prevents accidental unprotected business API exposure
// before per-handler authentication has been implemented.
export const config = {
  matcher: [
    "/trips/:path*",
    "/contractors/:path*",
    "/vehicles/:path*",
    "/payments/:path*",
    "/reports/:path*",
    "/settings/:path*",
    "/backups/:path*",
    "/api/:path*",
  ],
};

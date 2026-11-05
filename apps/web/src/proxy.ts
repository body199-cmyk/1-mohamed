/**
 * AUTH-01 / H039 — temporary FAIL-CLOSED boundary, not real authentication.
 *
 * Critical second-pass review: a named list of protected routes can silently
 * miss a new page. We therefore deny unknown application paths by default.
 * Only documented demo pages and their static assets are public.
 *
 * Replace this deny-all guard only together with real Supabase getClaims(),
 * owner authorization, and production-equivalent integration tests.
 * Proxy is not an authorization substitute for Server Actions, APIs or RPCs.
 */
import { NextResponse, type NextRequest } from "next/server";

function isPublicAsset(pathname: string): boolean {
  return (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/fonts/") ||
    pathname === "/favicon.svg"
  );
}

function isPublicPage(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/demo" ||
    pathname.startsWith("/demo/")
  );
}

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Next.js code chunks/fonts/icons are public assets. They carry no business
  // data and must keep working on the independent in-memory demo.
  if (
    (request.method === "GET" || request.method === "HEAD") &&
    isPublicAsset(pathname)
  ) {
    return NextResponse.next();
  }

  // This includes POST to demo pages and unknown future API routes. A POST
  // must never redirect its request body to a login or unrelated route.
  if (request.method !== "GET" && request.method !== "HEAD") {
    return NextResponse.json(
      { error: "الحفظ الدائم وتسجيل الدخول غير متاحين حتى اكتمال المصادقة." },
      { status: 503, headers: { "cache-control": "no-store" } }
    );
  }

  if (isPublicPage(pathname)) {
    return NextResponse.next();
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

// Run on ALL paths, not just known future business routes. Otherwise a new
// /dashboard page could accidentally bypass this temporary deny-all boundary.
export const config = {
  matcher: ["/:path*"],
};

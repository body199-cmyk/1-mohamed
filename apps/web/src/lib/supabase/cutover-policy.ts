/**
 * Exact allowlist for the REAL_DATA_CUTOVER path. This pure function is
 * regression-tested without connecting Supabase or opening private routes.
 * Unknown routes and methods are never authorized by default.
 */
export type CutoverRoute = "asset" | "public" | "root" | "demo" | "protected" | "deny";

export function classifyCutoverRoute(pathname: string, method: string): CutoverRoute {
  const read = method === "GET" || method === "HEAD";
  if (read && (pathname.startsWith("/_next/") || pathname.startsWith("/fonts/") ||
    pathname === "/favicon.svg")) return "asset";
  if (read && pathname === "/") return "root";
  if (read && (pathname === "/demo" || pathname.startsWith("/demo/"))) return "demo";
  if (read && (pathname === "/login" || pathname === "/auth/callback" ||
    pathname === "/auth/reset")) return "public";
  if (read && (pathname === "/app" || pathname === "/api/ledger/master")) return "protected";
  if (method === "POST" && (pathname === "/api/ledger/read" ||
    pathname === "/api/ledger/operations")) return "protected";
  return "deny";
}

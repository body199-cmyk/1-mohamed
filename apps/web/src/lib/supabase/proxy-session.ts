import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { assertSupabaseConfigured } from "./config";
import {loginCookieOptions,remembersLogin} from './remember';

/**
 * Active session-refresh adapter called by apps/web/src/proxy.ts when the
 * production real-data switch and Supabase configuration are present.
 * Signed claims are checked with getClaims(), then app_is_owner() is queried;
 * authenticated status alone never grants access. Route Handlers repeat the
 * owner check independently. Redirects must preserve refreshed cookies and
 * cache headers from this response.
 */
export async function refreshSupabaseSession(request: NextRequest) {
  const { url, publishableKey } = assertSupabaseConfigured();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, loginCookieOptions(options,remembersLogin(request.cookies.getAll())));
        });
        for (const [header, value] of Object.entries(headers ?? {})) {
          response.headers.set(header, value);
        }
      },
    },
  });

  const { data, error } = await supabase.auth.getClaims();
  const claims = !error ? (data?.claims ?? null) : null;
  // Authenticated is NOT authorized: an invited/created Auth user must also
  // match the owner row, as enforced independently by RLS and every RPC.
  const ownerResult = claims?.sub ? await supabase.rpc("app_is_owner") : null;
  const ownerAuthorized = !!claims?.sub && ownerResult?.error == null && ownerResult?.data === true;
  return { response, claims, ownerAuthorized, error };

}

/** Preserve both auth cookies and no-cache headers if redirecting later. */
export function carrySessionHeaders(
  target: NextResponse,
  sessionResponse: NextResponse
) {
  for (const cookie of sessionResponse.cookies.getAll()) {
    target.cookies.set(cookie);
  }
  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = sessionResponse.headers.get(header);
    if (value) target.headers.set(header, value);
  }
  return target;
}

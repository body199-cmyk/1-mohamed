import "server-only";

import { createServerClient } from "@supabase/ssr";
import { type NextRequest, type NextResponse } from "next/server";
import { assertSupabaseConfigured } from "./config";
import {loginCookieOptions,remembersLogin} from './remember';

/**
 * H041, critical review fix:
 * Route Handlers MUST provide their actual response object. This makes
 * Set-Cookie + Cache-Control propagation explicit and avoids dropping the
 * second `headers` argument of Supabase SSR setAll().
 *
 * Used by the permanent ledger Route Handlers. Do not use this from a Server
 * Component or persist a client globally; each request supplies its own
 * request and response so refreshed cookies and cache headers are preserved.
 */
export function createRouteHandlerSupabaseClient(
  request: NextRequest,
  response: NextResponse
) {
  const { url, publishableKey } = assertSupabaseConfigured();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value, options } of cookiesToSet) {
          request.cookies.set(name, value);
          response.cookies.set(name, value, loginCookieOptions(options,remembersLogin(request.cookies.getAll())));
        }
        for (const [name, value] of Object.entries(headers ?? {})) {
          response.headers.set(name, value);
        }
      },
    },
  });
}

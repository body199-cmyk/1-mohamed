import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { assertSupabaseConfigured } from "./config";

/**
 * H041 — ONLY call inside a Route Handler or Server Action able to set cookies.
 * Using this in a read-only Server Component is intentionally unsupported
 * until the session refresh proxy has been integrated and tested.
 *
 * Create a fresh instance per request; never cache sessions across users.
 */
export async function createWritableServerSupabaseClient() {
  const { url, publishableKey } = assertSupabaseConfigured();
  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet, headers) {
        // In a Route Handler or Server Action these updates must be persisted.
        // Do not swallow cookie exceptions: that would report fake sign-in.
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
        // The SDK can supply cache headers to its proxy adapter. This helper
        // is intentionally not responsible for HTTP response headers.
        void headers;
      },
    },
  });
}

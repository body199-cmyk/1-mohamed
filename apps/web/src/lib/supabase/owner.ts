import "server-only";

import type { createRouteHandlerSupabaseClient } from "./server";

/**
 * H041 — prospective owner guard for a *specific Route Handler client*.
 * Caller supplies the already-configured client tied to that request and its
 * response; no global singleton, session-cookie trust or service-role bypass.
 *
 * This remains dormant until an isolated Supabase test project verifies it.
 */
export async function verifyOwnerForRoute(
  supabase: ReturnType<typeof createRouteHandlerSupabaseClient>
) {
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();
  const subject = claimsData?.claims?.sub;

  if (claimsError || typeof subject !== "string" || subject.length === 0) {
    return { authorized: false as const };
  }

  const { data: isOwner, error: ownerError } =
    await supabase.rpc("app_is_owner");

  if (ownerError || isOwner !== true) {
    return { authorized: false as const };
  }

  return { authorized: true as const, userId: subject };
}

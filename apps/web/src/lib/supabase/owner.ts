import "server-only";

import type { createRouteHandlerSupabaseClient } from "./server";

/**
 * Active owner guard for a specific Route Handler client.
 * Caller supplies the configured client tied to that request and response;
 * no global singleton, session-cookie trust, or service-role bypass is used.
 * Every permanent ledger Route Handler calls this guard before its RPC.
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

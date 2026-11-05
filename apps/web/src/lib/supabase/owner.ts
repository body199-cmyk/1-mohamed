import "server-only";

import { createWritableServerSupabaseClient } from "./server";

/**
 * H041: a prospective server authorization primitive, NOT yet wired to routes.
 *
 * Real access requires BOTH a verified JWT and the database owner gate.
 * Never authorize from an email, query param, session cookie, or user_metadata.
 * app_is_owner() is granted to authenticated only and fails closed when
 * the owner has not been initialized.
 */
export async function verifyOwnerForAction() {
  const supabase = await createWritableServerSupabaseClient();

  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();
  const sub = claimsData?.claims?.sub;

  if (claimsError || typeof sub !== "string" || !sub) {
    return { authorized: false as const, supabase };
  }

  const { data: isOwner, error: ownerError } =
    await supabase.rpc("app_is_owner");

  if (ownerError || isOwner !== true) {
    return { authorized: false as const, supabase };
  }

  return { authorized: true as const, userId: sub, supabase };
}

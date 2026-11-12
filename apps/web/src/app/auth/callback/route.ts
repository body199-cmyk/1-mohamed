import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerSupabaseClient } from "../../../lib/supabase/server";
import { getSupabaseSetupStatus } from "../../../lib/supabase/config";

/**
 * Prepared recovery callback. Final deployment must allow this GET path in
 * proxy.ts only after the real Supabase owner/RLS integration is verified.
 * Never trust arbitrary redirect URLs supplied in the query string.
 */
export async function GET(request: NextRequest) {
  const destination = new URL("/login", request.url);
  const code = request.nextUrl.searchParams.get("code");
  if (!getSupabaseSetupStatus().ready || !code) {
    destination.searchParams.set("error", "recovery");
    return NextResponse.redirect(destination, { status: 303 });
  }

  const flow = request.nextUrl.searchParams.get("flow");
  const target = new URL(flow === "recovery" ? "/auth/reset" : "/login", request.url);
  const response = NextResponse.redirect(target, { status: 303 });
  response.headers.set("cache-control", "no-store");
  const client = createRouteHandlerSupabaseClient(request, response);
  const { error } = await client.auth.exchangeCodeForSession(code);
  if (error) {
    const rejected = NextResponse.redirect(destination, { status: 303 });
    rejected.headers.set("cache-control", "no-store");
    return rejected;
  }
  return response;
}

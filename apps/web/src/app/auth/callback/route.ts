import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerSupabaseClient } from "../../../lib/supabase/server";
import { getSupabaseSetupStatus } from "../../../lib/supabase/config";

/**
 * Prepared recovery callback. Final deployment must allow this GET path in
 * proxy.ts only after the real Supabase owner/RLS integration is verified.
 * Never trust arbitrary redirect URLs supplied in the query string.
 */
export async function GET(request: NextRequest) {
  const setup=getSupabaseSetupStatus();
  const base=setup.ready?setup.siteUrl:request.url;
  const destination = new URL("/login", base);
  destination.searchParams.set('error','recovery');
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash=request.nextUrl.searchParams.get('token_hash');
  const isRecovery=request.nextUrl.searchParams.get('type')==='recovery';
  // Email implicit tokens live only in the browser fragment, never on the server.
  // A redirect with no fragment preserves it; reset consumes and immediately clears it.
  if(setup.ready&&!code&&!tokenHash&&request.nextUrl.searchParams.get('flow')==='recovery'){
    const landing=NextResponse.redirect(new URL('/auth/reset',base),{status:303});
    landing.headers.set('cache-control','no-store');
    landing.headers.set('referrer-policy','no-referrer');
    return landing;
  }
  if (!setup.ready || (!code && !(tokenHash&&isRecovery))) {
    destination.searchParams.set("error", "recovery");
    const denied=NextResponse.redirect(destination,{status:303});
    denied.headers.set('cache-control','no-store');
    return denied;
  }

  const flow = request.nextUrl.searchParams.get("flow");
  const target = new URL(flow === "recovery" || isRecovery ? "/auth/reset" : "/login", base);
  const response = NextResponse.redirect(target, { status: 303 });
  response.headers.set("cache-control", "no-store");
  const client = createRouteHandlerSupabaseClient(request, response);
  const reject=()=>{
    const denied=NextResponse.redirect(destination,{status:303});
    denied.headers.set('cache-control','no-store');
    for(const cookie of response.cookies.getAll())denied.cookies.set(cookie);
    return denied;
  };
  try {
  const { error } = tokenHash&&isRecovery
    ? await client.auth.verifyOtp({token_hash:tokenHash,type:'recovery'})
    : await client.auth.exchangeCodeForSession(code!);
  if (error) {
    return reject();
  }
  const owner=await client.rpc('app_is_owner');
  if(owner.error||owner.data!==true){
    await client.auth.signOut();
    return reject();
  }
  return response;
  } catch {return reject();}
}

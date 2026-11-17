import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerSupabaseClient } from "../../../../lib/supabase/server";
import { carrySessionHeaders } from "../../../../lib/supabase/proxy-session";
import { getSupabaseSetupStatus } from "../../../../lib/supabase/config";
import { isAllowedLedgerOrigin } from "../../../../lib/ledger/request-origin";
import { matchesOwnerLoginIdentifier } from "../../../../lib/supabase/owner-login-identity";

export const dynamic = "force-dynamic";

function result(body: object, status: number, session?: NextResponse) {
  const response = NextResponse.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
  return session ? carrySessionHeaders(response, session) : response;
}

/** Resolve the one public owner alias server-side; never expose or persist a password. */
export async function POST(request: NextRequest) {
  const setup = getSupabaseSetupStatus();
  if (process.env.APP_ENABLE_REAL_DATA !== "true" || !setup.ready) {
    return result({ error: "تسجيل الدخول غير متاح حاليًا." }, 503);
  }
  if (!isAllowedLedgerOrigin(request.headers, setup.siteUrl)) {
    return result({ error: "طلب من مصدر غير مسموح." }, 403);
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 4096) {
    return result({ error: "الطلب أكبر من المسموح." }, 413);
  }

  let input: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 4096) return result({ error: "الطلب أكبر من المسموح." }, 413);
    input = JSON.parse(raw);
  } catch {
    return result({ error: "صيغة الطلب غير صحيحة." }, 400);
  }

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return result({ error: "بيانات الدخول غير صحيحة." }, 400);
  }
  const body = input as Record<string, unknown>;
  const identifier = typeof body.identifier === "string" ? body.identifier.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!identifier || identifier.length > 254 || !password || password.length > 1024) {
    return result({ error: "بيانات الدخول غير صحيحة." }, 400);
  }

  const ownerUsername = (process.env.OWNER_LOGIN_USERNAME ?? "").trim();
  const ownerEmail = (process.env.OWNER_LOGIN_EMAIL ?? "").trim();
  if (!ownerUsername || !ownerEmail) {
    return result({ error: "إعداد حساب الدخول غير مكتمل." }, 503);
  }
  const loginEmail = matchesOwnerLoginIdentifier(identifier,ownerUsername,ownerEmail)
    ? ownerEmail : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier) ? identifier.toLowerCase() : null;
  if (!loginEmail) {
    return result({ error: "بيانات الدخول غير صحيحة." }, 401);
  }

  const sessionResponse = NextResponse.next({ request });
  const client = createRouteHandlerSupabaseClient(request, sessionResponse);
  const { error: signInError } = await client.auth.signInWithPassword({ email: loginEmail, password });
  if (signInError) {
    return result({ error: "بيانات الدخول غير صحيحة." }, 401, sessionResponse);
  }

  const { data: owner, error: ownerError } = await client.rpc("app_has_access");
  if (ownerError || owner !== true) {
    await client.auth.signOut();
    return result({ error: "بيانات الدخول غير صحيحة." }, 401, sessionResponse);
  }

  return result({ ok: true }, 200, sessionResponse);
}

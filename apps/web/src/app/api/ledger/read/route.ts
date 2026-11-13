import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerSupabaseClient } from "../../../../lib/supabase/server";
import { verifyOwnerForRoute } from "../../../../lib/supabase/owner";
import { carrySessionHeaders } from "../../../../lib/supabase/proxy-session";
import { isJsonRecord, isReadOperation, READ_OPERATIONS } from "../../../../lib/ledger/operation-contract";
import { getSupabaseSetupStatus } from "../../../../lib/supabase/config";

export const dynamic = "force-dynamic";

function result(body: object, status: number, session?: NextResponse) {
  const response = NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
  return session ? carrySessionHeaders(response, session) : response;
}

/** Owner-only read RPC; financial bigint fields are returned as strings by SQL. */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if ((origin && origin !== request.nextUrl.origin) || fetchSite === "cross-site") {
    return result({ error: "طلب من مصدر غير مسموح." }, 403);
  }
  if (!getSupabaseSetupStatus().ready) return result({ error: "القراءة الدائمة غير مفعّلة." }, 503);
  let input: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 16384) return result({ error: "الطلب أكبر من المسموح." }, 413);
    input = JSON.parse(raw);
  } catch {
    return result({ error: "صيغة الطلب غير صحيحة." }, 400);
  }
  if (!isJsonRecord(input) || !isReadOperation(input.operation) || !isJsonRecord(input.payload)) {
    return result({ error: "طلب قراءة غير مسموح." }, 400);
  }
  const sessionResponse = NextResponse.next();
  const client = createRouteHandlerSupabaseClient(request, sessionResponse);
  if (!(await verifyOwnerForRoute(client)).authorized) {
    return result({ error: "غير مصرح بالدخول." }, 401, sessionResponse);
  }
  const { data, error } = await client.rpc(READ_OPERATIONS[input.operation], {
    p_payload: input.payload,
  });
  if (error) return result({ error: "تعذّر تحميل البيانات المطلوبة." }, 422, sessionResponse);
  return result({ ok: true, data }, 200, sessionResponse);
}

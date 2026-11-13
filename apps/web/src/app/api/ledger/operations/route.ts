import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerSupabaseClient } from "../../../../lib/supabase/server";
import { verifyOwnerForRoute } from "../../../../lib/supabase/owner";
import { carrySessionHeaders } from "../../../../lib/supabase/proxy-session";
import { isJsonRecord, isWriteOperation, validRequestKey, WRITE_OPERATIONS } from "../../../../lib/ledger/operation-contract";
import { getSupabaseSetupStatus } from "../../../../lib/supabase/config";

export const dynamic = "force-dynamic";

function result(body: object, status: number, session?: NextResponse) {
  const response = NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
  return session ? carrySessionHeaders(response, session) : response;
}

/**
 * PREPARED BUT NOT EXPOSED: proxy.ts still blocks POST requests until the
 * final connected owner/RLS verification. Every write is an audited DB RPC.
 */
export async function POST(request: NextRequest) {
  // Defense in depth: prevent browser cross-site POSTs even if a cookie is
  // accidentally sent. Real authorization still requires owner JWT + RLS.
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if ((origin && origin !== request.nextUrl.origin) || fetchSite === "cross-site") {
    return result({ error: "طلب من مصدر غير مسموح." }, 403);
  }
  if (!getSupabaseSetupStatus().ready) return result({ error: "الحفظ الدائم غير مفعّل." }, 503);
  if (Number(request.headers.get("content-length") ?? 0) > 32768) {
    return result({ error: "الطلب أكبر من المسموح." }, 413);
  }
  let input: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 32768) return result({ error: "الطلب أكبر من المسموح." }, 413);
    input = JSON.parse(raw);
  } catch {
    return result({ error: "صيغة الطلب غير صحيحة." }, 400);
  }
  if (!isJsonRecord(input) || !isWriteOperation(input.operation)
      || !validRequestKey(input.requestKey) || !isJsonRecord(input.payload)) {
    return result({ error: "عملية غير مسموحة أو مفتاح طلب غير صالح." }, 400);
  }
  const sessionResponse = NextResponse.next();
  const client = createRouteHandlerSupabaseClient(request, sessionResponse);
  const owner = await verifyOwnerForRoute(client);
  if (!owner.authorized) return result({ error: "غير مصرح بالدخول." }, 401, sessionResponse);

  const rpcName = WRITE_OPERATIONS[input.operation];
  const { data, error } = await client.rpc(rpcName, {
    p_request_key: input.requestKey, p_payload: input.payload,
  });
  if (error) {
    // SQL error details may contain internal financial data; do not echo them.
    const conflict = error.code === "P2003" || error.code === "23505";
    return result({ error: conflict ? "تم تعديل البيانات من جلسة أخرى؛ حدّث الصفحة وأعد المحاولة." :
      "تعذر حفظ العملية. راجع المدخلات ثم حاول مرة أخرى بنفس مفتاح الطلب." },
      conflict ? 409 : 422, sessionResponse);
  }
  return result({ ok: true, data }, 200, sessionResponse);
}

import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerSupabaseClient } from "../../../../lib/supabase/server";
import { verifyOwnerForRoute } from "../../../../lib/supabase/owner";
import { carrySessionHeaders } from "../../../../lib/supabase/proxy-session";
import { getSupabaseSetupStatus } from "../../../../lib/supabase/config";

export const dynamic = "force-dynamic";

const MASTER_TABLES = {
  contractors: "id,name,is_primary,is_archived,created_at,updated_at",
  vehicles: "id,plate_number,driver_name,is_archived,created_at,updated_at",
  vehicle_accounts: "vehicle_id,contractor_id,created_at",
} as const;

function result(body: object, status: number, session?: NextResponse) {
  const response = NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
  return session ? carrySessionHeaders(response, session) : response;
}

/** Paginated owner-only master-data read; no raw bigint JSON values. */
export async function GET(request: NextRequest) {
  if (!getSupabaseSetupStatus().ready) return result({ error: "الحفظ الدائم غير مفعّل." }, 503);
  const kind = request.nextUrl.searchParams.get("type");
  if (!kind || !Object.prototype.hasOwnProperty.call(MASTER_TABLES, kind)) {
    return result({ error: "نوع البيانات غير مسموح." }, 400);
  }
  const limitText = request.nextUrl.searchParams.get("limit") ?? "100";
  const offsetText = request.nextUrl.searchParams.get("offset") ?? "0";
  if (!/^[1-9][0-9]{0,2}$/.test(limitText) || !/^(0|[1-9][0-9]{0,6})$/.test(offsetText)) {
    return result({ error: "بيانات التصفح غير صحيحة." }, 400);
  }
  const limit = Number(limitText), offset = Number(offsetText);
  if (limit > 200) return result({ error: "حد القراءة تجاوز المسموح." }, 400);
  const sessionResponse = NextResponse.next();
  const client = createRouteHandlerSupabaseClient(request, sessionResponse);
  if (!(await verifyOwnerForRoute(client)).authorized) {
    return result({ error: "غير مصرح بالدخول." }, 401, sessionResponse);
  }
  const table = kind as keyof typeof MASTER_TABLES;
  const columns = MASTER_TABLES[table];
  const { data, error } = await client.from(table).select(columns)
    .order(table === "vehicle_accounts" ? "vehicle_id" : "id")
    .range(offset, offset + limit);
  if (error || !data) return result({ error: "تعذّر قراءة البيانات الأساسية." }, 422, sessionResponse);
  return result({ ok: true, data: data.slice(0, limit), hasMore: data.length > limit,
    nextOffset: data.length > limit ? offset + limit : null }, 200, sessionResponse);
}

import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerSupabaseClient } from "../../../../lib/supabase/server";
import { verifyOwnerForRoute } from "../../../../lib/supabase/owner";
import { carrySessionHeaders } from "../../../../lib/supabase/proxy-session";
import { getSupabaseSetupStatus } from "../../../../lib/supabase/config";
import { isAllowedLedgerOrigin } from "../../../../lib/ledger/request-origin";
import { PORTABLE_BACKUP_TABLES, createPortableBackup, serializeTableCsv, type PortableBackupTable } from "../../../../lib/backup/export";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function result(body: object, status: number, session?: NextResponse) {
  const response = NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
  return session ? carrySessionHeaders(response, session) : response;
}

function download(body: string, contentType: string, filename: string, session: NextResponse) {
  const response = new NextResponse(body, { headers: {
    "content-type": contentType,
    "content-disposition": 'attachment; filename="' + filename + '"',
    "cache-control": "no-store",
  } });
  return carrySessionHeaders(response, session);
}

export async function GET(request: NextRequest) {
  const setup = getSupabaseSetupStatus();
  if (!isAllowedLedgerOrigin(request.headers, setup.siteUrl)) return result({ error: "طلب من مصدر غير مسموح." }, 403);
  if (!setup.ready) return result({ error: "الحفظ الدائم غير مفعّل." }, 503);
  const session = NextResponse.next();
  const client = createRouteHandlerSupabaseClient(request, session);
  if (!(await verifyOwnerForRoute(client)).authorized) return result({ error: "غير مصرح بالدخول." }, 401, session);
  const { data: isOwner, error: ownerError } = await client.rpc("app_is_owner");
  if (ownerError || isOwner !== true) return result({ error: "التصدير متاح لصاحب المشروع فقط." }, 403, session);

  const format = request.nextUrl.searchParams.get("format") ?? "json";
  if (format !== "json" && format !== "csv") return result({ error: "صيغة التصدير غير مدعومة." }, 400, session);
  const table = format === "csv" ? request.nextUrl.searchParams.get("table") as PortableBackupTable | null : null;
  if (format === "csv" && (!table || !PORTABLE_BACKUP_TABLES.includes(table))) {
    return result({ error: "اختر جدولًا صحيحًا للتصدير." }, 400, session);
  }

  const { data, error } = await client.rpc("app_portable_backup_snapshot", { p_table: table });
  if (error?.code === "P2010") {
    return result({ error: "تغيّرت البيانات أثناء التصدير. أعد المحاولة للحصول على نسخة متسقة." }, 409, session);
  }
  if (error?.code === "42501") return result({ error: "التصدير متاح لصاحب المشروع فقط." }, 403, session);
  if (error?.code === "P2011") return result({ error: "حجم البيانات تجاوز الحد الآمن للتصدير المحلي." }, 422, session);
  if (error || !data) return result({ error: "تعذّر تصدير البيانات." }, 422, session);

  try {
    if (table) {
      const csv = serializeTableCsv(table, data[table]);
      return download(csv, "text/csv; charset=utf-8", table + "-1-mohamed.csv", session);
    }
    const backup = createPortableBackup(data);
    return download(JSON.stringify(backup, null, 2) + "\n", "application/json; charset=utf-8",
      "1-mohamed-portable-backup-" + backup.created_at.slice(0, 10) + ".json", session);
  } catch (cause) {
    return result({ error: cause instanceof Error ? cause.message : "تعذّر إنشاء النسخة الاحتياطية." }, 422, session);
  }
}

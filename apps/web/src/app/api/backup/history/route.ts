import { NextRequest,NextResponse } from "next/server";
import { createRouteHandlerSupabaseClient } from "../../../../lib/supabase/server";
import { verifyOwnerForRoute } from "../../../../lib/supabase/owner";
import { carrySessionHeaders } from "../../../../lib/supabase/proxy-session";
import { getSupabaseSetupStatus } from "../../../../lib/supabase/config";
import { isAllowedLedgerOrigin } from "../../../../lib/ledger/request-origin";
export const dynamic="force-dynamic";
function result(body:object,status:number,session?:NextResponse){const response=NextResponse.json(body,{status,headers:{"cache-control":"no-store"}});return session?carrySessionHeaders(response,session):response;}
export async function GET(request:NextRequest){
 const setup=getSupabaseSetupStatus();
 if(!isAllowedLedgerOrigin(request.headers,setup.siteUrl))return result({error:"طلب من مصدر غير مسموح."},403);
 if(!setup.ready)return result({error:"الحفظ الدائم غير مفعّل."},503);
 const session=NextResponse.next(),client=createRouteHandlerSupabaseClient(request,session);
 if(!(await verifyOwnerForRoute(client)).authorized)return result({error:"غير مصرح بالدخول."},401,session);
 const {data:isOwner,error:ownerError}=await client.rpc("app_is_owner");
 if(ownerError||isOwner!==true)return result({error:"سجل النسخ متاح لصاحب المشروع فقط."},403,session);
 const {data,error}=await client.from("backup_history" as any).select("backup_date,file_name,drive_file_id,drive_web_view_link,size_bytes,sha256,table_counts,created_at").order("backup_date",{ascending:false}).limit(30);
 if(error||!data)return result({error:"سجل النسخ غير متاح بعد. تأكد من تطبيق ترحيل backup_history."},503,session);
 return result({ok:true,backups:data},200,session);
}

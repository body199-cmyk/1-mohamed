import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerSupabaseClient } from "../../../../lib/supabase/server";
import { verifyOwnerForRoute } from "../../../../lib/supabase/owner";
import { carrySessionHeaders } from "../../../../lib/supabase/proxy-session";
import { getSupabaseSetupStatus } from "../../../../lib/supabase/config";
import { isAllowedLedgerOrigin } from "../../../../lib/ledger/request-origin";
import { BACKUP_ORDER, PORTABLE_BACKUP_TABLES, createPortableBackup, serializeTableCsv, type PortableBackupTable } from "../../../../lib/backup/export";
export const dynamic="force-dynamic";
export const runtime="nodejs";
const PAGE_SIZE=1000;
function result(body:object,status:number,session?:NextResponse){const response=NextResponse.json(body,{status,headers:{"cache-control":"no-store"}});return session?carrySessionHeaders(response,session):response;}
async function readOneTable(client:any,table:PortableBackupTable){
 const rows:unknown[]=[];
 for(let offset=0;offset<=50000;offset+=PAGE_SIZE){
  let query=client.from(table).select("*");
  for(const key of BACKUP_ORDER[table])query=query.order(key,{ascending:true});
  const {data,error}=await query.range(offset,offset+PAGE_SIZE-1);
  if(error||!data)throw new Error("تعذّر تصدير جدول "+table+".");
  rows.push(...data);
  if(data.length<PAGE_SIZE)break;
  if(offset>=50000)throw new Error("حجم البيانات تجاوز الحد الآمن للتصدير المحلي.");
 }
 return rows;
}
async function readAllTables(client:any){
 const tables:Record<string,unknown[]>={};
 for(const table of PORTABLE_BACKUP_TABLES){
  const rows:unknown[]=[];
  for(let offset=0;offset<=50000;offset+=PAGE_SIZE){
   let query=client.from(table).select("*");
   for(const key of BACKUP_ORDER[table])query=query.order(key,{ascending:true});
   const {data,error}=await query.range(offset,offset+PAGE_SIZE-1);
   if(error||!data)throw new Error("تعذّر تصدير جدول "+table+".");
   rows.push(...data);
   if(data.length<PAGE_SIZE)break;
   if(offset+PAGE_SIZE>=50000)throw new Error("حجم البيانات تجاوز الحد الآمن للتصدير المحلي.");
  }
  tables[table]=rows;
 }
 return tables as Record<PortableBackupTable,unknown[]>;
}
export async function GET(request:NextRequest){
 const setup=getSupabaseSetupStatus();
 if(!isAllowedLedgerOrigin(request.headers,setup.siteUrl))return result({error:"طلب من مصدر غير مسموح."},403);
 if(!setup.ready)return result({error:"الحفظ الدائم غير مفعّل."},503);
 const session=NextResponse.next(),client=createRouteHandlerSupabaseClient(request,session);
 if(!(await verifyOwnerForRoute(client)).authorized)return result({error:"غير مصرح بالدخول."},401,session);
 const format=request.nextUrl.searchParams.get("format")??"json";
 if(format==="csv"){
  const table=request.nextUrl.searchParams.get("table") as PortableBackupTable|null;
  if(!table||!(PORTABLE_BACKUP_TABLES as readonly string[]).includes(table))return result({error:"اختر جدولًا صحيحًا للتصدير."},400,session);
  try{
   const rows=await readOneTable(client,table);
   const response=new NextResponse(serializeTableCsv(table,rows as Record<string,unknown>[]),{status:200,headers:{"content-type":"text/csv; charset=utf-8","content-disposition":'attachment; filename="'+table+'-1-mohamed.csv"',"cache-control":"no-store"}});
   return carrySessionHeaders(response,session);
  }catch(error){return result({error:error instanceof Error?error.message:"تعذّر تصدير البيانات."},422,session);}
 }
 if(format!=="json")return result({error:"صيغة التصدير غير مدعومة."},400,session);
 try{
  const backup=createPortableBackup(await readAllTables(client));
  const body=JSON.stringify(backup,null,2)+"\n";
  const response=new NextResponse(body,{status:200,headers:{"content-type":"application/json; charset=utf-8","content-disposition":'attachment; filename="1-mohamed-portable-backup-'+backup.created_at.slice(0,10)+'.json"',"cache-control":"no-store"}});
  return carrySessionHeaders(response,session);
 }catch(error){return result({error:error instanceof Error?error.message:"تعذّر إنشاء النسخة الاحتياطية."},422,session);}
}

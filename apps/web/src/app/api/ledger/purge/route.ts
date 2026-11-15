import {NextRequest,NextResponse} from 'next/server';
import {getSupabaseSetupStatus} from '../../../../lib/supabase/config';
import {createRouteHandlerSupabaseClient} from '../../../../lib/supabase/server';
import {verifyOwnerForRoute} from '../../../../lib/supabase/owner';
import {carrySessionHeaders} from '../../../../lib/supabase/proxy-session';
import {isAllowedLedgerOrigin} from '../../../../lib/ledger/request-origin';
import {isDeletionRequest} from '../../../../lib/ledger/deletion-contract';
import {createPasswordConfirmationClient} from '../../../../lib/ledger/password-confirmation';
export const dynamic='force-dynamic';
function reply(body:object,status:number,session?:NextResponse){
 const response=NextResponse.json(body,{status,headers:{'cache-control':'no-store'}});
 return session?carrySessionHeaders(response,session):response;
}
function failure(code:string|undefined,session:NextResponse){
 if(code==='P2008')return reply({error:'طلبات المعاينة كتير. استنى دقيقة وحاول مرة أخرى.'},429,session);
 if(['P2006','P2007','55P03','40001','40P01'].includes(code??''))return reply({error:'المعاينة انتهت أو البيانات اتغيّرت أو مشغولة. اعمل معاينة جديدة قبل الحذف.',refreshPreview:true},409,session);
 return reply({error:'لم يكتمل الحذف. راجع النطاق والتأكيد وكلمة المرور ثم حاول مرة أخرى.'},422,session);
}
export async function POST(request:NextRequest){
 const setup=getSupabaseSetupStatus();
 if(!isAllowedLedgerOrigin(request.headers,setup.siteUrl))return reply({error:'طلب من مصدر غير مسموح.'},403);
 if(!setup.ready||process.env.APP_ENABLE_REAL_DATA!=='true')return reply({error:'الحفظ الدائم غير مفعّل.'},503);
 if(Number(request.headers.get('content-length')??0)>8192)return reply({error:'الطلب أكبر من المسموح.'},413);
 let input:unknown;
 try{const raw=await request.text();if(raw.length>8192)return reply({error:'الطلب أكبر من المسموح.'},413);input=JSON.parse(raw);}
 catch{return reply({error:'صيغة الطلب غير صحيحة.'},400);}
 if(!isDeletionRequest(input))return reply({error:'حدد نطاقًا صحيحًا وأكمل التأكيد المطلوب.'},400);
 const session=NextResponse.next();
 try{
  const client=createRouteHandlerSupabaseClient(request,session);
  const owner=await verifyOwnerForRoute(client);
  if(!owner.authorized)return reply({error:'غير مصرح بالدخول.'},401,session);
  const verified=await client.auth.getUser();
  if(verified.error||verified.data.user?.id!==owner.userId)return reply({error:'الجلسة غير صالحة. سجّل الدخول مرة أخرى.'},401,session);
  if(input.action==='preview'){
   const r=await client.rpc('app_op_data_purge_preview',{p_payload:input.scope});
   return r.error?failure(r.error.code,session):reply({ok:true,data:r.data},200,session);
  }
  const email=verified.data.user.email;
  if(!email)return reply({error:'الحساب لا يدعم التحقق بكلمة المرور.'},401,session);
  const passwordClient=createPasswordConfirmationClient();
  try{
   const checked=await passwordClient.auth.signInWithPassword({email,password:input.password});
   if(checked.error||checked.data.user?.id!==owner.userId)return reply({error:'كلمة المرور غير صحيحة أو تعذّر التحقق منها. لم يتم الحذف.'},401,session);
   const r=await passwordClient.rpc('app_op_data_purge_execute',{p_payload:{challenge_id:input.challenge_id,confirmation:input.confirmation}});
   return r.error?failure(r.error.code,session):reply({ok:true,data:r.data},200,session);
  }finally{
   // Revoke ONLY this temporary password-check session, never the user's other sessions.
   await passwordClient.auth.signOut({scope:'local'}).catch(()=>undefined);
  }
 }catch{return reply({error:'تعذّر تأكيد نتيجة الطلب. حدّث البيانات قبل أي محاولة جديدة.'},503,session);}
}

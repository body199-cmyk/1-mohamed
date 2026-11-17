import {NextRequest,NextResponse} from 'next/server';
import {createRouteHandlerSupabaseClient} from '../../../../lib/supabase/server';
import {getSupabaseSetupStatus} from '../../../../lib/supabase/config';
import {verifyOwnerForRoute} from '../../../../lib/supabase/owner';
import {carrySessionHeaders} from '../../../../lib/supabase/proxy-session';
import {isAllowedLedgerOrigin} from '../../../../lib/ledger/request-origin';
export const dynamic='force-dynamic';
async function handle(request:NextRequest){
 const session=NextResponse.next({request});
 const reply=(body:object,status=200)=>carrySessionHeaders(NextResponse.json(body,{status,headers:{'cache-control':'no-store'}}),session);
 const setup=getSupabaseSetupStatus();
 if(process.env.APP_ENABLE_REAL_DATA!=='true'||!setup.ready)return reply({error:'إدارة المستخدمين غير متاحة حاليًا.'},503);
 if(request.method==='POST'&&!isAllowedLedgerOrigin(request.headers,setup.siteUrl))return reply({error:'مصدر غير مسموح.'},403);
 const client=createRouteHandlerSupabaseClient(request,session);
 try{
  if(!(await verifyOwnerForRoute(client)).authorized)return reply({error:'غير مصرح بالدخول.'},401);
  const owner=await client.rpc('app_is_owner');
  if(owner.error)return reply({error:'تعذّر التحقق من الصلاحيات.'},503);
  if(owner.data!==true)return request.method==='GET'?reply({isOwner:false,members:[]}):reply({error:'إدارة المستخدمين لصاحب الحساب فقط.'},403);
  if(request.method==='GET'){
   const r=await client.from('app_members').select('user_id,email,is_active,created_at').order('created_at',{ascending:false}).limit(100);
   if(r.error)throw r.error;
   return reply({isOwner:true,members:r.data});
  }
  const raw=await request.text();if(raw.length>1024)return reply({error:'الطلب أكبر من المسموح.'},413);
  const input=JSON.parse(raw);
  if(input?.action==='revoke'){
   if(typeof input.userId!=='string'||!/^[0-9a-f-]{36}$/i.test(input.userId))return reply({error:'مستخدم غير صالح.'},400);
   const r=await client.rpc('app_member_revoke',{p_user_id:input.userId});if(r.error)throw r.error;
   return reply({ok:true,message:'تم إلغاء الوصول للمشروع.'});
  }
  if(input?.action!=='invite'&&input?.action!=='resend'&&input?.action!=='link')return reply({error:'عملية غير صالحة.'},400);
  if(typeof input.email!=='string'||input.email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim()))return reply({error:'اكتب بريدًا إلكترونيًا صحيحًا.'},400);
  const r=await client.functions.invoke('invite-member',{body:{email:input.email.trim(),resend:input.action==='resend',mode:input.action==='link'?'link':'email'}});
  if(r.error||r.data?.ok!==true)return reply({error:'تعذّر إرسال الدعوة. قد يكون الحساب مضافًا بالفعل أو إعداد إرسال البريد غير مكتمل. حدّث القائمة ثم حاول مجددًا.'},502);
  return reply({ok:true,message:r.data.message,...(typeof r.data.inviteUrl==='string'?{inviteUrl:r.data.inviteUrl}:{})});
 }catch{return reply({error:'تعذّر إكمال الطلب. حدّث القائمة ثم حاول مجددًا.'},502);}
}
export const GET=handle;
export const POST=handle;

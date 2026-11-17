import {createClient} from 'npm:@supabase/supabase-js@2.119.0';
import {inviteMember} from './core.ts';

Deno.serve(async(request:Request)=>{
 const url=Deno.env.get('SUPABASE_URL')!;
 const user=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{
  global:{headers:{Authorization:request.headers.get('authorization')??''}},
  auth:{persistSession:false,autoRefreshToken:false}});
 const admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
 // Reuse the already configured recovery callback allowlist; token type remains invite.
 const redirectTo='https://1-mohamed.vercel.app/auth/callback?flow=recovery';
 async function rpc(name:string,args?:Record<string,unknown>){const r=await user.rpc(name,args);if(r.error)throw r.error;return r.data;}
 return inviteMember(request,{
  isOwner:async()=>{const r=await user.auth.getUser();return !r.error&&!!r.data.user&&(await rpc('app_is_owner'))===true;},
  findTarget:email=>rpc('app_member_target',{p_email:email}),
  isActive:async id=>{
   const owner=await user.auth.getUser();if(owner.data.user?.id===id)return true;
   const r=await user.from('app_members').select('is_active').eq('user_id',id).maybeSingle();if(r.error)throw r.error;return r.data?.is_active===true;
  },
  invite:async email=>{const r=await admin.auth.admin.inviteUserByEmail(email,{redirectTo});if(r.error||!r.data.user)throw r.error;return r.data.user.id;},
  grant:async(id,email)=>{await rpc('app_member_grant',{p_user_id:id,p_email:email});},
  generate:async(email,existing)=>{
   const r=await admin.auth.admin.generateLink({type:existing?'recovery':'invite',email,options:{redirectTo}});
   if(r.error||!r.data.user||!r.data.properties?.action_link)throw r.error;
   return {id:r.data.user.id,url:r.data.properties.action_link};
  },
  recovery:async email=>{const r=await user.auth.resetPasswordForEmail(email,{redirectTo});if(r.error)throw r.error;},
 });
});

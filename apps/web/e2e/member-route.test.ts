import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {NextRequest} from 'next/server';
const state=vi.hoisted(()=>({authorized:true,owner:true,rpc:vi.fn(),invoke:vi.fn(),from:vi.fn()}));
vi.mock('../src/lib/supabase/owner',()=>({verifyOwnerForRoute:async()=>({authorized:state.authorized})}));
vi.mock('../src/lib/supabase/server',()=>({createRouteHandlerSupabaseClient:()=>({rpc:state.rpc,functions:{invoke:state.invoke},from:state.from})}));
import {GET,POST} from '../src/app/api/auth/members/route';
beforeEach(()=>{
 vi.resetAllMocks();state.authorized=true;state.owner=true;
 state.rpc.mockImplementation(async name=>({data:name==='app_is_owner'?state.owner:null,error:null}));
 state.invoke.mockResolvedValue({data:{ok:true,message:'Invitation sent'},error:null});
 vi.stubEnv('APP_ENABLE_REAL_DATA','true');vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://fixture.supabase.co');
 vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','fixture');vi.stubEnv('NEXT_PUBLIC_SITE_URL','https://fixture.test');
});
afterEach(()=>vi.unstubAllEnvs());
const post=(body:object={action:'invite',email:'member@example.com'},origin='https://fixture.test')=>new NextRequest('https://fixture.test/api/auth/members',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
it('invites only through the authorized server function',async()=>{
 expect((await POST(post())).status).toBe(200);
 expect(state.invoke).toHaveBeenCalledWith('invite-member',{body:{email:'member@example.com',resend:false,mode:'email'}});
});
it.each(['anon','member','disabled','cross-origin','invalid-email'])('denies %s without sending email',async kind=>{
 if(kind==='anon')state.authorized=false;if(kind==='member')state.owner=false;if(kind==='disabled')vi.stubEnv('APP_ENABLE_REAL_DATA','false');
 const r=await POST(post(kind==='invalid-email'?{action:'invite',email:'bad'}:undefined,kind==='cross-origin'?'https://evil.test':undefined));
 expect(r.status).toBeGreaterThanOrEqual(400);expect(state.invoke).not.toHaveBeenCalled();
});
it('ordinary members receive no membership list or invitation controls',async()=>{
 state.owner=false;const r=await GET(new NextRequest('https://fixture.test/api/auth/members'));
 expect(await r.json()).toEqual({isOwner:false,members:[]});expect(state.from).not.toHaveBeenCalled();
});
it('revokes via strict owner-gated SQL rather than deleting an Auth user',async()=>{
 const id='00000000-0000-0000-0000-000000000003';expect((await POST(post({action:'revoke',userId:id}))).status).toBe(200);
 expect(state.rpc).toHaveBeenCalledWith('app_member_revoke',{p_user_id:id});expect(state.invoke).not.toHaveBeenCalled();
});

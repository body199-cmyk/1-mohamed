import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {NextRequest} from 'next/server';
import {isDeletionScope,isDeletionRequest,isDeletionPreview} from '../src/lib/ledger/deletion-contract';
const mock=vi.hoisted(()=>({owner:vi.fn(),getUser:vi.fn(),rpc:vi.fn(),password:vi.fn(),purge:vi.fn(),signOut:vi.fn()}));
vi.mock('../src/lib/supabase/server',()=>({createRouteHandlerSupabaseClient:()=>({auth:{getUser:mock.getUser},rpc:mock.rpc})}));
vi.mock('../src/lib/supabase/owner',()=>({verifyOwnerForRoute:mock.owner}));
vi.mock('../src/lib/ledger/password-confirmation',()=>({createPasswordConfirmationClient:()=>({auth:{signInWithPassword:mock.password,signOut:mock.signOut},rpc:mock.purge})}));
import {POST} from '../src/app/api/ledger/purge/route';
const challenge='10000000-0000-0000-0000-000000000001';
const input={action:'execute',challenge_id:challenge,confirmation:'احذف كل البيانات',password:'fixture-only-password'};
const req=(body:unknown,origin='https://1-mohamed.vercel.app')=>new NextRequest('https://1-mohamed.vercel.app/api/ledger/purge',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
beforeEach(()=>{
 vi.resetAllMocks();vi.stubEnv('APP_ENABLE_REAL_DATA','true');vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://fixture.supabase.co');
 vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','public-fixture');vi.stubEnv('NEXT_PUBLIC_SITE_URL','https://1-mohamed.vercel.app');
 mock.owner.mockResolvedValue({authorized:true,userId:'owner'});mock.getUser.mockResolvedValue({data:{user:{id:'owner',email:'owner@example.test'}},error:null});
 mock.password.mockResolvedValue({data:{user:{id:'owner'}},error:null});mock.signOut.mockResolvedValue({error:null});
 mock.rpc.mockResolvedValue({data:{status:'OK',challenge_id:challenge},error:null});mock.purge.mockResolvedValue({data:{status:'OK',challenge_id:challenge},error:null});
});afterEach(()=>vi.unstubAllEnvs());
it.each([{mode:'ALL',vehicle_id:'V1'},{mode:'VEHICLE',vehicle_id:''},{mode:'PERIOD',from:'2026-02-30',to:'2026-03-01'},{mode:'PERIOD',from:'2026-04-01',to:'2026-03-01'}])('rejects malformed/ambiguous scope %j',scope=>expect(isDeletionScope(scope)).toBe(false));
it('does not accept caller-supplied email or unconfirmed execute requests',()=>{
 expect(isDeletionRequest({...input,email:'attacker@example.test'})).toBe(false);
 expect(isDeletionRequest({...input,confirmation:'yes'})).toBe(false);
});
it('refuses misleading preview counts or missing challenge/expiry proof',()=>{
 const p={status:'OK',counts:{trips:1,payments:0,openings:0,vehicles:0,contractors:0,accounts:0},blocked:null,confirmation:'احذف كل البيانات',challenge_id:challenge,expires_at:new Date(Date.now()+600000).toISOString()};
 expect(isDeletionPreview(p)).toBe(true);
 expect(isDeletionPreview({...p,counts:{...p.counts,trips:-1}})).toBe(false);
 expect(isDeletionPreview({...p,challenge_id:'-'.repeat(36)})).toBe(false);
 expect(isDeletionPreview({...p,expires_at:'invalid'})).toBe(false);
});
it('rejects cross-origin calls before any authentication or database use',async()=>{
 expect((await POST(req(input,'https://evil.test'))).status).toBe(403);expect(mock.owner).not.toHaveBeenCalled();expect(mock.purge).not.toHaveBeenCalled();
});
it('blocks direct handler activation when production flag is disabled',async()=>{
 vi.stubEnv('APP_ENABLE_REAL_DATA','false');expect((await POST(req(input))).status).toBe(503);expect(mock.password).not.toHaveBeenCalled();
});
it('blocks non-owner and revoked original sessions',async()=>{
 mock.owner.mockResolvedValueOnce({authorized:false});expect((await POST(req(input))).status).toBe(401);
 mock.getUser.mockResolvedValueOnce({data:{user:null},error:{message:'revoked'}});expect((await POST(req(input))).status).toBe(401);expect(mock.password).not.toHaveBeenCalled();
});
it('preview never checks a password or executes deletion',async()=>{
 const r=await POST(req({action:'preview',scope:{mode:'VEHICLE',vehicle_id:'V1'}}));
 expect(r.status).toBe(200);expect(r.headers.get('cache-control')).toBe('no-store');
 expect(mock.rpc).toHaveBeenCalledWith('app_op_data_purge_preview',{p_payload:{mode:'VEHICLE',vehicle_id:'V1'}});
 expect(mock.password).not.toHaveBeenCalled();expect(mock.purge).not.toHaveBeenCalled();
});
it('wrong password never calls deletion; no secret is echoed',async()=>{
 mock.password.mockResolvedValue({data:{user:null},error:{message:input.password}});
 const r=await POST(req(input));expect(r.status).toBe(401);expect(await r.text()).not.toContain(input.password);
 expect(mock.purge).not.toHaveBeenCalled();expect(mock.signOut).toHaveBeenCalledWith({scope:'local'});
});
it('the password-authenticated user must match the original owner',async()=>{
 mock.password.mockResolvedValue({data:{user:{id:'other'}},error:null});expect((await POST(req(input))).status).toBe(401);expect(mock.purge).not.toHaveBeenCalled();
});
it('only the temporary password session executes, without sending password into SQL',async()=>{
 const r=await POST(req(input));expect(r.status).toBe(200);expect(mock.password).toHaveBeenCalledWith({email:'owner@example.test',password:input.password});
 expect(mock.rpc).not.toHaveBeenCalled();expect(mock.purge).toHaveBeenCalledWith('app_op_data_purge_execute',{p_payload:{challenge_id:challenge,confirmation:input.confirmation}});
 expect(mock.signOut).toHaveBeenCalledWith({scope:'local'});expect(await r.text()).not.toContain(input.password);
});
it('stale preview returns a safe conflict without database details',async()=>{
 mock.purge.mockResolvedValue({data:null,error:{code:'P2007',message:'internal financial data'}});
 const r=await POST(req(input));expect(r.status).toBe(409);expect(await r.json()).toMatchObject({refreshPreview:true});expect(mock.signOut).toHaveBeenCalledWith({scope:'local'});
});
it('oversized passwords and bodies cannot reach Auth',async()=>{
 expect((await POST(req({...input,password:'x'.repeat(1025)}))).status).toBe(400);
 expect((await POST(req({...input,password:'x'.repeat(9000)}))).status).toBe(413);expect(mock.password).not.toHaveBeenCalled();
});

import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {NextRequest} from 'next/server';
import {loginCookieOptions,remembersLogin} from '../src/lib/supabase/remember';
const boundary=vi.hoisted(()=>({verifyOtp:vi.fn(),exchangeCodeForSession:vi.fn(),signInWithPassword:vi.fn(),signOut:vi.fn(),rpc:vi.fn()}));
vi.mock('../src/lib/supabase/server',()=>({createRouteHandlerSupabaseClient:()=>({auth:boundary,rpc:boundary.rpc})}));
import {GET} from '../src/app/auth/callback/route';
import {POST as ownerLogin} from '../src/app/api/auth/login/route';
beforeEach(()=>{
 vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://fixture.supabase.co');
 vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','public-fixture');
 vi.stubEnv('NEXT_PUBLIC_SITE_URL','https://1-mohamed.vercel.app');
 vi.resetAllMocks();boundary.verifyOtp.mockResolvedValue({error:null});
 boundary.exchangeCodeForSession.mockResolvedValue({error:null});
 boundary.signInWithPassword.mockResolvedValue({error:null});boundary.signOut.mockResolvedValue({error:null});
 boundary.rpc.mockResolvedValue({data:true,error:null});
 vi.stubEnv('OWNER_LOGIN_USERNAME','1234');vi.stubEnv('OWNER_LOGIN_EMAIL','owner@example.test');
});
afterEach(()=>vi.unstubAllEnvs());
it('recovery redirects to the configured public site, never the internal localhost or supplied next URL',async()=>{
 const r=await GET(new NextRequest('http://localhost:3000/auth/callback?token_hash=fixture&type=recovery&next=https://evil.test'));
 expect(r.headers.get('location')).toBe('https://1-mohamed.vercel.app/auth/reset');
 expect(r.headers.get('cache-control')).toBe('no-store');
 expect(boundary.verifyOtp).toHaveBeenCalledWith({token_hash:'fixture',type:'recovery'});
});
it('default email recovery preserves browser-only fragment through a no-store landing redirect',async()=>{
 const r=await GET(new NextRequest('http://localhost/auth/callback?flow=recovery'));
 expect(r.headers.get('location')).toBe('https://1-mohamed.vercel.app/auth/reset');
 expect(r.headers.get('referrer-policy')).toBe('no-referrer');
 expect(boundary.verifyOtp).not.toHaveBeenCalled();
});
it.each(['missing','expired','nonowner'])('rejects %s recovery without exposing a password form session',async kind=>{
 if(kind==='expired')boundary.verifyOtp.mockResolvedValue({error:{code:'otp_expired'}});
 if(kind==='nonowner')boundary.rpc.mockResolvedValue({data:false,error:null});
 const r=await GET(new NextRequest('http://localhost/auth/callback'+(kind==='missing'?'':'?token_hash=fixture&type=recovery')));
 expect(r.headers.get('location')).toBe('https://1-mohamed.vercel.app/login?error=recovery');
 expect(r.headers.get('cache-control')).toBe('no-store');
 if(kind==='nonowner')expect(boundary.signOut).toHaveBeenCalled();
});
it('PKCE links retain compatibility and still require the owner',async()=>{
 const r=await GET(new NextRequest('http://localhost/auth/callback?code=fixture&flow=recovery'));
 expect(boundary.exchangeCodeForSession).toHaveBeenCalledWith('fixture');
 expect(r.headers.get('location')).toBe('https://1-mohamed.vercel.app/auth/reset');
});
it('remember selection changes session persistence but never interferes with cookie deletion',()=>{
 expect(remembersLogin([])).toBe(false);
 expect(remembersLogin([{name:'ledger-remember',value:'1'}])).toBe(true);
 expect(loginCookieOptions({path:'/',maxAge:99999,expires:new Date('2030-01-01')},false)).toEqual({path:'/'});
 expect(loginCookieOptions({path:'/',maxAge:99999},true).maxAge).toBe(2592000);
 expect(loginCookieOptions({path:'/',maxAge:0},true)).toEqual({path:'/',maxAge:0});
});


it('maps the configured owner username to the verified Auth email and issues only an owner session',async()=>{
 vi.stubEnv('APP_ENABLE_REAL_DATA','true');
 const request=new NextRequest('https://1-mohamed.vercel.app/api/auth/login',{
  method:'POST',headers:{origin:'https://1-mohamed.vercel.app','content-type':'application/json'},
  body:JSON.stringify({identifier:'1234',password:'1234'})
 });
 const response=await ownerLogin(request);
 expect(response.status).toBe(200);
 expect(response.headers.get('cache-control')).toBe('no-store');
 expect(boundary.signInWithPassword).toHaveBeenCalledWith({email:'owner@example.test',password:'1234'});
 expect(boundary.rpc).toHaveBeenCalledWith('app_has_access');
});

it('does not authenticate arbitrary identifiers or issue a session to a non-owner',async()=>{
 vi.stubEnv('APP_ENABLE_REAL_DATA','true');
 const wrong=new NextRequest('https://1-mohamed.vercel.app/api/auth/login',{
  method:'POST',headers:{origin:'https://1-mohamed.vercel.app','content-type':'application/json'},
  body:JSON.stringify({identifier:'not-the-owner',password:'1234'})
 });
 const denied=await ownerLogin(wrong);
 expect(denied.status).toBe(401);
 expect(boundary.signInWithPassword).not.toHaveBeenCalled();

 boundary.rpc.mockResolvedValue({data:false,error:null});
 const nonOwner=new NextRequest('https://1-mohamed.vercel.app/api/auth/login',{
  method:'POST',headers:{origin:'https://1-mohamed.vercel.app','content-type':'application/json'},
  body:JSON.stringify({identifier:'1234',password:'1234'})
 });
 const rejected=await ownerLogin(nonOwner);
 expect(rejected.status).toBe(401);
 expect(boundary.signOut).toHaveBeenCalled();
});

it('rejects cross-site login requests and stays closed when production auth is disabled',async()=>{
 vi.stubEnv('APP_ENABLE_REAL_DATA','true');
 const crossSite=new NextRequest('https://1-mohamed.vercel.app/api/auth/login',{
  method:'POST',headers:{origin:'https://attacker.example','content-type':'application/json'},
  body:JSON.stringify({identifier:'1234',password:'1234'})
 });
 expect((await ownerLogin(crossSite)).status).toBe(403);
 expect(boundary.signInWithPassword).not.toHaveBeenCalled();
 vi.stubEnv('APP_ENABLE_REAL_DATA','false');
 const disabled=new NextRequest('https://1-mohamed.vercel.app/api/auth/login',{
  method:'POST',headers:{origin:'https://1-mohamed.vercel.app','content-type':'application/json'},
  body:JSON.stringify({identifier:'1234',password:'1234'})
 });
 expect((await ownerLogin(disabled)).status).toBe(503);
});

it('invitation links open password setup and still verify approved membership',async()=>{
 const landing=await GET(new NextRequest('http://localhost/auth/callback?flow=invite'));
 expect(landing.headers.get('location')).toBe('https://1-mohamed.vercel.app/auth/reset');
 const verified=await GET(new NextRequest('http://localhost/auth/callback?token_hash=fixture&type=invite'));
 expect(verified.headers.get('location')).toBe('https://1-mohamed.vercel.app/auth/reset');
 expect(boundary.verifyOtp).toHaveBeenCalledWith({token_hash:'fixture',type:'invite'});
 expect(boundary.rpc).toHaveBeenCalledWith('app_has_access');
});

it('allows an approved invited email login but denies the same email after membership revocation',async()=>{
 vi.stubEnv('APP_ENABLE_REAL_DATA','true');
 const request=()=>new NextRequest('https://1-mohamed.vercel.app/api/auth/login',{method:'POST',headers:{origin:'https://1-mohamed.vercel.app'},body:JSON.stringify({identifier:'member@example.test',password:'fixture-password'})});
 expect((await ownerLogin(request())).status).toBe(200);
 expect(boundary.signInWithPassword).toHaveBeenCalledWith({email:'member@example.test',password:'fixture-password'});
 boundary.rpc.mockResolvedValue({data:false,error:null});
 expect((await ownerLogin(request())).status).toBe(401);
 expect(boundary.signOut).toHaveBeenCalled();
});

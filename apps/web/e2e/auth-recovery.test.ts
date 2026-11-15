import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {NextRequest} from 'next/server';
import {loginCookieOptions,remembersLogin} from '../src/lib/supabase/remember';
const boundary=vi.hoisted(()=>({verifyOtp:vi.fn(),exchangeCodeForSession:vi.fn(),signOut:vi.fn(),rpc:vi.fn()}));
vi.mock('../src/lib/supabase/server',()=>({createRouteHandlerSupabaseClient:()=>({auth:boundary,rpc:boundary.rpc})}));
import {GET} from '../src/app/auth/callback/route';
beforeEach(()=>{
 vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://fixture.supabase.co');
 vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','public-fixture');
 vi.stubEnv('NEXT_PUBLIC_SITE_URL','https://1-mohamed.vercel.app');
 vi.resetAllMocks();boundary.verifyOtp.mockResolvedValue({error:null});
 boundary.exchangeCodeForSession.mockResolvedValue({error:null});boundary.rpc.mockResolvedValue({data:true,error:null});
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

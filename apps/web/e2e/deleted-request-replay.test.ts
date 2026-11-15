import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import {NextRequest} from 'next/server';
const mock=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock('../src/lib/supabase/server',()=>({createRouteHandlerSupabaseClient:()=>({rpc:mock.rpc})}));
vi.mock('../src/lib/supabase/owner',()=>({verifyOwnerForRoute:async()=>({authorized:true,userId:'owner'})}));
import {POST} from '../src/app/api/ledger/operations/route';
const request=(operation:string)=>new NextRequest('https://1-mohamed.vercel.app/api/ledger/operations',{method:'POST',headers:{origin:'https://1-mohamed.vercel.app'},body:JSON.stringify({operation,requestKey:'10000000-0000-0000-0000-000000000001',payload:{id:'old-id'}})});
beforeEach(()=>{vi.resetAllMocks();vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://fixture.supabase.co');vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','public-fixture');vi.stubEnv('NEXT_PUBLIC_SITE_URL','https://1-mohamed.vercel.app');});
afterEach(()=>vi.unstubAllEnvs());
it('an old tab retry after deletion receives a clear conflict, never success',async()=>{
 mock.rpc.mockResolvedValue({data:null,error:{code:'P2005',message:'internal'}});
 const response=await POST(request('trip.create'));expect(response.status).toBe(409);expect(await response.text()).toContain('اتحذف نهائيًا');
});
it('ordinary write endpoint cannot invoke either destructive-maintenance RPC',async()=>{
 for(const operation of ['data.purge','app_op_data_purge_execute'])expect((await POST(request(operation))).status).toBe(400);
 expect(mock.rpc).not.toHaveBeenCalled();
});

/** Test-only real PostgreSQL engine. No hosted URL, Auth credentials or production access.
 * Actual workspace HTTP requests are bridged to existing audited SQL RPCs by Playwright.
 * This proves UI payload → SQL → persisted readback, not Next.js/GoTrue/PostgREST deployment. */
import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
import type {Page} from '@playwright/test';
import {isWriteOperation,isReadOperation,validRequestKey,WRITE_OPERATIONS} from '../../../apps/web/src/lib/ledger/operation-contract.ts';
export const OWNER='00000000-0000-0000-0000-000000000001';
export async function createSqlLedger(){
 const db=new PGlite();
 await db.exec(await readFile('supabase/tests/00_isolated_harness.sql','utf8'));
 for(const name of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile('supabase/migrations/'+name,'utf8'));
 await db.query('select public.app_set_initial_owner($1::uuid)',[OWNER]);
 await db.exec("insert into public.contractors(id,name,is_primary) values('K_AHMED','أحمد',true)");
 async function asUser<T>(run:(tx:Pick<PGlite,'query'|'exec'>)=>Promise<T>,user=OWNER){
  return db.transaction(async tx=>{
   await tx.exec('set local role authenticated');await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[user]);
   return run(tx);
  });
 }
 async function write(operation:string,payload:Record<string,unknown>,key=crypto.randomUUID(),user=OWNER){
  if(!isWriteOperation(operation)||!validRequestKey(key))throw new Error('Invalid fixture operation');
  return asUser(async tx=>(await tx.query<{data:Record<string,unknown>}>(`select public.${WRITE_OPERATIONS[operation]}($1,$2::jsonb) as data`,[key,JSON.stringify(payload)])).rows[0].data,user);
 }
 async function read(operation:string,payload:Record<string,unknown>,user=OWNER){
  if(!isReadOperation(operation))throw new Error('Invalid fixture reader');
  return asUser(async tx=>(await tx.query<{data:Record<string,unknown>}>('select public.app_op_report_read($1,$2::jsonb) as data',[operation,JSON.stringify(payload)])).rows[0].data,user);
 }
 async function rows(sql:string,params:unknown[]=[]){return (await db.query<Record<string,unknown>>(sql,params)).rows;}
 async function connect(page:Page){
  const state={user:OWNER,attempts:[] as Record<string,unknown>[],loseNextTripResponse:false,loseNextOpeningResponse:false};
  await page.route('**/api/ledger/master?**',async route=>{
   try{
    const url=new URL(route.request().url()),kind=url.searchParams.get('type');
    if(!['contractors','vehicles','vehicle_accounts'].includes(kind??''))throw new Error('Invalid master');
    const order=kind==='vehicle_accounts'?'vehicle_id,contractor_id':'id';
    const data=await asUser(async tx=>(await tx.query(`select * from public.${kind} order by ${order} limit $1 offset $2`,[201,Number(url.searchParams.get('offset')??0)])).rows,state.user);
    await route.fulfill({json:{ok:true,data:data.slice(0,200),hasMore:data.length>200}});
   }catch{await route.fulfill({status:401,json:{error:'غير مصرح بالدخول.'}});}
  });
  await page.route('**/api/ledger/operations',async route=>{
   const body=route.request().postDataJSON();state.attempts.push(body);
   try{
    const data=await write(body.operation,body.payload,body.requestKey,state.user);
    if(body.operation==='trip.create'&&state.loseNextTripResponse){state.loseNextTripResponse=false;return route.abort('failed');}
    if(body.operation==='opening.create'&&state.loseNextOpeningResponse){state.loseNextOpeningResponse=false;return route.abort('failed');}
    await route.fulfill({json:{ok:true,data}});
   }catch(error){await route.fulfill({status:422,json:{error:'تعذر حفظ العملية. راجع المدخلات ثم حاول مرة أخرى بنفس مفتاح الطلب.'}});}
  });
  await page.route('**/api/ledger/read',async route=>{
   try{const b=route.request().postDataJSON();await route.fulfill({json:{ok:true,data:await read(b.operation,b.payload,state.user)}});}
   catch{await route.fulfill({status:422,json:{error:'تعذّر تحميل البيانات المطلوبة.'}});}
  });
  return state;
 }
 await write('contractor.create',{id:'C1',name:'شركة النور',start_mode:'DETAILS'});
 await write('contractor.create',{id:'C2',name:'شركة ثانية',start_mode:'DETAILS'});
 await write('vehicle.create',{id:'V1',plate_number:'عربية ١',driver_name:'سائق تجريبي',contractor_id:'K_AHMED'});
 await write('vehicle.create',{id:'V2',plate_number:'عربية ٢',contractor_id:'K_AHMED'});
 await write('opening.create',{id:'OPEN-V1',balance_type:'VEHICLE_CASH',vehicle_id:'V1',contractor_id:'K_AHMED',start_date:'2026-11-01',signed_piastres:100000,start_mode:'TOTAL'});
 return {db,write,read,rows,connect};
}

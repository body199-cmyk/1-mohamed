import { PGlite } from '@electric-sql/pglite';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { BUSINESS_TABLES } from './business-snapshot.mjs';
import { restoreEmptyLedger } from './business-restore.mjs';

export async function proveBusinessRecovery(archive){
 const dir=mkdtempSync(join(tmpdir(),'plain-replay-'));
 const db=new PGlite();
 try{
  const script=fileURLToPath(new URL('./extract-business.py',import.meta.url));
  const check=spawnSync('python3',[script,archive,dir,'manifest.json',...BUSINESS_TABLES.map(t=>t+'.json')],{stdio:'ignore',timeout:120000});
  if(check.status!==0)throw Error('Recovery drill could not extract the verified archive');
  await db.exec(readFileSync(new URL('../../supabase/tests/00_isolated_harness.sql',import.meta.url),'utf8'));
  const migrations=new URL('../../supabase/migrations/',import.meta.url);
  for(const name of readdirSync(migrations).filter(n=>n.endsWith('.sql')).sort()){
   await db.exec(readFileSync(new URL(name,migrations),'utf8'));
  }
  const result=await restoreEmptyLedger(db,dir);
  await db.exec(`select public.app_set_initial_owner('00000000-0000-0000-0000-000000000001');
    select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
    set role authenticated;
    select public.app_member_grant('00000000-0000-0000-0000-000000000002','stranger@test.invalid');`);
  await db.exec("select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false)");
  const member=(await db.query('select public.app_has_access() and not public.app_is_owner() as accessible')).rows[0];
  if(!member.accessible)throw Error('Reactivated test member cannot access the restored ledger');
  return { ...result,reactivatedFixture:true };
 }finally{await db.close().catch(()=>{});rmSync(dir,{recursive:true,force:true});}
}

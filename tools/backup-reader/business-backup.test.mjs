import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, writeFile, rm, appendFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { BUSINESS_TABLES, loadBusinessSnapshot, writeBusinessSnapshot, readRowsSql, digest } from './business-snapshot.mjs';
import { recoveryTarget, restoreEmptyLedger } from './business-restore.mjs';
import { SOURCE_REF } from './contract.mjs';
import { filesToPrune } from '../offsite-backup.mjs';
import { isManagedBackupPath } from '../google-drive-rclone.mjs';

const migrations=new URL('../../supabase/migrations/',import.meta.url);
async function database(){
 const db=new PGlite();
 await db.exec(await readFile(new URL('../../supabase/tests/00_isolated_harness.sql',import.meta.url),'utf8'));
 for(const name of (await readdir(migrations)).filter(n=>n.endsWith('.sql')).sort()){
  await db.exec(await readFile(new URL(name,migrations),'utf8'));
 }
 return db;
}

test('plain snapshot restores business data, never Auth, and fails closed on tampering or a populated target',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'business-backup-test-'));
 let source=await database();
 let target;
 try{
  await source.exec(`insert into public.contractors(id,name,is_primary) values ('k1','مقاول',true);
    insert into public.vehicles(id,plate_number) values ('v1','00042');
    insert into public.vehicle_accounts(vehicle_id,contractor_id) values ('v1','k1');
    insert into public.trips(id,vehicle_id,counterparty_contractor_id,responsible_contractor_id,direction,trip_date,
      weight_milli_tonnes,contractor_rate_piastres,vehicle_rate_piastres,expense_piastres,contractor_total_piastres,vehicle_total_piastres)
      values ('t1','v1','k1','k1','AHMED_SUPPLIES','2026-11-18',1000,50000,50000,0,50000,50000);
    insert into public.payments(id,vehicle_id,responsible_contractor_id,payment_date,amount_piastres,linked_trip_id,receipt_number)
      values ('p1','v1','k1','2026-11-18',9007199254741000,'t1','=1+1');
    insert into public.contractors(id,name) values ('k2','المقاول المصحح');
    insert into public.vehicle_accounts(vehicle_id,contractor_id) values ('v1','k2');
    update public.trips set counterparty_contractor_id='k2', responsible_contractor_id='k2',
      direction='OTHER_SUPPLIES' where id='t1';
    -- A valid historical trip predates a later TOTAL contractor-work cutover.
    insert into public.opening_balances(id,balance_type,contractor_id,start_date,signed_piastres)
      values ('k2_open','CONTRACTOR_WORK','k2','2026-11-19',1500);
    update public.business_settings set business_name='Recovered' where id='default';
    insert into public.audit_log(id,entity_type,entity_id,action,performed_by) overriding system value
      values (42,'TRIP','t1','INSERT','00000000-0000-0000-0000-000000000001');
    insert into public.idempotency_keys(key,user_id,operation,payload_hash,status) values
      ('Z-key','00000000-0000-0000-0000-000000000001','TRIP','hash1','COMPLETED'),
      ('a_key','00000000-0000-0000-0000-000000000001','TRIP','hash2','COMPLETED');`);
  await source.exec("set timezone='UTC'");
  await writeBusinessSnapshot(source,dir,{date:'2026-11-18',commit:'a'.repeat(40)});
  await source.close();
  source=null;
  assert.deepEqual((await readdir(dir)).sort(),['manifest.json',...BUSINESS_TABLES.map(x=>x+'.json')].sort());
  assert.match(loadBusinessSnapshot(dir).payloads.get('payments'),/9007199254741000/);
  assert.deepEqual(JSON.parse(loadBusinessSnapshot(dir).payloads.get('idempotency_keys')).map(x=>x.key),['Z-key','a_key']);
  const python=process.env.BACKUP_TEST_PYTHON||'python3', xlsx=join(dir,'report.xlsx');
  const workbook=spawnSync(python,[fileURLToPath(new URL('./business-xlsx.py',import.meta.url)),dir,xlsx],{encoding:'utf8'});
  assert.equal(workbook.status,0,workbook.stderr||workbook.error?.message);
  const verify=spawnSync(python,['-c',`import sys, zipfile, xml.etree.ElementTree as E
with zipfile.ZipFile(sys.argv[1]) as z:
 root=E.fromstring(z.read('xl/workbook.xml'))
 assert len(root.findall('.//{*}sheet'))==5
 sheet=E.fromstring(z.read('xl/worksheets/sheet2.xml'))
 assert not sheet.findall('.//{*}f')
 assert '=1+1' in [x.text for x in sheet.findall('.//{*}t')]
 assert '00042' in [x.text for x in sheet.findall('.//{*}t')]
 assert all('auth' not in k.lower() for k in z.namelist())
`,xlsx],{encoding:'utf8'});
  assert.equal(verify.status,0,verify.stderr);
  target=await database();
  const brokenLoad={query:(sql,args)=>sql.startsWith('insert into public.payments ')
    ? target.query(sql,[args[0].replace('"linked_trip_id": "t1"','"linked_trip_id": "missing"')])
    : target.query(sql,args)};
  await assert.rejects(restoreEmptyLedger(brokenLoad,dir),{code:'23503'});
  const rolledBack=await target.query(`select tgenabled, (select count(*)::int from public.trips) as trips
    from pg_trigger where tgrelid='public.payments'::regclass and tgname='trg_payments_trip_link_guard'`);
  assert.deepEqual(rolledBack.rows,[{tgenabled:'O',trips:0}]);
  assert.equal((await target.query(`select tgenabled from pg_trigger
    where tgrelid='public.trips'::regclass and tgname='trg_trip_new_work_opening'`)).rows[0].tgenabled,'O');

  assert.deepEqual(await restoreEmptyLedger(target,dir),{restoredTables:9,exactMatch:true});
  assert.equal((await target.query(`select tgenabled from pg_trigger
    where tgrelid='public.trips'::regclass and tgname='trg_trip_new_work_opening'`)).rows[0].tgenabled,'O');
  assert.deepEqual((await target.query(`select t.trip_date::text as historical_date,o.start_date::text as opening_date
    from public.trips t join public.opening_balances o
      on o.contractor_id=t.counterparty_contractor_id
    where t.id='t1' and o.id='k2_open'`)).rows,
    [{historical_date:'2026-11-18',opening_date:'2026-11-19'}]);
  await assert.rejects(target.query(`insert into public.trips(
    id,vehicle_id,counterparty_contractor_id,responsible_contractor_id,
    direction,trip_date,weight_milli_tonnes,contractor_rate_piastres,
    vehicle_rate_piastres,same_rate,expense_piastres,
    contractor_total_piastres,vehicle_total_piastres
  ) values ('t1_backdated','v1','k2','k2','OTHER_SUPPLIES','2026-11-18',
    1000,10000,8000,false,0,10000,8000)`),{code:'P2021'});
  const result=(await target.query("select amount_piastres::text as amount from public.payments where id='p1'")).rows[0];
  assert.equal(result.amount,'9007199254741000');
  const link=await target.query(`select p.responsible_contractor_id as paid_by, t.responsible_contractor_id as work_by
    from public.payments p join public.trips t on t.id=p.linked_trip_id where p.id='p1'`);
  assert.deepEqual(link.rows,[{paid_by:'k1', work_by:'k2'}]);
  await assert.rejects(target.query(`insert into public.payments(id,vehicle_id,responsible_contractor_id,payment_date,amount_piastres,linked_trip_id)
    values ('mislinked','v1','k1','2026-11-18',100,'t1')`),{code:'23514'});
  assert.equal((await target.query('select count(*)::int as n from auth.users')).rows[0].n,2);
  assert.equal((await target.query("select nextval(pg_get_serial_sequence('public.audit_log','id'))::int as id")).rows[0].id,43);
  await target.query(`insert into public.backup_history (backup_date,format,file_name,drive_file_id,size_bytes,sha256,table_counts)
    values ('2026-11-18','1-mohamed-business-recovery-v1','test','test',1,$1,'{}')`,['a'.repeat(64)]);
  await assert.rejects(restoreEmptyLedger(target,dir),/not empty/);
  await appendFile(join(dir,'payments.json'),' ');
  await assert.rejects(restoreEmptyLedger(target,dir),/checksum mismatch/);
 }finally{
  await target?.close().catch(()=>{});
  await source?.close().catch(()=>{});
  await rm(dir,{recursive:true,force:true});
 }
});

test('recovery connection refuses production and unbound host or identity',()=>{
 const ref='a'.repeat(20);
 const url=`postgresql://postgres.${ref}:fixture@aws-1-eu-central-1.pooler.supabase.com:5432/postgres`;
 assert.equal(recoveryTarget(ref,url,'ca').ssl.rejectUnauthorized,true);
 assert.throws(()=>recoveryTarget(SOURCE_REF,url,'ca'),/separate/);
 assert.throws(()=>recoveryTarget(ref,url.replace(ref,SOURCE_REF),'ca'),/bind/);
 assert.throws(()=>recoveryTarget(ref,url.replace('pooler.supabase.com','example.test'),'ca'),/bind/);
});

test('30 Cairo days include today and restrict deletion to exact managed folders and names',()=>{
 const files=[
  {name:'1-mohamed-2026-10-19-restore.tar.gz',path:'2026/10 - October/1-mohamed-2026-10-19-restore.tar.gz'},
  {name:'1-mohamed-2026-10-19-excel.xlsx',path:'2026/10 - October/1-mohamed-2026-10-19-excel.xlsx'},
  {name:'1-mohamed-2026-10-19.tar.gz.age',path:'2026/10 - October/1-mohamed-2026-10-19.tar.gz.age'},
  {name:'1-mohamed-2026-10-20-excel.xlsx',path:'2026/10 - October/1-mohamed-2026-10-20-excel.xlsx'},
  {name:'1-mohamed-2026-10-19-excel.xlsx',path:'_restore-drill/1-mohamed-2026-10-19-excel.xlsx'},
  {name:'personal.xlsx',path:'2026/10 - October/personal.xlsx'},
 ];
 assert.deepEqual(filesToPrune(files.filter(f=>isManagedBackupPath(f.path,f.name)),'2026-11-18'),files.slice(0,3));
});

test('pre-policy nine-table archive restores without reinterpreting its opening amount',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'legacy-opening-'));
 let source, target;
 try{
  source=await database();
  await source.exec(`insert into public.contractors(id,name) values ('legacy-k','Legacy');
    insert into public.opening_balances(id,balance_type,contractor_id,start_date,signed_piastres)
    values ('legacy-opening','CONTRACTOR_WORK','legacy-k','2026-11-01',15000);`);
  const oldProjection=(await source.query(readRowsSql('opening_balances',{legacyOpening:true}))).rows[0].rows;
  const manifest=await writeBusinessSnapshot(source,dir,{date:'2026-11-18',commit:'a'.repeat(40)});
  // Simulate the exact legacy field set and recalculate its trusted manifest hash.
  await writeFile(join(dir,'opening_balances.json'),oldProjection);
  manifest.tables.opening_balances.sha256=digest(oldProjection);
  await writeFile(join(dir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  target=await database();
  assert.deepEqual(await restoreEmptyLedger(target,dir),{restoredTables:9,exactMatch:true});
  const opening=await target.query(`select signed_piastres::text as amount, prior_work_handling as policy
    from public.opening_balances where id='legacy-opening'`);
  assert.deepEqual(opening.rows,[{amount:'15000',policy:'INCLUDED'}]);
 }finally{
  await target?.close().catch(()=>{});
  await source?.close().catch(()=>{});
  await rm(dir,{recursive:true,force:true});
 }
});

import { BUSINESS_TABLES, digest, loadBusinessSnapshot, readRowsSql } from './business-snapshot.mjs';
import { SOURCE_REF } from './contract.mjs';

export function recoveryTarget(ref,value,ca){
 if(!/^[a-z]{20}$/.test(ref??'')||ref===SOURCE_REF)throw Error('An explicit separate Supabase project is required');
 let u;
 try{u=new URL(value);}catch{throw Error('Missing recovery database connection');}
 const user=decodeURIComponent(u.username);
 const direct=u.hostname===`db.${ref}.supabase.co`&&user==='postgres';
 const pooler=/^aws-\d+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(u.hostname)&&user===`postgres.${ref}`;
 if(!['postgres:','postgresql:'].includes(u.protocol)||!(direct||pooler)||u.pathname!=='/postgres'||(u.port&&u.port!=='5432')||!u.password)throw Error('Recovery URL does not bind to the separate project');
 return {host:u.hostname,user,password:decodeURIComponent(u.password),port:5432,database:'postgres',ssl:{ca,rejectUnauthorized:true},connectionTimeoutMillis:15000};
}

const safeColumn=name=>{
 if(!/^[a-z_][a-z_0-9]*$/.test(name))throw Error('Unexpected recovery column');
 return '"'+name+'"';
};

// Only use a client already bound to a separate, freshly migrated recovery project.
// Callers never hand this function a production client.
export async function restoreEmptyLedger(client,dir){
 const {manifest,payloads}=loadBusinessSnapshot(dir);
 await client.query('begin');
 try{
  await client.query("set local timezone='UTC'");
  const tables=BUSINESS_TABLES.map(t=>'public.'+t).join(',');
  await client.query('lock table '+tables+' in access exclusive mode');
  for(const table of BUSINESS_TABLES){
   if(table==='business_settings')continue; // Migrations seed a single settings row.
   if((await client.query(`select exists(select 1 from public.${table}) as filled`)).rows[0].filled)throw Error('Recovery target is not empty: '+table);
  }
  for(const table of BUSINESS_TABLES){
   const result=await client.query("select column_name from information_schema.columns where table_schema='public' and table_name=$1 and is_generated='NEVER' order by ordinal_position",[table]);
   const columns=result.rows.map(r=>safeColumn(r.column_name));
   if(!columns.length)throw Error('Recovery target is missing table '+table);
   const updates=columns.filter(c=>c!=='"id"').map(c=>c+'=excluded.'+c);
   const settings=table==='business_settings'?' on conflict (id) do update set '+updates.join(','):'';
   const list=columns.join(',');
   if(table==='trips'){
    // A verified archive may contain legitimately pre-cutover work which was
    // recorded BEFORE its TOTAL opening. Bypass only the new write-time guard
    // inside this target-only transaction; restore the trigger before commit.
    const {rows}=await client.query(`select tgenabled from pg_trigger
      where tgrelid='public.trips'::regclass and tgname='trg_trip_new_work_opening'`);
    if(rows[0]?.tgenabled!=='O')throw Error('Unexpected trip opening validation state on recovery target');
    await client.query('alter table public.trips disable trigger trg_trip_new_work_opening');
   }
   if(table==='payments'){
    // Archive rows are historical. A trip may have been corrected after
    // payment. Keep the account and trip FKs active while loading those rows.
    const {rows} = await client.query(`select tgenabled from pg_trigger
      where tgrelid='public.payments'::regclass and tgname='trg_payments_trip_link_guard'`);
    if(rows[0]?.tgenabled!=='O')throw Error('Unexpected payment-link validation state on recovery target');
    await client.query('alter table public.payments disable trigger trg_payments_trip_link_guard');
   }
   await client.query(`insert into public.${table} (${list}) overriding system value
    select ${list} from jsonb_populate_recordset(null::public.${table},$1::jsonb) where true${settings}`,[payloads.get(table)]);
   if(table==='trips'){
    await client.query('alter table public.trips enable trigger trg_trip_new_work_opening');
   }
   if(table==='payments'){
    await client.query('alter table public.payments enable trigger trg_payments_trip_link_guard');
   }
  }
  for(const table of BUSINESS_TABLES){
   const data=(await client.query(readRowsSql(table))).rows[0].rows;
   if(digest(data)!==manifest.tables[table].sha256)throw Error('Restored data differs for '+table);
  }
  await client.query(`select setval(pg_get_serial_sequence('public.audit_log','id'),coalesce(max(id),1),count(*)>0) from public.audit_log`);
  await client.query('commit');
  return {restoredTables:BUSINESS_TABLES.length,exactMatch:true};
 }catch(err){await client.query('rollback').catch(()=>{});throw err;}
}

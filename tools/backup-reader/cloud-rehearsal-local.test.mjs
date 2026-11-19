import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, appendFileSync, symlinkSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { BUSINESS_TABLES, writeBusinessSnapshot } from './business-snapshot.mjs';
import { verifySelectedLocalArchive } from './cloud-rehearsal-local.mjs';

async function isolatedDb() {
  const db = new PGlite();
  await db.exec(readFileSync(new URL('../../supabase/tests/00_isolated_harness.sql', import.meta.url), 'utf8'));
  const migrations = new URL('../../supabase/migrations/', import.meta.url);
  for(const file of readdirSync(migrations).filter(f => f.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(new URL(file, migrations), 'utf8'));
  }
  return db;
}

test('a real nine-table recovery archive is verified and replayed to ephemeral isolated PGlite only', async() => {
  const dir = mkdtempSync(join(tmpdir(), 'cloud-rehearsal-offline-'));
  let source;
  try {
    const folder=join(dir,'rows'); mkdirSync(folder);
    source=await isolatedDb();
    await source.exec(`insert into public.contractors(id,name,is_primary) values ('k1','مقاول',true);
      insert into public.vehicles(id,plate_number) values ('v1','00042');
      insert into public.vehicle_accounts(vehicle_id,contractor_id) values ('v1','k1');
      insert into public.trips(id,vehicle_id,counterparty_contractor_id,responsible_contractor_id,
       direction,trip_date,weight_milli_tonnes,contractor_rate_piastres,vehicle_rate_piastres,
       expense_piastres,contractor_total_piastres,vehicle_total_piastres)
       values('t1','v1','k1','k1','AHMED_SUPPLIES','2026-11-18',1000,50000,50000,0,50000,50000);
      insert into public.payments(id,vehicle_id,responsible_contractor_id,payment_date,amount_piastres,linked_trip_id)
       values('p1','v1','k1','2026-11-18',9007199254741000,'t1');`);
    await writeBusinessSnapshot(source,folder,{date:'2026-11-18',commit:'a'.repeat(40)});
    const archive=join(dir,'selected.tar.gz');
    const tar=spawnSync('tar',['-czf',archive,'-C',folder,'manifest.json',...BUSINESS_TABLES.map(t=>t+'.json')],{
      encoding:'utf8',timeout:120_000,
    });
    assert.equal(tar.status,0,tar.stderr||tar.error?.message);
    const bytes=readFileSync(archive);
    const selection={size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
    assert.deepEqual(await verifySelectedLocalArchive(archive,selection),{
      selected_file_verified:true,isolated_restore_verified:true,
      restored_tables:9,production_writes:false,
    });
    const symlink=join(dir,'alias.tar.gz');symlinkSync(archive,symlink);
    await assert.rejects(verifySelectedLocalArchive(symlink,selection),/metadata mismatch/);
    appendFileSync(archive,'tampered');
    await assert.rejects(verifySelectedLocalArchive(archive,selection),/metadata mismatch/);
    const changed={...selection,size:statSync(archive).size};
    await assert.rejects(verifySelectedLocalArchive(archive,changed),/digest mismatch/);
  }finally{
    await source?.close().catch(()=>{});
    rmSync(dir,{recursive:true,force:true});
  }
});

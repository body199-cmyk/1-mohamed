// Run only against a fresh disposable PostgreSQL cluster on loopback.
// Usage: node tools/portable-backup-postgres-test.mjs /path/to/pg/index.js PORT USER
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const [driver, port, user] = process.argv.slice(2);
assert(driver && /^\d{4,5}$/.test(port) && /^[a-z][a-z0-9_]*$/.test(user), 'Provide pg module path, local port and disposable admin user');
const { default: { Client } } = await import(pathToFileURL(resolve(driver)).href);
const suffix = randomUUID().replaceAll('-', '');
const sourceName = 'portable_src_' + suffix, targetName = 'portable_dst_' + suffix;
const owner = '00000000-0000-0000-0000-000000000001';
const tables = [
  'app_owner', 'app_members', 'business_settings', 'contractors', 'vehicles', 'vehicle_accounts',
  'opening_balances', 'trips', 'payments', 'audit_log', 'idempotency_keys', 'backup_history',
];
const clients = [], databases = [];
async function connect(database) {
  const client = new Client({ host: '127.0.0.1', port: Number(port), user, database,
    statement_timeout: 15000, connectionTimeoutMillis: 4000, ssl: false });
  await client.connect();
  clients.push(client);
  return client;
}
async function prepare(admin, database) {
  await admin.query('create database ' + database);
  databases.push(database);
  const db = await connect(database);
  await db.query(await readFile('supabase/tests/00_isolated_harness.sql', 'utf8'));
  for (const name of (await readdir('supabase/migrations')).filter(name => name.endsWith('.sql')).sort()) {
    await db.query(await readFile('supabase/migrations/' + name, 'utf8'));
  }
  return db;
}
async function snapshot(db, table = null) {
  return (await db.query('select public.app_portable_backup_snapshot($1) as data', [table])).rows[0].data;
}
async function fingerprint(db, table) {
  return (await db.query(`select count(*)::text as count,
    md5(coalesce(string_agg(to_jsonb(t)::text, chr(10) order by to_jsonb(t)::text), '')) as hash
    from public.${table} t`)).rows[0];
}
const admin = await connect('postgres');
try {
  const source = await prepare(admin, sourceName);
  const target = await prepare(admin, targetName);
  await source.query('select public.app_set_initial_owner($1)', [owner]);
  await source.query(`
    insert into contractors(id,name,is_primary) values ('MAIN','Main',true),('C1','First',false),('C2','Second',false);
    insert into vehicles(id,plate_number) values ('V1','Test plate');
    insert into vehicle_accounts(vehicle_id,contractor_id) values ('V1','MAIN'),('V1','C2');
    insert into trips(id,vehicle_id,counterparty_contractor_id,responsible_contractor_id,direction,trip_date,
      weight_milli_tonnes,contractor_rate_piastres,vehicle_rate_piastres,expense_piastres,contractor_total_piastres,vehicle_total_piastres)
    select 'T' || lpad(n::text,4,'0'),'V1','C1','MAIN','AHMED_SUPPLIES','2026-11-19',1000,100,100,0,100,100
    from generate_series(1,1003) n;
    insert into payments(id,vehicle_id,responsible_contractor_id,payment_date,amount_piastres,linked_trip_id)
    values ('P1','V1','MAIN','2026-11-19',100,'T0001');
    insert into app_members(user_id,email,invited_by)
    values ('00000000-0000-0000-0000-000000000002','stranger@test.invalid','${owner}');
    insert into backup_history(backup_date,format,file_name,drive_file_id,size_bytes,sha256,table_counts)
    values ('2026-11-19','1-mohamed-full-supabase-logical-backup','synthetic','fixture',99,repeat('a',64),'{}');
  `);

  // Reproduce the former offset paging flaw under ordinary committed reads.
  const page = async (offset) => (await source.query(
    'select id from trips order by id limit 1000 offset $1', [offset])).rows.map(row => row.id);
  const firstPage = await page(0);
  await source.query("update trips set id='A0000' where id='T1003'");
  const secondPage = await page(1000);
  assert.equal(firstPage.at(-1), secondPage[0]);
  assert(![...firstPage, ...secondPage].includes('A0000'));
  await source.query("update trips set id='T1003' where id='A0000'");
  console.log('Original offset reader duplicates and misses IDs across a committed change');

  const reader = await connect(sourceName);
  await reader.query('set role authenticated');
  await reader.query('select set_config($1,$2,false)', ['request.jwt.claim.sub', owner]);
  const pid = (await reader.query('select pg_backend_pid() as pid')).rows[0].pid;
  const opening = (signed_piastres) => reader.query('select public.app_op_opening_balance_create($1,$2::jsonb) as data', [
    'portable-opening-replay', { id: 'OPEN-C2', balance_type: 'CONTRACTOR_WORK', contractor_id: 'C2',
      start_date: '2026-11-18', signed_piastres },
  ]);
  await assert.rejects(opening('-100'), { code: '22023' });
  assert.equal((await fingerprint(source, 'idempotency_keys')).count, '0');
  assert.deepEqual((await opening(-100)).rows, (await opening(-100)).rows);

  async function overlaps(table, waitOn, change) {
    await source.query('begin');
    try {
      await source.query('lock table public.' + waitOn + ' in access exclusive mode');
      // Release the lock only after pg_stat_activity confirms contention.
      const result = snapshot(reader, table).then(() => null, error => error);
      for (let attempt = 0; ; attempt++) {
        const { waiting } = (await admin.query(
          "select wait_event_type = 'Lock' as waiting from pg_stat_activity where pid=$1", [pid])).rows[0];
        if (waiting) break;
        assert(attempt < 100, 'Snapshot reader never reached the deterministic lock barrier');
        await delay(20);
      }
      await source.query(change);
      await source.query('commit');
      assert.equal((await result)?.code, 'P2010', 'Snapshot did not explicitly reject concurrent drift');
    } catch (error) {
      await source.query('rollback');
      throw error;
    }
  }

  await overlaps(null, 'backup_history', "update trips set notes='Concurrent edit' where id='T1003'");
  await overlaps(null, 'backup_history', `update trips set is_cancelled=true,
    cancel_reason='Concurrent cancellation', cancelled_at=now() where id='T1002'`);
  await overlaps(null, 'backup_history', `update trips set counterparty_contractor_id='C2',
    responsible_contractor_id='C2', direction='OTHER_SUPPLIES' where id='T0001';
    update payments set responsible_contractor_id='C2' where id='P1'`);
  await overlaps('trips', 'trips', "update trips set notes='Changed during CSV' where id='T0002'");
  console.log('Two concurrent PostgreSQL connections: edit, cancellation, relationship and CSV drift rejected');

  const archive = JSON.parse(JSON.stringify(await snapshot(reader)));
  assert.equal(archive.trips.length, 1003);
  assert.deepEqual(Object.keys(archive).sort(), [...tables].sort());
  assert.equal(archive.payments[0].linked_trip_id, 'T0001');
  assert.equal(archive.payments[0].responsible_contractor_id, 'C2');

  // Dispose of schema bootstrap rows only. The target has no business data.
  await target.query('begin');
  try {
    await target.query('delete from public.app_owner; delete from public.business_settings');
    for (const table of tables) {
      await target.query(`insert into public.${table} overriding system value
        select * from jsonb_populate_recordset(null::public.${table}, $1::jsonb)`, [JSON.stringify(archive[table])]);
    }
    for (const table of tables) assert.deepEqual(await fingerprint(target, table), await fingerprint(source, table), table);
    await target.query('commit');
  } catch (error) {
    await target.query('rollback');
    throw error;
  }
  console.log('Portable row data restored into a fresh migrated target; all 12 counts and fingerprints matched');
} finally {
  await Promise.all(clients.slice(1).map(client => client.end()));
  for (const database of databases) await admin.query('drop database ' + database);
  await admin.end();
}

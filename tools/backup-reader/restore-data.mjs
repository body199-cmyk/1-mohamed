import pg from 'pg';
import copyStreams from 'pg-copy-streams';
import {readFileSync,statSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {restoreConnection,dataOperations,RESTORE_REF} from './restore-contract.mjs';
import {SOURCE_REF,AUTH_TABLES,tableFingerprintSql,authCopyHeader} from './contract.mjs';
import {EXPECTED_PUBLIC_TABLES} from '../offsite-backup.mjs';

export async function restoreData(env=process.env){
 const dir=env.RESTORE_DATA_DIR;if(!dir)throw Error('Private restore directory missing');
 const manifest=JSON.parse(readFileSync(join(dir,'manifest.json'),'utf8'));
 if(manifest.project_ref!==SOURCE_REF||manifest.format_version!==2||manifest.export_mode!=='restricted-reader'||manifest.snapshot_consistent!==true)throw Error('Unsupported reader recovery manifest');
 const tables=EXPECTED_PUBLIC_TABLES.filter(t=>t!=='backup_history'||Object.hasOwn(manifest.public_table_counts||{},t));
 if(JSON.stringify([...tables].sort())!==JSON.stringify(Object.keys(manifest.public_table_counts||{}).sort()))throw Error('Incomplete application table manifest');
 for(const table of AUTH_TABLES)authCopyHeader(table,manifest.auth_columns?.[table]);
 const path=join(dir,'data.sql');if(statSync(path).size>64*1024*1024)throw Error('Trial restore exceeds reviewed data-size limit');
 const bytes=readFileSync(path);
 if(createHash('sha256').update(bytes).digest('hex')!==manifest.data_sql_sha256)throw Error('SQL data checksum mismatch');
 const operations=dataOperations(bytes.toString('utf8'));
 const expected=[...tables.map(t=>'public.'+t),...AUTH_TABLES.map(t=>'auth.'+t)].sort();
 const included=operations.filter(o=>o.type==='copy').map(o=>o.key).sort();
 if(JSON.stringify(expected)!==JSON.stringify(included))throw Error('COPY table coverage differs from recovery manifest');
 for(const key of expected)if(!/^\d+$/.test(manifest.row_fingerprints?.[key]?.count||'')||!/^[a-f0-9]{64}$/.test(manifest.row_fingerprints?.[key]?.sha256||''))throw Error('Incomplete source row fingerprints');
 const config=restoreConnection(env.RESTORE_DB_URL,readFileSync(env.SUPABASE_CA_FILE,'utf8'));
 const client=new pg.Client(config);let connected=false,inTransaction=false;
 try{
  await client.connect();connected=true;
  const role=(await client.query("select current_user as name,pg_has_role(current_user,'postgres','MEMBER') as admin_member")).rows[0];
  if(role.name!=='offsite_restore_operator'||role.admin_member)throw Error('Unexpected target account or admin membership');
  await client.query('begin');inTransaction=true;
  await client.query("set local timezone='UTC'");
  const relation=key=>key.startsWith('auth.')?key.replace('auth.','backup_auth_restore.'):key;
  for(const key of expected){const r=await client.query('select count(*)::text as n from '+relation(key));if(r.rows[0].n!=='0')throw Error('Refusing to overwrite a nonempty restore target');}
  for(const operation of operations){
   if(operation.type!=='copy')continue;
   await pipeline(Readable.from([operation.data]),client.query(copyStreams.from(operation.sql)));
  }
  for(const key of expected){
   const [schema,table]=key.split('.'),targetSchema=schema==='auth'?'backup_auth_restore':schema;
   const actual=(await client.query(tableFingerprintSql(targetSchema,table,schema==='auth'?manifest.auth_columns[table]:undefined))).rows[0];
   const wanted=manifest.row_fingerprints[key];
   if(actual.count!==wanted.count||actual.sha256!==wanted.sha256)throw Error('Restored row fingerprint mismatch for '+key);
  }
  for(const operation of operations){
   if(operation.type!=='sequence')continue;
   const permitted=(await client.query("select exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='S' and n.nspname||'.'||c.relname=$1) as yes",[operation.name])).rows[0].yes;
   if(!permitted)throw Error('Unexpected recovery sequence');
   await client.query('select pg_catalog.setval($1::regclass,$2::bigint,$3::boolean)',[operation.name,operation.value,operation.called]);
  }
  await client.query('commit');inTransaction=false;
  const result={target_ref:RESTORE_REF,source_ref:SOURCE_REF,public_tables:tables.length,auth_tables:2,all_row_fingerprints_match:true,source_writes:false,post_data_constraints_pending:true};
  writeFileSync(join(dir,'restore-data-result.json'),JSON.stringify(result,null,2)+'\n',{mode:0o600});
  console.log(JSON.stringify(result));return result;
 }finally{if(connected&&inTransaction)await client.query('rollback').catch(()=>{});await client.end().catch(()=>{});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)restoreData().catch(error=>{console.error('Isolated data restore failed: '+(error.code||error.message||'unknown'));process.exitCode=1;});

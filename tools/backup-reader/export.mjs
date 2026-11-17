import pg from 'pg';
import copyStreams from 'pg-copy-streams';
import {createReadStream,createWriteStream,readFileSync,writeFileSync,appendFileSync,mkdtempSync,mkdirSync,rmSync,statSync} from 'node:fs';
import {pipeline} from 'node:stream/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {X509Certificate,createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {EXPECTED_PUBLIC_TABLES,cairoDate,buildBackupFileName,verifyLogicalDump,buildBackupManifest} from '../offsite-backup.mjs';
import {sourceConnection,authCopyHeader,AUTH_TABLES,CA_SHA256,tableFingerprintSql,quoteIdentifier} from './contract.mjs';

function run(bin,args,env=process.env){
 const r=spawnSync(bin,args,{env,encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:2*1024*1024});
 if(r.error||r.status!==0){const first=(r.stderr||'').split('\n')[0].replaceAll(env.PGPASSWORD||'__no_password__','[redacted]').slice(0,350);throw Error(`${bin} failed: ${first}`);}
 return r.stdout;
}
async function sha(path){const h=createHash('sha256');for await(const c of createReadStream(path))h.update(c);return h.digest('hex');}
async function caCertificate(){
 const r=await fetch('https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt',{signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw Error('Official Supabase CA unavailable');const pem=await r.text();
 if(new X509Certificate(pem).fingerprint256.replaceAll(':','').toLowerCase()!==CA_SHA256)throw Error('Supabase CA fingerprint changed');
 return pem;
}
export async function createReaderArchive(env=process.env){
 if(env.BACKUP_READER_TRIAL!=='true'||[env.BACKUP_ENABLED,env.BACKUP_RECORD_HISTORY,env.BACKUP_RETENTION_ENABLED,env.BACKUP_RESTORE_VERIFIED].some(v=>v==='true'))throw Error('Reader trial requires all production gates disabled');
 if(!/^age1[0-9a-z]+$/.test(env.AGE_RECIPIENT||''))throw Error('Public encryption recipient required');
 const root=resolve(env.READER_OUTPUT_DIR||join(env.RUNNER_TEMP||tmpdir(),'reader-encrypted'));
 mkdirSync(root,{recursive:true,mode:0o700});
 const work=mkdtempSync(join(env.RUNNER_TEMP||tmpdir(),'reader-private-'));
 let client,connected=false;
 try {
  const ca=await caCertificate(),config=sourceConnection(env.SUPABASE_DB_URL,ca);
  console.log('Pinned Supabase CA and restricted source binding verified.');
  writeFileSync(join(work,'supabase-root.crt'),ca,{mode:0o600});
  client=new pg.Client(config);await client.connect();connected=true;
  console.log('Source TLS session established.');
  await client.query("begin isolation level repeatable read read only");
  await client.query("set local timezone='UTC'");
  const snapshot=(await client.query('select pg_export_snapshot() as id')).rows[0].id;
  console.log('Consistent read-only snapshot opened.');
  const actual=(await client.query("select tablename from pg_tables where schemaname='public' order by tablename")).rows.map(r=>r.tablename);
  const tables=EXPECTED_PUBLIC_TABLES.filter(t=>t!=='backup_history'||actual.includes(t));
  if(JSON.stringify([...tables].sort())!==JSON.stringify(actual))throw Error('Public table inventory changed; update recovery coverage');
  const storage=(await client.query('select (select count(*) from storage.buckets)::text as buckets,(select count(*) from storage.objects)::text as objects')).rows[0];
  if(storage.buckets!=='0'||storage.objects!=='0')throw Error('Storage object export required');
  const native=typeof env.PG_DUMP_BIN==='string'&&env.PG_DUMP_BIN.length>0;
  const pgEnv={...env,PGHOST:config.host,PGPORT:'5432',PGUSER:config.user,PGPASSWORD:config.password,PGDATABASE:'postgres',PGSSLMODE:'verify-full',PGSSLROOTCERT:native?join(work,'supabase-root.crt'):'/backup/supabase-root.crt',PGTZ:'UTC'};
  const dockerArgs=['run','--rm','--network','host','--user',`${process.getuid?.()||0}:${process.getgid?.()||0}`,'-v',`${work}:/backup`,...['PGHOST','PGPORT','PGUSER','PGPASSWORD','PGDATABASE','PGSSLMODE','PGSSLROOTCERT','PGTZ'].flatMap(v=>['-e',v]),'postgres:17.11-bookworm'];
  for(const [file,section] of [['pre-data.sql','pre-data'],['post-data.sql','post-data'],['public-data.sql','data']]){
   console.log('Exporting public '+section+' section.');
   const args=['--schema=public','--no-owner',`--section=${section}`,`--snapshot=${snapshot}`,'--file',native?join(work,file):`/backup/${file}`];
   run(native?env.PG_DUMP_BIN:'docker',native?args:[...dockerArgs,'pg_dump',...args],pgEnv);
  }
  const counts={},fingerprints={},authColumns={};
  for(const table of tables){const r=(await client.query(tableFingerprintSql('public',table))).rows[0];counts[table]=Number(r.count);if(!Number.isSafeInteger(counts[table]))throw Error('Unsafe row count');fingerprints['public.'+table]=r;}
  const data=join(work,'data.sql');writeFileSync(data,'-- Auth records precede application mappings.\n',{mode:0o600});
  for(const table of AUTH_TABLES){
   const columns=(await client.query("select a.attname as column_name from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='auth' and c.relname=$1 and a.attnum>0 and not a.attisdropped and a.attgenerated='' order by a.attnum",[table])).rows.map(r=>r.column_name);
   authColumns[table]=columns;
   appendFileSync(data,authCopyHeader(table,columns));
   await pipeline(client.query(copyStreams.to(`COPY (SELECT ${columns.map(quoteIdentifier).join(',')} FROM backup_auth_export.${table}) TO STDOUT`)),createWriteStream(data,{flags:'a',mode:0o600}));
   appendFileSync(data,'\\.\n\n');
   fingerprints['auth.'+table]=(await client.query(tableFingerprintSql('backup_auth_export',table,columns))).rows[0];
  }
  await pipeline(createReadStream(join(work,'public-data.sql')),createWriteStream(data,{flags:'a',mode:0o600}));
  const pre=readFileSync(join(work,'pre-data.sql'),'utf8'),post=readFileSync(join(work,'post-data.sql'),'utf8');
  writeFileSync(join(work,'schema.sql'),pre+'\n'+post,{mode:0o600});
  const rolesSql="-- Managed Supabase roles must already exist on the restore project.\n-- Recreate the temporary reader as NOLOGIN only for its saved table ACLs.\nDO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='offsite_backup_reader') THEN CREATE ROLE offsite_backup_reader NOLOGIN; END IF; END $$;\n";
  writeFileSync(join(work,'roles.sql'),rolesSql,{mode:0o600});
  verifyLogicalDump({rolesSql,schemaSql:pre+'\n'+post,dataSql:readFileSync(data,'utf8'),allowMissingHistory:true});
  const createdAt=new Date().toISOString(),fileName=buildBackupFileName(createdAt),version=(await client.query("select current_setting('server_version') as version")).rows[0].version;
  const manifest={...buildBackupManifest({createdAt,fileName,sourceCommit:env.GITHUB_SHA,postgresVersion:version,tableCounts:counts,dataSqlSha256:await sha(data),includeBackupHistory:tables.includes('backup_history')}),snapshot_consistent:true,export_mode:'restricted-reader',row_fingerprints:fingerprints,auth_columns:authColumns,schema_sections:['pre-data.sql','post-data.sql'],auth_records:'users-and-identities-only',transient_sessions_excluded:true};
  writeFileSync(join(work,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{mode:0o600});
  await client.query('rollback');await client.end();client=null;
  const tar=join(work,'archive.tar.gz');run('tar',['-czf',tar,'-C',work,'roles.sql','schema.sql','pre-data.sql','post-data.sql','data.sql','manifest.json']);
  const encrypted=join(root,fileName);run('age',['-r',env.AGE_RECIPIENT,'-o',encrypted,tar]);
  const result={fileName,path:encrypted,sha256:await sha(encrypted),size:statSync(encrypted).size,cairoDate:cairoDate(createdAt),tables:tables.length,authUsers:fingerprints['auth.users'].count,authIdentities:fingerprints['auth.identities'].count,sourceWrites:false};
  writeFileSync(join(root,'result.json'),JSON.stringify(result,null,2)+'\n',{mode:0o600});
  if(env.GITHUB_OUTPUT)appendFileSync(env.GITHUB_OUTPUT,`archive=${encrypted}\nfile_name=${fileName}\nsha256=${result.sha256}\n`);
  console.log(JSON.stringify(result));return result;
 }finally{if(client){if(connected)await client.query('rollback').catch(()=>{});await client.end().catch(()=>{});}rmSync(work,{recursive:true,force:true});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)createReaderArchive().catch(error=>{console.error('Restricted reader export failed: '+(error.code||error.message||'unknown failure'));process.exitCode=1;});

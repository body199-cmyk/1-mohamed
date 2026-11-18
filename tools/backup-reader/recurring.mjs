import pg from 'pg';
import { pathToFileURL } from 'node:url';
import { backupSafetyPolicy, cairoDate, filesToPrune } from '../offsite-backup.mjs';
import { prepareRcloneBackup } from '../google-drive-rclone.mjs';
import { caCertificate, createReaderArchive } from './export.mjs';
import { sourceConnection } from './contract.mjs';
import { createBusinessFiles } from './business-files.mjs';

export function recurringPolicy(env) {
 const policy=backupSafetyPolicy(env);
 if(!policy.recordHistory)throw Error('Recurring backup requires backup-history recording');
 if(env.GITHUB_EVENT_NAME==='workflow_dispatch'){
  if(env.BACKUP_RECURRING_DRILL!=='true'||env.BACKUP_ENABLED==='true'||policy.retention)throw Error('Manual recurring drill requires scheduling and deletion disabled');
 }else if(env.GITHUB_EVENT_NAME!=='schedule')throw Error('Unexpected recurring backup trigger');
 return policy;
}

const historyPermissions=`select current_user='offsite_backup_reader'
 and not pg_has_role(current_user,'postgres','MEMBER')
 and has_table_privilege(current_user,'public.backup_history','SELECT')
 and has_column_privilege(current_user,'public.backup_history','sha256','INSERT')
 and not has_table_privilege(current_user,'public.backup_history','DELETE') as scoped`;

export async function runRecurringBackup(env=process.env){
 const policy=recurringPolicy(env);
 const ca=await caCertificate();
 const config=sourceConnection(env.SUPABASE_DB_URL,ca);
 const withHistory=async work=>{
  const client=new pg.Client(config);
  try {
   await client.connect();
   return await work(client);
  }finally{await client.end().catch(()=>{});}
 };
 const today=cairoDate(new Date());
 await withHistory(async client=>{
  if(!(await client.query(historyPermissions)).rows[0]?.scoped)throw Error('Expected scoped history writer');
  if((await client.query('select 1 from public.backup_history where backup_date=$1',[today])).rowCount)throw Error('Backup history already exists for this Cairo day');
 });
 // The snapshot and pg_dump use the reader's two allowed connections.
 const mode=env.BACKUP_FORMAT||'encrypted';
 if(!['encrypted','plain-business'].includes(mode))throw Error('Unsupported backup mode');
 const backup=mode==='plain-business'?
  await createBusinessFiles(config,{date:today,commit:env.GITHUB_SHA,tempRoot:env.RUNNER_TEMP}):
  await createReaderArchive(env,{recurring:true});
 try{
  if(backup.cairoDate!==today||cairoDate(new Date())!==today)throw Error('Cairo date changed during export; rerun for the new date');
  const drive=await prepareRcloneBackup(env,backup.path,backup.fileName,today,filesToPrune);
  if(backup.excelPath)await prepareRcloneBackup(env,backup.excelPath,backup.excelName,today,filesToPrune);
  await withHistory(async client=>{
   await client.query('begin read write');
   await client.query(`insert into public.backup_history
    (backup_date,format,file_name,drive_file_id,drive_web_view_link,size_bytes,sha256,table_counts)
    values ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [today,backup.format||'1-mohamed-full-supabase-logical-backup',backup.fileName,drive.file.id,drive.file.webViewLink,backup.size,backup.sha256,JSON.stringify(backup.tableCounts)]);
   await client.query('commit');
  });
  const retention=policy.retention?await drive.prune():{deleted:0};
  console.log(JSON.stringify({date:today,verified:true,excel:!!backup.excelPath,history:true,deleted:retention.deleted,tables:backup.tables,sha256:backup.sha256}));
 }finally{backup.cleanup?.();}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 runRecurringBackup().catch(err=>{console.error('Recurring backup failed: '+(err.code||err.message));process.exitCode=1;});
}

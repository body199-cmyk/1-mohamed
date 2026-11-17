import { createHash } from "node:crypto";
import { appendFileSync, createReadStream, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { backupFolderParts, prepareRcloneBackup } from "./google-drive-rclone.mjs";

export const EXPECTED_PROJECT_REF = "sskkuniskphlawivzudw";
export const EXPECTED_PUBLIC_TABLES = Object.freeze(["app_members","app_owner","audit_log","backup_history","business_settings","contractors","idempotency_keys","opening_balances","payments","trips","vehicle_accounts","vehicles"]);
export const EXPECTED_PUBLIC_DATA_TABLES = EXPECTED_PUBLIC_TABLES;
export const BACKUP_FOLDER_NAME = "1-mohamed-backups";
export const RETENTION_DAYS = 30;

function assert(ok, message) { if (!ok) throw new Error("BACKUP_INVALID: " + message); }
export function cairoDate(value) {
  const date = new Date(value); assert(!Number.isNaN(date.getTime()), "Backup timestamp is invalid.");
  const parts = new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Cairo",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date);
  const get = type => parts.find(part=>part.type===type)?.value;
  return get("year")+"-"+get("month")+"-"+get("day");
}
export function buildBackupFileName(value) { return "1-mohamed-"+cairoDate(value)+".tar.gz.age"; }
export function retentionCutoff(today) {
  assert(/^\d{4}-\d{2}-\d{2}$/.test(today),"Retention date is invalid.");
  const date=new Date(today+"T00:00:00.000Z"); date.setUTCDate(date.getUTCDate()-(RETENTION_DAYS-1));
  return date.toISOString().slice(0,10);
}
export function filesToPrune(files,today) {
  const cutoff=retentionCutoff(today);
  return files.filter(file=>{const m=/^1-mohamed-(\d{4}-\d{2}-\d{2})\.tar\.gz\.age$/.exec(file.name||"");return m&&m[1]<cutoff;});
}
export function validateBackupEnvironment(env) {
  for(const name of ["SUPABASE_DB_URL","AGE_RECIPIENT"])
    assert(typeof env[name]==="string"&&env[name].trim(),"Missing required environment setting: "+name);
  const legacyOauth = ["GOOGLE_DRIVE_CLIENT_ID","GOOGLE_DRIVE_CLIENT_SECRET","GOOGLE_DRIVE_REFRESH_TOKEN"].every(name=>typeof env[name]==="string"&&env[name].trim());
  assert(legacyOauth || (typeof env.RCLONE_CONFIG_DRIVE_TOKEN==="string"&&env.RCLONE_CONFIG_DRIVE_TOKEN.trim()),"Missing Google Drive authorization: configure RCLONE_CONFIG_DRIVE_TOKEN or the existing OAuth credentials.");
  assert(/^age1[0-9a-z]+$/.test(env.AGE_RECIPIENT),"AGE_RECIPIENT must be an age public recipient, never a private identity.");
  let url; try{url=new URL(env.SUPABASE_DB_URL);}catch{throw new Error("BACKUP_INVALID: SUPABASE_DB_URL is invalid.");}
  assert(["postgres:","postgresql:"].includes(url.protocol),"SUPABASE_DB_URL must use PostgreSQL.");
  assert(url.hostname.includes(EXPECTED_PROJECT_REF)||decodeURIComponent(url.username).includes(EXPECTED_PROJECT_REF),"Database URL does not identify the expected 1-mohamed project.");
  return true;
}
export function verifyLogicalDump({rolesSql,schemaSql,dataSql}) {
  assert(rolesSql?.trim(),"roles.sql is empty."); assert(schemaSql?.trim(),"schema.sql is empty."); assert(dataSql?.trim(),"data.sql is empty.");
  for(const table of EXPECTED_PUBLIC_TABLES)
    assert(new RegExp("\\bCREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?(?:public\\.)?"+table+"\\s*\\(","i").test(schemaSql),"Logical schema dump is missing public."+table+".");
  for(const table of EXPECTED_PUBLIC_TABLES)
    assert(new RegExp("\\bCOPY\\s+public\\."+table+"\\s*\\(","i").test(dataSql),"Logical data dump is missing public."+table+".");
  assert(/\bCOPY\s+auth\.users\s*\(/i.test(dataSql),"Logical data dump is missing auth.users; refusing incomplete Auth recovery archive.");
  assert(/\bCOPY\s+auth\.identities\s*\(/i.test(dataSql),"Logical data dump is missing auth.identities; refusing incomplete Auth recovery archive.");
  return true;
}
export function buildBackupManifest({createdAt,fileName,sourceCommit,postgresVersion,tableCounts,dataSqlSha256}) {
  assert(fileName===buildBackupFileName(createdAt),"Backup file name does not match Cairo calendar date.");
  assert(/^[a-f0-9]{7,64}$/i.test(sourceCommit||""),"Source commit is invalid.");
  assert(typeof postgresVersion==="string"&&postgresVersion.length>0,"PostgreSQL version is missing.");
  assert(tableCounts&&typeof tableCounts==="object"&&!Array.isArray(tableCounts),"Table-count manifest is invalid.");
  const names=Object.keys(tableCounts).sort(), expected=[...EXPECTED_PUBLIC_TABLES].sort();
  assert(names.length===expected.length&&names.every((n,i)=>n===expected[i]),"Public table-count manifest is incomplete.");
  for(const [name,count] of Object.entries(tableCounts)) assert(Number.isSafeInteger(count)&&count>=0,"Invalid row count for public."+name);
  assert(/^[a-f0-9]{64}$/.test(dataSqlSha256||""),"SQL data SHA-256 is invalid.");
  return {format:"1-mohamed-full-supabase-logical-backup",format_version:2,created_at:new Date(createdAt).toISOString(),cairo_backup_date:cairoDate(createdAt),project_ref:EXPECTED_PROJECT_REF,source_commit:sourceCommit,postgres_version:postgresVersion,public_table_counts:tableCounts,public_tables_included:[...EXPECTED_PUBLIC_TABLES],public_table_data_included:[...EXPECTED_PUBLIC_TABLES],auth_users_included:true,auth_password_hashes_included:true,identity_mapping_rows_included:true,auth_identities_included:true,storage_objects_included:false,data_sql_sha256:dataSqlSha256,encrypted:true};
}
function run(command,args,options={}) {
  const r=spawnSync(command,args,{encoding:"utf8",env:options.env??process.env,maxBuffer:12*1024*1024,stdio:["ignore","pipe","pipe"]});
  if(r.error)throw r.error;if(r.status!==0)throw new Error(command+" failed with exit "+r.status+": "+(r.stderr||r.stdout||"no output").slice(-5000));
  return r.stdout??"";
}
async function digest(path,algorithm) { const h=createHash(algorithm);for await(const c of createReadStream(path))h.update(c);return h.digest("hex"); }
async function accessToken(env) {
  const body=new URLSearchParams({client_id:env.GOOGLE_DRIVE_CLIENT_ID,client_secret:env.GOOGLE_DRIVE_CLIENT_SECRET,refresh_token:env.GOOGLE_DRIVE_REFRESH_TOKEN,grant_type:"refresh_token"});
  const r=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body});
  assert(r.ok,"Google Drive OAuth refresh failed with HTTP "+r.status+".");const data=await r.json();assert(data.access_token,"Google did not return an access token.");return data.access_token;
}
async function drive(url,token,options={}) {
  const r=await fetch(url,{...options,headers:{Authorization:"Bearer "+token,...(options.headers||{})}});
  if(!r.ok)throw new Error("Google Drive API failed with HTTP "+r.status+": "+(await r.text()).slice(0,1000));
  return r.status===204?null:r.json();
}
async function ensureFolder(token,name,parentId) {
  const safeName=name.replace(/'/g,"\\'");
  const filter="name = '"+safeName+"' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"+(parentId?" and '"+parentId+"' in parents":"");
  const q=new URLSearchParams({q:filter,spaces:"drive",pageSize:"100",fields:"files(id,name),nextPageToken"});
  const result=await drive("https://www.googleapis.com/drive/v3/files?"+q,token);
  assert(!result.nextPageToken,"Ambiguous Drive folder lookup.");
  const found=result.files?.find(f=>f.name===name);
  if(found)return found.id;
  const meta={name,mimeType:"application/vnd.google-apps.folder"};
  if(parentId)meta.parents=[parentId];
  const made=await drive("https://www.googleapis.com/drive/v3/files?fields=id,name",token,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(meta)});
  assert(made.id,"Could not create Google Drive backup folder.");return made.id;
}
async function folder(token,today) {
  const parts=backupFolderParts(today);
  const rootId=await ensureFolder(token,parts[0]);
  const yearId=await ensureFolder(token,parts[1],rootId);
  const monthId=await ensureFolder(token,parts[2],yearId);
  return {rootId,monthId};
}
async function listFiles(token,rootId) {
  const results=[], pending=[rootId];
  while(pending.length) {
    const id=pending.pop();
    const q=new URLSearchParams({q:"'"+id+"' in parents and trashed = false",pageSize:"1000",fields:"files(id,name,mimeType,size,md5Checksum,createdTime,webViewLink),nextPageToken"});
    const r=await drive("https://www.googleapis.com/drive/v3/files?"+q,token);
    assert(!r.nextPageToken,"More than 1000 entries in one Drive backup folder; cleanup stopped.");
    for(const file of r.files||[]) {
      if(file.mimeType==="application/vnd.google-apps.folder")pending.push(file.id);
      else if(/^1-mohamed-\d{4}-\d{2}-\d{2}\.tar\.gz\.age$/.test(file.name||""))results.push(file);
    }
    assert(pending.length<500&&results.length<10000,"Drive backup folder traversal exceeded safety limit.");
  }
  return results;
}
async function upload(token,folderId,path,name) {
  const bytes=readFileSync(path), md5=await digest(path,"md5"), sha=await digest(path,"sha256"), boundary="mohamed_"+sha.slice(0,24);
  const meta=JSON.stringify({name,parents:[folderId],mimeType:"application/octet-stream"});
  const head=Buffer.from("--"+boundary+"\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n"+meta+"\r\n--"+boundary+"\r\nContent-Type: application/octet-stream\r\n\r\n");
  const body=Buffer.concat([head,bytes,Buffer.from("\r\n--"+boundary+"--")]);
  const file=await drive("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size,md5Checksum,createdTime,webViewLink",token,{method:"POST",headers:{"content-type":"multipart/related; boundary="+boundary},body});
  assert(file.id&&file.name===name,"Drive upload returned an unexpected file.");
  assert(Number(file.size)===bytes.length&&file.md5Checksum===md5,"Drive upload checksum/size verification failed.");
  return file;
}
async function prune(token,folderId,today) {
  const files=await listFiles(token,folderId), expired=filesToPrune(files,today);
  for(const f of expired)await drive("https://www.googleapis.com/drive/v3/files/"+encodeURIComponent(f.id),token,{method:"DELETE"});
  return {retained:files.length-expired.length,deleted:expired.length};
}
function quote(value){return "'"+String(value).replace(/'/g,"'\\''")+"'";}
async function history(env,manifest,file,archiveBytes,archiveSha) {
  const vals=[manifest.cairo_backup_date,manifest.format,file.name,file.id,file.webViewLink||"",String(archiveBytes),archiveSha,JSON.stringify(manifest.public_table_counts),retentionCutoff(manifest.cairo_backup_date)];
  const sql="insert into public.backup_history (backup_date,format,file_name,drive_file_id,drive_web_view_link,size_bytes,sha256,table_counts) values (:'d',:'f',:'n',:'i',nullif(:'u',''),:'s'::bigint,:'h',:'c'::jsonb) on conflict (backup_date) do update set file_name=excluded.file_name,drive_file_id=excluded.drive_file_id,drive_web_view_link=excluded.drive_web_view_link,size_bytes=excluded.size_bytes,sha256=excluded.sha256,table_counts=excluded.table_counts,created_at=now()";
  const params=["d","f","n","i","u","s","h","c","cutoff"];
  // psql -c bypasses psql variable interpolation; feed the SQL through stdin.
  const insertCmd="printf '%s\n' "+quote(sql)+" | psql \"$SUPABASE_DB_URL\" -X -v ON_ERROR_STOP=1 "+vals.map((v,i)=>"-v "+params[i]+"="+quote(v)).join(" ");
  const pruneCmd="printf '%s\n' "+quote("delete from public.backup_history where backup_date < :'cutoff'::date")+" | psql \"$SUPABASE_DB_URL\" -X -v ON_ERROR_STOP=1 -v cutoff="+quote(vals[8]);
  const script=insertCmd+" && "+pruneCmd;
  run("docker",["run","--rm","--network","host","-e","SUPABASE_DB_URL","postgres:17.11-bookworm","sh","-ceu",script],{env});
}
function summary(lines){if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,lines.join("\n")+"\n","utf8");}

export async function runOffsiteBackup(env=process.env) {
  validateBackupEnvironment(env);
  const work=mkdtempSync(join(env.RUNNER_TEMP||tmpdir(),"mohamed-backup-"));
  try {
    const createdAt=new Date().toISOString(),today=cairoDate(createdAt),fileName=buildBackupFileName(createdAt);
    const commands=[
      ["db","dump","--db-url",env.SUPABASE_DB_URL,"-f",join(work,"roles.sql"),"--role-only"],
      ["db","dump","--db-url",env.SUPABASE_DB_URL,"-f",join(work,"schema.sql")],
      ["db","dump","--db-url",env.SUPABASE_DB_URL,"-f",join(work,"data.sql"),"--use-copy","--data-only","-x","storage.buckets_vectors","-x","storage.vector_indexes"],
    ];
    for(const args of commands)run("npx",["--yes","supabase@2.122.1",...args],{env});
    const [rolesSql,schemaSql,dataSql]=["roles.sql","schema.sql","data.sql"].map(n=>readFileSync(join(work,n),"utf8"));
    verifyLogicalDump({rolesSql,schemaSql,dataSql});
    const containerScript=[
      "set -eu",
      "psql \"$SUPABASE_DB_URL\" -XAt -v ON_ERROR_STOP=1 -c \"select (select count(*) from storage.buckets)::text || '|' || (select count(*) from storage.objects)::text\" > /backup/storage-counts.txt",
      "psql \"$SUPABASE_DB_URL\" -XAt -v ON_ERROR_STOP=1 -c \"select current_setting('server_version')\" > /backup/postgres-version.txt",
      "psql \"$SUPABASE_DB_URL\" -XAt -v ON_ERROR_STOP=1 -c \"select jsonb_build_object('app_members',(select count(*) from public.app_members),'app_owner',(select count(*) from public.app_owner),'audit_log',(select count(*) from public.audit_log),'business_settings',(select count(*) from public.business_settings),'contractors',(select count(*) from public.contractors),'idempotency_keys',(select count(*) from public.idempotency_keys),'opening_balances',(select count(*) from public.opening_balances),'payments',(select count(*) from public.payments),'trips',(select count(*) from public.trips),'vehicle_accounts',(select count(*) from public.vehicle_accounts),'vehicles',(select count(*) from public.vehicles),'backup_history',(select count(*) from public.backup_history))::text\" > /backup/table-counts.json",
    ].join("\n");
    const uid=typeof process.getuid==="function"?String(process.getuid()):"0",gid=typeof process.getgid==="function"?String(process.getgid()):"0";
    run("docker",["run","--rm","--network","host","--user",uid+":"+gid,"-e","SUPABASE_DB_URL","-v",work+":/backup","postgres:17.11-bookworm","sh","-ceu",containerScript],{env});
    const [buckets,objects]=readFileSync(join(work,"storage-counts.txt"),"utf8").trim().split("|").map(Number);
    assert(buckets===0&&objects===0,"Storage buckets/objects now exist; implement Storage object export before continuing.");
    const counts=JSON.parse(readFileSync(join(work,"table-counts.json"),"utf8"));
    const manifest={format:"1-mohamed-full-supabase-logical-backup",format_version:2,created_at:createdAt,cairo_backup_date:today,project_ref:EXPECTED_PROJECT_REF,source_commit:env.GITHUB_SHA||"0000000",postgres_version:readFileSync(join(work,"postgres-version.txt"),"utf8").trim(),public_table_counts:counts,public_tables_included:[...EXPECTED_PUBLIC_TABLES],auth_users_included:true,storage_objects_included:false};
    writeFileSync(join(work,"manifest.json"),JSON.stringify(manifest,null,2)+"\n",{mode:0o600});
    const dataSqlSha=await digest(join(work,"data.sql"),"sha256");
    const finalManifest=buildBackupManifest({createdAt,fileName,sourceCommit:manifest.source_commit,postgresVersion:manifest.postgres_version,tableCounts:counts,dataSqlSha256:dataSqlSha});
    writeFileSync(join(work,"manifest.json"),JSON.stringify(finalManifest,null,2)+"\n",{mode:0o600});
    const tar=join(work,"1-mohamed.tar.gz");run("tar",["-czf",tar,"-C",work,"roles.sql","schema.sql","data.sql","manifest.json"]);
    const finalEncrypted=tar+".age";run("age",["-r",env.AGE_RECIPIENT,"-o",finalEncrypted,tar]);
    const finalSha=await digest(finalEncrypted,"sha256"),finalSize=statSync(finalEncrypted).size;
    let uploaded,finishRetention;
    if(env.RCLONE_CONFIG_DRIVE_TOKEN) {
      const cloud=await prepareRcloneBackup(env,finalEncrypted,fileName,today,filesToPrune);
      uploaded=cloud.file;finishRetention=cloud.prune;
    } else {
      const token=await accessToken(env),folders=await folder(token,today),existing=await listFiles(token,folders.rootId);
      assert(!existing.some(f=>f.name===fileName),"A backup for "+today+" already exists; refusing a second daily snapshot.");
      uploaded=await upload(token,folders.monthId,finalEncrypted,fileName);
      finishRetention=()=>prune(token,folders.rootId,today);
    }
    await history(env,finalManifest,uploaded,finalSize,finalSha);
    const retention=await finishRetention();
    summary(["## Google Drive backup completed","- Cairo date: "+today,"- File: "+fileName,"- Encrypted size: "+finalSize+" bytes","- SHA-256: "+finalSha,"- Drive upload: verified","- Retention: 30 calendar days; expired files permanently deleted: "+retention.deleted,"- Public tables: 12; Auth user records and owner/member mappings included; users must re-authenticate after a project restore","- Storage objects: 0",""]);
    return {today,fileName,size:finalSize,sha256:finalSha,driveFileId:uploaded.id,retention};
  } finally {rmSync(work,{recursive:true,force:true});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  runOffsiteBackup().catch(error=>{console.error("Google Drive backup failed: "+(error?.message||String(error)));process.exitCode=1;});
}

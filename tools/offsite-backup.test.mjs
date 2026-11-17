import assert from "node:assert/strict";
import {test} from "node:test";
import {EXPECTED_PUBLIC_TABLES,RETENTION_DAYS,cairoDate,buildBackupFileName,retentionCutoff,filesToPrune,validateBackupEnvironment,verifyLogicalDump,buildBackupManifest} from "./offsite-backup.mjs";
import {backupFolderParts,verifyRcloneFile,isManagedBackupPath} from "./google-drive-rclone.mjs";
import {backupSafetyPolicy,runOffsiteBackup} from "./offsite-backup.mjs";
const env={SUPABASE_DB_URL:"postgresql://postgres.sskkuniskphlawivzudw:secret@aws-0-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require",AGE_RECIPIENT:"age1"+"a".repeat(40),GOOGLE_DRIVE_CLIENT_ID:"client.apps.googleusercontent.com",GOOGLE_DRIVE_CLIENT_SECRET:"client-secret",GOOGLE_DRIVE_REFRESH_TOKEN:"refresh-token"};
test("daily backup uses Cairo date and one stable filename",()=>{assert.equal(cairoDate("2026-11-17T22:30:00.000Z"),"2026-11-18");assert.equal(buildBackupFileName("2026-11-17T22:30:00.000Z"),"1-mohamed-2026-11-18.tar.gz.age");});
test("retention keeps the latest 30 Cairo calendar days",()=>{assert.equal(RETENTION_DAYS,30);assert.equal(retentionCutoff("2026-11-17"),"2026-10-19");const files=[{id:"old",name:"1-mohamed-2026-10-18.tar.gz.age"},{id:"first",name:"1-mohamed-2026-10-19.tar.gz.age"},{id:"today",name:"1-mohamed-2026-11-17.tar.gz.age"},{id:"other",name:"notes.txt"}];assert.deepEqual(filesToPrune(files,"2026-11-17").map(x=>x.id),["old"]);});
test("environment accepts only expected Supabase project and age public key",()=>{assert.equal(validateBackupEnvironment(env),true);assert.throws(()=>validateBackupEnvironment({...env,SUPABASE_DB_URL:env.SUPABASE_DB_URL.replace("sskkuniskphlawivzudw","wrong-project")}),/expected 1-mohamed/);assert.throws(()=>validateBackupEnvironment({...env,AGE_RECIPIENT:"AGE-SECRET-KEY-1TEST"}),/public recipient/);});
test("logical dump includes all public application data and Supabase Auth users",()=>{const rolesSql="CREATE ROLE authenticator;",schemaSql=EXPECTED_PUBLIC_TABLES.map(t=>"CREATE TABLE public."+t+" (id text);").join(" "),dataSql=[...EXPECTED_PUBLIC_TABLES.map(t=>"COPY public."+t+" (id) FROM stdin;"),"COPY auth.users (id,email,encrypted_password) FROM stdin;","COPY auth.identities (id,user_id) FROM stdin;"].join("\n");assert.equal(verifyLogicalDump({rolesSql,schemaSql,dataSql}),true);assert.throws(()=>verifyLogicalDump({rolesSql,schemaSql,dataSql:dataSql.replace("COPY public.payments (id) FROM stdin;","")}),/public.payments/);assert.throws(()=>verifyLogicalDump({rolesSql,schemaSql,dataSql:dataSql.replace("COPY auth.users (id,email,encrypted_password) FROM stdin;","")}),/auth.users/);assert.throws(()=>verifyLogicalDump({rolesSql,schemaSql,dataSql:dataSql.replace("COPY auth.identities (id,user_id) FROM stdin;","")}),/auth.identities/);});
test("manifest validates Cairo date, all 12 table counts and SQL data hash",()=>{const counts=Object.fromEntries(EXPECTED_PUBLIC_TABLES.map(t=>[t,0]));const m=buildBackupManifest({createdAt:"2026-11-17T01:00:00.000Z",fileName:"1-mohamed-2026-11-17.tar.gz.age",sourceCommit:"a".repeat(40),postgresVersion:"17.11",tableCounts:counts,dataSqlSha256:"b".repeat(64)});assert.equal(m.auth_users_included,true);assert.equal(m.auth_password_hashes_included,true);assert.equal(m.identity_mapping_rows_included,true);assert.equal(m.public_table_data_included.length,12);assert.equal(m.auth_identities_included,true);assert.equal(m.data_sql_sha256,"b".repeat(64));assert.throws(()=>buildBackupManifest({createdAt:"2026-11-17T01:00:00.000Z",fileName:"1-mohamed-2026-11-16.tar.gz.age",sourceCommit:"a".repeat(40),postgresVersion:"17.11",tableCounts:counts,dataSqlSha256:"b".repeat(64)}),/Cairo calendar date/);});

test("Drive layout nests each daily backup under year and month",()=>{
  assert.deepEqual(backupFolderParts("2026-11-17"),["1-mohamed-backups","2026","11 - November"]);
  assert.deepEqual(backupFolderParts("2027-01-02"),["1-mohamed-backups","2027","01 - January"]);
  assert.equal(retentionCutoff("2027-01-02"),"2026-12-04");
});
test("rclone transport works without manually creating a Google Cloud OAuth client",()=>{
  const rcloneEnv={...env,RCLONE_CONFIG_DRIVE_TOKEN:JSON.stringify({access_token:"redacted",refresh_token:"redacted"})};
  delete rcloneEnv.GOOGLE_DRIVE_CLIENT_ID;
  delete rcloneEnv.GOOGLE_DRIVE_CLIENT_SECRET;
  delete rcloneEnv.GOOGLE_DRIVE_REFRESH_TOKEN;
  assert.equal(validateBackupEnvironment(rcloneEnv),true);
  assert.equal(verifyRcloneFile({Name:"1-mohamed-2026-11-17.tar.gz.age",IsDir:false,Size:4,Hashes:{MD5:"abcd"},ID:"file-id"},"1-mohamed-2026-11-17.tar.gz.age",4,"abcd"),true);
  assert.throws(()=>verifyRcloneFile({Name:"bad",IsDir:false,Size:4,Hashes:{MD5:"abcd"},ID:"file-id"},"expected",4,"abcd"),/metadata/);
});

test("manual trial defaults to no production history writes and no deletion",()=>{
  assert.deepEqual(backupSafetyPolicy({}),{retention:false,recordHistory:false});
  assert.deepEqual(backupSafetyPolicy({BACKUP_RESTORE_VERIFIED:"true"}),{retention:false,recordHistory:false});
});
test("retention cannot activate before restore verification and history recording",async()=>{
  for(const settings of [
    {BACKUP_RETENTION_ENABLED:"true"},
    {BACKUP_RETENTION_ENABLED:"true",BACKUP_RESTORE_VERIFIED:"true"},
    {BACKUP_RETENTION_ENABLED:"true",BACKUP_RECORD_HISTORY:"true"},
  ]) await assert.rejects(runOffsiteBackup(settings),/Retention requires/);
  assert.equal(backupSafetyPolicy({BACKUP_RETENTION_ENABLED:"true",BACKUP_RECORD_HISTORY:"true",BACKUP_RESTORE_VERIFIED:"true"}).retention,true);
});
test("scheduled runs refuse partial activation before touching database or Drive",async()=>{
  for(const settings of [{},{BACKUP_ENABLED:"true"},{BACKUP_ENABLED:"true",BACKUP_RESTORE_VERIFIED:"true"}])
    await assert.rejects(runOffsiteBackup({...settings,GITHUB_EVENT_NAME:"schedule"}),/Scheduled backups require/);
  assert.equal(backupSafetyPolicy({GITHUB_EVENT_NAME:"schedule",BACKUP_ENABLED:"true",BACKUP_RESTORE_VERIFIED:"true",BACKUP_RECORD_HISTORY:"true"}).recordHistory,true);
});
test("deletion only recognizes exact archive date and year/month path",()=>{
  const name="1-mohamed-2026-10-18.tar.gz.age";
  assert.equal(isManagedBackupPath("2026/10 - October/"+name,name),true);
  for(const path of [name,"2026/personal/"+name,"2026/11 - November/"+name,"2026/10 - October/../"+name,"2026/10 - October/nested/"+name])
    assert.equal(isManagedBackupPath(path,name),false);
  assert.equal(isManagedBackupPath("2026/02 - February/1-mohamed-2026-02-30.tar.gz.age","1-mohamed-2026-02-30.tar.gz.age"),false);
});

test("Auth recovery refuses a users dump without password hashes",()=>{
 const rolesSql="CREATE ROLE authenticator;", schemaSql=EXPECTED_PUBLIC_TABLES.map(t=>"CREATE TABLE public."+t+" (id text);").join(" ");
 const dataSql=[...EXPECTED_PUBLIC_TABLES.map(t=>"COPY public."+t+" (id) FROM stdin;"),"COPY auth.users (id,email) FROM stdin;","COPY auth.identities (id,user_id) FROM stdin;"].join("\n");
 assert.throws(()=>verifyLogicalDump({rolesSql,schemaSql,dataSql}),/password hashes/);
});

import pg from 'pg';
import { readFileSync, statSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { BUSINESS_TABLES, digest } from './business-snapshot.mjs';
import { recoveryTarget, restoreEmptyLedger } from './business-restore.mjs';
import { caCertificate } from './export.mjs';

async function restore(archive,env){
 if(!archive||statSync(archive).size>256*1024*1024||!/^([a-f0-9]{64})$/.test(env.BACKUP_EXPECTED_SHA256||'')||digest(readFileSync(archive))!==env.BACKUP_EXPECTED_SHA256)throw Error('Archive does not match the trusted SHA-256');
 const local=mkdtempSync(join(tmpdir(),'business-restore-'));
 let client;
 try{
  const script=fileURLToPath(new URL('./extract-business.py',import.meta.url));
  const extract=spawnSync(env.BACKUP_PYTHON||'python3',[script,archive,local,'manifest.json',...BUSINESS_TABLES.map(t=>t+'.json')],{stdio:'ignore',timeout:120000,windowsHide:true});
  if(extract.error||extract.status!==0)throw Error('Invalid recovery archive');
  client=new pg.Client(recoveryTarget(env.RESTORE_TARGET_REF,env.RESTORE_DB_URL,await caCertificate()));
  await client.connect();
  console.log(JSON.stringify(await restoreEmptyLedger(client,local)));
 }finally{await client?.end().catch(()=>{});rmSync(local,{recursive:true,force:true});}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 restore(process.argv[2],process.env).catch(err=>{console.error('Recovery failed: '+(err.code||err.message));process.exitCode=1;});
}

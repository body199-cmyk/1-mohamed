import pg from 'pg';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUSINESS_FORMAT, BUSINESS_TABLES, digest, writeBusinessSnapshot } from './business-snapshot.mjs';

const workbookScript=fileURLToPath(new URL('./business-xlsx.py',import.meta.url));
function run(command,args){
 const result=spawnSync(command,args,{stdio:'ignore',timeout:120000,windowsHide:true});
 if(result.error||result.status!==0)throw Error('Backup file creation failed: '+command);
}

export async function createBusinessFiles(config,{date,commit,tempRoot=tmpdir(),python='python3'}){
 const dir=mkdtempSync(join(tempRoot,'business-recovery-'));
 const snapshot=join(dir,'snapshot');
 const client=new pg.Client(config);
 let connected=false;
 const cleanup=()=>rmSync(dir,{recursive:true,force:true});
 try{
  await client.connect();connected=true;
  await client.query('begin isolation level repeatable read read only');
  await client.query("set local timezone='UTC'");
  const actual=await client.query("select count(*)::int as n from (select 1 from storage.buckets union all select 1 from storage.objects) objects");
  if(actual.rows[0].n!==0)throw Error('Storage files require a separate backup policy');
  const manifest=await writeBusinessSnapshot(client,snapshot,{date,commit});
  await client.query('commit');
  await client.end();connected=false;
  const fileName=`1-mohamed-${date}-restore.tar.gz`, excelName=`1-mohamed-${date}-excel.xlsx`;
  const path=join(dir,fileName), excelPath=join(dir,excelName);
  run('tar',['-czf',path,'-C',snapshot,'manifest.json',...BUSINESS_TABLES.map(t=>t+'.json')]);
  run(python,[workbookScript,snapshot,excelPath]);
  return {format:BUSINESS_FORMAT,fileName,path,excelName,excelPath,cairoDate:date,
   size:statSync(path).size,sha256:digest(readFileSync(path)),tables:BUSINESS_TABLES.length,
   tableCounts:Object.fromEntries(Object.entries(manifest.tables).map(([table,info])=>[table,info.count])),cleanup};
 }catch(err){cleanup();throw err;}
 finally{if(connected)await client.end().catch(()=>{});}
}

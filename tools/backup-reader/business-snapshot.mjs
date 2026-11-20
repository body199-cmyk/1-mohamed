import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const BUSINESS_FORMAT='1-mohamed-business-recovery-v1';
// Insert in dependency order. Auth, owner/member mappings and backup metadata are not exported.
export const BUSINESS_TABLES=Object.freeze([
 'contractors','vehicles','vehicle_accounts','business_settings',
 'opening_balances','trips','payments','audit_log','idempotency_keys'
]);
export const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export const readRowsSql=(table,{legacyOpening=false}={})=>{
 if(!BUSINESS_TABLES.includes(table))throw Error('Unexpected backup table');
 // A pre-policy archive has no prior_work_handling key. For its exact-match
 // check, compare only the original projected columns, never weaken SHA-256.
 const projection=table==='opening_balances'&&legacyOpening
  ? "to_jsonb(t)-'prior_work_handling'" : 'to_jsonb(t)';
 return `select coalesce(jsonb_agg(j order by convert_to(j::text,'UTF8')),'[]'::jsonb)::text as rows
 from (select ${projection} as j from public.${table} t) s`;
};

export async function writeBusinessSnapshot(client,dir,{date,commit}){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^[a-f0-9]{40}$/.test(commit))throw Error('Invalid backup date or revision');
 mkdirSync(dir,{recursive:true,mode:0o700});
 const manifest={format:BUSINESS_FORMAT,cairo_date:date,source_commit:commit,tables:{}};
 for(const table of BUSINESS_TABLES){
  const data=(await client.query(readRowsSql(table))).rows[0]?.rows;
  if(typeof data!=='string')throw Error('Database did not return backup rows');
  const rows=JSON.parse(data);
  if(!Array.isArray(rows))throw Error('Expected JSON array');
  // Keep the PostgreSQL text unmodified: JS numbers cannot round-trip bigint.
  writeFileSync(join(dir,table+'.json'),data,{mode:0o600});
  manifest.tables[table]={count:rows.length,sha256:digest(data)};
 }
 writeFileSync(join(dir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{mode:0o600});
 return manifest;
}

export function loadBusinessSnapshot(dir){
 const manifest=JSON.parse(readFileSync(join(dir,'manifest.json'),'utf8'));
 if(manifest.format!==BUSINESS_FORMAT||Object.keys(manifest.tables??{}).sort().join(',')!==[...BUSINESS_TABLES].sort().join(','))throw Error('Unexpected recovery manifest');
 const payloads=new Map();
 for(const table of BUSINESS_TABLES){
  const data=readFileSync(join(dir,table+'.json'),'utf8'), expected=manifest.tables[table];
  if(digest(data)!==expected.sha256)throw Error('Recovery checksum mismatch: '+table);
  const rows=JSON.parse(data);
  if(!Array.isArray(rows)||rows.length!==expected.count||rows.some(r=>!r||Array.isArray(r)||typeof r!=='object'))throw Error('Recovery rows are invalid: '+table);
  payloads.set(table,data);
 }
 return {manifest,payloads};
}

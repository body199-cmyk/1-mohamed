import {EXPECTED_PUBLIC_TABLES} from '../offsite-backup.mjs';
export const RESTORE_REF='xvmnmdxdhymllsdyhlth';
export function restoreConnection(value,ca){
 let u;try{u=new URL(value);}catch{throw Error('Invalid restore connection');}
 if(!['postgres:','postgresql:'].includes(u.protocol)||u.hostname!=='aws-0-eu-central-1.pooler.supabase.com'||decodeURIComponent(u.username)!==`offsite_restore_operator.${RESTORE_REF}`||u.pathname!=='/postgres'||(u.port&&u.port!=='5432')||!u.password)throw Error('Restore must target the separate drill project and scoped operator');
 return {host:u.hostname,port:5432,user:decodeURIComponent(u.username),password:decodeURIComponent(u.password),database:'postgres',ssl:{ca,rejectUnauthorized:true},connectionTimeoutMillis:15000,application_name:'isolated-backup-restore'};
}
export function dataOperations(sql){
 const lines=sql.split(/\r?\n/),ops=[],tables=new Set();
 for(let i=0;i<lines.length;i++){
  const line=lines[i].trim();
  if(!line||line.startsWith('--')||/^\\(?:un)?restrict [A-Za-z0-9_+\/=-]+$/.test(line)||line==="SELECT pg_catalog.set_config('search_path', '', false);")continue;
  if(/^SET (statement_timeout|lock_timeout|idle_in_transaction_session_timeout|transaction_timeout|client_encoding|standard_conforming_strings|check_function_bodies|xmloption|client_min_messages|row_security) = [^;]+;$/.test(line))continue;
  const copy=/^COPY (public|auth)\.([a-z_]+) \((.+)\) FROM stdin;$/.exec(line);
  if(copy){
   const [,schema,table,columnText]=copy,key=schema+'.'+table;
   if((schema==='public'&&!EXPECTED_PUBLIC_TABLES.includes(table))||(schema==='auth'&&!['users','identities'].includes(table))||tables.has(key))throw Error('Unexpected or repeated recovery table');
   tables.add(key);
   const columns=columnText.split(',').map(c=>c.trim());
   if(columns.some(c=>!/^"(?:[^"]|"")+"$|^[a-z_][a-z0-9_]*$/.test(c)))throw Error('Invalid COPY column identifier');
   const rows=[];while(++i<lines.length&&lines[i]!=='\\.')rows.push(lines[i]);
   if(i===lines.length)throw Error('Truncated COPY block');
   const destination=schema==='auth'?'backup_auth_restore':schema;
   ops.push({type:'copy',key,sql:`COPY ${destination}.${table} (${columns.join(', ')}) FROM STDIN`,data:rows.length?rows.join('\n')+'\n':''});
   continue;
  }
  const sequence=/^SELECT pg_catalog\.setval\('(public\.[a-z_][a-z0-9_]*)', (\d+), (true|false)\);$/.exec(line);
  if(sequence){ops.push({type:'sequence',name:sequence[1],value:sequence[2],called:sequence[3]==='true'});continue;}
  throw Error('Unsupported statement in recovery data; no arbitrary SQL allowed');
 }
 return ops;
}

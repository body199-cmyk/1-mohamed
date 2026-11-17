import {createHash} from 'node:crypto';
export const SOURCE_REF='sskkuniskphlawivzudw';
export const READER='offsite_backup_reader';
export const AUTH_TABLES=Object.freeze(['users','identities']);
export const CA_SHA256='807025ad50d4ed219d2c9c7d299c004f824eb00cf7f65afef607d07b72e6cafa';
export function sourceConnection(value,ca) {
 let u;try{u=new URL(value);}catch{throw Error('Invalid source database URL');}
 const hostOk=u.hostname===`db.${SOURCE_REF}.supabase.co` || u.hostname==='aws-1-eu-central-1.pooler.supabase.com';
 const user=decodeURIComponent(u.username);
 if(!['postgres:','postgresql:'].includes(u.protocol)||!hostOk||u.pathname!=='/postgres'||(u.port&&u.port!=='5432')||!u.password||!([READER,`${READER}.${SOURCE_REF}`].includes(user)))throw Error('Unexpected source project or backup role');
 if(u.hostname.includes('pooler')&&user!==`${READER}.${SOURCE_REF}`)throw Error('Pooler project binding missing');
 // COPY streaming queries do not settle pg's callback-based query_timeout timer.
 // The approved source role already has a server-side 15-minute statement_timeout.
 return {host:u.hostname,port:5432,user,password:decodeURIComponent(u.password),database:'postgres',ssl:{ca,rejectUnauthorized:true},connectionTimeoutMillis:15000,application_name:'offsite-reader-export'};
}
export function quoteIdentifier(value){return '"'+String(value).replaceAll('"','""')+'"';}
export function authCopyHeader(table,columns) {
 if(!AUTH_TABLES.includes(table)||!Array.isArray(columns)||!columns.length||!columns.includes('id')||(table==='users'&&!columns.includes('encrypted_password'))||(table==='identities'&&!columns.includes('user_id')))throw Error('Incomplete Auth export columns');
 return `COPY auth.${table} (${columns.map(quoteIdentifier).join(', ')}) FROM stdin;\n`;
}
export function tableFingerprintSql(schema,table,columns) {
 const relation=quoteIdentifier(schema)+'.'+quoteIdentifier(table);
 const rows=columns?`(select ${columns.map(quoteIdentifier).join(',')} from ${relation})`:relation;
 return `select count(*)::text as count,encode(sha256(convert_to(coalesce(string_agg(h,'' order by h),''),'UTF8')),'hex') as sha256 from (select encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex') as h from ${rows} t) q`;
}
export function archiveDigest(bytes){return createHash('sha256').update(bytes).digest('hex');}

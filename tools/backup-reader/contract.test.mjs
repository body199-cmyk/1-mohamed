import assert from 'node:assert/strict';
import {test} from 'node:test';
import {sourceConnection,authCopyHeader,quoteIdentifier} from './contract.mjs';
const url='postgresql://offsite_backup_reader.sskkuniskphlawivzudw:fixture@aws-1-eu-central-1.pooler.supabase.com:5432/postgres';
test('reader exporter binds the real source host, project and restricted role',()=>{
 const c=sourceConnection(url,'public-ca');assert.equal(c.ssl.rejectUnauthorized,true);assert.equal(c.user,'offsite_backup_reader.sskkuniskphlawivzudw');
 for(const value of [url.replace('sskkuniskphlawivzudw','other-project'),url.replace('aws-1-eu-central-1.pooler.supabase.com','evil.example'),url.replace('offsite_backup_reader.sskkuniskphlawivzudw','postgres.sskkuniskphlawivzudw'),url.replace(':5432',':6543'),url.replace('/postgres','/other')])assert.throws(()=>sourceConnection(value,'ca'),/Unexpected/);
});
test('Auth COPY export preserves column names and rejects incomplete account recovery',()=>{
 assert.equal(authCopyHeader('users',['id','encrypted_password']),'COPY auth.users ("id", "encrypted_password") FROM stdin;\n');
 for(const [table,columns] of [['sessions',['id']],['users',['id','email']],['identities',['id']]])assert.throws(()=>authCopyHeader(table,columns),/Incomplete/);
 assert.equal(quoteIdentifier('a"b'),'"a""b"');
});

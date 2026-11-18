import {test} from 'node:test';import assert from 'node:assert/strict';
import {dataOperations,restoreConnection} from './restore-contract.mjs';
test('restore connection cannot target source or an administrative login',()=>{
 const target='postgresql://offsite_restore_operator.xvmnmdxdhymllsdyhlth:fixture@aws-0-eu-central-1.pooler.supabase.com:5432/postgres';
 assert.equal(restoreConnection(target,'ca').ssl.rejectUnauthorized,true);
 for(const value of [target.replace('xvmnmdxdhymllsdyhlth','sskkuniskphlawivzudw'),target.replace('offsite_restore_operator','postgres'),target.replace('aws-0-','aws-1-')])assert.throws(()=>restoreConnection(value,'ca'),/separate/);
});
test('COPY data remains data, preserves exact money text and maps only permitted Auth tables',()=>{
 const sql='COPY public.payments (id, amount_piastres, notes) FROM stdin;\nx\t9007199254740993123\tDELETE FROM auth.users;\n\\.\nCOPY auth.users ("id", "encrypted_password") FROM stdin;\nu\thash-fixture\n\\.\n';
 const ops=dataOperations(sql);assert.equal(ops[0].data,'x\t9007199254740993123\tDELETE FROM auth.users;\n');assert.match(ops[1].sql,/backup_auth_restore.users/);
});
test('restore refuses arbitrary SQL, incomplete copies and unauthorized or repeated tables',()=>{
 for(const sql of ['DELETE FROM public.trips;','COPY auth.sessions (id) FROM stdin;\n\\.','COPY public.trips (id) FROM stdin;\nx','COPY public.trips (id) FROM stdin;\n\\.\nCOPY public.trips (id) FROM stdin;\n\\.'])assert.throws(()=>dataOperations(sql));
});

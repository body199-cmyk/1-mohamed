import test from 'node:test';
import assert from 'node:assert/strict';
import { selectDisasterArchive,validateDisasterConsent } from './disaster-recovery.mjs';
import { SOURCE_REF } from './contract.mjs';

const target='xvmnmdxdhymllsdyhlth';
const env={
 GITHUB_EVENT_NAME:'workflow_dispatch',
 BACKUP_RESTORE_TARGET_ONLY:'true',
 RESTORE_TARGET_CONFIRMATION:'RESTORE_TO_EMPTY_SEPARATE_PROJECT',
 RESTORE_TARGET_REF:target,
 RESTORE_DB_URL:'postgresql://postgres.'+target+':fake@aws-0-eu-central-1.pooler.supabase.com:5432/postgres',
 BACKUP_DISASTER_SOURCE_UNAVAILABLE:'true',
 BACKUP_REHEARSAL_DATE:'2026-11-19',
 BACKUP_DISASTER_EXPECTED_SHA256:'f'.repeat(64),
};

test('source-offline disaster recovery accepts only a different empty target and manual confirmation',()=>{
 assert.deepEqual(validateDisasterConsent(env),{date:'2026-11-19',independentlyVerified:true});
 for(const bad of [
   {GITHUB_EVENT_NAME:'schedule'},
   {BACKUP_RESTORE_TARGET_ONLY:'false'},
   {RESTORE_TARGET_CONFIRMATION:'guess'},
   {RESTORE_TARGET_REF:SOURCE_REF},
   {BACKUP_DISASTER_SOURCE_UNAVAILABLE:'false'},
   {BACKUP_REHEARSAL_DATE:'2026-02-30'},
   {BACKUP_DISASTER_EXPECTED_SHA256:'xyz'},
 ])assert.throws(()=>validateDisasterConsent({...env,...bad}));
 assert.deepEqual(validateDisasterConsent({
   ...env,BACKUP_DISASTER_EXPECTED_SHA256:'',
   BACKUP_DISASTER_UNVERIFIED_CONFIRMATION:'I_ACCEPT_UNVERIFIED_SOURCE_TO_EMPTY_TARGET_ONLY'
 }),{date:'2026-11-19',independentlyVerified:false});
 assert.throws(()=>validateDisasterConsent({...env,BACKUP_DISASTER_EXPECTED_SHA256:''}),/confirmation/);
});

test('source-offline selection matches the exact managed Drive date/path, ID and bytes',()=>{
 const path='2026/11 - November/1-mohamed-2026-11-19-restore.tar.gz';
 const item={Name:'1-mohamed-2026-11-19-restore.tar.gz',Path:path,ID:'drive_id_12345',
    Size:210345,IsDir:false};
 const result=selectDisasterArchive('2026-11-19',[item]);
 assert.equal(result.remote,'drive:1-mohamed-backups/'+path);
 assert.equal(result.size,210345);
 assert.equal(result.id,'drive_id_12345');
 for(const wrong of [
   [{...item,Path:'_restore-drill/'+item.Name}],
   [{...item,Name:'1-mohamed-2026-11-18-restore.tar.gz'}],
   [{...item,ID:'unknown'}],
   [{...item,Size:0}],
   [{...item,Size:300_000_000}],
   [{...item,IsDir:true}],
   [item,item],
   [],
 ])assert.throws(()=>selectDisasterArchive('2026-11-19',wrong));
 for(const date of ['../../escape','2026-02-30','2026-13-01'])assert.throws(()=>selectDisasterArchive(date,[item]));
});

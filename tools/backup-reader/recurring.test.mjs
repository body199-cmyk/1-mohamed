import test from 'node:test';
import assert from 'node:assert/strict';
import { recurringPolicy } from './recurring.mjs';

const drill={
 GITHUB_EVENT_NAME:'workflow_dispatch',BACKUP_RECURRING_DRILL:'true',
 BACKUP_RECORD_HISTORY:'true',BACKUP_ENABLED:'false',BACKUP_RETENTION_ENABLED:'false',
 BACKUP_RESTORE_VERIFIED:'false'
};

test('manual recurring drill records history but cannot activate schedule or retention',()=>{
 assert.deepEqual(recurringPolicy(drill),{recordHistory:true,retention:false});
 for(const [name,value] of Object.entries({
  BACKUP_RECURRING_DRILL:'false',BACKUP_RECORD_HISTORY:'false',
  BACKUP_ENABLED:'true',BACKUP_RETENTION_ENABLED:'true'
 }))assert.throws(()=>recurringPolicy({...drill,[name]:value}));
 assert.throws(()=>recurringPolicy({...drill,GITHUB_EVENT_NAME:'pull_request'}));
});

test('scheduled backup requires all activation gates and keeps retention opt-in',()=>{
 const scheduled={...drill,GITHUB_EVENT_NAME:'schedule',BACKUP_RECURRING_DRILL:'false',BACKUP_ENABLED:'true',BACKUP_RESTORE_VERIFIED:'true'};
 assert.deepEqual(recurringPolicy(scheduled),{recordHistory:true,retention:false});
 for(const key of ['BACKUP_ENABLED','BACKUP_RESTORE_VERIFIED','BACKUP_RECORD_HISTORY'])assert.throws(()=>recurringPolicy({...scheduled,[key]:'false'}));
 assert.deepEqual(recurringPolicy({...scheduled,BACKUP_RETENTION_ENABLED:'true'}),{recordHistory:true,retention:true});
});

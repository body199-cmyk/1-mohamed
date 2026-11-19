import test from 'node:test';
import assert from 'node:assert/strict';
import { selectedCloudArchive, onlyReadFromDrive } from './cloud-rehearsal-contract.mjs';
import { BUSINESS_FORMAT } from './business-snapshot.mjs';

const date = '2026-11-19';
const name = '1-mohamed-2026-11-19-restore.tar.gz';
const path = '2026/11 - November/' + name;
const history = { backup_date:date, format:BUSINESS_FORMAT, file_name:name,
  drive_file_id:'safeDriveId_ABC123456789', sha256:'a'.repeat(64),
  size_bytes:'1200' };
const file = { Name:name, Path:path, IsDir:false, ID:history.drive_file_id, Size:1200 };

test('selected Drive backup requires an exact history date, file ID and managed path',()=>{
  const s=selectedCloudArchive(date,history,file);
  assert.equal(s.remote,'drive:1-mohamed-backups/'+path);
  assert.equal(s.sha256,'a'.repeat(64));
  for (const [h,f] of [
    [{ ...history, drive_file_id:'badId000' }, file],
    [history,{ ...file, Path:'_restore-drill/'+name }],
    [history,{ ...file, ID:'unrelatedIdABC' }],
    [history,{ ...file, Size:1201 }],
    [{ ...history, format:'1-mohamed-full-supabase-logical-backup' },file],
    [{ ...history, sha256:'abc' }, file],
    [{ ...history, file_name:'other.tar.gz' }, file],
    [{ ...history, size_bytes:'270000000' },file],
  ]) assert.throws(()=>selectedCloudArchive(date,h,f),/Cloud restore rehearsal/);
  assert.throws(()=>selectedCloudArchive('2026-02-30',history,file),/BACKUP_INVALID/);
  assert.throws(()=>selectedCloudArchive('../../bad',history,file),/BACKUP_INVALID/);
});

test('strict Drive allowlist denies all uploads, deletion and arbitrary paths',()=>{
 const remote = 'drive:1-mohamed-backups/2026/11 - November/1-mohamed-2026-11-19-restore.tar.gz';
 const local = '/tmp/verified-rehearsal/selected.tar.gz';
 assert.deepEqual(onlyReadFromDrive(['lsjson','drive:1-mohamed-backups','--recursive','--files-only','--hash']),['lsjson','drive:1-mohamed-backups','--recursive','--files-only','--hash']);
 assert.deepEqual(onlyReadFromDrive(['copyto',remote,local,'--immutable'],remote,local),['copyto',remote,local,'--immutable']);
 for(const args of [
  ['deletefile',remote],
  ['copyto',local,remote,'--immutable'],
  ['copyto',remote,'drive:external/something','--immutable'],
  ['copyto',remote,'/tmp/../other','--immutable'],
  ['copyto',remote,local,'--drive-use-trash=false'],
  ['sync',remote,local],
  ['lsjson','drive:','--recursive','--files-only','--hash']
 ]) assert.throws(()=>onlyReadFromDrive(args,remote,local),/unsafe Drive operation blocked/);
});

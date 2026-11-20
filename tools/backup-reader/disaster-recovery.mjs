/**
 * Disaster mode: source Supabase can be completely unavailable.
 *
 * Uses ONLY a protected Google Drive credential to locate one file by date;
 * restores nine business tables into a different, EMPTY recovery project.
 * Preserves the original project and does not migrate authentication/logins.
 *
 * A previously recorded SHA-256 is preferred. If unavailable because the
 * original DB is lost, explicit independent consent is mandatory; the archive
 * is then only structurally/manifest consistent, NOT independently authentic.
 */
import { createHash } from 'node:crypto';
import { createReadStream, mkdtempSync, rmSync, lstatSync } from 'node:fs';
import { basename, join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { backupFolderParts, ROOT_FOLDER } from '../google-drive-rclone.mjs';
import { readOnlyDriveCommand } from './cloud-rehearsal.mjs';
import { verifySelectedLocalArchive } from './cloud-rehearsal-local.mjs';
import {
  requireIsolatedTarget, restoreVerifiedArchiveToEmptyTarget,
} from './restore-selected-drive-to-empty-target.mjs';

export function selectDisasterArchive(date, remoteFiles) {
  const folder = backupFolderParts(date).slice(1).join('/');
  const name = '1-mohamed-' + date + '-restore.tar.gz';
  const path = folder + '/' + name;
  if(!Array.isArray(remoteFiles)) throw Error('Drive listing is invalid');
  const matches=remoteFiles.filter(f=>f && f.Path===path && f.Name===name && f.IsDir===false);
  if(matches.length!==1 || !Number.isSafeInteger(Number(matches[0].Size)) ||
    Number(matches[0].Size)<1 || Number(matches[0].Size)>256*1024*1024 ||
    typeof matches[0].ID!=='string' || !/^[A-Za-z0-9_-]{8,256}$/.test(matches[0].ID)){
    throw Error('Selected managed business recovery archive is missing or ambiguous');
  }
  return {
    date, name, id:matches[0].ID,
    size:Number(matches[0].Size),
    remote:'drive:' + ROOT_FOLDER + '/' + path,
  };
}

export function validateDisasterConsent(env) {
  requireIsolatedTarget(env);
  if(env.BACKUP_DISASTER_SOURCE_UNAVAILABLE !== 'true' ||
    env.BACKUP_REHEARSAL_DATE===undefined){
    throw Error('Source-offline disaster mode must be explicitly selected');
  }
  backupFolderParts(env.BACKUP_REHEARSAL_DATE);
  const hash=env.BACKUP_DISASTER_EXPECTED_SHA256;
  if(hash && !/^[a-f0-9]{64}$/.test(hash)){
    throw Error('Provided trusted SHA-256 is invalid');
  }
  if(!hash && env.BACKUP_DISASTER_UNVERIFIED_CONFIRMATION !==
    'I_ACCEPT_UNVERIFIED_SOURCE_TO_EMPTY_TARGET_ONLY'){
    throw Error('Without a previous independent SHA, explicit empty-target-only confirmation is mandatory');
  }
  return {date:env.BACKUP_REHEARSAL_DATE,independentlyVerified:!!hash};
}

async function fileSha(path) {
  const hash=createHash('sha256');
  for await (const chunk of createReadStream(path))hash.update(chunk);
  return hash.digest('hex');
}

export async function recoverWhenSourceIsUnavailable(env=process.env) {
  const gate=validateDisasterConsent(env);
  const work=mkdtempSync(join(env.RUNNER_TEMP||tmpdir(),'disaster-to-empty-target-'));
  try{
    const listing=JSON.parse(readOnlyDriveCommand(env,[
      'lsjson','drive:'+ROOT_FOLDER,'--recursive','--files-only','--hash'
    ]));
    const selected=selectDisasterArchive(gate.date,listing);
    const archive=join(work,basename(selected.name));
    readOnlyDriveCommand(env,['copyto',selected.remote,archive,'--immutable'],
      selected.remote,archive);
    const stat=lstatSync(archive);
    if(!stat.isFile()||stat.isSymbolicLink()||stat.size!==selected.size){
      throw Error('Downloaded disaster archive size/path does not match Drive listing');
    }
    const sha=await fileSha(archive);
    if(gate.independentlyVerified && sha!==env.BACKUP_DISASTER_EXPECTED_SHA256){
      throw Error('Downloaded archive does not match the previously trusted SHA');
    }
    // Even without an external SHA, the archive must independently pass
    // the inner nine-table manifest and an isolated PostgreSQL replay.
    await verifySelectedLocalArchive(archive,{sha256:sha,size:selected.size});
    const applied=restoreVerifiedArchiveToEmptyTarget(env,archive,sha);
    return {
      backup_date:gate.date,
      drive_file_id:selected.id,
      independent_sha256_match:gate.independentlyVerified,
      internal_manifest_verified:true,
      isolated_pglite_replay_verified:true,
      ...applied,
      auth_users_restored:false,
      original_source_read:false,
      original_source_modified:false,
    };
  }finally{
    rmSync(work,{recursive:true,force:true});
  }
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  recoverWhenSourceIsUnavailable().then(data=>console.log(JSON.stringify(data)))
    .catch(error=>{console.error('Source-offline disaster recovery failed: '+(error.code||error.message));
      process.exitCode=1;});
}

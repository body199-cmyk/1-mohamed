/**
 * Emergency BUSINESS DATA recovery, never a production overwrite.
 *
 * Runs only on manual GitHub workflow with its protected environment.
 * Source: restricted read-only history query and a verified Drive file.
 * Target: a *different*, freshly migrated, EMPTY Supabase project.
 * Import: existing restoreEmptyLedger (atomic transaction, row hashes,
 * no transient identities, no extra tables, zero existing business rows).
 *
 * No migration, Auth account creation, URL cutover, or production replacement
 * is attempted. Explicit owner/Auth re-provisioning is a separate step.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { recoveryTarget } from './business-restore.mjs';
import { withVerifiedSelectedCloudArchive } from './cloud-rehearsal.mjs';

export function requireIsolatedTarget(env) {
  if(env.GITHUB_EVENT_NAME !== 'workflow_dispatch' ||
     env.BACKUP_RESTORE_TARGET_ONLY !== 'true' ||
     env.RESTORE_TARGET_CONFIRMATION !== 'RESTORE_TO_EMPTY_SEPARATE_PROJECT') {
    throw Error('An explicit protected and manually approved isolated recovery is required');
  }
  if(!env.RESTORE_DB_URL) throw Error('Missing separate restore-target database secret');
  // Validate project ID/host/user/port and reject original project before
  // reading any cloud archive. CA is pinned by the actual restore subprocess.
  recoveryTarget(env.RESTORE_TARGET_REF,env.RESTORE_DB_URL,'preflight-validation-only');
  return true;
}

export async function restoreSelectedDriveToEmptyTarget(env=process.env) {
  requireIsolatedTarget(env);
  return withVerifiedSelectedCloudArchive(env,async(archive,selection)=>
    restoreVerifiedArchiveToEmptyTarget(env,archive,selection.sha256));
}

export function restoreVerifiedArchiveToEmptyTarget(env,archive,sha256) {
    requireIsolatedTarget(env);
    if (typeof sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(sha256)) {
      throw Error('Missing a verified archive SHA-256');
    }
    // Existing CLI validates SHA-256 and the distinct source/target
    // connection once more, then refuses any occupied nine-table target.
    const command=fileURLToPath(new URL('./business-restore-cli.mjs',import.meta.url));
    const result=spawnSync(process.execPath,[command,archive],{
      env:{
        PATH:env.PATH,
        HOME:env.HOME,
        NODE_ENV:env.NODE_ENV,
        RESTORE_DB_URL:env.RESTORE_DB_URL,
        RESTORE_TARGET_REF:env.RESTORE_TARGET_REF,
        BACKUP_EXPECTED_SHA256:sha256,
        BACKUP_RESTORE_TARGET_ONLY:'true',
      },
      encoding:'utf8',maxBuffer:8192,stdio:['ignore','pipe','pipe'],
      timeout:180_000,
    });
    if(result.error||result.status!==0){
      // Do not echo env, full stderr, DB credentials or original row data.
      throw Error('Separate-target recovery rejected; archive or target was not empty/compatible');
    }
    let restored;
    try { restored=JSON.parse((result.stdout||'').trim()); }
    catch { throw Error('Separate-target recovery confirmation is invalid'); }
    if(restored.exactMatch!==true || restored.restoredTables!==9){
      throw Error('Separate-target recovery did not verify all nine business tables');
    }
    return {separate_empty_target_restored:true,
      restored_tables:9,
      auth_users_restored:false,
      production_target_modified:false};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  restoreSelectedDriveToEmptyTarget().then(summary=>console.log(JSON.stringify(summary)))
    .catch(e=>{console.error('Controlled recovery failed: '+(e.code||e.message));
      process.exitCode=1;});
}

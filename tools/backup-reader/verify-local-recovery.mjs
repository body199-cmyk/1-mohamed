/**
 * Offline local-file recovery drill; useful for a business archive downloaded
 * onto a laptop/phone and transferred to this machine.
 *
 * Usage:
 *   node tools/backup-reader/verify-local-recovery.mjs \
 *      /absolute/path/1-mohamed-YYYY-MM-DD-restore.tar.gz \
 *      <trusted_sha256_from_backup_history>
 *
 * No database URLs, auth tokens, Drive API calls or production writes.
 * The archive is reconstituted ONLY in ephemeral PGlite and discarded.
 */
import { lstatSync } from 'node:fs';
import { basename, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { verifySelectedLocalArchive } from './cloud-rehearsal-local.mjs';
import { backupFolderParts } from '../google-drive-rclone.mjs';

export async function verifyLocalRecoveryFile(path, expectedSha256) {
  if (typeof path !== 'string' || !isAbsolute(path)) {
    throw Error('An absolute local backup file path is required');
  }
  const match = /^1-mohamed-(\d{4}-\d{2}-\d{2})-restore\.tar\.gz$/.exec(basename(path));
  if (!match) {
    throw Error('Only an application business recovery archive is supported');
  }
  backupFolderParts(match[1]); // strict valid backup date
  if (typeof expectedSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(expectedSha256)) {
    throw Error('Supply the trusted SHA-256 from backup history');
  }
  const meta=lstatSync(path);
  if (!meta.isFile() || meta.isSymbolicLink() || meta.size < 1 ||
      meta.size > 256*1024*1024) {
    throw Error('Unsupported local archive file');
  }
  const verified=await verifySelectedLocalArchive(path,{
    sha256:expectedSha256,size:meta.size,
  });
  return {backup_date:match[1],...verified,network_used:false};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length !== 4) {
    console.error('Usage: node verify-local-recovery.mjs <absolute_archive_path> <trusted_sha256>');
    process.exitCode=2;
  } else {
    verifyLocalRecoveryFile(process.argv[2],process.argv[3])
      .then(result=>console.log(JSON.stringify(result)))
      .catch(error=>{console.error('Local archive verification failed: '+error.message);
        process.exitCode=1;});
  }
}

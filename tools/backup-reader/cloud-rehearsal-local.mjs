import { createHash } from 'node:crypto';
import { createReadStream, lstatSync } from 'node:fs';
import { proveBusinessRecovery } from './business-replay-check.mjs';

async function sha256(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

/**
 * Verify the EXACT selected archived file copied from Drive, then recover
 * only into disposable PGlite. No network, database URL, or remote write.
 * Verify both the outer SHA and the per-table manifest fingerprints.
 */
export async function verifySelectedLocalArchive(path, selection) {
  if (!selection || typeof selection.sha256 !== 'string' ||
      !/^[a-f0-9]{64}$/.test(selection.sha256) ||
      !Number.isSafeInteger(selection.size) || selection.size < 1 ||
      selection.size > 256 * 1024 * 1024) {
    throw Error('Cloud restore rehearsal: invalid trusted selection');
  }
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== selection.size) {
    throw Error('Cloud restore rehearsal: archive file metadata mismatch');
  }
  if (await sha256(path) !== selection.sha256) {
    throw Error('Cloud restore rehearsal: downloaded archive digest mismatch');
  }
  const result = await proveBusinessRecovery(path);
  if (!result.exactMatch || result.restoredTables !== 9 ||
      !result.reactivatedFixture) {
    throw Error('Cloud restore rehearsal: isolated restore verification failed');
  }
  return {
    selected_file_verified: true,
    isolated_restore_verified: true,
    restored_tables: result.restoredTables,
    production_writes: false,
  };
}

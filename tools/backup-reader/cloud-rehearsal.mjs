/**
 * MANUAL, READ-ONLY cloud backup recovery DRILL.
 * - Source DB: narrow offsite_backup_reader (SELECT backup_history only).
 * - Drive: rclone lsjson/copyto FROM remote; never upload, delete, prune.
 * - Target: ephemeral in-process PGlite isolated restore. NEVER live Supabase.
 * This file is intentionally not referenced from the website or backup schedule.
 */
import pg from 'pg';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { caCertificate } from './export.mjs';
import { sourceConnection } from './contract.mjs';
import { selectedCloudArchive, onlyReadFromDrive } from './cloud-rehearsal-contract.mjs';
import { verifySelectedLocalArchive } from './cloud-rehearsal-local.mjs';
import { ROOT_FOLDER } from '../google-drive-rclone.mjs';

function requireEnvironment(env) {
  if (env.BACKUP_REHEARSAL_ONLY !== 'true' || env.GITHUB_EVENT_NAME === 'schedule') {
    throw Error('Only explicitly requested isolated recovery drills are allowed');
  }
  if (!env.RCLONE_CONFIG_DRIVE_TOKEN) throw Error('Missing dedicated Drive read credentials');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(env.BACKUP_REHEARSAL_DATE ?? '')) {
    throw Error('Select exactly one YYYY-MM-DD backup date');
  }
}
export function readOnlyDriveCommand(env, args, selectedRemote, localDownload) {
  onlyReadFromDrive(args, selectedRemote, localDownload);
  const config = {
    ...env,
    RCLONE_CONFIG: '/dev/null',
    RCLONE_CONFIG_DRIVE_TYPE: 'drive',
    RCLONE_CONFIG_DRIVE_SCOPE: 'drive.file',
    RCLONE_CONFIG_DRIVE_SKIP_SHORTCUTS: 'true',
  };
  const result = spawnSync('rclone', [
    ...args, '--contimeout', '15s', '--timeout', '60s', '--retries', '2',
    '--low-level-retries', '2',
  ], {
    env: config, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024,
    timeout: 120_000, stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.error || result.status !== 0) {
    throw Error('Drive read failed; raw credentials/diagnostics withheld');
  }
  return (result.stdout ?? '').trim();
}
export async function withVerifiedSelectedCloudArchive(env = process.env, onVerified = async () => ({})) {
  if (typeof onVerified !== 'function') throw Error('An explicit verified archive handler is required');
  requireEnvironment(env);
  const ca = await caCertificate();
  const client = new pg.Client(sourceConnection(env.SUPABASE_DB_URL, ca));
  let connected = false;
  const work = mkdtempSync(join(env.RUNNER_TEMP || tmpdir(), 'selected-backup-rehearsal-'));
  try {
    await client.connect(); connected = true;
    // The backup role can write limited history for the normal daily job.
    // The recovery rehearsal itself MUST stay in a server-enforced read-only transaction.
    await client.query('begin isolation level repeatable read read only');
    const readOnly = (await client.query("select current_setting('transaction_read_only') as active")).rows[0]?.active;
    if (readOnly !== 'on') throw Error('Cloud restore rehearsal: read-only transaction unavailable');
    const role = (await client.query(`select current_user as name,
      pg_has_role(current_user,'postgres','MEMBER') as admin_member,
      has_table_privilege(current_user,'public.backup_history','SELECT') as history_read,
      has_table_privilege(current_user,'public.backup_history','DELETE') as history_delete`)).rows[0];
    if (role?.name !== 'offsite_backup_reader' || role.admin_member || !role.history_read || role.history_delete) {
      throw Error('Expected restricted read-only source role, not an administrator');
    }
    const { rows } = await client.query(`
      select backup_date::text, format, file_name, drive_file_id, sha256,
        size_bytes::text from public.backup_history where backup_date=$1`,
      [env.BACKUP_REHEARSAL_DATE]);
    if (rows.length !== 1) throw Error('Selected backup date not found in trusted history');
    const items = JSON.parse(readOnlyDriveCommand(env, [
      'lsjson', 'drive:' + ROOT_FOLDER, '--recursive', '--files-only', '--hash',
    ]));
    if (!Array.isArray(items)) throw Error('Unexpected Drive listing');
    const candidate = items.filter(item => item.ID === rows[0].drive_file_id);
    if (candidate.length !== 1) throw Error('Missing or duplicate selected Drive file ID');
    const selection = selectedCloudArchive(env.BACKUP_REHEARSAL_DATE, rows[0], candidate[0]);
    const archive = join(work, basename(selection.filename));
    // This is strictly REMOTE -> LOCAL, no remote write or SQL modification.
    readOnlyDriveCommand(env, ['copyto', selection.remote, archive, '--immutable'], selection.remote, archive);
    // Always prove exact nine-table reconstruction in disposable PGlite
    // BEFORE supplying the archive to any separately authorized target.
    const verified = await verifySelectedLocalArchive(archive, selection);
    const further = await onVerified(archive, selection);
    return { date: selection.date, ...verified, ...further,
      production_reads_only: true };
  } finally {
    if (connected) { await client.query('rollback').catch(() => undefined); await client.end().catch(() => undefined); }
    rmSync(work, { recursive: true, force: true });
  }
}

export async function rehearseSelectedCloudBackup(env = process.env) {
  return withVerifiedSelectedCloudArchive(env);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  rehearseSelectedCloudBackup().then(summary =>
    console.log(JSON.stringify(summary)))
    .catch(error => { console.error('Isolated cloud drill failed: ' + (error.code ?? error.message));
      process.exitCode = 1; });
}

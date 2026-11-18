# 1-mohamed — Google Drive backup and recovery

**Chosen policy:** one full logical database backup per Cairo calendar day; retain the latest 30 calendar days in a private Google Drive root with year/month subfolders. No AWS, Cloudflare R2, or six-hour schedule.

## Current verification

The branch's manual restricted-reader export completed in Actions. Google's quota for the shared rclone OAuth client blocked the Drive round trip. The browser grant is present. See the [rclone Drive documentation](https://rclone.org/drive/#making-your-own-client-id) for shared-client limits and dedicated credentials.

The local age archive decrypted and restored into a separate Supabase project. All application and Auth row fingerprints matched. The target passed real member login and revocation checks. The restricted reader currently serves the manual drill only. The regular workflow still requires a separately verified production connection and history configuration. Keep the four activation gates false until a fresh Drive download has been restored and reviewed. See HANDOFF_LOG under GOOGLE-DRIVE-BACKUP-09.

## Dedicated rclone authorization — setup in progress

The owner approved a project-specific Google Desktop OAuth client with no Cloud billing. The backup workflow and manual drill accept `RCLONE_CONFIG_DRIVE_CLIENT_ID` and `RCLONE_CONFIG_DRIVE_CLIENT_SECRET` alongside `RCLONE_CONFIG_DRIVE_TOKEN` in the `google-drive-backup` GitHub Environment. These three values must come from the same client and browser authorization. Keep the old grant until the dedicated configuration has passed a synthetic upload/download probe. Use the `drive.file` scope. With a new client, use its own managed files and do not assume it can see files created by the shared client.

A Google OAuth app in external Testing mode can serve this drill. Its refresh grant expires after seven days. Establish a durable grant and verify a fresh encrypted Drive download on a separate restore target before enabling recurring jobs. Keep billing and all four backup gates disabled during this work.

## Daily encrypted archive
The job pins Supabase CLI v2.122.1 and creates `roles.sql`, `schema.sql`, and `data.sql` using the documented `supabase db dump` workflow. The data dump is checked for all 12 public application tables plus `auth.users` and `auth.identities`. Supabase CLI applies Supabase-specific filtering to managed schemas while retaining Auth user and identity records needed for account recovery. The archive includes owner/member UUID mappings so those rows remain linked to the restored Auth users. Password hashes in `auth.users` are part of the encrypted archive; JWT signing secrets and provider configuration are not. The manifest records project, source commit, PostgreSQL version, row counts and SHA-256 of the SQL data. It includes the new `backup_history` table. The encrypted archive's SHA-256 and size are stored in the owner-only backup-history table. The bundle is gzip-compressed and encrypted with age before upload.

The current Storage inventory is zero buckets and zero objects. The job fails closed if a bucket or object appears because Storage object bytes require a separate export workflow.

## Google Drive authorization

Create a Google Desktop OAuth client in the project's Google Cloud Console, enable the Drive API, and configure the Google Auth Platform consent screen. Use the project's dedicated client when rclone config asks for a client ID and secret. The shared client hit quota errors during this project's first trial. Use browser consent with access limited to files created by this app (`drive.file`). See the [rclone setup instructions](https://rclone.org/drive/#making-your-own-client-id).

Keep the downloaded Desktop client JSON and rclone config outside Git. Run a synthetic transfer first. Then save the client ID, client secret and matching token JSON as encrypted secrets in the `google-drive-backup` GitHub Environment. Keep the age private identity offline and set only the public `AGE_RECIPIENT` in GitHub. The temporary database reader credential belongs in `SUPABASE_DB_URL` for the manual drill and is revoked after use.

A no-history trial permits `backup_history` to be absent. The ordinary production workflow requires the history migration and all 12 tables. Keep `BACKUP_ENABLED`, `BACKUP_RESTORE_VERIFIED`, `BACKUP_RETENTION_ENABLED` and `BACKUP_RECORD_HISTORY` false during the drill. After a successful Drive-backed restore and owner approval, review the required history migration and production connection before enabling recording and daily backups. Enable retention only after separate approval.

The older direct Google OAuth integration remains a fallback through `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET` and `GOOGLE_DRIVE_REFRESH_TOKEN`. The rclone token takes precedence. The ChatGPT Google Drive connector uses its own authorization. A service account has no storage quota for a personal My Drive.

## Schedule, folders and retention
- One run daily at 01:17 UTC (03:17 Cairo during UTC+2, 04:17 during UTC+3).
- Encrypted archives are saved under 1-mohamed-backups/YYYY/MM - MonthName/1-mohamed-YYYY-MM-DD.tar.gz.age, e.g. 1-mohamed-backups/2026/11 - November/1-mohamed-2026-11-17.tar.gz.age.
- One filename per Cairo date; a second same-day run refuses to create a duplicate.
- After a successful verified upload and history write, and only when restore verification and retention are explicitly enabled, backups older than the rolling **30 Cairo calendar days** are permanently deleted. Only exact date-matching year/month archive paths are eligible. The current-day backup counts as day 1. Unrelated paths, shortcuts, nested personal folders and invalid dates are excluded. With rclone, the encrypted file is also downloaded again and SHA-256-compared before history or retention.
- Empty year/month folders may remain for browsing history; the retention rule applies to archive files.
- Scheduled runs require BACKUP_ENABLED=true, BACKUP_RESTORE_VERIFIED=true and BACKUP_RECORD_HISTORY=true. Retention remains separately opt-in. GitHub scheduled workflows are best-effort; monitor backup history and failure notifications.

## Local exports
The owner-only app export supplies a portable JSON snapshot of all 12 public application tables with row counts, format version and SHA-256, plus individual UTF-8-BOM CSV files for Excel/Google Sheets. The local JSON is a portable application-data export, not a full database image: it excludes schema, Supabase Auth records/password hashes, project secrets and Storage object bytes. It includes owner/member UUID mapping rows for reference. The encrypted daily SQL archive includes the public application schema/data plus Auth user/identity records. On a new project, user IDs and password hashes are preserved, but JWT signing secrets differ, so users must sign in again. OAuth provider settings and Storage object bytes must be configured or transferred separately.

## Restore
Create a separate Supabase project with the required extensions and compatible Postgres version. Download and SHA-256-check the encrypted archive using the owner-only backup-history record, decrypt with the offline age identity, and restore `roles.sql`, `schema.sql`, and `data.sql` using Supabase's documented CLI restore procedure. Do not apply the full application migrations on top of a schema dump before restoring; reconcile the new project's migration history with the repository after the restore. Never test by overwriting production. Verify Auth users and identities, owner/member mappings, and all 12 public tables, then verify owner/member access, representative trip/payment balances, audit history and exports before cutover.

## Live authorization limits — 17 November 2026
The owner completed rclone browser consent and its grant is saved as an encrypted GitHub Environment secret. All activation gates are false. A synthetic encrypted upload succeeded, but download failed with shared-client project quota 403, including a throttled retry. No full database snapshot or isolated restore has succeeded. A separate free restore project exists; database URLs remain unavailable.

The [official rclone Drive documentation](https://rclone.org/drive/) now warns that its shared OAuth client is being retired during 2026. Browser consent works today, but this shared client is not yet accepted as a durable unattended backup transport. Resolve quota and client lifecycle before activation; do not silently require the owner to create a custom Cloud OAuth client or enable billing.

## Historical prepared status
The workflow is prepared but deliberately inactive until the owner's one-time browser Drive authorization, the database connection string, age recipient, backup-history migration and a separate-project restore drill are configured and verified. No live production rows have been changed by this implementation.

## Official references
- Supabase platform-to-self-hosted restore guide (documents that `auth.users` is included and Storage objects are separate): https://supabase.com/docs/guides/self-hosting/restore-from-platform
- Supabase CLI database dump and managed-schema exclusions: https://supabase.com/docs/reference/cli/supabase-db-dump
- Supabase database backup limitations and Storage exclusion: https://supabase.com/docs/guides/platform/backups
- Supabase logical backup and restore workflow: https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore

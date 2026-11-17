# 1-mohamed — Google Drive backup and recovery

**Chosen policy:** one full logical database backup per Cairo calendar day; retain the latest 15 calendar days in one private Google Drive folder. No AWS, Cloudflare R2, or six-hour schedule.

## Daily encrypted archive
The job pins Supabase CLI v2.122.1 and creates `roles.sql`, `schema.sql`, and `data.sql` using the documented `supabase db dump` workflow. The data dump is checked for all 12 public application tables plus `auth.users` and `auth.identities`. Supabase CLI applies Supabase-specific filtering to managed schemas while retaining Auth user and identity records needed for account recovery. The archive includes owner/member UUID mappings so those rows remain linked to the restored Auth users. Password hashes in `auth.users` are part of the encrypted archive; JWT signing secrets and provider configuration are not. The manifest records project, source commit, PostgreSQL version, row counts and SHA-256 of the SQL data. It includes the new `backup_history` table. The encrypted archive's SHA-256 and size are stored in the owner-only backup-history table. The bundle is gzip-compressed and encrypted with age before upload.

The current Storage inventory is zero buckets and zero objects. The job fails closed if a bucket or object appears because Storage object bytes require a separate export workflow.

## Google Drive setup
Create a Google Cloud OAuth client, enable the Google Drive API, and authorize the client once with the narrow `drive.file` scope. Add these secrets to GitHub Environment `google-drive-backup`:
- `SUPABASE_DB_URL`: Session Pooler port 5432 with `sslmode=require`; percent-encode special characters in the password. Never use the transaction pooler for database dumps.
- `GOOGLE_DRIVE_CLIENT_ID`
- `GOOGLE_DRIVE_CLIENT_SECRET`
- `GOOGLE_DRIVE_REFRESH_TOKEN`

Add Environment variable `AGE_RECIPIENT` (public age recipient only, starts with `age1`) and repository variable `BACKUP_ENABLED=true` only after a successful manual test. The first run creates a private folder named `1-mohamed-backups`. A ChatGPT Google Drive connection is separate from this OAuth grant and does not automatically authorize GitHub Actions.

Keep the age private identity offline in two secure locations. Never put it in GitHub, Drive, Vercel or application code.

## Schedule and retention
- One run daily at 01:17 UTC (03:17 Cairo during UTC+2).
- One filename per Cairo date; a second same-day run refuses to create a duplicate.
- After successful upload verification, files older than the 15-day Cairo calendar window are permanently deleted from Drive.
- Scheduled runs remain disabled until `BACKUP_ENABLED=true`.
- GitHub scheduled workflows are best-effort; monitor the owner-only backup history.

## Local exports
The owner-only app export supplies a portable JSON snapshot of all 12 public application tables with row counts, format version and SHA-256, plus individual UTF-8-BOM CSV files for Excel/Google Sheets. The local JSON is a portable application-data export, not a full database image: it excludes schema, Supabase Auth records/password hashes, project secrets and Storage object bytes. It includes owner/member UUID mapping rows for reference. The encrypted daily SQL archive includes the public application schema/data plus Auth user/identity records. On a new project, user IDs and password hashes are preserved, but JWT signing secrets differ, so users must sign in again. OAuth provider settings and Storage object bytes must be configured or transferred separately.

## Restore
Create a separate Supabase project with the required extensions and compatible Postgres version. Download and SHA-256-check the encrypted archive using the owner-only backup-history record, decrypt with the offline age identity, and restore `roles.sql`, `schema.sql`, and `data.sql` using Supabase's documented CLI restore procedure. Do not apply the full application migrations on top of a schema dump before restoring; reconcile the new project's migration history with the repository after the restore. Never test by overwriting production. Verify Auth users and identities, owner/member mappings, and all 12 public tables, then verify owner/member access, representative trip/payment balances, audit history and exports before cutover.

## Current status
The workflow is prepared but deliberately inactive until OAuth, the database connection string, age recipient, backup-history migration and a separate-project restore drill are configured and verified. No live production rows have been changed by this implementation.

## Official references
- Supabase platform-to-self-hosted restore guide (documents that `auth.users` is included and Storage objects are separate): https://supabase.com/docs/guides/self-hosting/restore-from-platform
- Supabase CLI database dump and managed-schema exclusions: https://supabase.com/docs/reference/cli/supabase-db-dump
- Supabase database backup limitations and Storage exclusion: https://supabase.com/docs/guides/platform/backups
- Supabase logical backup and restore workflow: https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore

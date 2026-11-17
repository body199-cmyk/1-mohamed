# 1-mohamed — Google Drive backup and recovery

**Chosen policy:** one full logical database backup per Cairo calendar day; retain the latest 30 calendar days in a private Google Drive root with year/month subfolders. No AWS, Cloudflare R2, or six-hour schedule.

## Daily encrypted archive
The job pins Supabase CLI v2.122.1 and creates `roles.sql`, `schema.sql`, and `data.sql` using the documented `supabase db dump` workflow. The data dump is checked for all 12 public application tables plus `auth.users` and `auth.identities`. Supabase CLI applies Supabase-specific filtering to managed schemas while retaining Auth user and identity records needed for account recovery. The archive includes owner/member UUID mappings so those rows remain linked to the restored Auth users. Password hashes in `auth.users` are part of the encrypted archive; JWT signing secrets and provider configuration are not. The manifest records project, source commit, PostgreSQL version, row counts and SHA-256 of the SQL data. It includes the new `backup_history` table. The encrypted archive's SHA-256 and size are stored in the owner-only backup-history table. The bundle is gzip-compressed and encrypted with age before upload.

The current Storage inventory is zero buckets and zero objects. The job fails closed if a bucket or object appears because Storage object bytes require a separate export workflow.

## Google Drive authorization — no Google Cloud Console required

**Preferred setup for the owner:** rclone's built-in Google Drive browser authorization. This does **not** require the owner to create a Google Cloud project, OAuth consent screen, client ID, or client secret. Google will still ask the account owner to sign in and grant access **once**; nobody should ask for their Google password or refresh token in chat.

1. On the owner's Windows computer, install rclone from https://rclone.org/downloads/ (or use Windows package manager).
2. In PowerShell, run rclone config and create a new remote named **drive**. Choose storage **Google Drive**, leave client ID and client secret blank, select **drive.file** (files created by this app), and approve the Google sign-in in the browser. Do not use a service account for personal My Drive.
3. Find the token JSON value in the local rclone config (rclone config file prints the config path). Add **only that JSON value**, without the leading token =, as the GitHub Actions Environment secret **RCLONE_CONFIG_DRIVE_TOKEN** in environment **google-drive-backup**. Do not put this token in Git, chat, issue comments, or a public file. The owner must perform the Google consent and GitHub secret entry; the connected ChatGPT Drive app cannot transfer its private authorization to GitHub Actions.
4. Add the database connection secret **SUPABASE_DB_URL** (Supabase Session Pooler port 5432, sslmode=require, percent-encoded password) and environment variable **AGE_RECIPIENT** (public age key). Keep the age private identity **offline** in two secure locations.
5. Apply the owner-only backup_history migration in the controlled release process. Manually run the workflow on main, verify encrypted upload and a separate-project restore, and only then set repository variable **BACKUP_ENABLED=true**.

The previous custom OAuth method remains compatible as a fallback using **GOOGLE_DRIVE_CLIENT_ID**, **GOOGLE_DRIVE_CLIENT_SECRET**, and **GOOGLE_DRIVE_REFRESH_TOKEN**, but it is **not required** when the rclone token is provided. The rclone token takes precedence.

**Important:** A Google Drive connector linked in ChatGPT is not an OAuth credential that GitHub Actions can use. A standalone service account cannot upload as the owner of a personal My Drive file because service accounts have no Drive storage quota; use the browser authorization described above instead.

## Schedule, folders and retention
- One run daily at 01:17 UTC (03:17 Cairo during UTC+2, 04:17 during UTC+3).
- Encrypted archives are saved under 1-mohamed-backups/YYYY/MM - MonthName/1-mohamed-YYYY-MM-DD.tar.gz.age, e.g. 1-mohamed-backups/2026/11 - November/1-mohamed-2026-11-17.tar.gz.age.
- One filename per Cairo date; a second same-day run refuses to create a duplicate.
- After a successful verified upload and history write, backups older than the rolling **30 Cairo calendar days** are permanently deleted, across all year/month folders. The current-day backup counts as day 1. Unrelated Drive files are not deleted.
- Empty year/month folders may remain for browsing history; the retention rule applies to archive files.
- Scheduled runs remain disabled until BACKUP_ENABLED=true. GitHub scheduled workflows are best-effort; monitor backup history and failure notifications.

## Local exports
The owner-only app export supplies a portable JSON snapshot of all 12 public application tables with row counts, format version and SHA-256, plus individual UTF-8-BOM CSV files for Excel/Google Sheets. The local JSON is a portable application-data export, not a full database image: it excludes schema, Supabase Auth records/password hashes, project secrets and Storage object bytes. It includes owner/member UUID mapping rows for reference. The encrypted daily SQL archive includes the public application schema/data plus Auth user/identity records. On a new project, user IDs and password hashes are preserved, but JWT signing secrets differ, so users must sign in again. OAuth provider settings and Storage object bytes must be configured or transferred separately.

## Restore
Create a separate Supabase project with the required extensions and compatible Postgres version. Download and SHA-256-check the encrypted archive using the owner-only backup-history record, decrypt with the offline age identity, and restore `roles.sql`, `schema.sql`, and `data.sql` using Supabase's documented CLI restore procedure. Do not apply the full application migrations on top of a schema dump before restoring; reconcile the new project's migration history with the repository after the restore. Never test by overwriting production. Verify Auth users and identities, owner/member mappings, and all 12 public tables, then verify owner/member access, representative trip/payment balances, audit history and exports before cutover.

## Current status
The workflow is prepared but deliberately inactive until the owner's one-time browser Drive authorization, the database connection string, age recipient, backup-history migration and a separate-project restore drill are configured and verified. No live production rows have been changed by this implementation.

## Official references
- Supabase platform-to-self-hosted restore guide (documents that `auth.users` is included and Storage objects are separate): https://supabase.com/docs/guides/self-hosting/restore-from-platform
- Supabase CLI database dump and managed-schema exclusions: https://supabase.com/docs/reference/cli/supabase-db-dump
- Supabase database backup limitations and Storage exclusion: https://supabase.com/docs/guides/platform/backups
- Supabase logical backup and restore workflow: https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore

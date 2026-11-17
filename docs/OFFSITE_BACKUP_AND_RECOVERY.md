# 1-mohamed — Google Drive backup and recovery

**Chosen policy:** one full logical database backup per Cairo calendar day; retain the latest 15 calendar days in one private Google Drive folder. No AWS, Cloudflare R2, or six-hour schedule.

## Daily encrypted archive
The job pins Supabase CLI v2.122.1 and creates `roles.sql`, `schema.sql`, and `data.sql` using the documented `supabase db dump` workflow. The data dump is checked for the current public application tables except `app_owner` and `app_members` row data, which is deliberately excluded because it contains Supabase Auth UUID mappings. Supabase CLI excludes managed `auth`, `storage`, and extension schemas, so Auth users/password hashes are not included. The manifest records project, source commit, PostgreSQL version, row counts and SHA-256 of the SQL data. It includes the new `backup_history` table. The encrypted archive's SHA-256 and size are stored in the owner-only backup-history table. The bundle is gzip-compressed and encrypted with age before upload.

The current Storage inventory is zero buckets and zero objects. The job fails closed if a bucket or object appears because Storage object bytes require a separate export workflow.

## Google Drive setup
Create a Google Cloud OAuth client, enable the Google Drive API, and authorize the client once with the narrow `drive.file` scope. Add these secrets to GitHub Environment `google-drive-backup`:
- `SUPABASE_DB_URL`: Session Pooler port 5432 with `sslmode=require`, never transaction pooler.
- `GOOGLE_DRIVE_CLIENT_ID`
- `GOOGLE_DRIVE_CLIENT_SECRET`
- `GOOGLE_DRIVE_REFRESH_TOKEN`

Add Environment variable `AGE_RECIPIENT` (public age recipient only, starts with `age1`) and repository variable `BACKUP_ENABLED=true` only after a successful manual test. The first run creates a private folder named `1-mohamed-backups`. A ChatGPT Google Drive connection is separate from this OAuth grant and does not automatically authorize GitHub Actions.

Keep the age private identity offline in two secure locations. Never put it in GitHub, Drive, Vercel or application code.

## Schedule and retention
- One run daily at 01:17 UTC (03:17 Cairo during UTC+2).
- One filename per Cairo date; a second same-day run refuses to create a duplicate.
- After successful upload verification, files older than the 15-day Cairo calendar window are moved to Drive Trash.
- Scheduled runs remain disabled until `BACKUP_ENABLED=true`.
- GitHub scheduled workflows are best-effort; monitor the owner-only backup history.

## Local exports
The owner-only app export supplies a portable JSON snapshot of all 12 public application tables with row counts, format version and SHA-256, plus individual UTF-8-BOM CSV files for Excel/Google Sheets. The local JSON is a portable application-data export, not a full database image: it excludes schema, Supabase Auth credentials/password hashes, project secrets and Storage object bytes. It includes owner/member UUID mapping rows for reference, but those rows must not be replayed into a new Supabase project; create the owner Auth user, initialize ownership, and re-invite members after applying migrations. The encrypted daily SQL archive is the complete public application schema/data recovery artifact. Supabase Auth users/passwords and Storage object bytes are managed separately and must be recreated/relinked if recovering to a new project.

## Restore
Create a separate Supabase project, apply reviewed migrations, download and SHA-256-check the encrypted archive using the owner-only backup-history record, decrypt with the offline age identity, and restore `roles.sql`, `schema.sql`, and `data.sql` using Supabase's documented restore procedure. Never test by overwriting production. Recreate the owner Auth account, initialize `app_owner` with `app_set_initial_owner(new_auth_user_id)`, re-invite members, then verify owner/member access and all 12 public tables, representative trip/payment balances, audit history and exports before cutover.

## Current status
The workflow is prepared but deliberately inactive until OAuth, the database connection string, age recipient, backup-history migration and a separate-project restore drill are configured and verified. No live production rows have been changed by this implementation.

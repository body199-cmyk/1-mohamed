# 1-mohamed — encrypted offsite backup and disaster recovery

**Status: implementation prepared; offsite automation is NOT active yet.** The workflow is intentionally gated. No production rows, passwords, Supabase settings, AWS resources, Cloudflare resources, or Vercel settings were changed while preparing this plan.

## 1. What is already in place

- `tools/backup-core.mjs` is a validated, versioned **business-only** snapshot core with isolated in-memory restore tests. It is not a live database backup adapter and must not be exposed as a production restore endpoint.
- The connected Supabase project `1-mohamed` is healthy in `eu-central-1`, PostgreSQL 17.11.
- Read-only inventory on 17 November 2026: database size 16,447,155 bytes; 11 public tables; 1,045 trips; 1,138 payments; 8 contractors; 12 vehicles; 71 vehicle-account links; 2,273 audit rows; 2,262 idempotency rows; 0 opening-balance rows; 1 owner row; 0 approved member rows; 1 business-settings row; 1 Auth user; 0 Supabase Storage buckets and 0 Storage objects.
- The existing public schema contains more than the eight tables in the isolated core: `app_owner`, `app_members`, and `business_settings` must be accounted for in a real recovery plan.

The inventory is a baseline only. It does not classify existing rows as real or trial data. Do not clear, reset, or overwrite them as part of backup setup.

## 2. Recommended protection layers

### Layer A — Supabase-managed recovery

Use the native Supabase database backup for same-project disaster recovery. Current Supabase documentation says daily backups are automatic on Pro, Team, and Enterprise plans:
- Pro: 7 days
- Team: 14 days
- Enterprise: up to 30 days

The Free plan does not provide automatic daily backups. The current connected project metadata does not expose its billing plan, so the plan must be checked in Supabase Dashboard → Organization Billing before relying on this layer.

Point-in-Time Recovery (PITR) is an optional paid add-on. Supabase documents a worst-case recovery point of about two minutes when enabled; its current published 7-day add-on example is approximately USD 100/month. I do **not** recommend enabling PITR automatically before reviewing the actual quote and business need. Daily offsite copies are the cost-conscious baseline.

Supabase database backups do not include objects stored through the Storage API. This project currently has zero Storage buckets and objects. The offsite job checks this and fails closed if that changes.

### Layer B — AWS S3 (offsite copy 1)

- Private bucket in a separate AWS account.
- S3 Versioning enabled.
- Object Lock enabled at bucket creation; default Governance retention of at least 30 days.
- GitHub Actions authenticates with AWS using OIDC and a short-lived role. The role can upload/read-back only under the project backup prefix; it has no delete or retention-bypass permission.
- Lifecycle expiry is configured after the 30-day lock window.

### Layer C — Cloudflare R2 (offsite copy 2)

- Private R2 bucket in a separate Cloudflare account.
- Bucket Lock rule on prefix `1-mohamed/daily/` for at least 30 days.
- Lifecycle expiry after the lock period.
- R2 API token is restricted to this bucket only. It is stored as GitHub Environment secrets, never in source code.

AWS and Cloudflare are independent storage providers. Supabase, S3, and R2 therefore do not share one provider-level failure domain.

### Frequency and retention proposal

- Encrypted logical snapshot every 6 hours (four scheduled runs/day; GitHub schedule is UTC and best-effort).
- Keep at least 30 days at both offsite destinations, exceeding the earlier 14-copy baseline.
- No deletion is performed by the backup script. Retention is enforced by bucket policies/lifecycle after the lock period.
- A failed upload to either destination makes the run fail. A backup is considered successful only after both uploads and read-after-write HEAD checks pass.
- Monthly restore drill to a separate test project/database before final handover; never test restore by overwriting production.

## 3. What the offsite archive contains

The job runs PostgreSQL 17 `pg_dump` against the project's Session Pooler or direct PostgreSQL connection, with TLS required. It archives the complete `public` schema and data, including all current business tables, RLS policies, functions, indexes, audit history, canceled rows, idempotency records, and business settings. It inventories database schemas and fails closed if an unrecognized schema appears, so a future application schema cannot be silently omitted.

For safe identity recovery into a **new** Supabase project, it intentionally includes the schema but omits row data from:
- `public.app_owner`
- `public.app_members`

Those rows contain Supabase Auth UUID mappings. The Supabase-managed `auth`, `storage`, `extensions`, `realtime`, `graphql`, `graphql_public`, `supabase_migrations`, and `vault` schemas are not exported. The Auth-managed users/passwords and Vault secrets must be recreated or reconfigured separately. On a new project, create the owner Auth account first, initialize `app_owner` using the administrative `app_set_initial_owner(new_auth_user_id)` function, and re-invite approved members. This prevents restoring stale Auth UUIDs or trying to restore passwords from an application dump. Same-project recovery should prefer Supabase's native restore instead.

The job also:
- verifies the archive table-of-contents before encryption;
- writes a manifest with the project reference, source commit, PostgreSQL version, a post-dump table-count sample for reconciliation, and SHA-256 of the raw dump;
- encrypts the bundle with age before any upload;
- uploads only the encrypted archive and a SHA-256 sidecar;
- verifies object size and checksum metadata at both destinations;
- refuses to run if any Storage bucket/object exists, rather than silently omitting future uploaded files.

The age **public recipient** is a GitHub Environment variable. The matching private identity must be held offline in two secure places (for example, a password manager and an encrypted offline USB). Never put the private identity, database URL, R2 secret, or AWS credentials in GitHub source, artifacts, chat, or app code. Losing the private identity means the encrypted copies cannot be decrypted.

## 4. GitHub Environment configuration required

Create a GitHub Environment named `offsite-backup` and restrict its deployment branch to `main`.

**Environment secrets**
- `SUPABASE_DB_URL`: Supabase Session Pooler connection string (port 5432) or direct connection string, with `sslmode=require`. Do not use the transaction pooler for `pg_dump`.
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_LOCK_API_TOKEN`: Cloudflare API token with read-only R2 bucket-configuration access, used only to verify the Bucket Lock rule.

**Environment variables**
- `AGE_RECIPIENT`: age public recipient beginning with `age1` (not the private key).
- `AWS_BACKUP_ROLE_ARN`
- `AWS_BACKUP_REGION`
- `AWS_BACKUP_BUCKET`
- `R2_ACCOUNT_ID`
- `R2_BACKUP_BUCKET`

**Repository variable**
- `BACKUP_ENABLED`: set to `true` only after the first manual test succeeds at both destinations.

The AWS IAM OIDC trust policy must restrict the subject to `repo:body199-cmyk/1-mohamed:environment:offsite-backup`; the GitHub Environment itself must restrict deployments to `main`. Its permissions should be limited to `s3:PutObject`, `s3:AbortMultipartUpload`, and `s3:GetObject` on `arn:aws:s3:::<bucket>/1-mohamed/daily/*`, plus `s3:GetBucketObjectLockConfiguration` and `s3:GetBucketVersioning` on that bucket. Do not grant `s3:DeleteObject`, `s3:BypassGovernanceRetention`, or bucket-administration permissions to the workflow role.

The AWS bucket must have Object Lock enabled, Versioning enabled, and a default Governance retention of at least 30 days. The R2 S3 token must be limited to the dedicated backup bucket. Configure R2 Bucket Lock for the same prefix and retention window; the workflow verifies the rule through the separate read-only `R2_LOCK_API_TOKEN` before it connects to Supabase.

### One-time activation sequence

1. Generate an age key pair locally. Keep the private identity offline in two separate secure locations; add only its public `age1...` recipient to the GitHub Environment variable.
2. Create the AWS bucket with Object Lock + Versioning; configure the restricted OIDC role and trust policy.
3. Create the R2 bucket and bucket-lock rule; generate a bucket-scoped S3 API token plus a separate read-only Cloudflare API token for checking the lock rule.
4. Add the connection string and R2 credentials directly to GitHub Environment secrets. Do not send them in chat.
5. Run GitHub Actions → **Encrypted offsite database backup** → **Run workflow** on `main`.
6. Confirm both destinations show the same encrypted object and matching checksum. Only then set the repository variable `BACKUP_ENABLED=true` to enable the four-times-daily schedule.

## 5. Restore procedure

### Preferred: restore the existing Supabase project

If the original Supabase project still exists and its native backups are available, use Supabase Dashboard → Database → Backups and restore the closest valid recovery point. Plan for downtime. Remember that Supabase database backups do not restore deleted Storage objects.

### Offsite recovery: restore to a new project first

1. Create a new Supabase project in the intended region and keep the old project untouched.
2. Apply the repository's reviewed migrations to the new project using the Supabase CLI. Deploy the tracked Edge Functions and reconfigure required Supabase/Vercel environment secrets separately.
3. Download the encrypted archive from either S3 or R2. Verify its SHA-256 sidecar before decryption.
4. Decrypt with the offline age private identity, extract the tar bundle, and inspect `manifest.json`.
5. Restore the data into the already-migrated new project using PostgreSQL 17 `pg_restore --data-only --no-owner --no-acl --exit-on-error`. Do not use `--clean` against a live project.
6. Create the owner in Supabase Auth, initialize the empty `app_owner` row with that new Auth UUID, and re-invite any approved members. The offsite logical archive intentionally does not contain Auth credentials or owner/member UUID mappings.
7. Compare restored row counts with the manifest as a reconciliation check (the count sample is taken immediately after the dump and concurrent writes can create a small difference), then run owner/member/anonymous access checks, and verify representative trips, payments, audit history, contractor statements, vehicle-cash statements, and PDF/XLSX/CSV exports.
8. Only after the owner accepts the separate-project restore should the app be pointed to the recovered project. Keep the original project and its data untouched until cutover is proven.

A successful upload is not a successful restore. Final backup acceptance requires at least one complete restore drill to a separate environment.

## 6. Known gates before calling backups complete

- [ ] Confirm the Supabase plan and native daily-backup availability.
- [ ] Owner creates/controls the AWS and Cloudflare accounts/buckets and their billing.
- [ ] Configure GitHub Environment secrets/variables and the restricted AWS OIDC role.
- [ ] Perform a manual run; verify S3 and R2 uploads/checksums.
- [ ] Perform an actual restore drill to a separate Supabase project/database.
- [ ] Record the measured restore time and latest successful recovery point.
- [ ] Confirm retention/lock policies in both provider dashboards.
- [ ] Only then enable the recurring schedule and mark D07/T10 complete.

## Official references

- Supabase database backups: https://supabase.com/docs/guides/platform/backups
- Supabase CLI database dump: https://supabase.com/docs/reference/cli/introduction#supabase-db-dump
- AWS S3 Object Lock: https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html
- Cloudflare R2 Bucket Locks: https://developers.cloudflare.com/r2/buckets/bucket-locks/

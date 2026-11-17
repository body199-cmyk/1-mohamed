## T10 / D07 — offsite backup preparation — 17 November 2026

The production Supabase project was inspected read-only. Current database is PostgreSQL 17.11 in eu-central-1, approximately 16.4 MB, with 11 public tables, 1,045 trips, 1,138 payments, 8 contractors, 12 vehicles, 2,273 audit rows, 2,262 idempotency rows, one owner, zero approved members, one Auth user, and no Storage buckets/objects. These counts are a baseline only; do not clear or classify the existing records as real/trial without the owner's confirmation.

Existing PR17 backup-core remains an isolated business-only validator and in-memory restore prototype, not a live backup adapter. New branch `feat/offsite-backup-t10-20261117` prepares a PostgreSQL 17 public-schema dump, age encryption, two independent offsite uploads (AWS S3 + Cloudflare R2), a six-hour schedule, 30-day retention configuration, object verification, and a restore runbook. The workflow is deliberately inactive until both providers, encryption key and GitHub Environment are configured; scheduled runs require `BACKUP_ENABLED=true`. It excludes only app_owner/app_members row data so Auth identities can be safely re-created on a new project; all other public schema/data is archived. It fails closed if Storage buckets/objects appear.

No production database rows, Auth identities, Vercel settings, cloud buckets, or credentials were modified. Exact-head CI, actual dual upload, retention lock configuration, Supabase plan check and a separate-project restore drill remain required. D07/T10 are not complete until the restore drill succeeds.


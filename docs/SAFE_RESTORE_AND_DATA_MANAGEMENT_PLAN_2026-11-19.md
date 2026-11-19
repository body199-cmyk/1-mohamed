# Stage 3 — isolated recovery rehearsal and read-only enforcement (DRAFT / NOT MERGED)

The following is implemented on PR #107 only; it does NOT expose restoration, merging, deleting or database replacement in the website.

- `cloud-rehearsal.mjs` opens a **PostgreSQL READ ONLY, REPEATABLE READ** transaction on the existing narrow backup-reader connection, verifies that the database reports read-only mode, reads precisely one matching backup-history row, and ends with ROLLBACK. This is vital because the scheduled backup role may have INSERT on its own history log; these rights must not be used by the rehearsal.
- `cloud-rehearsal-contract.mjs` now allowlists **only** `rclone lsjson drive:1-mohamed-backups` and `rclone copyto <selected approved Drive path> <local temp file>`; upload, sync, delete, trash bypasses and arbitrary paths are rejected before spawning rclone. The chosen date, Drive ID, full path, file name, format, stored SHA-256 and byte length must all match.
- `cloud-rehearsal-local.mjs` verifies a regular file (no symlinks), outer SHA-256 and size, then uses `proveBusinessRecovery` to unpack verified nine-table business TAR into a **throwaway PGlite instance**. It checks all stored row fingerprints, that recovery is possible, basic owner/member fixture readiness, and discards the recovery environment.
- `verify-local-recovery.mjs` adds a local/offline CLI for a saved `1-mohamed-YYYY-MM-DD-restore.tar.gz` file (e.g. copied from a phone onto a laptop). Command:

  `node tools/backup-reader/verify-local-recovery.mjs /absolute/path/1-mohamed-YYYY-MM-DD-restore.tar.gz <trusted_sha256_from_history>`

  It works without production credentials or network access, verifies the expected digest, and reconstructs the archive only in PGlite. This is **not** importing data into the production app. The SHA must be taken from a trusted owner-only `backup_history` record and never inferred from the untrusted file.
- New **manual** workflow `.github/workflows/recovery-drill.yml` accepts `backup_date` and `READ_ONLY_VERIFICATION`, is gated to `refs/heads/main`, and uses the existing protected `google-drive-backup` secrets. It performs only remote reads and ephemeral reconstruction, with backup-job concurrency. Since this workflow only exists on a DRAFT branch, it **cannot run from the normal GitHub Actions UI until merged onto the default branch**, and no real cloud-recovery drill has been performed yet. Its job may also require protected-environment approval.
- Automated tests: `cloud-rehearsal-contract.test.mjs` denies unsafe Drive operations, wrong date/format/ID/path/size/digest metadata; `cloud-rehearsal-local.test.mjs` builds a real nine-table TAR from seeded isolated PostgreSQL, checks an isolated restore and rejects tampered outer archive and symlinks. This local drill runs as part of PR CI; it is distinct from a real selected Drive download.

**Critical scope boundaries:** only nine-table `plain-business` archives are supported by this drill. Legacy `.age` encrypted full database backups and 12-table portable JSON have distinct formats and need separate authorized recovery mechanisms. The nine-table archive **does not restore Auth logins, app_owner/app_members or backup_history**; it proves database business rows can be recovered separately, not that a live production cutover is safe.

## Independent production acceptance still required

1. Real Drive backup selection and verified download with the protected manual workflow (after a separate approved merge); no upload or deletion.
2. New empty **isolated** Supabase project rehearsal for owner/Auth mapping and affected ledger statements; compare all financial balances with the source snapshot. A PGlite result is encouraging but is not a production-ready full Supabase cutover.
3. Explicit maintenance fencing, forced fresh rollback backup and tested return to original environment before any future "restore", "replace", "merge" or "delete-all" action is offered in the website.
4. A separate independent audit of privileged credentials, archive handling, retained IDs and rollback. Any change affecting production data requires another explicit user-approved PR.

**STOP BEFORE MERGE**: the only safe current UI is inspect, compare, cloud metadata selection and cancellation impact preview. There is no active destructive endpoint.

---

# Stage 2 implemented on the same draft PR — NOT MERGED

- Browser-only read/compare: `src/lib/backup/compare-local.ts`, `read-bounded.ts` and `local-backup-inspector.tsx` now compare a chosen verified local portable JSON file against a **fresh, owner-only** current snapshot obtained through existing `GET /api/backup/export?format=json`. The downloaded current dataset remains in memory in the owner's browser; no upload, write or persistence. Handles 12 tables, stable primary/composite keys, duplicate rejection, canonical nested row equality, counts of old-only/new-only/modified/unchanged rows, owner/member identity mismatch warning, and *counts* of potentially affected cash accounts and contractors. **It does not compute financial balances or prove that replace/merge would work.** Snapshot may become stale; any eventual restore must recompare under maintenance fencing.

- Cloud-date selection: existing `GET /api/backup/history` now additionally selects the existing `format` field. Settings allow users to choose a saved date, show metadata and open its Drive link. **Metadata display does not fetch or restore the archive.**

- Selected cloud archive rehearsal: `tools/backup-reader/cloud-rehearsal-contract.mjs` and `cloud-rehearsal.mjs` offer a separate manual **read-only** route: validate one explicitly selected Cairo date against trusted `backup_history` and the actual Drive file ID/path/size, download via rclone from Drive to a temporary folder, verify SHA-256, then run the existing `proveBusinessRecovery` PGlite isolated restore with fingerprint checking. Does not connect to a writable production database, does not change backup retention, and is **NOT exposed as a website endpoint**. Only supports `plain-business` archives. Encrypted historical archives need a separate authorized reader/rehearsal engine. Manual live Drive drill is not considered verified until actually executed with authorized credentials.

- Scoped deletion impact preview: `scope-impact.ts` and `scope-impact-preview.tsx` use the existing owner export read-only to count trips for a day, vehicle, contractor or all business data, separately flag paid-linked and cross-day payments, and warn that cancelling trips never automatically cancels actual payments. No mass cancellation, deletion, reset or reactivation API is added. All finance totals remain under existing audited operations.

- Regression tests: browser mobile/desktop local file comparison, live export 403, no writes/unauthorized or accidental upload, 12-table row categorization & duplicate IDs, cloud-date selection, scope preview with historical linked cash entries, bounded browser response, manually selected Drive identity/path/format and CLI syntax, plus all prior accounting/backup/report tests.

**No production data or code modified, no schema migrations added, no cloud credentials handled, PR remains DRAFT.** The stage above completes the inspect/compare/impact-preview layer, **not production restoration**. Any clickable actual merge, whole restore, bulk delete or revert requires new vetted database transactions, sealed candidate/recovery environment, rollback drill, re-auth, and explicit separate review/approval. Never auto-merge this PR.

---

# Settings: Safe backup recovery and scoped data management — 19 Nov 2026

Status: **PROPOSAL / STAGE 1 ONLY**, branch `feat/settings-safe-restore-planning-20261119`. Explicit user constraints: `main`, production data, existing finances, exports, visual design, daily Google Drive backups, and existing auth MUST remain unchanged. No restore or bulk delete to production is authorized by this plan.

## 1. Verified baseline (main bf779e9)

- Settings `BackupSettings`: owner-only JSON export (12 application tables), owner-only individual CSV, `backup_history` Google Drive list / links. No upload/restore endpoint or active restore button.
- `RecordActions`: archive/unarchive a vehicle or non-primary contractor; edit and cancel individual trips/payments with cause and audit; no mass delete/reset/day/vehicle purging or un-cancel button. Ledger write RPC allowlist has no `delete` or `restore` action.
- `tools/backup-reader/business-restore*.mjs`: restore ONLY a 9-business-table recovery archive into a distinct EMPTY Supabase project with explicit ref check, hash validation, exact-match table fingerprints and transaction rollback; excludes Auth, app_owner, app_members, backup_history. This is NOT in-app, NOT in-place, and NOT a merge.
- `tools/backup-reader/restore-data.mjs`: a separate restricted legacy encrypted backup restoration path for an isolated target; formats must never be interchanged.
- Downloadable portable JSON v1 includes 12 public application tables, but excludes GoTrue Auth users/passwords, files in Storage, and Supabase project configuration. It contains owner/member IDs and financial audit/replay keys, so **it cannot be assumed to make a fresh project operational without identity mapping and migration**. CSV and XLSX are human-readable exports, never authoritative recovery input.
- Scheduled Drive backup uses `plain-business` format at present, also produces an Excel document and `backup_history` entry, and uses 30-day retention per settings/workflow (user's earlier 15-day preference is not the current code state). Daily backup **only copies data**; it neither merges nor overwrites the production ledger. Retention pruning deletes older managed backups, not database records.
- Finance invariants A04/A12/D03/D13/D15/D16/D19: cash account=(vehicle,responsible contractor); trip correction may create a legitimate negative historical balance; cash payment never deducted from work difference; edits/cancellation audited; no re-rounding or invented cash movements. Never use manual SQL cascades for selective delete or pseudo-restore.

## 2. Initial safe implementation (this branch)

- New independent client-only module `src/lib/backup/inspect-local.ts` accepts ONLY the JSON exported by the application's own `createPortableBackup`: validates version, all 12 tables, unique table names, row counts <=50,000, nested numeric safety, declared exclusions of Auth/Storage, and SHA-256 over exactly the original canonical body.
- New `LocalBackupInspector` settings UI reads a locally selected JSON file via `File.text()`; caps files at 32MiB; shows timestamp and a few row counts; **never uploads, stores, sends, merges, overwrites or restores anything**. Google Drive tar.gz, encrypted archives, XLSX and CSV are explicitly not accepted by this inspector.
- Hash matching is **corruption detection**, not authenticity, origin, relational integrity or proof of restore-readiness. The UI explicitly says all that.
- Preserve existing UI and export functions. No new SQL migration, secret, API endpoint, restore job, purge route or Vercel change in this stage.
- Test all valid/tampered/missing/unsafe-number/oversize/unsupported backup contracts; run typecheck, unit/SQL, build and Chromium screenshots before considering a merge. This is ONLY an optional **preview**; do not mistake it for completed restore work.

## 3. Product flows — planned, NOT enabled

### A. Restore from a specific Google Drive date

1. The authenticated **owner** opens Settings → Backup & Recovery → Cloud dates. The existing history shows trusted backup ID, date, format, SHA-256 and table counts. A date is not enough; the file ID and hash are authoritative.
2. A narrowly-scoped backend Drive retrieval job obtains archive bytes with server-only credentials from its dedicated account. Reject mismatched IDs/names/formats, invalid SHA-256, unexpected storage paths, expiry or size. Never route sensitive raw database bytes through a public URL or logs.
3. Decompress only in isolated capped workspace; defend against zip/tar bombs and traversal; verify signed/trusted manifest AND physical data fingerprints. Legacy `encrypted` full backup and `plain-business` are different recovery engines.
4. Restore into a separate freshly migrated EMPTY database. Refuse to write to source or occupied database. Record verified row fingerprints and exact schema version; no global privileges in browser/frontend.

### B. Restore from a phone/computer file

1. For portable JSON: client-side check as stage 1, then an owner-only capped upload to an ephemeral private staging job (future); reverify hash server-side, project origin, schema and relational constraints. Files may contain owner/member UUIDs but do NOT contain authentication identities.
2. For 9-table `restore.tar.gz`: use the existing secure isolated restore tool on server, with manifest and archive digest; do not decode TAR in the browser or import Excel as a database.
3. For legacy encrypted archives: only the dedicated legacy key and isolated restore flow, never silently accept one format as another.
4. The upload endpoint must not expose `SUPABASE_SERVICE_ROLE_KEY` to the client; uploads use short-lived scoped job IDs, explicit owner + re-auth, MIME-independent magic/extension/size checks, rate limits, private temporary storage with TTL, no raw data in client logs, and denial on unknown versions.

### C. Comparison / preview (must precede any write)

Obtain one consistent read snapshot of the **current** DB and one verified recovered isolated dataset. Compare per-table:
- Count: present in current only, backup only, same, and changed by stable ID + canonical row digest.
- Financial: work balance by contractor, cash balance by vehicle + responsible contractor, opening balances, canceled rows, totals by period and effective day; never compare only row counts.
- Dependencies: trip→vehicle/contractor/cash account, payment→vehicle/contractor and optional descriptive trip link, opening→account, version and actor auditing.
- Identity boundary: owner/members/Auth mismatch, current schema vs archive version, date/time and storage coverage.
- Conflicts explicitly labeled; NO silent merging, default replace, deletion or reference reassignment.

Result: a report diff, concise human-readable explanation of exactly what would be lost/created, downloadable review evidence and an approval token bound to source+target snapshots. Any live changes between preview and commit **invalidate** the approval and require fresh compare.

### D. Apply mode and semantics

**Recommended first production-capable path: whole restoration by tested environment cutover**, NOT destructive in-place overwrite:
1. Pause new writes with explicit maintenance lock. Force and verify fresh encrypted/offsite snapshot of current state. Test the rollback snapshot.
2. Recover selected archive on separate prepared environment and verify all schema/RLS, financial and Auth identity rules.
3. Compare and obtain owner re-auth + double confirmation of archive timestamp and destructive effects. Display the last transaction timestamp to be lost. Never treat downloaded CSV/Excel as valid restore source.
4. Switch the application target only through controlled deployment/cutover, keeping old DB as immutable rollback; verify login, reports, backup operation and financial totals. Ability to revert the switch must be tested first. A successful restore of *business-only* archive does not restore Auth and cannot automatically switch without identity migration.
5. Only after monitoring/approval, release write lock. Do not delete old DB automatically.

**Selective restoration** (future separate milestone): only an audited, owner-approved domain command using the existing financial rules and FK graph. Prefer correction/cancellation with reasons and transactionally validated effects, not raw INSERT/DELETE. Must refuse ambiguities, conflicting versions, changed account responsibility, duplicate idempotency keys and immutable audit history. No blind INSERT ON CONFLICT or merge by date/name.

**Bulk day / vehicle / contractor action** (future separate milestone):
- Day: preview list of impacted trips and related payments/accounts, model financial deltas, then cancel selected day trips using audited batch transaction if safe. Payment transactions remain independent and are NOT automatically canceled. Prevent partial completion and concurrent changes; give clear per-row reason/audit.
- Vehicle / contractor: use existing archive/re-activate (reversible) by default. Never cascade-delete historical trips/payments; protect primary contractor, balances and references. Optional historical-day hiding is a display filter, not deletion.
- "Delete all": no self-service destructive button in v1. For customer handoff with empty data, create a **new clean project** and verified credentials instead of truncating a live financial ledger. If a privileged reset flow is ever introduced, require separate explicit user approval, tested rollback and protected environment approval.

**No three-way-merge by default**: old + new data must not be silently combined. Work transactions, cash, opening balances and audit logs are interdependent. Unresolved conflicts block restore; human chooses a valid business correction in a separate review flow. Merge and replace have different guarantees; both require separate tests and approval.

## 4. Non-negotiable gates before any actual restoration can ship

- Role: owner-only; client-only UI cannot perform SQL, storage or Drive write operations; anonymous, revoked member and unauthorized direct RPC rejected.
- File: trusted hash+format+source ref, size and compression limits, negative tampering; rejects missing/extra tables, wrong versions, unsafe numeric precision, malformed timestamps, invalid foreign keys, incompatible Auth/owner identities.
- Database: snapshot-consistent preview; source and target fingerprints match; 2 independent simultaneous writes handled with maintenance fencing; transactionality, audit and rollback on injected failures; idempotent retry; no corrupted partial state.
- Financial: compare all contractor and cash balances and opening cutoffs, D13 paid-trip corrections, D15/D16 dated cash constraints, negatives, canceled entries, linked historical payment references, and permanent idempotency keys.
- Product: desktop + Android file picker / large files / Arabic + RTL / slow network / tab close / session expiry; no responsive report regression.
- Backup: scheduled Google Drive upload/retention still passes regression tests before and after new feature, plus a real newest-backup restore drill into separate empty target.
- Deployment: exact head CI + independent code diff review + isolated rehearsal + controlled production acceptance; user explicitly approves merge. Never auto-merge an unreviewed restore capability.

## 5. Delivery / rollback

Current production branch remains the accepted version; all features here are independent and read-only. Feature can be reverted by removing the inspector import/component/module/test without schema changes. If any inspection problem appears, users still have the existing JSON/CSV downloads and Google Drive backup history.

**Next milestone:** owner-only cloud download and isolated comparison API. No actual restore or deletion before the separate migration, credentials, rehearsal, explicit approval and safety gates above.

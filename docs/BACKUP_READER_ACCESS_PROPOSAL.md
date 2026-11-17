# Temporary backup reader — pending specific access approval

This is an access proposal, not an applied production migration. The owner approved creating a dedicated backup user, but automatic review rejected the previous unrestricted public/auth/storage table grant and indefinite BYPASSRLS access. No production backup role was created.

## Exact proposed scope

- Source project: `sskkuniskphlawivzudw` (1-mohamed). This is not a website user or Supabase Auth account.
- Role: `offsite_backup_reader`, initially NOLOGIN, NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOREPLICATION, connection limit 2.
- BYPASSRLS is needed to export every application row. It does not grant SELECT on additional tables by itself.
- SELECT only on the existing 11 public tables: app_members, app_owner, audit_log, business_settings, contractors, idempotency_keys, opening_balances, payments, trips, vehicle_accounts, vehicles.
- SELECT only on `auth.users` and `auth.identities`, including password hashes, to restore accounts and their application UUID mappings. Do not read MFA secrets, sessions, refresh tokens, OAuth client secrets, Vault or unrelated managed tables under this grant.
- SELECT on `storage.buckets` and `storage.objects` only to fail closed if Storage bytes start needing their own backup.
- SELECT on existing public sequences only to preserve sequence values. No broad pg_read_all_data membership, no default grants for future tables and no INSERT/UPDATE/DELETE privileges on application tables.
- Default transactions read-only, statement timeout 15 minutes. These session defaults prevent accidents, not all capabilities inherited through PostgreSQL PUBLIC privileges; audit those separately.
- Password valid for 24 hours for the restore drill. Enable LOGIN only after encrypted credential transfer and GitHub Environment secret storage succeed. Do not extend validity or turn on scheduling without restore evidence and separate activation approval.
- Random password generated server-side, encrypted with a one-time local OpenPGP public key before leaving Supabase. Only encrypted ciphertext may cross tool output. The temporary decryption key stays outside Git; decrypt locally and pass the connection string directly to GitHub's encrypted Environment secret. Never show plaintext credentials or put them in Git.
- Disable LOGIN and clear the password after the drill, then remove temporary cryptographic transfer files. Existing website accounts and their passwords are unchanged.

## Verification required

Before granting source access, verify in the separate free restore project that protected rows can be read and INSERT/UPDATE/DELETE and reads from unrelated tables fail. Prior fixture testing confirmed full RLS-row reads and denied business writes; that is not a complete credential/export test. After source creation, verify exact grants and role flags without returning row contents or password hashes to chat.

The exporter needs a dedicated direct `pg_dump` mode: the pinned Supabase CLI switches to postgres, so simply changing its connection username is insufficient. Reject any unsupported recovery-critical Auth data rather than silently omitting it. The source snapshot, encrypted round-trip and separate-project restore must all pass before acceptance.

No changes to production application rows, existing user passwords, Auth identities, role memberships, RLS policies or app functions are part of this proposal. Restoring into the separate project has its own target checks and credentials.

Reference: [Supabase backup role guidance and its limitations](https://supabase.com/kb/troubleshooting/pg_dump-fails-with-query-would-be-affected-by-row-level-security-policy-1d5783).

# H054 — T10.1 and isolated T10.4 Critical Checklist

## Financial, security and integrity
- Scope is Node-only core and isolated-memory store. A real backup must contain ALL business tables (8): contractors, vehicles, vehicle_accounts, opening_balances, trips, payments, audit_log, idempotency_keys; omit auth.users/app_owner and secrets, which are not part of customer business data.
- Versioned format + canonical SHA-256 digest over metadata and full dataset. Hash detects damage but offers no signature/authenticity. Reject missing/extra tables, row keys, invalid/duplicate IDs, cross-account FK mismatch, invalid date/piastres, mismatched trip computed totals, unsafe keys, unsupported version. Preserve canceled history and permanent idempotency keys. Accept valid CONTRACTOR_WORK opening with null vehicle_id.
- Isolated transaction prototype checks owner flag and generation, verifies entire candidate before any mutation, creates and verifies a safety copy (mandatory saveSafety acknowledgment), then commits via a single memory pointer swap; failing beforeCommit or safety leaves prior state unchanged. Stale requests carrying the previous epoch fail after restoration.
- This prototype is NOT a database adapter: does NOT implement Supabase RLS/owner checking, transaction locks, real point-in-time snapshot, durable safety-copy storage, PostgreSQL rollback, backups encrypted/signed, external backup location, retention scheduling/14-copy policy, true multi-session B08. All remain mandatory release gates, including D07 and real Supabase-TEST. No UI/button or persistent write until then.

## Review and CI gate
- Inspect all changed files, make isolated fixes for evidence-backed issues only.
- Run new Node tests plus full package units, PostgreSQL A/B/C/payment SQL, three negative controls, Next build and HTTP/SDK boundaries, 23 Chromium E2E on final HEAD.
- Post a separate critical review with actual evidence to PR, then squash merge if green; verify the main SHA. Avoid documentation-only CI loops.

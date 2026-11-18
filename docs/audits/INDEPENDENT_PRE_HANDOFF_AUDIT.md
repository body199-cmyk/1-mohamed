# Independent pre-handoff audit — LIVE working record

Status: **in progress; evidence is appended as discovered so another engineer can resume safely.**

- Audit date: 2026-11-18 (UTC sandbox).
- Repository: `body199-cmyk/1-mohamed`.
- Main baseline: `47742e3ae5f7a7846e10e10960ac6fc5ada1bf2e`.
- PR #98 baseline: `b0b3bde7c287c745b277be22930d68dc8a5b49a9` (three UI files; 11 additions/7 deletions).
- Mode: independent source review plus isolated local checks. No hosted database connection, production browsing with real records, deployment, migration, configuration change or production-code edit.
- Safety: no production INSERT/UPDATE/DELETE/TRUNCATE, restore, seed, or reset will be attempted. Temporary local test files and synthetic fixtures only.
- Platform security: the reviewed project deploys to Vercel/Supabase, not Genspark Hosted. Genspark access descriptors are therefore not applicable; actual Next.js and database gates are audited.

## Executive summary (provisional)

One confirmed HIGH financial workflow failure and one confirmed MEDIUM revision-invalidation loading deadlock are already recorded below. The exact arithmetic and authorization implementations remain under review; passing tests are not treated as proof of correctness. Do not interpret an early checkpoint as a complete audit or release recommendation.

## Live findings (full evidence for each)

### F-001 — HIGH — Master-data opening balance always sends the wrong JSON type

- **Status/confidence:** Confirmed by the complete UI → fetch → Route Handler → SQL argument trace; an isolated SQL fixture run is in progress.
- **Files/functions:**
  - `apps/web/src/features/ledger/master-data-entry.tsx:60-79`, `createOpening`; especially line 63 (`poundsToPiastres` returns a string) and line 73 (`signed_piastres: piastres`).
  - `apps/web/src/lib/ledger/amounts.ts:12-25`, `poundsToPiastres`, whose declared return type is `string`.
  - `supabase/migrations/20261104200011_phase_b_operations.sql:490-569`, `app_op_opening_balance_create`; line 526 calls `app_exact_bigint` with the JSON value.
  - `supabase/migrations/20261104200010_phase_b_foundation.sql:85-114`, `app_exact_bigint`; lines 93-95 reject every value where `jsonb_typeof(p_value) <> 'number'`.
- **Root cause:** the existing Master Data opening form was not included in the earlier Daily quick-opening string-to-number correction. `JSON.stringify` transports the resulting value as `"100"`, not `100`.
- **Minimal reproduction (isolated only):** call `createOpening` with an active account, valid start date and amount `100`. The body contains `payload.signed_piastres: "100"`. PostgreSQL `app_exact_bigint` rejects the string with SQLSTATE `22023`; the Route Handler converts it to a non-OK response. No row is intended to be inserted.
- **Expected:** a valid opening balance is accepted atomically, preserving exact whole-EGP arithmetic. **Actual:** both `CONTRACTOR_WORK` and `VEHICLE_CASH` created through this form fail SQL numeric validation.
- **Impact:** the owner cannot enter old balances through the visible Master Data workflow; opening balances are needed for historical reconciliation. This is a write-path availability failure, not evidence of existing rows being changed or duplicated.
- **Minimal recommendation:** at this form boundary, retain exact BigInt validation and range rules, then emit a JSON number only for an exactly representable signed integer, as the already-fixed Daily path does; otherwise reject before writing successfully. Reuse a shared tested serializer only if doing so cannot change the quick-opening contract. Preserve native historical bigint handling; do not silently approximate or convert to floating point.
- **Regression risk of fix:** MEDIUM/HIGH for numeric boundaries. Tests should cover negative values, whole-pound rounding, zero, MAX_SAFE_INTEGER, just-over-safe values, and both opening types; mock-only assertions must be paired with actual isolated PostgreSQL execution. Any serializer modification must preserve other operation payload types.
- **Evidence note:** `docs/ISSUES.md:217-218` explicitly identifies this separate path as unresolved; this audit independently verified that the current main source still exhibits it.

### F-002 — MEDIUM — Data revision invalidates contractor requests but leaves loading locked

- **Status/confidence:** Confirmed by control-flow inspection of the current main code and direct comparison with PR #98.
- **File/function:** `apps/web/src/features/ledger/real-contractor-statement.tsx:37-41` (revision effect) and `:75-103` (`more`).
- **Root cause:** the revision effect increments `active` and clears the report/query, but neither resets `busy` nor clears the prior error. If a write or other refresh increments `revision` while initial loading or pagination is awaited, stale response returns are ignored, but `finally` on main is unconditional for `more`; the missing reset/exact race requires explicit PR #98 review. At the exact PR head the guards are correct for old cleanup, but the effect outside `reset()` remains incomplete.
- **Reproduction:** start a contractor initial or next-page request, delay the response, then cause `revision` to change. Continue revision changes before/around the old promise completion in a controllable fixture test. **Expected:** the active revision can immediately issue a fresh read and old results/errors cannot affect it. **Actual on PR #98:** this revision effect performs no `setBusy(false)` and no `setError('')`; a pending request can leave the new report locked after invalidation until its own finally executes. `reset()` being fixed does not cover this independent effect.
- **Business impact:** contractor statements can remain in a loading/disabled state and hide currently applicable errors/results; no demonstrated stored-money corruption.
- **Minimal recommendation:** consolidate revision invalidation into the same guarded reset behavior, with tests for initial and pagination requests, repeated rapid filters/revisions, unmounting and old-error isolation. **Regression risk:** MEDIUM; setting busy false must not accidentally permit an old request to mutate the new one—continue using request generation guards on every state write.

### F-003 — MEDIUM/MEDIUM-HIGH — Portable backup reads independent offset pages without a snapshot gate

- **Status/confidence:** Confirmed structural lack of consistency protection; probability of real data divergence depends on concurrent write volume. No hosted read/write was executed.
- **Files/functions:** `apps/web/src/app/api/backup/export/route.ts:13-41` (`readOneTable`, `readAllTables`), `:43-67` (`GET`); inspect `apps/web/src/lib/backup/export.ts` separately for final validator guarantees.
- **Root cause:** each of the application tables is fetched sequentially in one or more HTTP/PostgREST requests using offset pagination. There is no transaction shared across calls, no snapshot/revision token checked between pages, and no final revision revalidation around the resulting backup. Deterministic ordering prevents ordinary key-shuffle omissions but not concurrent inserts, cancellations or edits across calls.
- **Reproduction (safe fixture needed):** while a table has multiple pages, commit a synthetic update/cancellation between two page calls; repeat with a referenced row changing between two contiguous tables. Compare the exported rows to one serialized database snapshot.
- **Expected:** every backup represents one complete database point in time, or fails explicitly. **Actual from source:** the API can mix states from different PostgreSQL requests and treat the set as one backup; creation-time metadata does not prove an MVCC snapshot.
- **Impact:** a recovery archive used for financial recovery may be internally inconsistent or omit/include versions from different times. This is distinct from the separate reviewed offsite snapshot pipeline and does not claim that pipeline is broken.
- **Minimal recommendation:** use a database snapshot export/revision protocol covering all tables and validate it before completion; fail closed on any revision drift. Offset limits alone are not a restore-consistency mechanism. **Regression risk:** HIGH because restore/backup contracts, schema and test fixtures need coordinated coverage (multi-page writes, relationship changes, stable row counts and exact fingerprints).
- **No production action taken:** explicitly no run of backup/export or restore against hosted data.

## Scope and methodology (running inventory)

- Read: `AGENTS.md`, `STATUS.md`, `TASKS.md`, `CODE_MAP.md`, `ACCOUNTING_RULES.md`, `ARCHITECTURE.md`, `DATA_MODEL.md`, `ISSUES.md`, current acceptance/readiness docs.
- Applications: one Next.js 16/React 19 workspace application (`apps/web`) with public demo routes, private `/app`, Auth, ledger and backup Route Handlers; four domain/documentation packages (`accounting`, `trip-entry`, `contractor-statements`, `statement-export`).
- Database: 23 committed migration files, Supabase Auth/RLS/RPC, isolated SQL harness and 19 primary test files; one member-invitation Edge Function; separate backup/reader tooling.
- HTTP endpoints discovered: `POST api/auth/login`, `GET|POST api/auth/members`, `GET api/backup/export`, `GET api/backup/history`, `GET api/ledger/master`, `POST api/ledger/operations`, `POST api/ledger/read`, and `GET auth/callback`.
- Important verified documentation discrepancies: old sections of `ARCHITECTURE.md`, `DATA_MODEL.md`, `CODE_MAP.md`, `TASKS.md` and `STATUS.md` still say demo-only/no migrations/owner-only despite later live membership/migrations/backup history. Current source, not those historical statements, governs this audit.
- Method: trace inputs and stable request IDs through React state, fetch, methods/Origins, signed claims, membership RPC, database locking/idempotency/auditing and report readers; independently inspect export escaping and completeness.

## Safe test results

| Command/check | Status | Evidence |
|---|---|---|
| `git fetch origin main pull/98/head:refs/remotes/origin/pr-98` | PASS | main at `47742e3…`; PR #98 head fetched at `b0b3bde…`; no local source change. |
| `gh pr view 98 ...` / independent full diff | PASS | PR #98 is OPEN, Draft, MERGEABLE, targeting main; exactly 3 UI files, no DB changes. CI run claimed by PR body not independently sufficient. |
| `npm run db:verify` | RUNNING | PGlite isolated verifier only; redirected to an uncommitted local log under `docs/audits/`. |
| Source grep for endpoint methods, RLS/RPC definitions and raw HTML sinks | PASS | Endpoint inventory captured; no direct `dangerouslySetInnerHTML`/DOM HTML-injection sink found by the initial grep. Dedicated generated-HTML/CSV checks still to review. |
| Production destructive or live-data tests | NOT RUN (safety decision) | Prohibited without isolated/test fixtures; no real business rows or credentials accessed. |

## PR #98 independent review — provisional

The final cleanups in `finally` are appropriately token-gated for `real-reports.tsx`, `real-cash-statement.tsx` and contractor initial/more flows, preventing old completions from clearing a new busy flag. `reset()` now clears busy for filter changes in the cash/contractor components. **However, the contractor revision effect at lines 37-41 does not call that reset**, so F-002 remains relevant specifically at revision changes. General reports also have revision/period effects to test, so a green full CI is not a substitute for that race scenario. No merge or PR modification is authorized/performed.

## False positives and unresolved questions

- Existing owner checks now mean `app_has_access()` for approved business members, not strict owner alone; this is intentional in the membership migration. Invitation management and backups separately require `app_is_owner()`.
- Missing Origin is allowed for non-browser API calls in `request-origin.ts`; this alone is not a CSRF bypass. Browser cross-site Origin and `Sec-Fetch-Site: cross-site` are rejected, and signed claims plus DB access checks remain mandatory. Do not label it vulnerable merely because CLI requests lack Origin.
- `docs/ISSUES.md:218` is historical evidence for F-001 but does not replace the source trace or planned actual isolated test.
- Numeric formatted text in XLSX may be intentional to avoid spreadsheet precision loss; not automatically a functional defect.
- Exact current hosted Auth settings, deployment migration parity and production records are outside this audit's evidence; no claim is made from old STATUS entries.

## Remediation priority and release recommendation (provisional only)

1. STOP incorrect UI/API opening-balance writes; independently execute isolated SQL and wire-payload regression before owner acceptance.
2. Add deterministic stale/revision/unmount race tests before accepting PR #98. Ensure no active generation can have its state overwritten by an obsolete generation.
3. Do not treat portable export as a proven recoverable consistent backup until snapshot semantics and real isolated recovery are proven.
4. Complete full source/security/dependency/browser audit before final GO/NO-GO decision.

**Current recommendation: CONDITIONAL GO is not yet justified; keep as audit-in-progress / NO-GO for new final-owner sign-off pending completion below.** This does not request or authorize a production rollback.

## Preservation attestation

So far only `docs/audits/INDEPENDENT_PRE_HANDOFF_AUDIT.md`, the companion JSON, and temporary local verification output are created in the audit workspace. Production code, production data, Supabase/Vercel settings, PR #98 and main have not been modified, merged, reset, migrated, or deployed by this audit.

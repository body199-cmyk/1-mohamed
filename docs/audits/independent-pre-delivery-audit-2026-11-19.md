# Independent Final Pre-Delivery Audit — Project 1-Mohamed

**Audit date:** 2026-11-19
**Auditor role:** Independent software auditor (full-stack · financial systems · application security · database/Supabase · QA automation · RTL/responsive UI)
**Assignment type:** AUDIT ONLY. No source code, migration, schema, policy, dependency, test or configuration was modified. No pull request was merged. Nothing was deployed.

---

## A. Executive Summary

The application is a well-engineered, defensively built transport ledger: money is stored as integer piastres, all financial writes go through owner-gated `SECURITY DEFINER` RPCs with

advisory-lock serialization, idempotency keys, append-only audit, snapshot-consistent reads and version-based optimistic concurrency. The isolated PostgreSQL suite (43 steps across 20 migrations) and the web/unit suite (271 tests) pass completely, and I independently re-derived the accounting behaviour from the SQL rather than trusting the tests.

**The headline result of this audit is negative-correcting:** the "trip edit after payment reassigns money to the wrong account" defect that earlier audits flagged is **not** present as a financial mis-allocation in the current code. Cash balances are derived from `(vehicle_id, responsible_contractor_id)` on the *payment* row, not from the trip link, so moving a trip to a different account leaves the money where it was actually paid — which is exactly what the approved rules (A04, D02, D13) require. I proved this by reproduction.

**However, one genuine defect is confirmed and reproducible on `main`:** the payment↔trip descriptive link guard (`app_payment_trip_link_guard`, migration `20261104200030_payments_schema.sql:44-70`) re-validates the historical link on *every* `UPDATE` of the payment row. After a legitimate trip correction that moves the trip to another account (or changes the responsible contractor), any subsequent edit of an existing payment that still carries `linked_trip_id` — including a notes-only edit — is rejected with SQLSTATE `23514`. This is a **functional availability defect on a documented, approved workflow**, not a money-integrity defect: no balance is wrong, but the user cannot edit metadata, amount or date of that payment through the UI ever again, and the error message is generic. PR #102 (open, unmerged, not part of `main`) addresses exactly this.

A second, lower-severity gap: the audit trail records a trip's `vehicle_id`/`direction`/`weight`/`origin`/`destination`/`receipt`/`notes` diffs, but **not** the change of `responsible_contractor_id`. Since that column is what determines which cash account the trip's due lands in, the audit log cannot reconstruct *which account the money moved between* from the `diff` field alone (it is still derivable from `old_data`/`new_data` full row snapshots).

**Finding tally:** 0 Critical · 0 High · 1 Medium · 9 Low (F-01 … F-10; F-09 is Suspected, all others Confirmed) · plus 9 explicit non-findings.

**Verdict: READY WITH MINOR ISSUES.** One Medium functional defect should be fixed before handover (the minimal fix already exists as unmerged PR #102 and must be reviewed and applied deliberately). No Critical or High financial-integrity defect was found on `main`.

---

## B. Audit Scope

### B.1 Exact project state

| Item | Value |
|---|---|
| Audited commit | `65b0d23a1f30791624447368276e421e668780fb` |
| Commit subject | `Unify fixed paper previews and exports across reports (#103)` |
| Audited branch | `main` (verified identical to `origin/main`) |
| Working tree | clean (`git status --porcelain` empty) |
| Audit working branch | `arena/1b246167-1-mohamed` (docs only) |
| Repository layout | npm workspaces monorepo: `apps/web` (Next.js 16.4.5 / React 19.3.1), `packages/{accounting,trip-entry,contractor-statements,statement-export}`, `supabase/{migrations,tests,functions}`, `tools/`, `e2e/` |

### B.2 Open pull requests and their relationship to `main`

| PR | Branch | State | Relevance to this audit |
|---|---|---|---|
| #103 | `fix/fixed-report-export` | MERGED (= audited HEAD) | Defines current report/export baseline |
| #102 | `fix/historical-payment-reference` | **OPEN, unmerged** | Fixes the confirmed defect **F-01** below; not in `main` |
| #101 | `audit/independent-path-a-b-pr100` | DRAFT | Prior audit report only |
| #100 | `fix/independent-audit-findings` | OPEN, unmerged | Purports to fix prior audit findings |
| #99, #98, #97, #96 | — | DRAFT / merged | Prior audit doc, report-safety, then-merged report previews |
| #86 | `codex/confirmed-data-deletion-20261115` | DRAFT | Password-confirmed deletion scopes; not in `main` |

**Everything in section D/E below is a defect in `main` unless explicitly labelled "unmerged branch only".** I found no defect that exists *only* because of an unmerged branch, since unmerged branches are not deliverable code.

### B.3 Modules examined

- **SQL (all 20 migrations, 4 272 lines):** auth/owner gate, core entities, audit + idempotency, phase B operations, trip schema/maths/operations/details, payments schema/operations, FIN-04 cash-opening timeline, FIN-05 period opening, payment keyset history, trip cancellation reason, contractor statement, report snapshot + cash statement, helper search-path lock, whole-pound D19 policy, all-history reports, owner-managed members, backup history.
- **SQL test suites (20 files):** full isolated harness plus A/B/C, payments, FIN-01/02, FIN-07, FIN-04, FIN-05, keyset, cancellation, statement, snapshot, search-path, D19, all-history, members, backups.
- **Next.js app:** `proxy.ts` route/method allowlist, 7 API route handlers, Supabase client/server/session/owner modules, origin guard, operation allowlist, backup export + history.
- **Features:** ledger workspace (daily entry, trip edit, payment entry, record actions, statements), reports (daily, vehicle-cash, dashboard, export actions/preview/documents), master data, payments, auth (login, reset, recovery callback, member invitations), demo store.
- **Export package:** fixed A4 print styles, HTML/PDF/PNG/CSV/XLSX renderers, pagination, document validation.
- **Backup tooling:** `tools/backup-core.mjs`, `tools/offsite-backup.mjs`, `tools/backup-reader/*`, `tools/production-preflight.mjs`, GitHub workflows (`verify.yml`, `offsite-backup.yml`).

### B.4 Tools and environment used

- Node v22.22.3, npm 10.9.8, Python 3.11.2
- `@electric-sql/pglite` 0.5.15 → **PostgreSQL 18.6 (WASM)**, single in-memory connection
- Vitest 5.1.0, Playwright 1.64.1, Next.js 16.4.5 production build
- `gh` CLI for PR state, `git` for state verification

### B.5 Limitations — explicitly NOT verified

1. **No hosted Supabase.** No GoTrue/JWT/PostgREST/RLS-under-real-JWT testing. Auth flows, cookie refresh, invitation emails, and RLS behaviour under a real PostgREST connection are **NOT VERIFIED**.
2. **No real concurrency.** PGlite is one in-memory connection; `pg_advisory_xact_lock` serialization was verified by code reading and by the suite's design intent, **not** by two simultaneous sessions. True race behaviour is **NOT VERIFIED**.
3. **No browser.** `npx playwright install chromium` failed (network blocked: `Failed to download Chrome for Testing`). Therefore all Playwright UI/E2E, real canvas rendering, screenshot capture at 360/768/1280, and PDF/PNG byte-level device-determinism assertions were **NOT EXECUTED**. The 68 workspace specs failed **only** with `browserType.launch: Executable doesn't exist` — an environment limitation, not a product failure.
4. **No Google Drive / offsite backup execution.** `SUPABASE_DB_URL`, `AGE_RECIPIENT`, rclone credentials absent. Live upload, retention deletion and restore drills are **NOT VERIFIED** (matching the repo's own `docs/ISSUES.md` GOOGLE-DRIVE-BACKUP-05 note about an unresolved rclone quota 403).
5. **No production deployment inspection.** Vercel configuration, `APP_ENABLE_REAL_DATA` production value, and Supabase project state were not accessible.

---

## C. Test Results

All commands run against `65b0d23`, tree unmodified.

| # | Command | Result | Notes |
|---|---|---|---|
| 1 | `npm ci` / `npm install` | **PASS** | 93 packages, 0 vulnerabilities (`npm audit --omit=dev`) |
| 2 | `npm run check` (typecheck + all workspace tests) | **PASS** | `tsc --noEmit` clean; accounting 24, trip-entry 18, contractor-statements 30, statement-export 59 |
| 3 | `npm run test:web` | **PASS** | 28 files, **194 tests** |
| 4 | `npm run db:verify` | **PASS** | **43/43 steps**, PostgreSQL 18.6, final state `{trips:24, payments:10, audit_rows:60, idempotency_rows:61, write_rpcs:19, tables:12}` |
| 5 | `npm run db:verify:negative` | **PASS (expected failure)** | TRUNCATE protection removal detected |
| 6 | `npm run db:verify:negative-b` | **PASS (expected failure)** | owner-gate removal detected |
| 7 | `npm run db:verify:negative-c` | **PASS (expected failure)** | trips TRUNCATE removal detected |
| 8 | `npm run build` | **PASS** | 15 routes + proxy, no build warnings |
| 9 | `node tools/auth-boundary-smoke.mjs http://127.0.0.1:39201` | **PASS** | fail-closed private GET/POST, isolated demo |
| 10 | `APP_ENABLE_REAL_DATA=true node tools/auth-cutover-smoke.mjs http://127.0.0.1:39202` | **PASS** | flag alone exposes no demo/data/writes |
| 11 | `node tools/auth-sdk-boundary-check.mjs` | **PASS** | pinned SDK, owner-gated proxy |
| 12 | `node --test tools/production-preflight.test.mjs` | **PASS** | 3/3 |
| 13 | `node --test tools/backup-core.test.mjs` | **PASS** | 16/16 |
| 14 | `node --test tools/offsite-backup.test.mjs tools/backup-reader/{contract,restore-contract}.test.mjs` | **PASS** | 19/19 |
| 15 | `npm run test:workspace` (Playwright) | **NOT EXECUTED (environment)** | 68 specs blocked by missing Chromium binary |
| 16 | Playwright UI/auth suites (`playwright.ui.config.ts`, `playwright.auth.config.ts`) | **NOT EXECUTED (environment)** | same |

**Totals:** 271 unit/web tests passed, 43 PostgreSQL steps passed, 4 node tool suites passed, 3 negative controls behaved correctly. **0 product test failures.** All Playwright/visual suites not executed for environment reasons.

### C.1 Independent reproduction probes (my own, not the repo's)

I built an isolated harness that applies the *same* migration order as `tools/db-verify.mjs` in a fresh in-memory database, then ran purpose-written probes. Because the repo's suites seed business rows that their assertions depend on, my fixtures deliberately used unused IDs.

**Probe 1 — D19 whole-pound trip maths**

| Input | Actual | Expected (ACCOUNTING_RULES §A01/D19) |
|---|---|---|
| 1.5 t × 100.49 → 100 | `15000` piastres (150 EGP) | 150 EGP ✅ |
| 0.499 t × 1 | `0` | 0 ✅ |
| 20 t × 45 + 100 | `100000` (1 000 EGP) | 1 000 ✅ |

**Probe 2 — payment guards**

| Case | Result |
|---|---|
| Partial payment 400 against 1 000 due | accepted, `remaining=250000`→`175000` ✅ |
| Overpayment 5 000 | rejected `P2016` (D16 message includes account/date) ✅ |
| Amount rounding to zero (0.4 EGP) | rejected `22023` ✅ |
| Future-dated payment | rejected `22023` ✅ |
| Three-decimal amount | rejected `22023` ✅ |
| Payment before cash-opening start | rejected `22023` ✅ |
| Second same-day payment exceeding remaining | rejected `P2016` (D15: work before payments) ✅ |

**Probe 3 — D13 correction of already-paid work**

| Step | Result |
|---|---|
| Opening 0, trip 1 000, fully paid 1 000 | balance `0` ✅ |
| Correct the paid trip down to 900 | **accepted**, balance `−10000` (−100 EGP "على العربية") ✅ |
| New payment while balance ≤ 0 | rejected `P2016` ✅ |
| Later work 300 at the **same** account | balance `30000` (auto-recovered) ✅ |
| Work 500 at a **different** account | other account gets `50000`; the deficit is untouched ✅ |

**Probe 4 — trip cancellation of already-paid work**
Cancelling a fully-paid trip succeeded and left the payment untouched with the trip row retained (`is_cancelled=true`, reason preserved). Balance went to `0` for the opening-1 000 case: the opening then becomes the sole claim, and the payment remains a real historical payment — consistent with A05/D03 ("cancellation removes the accounting effect, retains the original and the reason") and A04 ("payments are not cancelled silently by trip cancellation"). ✅

**Probe 5 — trip correction and the payment link (the finding)**

| Scenario | Result |
|---|---|
| Payment created with `linked_trip_id` | accepted ✅ |
| Trip corrected so responsible contractor changes (direction flip) | trip correction **accepted** ✅ |
| Then edit that payment, amount/date/account **unchanged**, notes only | **REJECTED `23514` "Payment trip reference does not belong to this vehicle account"** ❌ |
| Same edit but clearing the link | accepted (workaround: destroys the user's descriptive reference) |

**Probe 6 — export pagination & fixed layout (no DOM)**

| Rows | Pages | Rows preserved | Max rows/page |
|---|---|---|---|
| 0 | 1 | yes | 0 |
| 14 | 1 | yes | 14 |
| 15 | 2 | yes | 14 |
| 100 | 8 | yes | 14 |
| 840 | 60 | yes | 14 |
| 900 | — | refused with explicit message (60-page cap, no silent data loss) |

Every paginated page produced `height === OPERATIONAL_REPORT_PAGE_HEIGHT` (2036 px): the fixed A4 layout is independent of row count and hence of viewport. ✅

**Probe 7 — member (non-owner) access** — see F-10. An owner-granted member (`app_has_access()=true`, `app_is_owner()=false`) can read `trips.list`, `payments.list`, `contractor.statement` and `cash.statement` through `app_op_report_read`, can select directly from `contractors`/`vehicles`/`vehicle_accounts`/`trips`/`payments`/`opening_balances`, and can **write** (`app_op_contractor_create` succeeded). This is the documented intent of migration `20261117131220_owner_managed_members.sql`; owner-only surfaces (backup export/history, member management) additionally call `app_is_owner()`. Recorded as a scope observation in F-10, not as a vulnerability.

**Probe 8 — unauthenticated / non-member (stranger) access — negative control**

| Check | Result |
|---|---|
| `app_has_access()` | `false` |
| `select` on contractors, vehicles, vehicle_accounts, trips, payments, opening_balances, audit_log, idempotency_keys, business_settings, app_owner | **0 rows on every table** ✅ |
| `app_op_trips_read`, `app_op_contractor_statement_read` | rejected `42501` ✅ |
| Owner re-check after the stranger probe | `app_has_access()=true`, 24 trips visible ✅ |

This is an independent, positive proof that RLS is fail-closed for a signed-in non-member, and that the member grant does not widen stranger access.

---

## D. Confirmed Critical and High Findings

**None.** No Critical or High finding survived verification. Specifically, the two issues earlier audits treated as critical are not defect-bearing in `main`:

1. **"Editing a trip after a payment moves the money to the wrong account"** — refuted. `app_payment_cash_balance` (`20261104200031_payment_operations.sql:10-35`), `app_op_payments_read` (`20261109210010:56-71`) and `app_op_vehicle_cash_statement_read` (`20261113120001:41-51`) all aggregate by the **payment's** `vehicle_id`/`responsible_contractor_id`. Correcting a trip changes only the trip's contribution, never the payment's account. Reproduced in Probe 5 and Probe 3 (defect would have shown as money appearing under `AV1/A_MOHAMED` after a direction flip; it did not).

2. **"Cancellation semantics are wrong"** — refuted. Cancellation marks `is_cancelled` with a mandatory reason, excludes the row from every partial index/financial aggregate, keeps it readable, and never touches payments. Verified by code (`20261104200022:253-323`, `20261104200020:44-51`) and reproduction.

---

## E. Medium and Low Findings

### F-01 — Medium · Confirmed — Legitimate payment edits are permanently blocked after a trip correction moves the trip's account

- **Description.** The `BEFORE INSERT OR UPDATE OF linked_trip_id, vehicle_id, responsible_contractor_id` trigger `trg_payments_trip_link_guard` re-validates that `linked_trip_id` still belongs to `(vehicle_id, responsible_contractor_id)`. `app_op_payment_update` always writes those three columns, so validation re-runs on *every* payment edit. After a rule-compliant trip correction (A04/D02/A12/D13 explicitly allow the trip's responsible contractor to change while cash stays on the account that actually paid), the historical link no longer matches. From then on the payment is un-editable until the user erases the link.
- **File / lines.**
  - Trigger + function: `supabase/migrations/20261104200030_payments_schema.sql:44-70`
  - RPC that re-writes the trigger columns: `supabase/migrations/20261104200031_payment_operations.sql:240-246` (update statement), `:227-239` (validation/lock order)
  - Client that always re-sends the stored link: `apps/web/src/features/ledger/record-actions.tsx:113` (`linked_trip_id: financial.linked_trip_id ?? null`)
- **Consequence.** A user who corrects a trip and then tries to fix a typo in a payment note, adjust its amount, or change its date receives a generic 422 (`"تعذر حفظ العملية. راجع المدخلات ثم حاول مرة أخرى بنفس مفتاح الطلب."` from `apps/web/src/app/api/ledger/operations/route.ts:54-59`), which does not explain that the *trip reference* is the obstacle. The only in-app escape is to clear `linked_trip_id`, which silently destroys the receipt/trip reference the user deliberately recorded. Real cash is unaffected — balances remain correct throughout.
- **Reproduction (verified).**
  1. Opening 2 000 EGP for `(AV1, primary)` on day 0.
  2. Create trip day 1, 10 t × 100, direction `AHMED_SUPPLIES` → due 1 000.
  3. Create payment day 1 for 500 with `linked_trip_id` = that trip. → accepted.
  4. Edit the trip: same vehicle, direction → `OTHER_SUPPLIES`, reason supplied, `expected_version=1`. → accepted (responsible becomes the counterparty).
  5. Edit the same payment: identical `vehicle_id`, `responsible_contractor_id`, `payment_date`, `amount_egp`, same `linked_trip_id`, only `notes` changed, `expected_version=1`. → **`23514` "Payment trip reference does not belong to this vehicle account"**.
- **Expected vs actual.** Expected: metadata/amount/date edits are allowed, with the stale descriptive link either preserved as history or flagged. Actual: hard rejection.
- **Evidence.** Isolated-DB probe output (`probe2.mjs` / `probe7.mjs`): `payment note-only edit FAILED: Payment trip reference does not belong to this vehicle account | sqlstate= 23514`; whereas a *date-only* trip correction (account unchanged) left the edit working. Repo's own open PR #102 describes the same reproduction ("independently reproduced with SQLSTATE 23514").
- **Severity justification.** Medium, not High: no money, balance, statement total or audit row is wrong; the failure is safe (rejects rather than corrupts) and recoverable by clearing the link. It does, however, permanently break a documented workflow for affected records and the message is misleading.
- **Smallest safe corrective action.** Apply the minimal, already-drafted fix from PR #102 (`20261119120000_preserve_historical_payment_reference.sql`, 28 lines): only validate when the link or account actually changes (`new.linked_trip_id is distinct from old.linked_trip_id or new.vehicle_id is distinct from old.vehicle_id or new.responsible_contractor_id is distinct from old.responsible_contractor_id`). Do **not** loosen the insert path, and do not switch to a composite FK (the migration comment correctly explains that would block D13 corrections).
- **Regression risk if fixed.** Low but non-zero: the guard also protects against a *client* attempting to move a payment onto an account where its linked trip never belonged. The `distinct from` form preserves that check exactly. The paired test `supabase/tests/21_historical_payment_reference_verification.sql` in PR #102 exercises both "unchanged relationship retained" and "changed relationship still validated" and must be included. Re-run `npm run db:verify` and the three negative controls.

### F-02 — Low · Confirmed — Audit `diff` omits the change of `responsible_contractor_id` on trip edit

- **Description.** `app_op_trip_update` writes `updated_data` (new snapshot) and a `diff` containing `vehicle_id`, `direction`, `weight_milli_tonnes`, `origin`, `destination`, `receipt_number`, `notes` (`20261104200023:246-274`, diff object at `:258-265`). The single most financially significant field — `responsible_contractor_id`, which selects the cash account — appears in `old_data`/`new_data` but not in `diff`.
- **Consequence.** An auditor scanning `diff` alone cannot see that a correction moved the trip's 1 000 EGP due between two accounts; they must diff the two full JSON snapshots. No data is lost.
- **Evidence.** Code trace; `audit_log` schema `20261104200002:10-26`; the `app_write_audit` call sites.
- **Smallest safe corrective action.** Add `'responsible_contractor_id', jsonb_build_array(v_old.responsible_contractor_id, v_responsible)` to the `diff` object in a future additive migration. Optional.
- **Regression risk.** Very low (additive JSON key); any test asserting the exact `diff` shape would need updating.

### F-03 — Low · Confirmed — Payment RPC errors are flattened to a generic message; `P2016`/`22023` financial rejections are indistinguishable to the user

- **Description.** `apps/web/src/app/api/ledger/operations/route.ts:54-59` maps only `P2003`/`23505` to a specific conflict message and returns a single generic 422 for everything else. The valuable, safe messages produced by the database (`'D16: payment … exceeds minimum available … for vehicle … and contractor …'`, `'Payment date cannot be in the future'`, the invoice that the amount rounds to zero, `'FIN-04 …'`) never reach the user.
- **Consequence.** Deliberate anti-leak design (avoids echoing internal financial data) — but it also suppresses actionable, non-sensitive validation reasons, which is what makes F-01 so confusing. UX quality, not integrity.
- **Evidence.** Code trace; directory `docs/` shows the team consciously chose not to echo SQL errors ("SQL error details may contain internal financial data; do not echo them").
- **Smallest safe corrective action.** Map a small allow-list of *known-safe* error codes/messages (P2016, 22023 with a curated reason table keyed by SQLSTATE + a `detail` tag) to Arabic user messages. Do not echo raw SQL text.
- **Regression risk.** Low; must not leak amounts/account IDs.

### F-04 — Low · Confirmed — Payment "link a trip" capability is unreachable from the real (non-demo) UI while the edit path silently depends on it

- **Description.** `linked_trip_id` is a first-class column, validated by a trigger, exported in backups, returned by the read RPC, and re-sent by the edit form. But `apps/web/src/features/ledger/payment-entry.tsx:30-31` never sends `linked_trip_id`, and no real-workspace payment form exposes a trip picker (only the demo store does: `apps/web/src/features/payments/payments-view.tsx:52`). The real UI can only ever *inherit* a link created elsewhere or via API.
- **Consequence.** Minor inconsistency: the defect in F-01 can only be triggered by a payment that already carries a link (e.g. seeded/restored data, or a future UI). Documented in `docs/T08_1_H047_REVIEW.md:10` as intentional ("the reference stays historical") but the UI never surfaces it.
- **Smallest safe corrective action.** Either surface the link (read-only) in the payment edit panel so users understand why an edit fails, or omit `linked_trip_id` from the edit payload when unchanged. The latter overlaps F-01's fix.
- **Regression risk.** Low.

### F-05 — Low · Confirmed — Two divergent copy-pasted table readers in the backup export route with different overflow semantics

- **Description.** `apps/web/src/app/api/backup/export/route.ts` defines `readOneTable` (lines 13-25) and `readAllTables` (lines 26-42) as near-duplicates. `readOneTable` throws only when `offset >= 50000`; `readAllTables` throws at `offset + PAGE_SIZE >= 50000`. The CSV path can therefore return a table truncated at the same nominal limit while the JSON path refuses.
- **Consequence.** A large table (approaching 50 000 rows) could yield a CSV that looks complete while silently omitting rows; the JSON backup correctly refuses. Note `createPortableBackup` also enforces a 50 000 total cap (`backup/export.ts`), so the JSON path is safe; the CSV path has no total-length guard.
- **Evidence.** Code trace of both loops; `MAX_ROWS=50000` assertion only invoked from `createPortableBackup`.
- **Smallest safe corrective action.** Collapse to one parameterised reader and one bound used by both paths; add an explicit "table exceeded N rows, export refused" error to the CSV path.
- **Regression risk.** Low (pure refactor + stricter bound).

### F-06 — Low · Confirmed — `readAllTables` can exceed the row cap before the guard fires, so the guard is late rather than preventive

- **Description.** The check `if(offset+PAGE_SIZE>=50000) throw` runs *after* the page has already been appended, so up to 51 000 rows may be materialised before refusal. Serverless memory pressure only.
- **Evidence.** Same file, lines 30-38.
- **Smallest safe corrective action.** Check before appending; cap total rows across the loop.
- **Regression risk.** Negligible.

### F-07 — Low · Confirmed — Playwright `verify.yml` job depends on the repository's branch-name literals

- **Description.** `.github/workflows/verify.yml` gates the `plain-drill`, `recurring-drill` and `reader-drill` jobs on `github.ref == 'refs/heads/codex/plain-backup-excel'` and `'refs/heads/feat/offsite-backup-t10-20261117'`. Those branches are already merged; the jobs can never run again without recreating them, so the live Drive/restore drills are effectively dead configuration.
- **Consequence.** The only live backup verification paths are unreachable. This matches the open `GOOGLE-DRIVE-BACKUP-05` item in `docs/ISSUES.md`.
- **Evidence.** `grep` of the `if:` expressions; those branches are merged per PR list.
- **Smallest safe corrective action.** Gate on `workflow_dispatch` inputs alone, or on the default branch. Do not change behaviour silently.
- **Regression risk.** Low; but re-enabling a live Drive/restore drill against real data is operationally sensitive and must be gated by the existing `BACKUP_ENABLED`/`BACKUP_RESTORE_VERIFIED` variables.

### F-08 — Low · Confirmed — Audited-commit consistency: `main` documentation describes `payment_history_keyset` before it exists and other doc drift

- **Description.** `docs/T08_1_H047_REVIEW.md`, `docs/STATUS.md` and `docs/HANDOFF_LOG.md` contain long, appended narrative lines that mix approved decisions, historical notes and superseded claims (e.g. "main f7faa16 remains unchanged" while `main` is `65b0d23`). They remain readable but are not a reliable source of current state.
- **Consequence.** Documentation-only; a handover reader could be misled about which commit is live.
- **Smallest safe corrective action.** A short, dated "current state" block at the top of `STATUS.md`/`HANDOFF_LOG.md`, no rewriting of history.
- **Regression risk.** None.

### F-09 — Low · Suspected — Daily-report/statement "opening" semantics for period boundaries rely on the client passing an exact `date_from`

- **Description.** `app_op_payments_read` adds the opening back when its `start_date = v_from` (`20261109210010:63-71`). If the UI ever passes a `date_from` earlier than the account opening, the function raises (`:31-39`) — safe — but an account whose opening is *before* the displayed period receives the opening only through `app_payment_cash_balance(v_from - 1)`. I verified this arithmetic is consistent in isolated reproduction but could not verify the report UI's period derivation end-to-end without a browser.
- **Evidence.** Code trace only; UI test path not executed.
- **Confidence.** Suspected (not a defect claim). No action recommended beyond extending the browser suites to assert period-opening labels.

### F-10 — Low · Confirmed (scope observation) — Workspace members are full read/write operators, not read-only viewers

- **Description.** Migration `20261117131220_owner_managed_members.sql:31-39` rewrites the authorization call inside **every** `app_op_*` function from `app_require_owner()` to `app_require_access()`, and lines `42-47` broaden every `SELECT` policy on the 9 business tables from `app_is_owner()` to `app_has_access()`. A member therefore has the same operational write power as the owner — trips, payments, openings, cancellations — and can read every financial statement. Only genuinely owner-only surfaces stay restricted: `/api/backup/export`, `/api/backup/history` and member management each additionally call `app_is_owner()` (`apps/web/src/app/api/backup/export/route.ts:49-50`, `api/backup/history/route.ts`, `api/auth/members/route.ts:17-19`).
- **Consequence.** This appears intentional ("Approved workspace members have operational access", line 1) and matches the invitation feature. It is recorded because the audit assignment asks specifically about cross-user data access: any invited member can see and alter all financial data, with no per-entity scoping and no "viewer" role. If the customer expects accountant/viewer accounts, that expectation is not met by the current model.
- **Evidence.** Code trace of lines 31-47; reproduction (Probe 7) showing a member executing `app_op_contractor_create` and four read operations successfully, while Probe 8 shows a non-member is fully denied.
- **Smallest safe corrective action.** None required for delivery *if* the business intends every invitee to be a full operator. If a read-only role is wanted, that is a new feature (a `role` column + policy branch) and must **not** be rushed before handover.
- **Regression risk.** High if changed carelessly — this migration re-writes function bodies via `pg_get_functiondef` string replacement, so any later change to those functions must be re-checked for the `app_require_access` substitution.

### Non-findings explicitly checked and passed

- Referential integrity: FKs with `on delete restrict` everywhere on money; composite FK `payments(vehicle_id,responsible_contractor_id) → vehicle_accounts`; `chk_opening_balance_type_fields`; `chk_trips_same_rate`; cancel-metadata checks on trips, payments and openings. ✅
- One-active-opening uniqueness via two partial unique indexes. ✅
- Negative/zero/over-scale input rejection and bigint-overflow guards. ✅ (`app_parse_scaled_unsigned`, `app_trip_totals` numeric + `v_max` check)
- `NOT VALID` whole-pound constraints preserve legacy fractional history while enforcing new writes (D19 intent). ✅
- Rounding: half-up for positives, away-from-zero for negatives, per account per trip, once (`floor((w*r + expense*1000 + 50000)/100000)*100`). Verified numerically. ✅
- Idempotency: `md5(operation|payload)` with `on conflict do nothing`, payload/actor mismatch → `P2001`, permanent retention, and client-side key reuse across retries (`workspace-data.ts:54-62`). ✅
- Optimistic concurrency: `expected_version` required on every update/cancel path. ✅
- Report snapshot staleness: audit `count||':'||max(id)` detects a lower identity committing after a higher one → `40001`. ✅
- Cash-statement reconciliation: refuses to return a ledger that does not reconcile. ✅
- Members: owner-only member inspection; `app_has_access()` for operational RPCs; direct business writes still blocked by `with check (false)` policies. ✅
- Origin/CSRF: `sec-fetch-site: cross-site` denied; `Origin` must equal configured site origin; `null` Origin allowed but then still requires owner JWT + RPC gate. ✅
- No service-role key anywhere in the web app; `.env.example` explicitly forbids it; `server-only` imports guard the server modules. ✅
- XSS: React escaping throughout; the only `dangerouslySetInnerHTML` is a static theme-bootstrap constant (`app/layout.tsx:15`). Export HTML is escaped via `html-escape.ts`. ✅
- CSV injection: `csvCell` prefixes `= + - @ TAB CR` with `'`. ✅
- SQL injection: no dynamic SQL from user input in RPCs; the only `format()`/`execute` use is `20261117131220` over `pg_proc`/`pg_policies` names, not user data. ✅

---

## F. Financial Integrity Assessment

I reproduced the accounting invariants independently rather than relying on the repository's own assertions.

**Correct and proven:**

1. **Balances are derived, never stored.** No balance column exists; every figure is recomputed from `opening_balances + Σ trips − Σ payments` scoped to one `(vehicle, responsible contractor)` account.
2. **Payments belong to the vehicle cash account, not to contractor work difference.** Moving a trip between accounts never moves a payment. Confirmed by reproduction (Probe 5) and by three independent read paths.
3. **D13 (correction of paid work) works as specified.** Reducing a fully-paid trip is permitted, the deficit is displayed as negative ("on the vehicle"), the real payment keeps its amount and date, no offsetting fake payment is created, no double deduction, and later work on the *same* account recovers it while work on another account does not.
4. **A12/D13-B/D15/D16 all behave as specified.** Overpayment, backdated payments that would make any intermediate day negative, payments before opening, future-dated payments, sub-pound payments that round to zero, and >2-decimal amounts are all rejected server-side inside the transaction, not merely in the browser.
5. **Rounding is exact.** Integer piastres, whole-pound normalisation, and a single rounding of each account's total per trip. The three canonical D19 examples reproduce exactly.
6. **Atomicity.** Every write RPC is a single statement/transaction: idempotency gate → validation → advisory `pg_advisory_xact_lock` on sorted account keys (shared by trips, payments and cash-opening triggers) → write → audit → idempotency completion. Any failure rolls back the whole unit, including the idempotency claim.
7. **Cancellation of a paid trip does not fabricate money.** The trip's effect disappears; the payment stays real; the resulting negative is the documented legitimate D13 state.

**Where inconsistency could still arise (none confirmed):**

- Concurrent payment creation on the *same account* is serialized by the advisory lock; on *different* accounts it is properly independent. I could not exercise true concurrency (single PGlite connection) — **NOT VERIFIED**, but the locking code is correct by inspection and the repo's negative controls prove the lock's removal is detectable elsewhere.
- The report snapshot guard depends on `audit_log` being append-only, which is enforced by trigger (`app_block_audit_mutation`) even for `SECURITY DEFINER` writers.
- **No scenario was found in which financial data becomes duplicated, lost, or posted to the wrong account** on `main`. The one financial-adjacent defect (F-01) blocks an *edit*; it does not misstate any figure.

---

## G. Security Assessment

| Area | Result |
|---|---|
| Authentication | Supabase Auth only; passwords never stored/emailed/logged; owner alias resolved server-side; session refresh via `getClaims()`; `signOut()` on non-owner login. **Not verified against a live IdP.** |
| Authorization | Three independent layers: `proxy.ts` allowlist + method rules, per-handler `verifyOwnerForRoute` (`app_has_access`), and `app_require_access`/`app_require_owner` inside every RPC. |
| Cross-tenant / IDOR | Single-tenant by design (`app_owner` singleton + `app_members`). No object-id parameter can escape the account scope; every read RPC re-validates `vehicle_accounts` membership. A signed-in **non-member** was independently proven to see 0 rows on all 10 tables and to be rejected `42501` on read RPCs (Probe 8). Members are full operators by design (F-10). |
| RLS | Enabled on all 12 public tables; `SELECT` policies scoped to owner/member; `INSERT/UPDATE/DELETE` policies `with check (false)`; `TRUNCATE` explicitly revoked (negative control proves detection). Stranger visibility independently measured at 0 rows on every table. |
| Service-role key | Absent from the web app; only inside the `invite-member` Edge Function, where every privileged action is downstream of a fresh `app_is_owner()` check. **Edge function not executed.** |
| Input validation | Server-side, stricter than the client: regex-parsed decimals, scale limits, bigint overflow, enum checks, text/length limits, JSON body size caps (4/16/32 KB). |
| SQL injection | None found. No user-controlled dynamic SQL. |
| XSS | None found. One static `dangerouslySetInnerHTML`; exports HTML-escaped. |
| CSRF | `Origin` equality + `sec-fetch-site` denial + `same-origin` credentials + JSON-only bodies. Null-Origin non-browser callers still need a valid owner JWT. |
| Secret exposure in client bundle | Only `NEXT_PUBLIC_*` (URL, publishable key, site URL) reach the browser; `config.ts` never reads a service-role key. |
| Export/download endpoints | Backup JSON/CSV and report exports require owner session **and** `app_is_owner()`; CSV injection neutralised; `no-store`; session cookies carried correctly. |
| Backup access/restore | Restore refuses a non-empty target, a non-source project ref, a non-`offsite_restore_operator` role, admin membership, checksum mismatch, table-coverage mismatch and post-restore fingerprint mismatch; runs in one transaction with `access exclusive` locks. |
| Dependencies | `npm audit --omit=dev` → 0 vulnerabilities; Supabase SDK pinned at 2.119.0 with a boundary check. |
| Replay / abuse | Idempotency keys are permanent, hashed by payload+operation, and bound to the actor; payload reuse under a new key with a changed body is rejected. |

**No confirmed vulnerability.** Verification gaps: no live PostgREST/RLS exercise, no Edge Function execution, no concurrency test, no penetration testing of the hosted deployment.

---

## H. UI, Reports and Export Assessment

**Verified by code and by DOM-free execution:**

- Reports use a **fixed paper model**: a 1440 px wide A4 canvas, `OPERATIONAL_REPORT_PAGE_HEIGHT = 2036`, `14` rows per page, explicit page labels, and a hard refusal (never silent truncation) beyond 60 pages / 8 192 px single-image height / 25 000 rows.
- A **single immutable document object** feeds the on-screen preview, print HTML, direct PDF, PNG, CSV and XLSX (`report-export-actions.tsx:23`, `report-export-preview.tsx`). Preview is not a CSS re-flow of the table; it is the *same rendered page* as the export.
- Pagination was verified to preserve **every row** for 0/14/15/100/840 rows and to produce a **constant page height** for every page — which is exactly the property that makes exports device-independent.
- Print CSS declares `@page { size: A4; margin: 14mm 12mm }`, RTL, `direction: rtl`, Cairo with Arial fallback, and `print-color-adjust: exact`.
- Cairo 400/600/700 Arabic+Latin woff2 are self-hosted under `apps/web/public/fonts` and loaded both by the app and by the print popup (`report-export-actions.tsx:70-79`) with an explicit load-failure error.
- Responsive on-screen presentation is handled separately (container queries + local `overflow-x: auto` scrollers + a mobile card view), so widening a table never widens the page.

**NOT verified (browser unavailable):** actual pixel rendering of Arabic shaping, real `canvas.toBlob` output, byte-identity of PNG/PDF between a 360 px phone and a 1280 px desktop, screenshot evidence, and the a11y/contrast assertions in `e2e/visual-audit-h059` and `h061`. The repository's own specs (`e2e/h062-device-independent-reports.spec.ts`, `e2e/h065-daily-vehicle-report-exports.spec.ts`) assert exactly these properties and are structured correctly, but I could not run them.

**Recommendation:** because report/export regressions are the project's stated history, the reviewer who *does* have a browser must run `playwright.ui.config.ts` for `h062` and `h065` at 360/768/1280 in both themes, and compare the five outputs' SHA-256 across viewports, before accepting this area.

---

## I. Regression Risks of the Recommended Fixes

| Fix | Risk | Mitigation |
|---|---|---|
| F-01 link-guard `distinct from` | A changed link/account must still be validated; a subtly wrong predicate could permit an invalid move | Use PR #102's exact predicate + its test `21_historical_payment_reference_verification.sql`; re-run `db:verify` and all three negative controls |
| F-01 applied as composite FK instead | Would **break D13** — legitimate trip corrections would be blocked | Do not do this; the migration comment already forbids it |
| F-02 add `responsible_contractor_id` to diff | Any test asserting the exact diff shape | Additive key only; grep tests for `diff` assertions first |
| F-03 map safe SQLSTATEs to messages | Leaking amounts/account IDs | Curated code→message table, no interpolation of DB text |
| F-05/F-06 unify backup readers | Changing the CSV row count for large tables is user-visible | Keep the same page size; only make the bound earlier and identical |
| F-07 re-gate CI drills | Re-enabling live Drive/restore against real data | Keep the existing `BACKUP_ENABLED`/`BACKUP_RESTORE_VERIFIED` gates; no automatic deletion |
| Applying migrations to the hosted project | Ordering/compatibility with already-applied migrations | Migrations are additive and ordered by timestamp; verify the hosted list before applying, per `FINAL_SUPABASE_CUTOVER_RUNBOOK` |

---

## J. Delivery Readiness Checklist

| Requirement | Result |
|---|---|
| Login page and authentication entry | **PASS (code)** / **NOT VERIFIED (live)** |
| Fail-closed private routes with real-data flag off | **PASS** (HTTP smoke) |
| Real-data flag alone does not expose data | **PASS** (HTTP smoke) |
| Initial empty-data state handled | **PASS** (code: empty-state panel + explicit messages; `db:verify` starts from an empty DB) |
| Fresh database can be built from migrations | **PASS** (43-step isolated run from zero) |
| Navigation / page loading | **NOT VERIFIED (browser)** |
| Desktop and mobile usability | **NOT VERIFIED (browser)** |
| Loading and error states | **PASS (code)** / **NOT VERIFIED (browser)** |
| No broken forms/links | **NOT VERIFIED (browser)** |
| Validation messages correct | **PARTIAL** — server-side validation is correct, but messages are generic (F-03) |
| No demo behaviour leaked in production | **PASS** — `/demo/*` returns 404 when real data is enabled |
| No dependency on undocumented manual configuration | **RISK** — `APP_ENABLE_REAL_DATA`, `NEXT_PUBLIC_SITE_URL`, `OWNER_LOGIN_USERNAME`, `OWNER_LOGIN_EMAIL` and the fixed production origin `https://1-mohamed.vercel.app/auth/callback` in the Edge Function are all environment/manual |
| Deployment configuration clear and safe | **PASS (code)** / **NOT VERIFIED (Vercel)** |
| Report/PDF/PNG layout device-independent | **PASS (layout model)** / **NOT VERIFIED (pixels)** |
| Offsite backup operational | **NOT VERIFIED** — and CI drills are unreachable (F-07) |

---

## K. Recommended Action Plan (minimal, ordered)

1. **Before handover — F-01 (Medium).** Review and deliberately apply the minimal link-guard fix (PR #102's migration + its isolated test). Re-run `npm run db:verify` and all three negative controls. Do not merge blindly: #102 also touches backup restore and the verification runner; apply only the trigger predicate change if the reviewers want the smallest step.
2. **Before handover — run the browser suites** (`playwright.ui.config.ts` h062/h065, `playwright.auth.config.ts`) on a machine with Chromium. This is the single largest evidence gap in this audit.
3. **Before handover — confirm hosted state**: applied migrations on the Supabase project, `APP_ENABLE_REAL_DATA=true`, `NEXT_PUBLIC_SITE_URL`, owner alias/email variables, and the Edge Function's hardcoded callback origin.
4. **Should do — F-05/F-06** unify the backup export readers with one enforced bound.
5. **Should do — F-07** re-gate the backup drill jobs on `workflow_dispatch` inputs.
6. **Nice to have — F-02** add `responsible_contractor_id` to the trip-edit audit diff.
7. **Nice to have — F-03/F-04** curated safe error messages; surface the trip link read-only in the payment editor.
8. **Do not** change any formula, rounding policy, cancellation semantics, account-resolution rule, or RLS policy as part of this work.

---

## L. Findings That Do Not Require Action

- **"Payment moved to the wrong account after a trip edit."** Refuted twice by reproduction. The architecture stores the account on the payment; the trip link is documented as descriptive only. Recording it as a defect would be factually wrong.
- **Cancellation of a fully paid trip leaving a claim on the vehicle.** This is the documented D13 negative-balance state, with later same-account work auto-recovering it. Not a defect.
- **`linked_trip_id` surviving a trip correction.** Intentional and documented (`20261104200030:36-39`, `T08_1_H047_REVIEW:10`): a composite FK would block legitimate D13 corrections.
- **Members being able to write.** Documented product intent of owner-managed members; owner-only surfaces are separately gated.
- **Generic error text on write failures.** A deliberate anti-leak decision from earlier reviews; only the *actionability* gap (F-03) is worth raising.
- **60-page / 25 000-row / 8 192 px export ceilings.** Explicit, non-silent refusals with guidance — correct behaviour, not a limitation to "fix".
- **Long appended narrative lines in `STATUS.md` / `HANDOFF_LOG.md`.** Historical record-keeping style; only the absence of a current-state header (F-08) is worth noting.
- **Stylistic/CSS preferences about report aesthetics.** Out of scope per the assignment; the fixed A4 model is coherent and internally consistent.
- **PGlite-only database verification.** Known and clearly documented by the project itself; not a defect.

---

## M. Final Verdict

# READY WITH MINOR ISSUES

**Supporting evidence.**

*For readiness:*
- Zero failing product tests: 271 unit/web tests, 43 isolated PostgreSQL steps, 4 tool suites, 3 negative controls all pass on `65b0d23`.
- Production build succeeds; fail-closed auth boundary and real-data cutover both proven over HTTP.
- Financial invariants (whole-pound D19 maths, D13 negative balances, A12/D13-B/D15/D16 payment acceptance, partial payments, cancellation, cross-account isolation) independently reproduced and correct.
- Security posture is defence-in-depth with no confirmed vulnerability; no service-role key in the client; RLS + RPC gates + origin checks + idempotency + optimistic concurrency all present.
- Report exports are built on a genuinely viewport-independent fixed-page model whose pagination I verified preserves every row at constant page height.
- The two defects previously treated as critical (account mis-allocation after trip edit; cancellation semantics) are **refuted** on the current code.

*Why not simply READY:*
- **F-01 (Medium, Confirmed)** permanently blocks legitimate payment edits after a rule-compliant trip correction, with a misleading message. It affects a documented workflow and a fix exists only on an *unmerged* branch.
- Report/export pixel behaviour, Arabic shaping, and all interactive UI remain **unverified** in this environment because no browser could be installed — and this is the project's historically fragile area.
- Hosted Supabase/RLS/Auth, live concurrency, and the offsite backup path remain **NOT VERIFIED**, and the CI drills that would verify the backup are unreachable (F-07).

No Critical or High finding exists on `main`. With F-01 fixed (or explicitly accepted as a known limitation) and one successful browser-based report/export verification pass, this application is deliverable.

---

*Prepared as an audit-only artefact. The report contains no code fixes, and no application, database, migration, configuration or test file was altered during this audit.*

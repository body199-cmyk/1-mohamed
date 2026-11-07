# Engineering audit and remediation master register
**Project:** body199-cmyk/1-mohamed  
**Date:** 2026-11-07  
**Working PR:** #34 (`audit/approved-ux-and-report-corrections-20261107`)  
**Related draft PRs:** #31, #35, #36  
**Status:** INCOMPLETE AUDIT / NOT RELEASE-READY. This is a verified source-and-CI review of the files named below, **not** a claim that every repository file has been examined or that tests passed.

## 0. Operating contract — read this first in every future session
1. The user's approved UX decisions are authoritative; stale tests must not reverse them. **Do not reintroduce payment receipt-number input or visible receipt columns.** Preserve historical/internal audit data unless a separate approved migration exists.
2. D15: same-day work is credited before same-day payments. D16: reject a payment if it causes a negative balance on **any intermediate date**, not merely the current balance.
3. Never conflate contractor reciprocal-work statements, daily work volume, and vehicle cash balances.
4. Work on branches/PRs, never silently push main; require completed latest-head CI, financial invariants, mobile QA, export verification, independent review, then merge/deploy/production smoke. Vercel READY is not enough.
5. Record every fix with affected files, test evidence, commit SHA, regression risk, and remaining gates. Do not claim green from cancelled or older-SHA runs.
6. Do not change the approved navigation to add arrows or invent new UX. Supabase integration is deferred.

## 1. Evidence baseline and audit coverage
Inspected source on PR #34: `apps/web/src/features/payments/cash-ledger.ts`, `payments-view.tsx`, `apps/web/src/features/reports/daily-work-report.ts`, `daily-work-view.tsx`, `vehicle-cash-report.ts`, `vehicle-cash-view.tsx`, `report-export-actions.tsx`, `e2e/daily-work.spec.ts`, `e2e/payments.spec.ts`, and existing planning/audit docs. Inspected PR #36 payment preview implementation and E2E. Inspected PR #34 changed-file list and GitHub Actions run logs. **Not yet inspected line by line:** entire accounting package, full database migration/RLS suite, auth routes, all trip-entry code, every export renderer, backup implementation, every CSS rule and all other E2E suites. Full-repository audit requires those follow-up passes; do not misrepresent this sample as exhaustive.

CI: run [42393467989](https://github.com/body199-cmyk/1-mohamed/actions/runs/42393467989) on PR #34 finished **failure** with **27 browser tests failed**; run [42393525895](https://github.com/body199-cmyk/1-mohamed/actions/runs/42393525895) on PR #36 finished **failure** with **32 browser tests failed**. Earlier steps including unit/accounting, PostgreSQL, backup, PDF/XLSX rendering, build and auth smoke were reported successful on those jobs. Later browser suites did not provide a full release pass. These counts are not necessarily distinct application defects; tests can be stale.

## 2. Confirmed findings and actionable remediation
### AUD-001 — P0 release blocker: browser CI fails extensively
**Evidence:** CI runs above, failed `Test master-data demo interactions in real browser`; 27/32 failures. Several timeouts and strict locator failures.  
**Action:** inventory *every* failure by test, expected vs actual, classify stale assertion / actual regression / flaky environment. Fix independently and rerun. Do not raise timeouts to hide bugs. The 60-minute CI job cap was increased in PR #34 (`d2b738b`) but does not cure actual failing tests.  
**Acceptance:** latest-head complete success on all mandatory browser suites; no skipped failures.

### AUD-002 — P1 confirmed stale test: removed receipt column
**Evidence:** `e2e/daily-work.spec.ts` expects `REC-002` / `REC-003`; `daily-work-view.tsx` intentionally renders `trip.id` and no receipt column. Browser log shows actual `TRIP-HIST-002`, expected `REC-002`.  
**Action:** assert stable trip ID, date, vehicle, direction, monetary totals and correct row counts; never restore receipt number to UI. Check other specs for `REC-` and receipt-number locators.  
**Acceptance:** approved receipt-free UX preserved; tests pass with meaningful assertions.

### AUD-003 — P1 inconsistent payment amount preview vs save
**Evidence:** PR #34 `payments-view.tsx` uses ASCII-only regex and manual BigInt; `cash-ledger.ts::parsePaymentEgp` accepts normalized Arabic/Persian numerals, enforces 2 decimals and signed-64-bit bound. Unbounded manual BigInt can show preview for an amount save will reject, or hide valid Arabic input.  
**Action:** port/review PR #36 parser-based fix with independent unit/E2E for Arabic digits, malformed decimals, zero, upper bound, edit amount and historical D16. Do not blindly merge draft PR.  
**Acceptance:** preview and save share canonical parser and yield identical amount; invalid input never generates misleading preview.

### AUD-004 — P1 confirmed missing fallback: operational image share
**Evidence:** `report-export-actions.tsx::shareImage` sets an error when `navigator.share`/`canShare` unavailable, but does **not** invoke `downloadBlob`. This contradicts approved native-share fallback documented for contractor statement export.  
**Action:** download generated PNG automatically when file sharing unsupported; distinguish user AbortError from genuine failures; add browser tests for unsupported APIs, supported share and user cancel.  
**Acceptance:** one click gives share or PNG download, not a dead end.

### AUD-005 — P1 browser test/UX contract drift beyond receipt
**Evidence:** CI log includes `getByRole('main').getByRole('alert')` strict-mode violation (2 matches), missing `تفعيل الوضع الداكن` theme button, `تصدير كشف الحساب` button-count mismatch, and timeout locating controls.  
**Action:** inspect each actual rendered control and approved UX before deciding whether app or test is wrong; scope alert locators to form/region and check content; verify theme functionality rather than simply deleting tests.  
**Acceptance:** stable selectors and verified interactions on light/dark, 360px and desktop.

### AUD-006 — P2 possible overflow/integrity gap in ledger accumulation
**Evidence:** `cash-ledger.ts` bounds individual payment and opening values to signed-64-bit, but accumulates work/payments in BigInt without checking aggregate bounds before returning string balances.  
**Risk:** if persistence/export assumes signed-64-bit, aggregate balances may exceed storage range despite individually valid records.  
**Action:** establish explicit approved balance range and validate aggregates at persistence/export boundaries. Test near-max values. **Requires verification; not proven data corruption.**

### AUD-007 — P2 future/invalid movement handling needs explicit policy test
**Evidence:** `buildCashLedger` validates all account trip dates and saved snapshots before filtering by `asOf`; later-dated payments are skipped after validation, but invalid future trip snapshots can fail a historical report.  
**Action:** decide/test whether historical reports must be isolated from future corrupted records while preserving fail-closed data integrity; do not silently change policy. Include backdated payments, cancelled payments, archived vehicles and opening-date boundaries.

### AUD-008 — P2 financial display vs authoritative D16
**Evidence:** payment preview calculates only current closing balance; `validateDemoPayment` checks the minimum across intermediate-day candidates. Current UI warns that an earlier date may cause rejection, but does not show historical minimum.  
**Action:** add regression tests for positive closing balance with negative intermediate balance; ensure error is explicit and no mutation occurs. If UI enhancement is required, seek UX approval first.

### AUD-009 — P2 export names can collide across filters
**Evidence:** `daily-work-view.tsx` uses `daily-work-<date>` regardless of contractor/vehicle; `vehicle-cash-view.tsx` uses `vehicle-cash-<from>-<to>` regardless of account.  
**Risk:** users can overwrite or confuse different filtered exports.  
**Action:** safely incorporate sanitized filter/account identifiers in filenames, with test; no financial logic change.

### AUD-010 — P2 financial report invariant present, coverage incomplete
**Evidence:** `vehicle-cash-report.ts` checks `opening + work - paid === closing` using BigInt and derives report from `buildCashLedger`, which is positive architecture. `daily-work-report.ts` recomputes trip amounts using shared engine and fails closed on mismatched snapshots.  
**Action:** property-based and table-driven tests for same-day D15 ordering, D16 intermediate minimum, edit/cancel replay, negative openings, empty periods, cutoff dates, archived records, decimal precision, totals vs row sums, and cross-format equality. No bug asserted merely because coverage is incomplete.

### AUD-011 — P1 unresolved approved UX implementation
**Evidence:** `docs/approved-ux-implementation-audit-2026-11-07.md` lists incomplete mobile expandable cards/forms, advanced filters, trip recents, two save actions, contractor grouping and responsive verification. PR #35 only covers a draft slice.  
**Action:** map decisions 01–22 and D13–D16 to files/tests/acceptance, close gaps by approved stage, and review mobile screenshots. Do not equate implementation in one component with completed UX.

### AUD-012 — P0 deployment gate and data persistence
**Evidence:** payment UI explicitly states demo changes are not persisted across reload; docs defer Supabase. PRs #31/#34/#35/#36 are draft and PR #31 has conflicts.  
**Action:** distinguish approved demo release from production-data readiness. Obtain green latest-head CI and independent review before merge. Never claim durable production accounting while store remains demo-only.

## 3. Suggested execution order (do not skip verification)
**Phase A — restore trustworthy CI:** categorize 27 failures on #34, fix obsolete receipt assertions and locators, preserve approved UX, run focused Playwright, then complete suite. Freeze PR head while full CI runs to avoid concurrency cancellations.  
**Phase B — accounting audit:** inspect `@ledger/accounting`, demo mutations, PostgreSQL migrations/RPC/RLS, transaction/idempotency boundaries, D13–D16 and negative controls; write independent financial invariants and adversarial cases.  
**Phase C — exports/security:** inspect all five renderers and common document schema for CSV formula injection, HTML escaping, PDF/PNG text completeness, Excel numeric/text fidelity, page breaks, print popup handling, share fallback. Check auth boundary and backup/restore atomics.  
**Phase D — UX/mobile:** review every route at 360/390/768/desktop in both themes, keyboard, RTL, no page overflow, report accessibility, approved navigation; verify PR #35 and #36 independently.  
**Phase E — release:** resolve PR dependencies/conflicts, review diffs, merge only proven changes, verify Vercel production with smoke checks and record production SHA/URL.

## 4. Handoff checklist
For each issue, record `status: open/in-progress/fixed/verified`, source line, test added, PR, commit, CI run, reviewer, and production deployment. Do not mark fixed without code; do not mark verified without test evidence. Keep this document as the canonical engineering audit; link detailed follow-up findings here.

**Audit limitation:** direct clone was unavailable in the execution environment (DNS for github.com), so source review used the GitHub connector. The document intentionally differentiates observed bugs, stale tests, and unverified risks. No full codebase line-by-line certification, independent reviewer approval, successful latest-head CI, PR merge or production deployment is claimed.

## 5. Execution log — batch TWO first (2026-11-07)
User explicitly changed priority: **batch 2 (AUD-006 through AUD-010), then batch 3 (AUD-011–012), then batch 1 (AUD-001–005)**. Follow this order; within batch 2, do not assert a risk is fixed merely because documented.

- **AUD-009 implementation (not yet CI-verified):** `15b6508` updates vehicle cash export filenames to include vehicle ID and responsible contractor ID in addition to dates. `89e87b9` updates daily work export filenames to include contractor and vehicle filter IDs in addition to date. Both are safe internal identifiers, not untrusted display names, and prevent collisions between differently filtered reports. **Pending** latest-head browser/export tests; do not mark verified.
- **AUD-006:** remains an open range-policy investigation. Individual amounts are bounded, while cumulative BigInt totals are not. Determine persistence field limits before enforcing an arbitrary cap; add boundary tests.
- **AUD-007:** remains open; test historical cutoff against future corrupted trip/payment snapshots and agree fail-closed semantics before altering code.
- **AUD-008:** remains open; validate positive ending balance but negative intermediate balance and confirm rejected mutation; do not weaken D16.
- **AUD-010:** invariant code reviewed, but comprehensive cross-ledger, cancellation, backdating and export reconciliation tests remain open.
- **CI caution:** commits on PR #34 can cancel in-progress workflows due to concurrency. Wait for latest-head completion after the batch is stable; do not repeatedly push nonessential documentation while a final CI run is in progress.

### Batch 2 continued — AUD-006 (2026-11-07)
- **Implementation commit `e1d257e`, pending CI:** `buildCashLedger` now rejects a cumulative balance above `9223372036854775807` piastres or below its negative counterpart, consistently with the existing per-payment/opening range. This protects both historical reports and payment validation from returning an unrepresentable cumulative balance. It does **not** assert that the whole persistence schema has been audited.
- **Further evidence:** existing `e2e/payments.spec.ts` already covers D16 backdated payment rejection; `e2e/vehicle-cash.spec.ts` covers carry-forward and cancelled/history concerns partially. Both currently have stale receipt-related expectations in the failing browser suite, to be handled in the explicitly last-priority batch 1. Do not restore removed receipt UX.
- **Outstanding:** test cumulative overflow at +MAX and -MAX, validate storage boundary contract, investigate future invalid trip handling (AUD-007), test D16 adversarial sequence and cross-report reconciliation (AUD-008/010). **Batch 2 is not finished.**

### Batch 2 continuation — accounting regression (2026-11-07)
- Commit `ed72361` adds a Playwright regression in `e2e/vehicle-cash.spec.ts` asserting a 25 EGP payment on Nov 3 reduces 280 to 255, the Nov 3 report reconciles opening/payment/closing, and the Nov 4–5 period carries forward 255 without counting the payment again. **Test authored, not yet passed in CI.**
- AUD-007 remains a policy-sensitive open issue: future-dated invalid trips are validated even for historical `asOf`, while future payments are ignored. Decide whether fail-closed across all dates or time-isolated historical reporting is the correct contract; do not change without preserving accounting integrity.
- AUD-008 already has an E2E D16 rejection test, but the current full browser suite fails; acceptance requires a green focused test and proof that no rejected payment was persisted.
- AUD-010 requires expanded test matrix, independent accounting package inspection, and cross-format reconciliation; one new E2E is not sufficient to close it.
- **No claim of batch completion.** Order remains batch 2, then 3, then 1.

### Batch 2 — AUD-007 implementation and cash-ledger integrity (2026-11-07)
- **`1ef6148`**: Historical `buildCashLedger(..., asOf)` now checks each matching trip's date and opening boundary, but skips trips **after** `asOf` before recalculating their monetary snapshot. This matches the existing behavior for future payments: a corrupted future amount cannot invalidate an earlier statement, while an in-period corrupted snapshot still fails closed. Important: date/opening consistency of future trips remains globally validated. This is a time-isolation policy for historical projections, **not** permission to persist corrupt future records.
- **`2dcba50`**: For in-period trips, reject invalid direction enum values before including the trip in the cash ledger, matching daily-work report's fail-closed validation. No change to approved UX or D16 payment rule.
- **Verification pending:** unit/regression tests for future corrupted snapshots, in-period corrupted snapshots, and invalid directions; latest-head CI and accounting export reconciliation. AUD-007 implemented but **not closed**. AUD-008 and AUD-010 still require evidence and green tests. Continue batch 2 before batches 3 and 1.

### Batch 2 — expanded financial regression matrix (2026-11-07)
**New tests authored on the working branch; execution/CI evidence still pending:**
- `apps/web/e2e/payments-validation.test.ts` (commit `e8cce90`, fixture type correction `2c6a327`): historical cutoff ignores future-dated corrupt amount snapshots but rejects them once in-scope; invalid in-scope trip direction fails closed; positive and negative cumulative signed-64-bit overflow both fail closed; D16 rejects a payment that would make an intermediate date negative even though the final balance is positive, and the input payment collection remains unchanged.
- `apps/web/e2e/vehicle-cash-report-validation.test.ts` (commit `8293ac5`): historical report isolation from future corrupt trip; invalid date fails closed; daily-work vehicle total reconciles to the sum of two separately-owned cash accounts (Ahmed primary and contractor K1), including the primary account's opening balance.
- Existing test coverage inspected: same-day D15 ordering; D16 backdated deficit; edit excludes old payment once; cross-vehicle/contractor isolation; tampered snapshot rejection; cancelled/future payment exclusion; carry-forward across periods; empty-period and pre-opening validation.

**AUD-006:** code guard exists (`e1d257e`) and boundary tests are now authored; close only after focused Vitest + latest PR-head CI pass. No DB signed-64 assumption claimed; demo store is in-memory and durable persistence is separately deferred.

**AUD-007:** cutoff behavior is implemented (`1ef6148`) and now has tests for future corrupted financial snapshots (ignored historically, rejected once in period) and invalid date (fail closed). Close only after focused Vitest + CI pass.

**AUD-008:** D16 algorithm itself was not weakened or rewritten. New test demonstrates the exact positive-final/negative-intermediate case and confirms no mutation of input data; existing tests cover safe exact-minimum acceptance and same-day D15 ordering. Close only after focused Vitest + CI pass.

**AUD-010:** new cross-account reconciliation test ties daily work's vehicle total to account-specific cash-ledger movements and checks opening/closing; existing tests cover payment/cancel/carry-forward. Remaining scope: run all focused tests, inspect export documents for arithmetic equality, and ensure the latest browser/export suite is green. Not closed yet.

## 6. Next verification checkpoint
The last code commit is `2c6a327`. Wait for its PR-triggered workflow; capture run ID, job conclusions, and failing step logs. If tests fail, classify the assertion before changing code. Do not push further changes while the full suite is running unless a real blocker requires a fix; concurrency cancels in-progress runs on this branch.

### AUD-008 — additional D15/D16 defect found and fixed (2026-11-07)
- **Confirmed logic defect:** `validateDemoPayment` seeded its D16 minimum with the balance after *all* same-day work (correct under D15), but then also included intermediate balances after each same-day WORK row. With multiple trips on one day, this reintroduced a pre-credit partial-day balance and could falsely reject a payment that was safe after all same-day work had been credited.
- **Fix commit `41d5940`:** D16 candidates now include the post-all-work balance, same-day PAYMENT balances only, and every later-date movement. Same-day WORK is not counted twice or used as an intermediate deficit candidate. This preserves the intended ordering: all work for the date before payments.
- **Regression commit `6c1122e`:** two same-day trips (EGP 100 + EGP 900) followed by a same-day EGP 1,000 payment must be accepted; test also verifies ledger ordering and balances.
- **Important:** this is a substantive financial fix, but it remains unverified until the focused Vitest test and full required CI pass.

### Batch 2 current code/test inventory
- AUD-006: cumulative signed-64-bit balance guard + positive/negative overflow tests.
- AUD-007: historical future-trip snapshot isolation + in-period rejection + invalid-date fail-closed tests.
- AUD-008: D16 intermediate deficit test, positive final balance assertion, no-input-mutation assertion, plus newly found D15 multiple-work ordering fix/test.
- AUD-010: daily work vehicle total reconciles against independently-owned primary/contractor cash ledgers, with opening/closing checks; existing report tests cover carry-forward, cancelled payments and empty periods.
- Latest financial test additions: `e8cce90`, `2c6a327`, `8293ac5`, `6c1122e`; D16 code fix `41d5940`.
- Latest audit doc update pending: this entry itself.
- Batch 2 remains OPEN pending CI and export cross-format review; do not proceed to batch 3 or batch 1 until verified.


### Batch 2 follow-up hardening — stacked branch `audit/batch2-financial-hardening-20261107` (2026-11-07)
The PR #34 browser run was still active, so additional financial fixes were isolated on a stacked branch based on PR #34 head `2535b77`, avoiding cancellation of that in-progress run.

- **AUD-006 strict persisted-money encoding:** `buildCashLedger` now validates opening balances with `validOpeningPiastres`; payment snapshots must be canonical positive decimal strings (no `+1`, hex, leading zeros or zero). Individual trip work movements above signed-64-bit max are rejected even if a negative opening could otherwise offset them. Tests cover positive/negative cumulative overflow, oversized movement offset, and noncanonical opening/payment strings. Code commit `c2b50c1`; tests commit `9bc7ac8`.
- **AUD-007 payment/opening boundary:** found a confirmed hole in `validateDemoPayment`: a new payment dated before the account's cash-opening start date could pass when there were no prior movements. It now rejects payment dates before the matching opening date (or invalid opening dates). Regression test included in `9bc7ac8`.
- **AUD-007 direction integrity:** an invalid in-period trip direction could be attributed to the counterparty by the fallback helper and silently disappear from the primary account. The ledger now rejects invalid in-period directions for the vehicle before account attribution; future-dated corrupt snapshots remain isolated from historical cutoffs. Tests assert both account ledgers fail closed.
- **AUD-010 export mapping:** added a focused test proving the reconciled opening/work/paid/closing metrics and signed payment movement/after-movement balances map unchanged into the operational export document (`ef0ed73`). Existing statement-export tests exercise the shared document across HTML, CSV, PNG layout, PDF pagination and XLSX.
- **Verification:** no completed CI on this stacked branch at time of writing. These fixes are not verified until PR #37's focused tests and full CI pass, then the changes are merged into PR #34 branch and its full-head CI is rerun. Do not mark batch 2 complete before that.

# FIN-01 / FIN-02 — verified implementation review and regression expansion

**Date:** 2026-11-09. **Base:** PR #40 (which is stacked on PR #37 / PR #34). Financial application changes for FIN-01 and the primary same-day D15/D16 behavior already exist in PR #37/#34; this change must **not** duplicate those fixes.

## What was confirmed in source
- `validateDemoPayment` in PR #37 checks the selected vehicle/responsible contractor's opening start date *before* calculating the available balance. The same function is used for new and edited payments, with a prior payment ID excluded once for edit.
- The existing D15/D16 candidate calculation first credits all work of payment day and includes that day's payment movements, then follows later events. SQL migration `20261104200031_payment_operations.sql::app_payment_min_available` builds one `numeric` balance for each day and checks its minimum, so test across exact boundary cases rather than changing day order without proof.
- The payment date is its original business date, never replaced with date of recording.

## New acceptance tests
`apps/web/e2e/payments-validation.test.ts` adds:
1. FIN-01: primary opening 2026-11-04 rejects payment dated 2026-11-03 and accepts 2026-11-04; same vehicle at K1 has a separate earlier start and can accept Nov-03; editing an existing payment still checks selected opening date and retains original date in the source.
2. FIN-02: multiple same-day work movements 100 + 900 EGP and existing payments 300 + 200; new 500 accepted at exact boundary and 500.01 refused, without checking an intermediate work-only balance.
3. FIN-02: an intermediate later date with insufficient cash refuses a backdated new payment even though ending balance would suffice.
4. FIN-02: editing payment from Ahmed's cash account to K1's account checks the correct account, replacing one record once; no transfer between contractor work-difference balances.

## Exit criteria
- Exact-head `npm run check`, PGlite `npm run db:verify`, negative controls, `npm run build`, and combined Playwright required.
- No tests deleted, bypassed or softened for old receipt/nav expectations. Classify inherited CI failures explicitly.
- PGlite SQL checks exercise isolated database only, *not* real Supabase Auth or transaction concurrency. Actual phone and production test remain outside scope.
- No changes to accounting code, SQL migration, data model, true payment dates, user-facing UX, main or production. Separate acceptance and independent diff review required.

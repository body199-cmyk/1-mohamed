# FIN-07 — Numeric-sized cumulative cash balances

**Date:** 2026-11-09. **Base:** PR #37 / `audit/batch2-financial-hardening-20261107` at `c99f57e528e14eca441feab2a766bab70327b1ea`. This is a small stacked review branch; no main merge or deployment.

## Confirmed incompatibility
Individual SQL stored opening, payment and vehicle-due movements use bigint, but `public.app_payment_cash_balance` and `public.app_payment_min_available` explicitly sum as **numeric**. The TypeScript cash ledger at the PR #37 base wrongly rejects the cumulative account if its exact balance exceeds the positive/negative signed-64-bit movement range. This differs from SQL and creates false failed statements and blocked payments for valid accounts.

## Narrow correction
Remove **only** the cumulative bound in `buildCashLedger`. Continue using JS `bigint` for exact sum and serialized decimal strings for reports. Keep canonical encoding and signed-64 limits for each stored opening, payment, and single trip due from PR #37; never accept an out-of-range individual movement simply because a negative opening offsets it.

## Regression and evidence
- `apps/web/e2e/payments-validation.test.ts`: replace the old cumulative-overflow rejection expectation with exact positive `9223372036854775907` and negative `-9223372036854775809` balances; keep tests rejecting invalid individual amounts/encodings.
- `apps/web/e2e/vehicle-cash-report-validation.test.ts`: assert period opening + work - paid = closing for large aggregates and confirm the operational export document retains the full formatted balance.
- SQL inspection: `supabase/migrations/20261104200031_payment_operations.sql` uses numeric `SUM` for cumulative balance / D16 min; **existing migration unchanged**.
- Pending exact-head CI: `npm run check`, isolated `npm run db:verify` and negative controls, `npm run build`, and full Chromium E2E. Do not label complete until successful and critically reviewed, including failures inherited from parent #37.

## Exclusions
No alterations to approved D15/D16 sequencing, real payment dates, legitimate correction-related negative balances, work-difference statements, mobile UI, SQL schemas, cloud data or production. The attached PR is stacked on #37; no main merge or production deployment authorized.

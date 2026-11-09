# FIN-03 — vehicle cash opening boundary on trip create (2026-11-09)

## Scope and baseline
Stacked strictly on PR #35 (`feat/trip-entry-approved-ux-stage2-20261107`, baseline `3e6f871e6dec4eaf63e3a798a2377bde4c5b4f57`) to preserve approved mobile trip UX. Not based on or merging historical navigation changes. Main remains untouched.

## Defect / reproduction
Main and PR #35 previously validated the contractor work opening, but `addTrip` did not check the *independent* vehicle cash opening. E.g. K1 work account opens 2026-11-01; V3 cash at Ahmed opens 2026-11-05; trip on 2026-11-04 was accepted even though subsequent vehicle cash ledger rejects it.

## Change
- Shared pure `validateTripCashOpening` resolves the responsible cash account by explicit direction (Ahmed / counterparty) and vehicle, rejects invalid dates/unknown direction/duplicate or malformed openings, and rejects trips before that account's opening date.
- Call the same validator before the form claims the submission lock and again inside the `DemoStoreProvider.addTrip` write boundary, **before** assigning an ID, incrementing its sequence or touching the trips state.
- Preserve collapsible groups, recent searchable choices, mobile expandable cards and both save modes; no receipt input or navigation redesign.
- No payment date, work-difference formula, vehicle-cash amount, SQL schema, real data or production change.

## Regression tests
- Unit: `apps/web/e2e/trip-cash-opening-validation.test.ts` tests both directions, previous day, opening day, another vehicle/contractor, corrupt opening/date and no source mutation.
- Chromium: `e2e/trip-cash-opening-fin03.spec.ts` saves opening 2026-11-05 on V3 for the correct responsible account, rejects work 2026-11-04, confirms no success, then accepts 2026-11-05 without releasing/reclaiming a stuck submit lock.
- Pending on **exact latest head**: `npm run check`, isolated `npm run db:verify`, `npm run build`, focused `npx playwright test --config=playwright.ui.config.ts e2e/trip-cash-opening-fin03.spec.ts` and full browser regression suite via GitHub Actions. Real Android device **not tested**. The current parent PR #35 E2E baseline is already failing, and must be triaged independently.

## Review/acceptance gate
Do not claim FIN-03 complete until targeted tests and full CI run at final SHA, plus independent second diff review. Classify inherited CI failures, do not suppress them. The browser test checks observable UI behavior; no real database integrity test because this is a DemoStore preview. Production-level persistence must protect this invariant with transactional SQL separately.

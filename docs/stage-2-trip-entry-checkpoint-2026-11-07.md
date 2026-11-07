# Stage 2 trip entry checkpoint — 2026-11-07

## Approved scope
Trip entry: collapsible sections; searchable contractor/vehicle and recent selections; save-and-exit and save-and-new; double-submit guard; date filters; mobile cards; no unapproved navigation arrows.

## Implemented in this branch
- `trip-form-fields.tsx`: split entry into three native `details` sections. Required work/date/party/direction/vehicle/rates sections open by default; optional route, expenses and notes start collapsed. Native details preserve keyboard interaction and do not reset draft values when collapsed.
- `trips.module.css`: accessible focus and responsive styling for the new sections.
- Existing searchable contractor/vehicle selects and `claimSubmission()` duplicate guard remain intact; no financial arithmetic changed.

## Still outstanding (NOT implemented)
- Recent contractor/vehicle choices and keyboard/selection QA.
- Separate save-and-exit / save-and-new flows with proper session transitions and failure recovery.
- Date search/filter defaults and mobile cards for trip list.
- Browser regression, accessibility, typecheck/build, tests, independent review, merge and production deployment.

## Integration policy
This is a **draft** PR based on main and intentionally separate from unmerged PR #34. Do not merge until stage 1 has passed its gate, and until stage 2's remaining approved work and tests are complete. If PR #34 lands, rebase/review against latest main before merge. No new UX decisions without user approval.

## Subsequent implementation — 2026-11-07
- `224ebc9`: repaired inherited main-branch auth HTTP smoke expectation (`/demo/home`, not `/demo/dashboard`); PR #35 initial CI `42366783348` failed **only** this smoke step after build; confirmed from the workflow job logs. This fix is limited to test expectations and adds a public home check.
- `d2288fc` / `2e10b64`: searchable selections now show up to three recent active contractor/vehicle choices **during the current form mount**. The history is intentionally ephemeral, not persisted across reloads. Test with archived and newly added entities.
- `4e45482` / `40d1f60`: added save-and-new and save-and-exit submit buttons, success navigation to `/demo/home`, and explicit release of the duplicate-submission lock on failed saves. The existing accounting validation and `claimSubmission` lock remain intact. Form uses manual validation to avoid native required controls inside collapsed details becoming non-focusable.
- IMPORTANT: browser QA still needed for submitter identification, success flow, error recovery, duplicate click, and mobile; no CI green result has been observed for these commits yet.
- Still outstanding: trips list date filters and mobile cards, full accessibility QA, independent review, merge and deploy.

## Stage 2 history implementation
- `eba1af2` / `94dc45f` / `0afd9ec`: added a read-only trip-history panel on the trip-entry screen, with Cairo-local today default, last seven days, current month and custom range, search across trip ID, contractor, vehicle, driver and route, plus advanced contractor/vehicle/direction filters. Desktop uses a horizontally scrollable table; mobile uses native expandable trip cards. Historical amounts are displayed using existing accounting formatter; no ledger math changed.
- Filtering uses inclusive ISO work dates and explicitly handles a reversed custom range; filters do **not** silently alter the full contractor account balance.
- Browser acceptance still required: today/week/month boundary, custom dates, archive records, RTL mobile cards, search after saving, accessibility and table/card consistency.
- CI status at review: stage 1 head `dec8db1` run `42366047608` **cancelled**; stage 2 prior head `6d31198` run `42367506233` was in progress. Neither was green. Do not merge either PR until fresh completed green CI and independent review.

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


## Additional UX hardening — 2026-11-07
- `4170141`: save-and-exit now dispatches `START_NEW_TRIP` before navigating home. This resets the submission lock and draft because `EntrySessionProvider` is mounted in the root layout and survives client-side navigation; previously returning from home could leave the trip form permanently disabled.
- `66736b8`: E2E covers save-and-exit, in-app return to trip entry without a full reload, and successful submission of the next trip.
- `22dfd8d` / `e727954` / `81c3c36`: trip-history filters now expose removable active chips for search, contractor, vehicle, direction and custom range; clearing one chip preserves the selected period and other filters; a clear-all action resets to today.
- `8c0b3f7` / `5cfb006`: mobile save actions are sticky and safe-area aware; E2E asserts sticky positioning at 360px width.
- **Still not complete:** contractor/vehicle selection currently uses a search input plus native select, not the approved searchable bottom sheet. Recent choices are session-local only. Need decide/implement the accessible bottom-sheet pattern and validate keyboard/focus/Android behavior before closing decision 10. Also test custom-range persistence and filter chips on device.
- Latest stage-2 head: `5cfb0066e2d7ec72412c0c0fd343ab08fcedeaf8`. No completed green GitHub Actions run confirmed for this head yet; Vercel Preview status alone is not test evidence. PR #35 remains Draft and must not merge before PR #34 stage-1 gate.


## Additional approved mobile-selection and filter UX — 2026-11-07
- `5572270` / `9976ec4` / `1fc40dd` / `be383bf`: mobile contractor and vehicle controls now open native accessible `<dialog>` bottom sheets with autofocus search, recent active choices, full filtered list, archived options disabled, Escape/backdrop close, and focus restoration via native dialog behavior. Desktop retains the existing searchable native select. E2E covers search, selection, recent choices, Escape and 360px no-overflow.
- `22dfd8d` / `e727954` / `81c3c36`: active filter chips and clear-all are implemented; removing one chip preserves the selected date period and other filters.
- `8c0b3f7` / `5cfb006`: mobile save actions are sticky and safe-area aware; E2E checks the sticky container at 360px.
- `4170141` / `66736b8`: save-and-exit resets the root-level entry session so returning to the route does not retain a stale duplicate-submit lock; E2E returns via client-side navigation and submits another trip.
- Recent choices are currently held in component state for the mounted trip form; they are not persisted across reloads. This is deliberately not represented as cross-session history.
- **Still outstanding:** latest-head CI/browser/accessibility QA; test dialog keyboard behavior with Android TalkBack and real device; test recent list with archived and newly created entities; verify custom range and active-chip interactions at tablet/desktop; independent review. PR #35 remains Draft.
- Latest code commit before this checkpoint: `be383bfe305a7a65438bce8b7b56e6b0ce89ec98`. No successful GitHub Actions run confirmed for this head at documentation time.


## E2E feedback and corrections — 2026-11-07
- Initial stage-2 run `42412560902` reached the dedicated trip-entry Playwright suite. The original save-and-exit flow test passed; the three new tests failed on test/dialog details:
  1. Save-and-exit re-entry locator matched both nav and home shortcut links — changed to exact accessible name.
  2. Contractor filter label was a substring of the direction label — changed to exact label matching.
  3. Native dialog Escape cancellation did not synchronize React state in the test — added explicit `onCancel` handling to close the bottom sheet and update state.
- Fix commits: `05766d8` (exact test locators), `e2d8e02` (dialog Escape state synchronization). These are test/code corrections, **not yet verified** by a rerun on the latest head.
- Vercel Preview for the latest head reported build-rate-limit failure; this is a provider limit, not evidence of a code build failure. GitHub Actions latest-head run is required for validation.

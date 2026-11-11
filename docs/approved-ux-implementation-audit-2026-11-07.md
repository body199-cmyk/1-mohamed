# Approved UX implementation audit — 2026-11-07

This is a source-code inspection, **not** a claim of device-level or accounting test success. The original register is docs/approved-ux-decisions-01-to-22.md.

| Decisions | Status | Evidence / outstanding work |
|---|---|---|
| 1 | Reference only | Untitled UI is inspiration, not an independently testable requirement |
| 2, 7, 8 | Partially implemented | `apps/web/src/app/demo/home/page.tsx`, global shortcut styles; verify mobile layout |
| 3 | Partially implemented | `nav-header.tsx` and CSS: desktop sidebar, mobile bottom bar. User reported scrolling issue; arrows proposal PR #33 rejected and closed. **Do not add arrows.** Needs actual mobile testing |
| 4, 5 | Not complete | Several views still use horizontal-scroll tables and inline forms; missing uniform mobile expandable cards, fullscreen forms and desktop drawers |
| 6 | Implemented in styling, not fully audited | Cairo stylesheet and CSS variables; contrast and consistency still need device QA |
| 9–11 | Not fully verified | Trip form requires collapsible fields, searchable recents, two save actions and duplicate protection review |
| 12–13 | Not complete / unverified | Mobile trip cards and advanced search/filter persistence require functional tests |
| 14–15 | Partially implemented | Payments ledger, new live before/after preview; missing review of collapsible summary, duplicate warnings, two save actions and per-day constraints |
| 16–22 | Partially implemented | Contractor statement, bilateral screen summary and five export renderers exist; advanced filters, grouping by date→vehicle→route, daily totals, printed detail and balance consistency not yet proven |
| 23 (native image share) | Implemented in UI, device unverified | `statement-export-actions.tsx` and shared `report-export-actions.tsx`; native Web Share API requires supported secure browser |
| Receipt removal | Partially implemented | Payment/trip form, cash and daily report visible columns removed; contractor export schema/renderers still contain receipt metadata and require coordinated migration |
| Vehicle payment remaining | Implemented in UI, arithmetic test pending | `payments-view.tsx` previews current balance + previous edited payment - draft payment; date-intermediate ledger still authoritative |
| Full history | Partially implemented | Contractor period defaults from opening date to Cairo today; filtered-period carry-forward must be regression tested |
| All report formats | Implemented as export actions; rendering QA pending | HTML/Print, PDF, PNG, CSV, XLSX need cross-format snapshot tests |

## Release blockers / next work
1. Keep original mobile navigation unchanged; reproduce scroll problem on actual device and fix only agreed behavior.
2. Add deterministic accounting regression tests for payment editing, intermediate-day negatives, contractor balances and opening dates.
3. Remove receipt metadata from every contractor export format with synchronized schema, renderers and tests.
4. Finish responsive record cards/forms and contractor report grouping, then test exports and native sharing on Android.
5. Run CI, build, device QA, review; only then merge and publish. No automatic main merge based on this audit.

## Changes in this audit branch
- Remove receipt column from daily report screen (it was already absent from operational report export).
- Normalize default contractor report end date to stable YYYY-MM-DD in Africa/Cairo.

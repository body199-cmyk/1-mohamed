# Mohamed remediation progress — 2026-11-09

## Authority and scope
- Baseline: `main` `1e1dae637d9bb1c29e74b31b2180e7ddda2769b5`, verified via GitHub compare on 2026-11-09.
- Governing files: `AGENTS.md`, `docs/STATUS.md`, `docs/TASKS.md`, `docs/ACCOUNTING_RULES.md`, `docs/DECISIONS.md`, `docs/approved-ux-decisions-01-to-22.md`.
- Historical audit: `docs/Mohamed_Project_Audit_2026-11-09.md` (a snapshot, not automatically proven defects).
- Authority: create review branches and PRs; **no main merge, production deployment or real-data operations**.
- Three separate measures: contractor-to-contractor work difference; vehicle cash owed by each responsible contractor; daily work volume. Vehicle payments must not reduce contractor work difference. Preserve actual payment dates, and legitimate post-correction negative cash balances.

## Branch and PR dependency map (verified, not merged)
| PR | head SHA | base | CI at inspected SHA | disposition |
| --- | --- | --- | --- | --- |
| [#34](https://github.com/body199-cmyk/1-mohamed/pull/34) | `2535b77dc433a0016feda0604b4d97cf187493ce` | main | [42411260644](https://github.com/body199-cmyk/1-mohamed/actions/runs/42411260644) failure | existing report and payment changes; review/fix before merge |
| [#37](https://github.com/body199-cmyk/1-mohamed/pull/37) | `c99f57e528e14eca441feab2a766bab70327b1ea` | #34 head | [42413518581](https://github.com/body199-cmyk/1-mohamed/actions/runs/42413518581) failure | *stacked*: six commits ahead of #34, zero behind; FIN-01 already coded here, verify |
| [#36](https://github.com/body199-cmyk/1-mohamed/pull/36) | `21fb859afbf415056a6b42066d2b55612a4208e0` | main | [42393525895](https://github.com/body199-cmyk/1-mohamed/actions/runs/42393525895) failure | parser alignment only, not complete payment UI |
| [#35](https://github.com/body199-cmyk/1-mohamed/pull/35) | `3e6f871e6dec4eaf63e3a798a2377bde4c5b4f57` | main | [42413725359](https://github.com/body199-cmyk/1-mohamed/actions/runs/42413725359) failure | approved collapsible/recent-choice/save actions; preserve; diverged from #34 |
| No PR yet | `668f2114fff0855863e244d04fe7cc0556d6c638` per audit snapshot (needs fresh read) | `feat/contractor-statement-ux-stage3-20261107` | not established | preserve stage-3 statement work; reconcile export details before integration |

PRs #34/#35/#36/#37 were all **open and draft** on the inspection. PR #34 and #35 both touch workflow/browser checks; avoid indiscriminate branch merge. Do not merge `design/ux-navigation-refresh` or PR #31: previously rejected navigation changes must not be reintroduced. Compare exact branches and rebase/cherry-pick only approved, tested changes.

## CI triage and evidence
The inspected four PR runs failed at the combined Chromium regression step. Multiple timeouts and outdated selectors/expected filenames occur, alongside payment/cash-summary assertion failures on #34/#37. This is **mixed/unresolved**, not evidence that all fixes fail and not permission to delete tests. Re-run targeted tests, classify each failure as product / stale expectation / environment, then run full checks on the final SHA. Package/SQL/build checks are not independently asserted to pass until their exact job steps are inspected.

## Task tracker
| Task | State | PR / branch | Last evidenced SHA | Validation and next gate |
| --- | --- | --- | --- | --- |
| OPS-03 | documented, not verified complete | `audit/ops03-baseline-20261109` | pending PR SHA | preserve report and dependency map; validate diff and CI |
| FIN-01 | implementation exists, **unverified** | PR #37 | `c99f57e` | test pre-opening rejection on create/edit, same-day acceptance, other responsible account, SQL parity |
| FIN-02 | partial day-order implementation, **unverified** | #34 / #37 | `c99f57e` | same-day 100+900/500, multiple payments, historical intermediate day, cross-account edit, SQL parity |
| FIN-03 | open / reproduce before fix | independent new financial PR | baseline `1e1dae6` | trip save boundary at cash opening (both directions), block before mutation |
| UI-01 | open / preserve approved behavior | PR #35 and staged payment changes | `3e6f871` | mobile 360/390, keyboard, double submit, dark/light |
| FIN-04—FIN-08 | open, gated by evidence | separate PRs | not assigned | invariant regression, SQL/TS parity, boundaries, financial reports |
| FIN-07 | explicit review gate | independent PR | not assigned | **do not use signed-64-bit bound for aggregate balance** purely because each stored movement is BIGINT |
| FIN-09 | pending business semantics review | no code | not assigned | do not invent daily pricing, route allocation or settlement |
| UI-02—UI-08 / PERF | pending | not assigned | not assigned | approval-first UI completion, cross-export parity, real-vs-emulated-device distinction |

## Approved UX safeguards
Keep mobile collapsible trip groups, searchable recent choices, **حفظ وخروج / حفظ وجديد**, expandable cards, period and advanced filters, cash before/after payment, and the existing navigation decisions. No receipt-number field restored to satisfy an outdated test. No new design or business calculations. Five formats are HTML/Print, direct PDF, PNG, CSV and XLSX; export documents must preserve all operational rows/totals and device-independent layout.

## Remaining verification and handoff
- Current CI failures are not resolved; local full Chromium/Android device execution and cloud Auth/PostgREST are **not verified** in this OPS-03 pass.
- Do not mark any FIN/UI task complete merely because code, commit or PR exists.
- Record future PR link, commit SHA, exact command/run, result, negative cases, and remaining uncertainties in this document.


## Implementation handoff — update on 2026-11-09 (all Draft, no merge)
| Task / PR | Head SHA at creation | Actual work / state |
| --- | --- | --- |
| [OPS-03 #38](https://github.com/body199-cmyk/1-mohamed/pull/38) | `1fb7852be13db6e3e10a78da4e807a40d7edae23` | Preserved audit, dependency graph, STATUS/TASKS/HANDOFF. [CI 42562505636](https://github.com/body199-cmyk/1-mohamed/actions/runs/42562505636) failed **after typecheck/packages/isolated SQL/negative controls/backup/build**, in HTTP auth smoke: expected old `/demo/dashboard`, actual approved `/demo/home`. This is an outdated test expectation, **not** reason to revert navigation. Existing #34/#35/#36 branches already modify this smoke test; do not recreate a conflicting fix. |
| [FIN-03 #39](https://github.com/body199-cmyk/1-mohamed/pull/39) | `a396d0e0464eef426bfd08521353cbd01d5f1e6d` | Stack on #35: work-date/cash-opening validator at UI and write boundary, tests for both directions, cash opening day, invalid data, browser submit/retry. [CI 42563071780](https://github.com/body199-cmyk/1-mohamed/actions/runs/42563071780) started; inspect current conclusion on exact SHA. |
| [FIN-07 #40](https://github.com/body199-cmyk/1-mohamed/pull/40) | `3188653a574904aec69ee46b0949b897c2ac0b71` | Stack on #37: remove **only aggregate** signed-64 cap, retain individual bounds, test exact large ledger, period report and export. [CI 42563517432](https://github.com/body199-cmyk/1-mohamed/actions/runs/42563517432) started; inspect exact-head result. |
| [FIN-01 / FIN-02 #41](https://github.com/body199-cmyk/1-mohamed/pull/41) | `d13ccfa09139a18b9ab24d921aea0ae3c3283e79` | Stack on #40: four new test-only cases for cash opening create/edit, separate responsible accounts, work-before-multiple-payments, intermediate D16 minimum, and cross-account edit. No duplicate code edits. [CI 42563803028](https://github.com/body199-cmyk/1-mohamed/actions/runs/42563803028) started; inspect result on exact SHA. |

### Decision review (FIN-09)
Verified that the approved 22-decision register is unchanged across main, #34, #35 and contractor-statement stage-3. It describes one vehicle/day spanning multiple destinations with one daily value, but does **not** specify whether that value is independently agreed or calculated from a pricing unit. It also does not define actual contractor settlement creation/allocation. Example for owner: a vehicle works on **two destinations, 3 trips to site A + 2 to site B, agreed total 2,000 EGP for the day**. Does 2,000 remain one manually recorded day-total, or should it be derived from a price-per-trip/day unit? No automatic assignment of 2,000 by route, and never multiply 2,000 by five. Until decision is documented, FIN-09 remains blocked and independent safety work continues.

### Testing and delivery integrity
- All PRs are drafts and **none merged**; branch-created/source-verified is not test-verified. Latest CI results must be re-read on corresponding exact SHA before acceptance.
- Browser tests use CI Chromium simulation at specified widths; **no real Android/iOS device tested**.
- No real Supabase Auth/PostgREST, concurrency, persistence, real payments or deployments exercised here.
- Update this ledger when CI runs complete, including fail step classification and next code SHA. Preserve historical notes.


### UI-01 and current verified CI milestones
- [UI-01 #42](https://github.com/body199-cmyk/1-mohamed/pull/42), head `554d3404ce09b2b64ee78eb02d8886f2cf5728a4`, test-only stack on #36. Existing parser code in #36 already fixed preview parsing; this PR adds Chromium 390px, 100.00 → edit-150.00 before/after consistency, and historical D16 rejection despite optimistic current preview. [CI 42564422620](https://github.com/body199-cmyk/1-mohamed/actions/runs/42564422620) ongoing when reviewed. No visual or navigation redesign.
- **FIN-03 #39**: exact-head [CI 42563071780](https://github.com/body199-cmyk/1-mohamed/actions/runs/42563071780) confirmed success in the stage-2 trip-entry browser step **including the FIN-03 new E2E test**, plus isolated PostgreSQL verification and upstream build. Full suite still in progress at this checkpoint, so remain Draft.
- **FIN-07 #40 / FIN-01/02 #41**: exact-head runs verified through isolated PostgreSQL, typecheck, build and HTTP smoke (all completed successfully). Both were still in large master-data Chromium checks at checkpoint; do not claim a full green run.
- **OPS-03 #38**: second run after tracker update [42563885985](https://github.com/body199-cmyk/1-mohamed/actions/runs/42563885985) failed at legacy auth-smoke navigation expectation after earlier checks passed, consistent with first run. Do not revert approved `/demo/home`.
- Existing parent #35 browser logs show dated export-name expectations (`2026-11-30` expected vs an actual narrower report range), hidden/renamed controls, and UI timeouts; classify each before changing a test. A discrepancy in financial summary or exported rows must still be treated as a possible product defect, not automatically stale.

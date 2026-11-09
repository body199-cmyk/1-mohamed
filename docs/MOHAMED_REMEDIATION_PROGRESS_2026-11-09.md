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

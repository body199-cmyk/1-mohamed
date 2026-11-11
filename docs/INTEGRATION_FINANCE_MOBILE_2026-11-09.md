# Financial and mobile integration — 2026-11-09

## Review-only integration
This branch is based on the FIN-01/02 operations branch (#41, itself stacked on #40 → #37 → #34). It deliberately layers the approved mobile trip-entry implementation from #35/#39, the canonical amount preview and labeled assertions from #36/#42, and compatible CI regression improvements from #43. It does **not** merge main or deploy. The stage-3 contractor statement branch is preserved but not silently merged without validation.

## Conflict decisions
- `apps/web/src/demo/demo-context.tsx` retains **both** guarded `writeDemoTrip` and audited `applyDemoPaymentEdit`; neither module was overwritten with an older version.
- `apps/web/src/features/payments/payments-view.tsx`: parser alignment from #36 applied as a **minimal block change**, retaining the financial branch's approved payment controls.
- `apps/web/src/features/trips/`: uses #35-approved collapsible group, recent searchable choices, save-and-exit/save-and-new and expandable trip cards, plus #39 cash opening guard.
- `.github/workflows/verify.yml`: all base checks retained; independent FIN-03 Vitest, FIN-01/02 edit Vitest, approved mobile E2E, FIN-03 browser save/retry, UI-01 preview E2E, full Chromium, H065 five-export tests still required.
- `tools/db-verify.mjs`: both FIN-01/02 SQL reassignment regression and FIN-07 SQL NUMERIC aggregate regression run in isolated PGlite.
- Shared legacy CI corrections keep the approved /demo/home redirect, mobile Settings theme toggle, real report dates, historical trip IDs and cash accounting checks. A number of older selectors still need exact-head regression review.

## Integrity rules
Do not mix contractor work difference with vehicle cash ledgers or daily work activity. Payments remain in their real business dates; never auto-create settlement, infer route price, or hide a legitimate negative cash balance after work correction. Stored bigint inputs stay signed 64-bit; derived aggregate balance is exact, unbounded by movement storage range. No currency math with Number. No receipt input or discarded mobile choices are restored.

## Verification and limits
The full integration CI result must be checked at the **exact final SHA**, including typecheck, all web Vitest, isolated PostgreSQL and negative controls, Next build, HTTP auth smoke, stage 2 and stage 3 browser, 360/390 widths and H065 export artifacts. Chromium viewport simulation is not a physical Android device. No real Supabase concurrent multi-connection test or production data were executed. Any failure blocks completion and requires classification plus a targeted fix.

## Still outstanding
- FIN-04/05/06, remaining FIN-07 five-output binary regression and SQL/TS negative edges, FIN-08, FIN-10/11 require further isolated follow-up.
- FIN-09 amount-unit/day allocation and contractor settlements require owner decision. Do not implement assumptions.
- Final second-diff and CI evidence are mandatory before considering integration safe; branch and PR exist for review, never automatic merge.

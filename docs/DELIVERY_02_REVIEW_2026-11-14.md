# DELIVERY-02 — separate counterparty and cash responsibility

Baseline main 15dbdc29cffb9b71780393f6fbdbd8634e2b86e7; branch codex/delivery-financial-acceptance-20261114.

## Prior slice closed
PR #78 merged after CI 43613280973 SUCCESS on da095c2f67568a014f1bcb571889e0b447876263. GitHub confirmed main and closed/merged PR. User explicitly authorized merging and publishing this repair only, without activating permanent operations on the published site. Vercel deployment dpl_BFiSU2AJ9Qg7Bh1hJcBKHKZNbWFA READY for exact merge SHA; published login HTTP 200 shows disabled-activation explanation. This supersedes DELIVERY-01's pending-CI/no-publication checkpoint.

## Hosted trial results
Using the existing confirmed owner and local compiled app against hosted project sskkuniskphlawivzudw: contractor, vehicle/account, 1 tonne at EGP 100 trip and EGP 30 payment saved. After full browser reload, SQL-backed cash statement showed opening 0, earned 100, paid 30, closing/current 70, two movements. Anonymous direct table HTTP returned zero rows; anonymous local /app redirected and master API returned 401. No non-owner or true concurrent-session acceptance yet. Test records are explicitly experimental and remain in the trial project; no passwords stored or reset.

## Defect and fix
Observed preview named the counterparty as cash-responsible for AHMED_SUPPLIES, although stored SQL correctly assigned K_AHMED. Shared TripPreviewCard now labels counterparty accurately and accepts a separate cash-responsible name. Real TransactionEntry selects primary for AHMED_SUPPLIES, counterparty for OTHER_SUPPLIES, matching existing SQL and ACCOUNTING_RULES A04. No financial computation, RPC, migration or stored amount changes.

## Verification and review
Browser regression checks both directions and preserves counterparty identity; RED reproduced the missing separate labels. Full verification results and CI to follow. Same-assistant separate critical review checks optional labels, other shared-component callers, missing primary behavior and no change to server authority. The demo no longer mislabels a counterparty as responsible when no cash-responsible prop is supplied.

## Open decisions and next work
User requested pound-only amounts and clearer large-number display. Await explicit choice on preserving genuine fractions versus rounding each trip to whole pounds; do not change D01 or historical values before that decision. Thousand separators and hiding .00 are proposed presentation improvements.
Backup protection is not delivery-ready: user wants multiple places and emergency readable access. Full restorable archive and readable exports are distinct; offsite encrypted storage, key ownership, automated schedules and independent restore still need implementation and acceptance. No email or cloud upload authorized by this report.
Local verification: npm run check PASS (types and 205 package tests); npm run test:web PASS (124); full Edge workspace suite 26/26 PASS with clean exit 0 in 34.3s; SDK boundary and git diff --check PASS. Separate full diff reread confirms the SQL direction mapping is unchanged; only labels and caller-supplied names change. Latest-head CI remains required before merge.

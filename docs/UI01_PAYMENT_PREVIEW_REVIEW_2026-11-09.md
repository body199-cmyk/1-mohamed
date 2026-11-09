# UI-01 — Payment preview acceptance / mobile regression

**Date:** 2026-11-09. **Base:** PR #36 `fix/payment-preview-stage3-20261107` (head `21fb859afbf415056a6b42066d2b55612a4208e0`), which **already fixed** the amount parser to call `parsePaymentEgp`. Do not repeat that fix or redesign the payment screen.

## Added regression scenarios
- 390px Chromium viewport, standard `100.00` EGP yields 280.00 → 180.00; no document horizontal overflow.
- Edit an existing 100.00 EGP payment to 150.00, preview restores the old amount exactly **once** (before 280.00, after 130.00) and saved cash summary matches. Real payment date is not overwritten by this operation.
- A 200 EGP saved payment on the demo due date leaves 80; another proposed **backdated** 10 EGP payment previews the current 80 → 70 but must be rejected by D16 historical minimum before due date. Summary remains 80. This distinction must be explicit: positive current preview ≠ approval.
- Preview absent for invalid inputs `-1`, `0`, `0.001`. PR #36 already tests Arabic digits, over-64-bit values, and save parser parity.

## Scope and gates
Only the existing `e2e/payment-preview-stage3.spec.ts` and documentation change. GitHub workflow already runs this test file. No production code or SQL altered. CI on exact head is required, plus independent diff review. Tests are **Chromium viewport simulations**, not real Android/iOS keyboard tests. The screen's authorized design, separate cash and contractor ledgers, and approved mobile navigation are unchanged.

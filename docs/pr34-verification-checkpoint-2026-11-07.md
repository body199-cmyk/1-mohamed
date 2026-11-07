# PR #34 verification checkpoint — 2026-11-07

## Approved decisions
- Payment receipt-number input is intentionally removed. Do not restore it to satisfy legacy tests.
- D16: reject payments causing a negative balance on any intermediate day.
- No production deployment before financial, browser/mobile, export, independent review, and merge gates pass.

## Changes made on audit/approved-ux-and-report-corrections-20261107
- PDF/XLSX tests: date range mode and Cairo-current-date filenames corrected.
- Dashboard E2E: navigate from approved /demo/home to /demo/dashboard (3a2451d).
- Daily work E2E: use report route after archiving a vehicle (16de0c8).
- Vehicle cash E2E: navigate directly after payment/archive (dd6a744).
- Incorrect restoration of payment receipt field was reverted (be2b4fb).
- Vehicle cash E2E: remove obsolete receipt input and receipt assertion (48a0bf4).

## Verification status
- GitHub Actions run 42384913392 on an older commit was cancelled during Chromium UI tests. Its prior unit/accounting, D16, PostgreSQL, backup, build and auth steps succeeded. Subsequent browser/export steps were skipped.
- Re-run of job 128440152171 was requested successfully, but it tests the older SHA, NOT the latest PR head.
- No successful full CI on current PR head has been confirmed. Do not merge or promote to production based on preview READY or partial checks.
- PRs #31, #34, #35, #36 remain separate draft workstreams; avoid mixing changes without review.

## Next actions
1. Ensure a fresh PR-head workflow is triggered; inspect job logs and fix each genuine failure without weakening financial assertions.
2. Check browser behavior, mobile overflow, daily and vehicle cash exports (HTML/Print, PDF, PNG, CSV, XLSX).
3. Review D16 and cash accounting regression tests and independently inspect changes.
4. Document acceptance evidence, then merge safe PRs in dependency order and deploy/verify production.

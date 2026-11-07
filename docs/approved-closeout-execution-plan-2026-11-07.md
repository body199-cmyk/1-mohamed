# Approved closeout execution plan — 2026-11-07

Approval: user explicitly approved the eight-stage closeout plan, agreed to implement **only previously approved** daily report and vehicle cash behavior, and deferred any new redesign. Each tested stage may merge independently; final handover only after all stages pass. No new UX decisions without asking.

## Non-negotiable execution rules
- Implement only the approved UX register and decisions D13–D16; no navigation arrows or speculative redesign.
- Work on feature branches and PRs, never commit directly to main.
- For every stage: verify scope, implement, run relevant tests/typecheck/build, critically review changes, document test evidence and limitations, then merge only if passing.
- Preserve source accounting data, internal audit trails, and separate contractor reciprocal-work balances from vehicle cash payments.
- Do not claim Vercel READY proves accounting, export fidelity, or mobile usability.
- Record any discovered decision gap before implementing behavior that was not approved.

## Stages / acceptance gates
1. **PR #34 stabilization:** remove visible receipt references from all report formats and UI, validate Cairo dates and payment preview, run build/types/tests and mobile smoke checks; merge only after green verification.
2. **Trips:** approved collapsible form sections, searchable recent contractor/vehicle selectors, save-and-exit/save-and-new, duplicate-submit guard, date filters and mobile cards; verify creation and edit flows.
3. **Payments and vehicle cash:** accurate before/after balance, edits/cancellations and audit, D15 same-day ordering, D16 intermediate-day deficit rejection, responsible contractor linkage; no unapproved redesign.
4. **Contractor statement:** reciprocal work, opening/carry-forward balances, unambiguous beneficiary, day/vehicle/route grouping, unique counts, approved filters, scope-aware subtotal vs full debt; compare UI and exports.
5. **Daily report and vehicle cash:** approved daily per-vehicle totals and route details, separate ledgers, dates/contractor/vehicle filters; defer any unapproved visual redesign.
6. **Exports:** HTML/Print, PDF, PNG, CSV, XLSX totals/rows reconciliation; multipage print behavior, repeat headers, native image share and fallback download on supported devices.
7. **Responsive QA:** current navigation with no added arrows, form keyboard behavior, tables/cards, multiple mobile and desktop sizes, no loss of input state.
8. **Release:** automated tests, financial invariants, critical review, documentation, reviewed PR merges, Vercel production deployment and post-deploy smoke checks.

## Current evidence (not completion)
PR #34: https://github.com/body199-cmyk/1-mohamed/pull/34 ; latest branch commits include receipt removal, Cairo-date adjustment, corrected payment preview regex, and mobile contractor movement cards. Vercel build status alone is not a pass for stage 1. No stage is declared fully tested or merged by this document.

## Reporting
For each stage record: PR/commit, tests and actual results, unresolved blockers, merge SHA, deployment URL and outcome. User notification should distinguish complete vs partial work.

## Execution checkpoint — 2026-11-07, PR #34 (handoff for another chat)

**Current branch:** `audit/approved-ux-and-report-corrections-20261107`. **Do not assume merged or production-ready.**

### Implemented after original plan
- `f591003`: recorded approved eight-stage plan.
- `3a27daa`, `c3599e8`, `9664d63`: updated CSV/HTML/signed-export tests for approved removal of receipt-number column.
- `e541620`: corrected auth smoke test to expect existing approved root redirect `/demo/home` rather than obsolete `/demo/dashboard`.
- `a7f7c0f`: normalized contractor statement quick today/week/month date boundaries to `Africa/Cairo`, using UTC arithmetic for calendar dates to avoid client timezone drift.
- `1bbd174`, `643c6e5`: approved compact contractor financial summary: keep final net beneficiary prominent, make detailed financial breakdown expandable with keyboard focus styling. No financial arithmetic changed.

### Verified CI evidence / limitations
- Workflow run `42363522876` on `9664d63`: FAILED at obsolete root redirect assertion after passing package tests, financial/database checks, build and auth boundary prerequisites. This was addressed by `e541620`.
- Workflow run `42364034755` on `e541620`: later CANCELLED after newer branch commits; observed passing package tests, database checks, backup, PDF/XLSX validations, web build, SDK boundary and HTTP auth smoke before cancellation. **Cancelled is not green.**
- Workflow run `42364890131` on `a7f7c0f`: in progress at checkpoint, not a final result.
- Commits `1bbd174` and `643c6e5` were pushed after that workflow started and need their own latest-head CI. No browser QA, independent review, merge, or production verification can be claimed yet.

### Next actions (in priority order)
1. Check latest head SHA and workflow status; wait for a **completed success** on latest head. If failure, inspect job logs and fix root cause. Avoid interpreting cancellation from new pushes as success.
2. Independently inspect contractor statement summary JSX and CSS, verify mobile expanded/collapsed interaction, RTL and that net balance remains visible; inspect receipt-number removal in all five export formats and daily report.
3. Run browser regression, TypeScript, build, financial invariants and export tests. Record exact workflow links/results.
4. Review PR #34 diff for unapproved features or accounting drift; only then merge under approved stage-by-stage policy and verify deployment. Do not bypass review.
5. Begin stage 2 (trip form and listing) on a **new feature branch**, after stage 1 gate. Search actual repository paths rather than assuming `trips-view.tsx` exists.
6. Update this checkpoint with actual merged SHA, test evidence, deployment and remaining stages. Stages 2–8 are **not complete**.

### Scope guard
Do not add navigation arrows, vehicle-cash redesign, new business rules, or alter source ledgers. Daily report and vehicle cash remain within previously approved scope only. D16 rejects payments causing a deficit on an intermediate day. Financial summaries must not conflate reciprocal contractor work and vehicle cash.

### Follow-up review and implementation checkpoint
- Reviewed actual PR diff against `main`: 25 commits and 19 changed files at review time; branch was not behind main. No PR reviews or review threads had been submitted yet; this does **not** constitute independent approval.
- Confirmed trip form implementation paths: `apps/web/src/features/trips/trip-entry-panel.tsx` and `trip-form-fields.tsx`. Stage 2 gaps: approved collapsible sections, recent searchable selections, separate save-and-exit / save-and-new; current `claimSubmission()` guards duplicate submit but the submit path needs failure recovery QA. **Not implemented in this stage.**
- Inspected statement CSV, HTML, PNG, XLSX and export actions: all consume the presentation-only document; receipt number no longer displayed in those output detail columns. Internal trip receipt data is retained and must not be deleted from source records without approval.
- `f53bdfc`: implemented approved native image-share fallback: when `navigator.share` / `navigator.canShare` cannot share files, automatically download the exact generated PNG instead of merely telling the user to press a second button. User-facing explanation retained.
- CI `42365218524` for previous `3e86f0f` head was still in progress at review, with browser master-data interaction test active; prior steps through build/auth succeeded. **This is not a pass** and later commits supersede it. Check completed latest-head CI before merging.
- Latest changes after `3e86f0f` require full CI and real-device share testing. Never treat a branch-head change or cancelled older workflow as green.

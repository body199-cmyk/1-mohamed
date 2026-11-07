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

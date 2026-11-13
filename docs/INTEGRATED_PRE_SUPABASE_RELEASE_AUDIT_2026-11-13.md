> **Correction, 13 November 2026:** The historical table below incorrectly treats separately priced daily work and contractor cash settlements as delivery requirements. PROJECT_REQUIREMENTS and DECISIONS A02/D06 explicitly exclude them from v1. Daily reporting by trip (each with its own contractor/vehicle rates) and reciprocal-work reconciliation are required. The closeout branch completes those prepared report/UI paths and fixes pagination consistency; consult STATUS for actual CI/merge evidence. Live connection/backup/restore evidence is still mandatory.

# Integrated pre-Supabase release audit — 2026-11-13

## Exact integration baseline

- Main baseline after #68: `8fe74f3ae238280632ebb74ddd279a494f7eb228` (merged #62, #65, #66, #67, #68).
- #62: real trip editing, payment history pagination, Arabic exact reports and cancellation reasons.
- #65: owner-only cutover proxy behind server-only flag; public demo denied when activated; negative missing-config HTTP smoke and no-cloud security checks.
- #66: owner-only SQL contractor signed statements, full-page history and CSV/XLSX/PDF/PNG/print/share UI, with isolated SQL and unit tests.
- #67: master record optimistic versions preserved in business snapshots and tested.
- #68: real trip and vehicle-payment reports now support complete-history CSV/XLSX/PDF/PNG/print/share exports, disabled until all pages are loaded.
- CI for each exact PR head was green before merge. PR #68 branched from main after #67 and its 42-step CI passed, covering the combined pre-Supabase code. This documentation PR has its own CI but is not a live-cloud certification.

## Scope verified without Supabase

- Locked dependencies; Next.js build/typecheck and unit tests.
- Isolated PostgreSQL migrations, RLS/owner negative controls, historical money invariants, date boundaries, audit, idempotency, payment and trip pagination, contractor signed totals.
- Browser demo regressions at multiple viewport sizes and export-format unit checks.
- HTTP negative controls: default-deny mode and activation flag without database configuration.
- No project was created, no owner email/password was provisioned, and no real financial data was imported.

## Explicit limitations before client handoff

| Area | Current evidence | Remaining blocker |
|---|---|---|
| Login / recovery | UI, SDK and gated proxy prepared | Real Auth SMTP, verified owner email, session expiry, non-owner test |
| Durable ledger | SQL RPC + client forms and isolated tests | Real PostgREST/RLS persistence, second device and concurrency |
| Contractor work | SQL signed statement, pagination and five exports prepared | Real-data reconciliation and client sign-off; settlement payment workflow is not yet proven |
| Vehicle cash | SQL payment history, period/current balances and five-format full-history exports prepared | Live balance and file parity on the actual production database not established |
| Daily work | Polished demo workflow exists | The real SQL workspace does **not** yet establish full parity for separately priced daily-work records and multi-route/day pricing |
| Backups | Isolated business snapshot and version validation | Live database backup storage, encryption, schedule and actual isolated restore |
| Deployment | CI build and preflight checks | Vercel envs, live Supabase project, production release and Android smoke |

**Do not state "100% production ready" or hand over real-money entry until these remaining gates pass.** In particular, connecting Supabase is necessary but does not by itself complete the unproven daily-work and settlement workflows. If the owner accepts a narrower first release, record that acceptance and exclude unsupported screens/actions explicitly.

## Final connection instructions

Follow [FINAL_SUPABASE_CUTOVER_RUNBOOK_2026-11-13.md](FINAL_SUPABASE_CUTOVER_RUNBOOK_2026-11-13.md).
Confirm organization/region/cost, approved owner email, primary contractor identity and production domain; create project and apply migrations, test RLS/GoTrue, provision owner administratively, verify backups/restore, deploy with `APP_ENABLE_REAL_DATA=true` only after all applicable gates pass.

Any existing older PRs must be reviewed against the integrated main; do not merge obsolete finance/UI branches by PR number alone.

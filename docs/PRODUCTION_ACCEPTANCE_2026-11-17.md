# Production acceptance checkpoint — 17 November 2026

## Release evidence

- PR [#87](https://github.com/body199-cmyk/1-mohamed/pull/87) was merged into `main` on 17 November 2026.
- Squash merge commit: `4571d0490604eca1130e34112537a804310b55e8`.
- Exact PR head tested: `c159be3ab772d1dc21eac0cc42837549dc945379`.
- GitHub Actions run [44056644256](https://github.com/body199-cmyk/1-mohamed/actions/runs/44056644256) completed successfully on that exact PR head. Its single job passed the typecheck/unit suite, workspace contracts, isolated PostgreSQL migrations and negative controls, FIN-03 opening validation, D15/D16 payment ledger, FIN-01/02 audited payment edit, vehicle/contractor reports, PDF/XLSX structure, backup-core tests, HTTP auth boundary, real-data handoff gate, Chromium workspace and export regressions, and the production build.
- Vercel Production deployment `dpl_D6uJ1cEWKervSR2XDcozTkdYp6EF` is `READY`, built from merge commit `4571d049...`. Next.js 16.4.5 compiled, TypeScript completed, and all 15 static pages generated. Production aliases include [1-mohamed.vercel.app](https://1-mohamed.vercel.app).
- Vercel runtime error aggregation reported no runtime errors in the selected 24-hour window.

## Live Supabase configuration — read-only inspection

- Existing project `1-mohamed`, ref `sskkuniskphlawivzudw`, is `ACTIVE_HEALTHY` in `eu-central-1`, PostgreSQL 17.11.0.019.
- Production Vercel has the three Supabase connection variable names configured as encrypted values and `APP_ENABLE_REAL_DATA=true`. Secret values were not requested, read, or copied into GitHub.
- `apps/web/src/proxy.ts` uses the Supabase session/owner gate when the real-data switch and configuration are present. `/app` renders `RealWorkspace`; the permanent ledger Route Handlers use the request-scoped Supabase client and `verifyOwnerForRoute`. Demo routes remain separate and are not the production data workspace.
- 20 migrations are recorded as applied, through `report_all_history` (version `20261114193206`).
- All 10 listed public tables have RLS enabled. Read-only table inventory reported: 8 contractors, 12 vehicles, 71 vehicle accounts, 1,045 trips, 1,138 payments, 2,273 audit rows, 2,262 idempotency rows, 1 owner row, 1 settings row, and 0 opening-balance rows. These are inventory counts only; no business rows were read or changed in this review.
- The user previously confirmed successful production password recovery and subsequent login. This checkpoint does not claim a fresh interactive login or live write test on the new deployment.

## Security and performance review

- Supabase Security Advisor reports 20 warnings for authenticated execution of `SECURITY DEFINER` functions. A read-only catalog check confirmed the 19 externally callable `app_op_*` RPCs contain `app_require_owner()` and have fixed function search paths; `app_is_owner()` is the intentional owner-check RPC. No unguarded authenticated business RPC was found in this check. These warnings still require periodic review; do not revoke required RPC grants without a tested replacement.
- One actionable Auth warning remains: leaked-password protection is disabled. It was not changed during this review.
- Performance Advisor reports four unindexed foreign keys and five currently unused indexes. These are informational findings; no index was added or removed without workload evidence.
- Every public table returned by the inventory had RLS enabled.

## Explicit boundaries

- This review performed no production INSERT, UPDATE, DELETE, TRUNCATE, migration, Auth-setting change, environment-variable change, or account change.
- Do not reset, seed, delete, or migrate the existing production dataset as part of visual or smoke testing.
- PR #86 (data deletion/archive scope) remains blocked and must not be merged without a separate explicit decision. Backup/restore work remains deferred by the user's earlier decision.
- PR #87's visual refinements and export layout are merged and deployed. The remaining acceptance work is an authenticated, user-observed production walkthrough, native Android/iOS checks, and the outstanding Auth hardening item. Do not describe the application as fully signed off for unrestricted business use until those gates are recorded.

## Next acceptance gates

1. User confirms the deployed mobile and desktop layout and that the expected account opens.
2. Perform read-only checks of the production workspace, contractor statement, vehicle cash statement, period/all-history filters, and exports while signed in; no test writes to real accounts.
3. If write-path acceptance is needed, use a separately authorized test dataset/project or an explicitly approved disposable fixture — never invent or delete a production record.
4. Review/enable leaked-password protection through the Supabase Auth settings after explicit approval, then re-run the Security Advisor.
5. Test Android/iOS, network interruption, session expiry/logout, and recovery on a real device. Backups remain outside this release slice until the user reopens that decision.

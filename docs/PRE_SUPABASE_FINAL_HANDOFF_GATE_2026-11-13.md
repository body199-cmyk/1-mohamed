# Pre-Supabase final handoff gate — 13 November 2026

## Scope and status

The customer receives an **empty, single-owner, persistent** transport ledger only after the connected release gate below passes. The demo is a separate, seeded in-memory preview; never copy its rows to the customer's database.

This document distinguishes **verified offline** from **requires real Supabase**. Passing GitHub CI is not proof of live financial correctness. Never claim 100% reliability, working password reset, RLS isolation, backup restore, or delivery before real acceptance.

### Offline work prepared

- Login with email/password and recovery, no public sign-up. A real owner UUID must be bootstrapped administratively; adding Auth users alone grants no access.
- All writes use allowlisted server-side RPCs with request idempotency keys and owner checks. All private reads also verify owner. No browser service-role key.
- Exact-money SQL functions, historical opening chronology, D15/D16 cash invariants, versioned edits, cancellations with audit, and isolated PostgreSQL acceptance/negative controls.
- Contractor/vehicle create, edit and archive; vehicle-account setup; dated openings; trip/payment entry, update, cancel; paged trip/payment history, exact Arabic financial reports and CSV.
- Recovery callback and reset page; protected session refresh is **prepared but gated** by a server-only environment variable.
- Pure cutover route allowlist and HTTP smoke with no credentials. Public /demo paths become inaccessible only after the server-only cutover flag is enabled.

### Hard default: NOT CONNECTED

`REAL_DATA_CUTOVER` is blank by default. The temporary proxy denies all private writes, redirects private reads to login and leaves only demo preview public. Do **not** set `REAL_DATA_CUTOVER=enabled` on Vercel before all connected checks pass.

## Single next phase: connect, prove, deliver

1. **Provision** a new empty Supabase project in the agreed organization/region/plan, after confirming any cost. Store credentials in private Vercel environment variables, never in GitHub. Choose whether to make the repository private before onboarding real data.
2. **Migrate** all versioned SQL files in order. Run isolated verification and real Postgres/RLS checks. Confirm the owner gate, table RLS, RPC grants and non-owner denial with real JWTs; review Supabase security advisors. No test/demo seed in production.
3. **Create owner** administratively with the customer's approved email. Bootstrap exactly one owner UUID using `public.app_set_initial_owner(uuid)` from an administrative SQL session. Confirm no public sign-up. Configure email sender, Site URL, exact callback allowlist and password recovery; test expired/reused links.
4. **Live acceptance in isolated TEST:** enter a dated opening or itemized history, never both for the same movements. Create/edit/cancel trips and payments. Verify ledger values, reports, CSV, history pagination, cancellation reasons and audit after refresh and in another browser/device. Check same-day and backdated chronology, duplicate submissions, concurrent conflicting versions, insufficient cash, account isolation, owner/non-owner/anonymous HTTP and RPC denial.
5. **Backups:** agree destination, encryption, frequency, retention and responsible person. Generate a backup of the TEST ledger, restore it into a *different* empty test database and compare exact record counts, hashes/financial balances and permissions. Document rollback and recovery time. Existing backup-core unit tests alone do not satisfy this gate.
6. **Release:** set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL` and finally `REAL_DATA_CUTOVER=enabled` on the protected Vercel deployment. Deploy, confirm root/login behavior, /demo redirect, direct route denial, password reset, logout/session expiry and no-cache headers. Check 360/390px Android and desktop flows.
7. **Hand over:** provide customer URL, approved email and a secure password-setting route (not password in chat/repo), recovery instructions, backup ownership and operating notes. Obtain customer sign-off. Never open real-money entry before steps 1–6 pass.

## Stop / rollback conditions

- Any RLS/owner bypass, public demo in production, duplicate transaction, rounding mismatch, negative cash violation, stale overwrite, missing historical row, failed recovery, missing backup or untested restore blocks release.
- A successful build, GitHub CI, or Vercel READY status is **not** sufficient.
- Rollback is a protected deployment revert plus a tested database recovery plan; never delete production transactions to hide a problem.

## Decisions to confirm at connected phase

- Customer's exact owner email and verified recovery mailbox.
- Supabase organization/region/plan and any billable cost.
- Backup destination, retention period and who controls recovery.
- Final business acceptance of the opening balances and any historical imports.

**Final sign-off:** only after actual live evidence is attached to this file. Keep status BLOCKED until then.

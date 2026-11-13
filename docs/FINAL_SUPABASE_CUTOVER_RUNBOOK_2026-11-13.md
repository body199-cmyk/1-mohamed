# Final Supabase cutover — execution and customer handoff checklist

**Status: PREPARED, NOT EXECUTED.** This document must not be interpreted as a successful live Supabase, Auth, Vercel or backup test. Stop before project creation and connection until the user authorizes the final step.

## Single-owner access decision

- Landing `/` redirects to `/login`; real `/app` uses server-backed ledger, not demo state.
- Only administratively provisioned Supabase Auth emails may authenticate. Public sign-up is absent; disable public sign-ups in Supabase Auth configuration as defense in depth.
- First approved owner: create Auth user in the dashboard, verify their email, and assign their UUID using the admin-only `app_set_initial_owner(uuid)` function. **Do not store or send passwords in GitHub, chat, Vercel variables or SQL.** Give the owner a secure invitation or password setup/reset link.
- `app_is_owner()` and RLS/RPC guards allow **only one owner**. Creating additional Auth users does not grant ledger access. Multi-user roles and invite management are a separate reviewed feature, not an unprotected settings button.
- Password recovery must use the real verified email, configured redirect URL and an SMTP sender. Test expired and replayed links, session expiry, logout and a non-owner.

## Administrative first-run initialization (no sample business transactions)

1. Create a new, isolated empty Supabase project in the agreed organization/region. Confirm any costs and the long-term owner before proceeding.
2. Apply every checked-in `supabase/migrations/*.sql` **in filename order** and verify applied migration history. Run security and performance advisors, verify RLS and grants for `anon`, `authenticated`, and non-owner identities. Never paste secrets into repository files.
3. Provision the first real email through Supabase Auth admin tools; collect the verified `auth.users.id`. Bootstrap the owner exactly once using the protected administrative SQL call:
   ```sql
   select public.app_set_initial_owner('<VERIFIED_AUTH_USER_UUID>'::uuid);
   ```
4. The primary contractor is an **administrative identity**, not a seeded demo record. Before entering trips, confirm the customer's approved name and create exactly one `is_primary` row. Example to be reviewed against customer identity:
   ```sql
   insert into public.contractors (id, name, is_primary)
   values ('K_AHMED', 'أحمد أبو علي', true);
   ```
   Verify the unique-primary constraint and that no example contractors, trips, payments or openings were imported. The owner cannot create the primary contractor through public UI/RPC.
5. Configure Auth Site URL, `/auth/callback` redirect allowlist, SMTP and email templates. Confirm password reset and login in an isolated environment first.

## Deployment gate

Set these in Vercel **privately** for the appropriate environment:
```text
NEXT_PUBLIC_SUPABASE_URL=<project URL>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key>
NEXT_PUBLIC_SITE_URL=<deployed HTTPS site origin>
APP_ENABLE_REAL_DATA=false
```
- Never expose `service_role` / secret keys to browser, repo or chat. All financial API calls use the user's owner session and RLS.
- Build and deploy after setting the public variables. Keep `APP_ENABLE_REAL_DATA=false` until live tests pass.
- Only then set `APP_ENABLE_REAL_DATA=true` and redeploy. This activates the prepared proxy: `/demo/*` blocked; unknown routes blocked; `/app` and ledger APIs require valid JWT **and** owner RPC. Every API independently verifies owner and SQL enforces RLS.
- A production-ready Vercel build alone is NOT proof of live authentication or persistence.

## Mandatory live acceptance (must record evidence before delivery)

| Gate | Required test |
|---|---|
| A. Access | Owner login/logout/recovery; expired and replayed recovery; non-owner and anonymous HTTP + direct RPC denied |
| B. Persistence | Start with no sample transactions; create contractor, vehicle, cash account, historical opening, trip, payment; reload and second device match |
| C. Money | Exact piastres/tonnes, same-day D15, intermediate-date D16, FIN-04 opening cutoff, FIN-05 period opening/closing, overpayment rejected |
| D. Edits | Trip/payment edit/cancel audit, optimistic version conflict, duplicate request key replay, two simultaneous 70-of-100 payments: only one succeeds |
| E. Reports | Paginate beyond 200 trips and payments, compare exact totals to SQL, check filters and all delivered export formats against persisted source |
| F. Recovery | Encrypted offsite database backup, retention policy and a **successful restore in a separate isolated project**, no auth secrets in client exports |
| G. Delivery | Android and desktop smoke, secure HTTPS, email sender, customer accepts balances, documented URL and recovery/backup ownership |

If any gate fails, leave the production flag disabled or roll back; do not allow real financial entry. An isolated PGlite test suite is useful but does not prove real GoTrue/PostgREST, two-session concurrency, SMTP or durable restore.

## Current boundary of preparation

- Code and SQL migrations are on GitHub with CI evidence; real project and owner email have not yet been configured.
- Public demo exists only while the flag is disabled. Final activation must hide it.
- The real workspace currently provides core entry, management, CSV and Arabic SQL-backed history. The rich demo's image/PDF/XLSX exports and navigation are **not automatically proof of production real-data parity**; test each supported format and explicitly disclose any unsupported export before acceptance.
- Backup snapshot core has isolated tests, but there is **no proven scheduled encrypted cloud backup or actual database restore** yet.
- This runbook does not authorize creating a Supabase project, incurring charges, adding users or enabling production writes.

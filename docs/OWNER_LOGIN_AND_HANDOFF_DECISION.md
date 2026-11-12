# Owner login and real-data handoff — approved preparation

## Account model
- The public website must eventually open at `/login` before any private business pages.
- Email + password; "forgot password" emails go to the account's **verified email**.
- **No public sign-up**, invitations or self-service registration.
- The first approved account is provisioned administratively in Supabase Auth at handoff. Bootstrap its UUID with the existing protected `app_set_initial_owner(uuid)` administrative SQL procedure. Never commit passwords.
- The current schema is **single-owner only**: creating a second Supabase Auth user does NOT give that user application access. The owner gate `app_is_owner()` and RLS still deny them. Multi-user access needs a separately reviewed, auditable authorization model and explicit roles before inviting anyone.
- A future settings page may let the signed-in owner change **their own password** through Supabase Auth. Adding/removing accounts must use a privileged invitation workflow with role checks and audit, not a client-side table edit or exposed service-role key.

## Prepared without connecting Supabase
- Login UI uses `signInWithPassword`, then verifies `app_is_owner()`; unauthorized Auth accounts are signed out.
- Recovery uses `resetPasswordForEmail` with a fixed same-origin `/auth/callback?flow=recovery` URL; the callback exchanges the PKCE code, then a user with a valid recovery session may change password via `updateUser`.
- Login and recovery controls are disabled if environment variables are missing. The UI never claims real auth is available before configuration.
- The existing demo-only route boundary is intentionally unchanged: `/demo/*` remains a **public preview** and production operations remain blocked. This is not an acceptable final private deployment.
- Final cutover: remove or explicitly gate all public demo paths; root redirects to login, proxy refreshes claims, every business route and API independently verifies owner and RLS, and no private response is cached.
- Configure the Supabase Auth Site URL, redirect allowlist, email provider, recovery templates, rate limits and verified sender; test expired/replayed recovery links, logout and session expiry.

## Required before real financial entries
1. An empty Supabase project and applied versioned migrations, with a separately created owner Auth account.
2. No sample/demo seed data in the owner's private workspace.
3. Real login/logout/recovery; unauthenticated and non-owner HTTP + RPC rejection.
4. Server-backed, idempotent CRUD and exact financial report reconciliation after refresh and on another device.
5. Concurrent-write tests, backup and a tested restore; Android smoke, then owner acceptance.

Do not activate public write routes or represent the app as ready before all five gates.

# DELIVERY-01 — login and first persistent write, 14 November 2026

## Scope and baseline
- User authorized incremental delivery fixes and confirmed all hosted business data are experimental.
- Baseline: origin/main 47389db; branch codex/delivery-readiness-20261114; worktree .delivery-readiness.
- Correction to the earlier chat audit: it inspected the stale codex/statement-visible-opening branch. Current main already contains Auth, permanent workspace, financial fixes and the contractor-tone test. Do not repeat those implementations or treat the old local test deletion as a main regression.

## Changes
- Login reads the server runtime activation flag dynamically. Disabled deployments explain that access is not activated and disable login/recovery submissions rather than accepting credentials then looping back from /app.
- Both ledger POST handlers compare Origin against the configured public site origin, not NextRequest's internal proxy URL. External origins, cross-site requests, invalid configured sites and suffix lookalikes remain rejected. JWT, owner checks, RPC allowlists and RLS remain mandatory.
- No accounting formulas, credentials, production environment flags or existing migrations changed.

## Reproduction and verification
- Clean npm ci restored the missing local @supabase/ssr without changing package versions or the lockfile.
- Before fixes: configured login with activation off accepted credentials then returned to login; actual local owner write returned 403 origin denial and inserted zero rows.
- RED: three disabled-login cases failed; origin handler tests reproduced public-origin rejection in both read/write routes. GREEN: 21 focused cases PASS, including hostile/invalid origin cases added during review.
- npm run check: typecheck and 205 package tests PASS. npm run test:web: 120 PASS before the four additional adversarial cases; full latest-head verification is required after commit.
- npm run build PASS after both fixes; /login is dynamic. Public test config is local ignored .env.local; no password or service-role key saved.
- Isolated PostgreSQL migrations and all three negative controls PASS; backup/preflight core tests PASS. These do not prove hosted restore or real concurrent sessions.
- Workspace browser run using installed Edge showed 25/25 passing scenarios, but its Windows process cleanup hung without a final exit result; do not report a clean E2E run until CI or a clean rerun completes. Initial Chromium launch failures were missing browser installation, not app failures.

## Hosted trial evidence (project sskkuniskphlawivzudw)
- Before trial setup: one Auth user, one owner row, zero contractors/vehicles/trips/payments. The existing owner email was confirmed and assigned correctly; no password change was necessary.
- Added the approved primary identity K_AHMED / Ahmed Abu Ali only, atomically and without overwriting any existing primary.
- Local compiled app connected to hosted trial Auth and data, APP_ENABLE_REAL_DATA=true only locally. Owner sign-in reached /app.
- After origin fix, UI-created contractor named اختبار تسليم 20261114 persisted as exactly one SQL row and remained visible after a full browser reload. No vehicle, trip or payment was created in this slice.
- Hosted security advisor: 20 intentional authenticated SECURITY DEFINER RPC warnings still require live non-owner checks; leaked-password protection disabled warning remains. No advisor settings were silently changed.

## Separate critical review
Same assistant, separate second pass; no claim of a second human reviewer. Reviewed complete diffs against auth/owner boundaries and accounting rules, searched both POST handlers for the same origin defect, and added suffix-origin and malformed-site tests. Configuration is trusted deployment input, never forwarded-host input. Missing Origin retains existing non-browser behavior and still requires owner authorization. Production activation and customer acceptance are not established by this patch.

## Remaining and next step
- Exact-head CI and review before merge; no deployment or production activation in this slice.
- Live vehicle/account/opening/trip/payment create/edit/cancel, retry/conflict and two-session overpayment checks; reports/exports reconciled to SQL.
- Separate restored backup environment, offsite retention/ownership decision, recovery email/expiry/non-owner tests, physical Android and second-device acceptance.
- Next focused slice: complete hosted financial acceptance; implement and verify hosted backup adapter/restore separately. Keep production disabled until complete evidence and explicit activation authorization.
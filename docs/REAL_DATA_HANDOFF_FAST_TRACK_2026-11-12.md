# Real-data handoff — fast-track release gate (2026-11-12)

**Decision:** Deliver an empty but genuinely persistent single-owner ledger to the business owner. The developer's Supabase account may host it temporarily, with a documented later ownership transfer. No real financial entries until the gates below pass. Do not add redesigns or unrelated features.

## Verified starting point
- GitHub `main` at `19f138abdc1e6115c9e5d7cae79bb7d833067713` is deployed to Vercel production (READY means build only).
- The root redirects to `/demo/home`; `DemoStoreProvider` uses React state; `/login` is a placeholder and `proxy.ts` rejects writes. These are **release blockers**, not merely documentation tasks.
- GitHub PR #52 contains isolated FIN-04/FIN-05 SQL fixes and test evidence, but is unmerged and does not prove concurrent Supabase sessions.
- Supabase connector shows no project. Organization selection and any quoted nonzero cost require owner confirmation. No database or live data exists through this connection at this checkpoint.
- Repository visibility is public. Do not commit passwords, service-role keys, user data, exported ledgers or private backup files.

## Single delivery track — no UI redesign
1. **Financial integration:** reconcile #52 against current main, resolve merge conflicts, cover missing UPDATE regression and concurrent-session behavior; require exact-head CI and critical review before merge.
2. **Database + auth:** provision isolated empty Supabase project after organization/cost approval; apply versioned migrations, security advisors and RLS checks; create one owner in Auth administratively; prove login, recovery, logout, expiry and non-owner denial.
3. **Persistent writes:** replace demo-only operational routes with authenticated server-side reads/writes for contractors, vehicles, dated openings, trips and payments. Preserve audit, idempotency and existing accounting invariants. Refresh/second-device verification is mandatory.
4. **Historical onboarding:** new empty owner starts with dated opening balances or itemized historical entries (never count both). Reject invalid chronology and duplicate payments. No automatic migration from the sample demo data.
5. **Reports and backups:** reconcile contractor/daily/vehicle-cash UI and supported exports to the same persisted ledger; decide backup location/retention and prove restore from an actual stored backup.
6. **Release:** phone/browser smoke, interruption/retry, financial regression, production environment configuration, deployment and post-deploy tests. Handover URL, owner account access and recovery/backup instructions; later transfer Supabase project ownership safely.

## Non-negotiable acceptance
- A blank account, no seeded sample contractors/trips, owner can create historical opening and current trip/payment.
- Reload and sign in on another device: values remain correct.
- Different user cannot read or write anything; unauthenticated HTTP/RPC is denied.
- Concurrent edits/duplicate submits cannot double-charge or corrupt balances.
- Every report/export agrees with the persisted source of truth.
- A recoverable backup has been restored successfully in a separate test environment.
- No production handoff until all live checks pass and the business owner accepts.

## Developer automation
`node --test tools/production-preflight.test.mjs` verifies the gate detects known source blockers.
`node tools/production-preflight.mjs --json` prints the current blockers without accessing secrets or services.
`node tools/production-preflight.mjs --strict` exits nonzero by design: static inspection must never self-certify real-money production.

This PR introduces the release gate only. It does **not** claim persistent storage, auth, migrations, backup, or readiness. Continue on focused feature branches and push every completed change with a verifiable commit.

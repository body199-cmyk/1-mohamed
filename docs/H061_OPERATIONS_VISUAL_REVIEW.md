# H061 — Tabler-inspired operational UI, review and handoff

## Why this exists
The user chose an existing web identity rather than a fresh custom design and asked to continue all remaining UI screens while keeping the project reviewable by the next developer/agent. H060 (desktop RTL Tabler-inspired shell, shared tokens, dashboard) was technically merged in PR #23 at `b93e2bdc` with 46 browser tests and other full CI checks. The actual external source of visual principles is [Tabler Admin](https://tabler.io/admin-template) and its [official UI documentation](https://docs.tabler.io/ui/getting-started) (MIT). We adapt its card spacing, surfaces and responsive density to the current app's CSS Modules without copying icons, templates or branding.

## Scoped H061 implementation
- Trips: light/dark primary CTA uses `--color-primary-text` instead of hardcoded white against dark-mode light-blue primary. Flex entry columns stack at <=1360px (account for H060 sidebar), keep native radio semantics and mobile layout. Remove old thick card top stripes.
- Master data: selected tab text uses `--text-main` over themed active blue background for readable light/dark contrast; reduce out-of-place card edge treatment and keep focus states.
- Payments: existing primary CTA uses themed text color (dark mode had hardcoded white), ledger summary numbers remain distinct cash/account entries but display in compact surfaced mini-cards, form top accent removed. The shared vehicle cash report reuses payments CSS; its financial calculations are untouched.

## Validation required before merge
- Add Chromium checks covering three routes × 360/1280 × light/dark: **12 full-page screenshots**, no document overflow, active route displayed.
- 4.5:1 real CSS computed text/background contrast for primary actions on all 3 routes and active master data tab in both themes. Existing tests for recorded transfers, payments, tab keyboard access, statement/export, account separation, D15/D16, and H055-H060 remain mandatory.
- Full repository verify workflow: npm check, isolated PostgreSQL with negative controls, backup suite, Next build, fail-closed HTTP/Auth checks, 48 expected Chromium tests (actual CI count is authoritative).
- Independent second *pass* of code diff and any failure review. Evidence must link actual PR head/run/artifact, not claim simulated Android real-device acceptance. No change in formulas, record handlers, SQL, Auth, backup, Supabase or Vercel.

## Handoff contract
Status: **pending final CI + reviewer verdict** (do not declare done on PR creation). Any actual regressions must be fixed in the same branch and CI rechecked on the new SHA. User approval of every screen is a separate gate. H062 can target remaining contractor/daily/vehicle reports and export panels without reworking the data layer. The user expressly wants all work documented; preserve both reason and evidence for future reviewers. 

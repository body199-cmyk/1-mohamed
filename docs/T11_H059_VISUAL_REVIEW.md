# H059 — Full demo visual acceptance gate (pre-cloud)

## Verified starting point
- GitHub repo `body199-cmyk/1-mohamed`, H058 [PR #21](https://github.com/body199-cmyk/1-mohamed/pull/21) merged on `main=0c6243cce0f2ba96af64bcab830513d9ae56bf86` following successful complete CI run `42142088654` (37/37 Chromium).
- H058 screenshot artifact captured contractor statements, daily report, vehicle cash report at 360px, light and dark. Reviewer inspected images, not simply source code.

## Found and scoped defect
- The active header tab in dark mode had low text/background contrast: tokens `#3b82f6` on `#1e3a8a`, ratio **2.82:1**. Ordinary text requires at least **4.5:1** to reach WCAG AA. Light variant is approximately **4.75:1**.
- Small CSS-only correction uses theme `--text-main` for active label while keeping blue underline and background; dark expected ratio about **9.9:1**. Automated browser regression measures computed colors in both modes.
- No changed schema, account figures, RPC, export data, session/Auth or Supabase/Vercel integration.

## Complete pre-cloud capture
- Seven UI paths: dashboard, trips, contractor statement, master data, daily report, vehicle cash report, payments.
- Three viewport widths (360/768/1280) × two themes (Light/Dark) = **42 full-page screenshots** in GitHub Actions artifact `h059-precloud-seven-route-visual-matrix` for seven days.
- Six capture tests assert that main content, active link, selected theme remain coherent and the document fits the viewport without global horizontal overflow; a seventh test verifies 4.5:1 active-nav text contrast.
- Run the full established suite (currently 37 Chromium + 7 H059 tests = 44 browser tests, plus packages, isolated PostgreSQL, negative controls, backup, build, and fail-closed auth HTTP).
- Report CI result **only after** checking latest PR head SHA; record final critical code review and merge outcome in PR. Do not add a documentation-only commit after green CI.

## Remaining gate
- User must review screenshots and explicitly approve overall visual design, or list edits. Technical PR merge cannot substitute for this.
- Real Android/iOS/touch/accessibility verification, non-demo network, Supabase Auth/RLS/persistence, D07 live backup and Vercel preview are **not tested or completed** here.

# H058 — Reports and export polish review

Scope: CSS and presentation only for contractor statement, daily work report, and export action controls; vehicle cash statement reuses themed payments CSS. No modification to statement documents, monetary formulas, payment balance or file generation libraries.

Issues: export actions used SELECT control CSS styles (misleading affordance) on five BUTTON elements; badges and error background used hard-coded light-only hex values inconsistent with dark theme. Fix: dedicated exportButton, primary direct PDF, small-screen wrap, focus-ring intact, CSS theme tokens. Daily report filters/table align with the rest of the app.

Gate: 3 Playwright tests, mobile/tablet/desktop no body overflow across three report routes, 5 visible semantic export BUTTONs with focus outline and minimum target, Light/Dark screenshot six states; full previous 34 browser, package, isolated SQL and three negative controls, backup 12, Next build and HTTP Auth default-deny. Second review and exact-head CI before merge. No Vercel/Supabase; final visual user signoff H059 later.

## CI review / date-dependent regression

- Initial GitHub Actions run `42141473302` for PR #21 at SHA `37076b93` **FAILED**: 34/37 browser tests passed (all H058 new tests passed); failures in pre-existing `e2e/dashboard.spec.ts` (2) and `e2e/design-h056.spec.ts` (1), because their 2026-11-05 fixture expectations used live Cairo 'today' on 2026-11-06. Not a calculation or export regression. Other unit, isolated PostgreSQL, negative controls, backup, build and HTTP boundary stages passed.
- Independent check traced `DashboardView` and `PaymentsView` through `cairoBusinessDate()` to `new Date()`, and confirmed fixture `REC-002` dated 2026-11-05 vs `REC-003` dated 2026-11-06. Test-only fix: set the Playwright browser clock to **2026-11-05 noon Cairo before navigation** in the 3 assertions. Do not change accounting math, dates of financial movements, or demo records merely to satisfy a test.
- A new CI run on the **final SHA** is required. If the deterministic clock does not match hydration/production behavior, treat it as a new failure and investigate rather than weaken assertions. This is a test-harness correction, not proof of production date behavior.

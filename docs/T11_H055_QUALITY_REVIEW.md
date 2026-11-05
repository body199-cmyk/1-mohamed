# H055 / T11 — responsive, keyboard and warning contrast review

## Reported defects (from actual source code, not conjectured real devices)
- Sticky top header uses wrapping 7-route nav and flex-basis 130px at 360px, causing 4+ rows; fix is a *single* RTL horizontally scrollable strip at <=1100 with a compact header, no lost links.
- Missing skip-navigation link before repeated links and missing anchors in :focus-visible CSS; add link targeting focusable main, ensure it appears only when keyboard-focused.
- Warning light text #d97706 / #fffbeb calculated WCAG contrast 3.07:1 vs 4.5:1 AA requirement. Replace text #92400e => 6.84:1; dark warning remains adequate.
- Don't introduce user-visible financial changes, modal behavior or new auth/network endpoints.

## Acceptance
- Playwright quality-h055.spec.ts: 7 public demo routes at 360 and 768; no document overflow, sticky header <165px, one-line nav internally scrollable; tablet 1024 one-row scroll with clickable distant payment link; keyboard Tab+Enter skip moves focus to main and focus ring exists; warning computed colors contrast >=4.5 both themes; local Chromium navigation/resource entry baseline captured (no invented budgets).
- All prior 23 Chromium suites and original unit/accounting/SQL/3 negative controls/auth and Next build must pass on exact last head.
- Second-pass review of patch and documented accepted limitations: desktop-Chromium emulation ≠ Android hardware; no real mobile network interruptions or long-data performance/memory measurement; production S01–S03 and P01–P04 require real Supabase and release test.

# WHOLE-POUND / D19 — 14 November 2026

## Scope and approved behavior
User explicitly rejects piastres/fractional money and approves nearest whole EGP. D19 supersedes currency precision in D01. Exact formula and examples live only in ACCOUNTING_RULES.md. Monetary rates/expenses/payment/opening inputs normalize first; independent per-trip totals round once; weights keep three decimals. Full comma-grouped value is displayed, never abbreviated. Internal scaled integer field names remain for schema/API compatibility. No float money arithmetic.

Branch codex/whole-pound-accounting-20261114 starts at main 15dbdc29cffb9b71780393f6fbdbd8634e2b86e7. Separate PR #79 (8f989ac, CI 43616989769 SUCCESS) fixes preview responsibility labels and is not included. Only PR #78 was approved for publication. No hosted policy migration, historical rewrite, merge, publication or permanent-access activation in this task.

## Implementation and cutover limits
- Shared accounting and formatter, demo/live money parsers, previews, reports and all document adapters adopt whole EGP. Editing/API values remain ungrouped; display values are grouped. Demo payment editing was found still writing .00 and fixed in the separate review pass.
- Additive 20261114190000_whole_pound_policy.sql replaces the two arithmetic helpers, retaining deterministic search paths and existing permissions. NOT VALID checks enforce all new/updated financial rows without rewriting historical records. Hosted cutover must audit fractional rows and old-formula totals first, take safety snapshot and deploy UI/SQL together. Historical fractional rows may fail edit/cancel under new constraints; they require an explicit migration decision before activation.
- Backup format v2 validates whole amounts/new arithmetic. Existing v1 archives remain checksum-verified with original arithmetic and exposed version; no silent reinterpretation. Creating a v2 archive from fractional history fails explicitly. Mixed-policy historical snapshot support is not implemented; current hosted trial trip/payment are whole EGP. This remains isolated backup core, not an offsite or hosted restore solution.

## Verification
- Focused whole-pound regression first failed under prior behavior, then passed. New backup policy tests likewise RED then GREEN (2 failures before patch).
- Types and package tests: 223 PASS (accounting 92, contractor statements 64, statement export 49, trip entry 18). Web contracts 124 PASS. Backup/preflight 18 PASS.
- Isolated PostgreSQL full migrations/suites PASS including whole-pound boundaries, independent rates, overflow and real constraint rejection. Existing A/B/C negative controls PASS by detecting deliberate removed protections.
- Additional money mutation (half-round threshold decreased by 1): 2 whole-pound tests failed, 13 passed; original code restored in finally. This is evidence tests detect wrong half rounding, not just a happy-path assertion.
- Latest production build PASS. Private workspace Edge suite 26/26 PASS including million-value trip/payment preview and API normalization.
- First expanded UI run: 77 PASS / 9 FAIL. Five failures were obsolete monetary expectations or the payment-edit .00 defect; corrected. Latest-build CI-scope rerun: 79/80 PASS, one Windows screenshot write error (UNKNOWN on mapped Y: drive); unchanged isolated file rerun 9/9 PASS, clean exit. All 80 CI-scope root browser cases now have passing evidence. Three legacy demo-flow scenarios timed out on removed theme/textarea controls; the remaining legacy demo-flow failure was outdated monetary error wording (updated). Legacy demo-flow is not in current CI; its unrelated selectors need a separate maintenance slice, not weakened assertions or skipped tests inside the file.
- Generated daily-work PNG visually inspected: grouped 1,000 / whole 900 and 0, weight 2.000 unchanged, no clipped table or money fractions.
- SDK fail-closed guard PASS; diff check PASS. Exact-head CI pending.

## Separate critical review (same assistant)
Reviewed calculation and signed parsing against D19, overflow boundaries before rounding, per-trip vs sum rounding, independent rates, grouping leaking into editing/API, CSV/HTML protections, file-format checks and backup policy selection. Found/fixed SQL parser cast-order mismatch (raw out-of-range could otherwise round back into range), backup arithmetic mismatch and payment edit .00. Added raw overflow/backup/large-value regressions. Existing Auth/owner/RLS guards and historic migrations are unchanged. No claim of independent second person.

## Remaining delivery work
Live concurrent sessions/non-owner/session expiry/recovery; all edit/cancel and persisted export acceptance; encrypted scheduled offsite copies and full isolated hosted restore; actual Android/second device; multi-user approval scope implementation. Static preflight still reports BLOCKED and is not a release certificate. Next step: commit and exact-head CI; present concrete migration/publication scope before changing hosted behavior.

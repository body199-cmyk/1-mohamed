# Follow-up on the PR #101 audit

Reviewed the audit at `8a5ff35`, which adds one report on top of PR #100 at `6e0146d`. PR #101 is currently targeted at main, so its cumulative diff includes the changes from #100. This fix branch is based independently on main at `47742e3`.

## Financial findings

| Finding | Disposition |
| --- | --- |
| FIN-A-001 | The observation is correct. The reported requirement for a permanent account match conflicts with D02/D13. The old payment remains on the account that paid it. Corrected work belongs to the corrected account. The trip ID is a descriptive historical reference. |
| FIN-A-002 | Cancelling work preserves the separate payment under D02/D13. Its amount and date remain factual. Cancelling an incorrect payment uses the separate payment operation. |
| FIN-A-003 | Isolated SQL reproduced identical cancellation replay and one cancellation audit event. |

Sources are [D13 in DECISIONS](../DECISIONS.md#القرارات) and [cash accounting rules](../ACCOUNTING_RULES.md), plus the explicit historical-link contract in `supabase/migrations/20261104200030_payments_schema.sql`.

### Confirmed derivative defects

1. A legitimate edit of an existing payment after the trip correction failed with SQLSTATE `23514`, even when it kept the original account and link and had sufficient balance. The generic update assigns the same relationship columns again. PostgreSQL's column-specific UPDATE trigger therefore fired and revalidated the historic match. The additive migration skips that check when the entire relationship is unchanged. New links, changed links and account changes still validate, and cash validation still applies.
2. The business recovery loader also failed with `23514` when inserting preserved archive rows into an empty migrated target. It now suspends only this insert-time business trigger for the archived payment insert, within the existing locked transaction. The foreign keys remain active, the trigger is re-enabled before verification, and failure rolls everything back.

Isolated SQL reproduced the first failure before the fix, then verified both cash balances, unchanged payment facts, a valid payment edit, denial of new or changed invalid references, and cancellation replay. The business recovery test reproduced the second failure before the fix, then recovered exact fingerprints and the historical relationship. An injected nonexistent trip ID failed the foreign key and rolled back both inserted rows and trigger state. The regular insert guard was active after successful recovery.

## Portable exports

The CSV serializer operates on supplied rows and has no standalone row cap; the export RPC applies the same 50,000-row limit for CSV and JSON before serialization. No production defect is established by the direct serializer test. PR #100 previously ran a separate native PostgreSQL concurrency test and confirmed actual 409 responses through local Next.js, GoTrue and PostgREST for both formats. The 50,000-row timings in PR #101 measure serialization, not hosted Supabase/Vercel performance.

No merge, hosted tests, or production changes were performed for this follow-up. The SQL and restore regression runs used isolated PGlite fixtures.

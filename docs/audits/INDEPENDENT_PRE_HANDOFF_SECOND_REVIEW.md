# Independent pre-handoff audit remediation

Reviewed on 19 November 2026 against `main@47742e3ae5f7a7846e10e10960ac6fc5ada1bf2e` and PR #98 at `b0b3bde7c287c745b277be22930d68dc8a5b49a9`. The original Markdown and JSON findings are in [draft PR #99](https://github.com/body199-cmyk/1-mohamed/pull/99). The Markdown records the original SQL suite as PASS and the JSON still says RUNNING. Results below come from this review's own runs. Remediation is based on main.

## F-001 — confirmed on main · HIGH

- **Evidence.** `MasterDataEntry.createOpening` took the string returned from `poundsToPiastres`. The browser serialized it as a JSON string. The operations route parsed and forwarded that payload to `app_op_opening_balance_create`, which calls `app_exact_bigint`. Isolated PostgreSQL rejected the string with `22023`, rolled back the idempotency entry, and accepted the same request key with a numeric payload. The Master Data browser regression also failed against the original code.
- **Changed.** `apps/web/src/lib/ledger/amounts.ts`, `apps/web/src/features/ledger/master-data-entry.tsx` and `quick-opening-fields.tsx` in the same directory. The two opening flows share a range-checked JSON conversion. Whole-pound rounding uses BigInt, and conversion happens after checking both signed safe-integer limits. SQL, the stable request identity, and the accounting rules are preserved.
- **Verified.** Unit tests exercise the exact positive and negative MAX_SAFE_INTEGER boundaries and rejection immediately outside them. The isolated browser-to-SQL test covers CONTRACTOR_WORK, VEHICLE_CASH, both signs, zero, positive and negative half-pound rounding, the nearest safe whole-pound boundary on each side, and rejection before any request. A committed response loss replays the identical payload and key with one row and one audit record.
- **Remaining review.** The browser fixture bridges HTTP to PostgreSQL with synthetic authenticated claims. The follow-up below verifies both opening types through the actual Next.js operations endpoint, Auth and PostgREST in a disposable local stack.

## F-002 — confirmed on main and PR #98 · MEDIUM

- **Evidence.** Contractor revision invalidation clears the report and query but leaves the busy flag and error. On main, an outstanding request keeps controls disabled until its unconditional cleanup runs. At PR #98 head, the guard skips cleanup after revision, so the contractor screen can stay disabled after the old request settles. Cash statements on main have the same delayed-release behavior. Operational pagination on main can clear the new report's busy state and show a stale network error.
- **Changed.** `apps/web/src/features/ledger/real-contractor-statement.tsx`, `real-cash-statement.tsx`, and `real-reports.tsx`. Contractor and cash share each component's reset between revision and filter paths. Read generations gate success, failure and cleanup, including after unmount. The automatic reports effect owns revision and period reloads, including requests to reopen the same day.
- **Verified.** Deferred-response browser tests exercise initial and next-page contractor reads, successive revisions, prior visible errors, obsolete errors and successes, unmount, cash revision and operational pagination. The baseline cases failed as expected. The full workspace suite also exercises real report exports and PDF/CSV/XLSX downloads through isolated fixtures.
- **Remaining review.** PR #100 contains all three UI changes from PR #98 and also fixes the contractor revision deadlock. Comparing the source at both PR heads revealed no changes in #98 outside these three files.

## F-003 — confirmed on main · MEDIUM

- **Evidence.** Reproduced on PostgreSQL with 1,003 trips. A committed sort-key change between the original 1,000-row offset reads caused a duplicate and an omitted ID. Table reads also used separate requests. SHA-256 identifies the serialized archive content and carries no database isolation information.
- **Changed.** `apps/web/src/app/api/backup/export/route.ts`, `apps/web/src/lib/backup/export.ts`, and additive migration `supabase/migrations/20261119110000_portable_backup_snapshot.sql`. Owner-only CSV and JSON use a single RPC per export. The RPC reads the selected rows under one PostgreSQL statement snapshot, then compares against a second coherent read in READ COMMITTED. It returns a conflict when the selected rows differ. The route returns HTTP 409 with no attachment and a retry message. The server rejects data above the 50,000-row limit and unsafe integers in both formats. The existing portable schema and offsite reader, Drive and restore paths retain their own formats and workflows.
- **Verified.** With independent PostgreSQL connections and a controlled lock barrier, drift was rejected for an edit, a cancellation, related trip/payment changes and CSV. A stable read produced all 1,003 rows and all 12 tables. The captured portable row data was inserted into a fresh migrated database in dependency order with constraints enabled. All 12 row counts and fingerprints matched. Route tests verified owner checks, format and drift status, and the isolated SQL suite verified SQL access and the row cap.
- **Remaining review.** The follow-up below verifies the RPC through Auth and PostgREST. Hosted gateway capacity and latency remain to be measured on an isolated hosted deployment. Two reads add database work. A change that returns every selected row to its identical value between the two snapshots can go undetected. The exported rows still represent one consistent snapshot. The recovery drill covers application row data and fixture owner/member identities.

## Verification

| Check | Result |
| --- | --- |
| `npm ci` | PASS |
| `npm run typecheck` | PASS |
| `npm test` | PASS · 233 package tests |
| `npm run test:web` | PASS · 201 tests including large-stream byte and hash assertions |
| `npm run db:verify` | PASS · isolated PGlite migration and SQL suite |
| `npm run build` | PASS |
| `npm run test:workspace` | PASS · 101 Playwright tests using Chromium Headless Shell 153 via `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` |
| `tools/portable-backup-postgres-test.mjs` | PASS · isolated native PostgreSQL, concurrent connections and fresh-target restore |
| Local Auth/PostgREST with production-built Next.js | PASS · see follow-up below |
| Hosted Supabase and Vercel production | Unrun |

The first Chromium download was truncated and the system executable could not start under this runner's socket restrictions. The full suite ran with Chromium Headless Shell. The native PostgreSQL test takes the path to the `pg` driver, a loopback port and a disposable admin role. It creates and drops only its two randomly named fixture databases. The PostgreSQL [function-volatility reference](https://www.postgresql.org/docs/18/xfunc-volatility.html) and [PostgREST transaction reference](https://docs.postgrest.org/en/stable/references/transactions.html) describe the snapshot and isolation behavior independently tested here.


## Follow-up — real HTTP stack and download size

The production build of Next.js 16.4.5 was exercised against Supabase Auth v2.184.0, PostgREST 14.18 and PostgreSQL 17.11, all on loopback. The disposable database ran the committed migrations and a Supabase-compatible role/claim bootstrap. GoTrue created the fixture users and issued the JWTs. The local gateway only forwarded Auth and REST traffic.

- Owner login by alias issued a session cookie and downloaded JSON and CSV. JSON contained all 12 tables, including 1,250 synthetic trips and 1,100 payments. CSV contained all 1,250 trip rows with PostgREST's 1,000-row cap configured.
- Approved members could sign in and received 403 from both backup formats. Anonymous and already-revoked sessions received 401. An unapproved but valid Auth account could not sign in through the application. The direct PostgREST export RPC also denied member and anonymous tokens.
- A controlled database lock held each export's first read while a second connection committed an edit. Next.js returned HTTP 409 without an attachment for JSON and CSV.
- Both opening types went through the actual authenticated operations API. A string amount returned 422. The numeric payload succeeded, and replaying its key returned the same result with one persisted row.
- With 10,250 trips, the formatted archive exceeded 12 MB, above Vercel's 4.5 MB limit for buffered function responses. The route now streams only after database drift validation and serialization, in bounded UTF-8 byte chunks. The local production HTTP server transferred the full archive with chunked transfer, and the recomputed SHA-256 matched. The [Vercel streaming guidance](https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions) documents the production transport choice. No hosted capacity or deployment test was performed.

[GitHub Actions on the initial remediation commit](https://github.com/body199-cmyk/1-mohamed/actions/runs/44503019563) completed successfully. The follow-up changes the download response transport and adds a regression test.

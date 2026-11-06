# H063 — Counterparty negative effect, trip ID and receipt number

## Request / approved decision
After seeing a four-page design sample, user explicitly observed that contractor-provided work should show a negative amount on **Ahmed Abu Ali's balance**, even though the net figure was arithmetically correct. The sample's values were unsigned while the headings said minus. The user also asked what `TR-0001` means. Assistant explained this is a unique internal trip ID (not a receipt), proposed `رقم النقلة` plus separate optional `رقم الإيصال`, and user replied “اه اعمل دا وكمل الباقي”. This is D18.

## Real code audit
The accounting model in `packages/contractor-statements/src/contractor-statement.ts` *already* computes `signedDeltaPiastres = -amount` for `OTHER_SUPPLIES` and +amount for `AHMED_SUPPLIES`; no mathematical correction is required. Existing screen had two number columns (positive transaction total + signed effect), confusing readers. Existing export summary used unsigned counterparty total despite signed row amount. Actual demo trips carry `receiptNumber`, but statement accounting rows store only `id`. All are presentation shortcomings, not ledger bugs.

## Implementation contract
- UI: keep one signed financial column called «الأثر على حساب أحمد (+/−)»; show + for positive and - for negative, and running balance unchanged. Independent trip identifier + optional receipt columns.
- Export data: `toStatementDocument` converts *already-calculated* signed row deltas; prepends + for positive, does not touch negative; formats counterparty aggregate with '-' to express its effect; opening and closing signed accordingly. Joins receipt only by ID within selected contractor, missing receipts «—». No extra charges, payments or recalculations.
- PDF/PNG fixed report has 6 columns in the same 1440px width, A4 pages retain 17 rows without dropping any. Printed HTML, CSV and XLSX all show 6 columns; XLSX filters A1:F, keeps reference text and formula injection protection.
- Theme/device distinction: on-screen report adapts/scrolls, exported paper remains fixed independent of UI theme (D17).

## Verification required
- Vitest sample for both signs, reference and receipt, empty dates, 6 columns, PDF continuation at 17/17/1, and renderer HTML CSV XLSX PNG.
- Playwright screenshot and actual download test for receipt numbers REC-001/REC-003 and signs +300/-600 from actual demo. PNG/PDF sha256 equality across 360 dark vs 1280 light; protect old H062 4-export hash cross-device cases.
- Full repository CI including package/typecheck, isolated SQL migrations and 3 negative controls, backup, Auth/HTTP build and the existing web E2E; inspect final PNG/PDF for glyph and clipping.
- Critically re-read full PR diff and record exact successful SHA, run and merge evidence. Technical merge not final user screenshot approval. No real device or cloud integrations included.

Status: **pending CI, independent review and merge**.

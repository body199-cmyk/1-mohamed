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

## Initial CI review and narrow test-contract correction
- Run `42213645950` failed in statement-export package test phase; 29 package tests passed, **3 legacy exact-column expectations failed** because they still expected old 5-column headings/rows. This is not a financial or renderer calculation failure. Run stopped before SQL/browser stages.
- Updated old `html-rendering.test.ts` and `csv-rendering.test.ts` to assert 6 columns and the default «—» receipt; no former escaping, formula guard, or order checks removed. Independently checked actual diff and existing positive/negative test fixtures.
- Full CI must rerun at latest SHA before merge; screenshots and PDF rendered proof must be checked.

## Second critical pass — actual output review found bidi mismatch (BUG-013)
- After TEST-012 alignment, full CI `42214020869` on head `6df1c472` passed **54/54 Chromium**, full unit/typecheck, isolated SQL negative controls, backup, Auth/HTTP and build. GitHub Actions H063 artifact `13498989823` included actual downloaded PNG and direct A4 PDF and screen screenshots.
- Manually rendered the exported PDF to PNG, confirmed trip ID and receipt appear in distinct columns and row sign `-600.00` is visible. Found a genuine remaining visual defect in the *six summary metrics*: with mixed Arabic currency and digit glyphs, sign rendered at the end of numbers. Fixed only canvas summary presentation to draw amounts as LTR signed numerals while moving `ج.م` unit to the corresponding metric caption. No source document money values changed.
- New unit checks verify `+300.00` and `-600.00` exact drawing text and summary caption units. **Require final fresh SHA and screenshot re-review** before merge.

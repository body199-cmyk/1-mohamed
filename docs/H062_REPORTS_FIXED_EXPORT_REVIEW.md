# H062 — Fixed export layouts across phone and PC, responsive report screens

## User authorization and distinction
On 6 November 2026 the user approved continued implementation and explicitly required that the **report format not depend on whether viewed from a phone or desktop computer**. This is D17 in `DECISIONS.md`. The existing visual system is Tabler-inspired RTL + Cairo. We distinguish:
- **Interactive report pages**: adapt filters/cards and inner table scrolling to 360/768/1280 screen width and both themes; do not hide accounting movements or recalculate totals on device.
- **Downloadable/printed contractor statement**: fixed A4 PDF and browser-print template, 1440-pixel PNG image, CSV data and RTL XLSX; constant white-paper background and stable Tabler-blue brand accent `#206bc4`, never using viewport size or UI light/dark variables. PDF byte writer remains A4 MediaBox [0 0 595.28 841.89], PNG still 1440px; no new remote services.
- **Current functionality boundary**: Contractor work-difference statement supports five export buttons. Daily work and vehicle cash reports do **not** have download buttons; H062 only matches their on-screen Tabler appearance. Export functionality for these would require a later explicit scope, not a silent promise.

## Exact changed surfaces
1. `statements.module.css`: form layout and cards share Tabler density; large transactions table min-width within its own scroll container; mobile shows controlled horizontal table scrolling rather than widening the document.
2. `daily-work.module.css`: quiet filter/card/table surfaces, local table scrollbar and original amount strings.
3. `payments.module.css` shared with vehicle cash: line separators, numeric row presentation, local scroller.
4. `statement-print-styles.ts`, `render-statement-image.ts`, `render-statement-xlsx.ts`: same fixed exported paper/layout; **palette only**, no financial/row/contract modification.

## Acceptance and evidence
- `packages/statement-export/tests/fixed-format-h062.test.ts`: print @page A4, white paper and `#206bc4` not `data-theme`/mobile breakpoints; image 1440 and workbook RTL/text IDs.
- `e2e/h062-device-independent-reports.spec.ts`: first test saves **18 screenshots** (three report screens × widths 360/768/1280 × Light/Dark) and guards document overflow and local table scroll. Second/third tests fix Cairo date and browser time, download actual PNG, PDF, CSV, XLSX on both **360 light/dark** and **1280 opposite theme**, compare SHA-256 of complete real bytes and filename, verify PNG magic + width 1440, PDF A4 MediaBox, ZIP Excel magic.
- Existing report, export, accounting, isolated SQL negative, backup, Auth and E2E regressions must pass. A mobile viewport in Chromium is not a real Android/iOS printer; explicitly retain this acceptance limitation. User visual sign-off remains separate.

## Handoff gate
State: implementation prepared on H062 branch, **awaiting final CI and critical review**. Do not merge on a red or pending run. Record final SHA/run/artifact and defects, then merge on exact head only if approved technically. Do not adjust calculations to make screenshots or hashes match; fix test setup or styling in scope and rerun.
## First full CI and visual evidence (after critical re-read)
- Initial code/doc head `38281043793dd41ade3d20c699bfc1c71af564c8`: [workflow 42205961650](https://github.com/body199-cmyk/1-mohamed/actions/runs/42205961650) SUCCESS: **51/51 Chromium** plus `npm run check`, isolated PostgreSQL migrations + 3 negative controls, backup, Next build and HTTP/Auth fail closed. H062 unit contract tests passed.
- 18 screenshot artifact [13495364772](https://github.com/body199-cmyk/1-mohamed/actions/runs/42205961650/artifacts/13495364772) verified to contain exactly 3 screens × three widths × both themes. Manually opened `contractors-light-1280.png`, `contractors-dark-360.png`, `daily-light-1280.png`, `vehicle-cash-dark-360.png`: relevant values, clean cards and right-hand RTL sidebar/phone navigation visible; on 360, transaction columns are inside local table scroller rather than disappearing from source data.
- **Actual output byte equality** confirmed by Chromium across mobile-light/desktop-dark PNG and direct A4 PDF, and mobile-dark/desktop-light XLSX/CSV with a pinned source document time; no changed rows or money formulas.
- To make **visual PDF review** possible without altering the exporter or app, new test now additionally saves the real PNG and A4 PDF files as `artifacts/h062/contractor-statement-fixed-1440.png` and `artifacts/h062/contractor-statement-fixed-A4.pdf`. CI must run again on latest SHA; visually inspect the PDF and images before merge. Do not imply real Android/iOS print-system verification.

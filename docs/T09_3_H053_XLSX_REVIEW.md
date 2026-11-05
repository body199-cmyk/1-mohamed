# H053 / T09.3 — Review of real XLSX export

- Same ContractorStatementDocument as HTML/PNG/PDF/CSV, absolutely no alternate financial computation or separately filtered movements. Summary contains six fields plus period/name; details contain each row reference/date/direction/amount/running balance.
- All money and reference values stored as inlineStr text to preserve arbitrary strings, leading zeros, and high-precision monetary presentation beyond IEEE754; users cannot sum these text cells directly without explicit conversion. This limitation must be visible. No user supplied string becomes an Excel formula.
- Escape XML reserved chars and refuse invalid XML controls, rather than silently corrupting the file. Preserve empty period explicitly; max 25000 detail rows with error rather than dropping older movements.
- Browser builds a standards-compliant uncompressed ZIP with CRC32, central directory, correct OOXML content types, workbook and relationships, styles, Arabic sheet names, RTL sheet views, frozen detail heading and bounded column widths.
- Acceptance: 5 unit tests, 2 Chromium actual XLSX downloads validating workbook bytes/sheets and empty/invalid period, all legacy unit, SQL, 3 negative controls, Next build and HTTP guards. Separate final diff review and green CI on final SHA before merge. No npm dep, cloud Auth or Vercel.

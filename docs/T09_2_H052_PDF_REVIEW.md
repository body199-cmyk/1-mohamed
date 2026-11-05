# H052 / T09.2 — Critical review checklist

- Scope is a file-export rendering layer only: never mutate or recompute ContractorStatementDocument, and never query DB.
- One A4 PDF page per maximum 17 full detail rows, minimum 1 page for empty period, maximum 60; explicitly fail if too large, no silent data loss.
- Painter is the same createStatementImageLayout/paintStatementImage proven by PNG, Cairo font loaded before Canvas JPEG. All pages get full report title/period/summary and page i/n. Existing print route stays for text-selectable PDFs.
- Binary PDF1.4 writer must calculate byte-exact xref offsets with TextEncoder and embed JPEG bytes as DCTDecode, verify page count and MediaBox; page image text is raster not searchable. Document limitation clearly.
- E2E must download PDF Blob and validate nonempty bytes/signature/xref/filename; unit validates 35-row 3-page partition and zero/overlimit cases, as well as invalid page binary.
- No new npm deps, auth routes, DB migrations, Supabase/Vercel, or hidden network upload. Keep stable prior export options.
- Final gate: second critical review of PR patch + CI on exact HEAD with build/SQL/negative security controls and all Chromium regressions; merge only when green. Production-quality PDF text selection is still via browser print, not PDF direct.

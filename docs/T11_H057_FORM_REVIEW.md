# H057 — Review: native radio cards and coherent forms

Scope: HTML semantics and CSS of trip entry, master registers and payments only. Native input radio with same name, checked and dispatch replaces div onClick; label wraps title+description so entire card click and keyboard selection work. Other controls, numeric calculation, payments ledger, SQL/RLS and cloud boundaries unchanged.

CSS: light/dark semantic variables for success/warning/info alerts, focus-visible, 44px modal close control, card borders and hover/focus for all three screens. Avoid false mobile claims: Playwright Chromium emulates 360/768/1280, not physical Android.

Gate: 3 new Chromium tests, 6 images in GitHub Actions artifact retained 7 days, prior 31 browser regressions and all unit/SQL/security/backup/Next build tests, then review full patch and merge only latest green head. H058/H059 and owner visual approval still pending.

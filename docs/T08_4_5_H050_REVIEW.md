# H050 — Critical Review Checklist: Vehicle Cash Statement

- Cash report uses the exact existing buildCashLedger output, and never recalculates trip amounts independently. Opening for selected period = last balance before from; work minus paid produces closing with an equality check.
- Excludes any payment with payment_date after to from historical report, without omitting a payment inside the window. Canceled payments excluded financially; past records of archived contractors and vehicles remain visible.
- D15 work before same-day payment; D16 remains enforced by payment creation rather than the report; negative balances caused by D13 work correction are shown honestly.
- Account scoped by vehicle + responsible contractor. Ahmed primary on AHMED_SUPPLIES, counterparty on OTHER_SUPPLIES. Receipt number stays text, route and direction from original trip record.
- Empty and invalid periods, opening cutoff, inconsistent snapshots and no mixing with contractor work statements.
- Demo only (state resets on reload). No production SQL queries, Supabase Auth, true multi-user concurrency or Vercel.
- Gate before merge: inspect full PR patch and error paths, 6 Vitest report checks, 3 Chromium UI report checks and all existing tests, database SQL/negative controls, Next build, HTTP auth boundary; record exact successful SHA and review on PR.

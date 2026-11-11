# FIN-04 — Cash opening cannot postdate existing movements

## Scope
Additive database migration with two guards. The opening guard takes the same vehicle/responsible-contractor cash account lock as trip/payment RPCs, rejecting non-cancelled work or payment before the proposed opening date. A second trip trigger rechecks dates after the trip RPC lock, preventing the pre-lock account-resolution race. No existing data is altered. No change to contractor work-difference or payment dates.

## Acceptance
Isolated PostgreSQL tests create a real other-supplied trip on a separate cash account, reject a later opening with no audit/idempotency remnants, accept an opening on the first-work day, and reject a pre-opening trip with no row mutation. `tools/db-verify.mjs` runs both migration and suite explicitly.

## Known limitations
The historical D04 *migration* meaning of a comprehensive opening balance is not invented; this fixes chronological consistency, not data conversion or potential double counting of historical work under a new approved balance model. Real two-session payment/trip versus opening races **cannot** be proved by PGlite's single connection; test with a real nonproduction Supabase database before deployment. Neither the initial historical contractor-work opening conversion nor production data is touched. Full CI and critical diff review are required; no main merge/deployment is authorized.

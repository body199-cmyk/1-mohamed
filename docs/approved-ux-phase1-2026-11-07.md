# Approved UX refresh — phase 1 (2026-11-07)

## Approved product direction
- Arabic RTL, Cairo, professional blue, mobile-first.
- Homepage shortcut cards separate from analytics dashboard; desktop right navigation, mobile bottom navigation.
- Mobile trip entry with grouped optional fields, searchable selectors, save-and-new and save-and-exit; compact expandable trip cards.
- Contractor statement: prominently show **who owes whom**, direction of work, work dates, vehicles, per-destination trip counts, per-vehicle daily value, prior balance and supported settlements. Distinguish vehicle count, trip count and day-work units; never invent route prices.
- Quick contractor/period selection with advanced filters. Filtered operational value must not be presented as the overall contractor balance.
- Printing/export: complete detail, PDF/PNG/CSV/XLSX/HTML-Print; native image sharing when supported.
- Vehicle payments: clear balance before and after, guard against duplicates and overpayments.
- Vehicle cash and daily report redesign remain pending product decisions.

## Changes actually implemented in this branch
1. Contractor statement balance hero clearly identifies debtor and beneficiary **as of period end**, using the existing accounting engine and beneficiary field without changing calculations.
2. Added a native share-image action using the existing PNG renderer and the device share sheet. No forced download; unsupported browsers get explicit fallback guidance. User cancellation is not treated as failure.

## Important limits and follow-up
- This is a **partial implementation**, not the complete approved UX redesign.
- Existing statement rows currently lack a complete operational daily vehicle/destination grouping in the rendered UI. Do not claim that functionality is complete.
- Current statement calculation and exports must be audited for opening balances, actual settlements, and accurate operation counts before the full redesigned report is accepted.
- Build, typecheck, tests and mobile-browser sharing have **not** been run in this connector-only environment. Validate them before merging.
- No edits to main, no automatic merge or production deployment.

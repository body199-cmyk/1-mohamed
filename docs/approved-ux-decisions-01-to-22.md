# Approved UI/UX decision register — 2026-11-07

Status: approved product decisions, **not** proof of implementation. Source: design conversation with project owner. This document is the authoritative checklist for this design phase; reconcile with actual code before marking tasks complete.

## Decisions 1–22

1. **Reference** — Untitled UI as the professional UI reference.
2. **Home** — Large shortcut cards on homepage; analytics dashboard is a separate destination.
3. **Navigation** — Desktop right sidebar; mobile bottom navigation; no swipe navigation for now.
4. **Record display** — Desktop tables; mobile cards.
5. **Forms** — Mobile full-screen forms with large inputs and sticky save actions; desktop side drawer unless form is complex.
6. **Theme** — Cairo Arabic font; professional blue palette: #FFFFFF, #F8FAFC, #101828, #175CD3, #D1E9FF.
7. **Home cards** — Full blue cards with white icons and text, using harmonious shades.
8. **Home shortcut order** — (1) تسجيل النقلات, (2) دفعات العربيات, (3) كشف حساب المقاول, (4) نقدية العربية, (5) التقرير اليومي, (6) البيانات الأساسية, (7) لوحة المؤشرات, (8) الإعدادات. Settings separate from master data.
9. **Trip form** — Intelligent collapsible groups; basic fields visible, optional/conditional sections initially hidden.
10. **Contractor/vehicle selection** — Searchable bottom sheet, recent choices and full list.
11. **Trip save actions** — Fixed حفظ وخروج and حفظ وجديد; preserve repeatable values, prevent duplicate submissions.
12. **Mobile trips list** — Compact expandable cards.
13. **Trip filters** — Combined B+C: always-visible search; today/week/month quick periods, custom range, advanced contractor/vehicle filters, active chips; default today and preserve period.
14. **Vehicle payments page** — Combined B+C: small collapsible financial summary, searchable/filterable payment records, per-vehicle details.
15. **New vehicle payment** — Fast form; optional sections collapsed, review step, duplicate warning without automatic blocking, two save actions; live before/after remaining balance including earlier payments and actual ledger; warn on overpayment.
16. **Contractor statement page** — Combined B+C: compact collapsible blue financial summary and expandable operations/payments/statement sections; five export formats HTML/Print, PDF, PNG, CSV, XLSX.
17. **Contractor statement organization** — Details grouped by **date only**, not top-level vehicle grouping; within date, show supply direction, vehicle, routes/destinations.
18. **Contractor summary option B** — Show each party's work entitlement, payments/settlements and net who owes whom. Separate unique vehicle counts, trip counts and daily-work units; only active dates by default with option to show all; include opening balance/prior activity when applicable. Earlier generic print designs A/B/C were rejected, so do not treat them as approved.
19. **Contractor daily details option B** — Compact expandable daily summary; expanding shows vehicles, routes/destinations, number of trips per destination, and **total daily work value per vehicle**. Printing must include all details, regardless of on-screen collapse.
20. **Contractor summary option C** — Prominent final balance naming who owes whom, comparison of contractor→Ahmed vs Ahmed→contractor operational work, settlements and opening balance.
21. **Contractor filters option C** — Quick contractor/period selection, advanced site/origin/destination, direction and daily-vs-trip pricing filters. Filtered operational value must **not** be labeled overall net debt.
22. **Printed contractor report option C** — Formal bilateral summary + date-grouped vehicle/route/trip/daily-work operational table + final settlements. Repeat headers for multipage prints, avoid splitting vehicle detail from total where possible, support A4 portrait or landscape as needed; export HTML/Print, PDF, PNG, CSV, XLSX with operational detail.

## Additional approved change after decision 22

- Add a prominent **مشاركة الصورة مباشرة** action to report exports. Generate PNG and invoke native device share sheet for WhatsApp or another installed app where supported, without requiring a download first. Keep existing five export formats; downloading PNG/PDF is secondary. On unsupported devices, provide an explicit fallback.

## Domain semantics — mandatory correctness constraints

- The primary relationship is **reciprocal supply of trucks/work**, not primarily money transfers. Contractor supplies Ahmed on some dates, Ahmed supplies contractor on others.
- Work can be priced by **يومية** or **نقلة**. Count and value these separately; never double-count them.
- A vehicle's work may be recorded as **one daily work record**, with multiple routes/destinations and a number of trips **per destination**, plus a **single total value for that vehicle's day**. Do not invent route-level amounts or treat each trip as a distinct record unless source data supports that.
- Date → supply direction → vehicle → routes/destinations; show daily totals and both directions.
- Distinguish unique vehicles, instances of vehicle supply, trip count, and day-work units.
- Net settlement must correctly reflect signed work, applicable opening balance, prior activity and **actual** payments/settlements; do not invent cash payments or assign contractor-wide payments to an individual vehicle.
- The report must state **who is owed by whom, as of which date** in plain Arabic. If filtering by site/destination/direction, show a scoped work subtotal, not a misleading full-account closing balance.
- Print all operational detail even when collapsed in the screen UI.

## Implementation scope and protection

- Stage 1 approved scope: home/navigation, trip entry, vehicle payment UI, contractor statement UI, export/share; protect existing accounting logic.
- Vehicle cash **decision 23 is not approved**. Daily report redesign and other remaining UI decisions are pending. Do not silently choose an option.
- Work on isolated feature branch, review independently, run build/typecheck/tests and verify accounting invariants before any merge. No direct main edits, auto merge or production deployment without review.
- Documentation is a design contract, **not** a statement that code or tests have been completed.

## Implementation progress at time of writing

- Contractor statement: a prominent beneficiary/debtor hero based on existing statement fields was added on this branch.
- Native PNG share button was added to contractor statement exports; device/browser behavior is not yet verified.
- Remaining approved designs, operational detail grouping, filter behavior, export completeness and full regression verification are **not complete**.

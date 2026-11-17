# Delivery acceptance review — 17 November 2026

This is an evidence matrix, not a new session briefing. STATUS holds current work/release state.

| Area | Verified evidence | Remaining acceptance |
| --- | --- | --- |
| Persistent ledger and financial rules | Existing Supabase-backed API, audited SQL operations, historical financial suites; PR90/91 full CI success | Customer approves current dataset/opening balances and performs representative real transactions on their devices |
| Reports and exports | Vehicle/contractor statements, historical filters, PDF/PNG/CSV/XLSX browser regressions passed | Owner checks actual chosen account totals and exports against their records |
| Access control | Live metadata:11 public tables protected by RLS;19 operational RPCs gated by live membership. Owner login/membership API200, anonymous401,cross-origin403 in prior release verification | Real approved second-user onboarding, revoke/access-denial and expiry/recovery acceptance on separate devices; isolated tests alone do not prove these hosted flows |
| Invitations | PR90 deployed; owner-only email invite/manual private links/revoke implemented; Edge ACTIVE, JWT and strict owner checks | No invitees exist in live inventory. Actual recipient link acceptance is unverified. External email sending needs verified custom SMTP; manual links avoid sender dependency |
| Auth hardening | Owner/member authorization preserved; no public sign-up | Replace the explicitly requested weak initial owner password before customer handover. Existing leaked-password protection warning remains unresolved |
| Mobile use | Chromium fixtures cover responsive layout and financial/export interactions | Native Android/iOS keyboard, weak network, session expiry and two-device/concurrent-write smoke still need recorded acceptance |
| Backups | Backup-core tests exist | User-deferred production scheduling, offsite retention and an independently verified restore remain incomplete |
| Visual/theme follow-up | Login refinement and clock-based auto mode in this PR | Exact-head CI, batched mobile/desktop captures and verified production release required |

**Conclusion:** the main operating functions exist and have strong automated evidence. This is ready for a controlled customer acceptance walkthrough, not an unconditional claim of final handover except for backups. Outstanding items above are acceptance/configuration/security gates; there is no evidence here that another major product feature must be invented.

No production financial/Auth rows or settings were modified for this review. Do not clear/reset existing data: its real versus trial status must be confirmed by the owner. Do not classify the historical production-preflight tool's deliberately fail-closed result (or its conditional DemoStore shell detection) as a newly reproduced product defect.

# H048 — T08.2 payment engine and D16=A

## Scope
- User approved D16=A: reject new/backdated payment if it causes a negative cash balance on ANY event day through Cairo evaluation day. D15=A (work accrues first on same-day) remains.
- Pure PostgreSQL schema migration additive to T08.1. Owner-only write RPCs, shared vehicle-account advisory locks with trip RPCs, immutable audit/idempotency, optimistic row versions and cancellation. No API/production auth or Supabase connection.
- For payment edit: logically exclude prior payment by ID only from its original account and dates, then assess the entire replacement on the new account; no double-count.
- Account balance derives from noncancelled trips vehicle totals, noncancelled payments and opening cash. CONTRACTOR_WORK is untouched.

## Critical risks and limitations
- No concurrent live Supabase requests tested: PGlite single connection only. Must test high-contention payment-versus-trip transactions against real Supabase before production.
- D13 allows correction of a paid trip even if balance becomes negative. This separate correction rule remains; new payments still reject if any period after proposed payment would go negative.
- Payment date is restricted to Cairo today or earlier; no future cash posting.
- No UI yet, T08.3 planned separately. Need test real DB owner/stranger and RLS before any real data.
- Review the final diff and CI on latest commit before merge. Record final evidence in GitHub PR comment rather than adding after-the-fact docs-only CI commits.

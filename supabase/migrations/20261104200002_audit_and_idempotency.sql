-- ============================================================================
-- Migration: 20261104200002_audit_and_idempotency.sql
-- Module: DB-02-SCHEMA — Audit Trail and Idempotency Tracking
-- Documentation References:
--   - docs/DATA_MODEL.md (Sections 2, 4)
-- ============================================================================

-- 1. Table: audit_log
-- Strictly append-only audit trail. Client cannot insert, update, or delete directly.
create table if not exists public.audit_log (
    id bigint generated always as identity primary key,
    entity_type text not null check (
        entity_type in ('CONTRACTOR', 'VEHICLE', 'VEHICLE_ACCOUNT', 'OPENING_BALANCE', 'TRIP', 'PAYMENT', 'SETTINGS')
    ),
    entity_id text not null,
    action text not null check (
        action in ('INSERT', 'UPDATE', 'CANCEL', 'CONVERT_OPENING')
    ),
    reason text null,
    old_data jsonb null,
    new_data jsonb null,
    diff jsonb null,
    financial_impact jsonb null,
    performed_by uuid not null,
    created_at timestamptz not null default now()
);

comment on table public.audit_log is 'Append-only ledger of historical revisions and cancellations. Writable only by trusted server procedures.';

create index if not exists idx_audit_log_entity 
on public.audit_log (entity_type, entity_id);

create index if not exists idx_audit_log_created 
on public.audit_log (created_at desc);

-- 2. Table: idempotency_keys
-- Permanent retention of completed financial operation keys to prevent duplicate operations on late retries.
create table if not exists public.idempotency_keys (
    key text primary key,
    user_id uuid not null,
    operation text not null,
    payload_hash text not null,
    status text not null check (status in ('PROCESSING', 'COMPLETED', 'FAILED')),
    response_status integer null,
    response_body jsonb null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table public.idempotency_keys is 'Records idempotency keys and payload hashes. Retained permanently for financial integrity.';

create index if not exists idx_idempotency_user_op 
on public.idempotency_keys (user_id, operation);

-- ============================================================================
-- 3. Row Level Security Policies
-- ============================================================================

-- audit_log
alter table public.audit_log enable row level security;

create policy "Owner can view audit_log"
on public.audit_log for select to authenticated
using (public.app_is_owner());

create policy "Disallow direct insert on audit_log"
on public.audit_log for insert to public
with check (false);

create policy "Disallow direct update on audit_log"
on public.audit_log for update to public
using (false);

create policy "Disallow direct delete on audit_log"
on public.audit_log for delete to public
using (false);

-- idempotency_keys
alter table public.idempotency_keys enable row level security;

create policy "Owner can view idempotency_keys"
on public.idempotency_keys for select to authenticated
using (public.app_is_owner());

create policy "Disallow direct insert on idempotency_keys"
on public.idempotency_keys for insert to public
with check (false);

create policy "Disallow direct update on idempotency_keys"
on public.idempotency_keys for update to public
using (false);

create policy "Disallow direct delete on idempotency_keys"
on public.idempotency_keys for delete to public
using (false);

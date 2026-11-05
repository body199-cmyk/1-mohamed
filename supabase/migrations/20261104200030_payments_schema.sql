-- ============================================================================
-- H047 / T08.1 — additive payments storage, not payment-processing permission.
-- D02/A04: payments belong only to the vehicle + responsible contractor account.
-- D15 approved (work due before payments of the same calendar day).
-- D16 (intermediate-balance validation) is undecided: NO payment write RPC
-- or financial balance approval logic is created in this migration.
-- ============================================================================

create table public.payments (
    id text primary key check (btrim(id) <> ''),
    vehicle_id text not null,
    responsible_contractor_id text not null,
    payment_date date not null,
    amount_piastres bigint not null check (amount_piastres > 0),
    -- Descriptive reference only. It never allocates or deducts per-trip money.
    linked_trip_id text null references public.trips(id) on delete restrict,
    receipt_number text null,
    notes text null,
    is_cancelled boolean not null default false,
    cancel_reason text null,
    cancelled_at timestamptz null,
    version integer not null default 1 check (version >= 1),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint fk_payments_vehicle_account foreign key (vehicle_id, responsible_contractor_id)
        references public.vehicle_accounts(vehicle_id, contractor_id) on delete restrict,
    constraint chk_payments_cancel_metadata check (
        (not is_cancelled and cancel_reason is null and cancelled_at is null)
        or
        (is_cancelled and nullif(btrim(cancel_reason), '') is not null and cancelled_at is not null)
    )
);

comment on table public.payments is
    'T08.1 schema only. Owner RPC writes, historical balance checks, idempotency and audit are pending T08.2/D16. No direct client writes.';
comment on column public.payments.responsible_contractor_id is
    'The party responsible for the vehicle cash account. Payments never affect contractor work difference.';
comment on column public.payments.linked_trip_id is
    'Optional descriptive trip link; no per-trip allocation or payment balance. A link must match the account at creation but can remain historical after trip correction.';

-- Validate that an optional descriptive trip reference belongs to the same
-- vehicle cash account at the moment the link is created/changed. Do not use a
-- composite FK to trips: such an FK would prohibit legitimate trip corrections
-- (D13) if a past payment linked to that trip.
create function public.app_payment_trip_link_guard()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
    if new.linked_trip_id is not null and not exists (
        select 1 from public.trips t
        where t.id = new.linked_trip_id
          and t.vehicle_id = new.vehicle_id
          and t.responsible_contractor_id = new.responsible_contractor_id
    ) then
        raise exception 'Payment trip reference does not belong to this vehicle account'
            using errcode = '23514';
    end if;
    return new;
end;
$$;

create trigger trg_payments_trip_link_guard
before insert or update of linked_trip_id, vehicle_id, responsible_contractor_id
on public.payments for each row
execute function public.app_payment_trip_link_guard();

revoke execute on function public.app_payment_trip_link_guard()
from public, anon, authenticated;

create index idx_payments_active_account_date
on public.payments (vehicle_id, responsible_contractor_id, payment_date, id)
where not is_cancelled;

create index idx_payments_trip_reference
on public.payments (linked_trip_id) where linked_trip_id is not null;

-- Keep the same fail-closed pattern as contractors, vehicles and trips.
alter table public.payments enable row level security;

create policy "Owner can view payments"
on public.payments for select to authenticated
using (public.app_is_owner());

create policy "Disallow direct insert on payments"
on public.payments for insert to public
with check (false);

create policy "Disallow direct update on payments"
on public.payments for update to public
using (false);

create policy "Disallow direct delete on payments"
on public.payments for delete to public
using (false);

-- RLS does not apply to TRUNCATE. Revoke explicitly even if default grants change.
revoke truncate on public.payments from anon, authenticated;

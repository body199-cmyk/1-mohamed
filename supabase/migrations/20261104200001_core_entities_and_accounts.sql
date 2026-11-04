-- ============================================================================
-- Migration: 20261104200001_core_entities_and_accounts.sql
-- Module: DB-02-SCHEMA — Core Entities, Accounts, and Opening Balances
-- Documentation References:
--   - docs/DATA_MODEL.md (Sections 1, 2, 5)
-- ============================================================================

-- 1. Table: contractors
create table if not exists public.contractors (
    id text primary key,
    name text not null check (trim(name) <> ''),
    is_primary boolean not null default false,
    is_archived boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint chk_primary_cannot_be_archived check (not (is_primary and is_archived))
);

comment on table public.contractors is 'Master record of counterparties and the primary business owner (Ahmed Abu Ali).';

-- Ensure only one primary contractor exists in the system
create unique index if not exists idx_contractors_single_primary 
on public.contractors ((1)) 
where is_primary = true;

-- Search index on active contractor names (uniqueness not enforced to allow legitimately identical names)
create index if not exists idx_contractors_name_search 
on public.contractors (lower(trim(name))) 
where not is_archived;

-- 2. Table: vehicles
create table if not exists public.vehicles (
    id text primary key,
    plate_number text not null check (trim(plate_number) <> ''),
    driver_name text null,
    notes text null,
    is_archived boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table public.vehicles is 'Master record of trucks and agreed default driver.';

-- Normalized unique active plate number index
create unique index if not exists idx_vehicles_plate_active 
on public.vehicles (lower(regexp_replace(trim(plate_number), '\s+', ' ', 'g'))) 
where not is_archived;

-- 3. Table: vehicle_accounts
-- Logical account key anchor (vehicle_id, contractor_id) for cash accountability and row-level mutex.
create table if not exists public.vehicle_accounts (
    vehicle_id text not null references public.vehicles(id) on delete restrict,
    contractor_id text not null references public.contractors(id) on delete restrict,
    created_at timestamptz not null default now(),
    last_activity_at timestamptz not null default now(),
    primary key (vehicle_id, contractor_id)
);

comment on table public.vehicle_accounts is 'Represents the isolated cash account of a vehicle with a responsible contractor. No manual balance column.';

-- 4. Table: opening_balances
create table if not exists public.opening_balances (
    id text primary key,
    balance_type text not null check (balance_type in ('CONTRACTOR_WORK', 'VEHICLE_CASH')),
    contractor_id text not null references public.contractors(id) on delete restrict,
    vehicle_id text null references public.vehicles(id) on delete restrict,
    start_date date not null,
    signed_piastres bigint not null,
    notes text null,
    is_cancelled boolean not null default false,
    cancel_reason text null,
    cancelled_at timestamptz null,
    version integer not null default 1 check (version >= 1),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint chk_opening_balance_type_fields check (
        (balance_type = 'CONTRACTOR_WORK' and vehicle_id is null) or 
        (balance_type = 'VEHICLE_CASH' and vehicle_id is not null)
    ),
    constraint chk_opening_cancel_reason check (
        not is_cancelled or (cancel_reason is not null and trim(cancel_reason) <> '')
    ),
    -- Composite foreign key guarantees vehicle account exists for VEHICLE_CASH
    constraint fk_opening_vehicle_account foreign key (vehicle_id, contractor_id)
        references public.vehicle_accounts(vehicle_id, contractor_id) on delete restrict
);

comment on table public.opening_balances is 'Stores starting balances before detailed transactions. Split strictly into contractor work and vehicle cash.';

-- Unique active opening balance per contractor
create unique index if not exists idx_opening_contractor_active 
on public.opening_balances (contractor_id) 
where balance_type = 'CONTRACTOR_WORK' and not is_cancelled;

-- Unique active opening balance per vehicle account
create unique index if not exists idx_opening_vehicle_account_active 
on public.opening_balances (contractor_id, vehicle_id) 
where balance_type = 'VEHICLE_CASH' and not is_cancelled;

-- 5. Table: business_settings
create table if not exists public.business_settings (
    id text primary key default 'default' check (id = 'default'),
    business_name text not null default 'مكتب أحمد أبو علي',
    phone_number text null,
    default_payment_terms text null,
    updated_at timestamptz not null default now()
);

comment on table public.business_settings is 'Single-row general settings. Strictly free of secrets and credentials.';

insert into public.business_settings (id, business_name)
values ('default', 'مكتب أحمد أبو علي')
on conflict (id) do nothing;

-- ============================================================================
-- 6. Row Level Security Policies (Strictly Owner-Only, No Direct Client Writes)
-- ============================================================================

-- contractors
alter table public.contractors enable row level security;

create policy "Owner can view contractors"
on public.contractors for select to authenticated
using (public.app_is_owner());

create policy "Disallow direct insert on contractors"
on public.contractors for insert to public
with check (false);

create policy "Disallow direct update on contractors"
on public.contractors for update to public
using (false);

create policy "Disallow direct delete on contractors"
on public.contractors for delete to public
using (false);

-- vehicles
alter table public.vehicles enable row level security;

create policy "Owner can view vehicles"
on public.vehicles for select to authenticated
using (public.app_is_owner());

create policy "Disallow direct insert on vehicles"
on public.vehicles for insert to public
with check (false);

create policy "Disallow direct update on vehicles"
on public.vehicles for update to public
using (false);

create policy "Disallow direct delete on vehicles"
on public.vehicles for delete to public
using (false);

-- vehicle_accounts
alter table public.vehicle_accounts enable row level security;

create policy "Owner can view vehicle_accounts"
on public.vehicle_accounts for select to authenticated
using (public.app_is_owner());

create policy "Disallow direct insert on vehicle_accounts"
on public.vehicle_accounts for insert to public
with check (false);

create policy "Disallow direct update on vehicle_accounts"
on public.vehicle_accounts for update to public
using (false);

create policy "Disallow direct delete on vehicle_accounts"
on public.vehicle_accounts for delete to public
using (false);

-- opening_balances
alter table public.opening_balances enable row level security;

create policy "Owner can view opening_balances"
on public.opening_balances for select to authenticated
using (public.app_is_owner());

create policy "Disallow direct insert on opening_balances"
on public.opening_balances for insert to public
with check (false);

create policy "Disallow direct update on opening_balances"
on public.opening_balances for update to public
using (false);

create policy "Disallow direct delete on opening_balances"
on public.opening_balances for delete to public
using (false);

-- business_settings
alter table public.business_settings enable row level security;

create policy "Owner can view business_settings"
on public.business_settings for select to authenticated
using (public.app_is_owner());

create policy "Disallow direct insert on business_settings"
on public.business_settings for insert to public
with check (false);

create policy "Disallow direct update on business_settings"
on public.business_settings for update to public
using (false);

create policy "Disallow direct delete on business_settings"
on public.business_settings for delete to public
using (false);

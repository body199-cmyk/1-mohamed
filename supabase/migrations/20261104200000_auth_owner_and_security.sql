-- ============================================================================
-- Migration: 20261104200000_auth_owner_and_security.sql
-- Module: DB-02-SCHEMA — Base Security and Owner Verification
-- Documentation References:
--   - docs/DATA_MODEL.md (Section 5: Security & RLS)
--   - https://supabase.com/docs/guides/database/postgres/row-level-security
--   - https://supabase.com/docs/guides/database/hardening-data-api
--   - https://www.postgresql.org/docs/current/sql-createfunction.html#SQL-CREATEFUNCTION-SECURITY
-- ============================================================================

-- Ensure auth schema exists (in standard Supabase instances this is pre-existing)
create schema if not exists auth;

-- 1. Create table app_owner
-- Strictly single-row table storing the single approved application owner.
create table if not exists public.app_owner (
    id integer primary key default 1 check (id = 1),
    owner_user_id uuid null,
    initialized_at timestamptz null,
    created_at timestamptz not null default now()
);

comment on table public.app_owner is 'Stores the single authorized owner user ID for the application. Fail-closed if owner_user_id is null.';

-- Seed the initial configuration row if it does not exist
insert into public.app_owner (id, owner_user_id, initialized_at)
values (1, null, null)
on conflict (id) do nothing;

-- Enable RLS on app_owner
alter table public.app_owner enable row level security;

-- 2. Function to retrieve the owner user ID securely
create or replace function public.app_get_owner_id()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
    select owner_user_id from public.app_owner where id = 1;
$$;

comment on function public.app_get_owner_id() is 'Returns the authorized owner UUID or null if not yet configured.';

revoke execute on function public.app_get_owner_id() from public;
grant execute on function public.app_get_owner_id() to authenticated;

-- 3. Function to check if the current session caller is the authorized owner
-- Returns true ONLY if auth.uid() is not null AND matches app_owner.owner_user_id.
create or replace function public.app_is_owner()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
    select (
        auth.uid() is not null 
        and auth.uid() = (select owner_user_id from public.app_owner where id = 1)
    );
$$;

comment on function public.app_is_owner() is 'Validates if auth.uid() is the approved application owner. Fail-closed if unconfigured.';

revoke execute on function public.app_is_owner() from public;
grant execute on function public.app_is_owner() to authenticated;

-- 4. Administrative initialization procedure (strictly protected)
-- Can only be called once to set the initial owner when owner_user_id is null.
-- Revoked from public, anon, and authenticated. Can only be invoked by administrator / migration.
create or replace function public.app_set_initial_owner(p_owner_user_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
    if p_owner_user_id is null then
        raise exception 'Owner user ID cannot be null';
    end if;

    update public.app_owner
    set owner_user_id = p_owner_user_id,
        initialized_at = now()
    where id = 1 and owner_user_id is null;

    if not found then
        raise exception 'Owner already initialized or configuration record missing';
    end if;
end;
$$;

comment on function public.app_set_initial_owner(uuid) is 'Administrative bootstrap to set the initial owner. Cannot be called from client API.';

revoke execute on function public.app_set_initial_owner(uuid) from public, anon, authenticated;

-- 5. RLS Policies on app_owner
-- The owner can inspect the ownership status
create policy "Owner can read app_owner"
on public.app_owner
for select
to authenticated
using (public.app_is_owner());

-- Direct mutation of app_owner is forbidden for all roles
create policy "Disallow direct insert on app_owner"
on public.app_owner
for insert
to public
with check (false);

create policy "Disallow direct update on app_owner"
on public.app_owner
for update
to public
using (false);

create policy "Disallow direct delete on app_owner"
on public.app_owner
for delete
to public
using (false);

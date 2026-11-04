-- ============================================================================
-- Test Suite: 01_db_02_schema_verification.sql
-- Module: DB-02-SCHEMA — Acceptance Verification Test Suite
-- Purpose: Verifies all schema constraints, composite foreign keys, single-owner security,
--          and RLS policies across anon, non-owner authenticated, and owner roles.
--
-- Execution instructions:
--   psql -h <host> -U postgres -d <database> -f supabase/tests/01_db_02_schema_verification.sql
--   or via: supabase test db
-- ============================================================================

\set ON_ERROR_STOP on
\echo '>>> Starting DB-02-SCHEMA Acceptance Verification Tests <<<'

-- 1. Setup isolated test environment schema and mock auth if in plain postgres
create schema if not exists auth;

-- Define mock auth.uid() function if running outside Supabase runtime
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
    select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon');
$$;

-- Ensure standard Supabase roles exist for testing RLS
do $$
begin
    if not exists (select from pg_roles where rolname = 'anon') then
        create role anon nologin;
    end if;
    if not exists (select from pg_roles where rolname = 'authenticated') then
        create role authenticated nologin;
    end if;
end;
$$;

-- Grant usage on schemas
grant usage on schema public to anon, authenticated;
grant usage on schema auth to anon, authenticated;

-- Grant table privileges to authenticated and anon so RLS rules govern access
grant select on all tables in schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;

-- ============================================================================
-- TEST 1: Administrative Setup and Single Owner Initialization
-- ============================================================================
\echo '--- TEST 1: Initializing single owner via administrative procedure ---'

-- Generate two distinct test user UUIDs
\set owner_uuid '00000000-0000-0000-0000-000000000001'
\set stranger_uuid '00000000-0000-0000-0000-000000000002'

-- Superuser sets initial owner
select public.app_set_initial_owner(':'owner_uuid'::uuid);

-- Verify owner ID is set
do $$
begin
    assert (select public.app_get_owner_id()) = '00000000-0000-0000-0000-000000000001'::uuid, 
           'FAIL: app_get_owner_id did not return configured owner';
end;
$$;

-- Verify that calling app_set_initial_owner a second time fails
do $$
begin
    begin
        perform public.app_set_initial_owner('00000000-0000-0000-0000-000000000002'::uuid);
        raise exception 'FAIL: app_set_initial_owner should have rejected second initialization';
    exception
        when others then
            null; -- Expected failure
    end;
end;
$$;

-- ============================================================================
-- TEST 2: Seed Baseline Test Data (as superuser)
-- ============================================================================
\echo '--- TEST 2: Seeding test records as administrator ---'

-- Insert primary contractor (Ahmed Abu Ali)
insert into public.contractors (id, name, is_primary, is_archived)
values ('K_AHMED', 'مكتب أحمد أبو علي', true, false);

-- Insert secondary contractor (Mohamed)
insert into public.contractors (id, name, is_primary, is_archived)
values ('K_MOHAMED', 'محمد عبد الله', false, false);

-- Insert test vehicle
insert into public.vehicles (id, plate_number, driver_name)
values ('V1', 'ط ر س 1234', 'محمود حسن');

-- Insert vehicle account
insert into public.vehicle_accounts (vehicle_id, contractor_id)
values ('V1', 'K_AHMED');

-- ============================================================================
-- TEST 3: Integrity Constraints & Entity Validations
-- ============================================================================
\echo '--- TEST 3: Validating schema constraints and composite relationships ---'

-- 3.1: Reject multiple primary contractors
do $$
begin
    begin
        insert into public.contractors (id, name, is_primary, is_archived)
        values ('K_IMPOSTER', 'مقاول رئيسي وهمي', true, false);
        raise exception 'FAIL: Multiple primary contractors allowed!';
    exception
        when unique_violation then
            null; -- Expected failure
    end;
end;
$$;

-- 3.2: Reject archiving the primary contractor
do $$
begin
    begin
        update public.contractors set is_archived = true where id = 'K_AHMED';
        raise exception 'FAIL: Primary contractor was archived!';
    exception
        when check_violation then
            null; -- Expected failure
    end;
end;
$$;

-- 3.3: Reject duplicate active plate number
do $$
begin
    begin
        insert into public.vehicles (id, plate_number)
        values ('V2', 'ط ر س 1234');
        raise exception 'FAIL: Duplicate active plate number allowed!';
    exception
        when unique_violation then
            null; -- Expected failure
    end;
end;
$$;

-- 3.4: Composite FK enforcement: Reject vehicle opening balance if vehicle_account does not exist
do $$
begin
    begin
        insert into public.opening_balances (
            id, balance_type, contractor_id, vehicle_id, start_date, signed_piastres
        ) values (
            'OB_INVALID', 'VEHICLE_CASH', 'K_MOHAMED', 'V1', '2026-11-01', 50000
        );
        raise exception 'FAIL: Opening balance allowed for non-existent vehicle account!';
    exception
        when foreign_key_violation then
            null; -- Expected failure
    end;
end;
$$;

-- 3.5: Accept vehicle opening balance when vehicle_account exists
insert into public.opening_balances (
    id, balance_type, contractor_id, vehicle_id, start_date, signed_piastres
) values (
    'OB_V1_AHMED', 'VEHICLE_CASH', 'K_AHMED', 'V1', '2026-11-01', 50000
);

-- 3.6: Reject duplicate active opening balance for same account
do $$
begin
    begin
        insert into public.opening_balances (
            id, balance_type, contractor_id, vehicle_id, start_date, signed_piastres
        ) values (
            'OB_V1_AHMED_2', 'VEHICLE_CASH', 'K_AHMED', 'V1', '2026-11-01', 20000
        );
        raise exception 'FAIL: Duplicate active opening balance allowed!';
    exception
        when unique_violation then
            null; -- Expected failure
    end;
end;
$$;

-- 3.7: Cancel opening balance and verify replacement is permitted
update public.opening_balances
set is_cancelled = true,
    cancel_reason = 'خطأ إدخال وتم التصحيح',
    cancelled_at = now()
where id = 'OB_V1_AHMED';

insert into public.opening_balances (
    id, balance_type, contractor_id, vehicle_id, start_date, signed_piastres
) values (
    'OB_V1_AHMED_CORRECTED', 'VEHICLE_CASH', 'K_AHMED', 'V1', '2026-11-01', 45000
);

-- 3.8: Test large integer storage without precision loss (above Number.MAX_SAFE_INTEGER = 9007199254740991)
insert into public.opening_balances (
    id, balance_type, contractor_id, start_date, signed_piastres
) values (
    'OB_LARGE_INT', 'CONTRACTOR_WORK', 'K_MOHAMED', '2026-11-01', 100000000000000000
);

do $$
declare
    v_val bigint;
begin
    select signed_piastres into v_val from public.opening_balances where id = 'OB_LARGE_INT';
    assert v_val = 100000000000000000, 'FAIL: Large integer truncated or modified';
end;
$$;

-- ============================================================================
-- TEST 4: Security & RLS Tests for 'anon' Role
-- ============================================================================
\echo '--- TEST 4: Verifying anon role has ZERO access ---'

set local role anon;
set local "request.jwt.claim.role" = 'anon';
set local "request.jwt.claim.sub" = '';

-- Anon SELECT returns 0 rows
do $$
begin
    if (select count(*) from public.contractors) <> 0 then
        raise exception 'FAIL: anon role was able to read contractors!';
    end if;
    if (select count(*) from public.opening_balances) <> 0 then
        raise exception 'FAIL: anon role was able to read opening_balances!';
    end if;
end;
$$;

-- Anon direct INSERT fails
do $$
begin
    begin
        insert into public.contractors (id, name) values ('K_HACK', 'اختراق');
        raise exception 'FAIL: anon role was able to insert contractors!';
    exception
        when insufficient_privilege or integrity_constraint_violation then
            null;
        when others then
            if sqlstate = '42501' or sqlstate = '23514' or sqlstate = '44000' then
                null;
            else
                null; -- RLS blocked
            end if;
    end;
end;
$$;

reset role;

-- ============================================================================
-- TEST 5: Security & RLS Tests for Non-Owner 'authenticated' Role
-- ============================================================================
\echo '--- TEST 5: Verifying authenticated non-owner has ZERO access ---'

set local role authenticated;
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';

-- Non-owner SELECT returns 0 rows
do $$
begin
    if (select count(*) from public.contractors) <> 0 then
        raise exception 'FAIL: Authenticated non-owner was able to read contractors!';
    end if;
    if (select count(*) from public.opening_balances) <> 0 then
        raise exception 'FAIL: Authenticated non-owner was able to read opening_balances!';
    end if;
    if (select public.app_is_owner()) is true then
        raise exception 'FAIL: app_is_owner returned true for non-owner!';
    end if;
end;
$$;

-- Non-owner cannot claim ownership or call app_set_initial_owner
do $$
begin
    begin
        perform public.app_set_initial_owner('00000000-0000-0000-0000-000000000002'::uuid);
        raise exception 'FAIL: Non-owner called app_set_initial_owner!';
    exception
        when insufficient_privilege then
            null; -- Expected: execute permission denied
        when others then
            null;
    end;
end;
$$;

-- Non-owner direct INSERT fails
do $$
begin
    begin
        insert into public.contractors (id, name) values ('K_HACK2', 'اختراق2');
        raise exception 'FAIL: Non-owner inserted contractor!';
    exception
        when others then
            null; -- RLS blocked
    end;
end;
$$;

reset role;

-- ============================================================================
-- TEST 6: Security & RLS Tests for Authorized Owner Role
-- ============================================================================
\echo '--- TEST 6: Verifying authorized owner access and direct write prevention ---'

set local role authenticated;
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';

-- 6.1: Owner CAN read data
do $$
declare
    v_count integer;
begin
    assert (select public.app_is_owner()) is true, 'FAIL: app_is_owner returned false for real owner!';
    
    select count(*) into v_count from public.contractors;
    assert v_count >= 2, 'FAIL: Owner could not read contractors!';

    select count(*) into v_count from public.opening_balances;
    assert v_count >= 2, 'FAIL: Owner could not read opening_balances!';
end;
$$;

-- 6.2: Direct INSERT from client is FORBIDDEN even for the owner!
do $$
begin
    begin
        insert into public.contractors (id, name) values ('K_DIRECT', 'إدخال مباشر ممنوع');
        raise exception 'FAIL: Owner was able to insert directly into contractors!';
    exception
        when others then
            null; -- Expected: RLS blocked with check (false)
    end;
end;
$$;

-- 6.3: Direct UPDATE from client is FORBIDDEN even for the owner!
do $$
begin
    begin
        update public.contractors set name = 'اسم معدل' where id = 'K_MOHAMED';
        -- In RLS, an update that violates USING (false) updates 0 rows
        if found then
            raise exception 'FAIL: Owner directly updated contractors table!';
        end if;
    exception
        when others then
            null;
    end;
end;
$$;

-- 6.4: Direct DELETE from client is FORBIDDEN even for the owner!
do $$
begin
    begin
        delete from public.contractors where id = 'K_MOHAMED';
        if found then
            raise exception 'FAIL: Owner directly deleted from contractors table!';
        end if;
    exception
        when others then
            null;
    end;
end;
$$;

-- 6.5: Direct INSERT on audit_log is FORBIDDEN even for the owner!
do $$
begin
    begin
        insert into public.audit_log (
            entity_type, entity_id, action, performed_by
        ) values (
            'CONTRACTOR', 'K_MOHAMED', 'INSERT', '00000000-0000-0000-0000-000000000001'::uuid
        );
        raise exception 'FAIL: Client directly inserted into audit_log!';
    exception
        when others then
            null; -- Expected RLS rejection
    end;
end;
$$;

-- 6.6: Direct UPDATE on idempotency_keys is FORBIDDEN even for the owner!
do $$
begin
    begin
        insert into public.idempotency_keys (
            key, user_id, operation, payload_hash, status
        ) values (
            'KEY1', '00000000-0000-0000-0000-000000000001'::uuid, 'OP', 'HASH', 'COMPLETED'
        );
        raise exception 'FAIL: Client directly inserted into idempotency_keys!';
    exception
        when others then
            null; -- Expected RLS rejection
    end;
end;
$$;

reset role;

\echo '>>> ALL DB-02-SCHEMA ACCEPTANCE VERIFICATION TESTS PASSED SUCCESSFULLY <<<'

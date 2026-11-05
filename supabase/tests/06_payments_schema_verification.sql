-- ============================================================================
-- H047 / T08.1 — isolated PostgreSQL schema and relationship verification.
-- Runs AFTER all A/B/C migrations and tests on one in-memory database.
-- These are database schema tests, not Supabase Auth or payment RPC tests.
-- ============================================================================

select public.app_test_assert(
    (select relrowsecurity from pg_class where oid = 'public.payments'::regclass),
    'P01 payment table has row security'
);
select public.app_test_assert(
    (select count(*) from pg_policies
     where schemaname = 'public' and tablename = 'payments'
       and policyname in ('Owner can view payments','Disallow direct insert on payments',
                          'Disallow direct update on payments','Disallow direct delete on payments')) = 4,
    'P02 owner read and three direct-write denial policies exist'
);
select public.app_test_assert(
    not has_table_privilege('anon','public.payments','TRUNCATE')
    and not has_table_privilege('authenticated','public.payments','TRUNCATE'),
    'P03 TRUNCATE denied to API roles even outside RLS'
);
select public.app_test_assert(
    not has_function_privilege('anon','public.app_payment_trip_link_guard()','EXECUTE')
    and not has_function_privilege('authenticated','public.app_payment_trip_link_guard()','EXECUTE'),
    'P04 internal link trigger function is not callable by client roles'
);
select public.app_test_assert(
    exists (select 1 from public.vehicle_accounts
            where vehicle_id='V1' and contractor_id='K_AHMED')
    and exists (select 1 from public.vehicle_accounts
            where vehicle_id='V2' and contractor_id='K_MOHAMED')
    and exists (select 1 from public.trips
            where id='TR_A' and vehicle_id='V1' and responsible_contractor_id='K_AHMED'),
    'P05 preexisting independent vehicle accounts and linked trip available'
);

-- Admin fixture only: T08.1 has no write RPC, and RLS forbids client writes.
insert into public.payments (
    id, vehicle_id, responsible_contractor_id, payment_date,
    amount_piastres, linked_trip_id, receipt_number, notes
) values (
    'P_SCHEMA_001','V1','K_AHMED','2026-11-02',2500,'TR_A','0007','demo schema fixture only'
);
insert into public.payments (
    id, vehicle_id, responsible_contractor_id, payment_date, amount_piastres
) values ('P_SCHEMA_002','V2','K_MOHAMED','2026-11-05',100);

select public.app_test_assert(
    (select amount_piastres from public.payments where id='P_SCHEMA_001')=2500
    and (select receipt_number from public.payments where id='P_SCHEMA_001')='0007'
    and (select linked_trip_id from public.payments where id='P_SCHEMA_002') is null
    and (select count(*) from public.payments)=2,
    'P06 amounts are exact integer piastres, receipt text preserves zeros, optional link'
);

select public.app_test_expect_error(
    $q$insert into public.payments (id,vehicle_id,responsible_contractor_id,payment_date,amount_piastres)
       values ('P_BAD_ACCOUNT','V1','K_MOHAMED','2026-11-02',100)$q$,
    'P07 missing vehicle+contractor account rejected (no implicit account creation)',
    array['23503']
);
select public.app_test_expect_error(
    $q$insert into public.payments (id,vehicle_id,responsible_contractor_id,payment_date,amount_piastres,linked_trip_id)
       values ('P_BAD_LINK','V2','K_MOHAMED','2026-11-02',100,'TR_A')$q$,
    'P08 descriptive trip link cannot impersonate another cash account',
    array['23514']
);
select public.app_test_expect_error(
    $q$insert into public.payments (id,vehicle_id,responsible_contractor_id,payment_date,amount_piastres,linked_trip_id)
       values ('P_MISSING_TRIP','V1','K_AHMED','2026-11-02',100,'TR_DOES_NOT_EXIST')$q$,
    'P09 missing trip reference rejected',
    array['23514']
);
select public.app_test_expect_error(
    $q$insert into public.payments (id,vehicle_id,responsible_contractor_id,payment_date,amount_piastres)
       values ('P_ZERO','V1','K_AHMED','2026-11-02',0)$q$,
    'P10 zero-payment forbidden',
    array['23514']
);
select public.app_test_expect_error(
    $q$insert into public.payments (id,vehicle_id,responsible_contractor_id,payment_date,amount_piastres)
       values ('P_NEG','V1','K_AHMED','2026-11-02',-1)$q$,
    'P11 negative-payment forbidden',
    array['23514']
);
select public.app_test_expect_error(
    $q$insert into public.payments (id,vehicle_id,responsible_contractor_id,payment_date,amount_piastres)
       values ('P_SCHEMA_001','V1','K_AHMED','2026-11-02',1)$q$,
    'P12 primary key prevents duplicate payment IDs',
    array['23505']
);
select public.app_test_expect_error(
    $q$insert into public.payments (id,vehicle_id,responsible_contractor_id,payment_date,amount_piastres,is_cancelled)
       values ('P_BAD_CANCEL','V1','K_AHMED','2026-11-02',1,true)$q$,
    'P13 cancellation without timestamp/reason forbidden',
    array['23514']
);
select public.app_test_expect_error(
    $q$insert into public.payments (id,vehicle_id,responsible_contractor_id,payment_date,amount_piastres,version)
       values ('P_BAD_VERSION','V1','K_AHMED','2026-11-02',1,0)$q$,
    'P14 invalid record version rejected',
    array['23514']
);
select public.app_test_expect_error(
    $q$update public.payments set linked_trip_id='TR_A' where id='P_SCHEMA_002'$q$,
    'P15 changing optional linked trip must still belong to payment account',
    array['23514']
);
select public.app_test_assert(
    (select count(*) from public.payments)=2
    and (select linked_trip_id from public.payments where id='P_SCHEMA_002') is null,
    'P16 all rejected writes left fixture unchanged'
);

-- RLS read isolation and owner-only access, using same simulated actors as A/B/C.
set role anon;
set "request.jwt.claim.role"='anon';
set "request.jwt.claim.sub"='';
select public.app_test_assert((select count(*) from public.payments)=0,'P17 anon reads no payments');
select public.app_test_expect_error(
    $q$insert into public.payments (id,vehicle_id,responsible_contractor_id,payment_date,amount_piastres)
       values ('P_ANON','V1','K_AHMED','2026-11-02',100)$q$,
    'P18 anon direct insert forbidden', array['42501']
);
reset role;
set role authenticated;
set "request.jwt.claim.role"='authenticated';
set "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000002';
select public.app_test_assert((select count(*) from public.payments)=0,'P19 nonowner reads no payments');
select public.app_test_expect_error(
    $q$insert into public.payments (id,vehicle_id,responsible_contractor_id,payment_date,amount_piastres)
       values ('P_OTHER','V1','K_AHMED','2026-11-02',100)$q$,
    'P20 nonowner direct insert forbidden', array['42501']
);
reset role;
set role authenticated;
set "request.jwt.claim.role"='authenticated';
set "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000001';
select public.app_test_assert((select count(*) from public.payments)=2,'P21 owner can read both payment accounts');
select public.app_test_expect_error(
    $q$insert into public.payments (id,vehicle_id,responsible_contractor_id,payment_date,amount_piastres)
       values ('P_DIRECT_OWNER','V1','K_AHMED','2026-11-02',100)$q$,
    'P22 even owner cannot bypass write RPC with direct insert', array['42501']
);
select public.app_test_expect_error(
    $q$truncate public.payments$q$,
    'P23 no direct truncate even as authenticated owner',array['42501']
);
reset role;
reset "request.jwt.claim.role";
reset "request.jwt.claim.sub";
select public.app_test_assert(
  (select count(*) from public.payments)=2
  and not exists(select 1 from public.payments where id in ('P_ANON','P_OTHER','P_DIRECT_OWNER')),
  'P24 direct API roles cannot mutate schema fixtures'
);

-- Valid cancellation metadata on trusted server/admin layer, not a cash posting.
update public.payments
set is_cancelled=true,cancel_reason='اختبار إلغاء تجريبي',cancelled_at=now(),version=2
where id='P_SCHEMA_002';
select public.app_test_assert(
    (select is_cancelled and cancel_reason='اختبار إلغاء تجريبي'
     from public.payments where id='P_SCHEMA_002')
    and (select count(*) from public.payments where not is_cancelled)=1,
    'P25 cancelled rows are retained and excluded by active index predicate'
);

-- FIN-04 isolated account timeline and atomic failure regression.
-- Dedicated fixtures (vehicles V_F4_A / V_F4_B) are created here and shared
-- with no other suite, so no FIN-01/02 or FIN-07 mutation can alter the
-- expected outcomes. Scenario expectations are computed from the explicit
-- fixture story written next to each assert.
reset role;
insert into public.vehicles(id,plate_number) values
 ('V_F4_A','F4 ACCOUNT A'),('V_F4_B','F4 ACCOUNT B');
insert into public.vehicle_accounts(vehicle_id,contractor_id) values
 ('V_F4_A','K_MOHAMED'),
 ('V_F4_B','K_MOHAMED'),('V_F4_B','K_AHMED');
set role authenticated;
set "request.jwt.claim.role"='authenticated';
set "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000001';

-- ---------------------------------------------------------------------------
-- Scenario A — an uncancelled TRIP blocks a later opening (first work day rule).
--   V_F4_A / K_MOHAMED: no opening; trip 2026-11-02 (+10000 vehicle cash due).
-- ---------------------------------------------------------------------------
select public.app_test_assert(
  not exists(select 1 from public.opening_balances where
    balance_type='VEHICLE_CASH' and contractor_id='K_MOHAMED' and vehicle_id='V_F4_A'),
  'FIN04 scenario A fixture has no earlier opening for responsible cash account');
select public.app_op_trip_create('FIN04-TRIP-FIRST',
  jsonb_build_object('id','TR_F4A_FIRST','vehicle_id','V_F4_A',
    'counterparty_contractor_id','K_MOHAMED','direction','OTHER_SUPPLIES',
    'trip_date','2026-11-02','weight_tonnes','1',
    'contractor_rate_egp','100','vehicle_rate_egp','100','expense_egp','0'));

select public.app_test_expect_error(
  $q$select public.app_op_opening_balance_create('FIN04-OPEN-INVALID',
    '{"id":"OB_F4A_BAD","balance_type":"VEHICLE_CASH",
    "contractor_id":"K_MOHAMED","vehicle_id":"V_F4_A",
    "start_date":"2026-11-03","signed_piastres":0,"start_mode":"TOTAL"}'::jsonb)$q$,
  'FIN04 rejects opening one day after existing cash work',array['22023']);
select public.app_test_assert(
  not exists(select 1 from public.opening_balances where id='OB_F4A_BAD')
  and not exists(select 1 from public.audit_log
    where entity_type='OPENING_BALANCE' and entity_id='OB_F4A_BAD')
  and not exists(select 1 from public.idempotency_keys where key='FIN04-OPEN-INVALID'),
  'FIN04 failed cash opening has no partial write, audit or idempotency');

select public.app_op_opening_balance_create('FIN04-OPEN-VALID',
  '{"id":"OB_F4A_OK","balance_type":"VEHICLE_CASH",
  "contractor_id":"K_MOHAMED","vehicle_id":"V_F4_A",
  "start_date":"2026-11-02","signed_piastres":0,"start_mode":"TOTAL"}'::jsonb);
select public.app_test_assert(
  (select count(*) from public.opening_balances where id='OB_F4A_OK'
    and start_date='2026-11-02')=1,
  'FIN04 accepts account opening on first work day');

-- Exercises the second guard's BEFORE INSERT branch directly on an isolated
-- trip write, after the account lock; SQL must fail closed even outside the
-- form/pre-lock resolver. The same trigger's UPDATE branch is tested below for both re-dating
-- an active trip and re-activating a cancelled historical trip.
select public.app_test_expect_error(
  $q$insert into public.trips(
    id,vehicle_id,counterparty_contractor_id,responsible_contractor_id,
    direction,trip_date,weight_milli_tonnes,contractor_rate_piastres,
    vehicle_rate_piastres,same_rate,expense_piastres,contractor_total_piastres,
    vehicle_total_piastres
  ) select 'TR_F4A_TOO_EARLY',vehicle_id,counterparty_contractor_id,
    responsible_contractor_id,direction,'2026-11-01',weight_milli_tonnes,
    contractor_rate_piastres,vehicle_rate_piastres,same_rate,expense_piastres,
    contractor_total_piastres,vehicle_total_piastres
    from public.trips where id='TR_F4A_FIRST'$q$,
  'FIN04 trip cannot be saved before opening',array['22023']);
select public.app_test_assert(
  not exists(select 1 from public.trips where id='TR_F4A_TOO_EARLY'),
  'FIN04 rejected pre-opening trip has no persisted record');

-- ---------------------------------------------------------------------------
-- Scenario A2 — FIN-04 BEFORE UPDATE guard (previously untested).
-- An authorized edit must not re-date an active trip before the accepted
-- cash opening; a previously cancelled pre-opening trip must not be restored.
-- Use the fixture from Scenario A, not a second account or sample data.
-- ---------------------------------------------------------------------------
select public.app_test_expect_error(
  $q$select public.app_op_trip_update('FIN04-TRIP-REDATE-BLOCK',
    jsonb_build_object('id','TR_F4A_FIRST','expected_version',1,
      'reason','FIN04 negative redate test','vehicle_id','V_F4_A',
      'counterparty_contractor_id','K_MOHAMED','direction','OTHER_SUPPLIES',
      'trip_date','2026-11-01','weight_tonnes','1',
      'contractor_rate_egp','100','vehicle_rate_egp','100',
      'expense_egp','0'))$q$,
  'FIN04 authenticated trip update cannot redate before opening',array['22023']);
select public.app_test_assert(
  (select count(*) from public.trips where id='TR_F4A_FIRST'
    and trip_date='2026-11-02' and version=1 and not is_cancelled)=1
  and not exists(select 1 from public.idempotency_keys
    where key='FIN04-TRIP-REDATE-BLOCK'),
  'FIN04 failed trip redate preserves original trip and idempotency');

-- The direct INSERT guard intentionally allows a CANCELLED historic record:
-- it has no cash effect. Re-activating it must trigger the UPDATE guard.
-- Reset role to exercise the DB trigger itself, not the direct-write RLS
-- prohibition; production clients still cannot write these rows directly.
reset role;
insert into public.trips(
    id,vehicle_id,counterparty_contractor_id,responsible_contractor_id,
    direction,trip_date,weight_milli_tonnes,contractor_rate_piastres,
    vehicle_rate_piastres,same_rate,expense_piastres,contractor_total_piastres,
    vehicle_total_piastres,is_cancelled,cancel_reason
  ) select 'TR_F4A_CANCELLED_EARLY',vehicle_id,counterparty_contractor_id,
    responsible_contractor_id,direction,'2026-11-01',weight_milli_tonnes,
    contractor_rate_piastres,vehicle_rate_piastres,same_rate,expense_piastres,
    contractor_total_piastres,vehicle_total_piastres,true,
    'FIN04 fixture: historical cancellation'
    from public.trips where id='TR_F4A_FIRST';
select public.app_test_assert(
  (select count(*) from public.trips where id='TR_F4A_CANCELLED_EARLY'
    and is_cancelled and trip_date='2026-11-01')=1,
  'FIN04 cancelled pre-opening fixture is inert');

select public.app_test_expect_error(
  $q$update public.trips set is_cancelled=false,cancel_reason=null,
      cancelled_at=null where id='TR_F4A_CANCELLED_EARLY'$q$,
  'FIN04 cannot uncancel pre-opening trip via UPDATE',array['22023']);
select public.app_test_assert(
  (select count(*) from public.trips where id='TR_F4A_CANCELLED_EARLY'
    and is_cancelled and trip_date='2026-11-01')=1
  and (select count(*) from public.opening_balances where id='OB_F4A_OK'
    and not is_cancelled and start_date='2026-11-02')=1,
  'FIN04 rejected uncancel preserves cancelled row and opening');
set role authenticated;
set "request.jwt.claim.role"='authenticated';
set "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000001';

-- ---------------------------------------------------------------------------
-- Scenario B — an uncancelled PAYMENT before the proposed opening date blocks
-- the opening. The funding trip is cancelled first, so the ONLY uncancelled
-- movement before the proposed start is the payment: the rejection cannot be
-- attributed to an older trip.
--   V_F4_B / K_MOHAMED: trip 2026-11-04 (+10000, then cancelled);
--     payment 2026-11-06 (-5000, stays active).
-- ---------------------------------------------------------------------------
select public.app_op_trip_create('FIN04-TRIP-FUND',
  jsonb_build_object('id','TR_F4B_FUND','vehicle_id','V_F4_B',
    'counterparty_contractor_id','K_MOHAMED','direction','OTHER_SUPPLIES',
    'trip_date','2026-11-04','weight_tonnes','1',
    'contractor_rate_egp','100','vehicle_rate_egp','100','expense_egp','0'));
select public.app_op_payment_create('FIN04-PAY-FIRST',
  jsonb_build_object('id','P_F4B_FIRST','vehicle_id','V_F4_B',
    'responsible_contractor_id','K_MOHAMED','payment_date','2026-11-06',
    'amount_egp','50.00'));
select public.app_op_trip_cancel('FIN04-TRIP-FUND-CANCEL',
  '{"id":"TR_F4B_FUND","expected_version":1,"reason":"FIN04 scenario B isolation: cancel the funding trip so only the payment precedes the opening"}'::jsonb);
select public.app_test_assert(
  (select count(*) from public.trips where id='TR_F4B_FUND' and is_cancelled)=1
  and (select count(*) from public.payments
         where id='P_F4B_FIRST' and not is_cancelled)=1,
  'FIN04 scenario B fixture: funding trip cancelled, payment remains active');

select public.app_test_expect_error(
  $q$select public.app_op_opening_balance_create('FIN04-OPEN-PAYMENT-BLOCK',
    '{"id":"OB_F4B_BAD","balance_type":"VEHICLE_CASH",
    "contractor_id":"K_MOHAMED","vehicle_id":"V_F4_B",
    "start_date":"2026-11-07","signed_piastres":0,"start_mode":"TOTAL"}'::jsonb)$q$,
  'FIN04 rejects opening after an existing uncancelled payment',array['22023']);
select public.app_test_assert(
  not exists(select 1 from public.opening_balances where id='OB_F4B_BAD')
  and not exists(select 1 from public.audit_log
    where entity_type='OPENING_BALANCE' and entity_id='OB_F4B_BAD')
  and not exists(select 1 from public.idempotency_keys where key='FIN04-OPEN-PAYMENT-BLOCK'),
  'FIN04 payment-blocked opening leaves no partial write, audit or idempotency');

-- Same-day boundary: the payment day itself is an allowed opening start,
-- proving the rejection above is caused solely by the payment being strictly
-- earlier (the trip is cancelled and cannot block either attempt).
select public.app_op_opening_balance_create('FIN04-OPEN-SAME-DAY',
  '{"id":"OB_F4B_SAME","balance_type":"VEHICLE_CASH",
  "contractor_id":"K_MOHAMED","vehicle_id":"V_F4_B",
  "start_date":"2026-11-06","signed_piastres":0,"start_mode":"TOTAL"}'::jsonb);
select public.app_test_assert(
  (select count(*) from public.opening_balances where id='OB_F4B_SAME'
    and start_date='2026-11-06')=1,
  'FIN04 accepts opening on the payment day itself');

-- The other responsible contractor account on the same vehicle is independent:
-- its opening is accepted although K_MOHAMED's payment predates it.
select public.app_op_opening_balance_create('FIN04-OPEN-OTHER-ACCOUNT',
  '{"id":"OB_F4B_OTHER","balance_type":"VEHICLE_CASH",
  "contractor_id":"K_AHMED","vehicle_id":"V_F4_B",
  "start_date":"2026-11-01","signed_piastres":0,"start_mode":"TOTAL"}'::jsonb);
select public.app_test_assert(
  (select count(*) from public.opening_balances where id='OB_F4B_OTHER'
    and contractor_id='K_AHMED' and start_date='2026-11-01')=1,
  'FIN04 opening on another responsible account ignores the K_MOHAMED payment');
reset role;
reset "request.jwt.claim.role";
reset "request.jwt.claim.sub";

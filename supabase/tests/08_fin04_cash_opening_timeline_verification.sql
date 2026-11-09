-- FIN-04 isolated account timeline and atomic failure regression.
reset role;
set "request.jwt.claim.role"='authenticated';
set "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000001';
select public.app_test_assert(
  not exists(select 1 from public.opening_balances where
    balance_type='VEHICLE_CASH' and contractor_id='K_MOHAMED' and vehicle_id='V_H48_B'),
  'FIN04 fixture has no earlier opening for responsible cash account');
select public.app_op_trip_create('FIN04-TRIP-FIRST',
  jsonb_build_object('id','TR_FIN04_BEFORE','vehicle_id','V_H48_B',
    'counterparty_contractor_id','K_MOHAMED','direction','OTHER_SUPPLIES',
    'trip_date','2026-11-02','weight_tonnes','1',
    'contractor_rate_egp','100','vehicle_rate_egp','100','expense_egp','0'));

select public.app_test_expect_error(
  $q$select public.app_op_opening_balance_create('FIN04-OPEN-INVALID',
    '{"id":"FIN04_OB_BAD","balance_type":"VEHICLE_CASH",
    "contractor_id":"K_MOHAMED","vehicle_id":"V_H48_B",
    "start_date":"2026-11-03","signed_piastres":"0","start_mode":"TOTAL"}'::jsonb)$q$,
  'FIN04 rejects opening one day after existing cash work',array['22023']);
select public.app_test_assert(
  not exists(select 1 from public.opening_balances where id='FIN04_OB_BAD')
  and not exists(select 1 from public.audit_log where entity_id='FIN04_OB_BAD')
  and not exists(select 1 from public.idempotency_keys where key='FIN04-OPEN-INVALID'),
  'FIN04 failed cash opening has no partial write, audit or idempotency');

select public.app_op_opening_balance_create('FIN04-OPEN-VALID',
  '{"id":"FIN04_OB_OK","balance_type":"VEHICLE_CASH",
  "contractor_id":"K_MOHAMED","vehicle_id":"V_H48_B",
  "start_date":"2026-11-02","signed_piastres":"0","start_mode":"TOTAL"}'::jsonb);
select public.app_test_assert(
  (select count(*) from public.opening_balances where id='FIN04_OB_OK'
    and start_date='2026-11-02')=1,
  'FIN04 accepts account opening on first work day');

-- Exercises the second guard *after* the account lock on a direct isolated
-- trip write; SQL must fail closed even outside the form/pre-lock resolver.
select public.app_test_expect_error(
  $q$insert into public.trips(
    id,vehicle_id,counterparty_contractor_id,responsible_contractor_id,
    direction,trip_date,weight_milli_tonnes,contractor_rate_piastres,
    vehicle_rate_piastres,same_rate,expense_piastres,contractor_total_piastres,
    vehicle_total_piastres
  ) select 'TR_FIN04_TOO_EARLY',vehicle_id,counterparty_contractor_id,
    responsible_contractor_id,direction,'2026-11-01',weight_milli_tonnes,
    contractor_rate_piastres,vehicle_rate_piastres,same_rate,expense_piastres,
    contractor_total_piastres,vehicle_total_piastres
    from public.trips where id='TR_FIN04_BEFORE'$q$,
  'FIN04 trip cannot be saved before opening',array['22023']);
select public.app_test_assert(
  not exists(select 1 from public.trips where id='TR_FIN04_TOO_EARLY'),
  'FIN04 rejected pre-opening trip has no persisted record');
reset "request.jwt.claim.role";
reset "request.jwt.claim.sub";

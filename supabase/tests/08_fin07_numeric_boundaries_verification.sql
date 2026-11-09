-- FIN-07: exact signed bigint movements, unconstrained NUMERIC aggregate.
-- Runs on isolated PGlite after base payment operation fixtures.
select public.app_test_assert(
  public.app_parse_scaled_unsigned('92233720368547758.07',2,'rate')=9223372036854775807::bigint,
  'FIN07 highest valid individual SQL bigint scaled value');
select public.app_test_expect_error(
  $q$select public.app_parse_scaled_unsigned('92233720368547758.08',2,'rate')$q$,
  'FIN07 one piastre above signed SQL bigint',array['22003']);
select public.app_test_expect_error(
  $q$select public.app_trip_totals(1000,9223372036854775807,9223372036854775807,1)$q$,
  'FIN07 individually valid fields produce oversized trip total',array['22003']);
select public.app_test_assert(
  (-9223372036854775808::numeric)::bigint::text='-9223372036854775808',
  'FIN07 signed negative opening extreme is stored by SQL bigint');
insert into public.opening_balances(id,balance_type,contractor_id,vehicle_id,start_date,signed_piastres)
values ('OB_FIN07_LARGE','VEHICLE_CASH','K_AHMED','V_H48_B','2026-11-01',9223372036854775807);
select public.app_test_assert(
  public.app_payment_cash_balance('V_H48_B','K_AHMED','2026-11-05')
    =9223372036854775807::numeric+100000::numeric,
  'FIN07 aggregate SQL NUMERIC exceeds per-record bigint without overflow');

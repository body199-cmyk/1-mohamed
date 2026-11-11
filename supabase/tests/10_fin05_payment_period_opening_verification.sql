-- FIN-05: exact period report boundary and separate current balance.
-- Dedicated fixtures (vehicles V_F5_A / V_F5_B) are created here and shared
-- with no other suite. The V_H48_A / V_H48_B accounts are mutated by the
-- FIN-01/02 and FIN-07 suites in main, so the old expectations for them no
-- longer describe those accounts; these expectations are computed from the
-- explicit fixture scenario written below instead of copied from that state.
reset role;
insert into public.vehicles(id,plate_number) values
 ('V_F5_A','F5 ACCOUNT A'),('V_F5_B','F5 ACCOUNT B');
insert into public.vehicle_accounts(vehicle_id,contractor_id) values
 ('V_F5_A','K_AHMED'),
 ('V_F5_B','K_AHMED'),('V_F5_B','K_MOHAMED');
-- Explicit scenario (all values piastres):
--   V_F5_A / K_AHMED : opening 2026-11-01 +100000;
--                      payment 2026-11-03 -80000; trip due 2026-11-04 +100000.
--                      => 11-01/02: 100000; 11-03: 20000; 11-04+: 120000.
--   V_F5_B / K_AHMED : no opening; trip due 2026-11-03 +100000.
--                      => before 11-03: 0; current: 100000.
--   V_F5_B / K_MOHAMED: no opening; trip due 2026-11-02 +10000.
--                      => before 11-02: 0; 11-02+: 10000.
insert into public.opening_balances(id,balance_type,contractor_id,vehicle_id,start_date,signed_piastres)
values ('OB_F5A','VEHICLE_CASH','K_AHMED','V_F5_A','2026-11-01'::date,100000);
set role authenticated;
set "request.jwt.claim.role"='authenticated';
set "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000001';

select public.app_op_payment_create('FIN05-PAY-A',
  jsonb_build_object('id','P_F5A_OUT','vehicle_id','V_F5_A',
    'responsible_contractor_id','K_AHMED','payment_date','2026-11-03',
    'amount_egp','800.00'));
select public.app_op_trip_create('FIN05-TRIP-A',
  jsonb_build_object('id','TR_F5A_DUE','vehicle_id','V_F5_A',
    'counterparty_contractor_id','K_MOHAMED','direction','AHMED_SUPPLIES',
    'trip_date','2026-11-04','weight_tonnes','10',
    'contractor_rate_egp','100','vehicle_rate_egp','100','expense_egp','0'));
select public.app_op_trip_create('FIN05-TRIP-B-AHMED',
  jsonb_build_object('id','TR_F5B_AHMED','vehicle_id','V_F5_B',
    'counterparty_contractor_id','K_MOHAMED','direction','AHMED_SUPPLIES',
    'trip_date','2026-11-03','weight_tonnes','10',
    'contractor_rate_egp','100','vehicle_rate_egp','100','expense_egp','0'));
select public.app_op_trip_create('FIN05-TRIP-B-MOHAMED',
  jsonb_build_object('id','TR_F5B_MOHAMED','vehicle_id','V_F5_B',
    'counterparty_contractor_id','K_MOHAMED','direction','OTHER_SUPPLIES',
    'trip_date','2026-11-02','weight_tonnes','1',
    'contractor_rate_egp','100','vehicle_rate_egp','100','expense_egp','0'));

do $fin05$
declare
 v jsonb;
begin
 -- Opening day: the seed belongs to the initial balance once, never twice.
 v:=public.app_op_payments_read('{"vehicle_id":"V_F5_A",
   "responsible_contractor_id":"K_AHMED",
   "date_from":"2026-11-01","date_to":"2026-11-01"}'::jsonb);
 perform public.app_test_assert(
   v->>'period_opening_piastres'='100000'
   and v->>'period_closing_piastres'='100000'
   and v->>'cash_balance_piastres'=v->>'current_cash_balance_piastres'
   and v->>'current_cash_balance_piastres'='120000',
   'FIN05 exact cash opening day is 1000; period closing differs from current balance');

 -- Later period: carries the prior balance, counts the payment once, and the
 -- historical closing stays distinct from the current balance.
 v:=public.app_op_payments_read('{"vehicle_id":"V_F5_A",
   "responsible_contractor_id":"K_AHMED",
   "date_from":"2026-11-03","date_to":"2026-11-03"}'::jsonb);
 perform public.app_test_assert(
   v->>'period_opening_piastres'='100000'
   and v->>'period_closing_piastres'='20000'
   and v->>'current_cash_balance_piastres'='120000',
   'FIN05 day after opening carries prior balance and payment once');

 -- Account without an opening: its earlier period is zero and independent,
 -- even though the same vehicle serves another responsible contractor.
 v:=public.app_op_payments_read('{"vehicle_id":"V_F5_B",
   "responsible_contractor_id":"K_AHMED",
   "date_from":"2026-11-01","date_to":"2026-11-02"}'::jsonb);
 perform public.app_test_assert(
   v->>'period_opening_piastres'='0'
   and v->>'period_closing_piastres'='0'
   and v->>'current_cash_balance_piastres'='100000',
   'FIN05 cash account with no opening has independent zero earlier period');

 -- Legacy unfiltered payment list remains usable.
 v:=public.app_op_payments_read('{"vehicle_id":"V_F5_A",
   "responsible_contractor_id":"K_AHMED"}'::jsonb);
 perform public.app_test_assert(v->>'status'='OK'
   and v->>'cash_balance_piastres'='120000',
   'FIN05 unfiltered legacy payment list remains usable');

 -- Distinct responsible contractor account stays separate.
 v:=public.app_op_payments_read('{"vehicle_id":"V_F5_B",
   "responsible_contractor_id":"K_MOHAMED",
   "date_from":"2026-11-02","date_to":"2026-11-02"}'::jsonb);
 perform public.app_test_assert(
   v->>'period_opening_piastres'='0' and v->>'period_closing_piastres'='10000',
   'FIN05 distinct responsible contractor account remains separate');
end $fin05$;

select public.app_test_expect_error(
 $q$select public.app_op_payments_read('{"vehicle_id":"V_F5_A",
  "responsible_contractor_id":"K_AHMED",
  "date_from":"2026-10-31","date_to":"2026-11-01"}'::jsonb)$q$,
 'FIN05 explicitly scoped report before cash opening is rejected',array['22023']);
reset role;
reset "request.jwt.claim.role";
reset "request.jwt.claim.sub";

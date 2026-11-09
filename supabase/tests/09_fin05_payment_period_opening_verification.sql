-- FIN-05: exact period report boundary and separate current balance.
reset role;
set "request.jwt.claim.role"='authenticated';
set "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000001';
do $fin05$
declare
 v jsonb;
begin
 v:=public.app_op_payments_read('{"vehicle_id":"V_H48_A",
   "responsible_contractor_id":"K_AHMED",
   "date_from":"2026-11-01","date_to":"2026-11-01"}'::jsonb);
 perform public.app_test_assert(
   v->>'period_opening_piastres'='100000'
   and v->>'period_closing_piastres'='100000'
   and v->>'cash_balance_piastres'=v->>'current_cash_balance_piastres'
   and v->>'current_cash_balance_piastres'='120000',
   'FIN05 exact cash opening day is 1000; period closing differs from current balance');

 v:=public.app_op_payments_read('{"vehicle_id":"V_H48_A",
   "responsible_contractor_id":"K_AHMED",
   "date_from":"2026-11-03","date_to":"2026-11-03"}'::jsonb);
 perform public.app_test_assert(
   v->>'period_opening_piastres'='100000'
   and v->>'period_closing_piastres'='20000'
   and v->>'current_cash_balance_piastres'='120000',
   'FIN05 day after opening carries prior balance and payment once');

 v:=public.app_op_payments_read('{"vehicle_id":"V_H48_B",
   "responsible_contractor_id":"K_AHMED",
   "date_from":"2026-11-01","date_to":"2026-11-02"}'::jsonb);
 perform public.app_test_assert(
   v->>'period_opening_piastres'='0'
   and v->>'period_closing_piastres'='0'
   and v->>'current_cash_balance_piastres'='100000',
   'FIN05 cash account with no opening has independent zero earlier period');

 v:=public.app_op_payments_read('{"vehicle_id":"V_H48_A",
   "responsible_contractor_id":"K_AHMED"}'::jsonb);
 perform public.app_test_assert(v->>'status'='OK',
   'FIN05 unfiltered legacy payment list remains usable');

 v:=public.app_op_payments_read('{"vehicle_id":"V_H48_B",
   "responsible_contractor_id":"K_MOHAMED",
   "date_from":"2026-11-02","date_to":"2026-11-02"}'::jsonb);
 perform public.app_test_assert(
   v->>'period_opening_piastres'='0' and v->>'period_closing_piastres'='10000',
   'FIN05 distinct responsible contractor account remains separate');
end $fin05$;

select public.app_test_expect_error(
 $q$select public.app_op_payments_read('{"vehicle_id":"V_H48_A",
  "responsible_contractor_id":"K_AHMED",
  "date_from":"2026-10-31","date_to":"2026-11-01"}'::jsonb)$q$,
 'FIN05 explicitly scoped report before cash opening is rejected',array['22023']);
reset "request.jwt.claim.role";
reset "request.jwt.claim.sub";

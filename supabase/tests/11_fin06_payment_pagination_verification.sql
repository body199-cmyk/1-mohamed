-- FIN-06: full historical payment pagination without losing or duplicating rows.
reset role;
insert into public.vehicles(id,plate_number) values ('V_F6_PAGE','FIN06 PAGINATION');
insert into public.vehicle_accounts(vehicle_id,contractor_id)
values ('V_F6_PAGE','K_AHMED');
insert into public.opening_balances(id,balance_type,contractor_id,vehicle_id,start_date,signed_piastres)
values ('OB_F6_PAGE','VEHICLE_CASH','K_AHMED','V_F6_PAGE','2026-11-01',1000000);
set role authenticated;
set "request.jwt.claim.role"='authenticated';
set "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000001';

select public.app_op_payment_create('FIN06-PAY-01',jsonb_build_object(
 'id','P_F6_01','vehicle_id','V_F6_PAGE','responsible_contractor_id','K_AHMED',
 'payment_date','2026-11-02','amount_egp','100.00'));
select public.app_op_payment_create('FIN06-PAY-02',jsonb_build_object(
 'id','P_F6_02','vehicle_id','V_F6_PAGE','responsible_contractor_id','K_AHMED',
 'payment_date','2026-11-03','amount_egp','100.00'));
select public.app_op_payment_create('FIN06-PAY-03',jsonb_build_object(
 'id','P_F6_03','vehicle_id','V_F6_PAGE','responsible_contractor_id','K_AHMED',
 'payment_date','2026-11-04','amount_egp','100.00'));

do $fin06$
declare
 v_first jsonb;
 v_second jsonb;
 v_again jsonb;
 v_params jsonb := '{"vehicle_id":"V_F6_PAGE","responsible_contractor_id":"K_AHMED",
  "date_from":"2026-11-01","date_to":"2026-11-05","limit":2}'::jsonb;
begin
 v_first:=public.app_op_payments_read(v_params);
 perform public.app_test_assert(
   v_first->>'status'='OK' and (v_first->>'total_count')::integer=3
   and jsonb_array_length(v_first->'rows')=2
   and v_first->'rows'->0->>'id'='P_F6_03'
   and v_first->'rows'->1->>'id'='P_F6_02'
   and v_first->'next_cursor'->>'id'='P_F6_02',
   'FIN06 first page returns latest two with a stable cursor');

 v_second:=public.app_op_payments_read(v_params ||
   jsonb_build_object('cursor',v_first->'next_cursor'));
 perform public.app_test_assert(
   jsonb_array_length(v_second->'rows')=1
   and v_second->'rows'->0->>'id'='P_F6_01'
   and v_second->'next_cursor'='null'::jsonb
   and v_second->>'period_opening_piastres'='1000000'
   and v_second->>'period_closing_piastres'='970000'
   and v_second->>'cash_balance_piastres'='970000',
   'FIN06 second page returns remaining payment and preserves FIN05 balances');

 v_again:=public.app_op_payments_read(v_params);
 perform public.app_test_assert(
   v_first=v_again and
   (select count(*) from public.payments where id like 'P_F6_%')=3,
   'FIN06 deterministic repeat does not mutate the ledger');

 perform public.app_test_assert(
   not has_function_privilege('anon','public.app_op_payments_read(jsonb)','EXECUTE')
   and has_function_privilege('authenticated','public.app_op_payments_read(jsonb)','EXECUTE'),
   'FIN06 payment report retains owner-only access boundary');
end $fin06$;

select public.app_test_expect_error(
 $q$select public.app_op_payments_read('{"vehicle_id":"V_F6_PAGE",
 "responsible_contractor_id":"K_AHMED","cursor":{"date":"2026-11-04"}}'::jsonb)$q$,
 'FIN06 partial cursor rejected',array['22023']);

reset role;
reset "request.jwt.claim.role";
reset "request.jwt.claim.sub";

-- Financial acceptance: owner's explicit inclusion/exclusion of historical work
-- changes ONLY the contractor's opening interpretation, not trip facts.
begin;
reset role;
insert into public.contractors(id,name) values
 ('OPT_INC_K','Opening included'),('OPT_EXC_K','Opening excluded');
insert into public.vehicles(id,plate_number) values
 ('OPT_INC_V','OPT-INC-1'),('OPT_EXC_V','OPT-EXC-1');
insert into public.vehicle_accounts(vehicle_id,contractor_id)
select v.id,c.id from public.vehicles v cross join public.contractors c
where v.id in ('OPT_INC_V','OPT_EXC_V') and c.is_primary;
insert into public.trips(
 id,vehicle_id,counterparty_contractor_id,responsible_contractor_id,
 direction,trip_date,weight_milli_tonnes,contractor_rate_piastres,
 vehicle_rate_piastres,same_rate,expense_piastres,
 contractor_total_piastres,vehicle_total_piastres)
select x.id,x.vehicle,x.con,m.responsible,x.direction,x.day::date,
 1000,x.rate,x.rate,true,0,x.rate,x.rate
from (
 values
 ('OPT_INC_T1','OPT_INC_V','OPT_INC_K','AHMED_SUPPLIES','2026-10-01',10000),
 ('OPT_INC_T2','OPT_INC_V','OPT_INC_K','OTHER_SUPPLIES','2026-10-02',3000),
 ('OPT_EXC_T1','OPT_EXC_V','OPT_EXC_K','AHMED_SUPPLIES','2026-10-01',10000),
 ('OPT_EXC_T2','OPT_EXC_V','OPT_EXC_K','OTHER_SUPPLIES','2026-10-02',3000)
) as x(id,vehicle,con,direction,day,rate)
join (select id as responsible from public.contractors where is_primary) m on true;
set local role authenticated;
set local "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000001';
set local "request.jwt.claim.role"='authenticated';
select public.app_op_opening_balance_create('OPTION-INC-OPEN',
 '{"id":"OPT_INC_OB","balance_type":"CONTRACTOR_WORK",
 "contractor_id":"OPT_INC_K","start_date":"2026-11-01",
 "signed_piastres":15000,"start_mode":"TOTAL",
 "prior_work_handling":"INCLUDED"}'::jsonb);
select public.app_op_opening_balance_create('OPTION-EXC-OPEN',
 '{"id":"OPT_EXC_OB","balance_type":"CONTRACTOR_WORK",
 "contractor_id":"OPT_EXC_K","start_date":"2026-11-01",
 "signed_piastres":15000,"start_mode":"TOTAL",
 "prior_work_handling":"EXCLUDED"}'::jsonb);

select public.app_test_assert(
 (select prior_work_handling='INCLUDED' from public.opening_balances where id='OPT_INC_OB')
 and (select prior_work_handling='EXCLUDED' from public.opening_balances where id='OPT_EXC_OB'),
 'Owner choice is persisted separately from immutable trip history');
do $$
declare i jsonb;e jsonb;
begin
 i:=public.app_op_contractor_statement_read(
  '{"counterparty_contractor_id":"OPT_INC_K","date_from":"2026-11-01","date_to":"2026-11-03"}');
 e:=public.app_op_contractor_statement_read(
  '{"counterparty_contractor_id":"OPT_EXC_K","date_from":"2026-11-01","date_to":"2026-11-03"}');
 perform public.app_test_assert(
  i->>'opening_balance_piastres'='15000'
  and e->>'opening_balance_piastres'='22000'
  and i->>'closing_balance_piastres'='15000'
  and e->>'closing_balance_piastres'='22000'
  and i->>'total_count'='0' and e->>'total_count'='0',
  'INCLUDED=150 EGP, EXCLUDED=150+100-30=220 EGP exactly once');
end;$$;
reset role;
insert into public.trips(id,vehicle_id,counterparty_contractor_id,
 responsible_contractor_id,direction,trip_date,weight_milli_tonnes,
 contractor_rate_piastres,vehicle_rate_piastres,same_rate,expense_piastres,
 contractor_total_piastres,vehicle_total_piastres)
select 'OPT_EXC_NEW','OPT_EXC_V','OPT_EXC_K',id,
 'AHMED_SUPPLIES','2026-11-02',1000,5000,5000,true,0,5000,5000
from public.contractors where is_primary;
set local role authenticated;
set local "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000001';
set local "request.jwt.claim.role"='authenticated';
select public.app_test_assert(
 public.app_op_contractor_statement_read(
 '{"counterparty_contractor_id":"OPT_EXC_K","date_from":"2026-11-01","date_to":"2026-11-03"}')
 ->>'closing_balance_piastres'='27000',
 'Current-period work increases the EXCLUDED opening once');
select public.app_test_expect_error(
 $q$select public.app_op_opening_balance_create('OPTION-BAD-MODE',
 '{"id":"OPT_BAD_OB","balance_type":"CONTRACTOR_WORK",
 "contractor_id":"OPT_INC_K","start_date":"2026-11-01",
 "signed_piastres":15000,"prior_work_handling":"UNSPECIFIED"}')$q$,
 'Invalid historical policy rejected',array['22023']);
select public.app_test_expect_error(
 $q$select public.app_op_opening_balance_create('OPTION-BAD-CASH',
 '{"id":"OPT_BAD_CASH","balance_type":"VEHICLE_CASH",
 "contractor_id":"OPT_EXC_K","vehicle_id":"OPT_EXC_V",
 "start_date":"2026-11-01","signed_piastres":15000,
 "prior_work_handling":"EXCLUDED"}')$q$,
 'Cash opening cannot bypass FIN-04 movement boundaries',array['22023']);
select public.app_test_expect_error(
 $q$insert into public.trips(id,vehicle_id,counterparty_contractor_id,
 responsible_contractor_id,direction,trip_date,weight_milli_tonnes,
 contractor_rate_piastres,vehicle_rate_piastres,same_rate,expense_piastres,
 contractor_total_piastres,vehicle_total_piastres)
 select 'OPT_EXC_BACKDATE','OPT_EXC_V','OPT_EXC_K',id,
 'AHMED_SUPPLIES','2026-10-04',1000,10000,10000,true,0,10000,10000
 from public.contractors where is_primary$q$,
 'EXCLUDED policy does not bypass backdated work protection',array['P2021']);
rollback;

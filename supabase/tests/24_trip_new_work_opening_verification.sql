-- D04 regression: no newly inserted/backdated active work may disappear
-- behind a contractor-work TOTAL opening. Entire fixture rolls back.
begin;
reset role;

insert into public.contractors(id,name) values ('NEW_CUT_K','New cutoff contractor');
insert into public.vehicles(id,plate_number) values ('NEW_CUT_V','NEW-CUT-101');
insert into public.vehicle_accounts(vehicle_id,contractor_id)
select 'NEW_CUT_V',id from public.contractors
 where is_primary or id='NEW_CUT_K';

-- Historical work recorded before choosing a TOTAL cutover stays intact.
insert into public.trips(
 id,vehicle_id,counterparty_contractor_id,responsible_contractor_id,
 direction,trip_date,weight_milli_tonnes,contractor_rate_piastres,
 vehicle_rate_piastres,same_rate,expense_piastres,
 contractor_total_piastres,vehicle_total_piastres
)
select 'NEW_CUT_OLD','NEW_CUT_V','NEW_CUT_K',id,
 'AHMED_SUPPLIES',date '2026-01-02',1000,10000,
 8000,false,0,10000,8000
from public.contractors where is_primary;

insert into public.opening_balances(
 id,balance_type,contractor_id,start_date,signed_piastres
) values ('NEW_CUT_OPEN','CONTRACTOR_WORK','NEW_CUT_K',
 date '2026-01-03',1000);

select public.app_test_expect_error(
 $q$insert into public.trips(
 id,vehicle_id,counterparty_contractor_id,responsible_contractor_id,
 direction,trip_date,weight_milli_tonnes,contractor_rate_piastres,
 vehicle_rate_piastres,same_rate,expense_piastres,
 contractor_total_piastres,vehicle_total_piastres
 ) select 'NEW_CUT_BEFORE_A','NEW_CUT_V','NEW_CUT_K',id,
 'AHMED_SUPPLIES',date '2026-01-02',1000,10000,
 8000,false,0,10000,8000
 from public.contractors where is_primary$q$,
 'A newly entered Ahmed-supplied trip before work opening is rejected',array['P2021']);

select public.app_test_expect_error(
 $q$insert into public.trips(
 id,vehicle_id,counterparty_contractor_id,responsible_contractor_id,
 direction,trip_date,weight_milli_tonnes,contractor_rate_piastres,
 vehicle_rate_piastres,same_rate,expense_piastres,
 contractor_total_piastres,vehicle_total_piastres
 ) values ('NEW_CUT_BEFORE_B','NEW_CUT_V','NEW_CUT_K','NEW_CUT_K',
 'OTHER_SUPPLIES',date '2026-01-02',1000,10000,
 8000,false,0,10000,8000)$q$,
 'A newly entered counterparty-supplied trip before work opening is rejected',array['P2021']);

-- Opening day remains a valid active work date.
insert into public.trips(
 id,vehicle_id,counterparty_contractor_id,responsible_contractor_id,
 direction,trip_date,weight_milli_tonnes,contractor_rate_piastres,
 vehicle_rate_piastres,same_rate,expense_piastres,
 contractor_total_piastres,vehicle_total_piastres
) values (
 'NEW_CUT_SAME','NEW_CUT_V','NEW_CUT_K','NEW_CUT_K',
 'OTHER_SUPPLIES',date '2026-01-03',1000,10000,8000,false,0,10000,8000
);

select public.app_test_expect_error(
 $q$update public.trips set trip_date=date '2026-01-02'
   where id='NEW_CUT_SAME'$q$,
 'Backdating an active trip into the work opening is rejected',array['P2021']);

select public.app_test_assert(
 (select count(*)=2 from public.trips where counterparty_contractor_id='NEW_CUT_K')
 and (select trip_date=date '2026-01-03'
      from public.trips where id='NEW_CUT_SAME')
 and (select trip_date=date '2026-01-02'
      from public.trips where id='NEW_CUT_OLD'),
 'Rejected inserts and update leave original business records intact');

-- The TOTAL cutover includes only work from the opening day onward.
set local role authenticated;
set local "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000001';
set local "request.jwt.claim.role"='authenticated';
select public.app_test_assert(
 public.app_op_contractor_statement_read(
  '{"counterparty_contractor_id":"NEW_CUT_K","date_from":"2026-01-03","date_to":"2026-01-03"}'
 )->>'closing_balance_piastres'='-9000',
 'Opening seed plus opening-day negative work exactly once; prior history excluded');
rollback;

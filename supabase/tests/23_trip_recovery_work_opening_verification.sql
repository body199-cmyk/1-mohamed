begin;
reset role;

insert into public.contractors(id,name) values ('REC_WORK','Recovery Work Counterparty');
insert into public.vehicles(id,plate_number) values ('REC_WORK_V','REC-4321');
insert into public.vehicle_accounts(vehicle_id,contractor_id)
select 'REC_WORK_V', id from public.contractors where is_primary or id='REC_WORK';
insert into public.trips(
  id, vehicle_id, counterparty_contractor_id, responsible_contractor_id, direction,
  trip_date, weight_milli_tonnes, contractor_rate_piastres, vehicle_rate_piastres,
  same_rate, expense_piastres, contractor_total_piastres, vehicle_total_piastres,
  is_cancelled, cancel_reason, cancelled_at, version
)
select f.id, 'REC_WORK_V', 'REC_WORK', case when f.ahmed then c.id else 'REC_WORK' end,
  case when f.ahmed then 'AHMED_SUPPLIES' else 'OTHER_SUPPLIES' end,
  f.trip_date, 1000, 10000, 8000, false, 0, 10000, 8000, true, 'Cancelled', now(), 2
from public.contractors c
cross join (values
  ('REC_WORK_OLD_A', true, date '2026-01-02'), ('REC_WORK_OLD_B', false, date '2026-01-02'),
  ('REC_WORK_SAME_A', true, date '2026-01-03'), ('REC_WORK_SAME_B', false, date '2026-01-03'),
  ('REC_WORK_CASH_BLOCKED', true, date '2026-01-01')
) as f(id, ahmed, trip_date)
where c.is_primary;

set local role authenticated;
set local "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000001';
set local "request.jwt.claim.role"='authenticated';

select public.app_op_opening_balance_create('REC-WORK-OPENING',
  '{"id":"REC_WORK_OPEN","contractor_id":"REC_WORK","balance_type":"CONTRACTOR_WORK",
    "start_date":"2026-01-03","start_mode":"TOTAL","signed_piastres":1000}');
select public.app_op_opening_balance_create('REC-WORK-CASH-OPENING', jsonb_build_object(
  'id','REC_WORK_CASH_OPEN','contractor_id',(select id from public.contractors where is_primary),
  'vehicle_id','REC_WORK_V','balance_type','VEHICLE_CASH','start_date','2026-01-02',
  'start_mode','TOTAL','signed_piastres',0));

select public.app_test_expect_error(
  $q$select public.app_op_trip_reactivate('REC-WORK-OLD-A',
    '{"id":"REC_WORK_OLD_A","expected_version":2,"reason":"Restore original"}')$q$,
  'Recovery respects the work counterparty opening when Ahmed supplied',array['P2020']);
select public.app_test_expect_error(
  $q$select public.app_op_trip_reactivate('REC-WORK-OLD-B',
    '{"id":"REC_WORK_OLD_B","expected_version":2,"reason":"Restore original"}')$q$,
  'Recovery respects the work counterparty opening when the other contractor supplied',array['P2020']);
select public.app_test_expect_error(
  $q$select public.app_op_trip_reactivate('REC-WORK-CASH-BLOCKED',
    '{"id":"REC_WORK_CASH_BLOCKED","expected_version":2,"reason":"Restore original"}')$q$,
  'Recovery still respects the earlier cash-opening trigger',array['22023']);

select public.app_test_assert(
  (select count(*)=5 from public.trips
     where vehicle_id='REC_WORK_V' and is_cancelled and version=2
       and cancel_reason='Cancelled' and cancelled_at is not null)
  and not exists (select 1 from public.audit_log where entity_id like 'REC_WORK_%' and entity_type='TRIP')
  and not exists (select 1 from public.idempotency_keys where key in
    ('REC-WORK-OLD-A','REC-WORK-OLD-B','REC-WORK-CASH-BLOCKED')),
  'Rejected recoveries preserve the original rows and leave no audit or replay entry');

do $checks$
declare
  primary_id text := (select id from public.contractors where is_primary);
  trip_ids text[] := array['REC_WORK_SAME_A','REC_WORK_SAME_B'];
  trip_id text;
  response jsonb;
  payload jsonb;
  work_query jsonb := '{"counterparty_contractor_id":"REC_WORK","date_from":"2026-01-03","date_to":"2026-01-03"}';
  cash_query jsonb := '{"vehicle_id":"REC_WORK_V","date_from":"2026-01-03","date_to":"2026-01-03"}';
  expected_balance text := '11000';
begin
  foreach trip_id in array trip_ids loop
    payload := jsonb_build_object('id',trip_id,'expected_version',2,'reason','Restore opening-day work');
    response := public.app_op_trip_reactivate(trip_id,payload);
    perform public.app_test_assert(response->>'trip_id'=trip_id and response->>'version'='3'
      and response=public.app_op_trip_reactivate(trip_id,payload), 'Same-day recovery retains ID and replays safely');
    perform public.app_test_assert(
      public.app_op_report_read('contractor.statement',work_query)->>'closing_balance_piastres'=expected_balance,
      'Contractor statement reflects opening-day recovery with correct sign');
    expected_balance := '1000';
  end loop;
  perform public.app_test_assert(
    public.app_op_report_read('cash.statement',cash_query||jsonb_build_object('responsible_contractor_id',primary_id))->>'work_piastres'='8000'
    and public.app_op_report_read('cash.statement',cash_query||'{"responsible_contractor_id":"REC_WORK"}')->>'work_piastres'='8000',
    'Cash statements show each recovered trip once on its original responsible account');
end $checks$;
rollback;

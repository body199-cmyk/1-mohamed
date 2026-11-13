-- PRE-LIVE-03: contractor settlement is signed, exact, paginated, and
-- independent of vehicle cash. Fixtures are isolated from all older suites.
reset role;
insert into public.contractors(id,name) values ('K_STMT_PRELIVE','Statement Test Contractor');
insert into public.vehicles(id,plate_number) values ('V_STMT_PRELIVE','STMT TEST');
insert into public.vehicle_accounts(vehicle_id,contractor_id) values
  ('V_STMT_PRELIVE','K_AHMED'),('V_STMT_PRELIVE','K_STMT_PRELIVE');
insert into public.opening_balances(
  id,balance_type,contractor_id,start_date,signed_piastres)
values ('OB_STMT_PRELIVE','CONTRACTOR_WORK','K_STMT_PRELIVE','2026-01-01',10000);

set role authenticated;
set "request.jwt.claim.role"='authenticated';
set "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000001';

select public.app_op_trip_create('PRELIVE-STMT-TR1',
 '{"id":"TR_STMT_1","vehicle_id":"V_STMT_PRELIVE",
 "counterparty_contractor_id":"K_STMT_PRELIVE","direction":"AHMED_SUPPLIES",
 "trip_date":"2026-01-02","weight_tonnes":"1","contractor_rate_egp":"100",
 "vehicle_rate_egp":"100","expense_egp":"0","origin":"Cairo","destination":"Suez"}'::jsonb);
select public.app_op_trip_create('PRELIVE-STMT-TR2',
 '{"id":"TR_STMT_2","vehicle_id":"V_STMT_PRELIVE",
 "counterparty_contractor_id":"K_STMT_PRELIVE","direction":"OTHER_SUPPLIES",
 "trip_date":"2026-01-03","weight_tonnes":"2","contractor_rate_egp":"100",
 "vehicle_rate_egp":"100","expense_egp":"0"}'::jsonb);
select public.app_op_trip_create('PRELIVE-STMT-TR3',
 '{"id":"TR_STMT_3","vehicle_id":"V_STMT_PRELIVE",
 "counterparty_contractor_id":"K_STMT_PRELIVE","direction":"AHMED_SUPPLIES",
 "trip_date":"2026-01-04","weight_tonnes":"1","contractor_rate_egp":"100",
 "vehicle_rate_egp":"100","expense_egp":"0"}'::jsonb);

do $statement$
declare
  v_base jsonb := '{"counterparty_contractor_id":"K_STMT_PRELIVE",
    "date_from":"2026-01-03","date_to":"2026-01-04","limit":1}'::jsonb;
  v_first jsonb;
  v_second jsonb;
  v_full jsonb;
begin
  perform public.app_test_assert(
    has_function_privilege('authenticated','public.app_op_contractor_statement_read(jsonb)','EXECUTE')
    and not has_function_privilege('anon','public.app_op_contractor_statement_read(jsonb)','EXECUTE'),
    'PRE-LIVE statement grants authenticated only, owner check inside RPC');
  v_first := public.app_op_contractor_statement_read(v_base);
  v_second := public.app_op_contractor_statement_read(
    v_base || jsonb_build_object('cursor',v_first->'next_cursor'));
  perform public.app_test_assert(
    v_first->>'opening_balance_piastres'='20000'
    and v_first->>'ahmed_work_piastres'='10000'
    and v_first->>'counterparty_work_piastres'='20000'
    and v_first->>'closing_balance_piastres'='10000'
    and v_first->>'beneficiary'='AHMED'
    and v_first->>'total_count'='2',
    'PRE-LIVE opening + Ahmed work - other work is correct for selected period');
  perform public.app_test_assert(
    v_first->'rows'->0->>'id'='TR_STMT_2'
    and v_first->'rows'->0->>'signed_delta_piastres'='-20000'
    and v_first->'rows'->0->>'running_balance_piastres'='0'
    and v_first->'next_cursor' is not null
    and v_second->'rows'->0->>'id'='TR_STMT_3'
    and v_second->'rows'->0->>'running_balance_piastres'='10000'
    and v_second->'next_cursor'='null'::jsonb,
    'PRE-LIVE keyset pages retain full-period running balances and stable order');
  perform public.app_test_assert(
    v_second->>'opening_balance_piastres'=v_first->>'opening_balance_piastres'
    and v_second->>'closing_balance_piastres'=v_first->>'closing_balance_piastres',
    'PRE-LIVE totals are never computed from the current page alone');

  v_full := public.app_op_contractor_statement_read(
    '{"counterparty_contractor_id":"K_STMT_PRELIVE",
      "date_from":"2026-01-01","date_to":"2026-01-04","limit":200}'::jsonb);
  perform public.app_test_assert(
    v_full->>'opening_balance_piastres'='10000'
    and v_full->>'ahmed_work_piastres'='20000'
    and v_full->>'counterparty_work_piastres'='20000'
    and v_full->>'closing_balance_piastres'='10000'
    and v_full->>'total_count'='3',
    'PRE-LIVE original dated opening is included once in full statement');
end;
$statement$;

select public.app_test_expect_error(
  $q$select public.app_op_contractor_statement_read(
    '{"counterparty_contractor_id":"K_STMT_PRELIVE",
      "date_from":"2025-12-31","date_to":"2026-01-04"}'::jsonb)$q$,
  'PRE-LIVE reject report before dated opening',array['22023']);
select public.app_test_expect_error(
  $q$select public.app_op_contractor_statement_read(
    '{"counterparty_contractor_id":"K_AHMED",
      "date_from":"2026-01-01","date_to":"2026-01-04"}'::jsonb)$q$,
  'PRE-LIVE reject primary contractor as counterparty',array['22023']);
select public.app_test_expect_error(
  $q$select public.app_op_contractor_statement_read(
    '{"counterparty_contractor_id":"K_STMT_PRELIVE",
      "date_from":"2026-01-01","date_to":"2026-01-04",
      "cursor":{"date":"2026-01-02"}}'::jsonb)$q$,
  'PRE-LIVE reject incomplete cursor',array['22023']);

select public.app_op_trip_cancel('PRELIVE-STMT-CANCEL',
 '{"id":"TR_STMT_3","expected_version":1,"reason":"Audit cancellation"}'::jsonb);

do $after_cancel$
declare
  v jsonb;
begin
  v := public.app_op_contractor_statement_read(
    '{"counterparty_contractor_id":"K_STMT_PRELIVE",
      "date_from":"2026-01-03","date_to":"2026-01-04"}'::jsonb);
  perform public.app_test_assert(
    v->>'closing_balance_piastres'='0'
    and v->>'beneficiary'='BALANCED'
    and v->>'total_count'='1'
    and v->'rows'->0->>'id'='TR_STMT_2',
    'PRE-LIVE cancelled trip is excluded and statement balances reconcile');
end;
$after_cancel$;

reset role;
set role authenticated;
set "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000001';
select public.app_op_payment_create('CLOSEOUT-CASH-PAY1',
 '{"id":"PAY_CLOSEOUT_1","vehicle_id":"V_STMT_PRELIVE","responsible_contractor_id":"K_AHMED",
   "payment_date":"2026-01-02","amount_egp":"40"}'::jsonb);
do $checks$
declare
  q jsonb := '{"vehicle_id":"V_STMT_PRELIVE","responsible_contractor_id":"K_AHMED","date_from":"2026-01-02","date_to":"2026-01-04","limit":1}';
  a jsonb; b jsonb; t jsonb;
begin
  a := public.app_op_report_read('cash.statement',q);
  b := public.app_op_report_read('cash.statement',q||jsonb_build_object('cursor',a->'next_cursor','snapshot',a->>'snapshot'));
  perform public.app_test_assert(a->>'work_piastres'='10000' and a->>'paid_piastres'='4000'
    and a->>'period_opening_piastres'='0' and a->>'period_closing_piastres'='6000'
    and a->>'total_count'='2','Cash statement includes only responsible active work and actual payments');
  perform public.app_test_assert(a->'rows'->0->>'movement_type'='WORK'
    and a->'rows'->0->>'running_balance_piastres'='10000'
    and b->'rows'->0->>'movement_type'='PAYMENT'
    and b->'rows'->0->>'running_balance_piastres'='6000'
    and b->'next_cursor'='null'::jsonb,'D15 work precedes same-day payments across page boundary');
  t := public.app_op_report_read('trips.list',q||'{"counterparty_contractor_id":"K_STMT_PRELIVE","include_cancelled":true}'::jsonb);
  perform public.app_test_assert(t->>'total_count'='3' and t->'totals'->>'active_count'='2'
    and t->'totals'->>'contractor_total_piastres'='30000'
    and t->'totals'->>'weight_milli_tonnes'='3000','SQL work totals exclude cancelled rows even when visible');
  perform public.app_op_payment_update('CLOSEOUT-PAY-EDIT',
    '{"id":"PAY_CLOSEOUT_1","expected_version":1,"vehicle_id":"V_STMT_PRELIVE",
      "responsible_contractor_id":"K_AHMED","payment_date":"2026-01-02","amount_egp":"40",
      "notes":"metadata-only change","reason":"Snapshot regression"}'::jsonb);
  begin
    perform public.app_op_report_read('cash.statement',q||jsonb_build_object('cursor',a->'next_cursor','snapshot',a->>'snapshot'));
    raise exception 'Stale report accepted';
  exception when serialization_failure then null; end;
  perform public.app_test_assert(not has_function_privilege('anon','public.app_op_report_read(text,jsonb)','EXECUTE'),
    'Report wrapper is never callable anonymously');
end;
$checks$;
select public.app_test_expect_error($q$select public.app_op_report_read('sql.execute','{}')$q$,'No arbitrary RPC dispatch',array['22023']);
select public.app_test_expect_error($q$select public.app_op_report_read('trips.list','{"cursor":{"date":"2026-01-02","id":"x"}}')$q$,'Cursor requires snapshot',array['40001']);
set "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000002';
select public.app_test_expect_error($q$select public.app_op_report_read('trips.list','{}')$q$,'Non-owner cannot read reports',array['42501']);
set "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000001';

begin;
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';

do $test$
declare
  v_trip jsonb := jsonb_build_object(
    'id','TR-HIST-LINK','vehicle_id','V-HIST-LINK','counterparty_contractor_id','K_MOHAMED',
    'direction','AHMED_SUPPLIES','trip_date','2026-11-02','weight_tonnes','1',
    'contractor_rate_egp','100','vehicle_rate_egp','100','expense_egp','0');
  v_payment jsonb := jsonb_build_object(
    'id','PAY-HIST-LINK','vehicle_id','V-HIST-LINK','responsible_contractor_id','K_AHMED',
    'payment_date','2026-11-03','amount_egp','50','linked_trip_id','TR-HIST-LINK');
  v_edit jsonb;
  v_cancel jsonb;
  v_cancel_result jsonb;
  v_cancel_replay jsonb;
begin
  perform public.app_op_vehicle_create('HIST-LINK-VEHICLE',
    '{"id":"V-HIST-LINK","plate_number":"HIST LINK","contractor_id":"K_AHMED"}');
  perform public.app_op_vehicle_account_ensure('HIST-LINK-OTHER-ACCOUNT',
    '{"vehicle_id":"V-HIST-LINK","contractor_id":"K_MOHAMED"}');
  perform public.app_op_opening_balance_create('HIST-LINK-OPEN',
    '{"id":"OPEN-HIST-LINK","balance_type":"VEHICLE_CASH","contractor_id":"K_AHMED","vehicle_id":"V-HIST-LINK","start_date":"2026-11-01","signed_piastres":10000}');
  perform public.app_op_trip_create('HIST-LINK-TRIP', v_trip);
  perform public.app_op_payment_create('HIST-LINK-PAYMENT', v_payment);

  perform public.app_op_trip_update('HIST-LINK-MOVE', v_trip ||
    '{"direction":"OTHER_SUPPLIES","expected_version":1,"reason":"Correct trip responsibility"}'::jsonb);
  perform public.app_test_assert(
    (public.app_op_report_read('cash.statement',
      '{"vehicle_id":"V-HIST-LINK","responsible_contractor_id":"K_AHMED","date_from":"2026-11-01","date_to":"2026-11-03"}')->>'period_closing_piastres')::bigint=5000
    and (public.app_op_report_read('cash.statement',
      '{"vehicle_id":"V-HIST-LINK","responsible_contractor_id":"K_MOHAMED","date_from":"2026-11-01","date_to":"2026-11-03"}')->>'period_closing_piastres')::bigint=10000,
    'D02/D13 move the corrected work and preserve cash on the account that paid it'
  );

  v_edit := public.app_op_payment_update('HIST-LINK-EDIT', v_payment ||
    '{"expected_version":1,"reason":"Correct receipt notes","notes":"Verified receipt"}'::jsonb);
  perform public.app_test_assert(
    v_edit->>'version'='2'
    and exists (select 1 from public.payments where id='PAY-HIST-LINK'
      and linked_trip_id='TR-HIST-LINK' and responsible_contractor_id='K_AHMED'
      and payment_date='2026-11-03' and amount_piastres=5000 and notes='Verified receipt'),
    'Historical link may be retained during a valid edit on the original payment account'
  );

  v_cancel := '{"id":"TR-HIST-LINK","expected_version":2,"reason":"Remove incorrect work"}';
  v_cancel_result := public.app_op_trip_cancel('HIST-LINK-CANCEL',v_cancel);
  v_cancel_replay := public.app_op_trip_cancel('HIST-LINK-CANCEL',v_cancel);
  perform public.app_test_assert(
    v_cancel_result->>'version'='3' and v_cancel_result=v_cancel_replay
    and (select count(*) from public.audit_log
      where entity_id='TR-HIST-LINK' and action='CANCEL')=1
    and exists (select 1 from public.payments where id='PAY-HIST-LINK' and not is_cancelled)
    and (public.app_op_report_read('cash.statement',
      '{"vehicle_id":"V-HIST-LINK","responsible_contractor_id":"K_AHMED","date_from":"2026-11-01","date_to":"2026-11-03"}')->>'period_closing_piastres')::bigint=5000
    and (public.app_op_report_read('cash.statement',
      '{"vehicle_id":"V-HIST-LINK","responsible_contractor_id":"K_MOHAMED","date_from":"2026-11-01","date_to":"2026-11-03"}')->>'period_closing_piastres')::bigint=0,
    'Cancelling corrected work affects only work once and preserves the actual cash payment'
  );
end;
$test$;

select public.app_test_expect_error(
  $$select public.app_op_payment_create('HIST-LINK-NEW',
     '{"id":"PAY-HIST-LINK-NEW","vehicle_id":"V-HIST-LINK","responsible_contractor_id":"K_AHMED","payment_date":"2026-11-03","amount_egp":"1","linked_trip_id":"TR-HIST-LINK"}')$$,
  'A new link still has to match the payment account',
  array['23514']
);
select public.app_test_expect_error(
  $$select public.app_op_payment_update('HIST-LINK-INVALID-EDIT',
     '{"id":"PAY-HIST-LINK","expected_version":2,"reason":"Check changed reference","vehicle_id":"V-HIST-LINK","responsible_contractor_id":"K_AHMED","payment_date":"2026-11-03","amount_egp":"50","linked_trip_id":"TR_A"}')$$,
  'Changing the old link cannot point to a trip in another account',
  array['23514']
);
rollback;

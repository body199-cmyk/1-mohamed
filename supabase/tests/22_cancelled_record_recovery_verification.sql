-- Recovery acceptance on disposable PGlite, all data rolled back.
begin;
reset role;

do $fixture$
declare
  v_primary text;
  v_counterparty text;
  v_day date := (now() at time zone 'Africa/Cairo')::date - 4;
begin
  if not exists (select 1 from public.contractors where is_primary) then
    insert into public.contractors(id,name,is_primary)
      values('REC_PRIMARY','Owner Recovery Primary',true);
  end if;
  if not exists (select 1 from public.contractors where not is_primary) then
    insert into public.contractors(id,name)
      values('REC_COUNTERPARTY','Recovery Second Contractor');
  end if;
  select id into v_primary from public.contractors where is_primary limit 1;
  select id into v_counterparty from public.contractors where not is_primary limit 1;
  insert into public.vehicles(id,plate_number) values('REC_V1','REC-9911');
  insert into public.vehicle_accounts(vehicle_id,contractor_id)
    values('REC_V1',v_primary);
  insert into public.trips(
    id,vehicle_id,counterparty_contractor_id,responsible_contractor_id,
    direction,trip_date,weight_milli_tonnes,contractor_rate_piastres,
    vehicle_rate_piastres,same_rate,expense_piastres,
    contractor_total_piastres,vehicle_total_piastres,
    is_cancelled,cancel_reason,cancelled_at,version
  ) values (
    'REC_T1','REC_V1',v_counterparty,v_primary,
    'AHMED_SUPPLIES',v_day,1000,200000,200000,true,0,200000,200000,
    true,'Accidentally cancelled',now(),2
  );
  insert into public.payments(
    id,vehicle_id,responsible_contractor_id,payment_date,
    amount_piastres,is_cancelled,cancel_reason,cancelled_at,version
  ) values (
    'REC_P1','REC_V1',v_primary,v_day,100000,
    true,'Accidental cancellation',now(),2
  );
end $fixture$;

select public.app_test_assert(
  not has_function_privilege('anon','public.app_op_trip_reactivate(text,jsonb)','EXECUTE')
  and not has_function_privilege('anon','public.app_op_payment_reactivate(text,jsonb)','EXECUTE')
  and has_function_privilege('authenticated','public.app_op_trip_reactivate(text,jsonb)','EXECUTE')
  and has_function_privilege('authenticated','public.app_op_payment_reactivate(text,jsonb)','EXECUTE'),
  'RECOVERY: anonymous blocked; authenticated call still owner-gated'
);

set local role authenticated;
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';

select public.app_test_expect_error(
  $q$select public.app_op_trip_reactivate('REC-STRANGER-T',
    '{"id":"REC_T1","expected_version":2,"reason":"Unauthorized"}'::jsonb)$q$,
  'Recovery: non-owner cannot reactivate trip',array['42501']
);
select public.app_test_expect_error(
  $q$select public.app_op_payment_reactivate('REC-STRANGER-P',
    '{"id":"REC_P1","expected_version":2,"reason":"Unauthorized"}'::jsonb)$q$,
  'Recovery: non-owner cannot reactivate payment',array['42501']
);

set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';

select public.app_test_expect_error(
  $q$select public.app_op_trip_reactivate('REC-ST-T',
    '{"id":"REC_T1","expected_version":1,"reason":"Stale version"}'::jsonb)$q$,
  'Recovery: stale trip version blocked',array['P2003']
);
select public.app_test_expect_error(
  $q$select public.app_op_payment_reactivate('REC-ST-P',
    '{"id":"REC_P1","expected_version":1,"reason":"Stale version"}'::jsonb)$q$,
  'Recovery: stale payment version blocked',array['P2003']
);

do $recovery$
declare
  first jsonb;
  replay jsonb;
  v_primary text;
begin
  select id into v_primary from public.contractors where is_primary limit 1;
  first := public.app_op_trip_reactivate('REC-OK-T',
    '{"id":"REC_T1","expected_version":2,"reason":"Reversal after accidental cancellation"}'::jsonb);
  replay := public.app_op_trip_reactivate('REC-OK-T',
    '{"id":"REC_T1","expected_version":2,"reason":"Reversal after accidental cancellation"}'::jsonb);
  perform public.app_test_assert(
    first=replay and first->>'version'='3'
    and not (select is_cancelled from public.trips where id='REC_T1')
    and (select cancel_reason is null and cancelled_at is null
         from public.trips where id='REC_T1')
    and (select count(*) from public.audit_log where entity_type='TRIP'
         and entity_id='REC_T1' and action='UPDATE' and reason like 'استعادة إلغاء:%')=1
    and public.app_payment_cash_balance('REC_V1',v_primary,
      (now() at time zone 'Africa/Cairo')::date)=200000,
    'Recovery: trip reactivated, money credited once, one audit, safe idempotent replay'
  );
  first := public.app_op_payment_reactivate('REC-OK-P',
    '{"id":"REC_P1","expected_version":2,"reason":"Reversal after accidental cancellation"}'::jsonb);
  replay := public.app_op_payment_reactivate('REC-OK-P',
    '{"id":"REC_P1","expected_version":2,"reason":"Reversal after accidental cancellation"}'::jsonb);
  perform public.app_test_assert(
    first=replay and first->>'version'='3'
    and not (select is_cancelled from public.payments where id='REC_P1')
    and (select cancel_reason is null and cancelled_at is null
         from public.payments where id='REC_P1')
    and (select count(*) from public.audit_log where entity_type='PAYMENT'
         and entity_id='REC_P1' and action='UPDATE' and reason like 'استعادة إلغاء:%')=1
    and public.app_payment_cash_balance('REC_V1',v_primary,
      (now() at time zone 'Africa/Cairo')::date)=100000,
    'Recovery: payment debited exactly once under D16, audited and replay-safe'
  );
end $recovery$;

select public.app_test_expect_error(
  $q$select public.app_op_trip_reactivate('REC-DOUBLE-T',
    '{"id":"REC_T1","expected_version":3,"reason":"Try twice"}'::jsonb)$q$,
  'Recovery: active trip cannot be recovered twice',array['22023']
);
select public.app_test_expect_error(
  $q$select public.app_op_payment_reactivate('REC-DOUBLE-P',
    '{"id":"REC_P1","expected_version":3,"reason":"Try twice"}'::jsonb)$q$,
  'Recovery: active payment cannot be recovered twice',array['22023']
);

-- D16 negative intermediate history: a canceled 1500 EGP payment must NOT
-- be resumed while 1000 EGP is already paid against 2000 EGP of work.
reset role;
do $extra$
declare
  v_primary text;
  v_day date := (now() at time zone 'Africa/Cairo')::date - 3;
begin
  select id into v_primary from public.contractors where is_primary limit 1;
  insert into public.payments(
    id,vehicle_id,responsible_contractor_id,payment_date,
    amount_piastres,is_cancelled,cancel_reason,cancelled_at,version
  ) values
    ('REC_P_EXCESS','REC_V1',v_primary,v_day,150000,true,'Mistake',now(),2),
    ('REC_P_ACTIVE','REC_V1',v_primary,v_day,100000,false,null,null,1);
end $extra$;

set local role authenticated;
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';

select public.app_test_expect_error(
  $q$select public.app_op_payment_reactivate('REC-FAIL-D16',
    '{"id":"REC_P_EXCESS","expected_version":2,"reason":"Would overpay"}'::jsonb)$q$,
  'Recovery: D16 rejects reactivation that would create negative historical cash',array['P2016']
);

select public.app_test_assert(
  (select is_cancelled and version=2 from public.payments where id='REC_P_EXCESS')
  and (select count(*) from public.audit_log where entity_id='REC_P_EXCESS')=0
  and (select count(*) from public.idempotency_keys where key='REC-FAIL-D16')=0,
  'Recovery: rejected payment change leaves no partial writes or audit'
);
rollback;

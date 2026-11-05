-- H048 / T08.2: D15 same-day dues first, D16 all intermediate dates.
-- Existing phase A/B/C and T08.1 tests have run before these tests.
-- Fixtures are isolated and are never seeded in the real application.
set role authenticated;
set "request.jwt.claim.role"='authenticated';
set "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000001';

-- Provision two independent vehicle accounts; each uses server-calculated
-- trip totals, while the first uses a legitimate opening balance.
reset role;
insert into public.vehicles(id,plate_number) values
 ('V_H48_A','H48 ACCOUNT A'),('V_H48_B','H48 ACCOUNT B');
insert into public.vehicle_accounts(vehicle_id,contractor_id) values
 ('V_H48_A','K_AHMED'),('V_H48_B','K_AHMED'),
 ('V_H48_B','K_MOHAMED');
insert into public.opening_balances(id,balance_type,contractor_id,vehicle_id,start_date,signed_piastres)
values ('OB_H48_A','VEHICLE_CASH','K_AHMED','V_H48_A',
  '2026-11-01'::date,100000);
set role authenticated;
set "request.jwt.claim.role"='authenticated';
set "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000001';
-- Admin executes this combined fixture + helper arithmetic verification.
-- The JWT still identifies the authorized owner for the RPC calls.
-- Direct client execution of helpers remains revoked, by design.
reset role;

do $payment_test$
declare
  v_today date := (now() at time zone 'Africa/Cairo')::date;
  v_anchor date := '2026-11-01'::date;
  v_trip jsonb;
  v_paid jsonb;
  v_again jsonb;
  v_edit jsonb;
  v_canceled jsonb;
begin
  perform public.app_test_assert(
    not has_function_privilege('anon','public.app_op_payment_create(text,jsonb)','EXECUTE')
    and not has_function_privilege('authenticated','public.app_payment_assert_available(text,text,date,bigint,text)','EXECUTE')
    and has_function_privilege('authenticated','public.app_op_payments_read(jsonb)','EXECUTE'),
    'D16.01 RPCs are gated; financial helper is private'
  );
  perform public.app_test_assert(
    public.app_payment_cash_balance('V_H48_A','K_AHMED',v_anchor)=100000,
    'D16.02 exact opening balance on vehicle account'
  );
  v_trip:=public.app_op_trip_create('H48-TR-B',
    jsonb_build_object('id','TR_H48_B','vehicle_id','V_H48_B',
       'counterparty_contractor_id','K_MOHAMED','direction','AHMED_SUPPLIES',
       'trip_date',to_char(v_anchor+2,'YYYY-MM-DD'),
       'weight_tonnes','10','contractor_rate_egp','100',
       'vehicle_rate_egp','100','expense_egp','0'));
  perform public.app_test_assert(
    v_trip->>'vehicle_total_piastres'='100000',
    'D16.03 work due computed by original trip engine'
  );
  v_paid:=public.app_op_payment_create('H48-P-A',
    jsonb_build_object('id','P_H48_A','vehicle_id','V_H48_A',
      'responsible_contractor_id','K_AHMED','payment_date',to_char(v_anchor+2,'YYYY-MM-DD'),
      'amount_egp','800.00','receipt_number','00042'));
  perform public.app_test_assert(
    v_paid->>'status'='OK' and v_paid->>'amount_piastres'='80000'
    and (select receipt_number from public.payments where id='P_H48_A')='00042',
    'D16.04 correct 800 EGP payment and string receipt'
  );
  -- 1000 opening, 800 payment on D-12, 1000 due on D-5:
  -- backdating 500 to D-15 would make D-12 = -300, even though D-15
  -- and current balances would each have been sufficient without it.
  -- this must fail D16, not merely D13-B endpoint checks.
  perform public.app_test_assert(
    public.app_payment_cash_balance('V_H48_A','K_AHMED',v_anchor+1)=100000
    and public.app_payment_cash_balance('V_H48_A','K_AHMED',v_today)=20000,
    'D16.05 historical and current account balances reflect real movements'
  );
  -- Give A a later due so current has enough and only intermediate date fails.
  v_trip:=public.app_op_trip_create('H48-TR-A',
    jsonb_build_object('id','TR_H48_A','vehicle_id','V_H48_A',
       'counterparty_contractor_id','K_MOHAMED','direction','AHMED_SUPPLIES',
       'trip_date',to_char(v_anchor+3,'YYYY-MM-DD'),
       'weight_tonnes','10','contractor_rate_egp','100',
       'vehicle_rate_egp','100','expense_egp','0'));
  perform public.app_test_assert(
    public.app_payment_cash_balance('V_H48_A','K_AHMED',v_today)=120000,
    'D16.06 later due increases current amount but cannot erase intermediate debt'
  );
  perform public.app_test_assert(
    public.app_payment_min_available('V_H48_A','K_AHMED',v_anchor+1,v_today)=20000,
    'D16.07 event-day minimum is not simply the current balance'
  );

  v_paid:=public.app_op_payment_create('H48-P-SAME',
    jsonb_build_object('id','P_H48_SAME','vehicle_id','V_H48_B',
      'responsible_contractor_id','K_AHMED','payment_date',to_char(v_anchor+2,'YYYY-MM-DD'),
      'amount_egp','1000.00','linked_trip_id','TR_H48_B'));
  perform public.app_test_assert(
    v_paid->>'status'='OK' and v_paid->>'remaining_piastres'='0',
    'D16.08 D15 work credited before equal-value same-day payment'
  );
  v_again:=public.app_op_payment_create('H48-P-SAME',
    jsonb_build_object('id','P_H48_SAME','vehicle_id','V_H48_B',
      'responsible_contractor_id','K_AHMED','payment_date',to_char(v_anchor+2,'YYYY-MM-DD'),
      'amount_egp','1000.00','linked_trip_id','TR_H48_B'));
  perform public.app_test_assert(v_paid=v_again
    and (select count(*) from public.payments where id='P_H48_SAME')=1
    and (select count(*) from public.audit_log where entity_type='PAYMENT'
         and entity_id='P_H48_SAME' and action='INSERT')=1,
    'D16.09 idempotent replay does not double debit'
  );
  perform public.app_test_assert(
    (public.app_op_payments_read(jsonb_build_object(
      'vehicle_id','V_H48_B','responsible_contractor_id','K_AHMED'))->>'cash_balance_piastres')='0',
    'D16.10 owner read agrees with cash engine'
  );

  v_edit:=public.app_op_payment_update('H48-P-SAME-EDIT',
    jsonb_build_object('id','P_H48_SAME','expected_version',1,
      'reason','reduce payment','vehicle_id','V_H48_B',
      'responsible_contractor_id','K_AHMED','payment_date',to_char(v_anchor+2,'YYYY-MM-DD'),
      'amount_egp','900.00','linked_trip_id','TR_H48_B'));
  perform public.app_test_assert(
    v_edit->>'version'='2' and v_edit->>'remaining_piastres'='10000'
    and (select amount_piastres from public.payments where id='P_H48_SAME')=90000,
    'D16.11 edit excludes old 100000 before adding 90000 just once'
  );
  v_again:=public.app_op_payment_update('H48-P-SAME-EDIT',
    jsonb_build_object('id','P_H48_SAME','expected_version',1,
      'reason','reduce payment','vehicle_id','V_H48_B',
      'responsible_contractor_id','K_AHMED','payment_date',to_char(v_anchor+2,'YYYY-MM-DD'),
      'amount_egp','900.00','linked_trip_id','TR_H48_B'));
  perform public.app_test_assert(v_edit=v_again
    and (select count(*) from public.audit_log where entity_id='P_H48_SAME' and action='UPDATE')=1,
    'D16.12 edit replay is stable and audit written exactly once'
  );
  v_canceled:=public.app_op_payment_cancel('H48-P-SAME-CANCEL',
     jsonb_build_object('id','P_H48_SAME','expected_version',2,'reason','wrong recipient'));
  perform public.app_test_assert(
    v_canceled->>'is_cancelled'='true' and v_canceled->>'version'='3'
    and v_canceled->>'remaining_piastres'='100000',
    'D16.13 cancellation keeps record and reverses only cash movement'
  );
  perform public.app_test_assert(
    (select count(*) from public.payments where id='P_H48_SAME' and is_cancelled)=1
    and (select count(*) from public.audit_log where entity_id='P_H48_SAME' and action='CANCEL')=1,
    'D16.14 cancellation is historical and auditable'
  );
end $payment_test$;

set role authenticated;
set "request.jwt.claim.role"='authenticated';
set "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000001';

-- Verify fail-closed conditions; all rejected requests leave no partial writes.
select public.app_test_expect_error(
  $q$select public.app_op_payment_create('H48-P-OLD',
    jsonb_build_object('id','P_H48_OLD','vehicle_id','V_H48_A',
    'responsible_contractor_id','K_AHMED',
    'payment_date',to_char('2026-11-02'::date,'YYYY-MM-DD'),
    'amount_egp','500.00'))$q$,
  'D16.15 backdated payment rejected for negative intermediate day even when now sufficient',
  array['P2016']
);
select public.app_test_expect_error(
  $q$select public.app_op_payment_create('H48-P-OVER',
    jsonb_build_object('id','P_H48_OVER','vehicle_id','V_H48_A',
    'responsible_contractor_id','K_AHMED',
    'payment_date',to_char('2026-11-04'::date,'YYYY-MM-DD'),
    'amount_egp','1200.01'))$q$,
  'D16.16 overpayment by one piastre rejected',
  array['P2016']
);
select public.app_test_expect_error(
  $q$select public.app_op_payment_create('H48-P-NUM',
    jsonb_build_object('id','P_H48_NUM','vehicle_id','V_H48_A',
    'responsible_contractor_id','K_AHMED',
    'payment_date',to_char('2026-11-04'::date,'YYYY-MM-DD'),
    'amount_egp',10.0))$q$,
  'D16.17 JSON number rejected to preserve piastre precision',
  array['22023']
);
select public.app_test_expect_error(
  $q$select public.app_op_payment_create('H48-P-FRAC',
    jsonb_build_object('id','P_H48_FRAC','vehicle_id','V_H48_A',
    'responsible_contractor_id','K_AHMED',
    'payment_date',to_char('2026-11-04'::date,'YYYY-MM-DD'),
    'amount_egp','10.001'))$q$,
  'D16.18 unsupported fraction rejected before rounding',
  array['22023']
);
select public.app_test_expect_error(
  $q$select public.app_op_payment_create('H48-P-ZERO',
    jsonb_build_object('id','P_H48_ZERO','vehicle_id','V_H48_A',
    'responsible_contractor_id','K_AHMED',
    'payment_date',to_char('2026-11-04'::date,'YYYY-MM-DD'),
    'amount_egp','0.00'))$q$,
  'D16.19 zero-payment denied',
  array['22023']
);
select public.app_test_expect_error(
  $q$select public.app_op_payment_create('H48-P-CROSS',
    jsonb_build_object('id','P_H48_CROSS','vehicle_id','V_H48_B',
    'responsible_contractor_id','K_MOHAMED',
    'payment_date',to_char('2026-11-03'::date,'YYYY-MM-DD'),
    'amount_egp','1.00','linked_trip_id','TR_H48_B'))$q$,
  'D16.20 wrong accountable contractor cannot use another account trip',
  array['P2016','23514']
);
select public.app_test_expect_error(
  $q$select public.app_op_payment_update('H48-P-CANCEL-EDIT',
    jsonb_build_object('id','P_H48_SAME','expected_version',3,
    'reason','editing canceled','vehicle_id','V_H48_B',
    'responsible_contractor_id','K_AHMED',
    'payment_date',to_char('2026-11-03'::date,'YYYY-MM-DD'),
    'amount_egp','200.00'))$q$,
  'D16.21 canceled payment is immutable',
  array['22023']
);
select public.app_test_expect_error(
  $q$select public.app_op_payment_cancel('H48-P-STALE',
    '{"id":"P_H48_A","expected_version":9,"reason":"incorrect"}'::jsonb)$q$,
  'D16.22 optimistic version conflict prevents lost changes',
  array['P2003']
);
select public.app_test_expect_error(
  $q$select public.app_op_payment_create('H48-P-SAME',
    '{"id":"P_SPOOF","vehicle_id":"V_H48_A","responsible_contractor_id":"K_AHMED","payment_date":"2026-01-01","amount_egp":"1.00"}'::jsonb)$q$,
  'D16.23 reused request key with altered payload fails',
  array['P2001']
);
select public.app_test_assert(
  (select count(*) from public.payments where id like 'P_H48_%')=2
  and not exists(select 1 from public.payments where id in
    ('P_H48_OLD','P_H48_OVER','P_H48_NUM','P_H48_FRAC','P_H48_ZERO','P_H48_CROSS')),
  'D16.24 all failed operations roll back their financial changes'
);
select public.app_test_assert(
  (select count(*) from public.idempotency_keys where key like 'H48-%')=6,
  'D16.25 only completed payment/trip operations retain idempotency records'
);

-- Anonymous and non-owner cannot invoke owner-gated payment RPCs.
reset role;
set role anon;
set "request.jwt.claim.role"='anon';
set "request.jwt.claim.sub"='';
select public.app_test_expect_error(
  $q$select public.app_op_payment_create('H48-ANON','{}'::jsonb)$q$,
  'D16.26 anon cannot call payment create RPC',array['42501']);
reset role;
set role authenticated;
set "request.jwt.claim.role"='authenticated';
set "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000002';
select public.app_test_expect_error(
  $q$select public.app_op_payments_read('{"vehicle_id":"V_H48_B","responsible_contractor_id":"K_AHMED"}'::jsonb)$q$,
  'D16.27 nonowner cannot read any cash movements',array['42501']);
select public.app_test_expect_error(
  $q$select public.app_op_payment_cancel('H48-OTHER','{"id":"P_H48_A","reason":"other user","expected_version":1}'::jsonb)$q$,
  'D16.28 nonowner cannot cancel payment',array['42501']);
reset role;
reset "request.jwt.claim.role";
reset "request.jwt.claim.sub";

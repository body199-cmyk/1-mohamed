-- FIN-01/FIN-02 isolated PostgreSQL RPC acceptance, after H048 fixtures.
-- No real Supabase connection or concurrency claims.
-- Keep test-owner privileges for private balance inspection; owner JWT remains enforced by RPCs.
reset role;
set "request.jwt.claim.role"='authenticated';
set "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000001';

do $fin02$
declare
 v_trip jsonb;
 v_created jsonb;
 v_moved jsonb;
 v_old numeric;
 v_new numeric;
begin
 v_trip:=public.app_op_trip_create('FIN02-SQL-OTHER-TRIP',
   jsonb_build_object('id','TR_FIN02_OTHER','vehicle_id','V_H48_B',
     'counterparty_contractor_id','K_MOHAMED','direction','OTHER_SUPPLIES',
     'trip_date','2026-11-03','weight_tonnes','1','contractor_rate_egp','1000',
     'vehicle_rate_egp','1000','expense_egp','0'));
 perform public.app_test_assert(v_trip->>'vehicle_total_piastres'='100000',
   'FIN02 SQL fixture: separate contractor vehicle-cash due');
 v_created:=public.app_op_payment_create('FIN02-SQL-CREATE',
   jsonb_build_object('id','P_FIN02_MOVE','vehicle_id','V_H48_A',
     'responsible_contractor_id','K_AHMED','payment_date','2026-11-03',
     'amount_egp','100.00'));
 perform public.app_test_assert(v_created->>'version'='1',
   'FIN02 payment inserted once on old cash account');
 v_old:=public.app_payment_cash_balance('V_H48_A','K_AHMED','2026-11-05');
 v_new:=public.app_payment_cash_balance('V_H48_B','K_MOHAMED','2026-11-05');
 v_moved:=public.app_op_payment_update('FIN02-SQL-MOVE',
   jsonb_build_object('id','P_FIN02_MOVE','expected_version',1,
     'reason','reassign responsible contractor',
     'vehicle_id','V_H48_B','responsible_contractor_id','K_MOHAMED',
     'payment_date','2026-11-03','amount_egp','80.00'));
 perform public.app_test_assert(
   v_moved->>'version'='2'
   and (select count(*) from public.payments where id='P_FIN02_MOVE')=1
   and (select responsible_contractor_id from public.payments where id='P_FIN02_MOVE')='K_MOHAMED'
   and (select amount_piastres from public.payments where id='P_FIN02_MOVE')=8000
   and (select payment_date from public.payments where id='P_FIN02_MOVE')='2026-11-03'::date,
   'FIN02 edit moves one row to account and retains original requested date');
 perform public.app_test_assert(
   public.app_payment_cash_balance('V_H48_A','K_AHMED','2026-11-05')=v_old+10000
   and public.app_payment_cash_balance('V_H48_B','K_MOHAMED','2026-11-05')=v_new-8000,
   'FIN02 balance old +10000 and new -8000 exactly once');
 perform public.app_test_assert(
   (select count(*) from public.audit_log where entity_type='PAYMENT'
       and entity_id='P_FIN02_MOVE' and action='INSERT')=1
   and (select count(*) from public.audit_log where entity_type='PAYMENT'
       and entity_id='P_FIN02_MOVE' and action='UPDATE')=1
   and exists(select 1 from public.audit_log where entity_type='PAYMENT'
       and entity_id='P_FIN02_MOVE' and action='UPDATE'
       and reason='reassign responsible contractor'
       and diff->>'old_account'='V_H48_A|K_AHMED'
       and diff->>'new_account'='V_H48_B|K_MOHAMED'),
   'FIN02 one signed audit with before and after accounts');
end $fin02$;

select public.app_test_expect_error(
 $q$select public.app_op_payment_update('FIN02-SQL-STALE',
   '{"id":"P_FIN02_MOVE","expected_version":1,"reason":"stale",
     "vehicle_id":"V_H48_B","responsible_contractor_id":"K_MOHAMED",
     "payment_date":"2026-11-03","amount_egp":"10.00"}'::jsonb)$q$,
 'FIN02 stale expectedVersion is rejected without write',array['P2003']);
select public.app_test_expect_error(
 $q$select public.app_op_payment_update('FIN02-SQL-OVERPAY',
   '{"id":"P_FIN02_MOVE","expected_version":2,"reason":"invalid amount",
     "vehicle_id":"V_H48_B","responsible_contractor_id":"K_MOHAMED",
     "payment_date":"2026-11-03","amount_egp":"2000.00"}'::jsonb)$q$,
 'FIN02 overpay rejected without new records',array['P2016']);
select public.app_test_assert(
  (select count(*) from public.payments where id='P_FIN02_MOVE' and version=2
     and amount_piastres=8000 and responsible_contractor_id='K_MOHAMED')=1
  and (select count(*) from public.audit_log where entity_id='P_FIN02_MOVE')=2
  and not exists(select 1 from public.idempotency_keys where key in
    ('FIN02-SQL-STALE','FIN02-SQL-OVERPAY')),
  'FIN02 rejected operations do not mutate payment, audit or idempotency');
reset role;
reset "request.jwt.claim.role";
reset "request.jwt.claim.sub";

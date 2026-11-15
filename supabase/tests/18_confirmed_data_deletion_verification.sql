-- ISOLATED TEST ONLY. Never run this test against hosted business data.
reset role;
begin;
create table if not exists auth.sessions(id uuid primary key,user_id uuid not null);
insert into auth.sessions values('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001'),
 ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001');
set "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000001';
create function pg_temp.deletion_test_claims(fresh boolean,method text default 'password',age integer default 0) returns void language plpgsql as $$
begin
 perform set_config('request.jwt.claims',jsonb_build_object('session_id',case when fresh then '10000000-0000-0000-0000-000000000002' else '10000000-0000-0000-0000-000000000001' end,
  'amr',jsonb_build_array(jsonb_build_object('method',method,'timestamp',extract(epoch from clock_timestamp())::bigint-age)))::text,true);
end $$;
create function pg_temp.reject_deletion_audit() returns trigger language plpgsql as $$
begin
 if new.entity_id like 'DATA_PURGE:%' then raise exception 'simulated late deletion audit failure' using errcode='P2004'; end if;
 return new;
end $$;
select public.app_op_contractor_create('DEL:C','{"id":"DEL-C","name":"مقاول اختبار الحذف","start_mode":"DETAILS"}');
select public.app_op_vehicle_create('DEL:V1','{"id":"DEL-V1","plate_number":"ح ذ ف 1001","contractor_id":"K_AHMED"}');
select public.app_op_vehicle_create('DEL:V2','{"id":"DEL-V2","plate_number":"ح ذ ف 1002","contractor_id":"K_AHMED"}');
select public.app_op_trip_create('DEL:T1','{"id":"DEL-T1","vehicle_id":"DEL-V1","counterparty_contractor_id":"DEL-C","direction":"AHMED_SUPPLIES","trip_date":"2026-02-01","weight_tonnes":"1","contractor_rate_egp":"100","vehicle_rate_egp":"100","same_rate":true,"expense_egp":"0"}');
select public.app_op_payment_create('DEL:P1','{"id":"DEL-P1","vehicle_id":"DEL-V1","responsible_contractor_id":"K_AHMED","payment_date":"2026-03-01","amount_egp":"30"}');
select public.app_op_trip_create('DEL:T2','{"id":"DEL-T2","vehicle_id":"DEL-V2","counterparty_contractor_id":"DEL-C","direction":"AHMED_SUPPLIES","trip_date":"2026-04-01","weight_tonnes":"1","contractor_rate_egp":"150","vehicle_rate_egp":"150","same_rate":true,"expense_egp":"0"}');

-- Owner gates and direct private access remain closed.
set role authenticated;
select public.app_test_expect_error('select * from app_private.deletion_challenges','Private challenge is not client writable/readable',array['42501']);
set "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000002';
select public.app_test_expect_error($q$select public.app_op_data_purge_preview('{"mode":"ALL"}')$q$,'Non-owner cannot preview',array['42501']);
select public.app_test_expect_error($q$select public.app_op_data_purge_execute('{}')$q$,'Non-owner cannot execute',array['42501']);
reset role;
set "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000001';
select pg_temp.deletion_test_claims(false);
select public.app_test_expect_error($q$select public.app_op_data_purge_preview('{"mode":"UNKNOWN"}')$q$,'Unknown scope rejected',array['22023']);
select public.app_test_expect_error($q$select public.app_op_data_purge_preview('{"mode":"PERIOD","from":"2026-04-01","to":"2026-02-01"}')$q$,'Reversed period rejected',array['22023']);

do $$ declare r jsonb; p jsonb; challenge_id uuid; before_count bigint; old_audit bigint; original_user uuid; before_users bigint;
begin
 r:=public.app_op_data_purge_preview('{"mode":"PERIOD","from":"2026-02-01","to":"2026-02-01"}');
 perform public.app_test_assert(r->>'blocked'='NEGATIVE_BALANCE' and r->>'challenge_id' is null,'Cannot remove funding and leave later debt');
 perform public.app_op_payment_create('DEL:LINK','{"id":"DEL-LINK","vehicle_id":"DEL-V1","responsible_contractor_id":"K_AHMED","payment_date":"2026-03-15","amount_egp":"10","linked_trip_id":"DEL-T1"}');
 r:=public.app_op_data_purge_preview('{"mode":"PERIOD","from":"2026-02-01","to":"2026-02-01"}');
 perform public.app_test_assert(r->>'blocked'='LINKED_OUTSIDE','Linked payments outside the selected dates block deletion');
 r:=public.app_op_data_purge_preview('{"mode":"PERIOD","from":"2026-03-01","to":"2026-03-01"}');
 perform public.app_test_assert(r->'counts'->>'payments'='1' and r->'counts'->>'trips'='0','Preview is inclusive and exact');
 challenge_id:=(r->>'challenge_id')::uuid;p:=jsonb_build_object('challenge_id',challenge_id,'confirmation',r->>'confirmation');
 perform public.app_test_expect_error(format('select public.app_op_data_purge_execute(%L::jsonb)',p::text),'Original session cannot delete',array['42501']);
 perform pg_temp.deletion_test_claims(true,'otp');
 perform public.app_test_expect_error(format('select public.app_op_data_purge_execute(%L::jsonb)',p::text),'OTP does not satisfy password confirmation',array['42501']);
 perform pg_temp.deletion_test_claims(true,'password',600);
 perform public.app_test_expect_error(format('select public.app_op_data_purge_execute(%L::jsonb)',p::text),'Old password login cannot delete',array['42501']);
 perform pg_temp.deletion_test_claims(true);
 delete from auth.sessions where id='10000000-0000-0000-0000-000000000002';
 perform public.app_test_expect_error(format('select public.app_op_data_purge_execute(%L::jsonb)',p::text),'Revoked temporary session cannot delete',array['42501']);
 insert into auth.sessions values('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001');
 perform public.app_test_expect_error(format('select public.app_op_data_purge_execute(%L::jsonb)',(p||'{"confirmation":"wrong"}')::text),'Wrong final phrase rejected',array['22023']);
 select count(*) into old_audit from public.audit_log;
 r:=public.app_op_data_purge_execute(p);
 perform public.app_test_assert(r->>'status'='OK' and not exists(select 1 from public.payments where id='DEL-P1') and exists(select 1 from public.trips where id='DEL-T1'),'Confirmed period deletes only matching records');
 perform public.app_test_assert(public.app_op_data_purge_execute(p)=r and (select count(*) from public.audit_log)=old_audit+1,'Challenge retry is idempotent and does not repeat deletion/audit');
 perform public.app_test_expect_error($q$select public.app_op_payment_create('DEL:P1','{"id":"DEL-P1","vehicle_id":"DEL-V1","responsible_contractor_id":"K_AHMED","payment_date":"2026-03-01","amount_egp":"30"}')$q$,'Old completed request cannot report success for deleted record',array['P2005']);
 perform public.app_test_expect_error($q$select public.app_op_payment_create('DEL:NEW-P1','{"id":"DEL-P1","vehicle_id":"DEL-V1","responsible_contractor_id":"K_AHMED","payment_date":"2026-03-01","amount_egp":"30"}')$q$,'New key cannot resurrect deleted identity',array['P2005']);
 perform pg_temp.deletion_test_claims(false);
 r:=public.app_op_data_purge_preview('{"mode":"VEHICLE","vehicle_id":"DEL-V1"}');
 p:=jsonb_build_object('challenge_id',r->>'challenge_id','confirmation',r->>'confirmation');
 perform public.app_op_vehicle_update('DEL:UPDATE','{"id":"DEL-V2","expected_version":1,"plate_number":"ح ذ ف 1002","driver_name":"تغيير متزامن"}');
 perform pg_temp.deletion_test_claims(true);
 perform public.app_test_expect_error(format('select public.app_op_data_purge_execute(%L::jsonb)',p::text),'Concurrent data change invalidates preview',array['P2007']);
 perform public.app_test_assert(exists(select 1 from public.vehicles where id='DEL-V1'),'Stale preview changes nothing');
 perform pg_temp.deletion_test_claims(false);
 r:=public.app_op_data_purge_preview('{"mode":"VEHICLE","vehicle_id":"DEL-V1"}');
 p:=jsonb_build_object('challenge_id',r->>'challenge_id','confirmation',r->>'confirmation');
 perform pg_temp.deletion_test_claims(true);
 execute 'create trigger test_deletion_audit_failure before insert on public.audit_log for each row execute function pg_temp.reject_deletion_audit()';
 perform public.app_test_expect_error(format('select public.app_op_data_purge_execute(%L::jsonb)',p::text),'Late audit failure rolls back the entire deletion',array['P2004']);
 perform public.app_test_assert(exists(select 1 from public.vehicles where id='DEL-V1') and exists(select 1 from public.trips where id='DEL-T1')
  and exists(select 1 from public.payments where id='DEL-LINK') and not exists(select 1 from app_private.deleted_entities where entity_id='DEL-V1')
  and not exists(select 1 from app_private.deletion_challenges where id=(p->>'challenge_id')::uuid and consumed_at is not null),'No partial deletion, tombstone or consumed challenge after failure');
 execute 'drop trigger test_deletion_audit_failure on public.audit_log';
 perform public.app_op_data_purge_execute(p);
 perform public.app_test_assert(not exists(select 1 from public.vehicles where id='DEL-V1') and exists(select 1 from public.vehicles where id='DEL-V2') and not exists(select 1 from public.trips where vehicle_id='DEL-V1'),'Vehicle scope removes only the selected vehicle and dependencies');
 perform pg_temp.deletion_test_claims(false);
 r:=public.app_op_data_purge_preview('{"mode":"VEHICLE","vehicle_id":"DEL-V2"}');
 p:=jsonb_build_object('challenge_id',r->>'challenge_id','confirmation',r->>'confirmation');
 update app_private.deletion_challenges set expires_at=clock_timestamp()-interval '1 second' where id=(p->>'challenge_id')::uuid;
 perform pg_temp.deletion_test_claims(true);
 perform public.app_test_expect_error(format('select public.app_op_data_purge_execute(%L::jsonb)',p::text),'Expired challenge cannot delete',array['P2006']);
 perform public.app_test_assert(exists(select 1 from public.vehicles where id='DEL-V2'),'Expiry leaves data intact');
 select owner_user_id into original_user from public.app_owner;
 select count(*) into before_users from auth.users;
 select count(*) into before_count from public.idempotency_keys;
 perform pg_temp.deletion_test_claims(false);
 r:=public.app_op_data_purge_preview('{"mode":"ALL"}');
 p:=jsonb_build_object('challenge_id',r->>'challenge_id','confirmation',r->>'confirmation');
 perform pg_temp.deletion_test_claims(true);
 perform public.app_op_data_purge_execute(p);
 perform public.app_test_assert((select count(*) from public.contractors)=1 and exists(select 1 from public.contractors where is_primary)
  and not exists(select 1 from public.trips) and not exists(select 1 from public.payments) and not exists(select 1 from public.opening_balances)
  and not exists(select 1 from public.vehicle_accounts) and not exists(select 1 from public.vehicles),'All scope clears business records but retains primary identity');
 perform public.app_test_assert((select owner_user_id from public.app_owner)=original_user and (select count(*) from auth.users)=before_users
  and (select count(*) from auth.sessions)=2 and (select count(*) from public.idempotency_keys)=before_count,'Login, sessions and immutable request history untouched');
 perform public.app_test_expect_error('delete from public.audit_log','Audit remains append-only after deletion',array['42501']);
 perform public.app_test_expect_error('delete from public.idempotency_keys','Idempotency history remains immutable',array['42501']);
end $$;
rollback;

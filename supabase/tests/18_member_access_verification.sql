begin;
reset role;
insert into auth.users(id,email) values('00000000-0000-0000-0000-000000000003','member@test.invalid');
set local role authenticated;
set local "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000001';
select public.app_member_grant('00000000-0000-0000-0000-000000000003','member@test.invalid');
select public.app_test_assert(public.app_is_owner() and public.app_has_access(),'Owner identity preserved');
set local "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000003';
do $$ begin
 perform public.app_test_assert(public.app_has_access() and not public.app_is_owner(),'Member is authorized, never owner');
 perform public.app_test_assert((select count(*)=0 from public.app_members),'Members cannot inspect membership');
 perform public.app_test_assert((select count(*)=0 from public.app_owner),'Members cannot inspect owner table');
 perform public.app_test_assert((select count(*)>0 from public.contractors),'Members read business rows through RLS');
 perform public.app_op_contractor_create('member-create-contract-01','{"id":"MEMBER_TEST_C","name":"Member Test","start_mode":"DETAILS"}');
 perform public.app_test_assert((select count(*)=1 from public.contractors where id='MEMBER_TEST_C'),'Member writes through existing audited operation');
 begin
  perform public.app_member_grant('00000000-0000-0000-0000-000000000002','stranger@test.invalid');
  raise exception 'Member granted access';
 exception when insufficient_privilege then null; end;
 begin
  perform public.app_member_revoke('00000000-0000-0000-0000-000000000003');
  raise exception 'Member revoked access';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.app_members(user_id,email,invited_by) values('00000000-0000-0000-0000-000000000002','stranger@test.invalid',auth.uid());
  raise exception 'Direct membership mutation succeeded';
 exception when insufficient_privilege then null; end;
end; $$;
set local "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000001';
select public.app_member_revoke('00000000-0000-0000-0000-000000000003');
set local "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000003';
do $$ begin
 perform public.app_test_assert(not public.app_has_access(),'Revoked member loses access with same identity/token');
 perform public.app_test_assert((select count(*)=0 from public.contractors),'Revoked member cannot read rows');
 begin
  perform public.app_op_contractor_create('member-create-contract-02','{"id":"MEMBER_TEST_DENIED","name":"Denied","start_mode":"DETAILS"}');
  raise exception 'Revoked member wrote data';
 exception when insufficient_privilege then null; end;
end; $$;
set local "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000002';
select public.app_test_assert(not public.app_has_access(),'Uninvited user denied');
reset role;
select public.app_test_assert(not has_table_privilege('authenticated','public.app_members','TRUNCATE'),'Member table cannot be truncated');
select public.app_test_assert(not has_function_privilege('anon','public.app_has_access()','EXECUTE'),'Anon cannot call access helper');
select public.app_test_assert(not exists(select 1 from public.contractors where id='MEMBER_TEST_DENIED'),'Revoked write has no side effect');
rollback;

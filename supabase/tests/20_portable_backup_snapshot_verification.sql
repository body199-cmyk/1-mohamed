begin;
reset role;
select public.app_test_assert(
  not has_function_privilege('anon', 'public.app_portable_backup_snapshot(text)', 'EXECUTE'),
  'Portable snapshot is unavailable to anonymous users'
);

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';
select public.app_test_expect_error(
  'select public.app_portable_backup_snapshot()', 'Non-owner cannot export', array['42501']
);
select public.app_test_expect_error(
  'select portable_backup_private.read_snapshot(null)', 'Internal snapshot also requires owner', array['42501']
);

set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
select public.app_test_assert(
  (select count(*) from jsonb_object_keys(public.app_portable_backup_snapshot())) = 12,
  'Owner snapshot returns exactly the portable table set'
);
select public.app_test_assert(
  public.app_portable_backup_snapshot('vehicle_accounts') = jsonb_build_object(
    'vehicle_accounts', coalesce((select jsonb_agg(to_jsonb(a) order by vehicle_id, contractor_id)
                                  from public.vehicle_accounts a), '[]'::jsonb)),
  'CSV reads one table in its composite primary-key order'
);
select public.app_test_expect_error(
  $$select public.app_portable_backup_snapshot('auth.users')$$,
  'Export accepts only listed application tables', array['22023']
);

reset role;
insert into public.contractors(id, name)
select 'portable-cap-' || n, 'Portable cap ' || n from generate_series(1, 50001) n;
set local role authenticated;
select public.app_test_expect_error(
  $$select public.app_portable_backup_snapshot('contractors')$$,
  'Portable export rejects above the SQL row cap', array['P2011']
);
rollback;

begin;
reset role;
insert into public.backup_history
  (backup_date,format,file_name,drive_file_id,size_bytes,sha256,table_counts)
values
  ('2026-11-17','1-mohamed-full-supabase-logical-backup',
   '1-mohamed-2026-11-17.tar.gz.age','drive-test-file',1234,
   repeat('a',64),'{"trips":0}'::jsonb);
select public.app_test_assert(
  (select relrowsecurity from pg_class where oid='public.backup_history'::regclass),
  'Backup history has row-level security enabled'
);
select public.app_test_assert(
  has_table_privilege('authenticated','public.backup_history','SELECT'),
  'Authenticated role has the required read grant'
);
select public.app_test_assert(
  not has_table_privilege('anon','public.backup_history','SELECT'),
  'Anonymous role cannot read backup history'
);
select public.app_test_assert(
  not has_table_privilege('authenticated','public.backup_history','INSERT')
  and not has_table_privilege('authenticated','public.backup_history','UPDATE')
  and not has_table_privilege('authenticated','public.backup_history','DELETE'),
  'Authenticated users cannot mutate backup history'
);
set local role authenticated;
set local "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000001';
select public.app_test_assert(public.app_is_owner(),'Owner identity recognized for backup history');
select public.app_test_assert((select count(*)=1 from public.backup_history),'Owner can read backup history');
set local "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000003';
select public.app_test_assert((select count(*)=0 from public.backup_history),'Member cannot read owner-only backup history');
do $$ begin
  begin
    insert into public.backup_history
      (backup_date,format,file_name,drive_file_id,size_bytes,sha256,table_counts)
    values ('2026-11-18','1-mohamed-full-supabase-logical-backup',
      'blocked.tar.gz.age','blocked',1234,repeat('b',64),'{}'::jsonb);
    raise exception 'Member inserted backup history';
  exception when insufficient_privilege then null; end;
end; $$;
reset role;
select public.app_test_assert(
  (select count(*)=1 from public.backup_history),
  'Denied member mutation leaves history unchanged'
);
rollback;
